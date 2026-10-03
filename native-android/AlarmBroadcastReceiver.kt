package com.catalyst.essentials

import android.app.AlarmManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

/**
 * Entry point for every alarm event: the AlarmManager trigger, the 60-second
 * auto-snooze, the barcode-scan dismiss, and boot (to re-arm the alarm).
 * Recovered from the v1.1.2 APK — see native-android/README.md.
 */
class AlarmBroadcastReceiver : BroadcastReceiver() {

  companion object {
    private const val TAG = "AlarmBroadcastReceiver"
    const val SNOOZE_SECONDS = 300
  }

  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      AlarmForegroundService.ACTION_ALARM_TRIGGER -> {
        val enabled = context.getSharedPreferences(AlarmSchedulerModule.PREFS_NAME, Context.MODE_PRIVATE)
          .getBoolean(AlarmSchedulerModule.KEY_ENABLED, false)
        if (enabled) startAlarmService(context) else Log.d(TAG, "Alarm disabled in prefs — ignoring trigger")
      }
      AlarmForegroundService.ACTION_AUTO_SNOOZE -> {
        Log.d(TAG, "Auto-snooze — stopping service, re-scheduling in ${SNOOZE_SECONDS}s")
        stopAlarmService(context)
        rescheduleIn(context, SNOOZE_SECONDS)
      }
      AlarmForegroundService.ACTION_DISMISS_ALARM -> {
        Log.d(TAG, "Dismissed — stopping service and arming tomorrow")
        stopAlarmService(context)
        rescheduleForNextDay(context)
      }
      Intent.ACTION_BOOT_COMPLETED, "android.intent.action.QUICKBOOT_POWERON" -> restoreAlarmAfterBoot(context)
    }
  }

  private fun startAlarmService(context: Context) {
    val intent = Intent(context, AlarmForegroundService::class.java).apply {
      action = AlarmForegroundService.ACTION_ALARM_TRIGGER
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent) else context.startService(intent)
  }

  private fun stopAlarmService(context: Context) {
    context.stopService(Intent(context, AlarmForegroundService::class.java))
  }

  private fun alarmManager(context: Context) = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

  private fun canScheduleExact(am: AlarmManager) =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms()

  private fun rescheduleIn(context: Context, delaySeconds: Int) {
    alarmManager(context).setExactAndAllowWhileIdle(
      AlarmManager.RTC_WAKEUP,
      System.currentTimeMillis() + delaySeconds * 1000L,
      AlarmSchedulerModule.alarmPendingIntent(context),
    )
  }

  private fun rescheduleForNextDay(context: Context) {
    val prefs = context.getSharedPreferences(AlarmSchedulerModule.PREFS_NAME, Context.MODE_PRIVATE)
    val hour = prefs.getInt(AlarmSchedulerModule.KEY_HOUR, -1)
    val minute = prefs.getInt(AlarmSchedulerModule.KEY_MINUTE, -1)
    if (hour == -1 || minute == -1) return
    val am = alarmManager(context)
    if (!canScheduleExact(am)) {
      Log.w(TAG, "Exact-alarm permission missing — cannot arm tomorrow's alarm")
      return
    }
    am.setExactAndAllowWhileIdle(
      AlarmManager.RTC_WAKEUP,
      AlarmSchedulerModule.nextOccurrence(hour, minute, forceTomorrow = true),
      AlarmSchedulerModule.alarmPendingIntent(context),
    )
  }

  private fun restoreAlarmAfterBoot(context: Context) {
    val prefs = context.getSharedPreferences(AlarmSchedulerModule.PREFS_NAME, Context.MODE_PRIVATE)
    val enabled = prefs.getBoolean(AlarmSchedulerModule.KEY_ENABLED, false)
    val hour = prefs.getInt(AlarmSchedulerModule.KEY_HOUR, -1)
    val minute = prefs.getInt(AlarmSchedulerModule.KEY_MINUTE, -1)
    if (!enabled || hour == -1 || minute == -1) return
    val am = alarmManager(context)
    if (!canScheduleExact(am)) {
      Log.w(TAG, "Exact-alarm permission missing — cannot restore after boot")
      return
    }
    am.setExactAndAllowWhileIdle(
      AlarmManager.RTC_WAKEUP,
      AlarmSchedulerModule.nextOccurrence(hour, minute),
      AlarmSchedulerModule.alarmPendingIntent(context),
    )
    Log.d(TAG, "Alarm restored after boot for $hour:$minute")
  }
}
