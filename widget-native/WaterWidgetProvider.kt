package com.catalyst.essentials

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
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
 * total, a capsule-shaped fill level (the same visual language as the
 * in-app water card) and a soft time-of-day glyph instead of a literal
 * clock.
 *
 * Five layout tiers, chosen from the widget's *current* size (so resizing
 * — down to a single 1x1 launcher cell, or into a tall 1-column strip —
 * live-switches the layout rather than clipping a bigger one):
 *  - tiny (both dimensions < 130dp, i.e. ~1x1): capsule + bare number.
 *    No quick-log chip — no room for a second tap target.
 *  - tall (< 180dp wide, >= 200dp tall, i.e. a narrow multi-row column):
 *    same content as compact, given room to breathe + a quick-log chip.
 *  - compact (< 180dp wide, < 200dp tall): amount + capsule + a chip.
 *  - wide (>= 180dp wide, not large): adds a single "+250ml" quick-log chip.
 *  - large (>= 250dp wide and >= 160dp tall): adds percent-of-goal,
 *    logs-today, and three quick-log amounts (100/250/500ml).
 *
 * Update strategy (battery-first):
 *  - No polling, no AlarmManager, no WorkManager.
 *  - [updateAll] is called by [WidgetDataStore] the instant the app logs or
 *    removes water, and by [WidgetQuickLogReceiver] the instant a widget
 *    quick-log chip is tapped, so the widget reflects reality immediately.
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
        // User resized the widget — re-render with the layout tier that fits.
        updateWidget(context, appWidgetManager, appWidgetId)
    }

    companion object {
        const val PREFS_NAME = "essentials_widget_prefs"
        const val KEY_WATER_ML = "water_ml"
        const val KEY_WATER_GOAL = "water_goal"
        const val KEY_LOGS_TODAY = "logs_today"
        // Local calendar date (YYYYMMDD) the cached water_ml/logs_today were
        // last written for. water_ml has no concept of "today" on its own —
        // without this tag, a widget that never gets reopened/tapped after
        // midnight keeps showing yesterday's total forever, since nothing
        // else ever tells it the day rolled over.
        const val KEY_SYNC_DATE_KEY = "sync_date_key"
        private const val DEFAULT_GOAL = 3000

        private const val ACTION_OPEN = "essentials:///?highlight=water"

        // Either dimension below this (dp) — roughly a single launcher cell —
        // gets the bare-minimum tiny layout.
        private const val TINY_MAX_DP = 130

        // A widget narrower than this (dp) gets the compact/stacked layout.
        private const val WIDE_MIN_WIDTH_DP = 180

        // Narrower than WIDE but at least this tall (dp) gets the tall layout.
        private const val TALL_MIN_HEIGHT_DP = 200

        // A widget at least this big (both dimensions) gets the large layout.
        private const val LARGE_MIN_WIDTH_DP = 250
        private const val LARGE_MIN_HEIGHT_DP = 160

        /**
         * Local calendar date as an YYYYMMDD int — deliberately the device's
         * local timezone (not UTC epoch days), so rollover happens at local
         * midnight, matching WaterStorage.ts's own "today" definition.
         */
        fun todayDateKey(): Int {
            val cal = Calendar.getInstance()
            return cal.get(Calendar.YEAR) * 10000 +
                (cal.get(Calendar.MONTH) + 1) * 100 +
                cal.get(Calendar.DAY_OF_MONTH)
        }

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

            // Roll the cached total over to 0 once the local date has moved on —
            // this runs on every render, including the OS's periodic 30-minute
            // onUpdate tick, so the widget resets itself even if the app is
            // never reopened after midnight. waterGoal is a setting, not a
            // daily total, so it's read regardless of staleness.
            val today = todayDateKey()
            val isStale = prefs.getInt(KEY_SYNC_DATE_KEY, 0) != today
            if (isStale) {
                prefs.edit()
                    .putInt(KEY_WATER_ML, 0)
                    .putInt(KEY_LOGS_TODAY, 0)
                    .putInt(KEY_SYNC_DATE_KEY, today)
                    .apply()
            }

            val waterMl = if (isStale) 0 else prefs.getInt(KEY_WATER_ML, 0)
            val waterGoal = prefs.getInt(KEY_WATER_GOAL, DEFAULT_GOAL).let { if (it <= 0) DEFAULT_GOAL else it }
            val logsToday = if (isStale) 0 else prefs.getInt(KEY_LOGS_TODAY, 0)

            val options = appWidgetManager.getAppWidgetOptions(appWidgetId)
            val minWidthDp = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, WIDE_MIN_WIDTH_DP)
            val minHeightDp = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, TALL_MIN_HEIGHT_DP)

            // Both dimensions have to be small — a single-row widget dragged
            // wide (the shape most people actually use) has height in the
            // same ~70-110dp range as a 1x1 cell on most launchers, so an OR
            // here would wrongly force every wide/large placement into tiny.
            val isTiny = minWidthDp < TINY_MAX_DP && minHeightDp < TINY_MAX_DP
            val isLarge = !isTiny && minWidthDp >= LARGE_MIN_WIDTH_DP && minHeightDp >= LARGE_MIN_HEIGHT_DP
            val isWide = !isTiny && !isLarge && minWidthDp >= WIDE_MIN_WIDTH_DP
            val isTall = !isTiny && !isLarge && !isWide && minHeightDp >= TALL_MIN_HEIGHT_DP

            val layoutRes = when {
                isTiny -> R.layout.widget_water_tiny
                isLarge -> R.layout.widget_water_large
                isWide -> R.layout.widget_water_wide
                isTall -> R.layout.widget_water_tall
                else -> R.layout.widget_water_square
            }
            val views = RemoteViews(context.packageName, layoutRes)

            val amountFormatted = NumberFormat.getIntegerInstance(Locale.getDefault()).format(waterMl)
            val goalFormatted = NumberFormat.getIntegerInstance(Locale.getDefault()).format(waterGoal)
            val progress = (waterMl.toFloat() / waterGoal.toFloat()).coerceIn(0f, 1f)
            val percent = (progress * 100).toInt()

            when {
                isTiny -> {
                    views.setTextViewText(R.id.tv_amount, amountFormatted)
                }
                isLarge -> {
                    views.setTextViewText(R.id.tv_amount, "$amountFormatted ml")
                    views.setTextViewText(R.id.tv_sub, "$percent% of $goalFormatted ml today")
                    views.setTextViewText(
                        R.id.tv_logs,
                        if (logsToday == 1) "1 log today" else "$logsToday logs today"
                    )
                    views.setOnClickPendingIntent(R.id.btn_quicklog_100, quickLogIntent(context, appWidgetId, 100))
                    views.setOnClickPendingIntent(R.id.btn_quicklog_250, quickLogIntent(context, appWidgetId, 250))
                    views.setOnClickPendingIntent(R.id.btn_quicklog_500, quickLogIntent(context, appWidgetId, 500))
                }
                isWide -> {
                    views.setTextViewText(R.id.tv_amount, "$amountFormatted ml")
                    views.setTextViewText(
                        R.id.tv_sub,
                        if (waterMl >= waterGoal) "goal reached today" else "of $goalFormatted ml today"
                    )
                    views.setOnClickPendingIntent(R.id.btn_quicklog, quickLogIntent(context, appWidgetId, 250))
                }
                isTall -> {
                    views.setTextViewText(R.id.tv_amount, "$amountFormatted ml")
                    views.setTextViewText(R.id.tv_sub, "today")
                    views.setOnClickPendingIntent(R.id.btn_quicklog, quickLogIntent(context, appWidgetId, 250))
                }
                else -> {
                    views.setTextViewText(R.id.tv_amount, amountFormatted)
                    views.setTextViewText(R.id.tv_sub, "ml today")
                    views.setOnClickPendingIntent(R.id.btn_quicklog, quickLogIntent(context, appWidgetId, 250))
                }
            }

            val capsuleWidthDp = when {
                isTiny -> 18
                isLarge -> 40
                isWide -> 28
                isTall -> 34
                else -> 26
            }
            val capsuleHeightDp = when {
                isTiny -> 28
                isLarge -> 66
                isWide -> 48
                isTall -> 72
                else -> 42
            }
            views.setImageViewBitmap(R.id.iv_ring, buildCapsuleBitmap(context, capsuleWidthDp, capsuleHeightDp, progress))
            if (!isTiny) {
                views.setImageViewResource(R.id.iv_time, timeOfDayIcon())
            }

            views.setOnClickPendingIntent(R.id.widget_root, openAppIntent(context, appWidgetId))

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }

        private fun openAppIntent(context: Context, appWidgetId: Int) =
            PendingIntent.getActivity(
                context,
                appWidgetId * 10,
                Intent(Intent.ACTION_VIEW, Uri.parse(ACTION_OPEN), context, MainActivity::class.java),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

        /**
         * Broadcasts directly to [WidgetQuickLogReceiver] instead of opening the
         * app — the receiver bumps the widget instantly and hands off to a
         * headless JS task to persist the log for real. Request code is keyed
         * by both widget instance and amount so the three large-layout chips
         * (and every other placed widget) get distinct PendingIntents instead
         * of overwriting each other's extras.
         */
        private fun quickLogIntent(context: Context, appWidgetId: Int, amountMl: Int): PendingIntent {
            val intent = Intent(context, WidgetQuickLogReceiver::class.java).apply {
                action = WidgetQuickLogReceiver.ACTION_QUICKLOG
                putExtra(WidgetQuickLogReceiver.EXTRA_AMOUNT_ML, amountMl)
            }
            val requestCode = appWidgetId * 10 + (amountMl % 9) + 1
            return PendingIntent.getBroadcast(
                context,
                requestCode,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        }

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
         * Draws a vertical capsule that fills bottom-up to [progress] — the
         * same "water level" visual language as the in-app hydration card,
         * rather than a generic ring. RemoteViews can't host arbitrary custom
         * views, so this is rendered as a bitmap once per update (cheap; only
         * runs on an actual data change or the 30-minute OS refresh).
         */
        private fun buildCapsuleBitmap(context: Context, widthDp: Int, heightDp: Int, progress: Float): Bitmap {
            val density = context.resources.displayMetrics.density
            val wPx = (widthDp * density).toInt().coerceAtLeast(1)
            val hPx = (heightDp * density).toInt().coerceAtLeast(1)
            val bitmap = Bitmap.createBitmap(wPx, hPx, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(bitmap)
            val radius = wPx / 2f
            val bounds = RectF(0f, 0f, wPx.toFloat(), hPx.toFloat())

            val trackColor = ContextCompat.getColor(context, R.color.widget_track)
            val fillColor = ContextCompat.getColor(context, R.color.widget_primary)

            val trackPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                style = Paint.Style.FILL
                color = trackColor
            }
            canvas.drawRoundRect(bounds, radius, radius, trackPaint)

            if (progress > 0f) {
                val fillHeight = hPx * progress.coerceIn(0f, 1f)
                val fillTop = hPx - fillHeight

                val clipPath = Path().apply { addRoundRect(bounds, radius, radius, Path.Direction.CW) }
                canvas.save()
                canvas.clipPath(clipPath)
                val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = fillColor }
                canvas.drawRect(0f, fillTop, wPx.toFloat(), hPx.toFloat(), fillPaint)
                canvas.restore()
            }

            // Thin gloss highlight near the top — echoes the card's own glass sheen.
            val glossPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = Color.WHITE
                alpha = 60
            }
            val glossRect = RectF(wPx * 0.22f, hPx * 0.08f, wPx * 0.78f, hPx * 0.16f)
            canvas.drawRoundRect(glossRect, glossRect.height() / 2f, glossRect.height() / 2f, glossPaint)

            return bitmap
        }
    }
}
