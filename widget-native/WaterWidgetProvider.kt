package com.catalyst.essentials

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.net.Uri
import android.os.Bundle
import android.widget.RemoteViews
import androidx.core.content.ContextCompat
import java.text.NumberFormat
import java.util.Calendar
import java.util.Locale

/**
 * Home-screen widget for the hydration tracker.
 *
 * Design intent: a quiet "glass" card, not a dashboard. It shows today's
 * total, a slim progress ring around a water-drop glyph, and a soft
 * time-of-day glyph (sunrise/day/sunset/night) instead of a literal clock.
 *
 * Update strategy (battery-first):
 *  - No polling, no AlarmManager, no WorkManager.
 *  - [updateAll] is called by [WidgetDataStore] the instant the app logs or
 *    removes water, so the widget reflects reality immediately after any
 *    change made from anywhere in the app.
 *  - The manifest-declared `updatePeriodMillis` (30 minutes, the OS-enforced
 *    floor) is only a safety net so the day-rollover and time-of-day glyph
 *    stay fresh even if the app is never opened.
 */
class WaterWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (id in appWidgetIds) {
            updateWidget(context, appWidgetManager, id)
        }
    }

    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: Bundle
    ) {
        // User resized the widget — re-render with the layout that fits.
        updateWidget(context, appWidgetManager, appWidgetId)
    }

    companion object {
        const val PREFS_NAME = "essentials_widget_prefs"
        const val KEY_WATER_ML = "water_ml"
        const val KEY_WATER_GOAL = "water_goal"
        private const val DEFAULT_GOAL = 3000

        private const val ACTION_OPEN = "essentials:///?highlight=water"
        private const val ACTION_QUICKLOG = "essentials:///?highlight=water&quicklog=250"

        // A widget narrower than this (dp) gets the stacked/compact layout.
        private const val WIDE_LAYOUT_MIN_WIDTH_DP = 180

        /** Push the latest numbers to every placed instance of this widget. */
        fun updateAll(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, WaterWidgetProvider::class.java))
            for (id in ids) {
                updateWidget(context, manager, id)
            }
        }

        private fun updateWidget(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int) {
            val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val waterMl = prefs.getInt(KEY_WATER_ML, 0)
            val waterGoal = prefs.getInt(KEY_WATER_GOAL, DEFAULT_GOAL).let { if (it <= 0) DEFAULT_GOAL else it }

            val options = appWidgetManager.getAppWidgetOptions(appWidgetId)
            val minWidthDp = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, WIDE_LAYOUT_MIN_WIDTH_DP)
            val useWide = minWidthDp >= WIDE_LAYOUT_MIN_WIDTH_DP

            val layoutRes = if (useWide) R.layout.widget_water_wide else R.layout.widget_water_square
            val views = RemoteViews(context.packageName, layoutRes)

            val amountFormatted = NumberFormat.getIntegerInstance(Locale.getDefault()).format(waterMl)
            val goalFormatted = NumberFormat.getIntegerInstance(Locale.getDefault()).format(waterGoal)
            val progress = (waterMl.toFloat() / waterGoal.toFloat()).coerceIn(0f, 1f)

            if (useWide) {
                views.setTextViewText(R.id.tv_amount, "$amountFormatted ml")
                views.setTextViewText(
                    R.id.tv_sub,
                    if (waterMl >= waterGoal) "goal reached today" else "of $goalFormatted ml today"
                )
            } else {
                views.setTextViewText(R.id.tv_amount, amountFormatted)
                views.setTextViewText(R.id.tv_sub, "ml today")
            }

            val ringSizeDp = if (useWide) 52 else 48
            views.setImageViewBitmap(R.id.iv_ring, buildRingBitmap(context, ringSizeDp, progress))
            views.setImageViewResource(R.id.iv_time, timeOfDayIcon())

            views.setOnClickPendingIntent(R.id.widget_root, openAppIntent(context, appWidgetId))
            views.setOnClickPendingIntent(R.id.btn_quicklog, quickLogIntent(context, appWidgetId))

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }

        private fun openAppIntent(context: Context, appWidgetId: Int) =
            android.app.PendingIntent.getActivity(
                context,
                appWidgetId * 2,
                Intent(Intent.ACTION_VIEW, Uri.parse(ACTION_OPEN), context, MainActivity::class.java),
                android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
            )

        private fun quickLogIntent(context: Context, appWidgetId: Int) =
            android.app.PendingIntent.getActivity(
                context,
                appWidgetId * 2 + 1,
                Intent(Intent.ACTION_VIEW, Uri.parse(ACTION_QUICKLOG), context, MainActivity::class.java),
                android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
            )

        /** 4 quiet phases instead of a literal time — matches the app's low-noise tone. */
        private fun timeOfDayIcon(): Int {
            val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
            return when (hour) {
                in 5..10 -> R.drawable.ic_widget_time_sunrise
                in 11..16 -> R.drawable.ic_widget_time_day
                in 17..19 -> R.drawable.ic_widget_time_sunset
                else -> R.drawable.ic_widget_time_night
            }
        }

        /**
         * Draws the ring + water-drop glyph as a bitmap. RemoteViews can't host
         * arbitrary custom views, so the "next level" progress visual is
         * rendered here once per update rather than every frame — cheap, and
         * only runs on an actual data change or the 30-minute OS refresh.
         */
        private fun buildRingBitmap(context: Context, sizeDp: Int, progress: Float): Bitmap {
            val density = context.resources.displayMetrics.density
            val sizePx = (sizeDp * density).toInt().coerceAtLeast(1)
            val bitmap = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(bitmap)

            val trackColor = ContextCompat.getColor(context, R.color.widget_track)
            val progressColor = ContextCompat.getColor(context, R.color.widget_primary)
            val strokeWidthPx = 3f * density
            val inset = strokeWidthPx / 2f + 1.5f * density
            val arcRect = RectF(inset, inset, sizePx - inset, sizePx - inset)

            val trackPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                style = Paint.Style.STROKE
                strokeWidth = strokeWidthPx
                strokeCap = Paint.Cap.ROUND
                color = trackColor
            }
            canvas.drawArc(arcRect, 0f, 360f, false, trackPaint)

            if (progress > 0f) {
                val progressPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    style = Paint.Style.STROKE
                    strokeWidth = strokeWidthPx
                    strokeCap = Paint.Cap.ROUND
                    color = progressColor
                }
                canvas.drawArc(arcRect, -90f, 360f * progress, false, progressPaint)
            }

            // Water-drop glyph, centered, drawn as two mirrored cubic curves.
            val dropPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                style = Paint.Style.FILL
                color = progressColor
                alpha = 235
            }
            val cx = sizePx / 2f
            val cy = sizePx / 2f
            val r = sizePx * 0.165f
            val path = Path().apply {
                moveTo(cx, cy - r * 1.4f)
                cubicTo(cx + r * 1.2f, cy - r * 0.1f, cx + r * 0.9f, cy + r * 1.2f, cx, cy + r * 1.05f)
                cubicTo(cx - r * 0.9f, cy + r * 1.2f, cx - r * 1.2f, cy - r * 0.1f, cx, cy - r * 1.4f)
                close()
            }
            canvas.drawPath(path, dropPaint)

            return bitmap
        }
    }
}
