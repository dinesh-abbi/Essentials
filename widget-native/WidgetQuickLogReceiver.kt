package com.catalyst.essentials

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.facebook.react.HeadlessJsTaskService

/**
 * Handles taps on the widget's "+Nml" chip directly — no Activity, no
 * opening the app. Two things happen on receipt:
 *
 *  1. An immediate optimistic bump of the widget's own SharedPreferences
 *     total + repaint, so the tap feels instant.
 *  2. A [WidgetQuickLogTaskService] headless JS task is started to persist
 *     the log for real (AsyncStorage/Firestore via WaterStorage.ts) and
 *     then re-sync the widget from the authoritative total.
 *
 * Registered `exported="true"` because the actual dispatch comes from the
 * launcher process on the OS's behalf when the RemoteViews PendingIntent
 * fires — same reasoning as WaterWidgetProvider's receiver registration.
 * The amount extra is clamped defensively since an exported receiver can
 * in principle be triggered by anything holding this exact action string.
 */
class WidgetQuickLogReceiver : BroadcastReceiver() {

    companion object {
        const val ACTION_QUICKLOG = "com.catalyst.essentials.ACTION_WIDGET_QUICKLOG"
        const val EXTRA_AMOUNT_ML = "amountMl"
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != ACTION_QUICKLOG) return

        val amount = intent.getIntExtra(EXTRA_AMOUNT_ML, 0).coerceIn(0, 2000)
        if (amount <= 0) return

        val prefs = context.getSharedPreferences(WaterWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE)
        val today = WaterWidgetProvider.todayDateKey()
        val isStale = prefs.getInt(WaterWidgetProvider.KEY_SYNC_DATE_KEY, 0) != today
        val current = if (isStale) 0 else prefs.getInt(WaterWidgetProvider.KEY_WATER_ML, 0)
        val currentLogs = if (isStale) 0 else prefs.getInt(WaterWidgetProvider.KEY_LOGS_TODAY, 0)
        prefs.edit()
            .putInt(WaterWidgetProvider.KEY_WATER_ML, current + amount)
            .putInt(WaterWidgetProvider.KEY_LOGS_TODAY, currentLogs + 1)
            .putInt(WaterWidgetProvider.KEY_SYNC_DATE_KEY, today)
            .apply()
        WaterWidgetProvider.updateAll(context)

        HeadlessJsTaskService.acquireWakeLockNow(context)
        context.startService(
            Intent(context, WidgetQuickLogTaskService::class.java)
                .putExtra(EXTRA_AMOUNT_ML, amount)
        )
    }
}
