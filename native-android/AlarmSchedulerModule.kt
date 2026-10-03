package com.catalyst.essentials

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.Calendar

/**
 * JS bridge for the barcode alarm (`NativeModules.AlarmScheduler`).
 *
 * Recovered from the v1.1.2 release APK — this file previously existed only
 * inside the gitignored android/ folder. It is now tracked in
 * native-android/ and copied into android/ by withEssentialsNative.js.
 */
class AlarmSchedulerModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  companion object {
    const val PREFS_NAME = "BarcodeAlarmPrefs"
    const val KEY_ENABLED = "alarm_enabled"
    const val KEY_HOUR = "alarm_hour"
    const val KEY_MINUTE = "alarm_minute"
    const val KEY_BARCODE = "alarm_barcode_payload"
    const val KEY_SOUND_URI = "alarm_sound_uri"
    const val ALARM_REQUEST_CODE = 43521

    fun alarmPendingIntent(context: Context): PendingIntent {
      val intent = Intent(context, AlarmBroadcastReceiver::class.java).apply {
        action = AlarmForegroundService.ACTION_ALARM_TRIGGER
      }
      return PendingIntent.getBroadcast(
        context,
        ALARM_REQUEST_CODE,
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    }

    fun nextOccurrence(hour: Int, minute: Int, forceTomorrow: Boolean = false): Long {
      val cal = Calendar.getInstance().apply {
        set(Calendar.HOUR_OF_DAY, hour)
        set(Calendar.MINUTE, minute)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
      }
      if (forceTomorrow || cal.timeInMillis <= System.currentTimeMillis()) {
        cal.add(Calendar.DAY_OF_YEAR, 1)
      }
      return cal.timeInMillis
    }
  }

  override fun getName(): String = "AlarmScheduler"

  private fun alarmManager(): AlarmManager =
    reactContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager

  @ReactMethod
  fun scheduleAlarm(hour: Int, minute: Int, promise: Promise) {
    try {
      val am = alarmManager()
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
        promise.reject("PERMISSION_DENIED", "SCHEDULE_EXACT_ALARM permission not granted. Open settings to allow it.")
        return
      }
      am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, nextOccurrence(hour, minute), alarmPendingIntent(reactContext))
      promise.resolve("Alarm scheduled for $hour:${minute.toString().padStart(2, '0')}")
    } catch (e: Exception) {
      promise.reject("SCHEDULE_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun scheduleSnooze(delaySeconds: Int, promise: Promise) {
    try {
      alarmManager().setExactAndAllowWhileIdle(
        AlarmManager.RTC_WAKEUP,
        System.currentTimeMillis() + delaySeconds * 1000L,
        alarmPendingIntent(reactContext),
      )
      promise.resolve("Snooze scheduled in ${delaySeconds}s")
    } catch (e: Exception) {
      promise.reject("SNOOZE_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun cancelAlarm(promise: Promise) {
    try {
      alarmManager().cancel(alarmPendingIntent(reactContext))
      promise.resolve("Alarm cancelled")
    } catch (e: Exception) {
      promise.reject("CANCEL_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun dismissAlarm(promise: Promise) {
    try {
      val intent = Intent(reactContext, AlarmBroadcastReceiver::class.java).apply {
        action = AlarmForegroundService.ACTION_DISMISS_ALARM
      }
      reactContext.sendBroadcast(intent)
      promise.resolve("Dismiss broadcast sent")
    } catch (e: Exception) {
      promise.reject("DISMISS_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun saveAlarmConfig(hour: Int, minute: Int, barcodePayload: String, soundUri: String, promise: Promise) {
    try {
      reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
        .putBoolean(KEY_ENABLED, true)
        .putInt(KEY_HOUR, hour)
        .putInt(KEY_MINUTE, minute)
        .putString(KEY_BARCODE, barcodePayload)
        .putString(KEY_SOUND_URI, soundUri)
        .apply()
      promise.resolve("Config saved")
    } catch (e: Exception) {
      promise.reject("SAVE_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun clearAlarmConfig(promise: Promise) {
    try {
      reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit().clear().apply()
      promise.resolve("Config cleared")
    } catch (e: Exception) {
      promise.reject("CLEAR_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun openExactAlarmSettings(promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val intent = Intent("android.settings.REQUEST_SCHEDULE_EXACT_ALARM").apply {
          flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        reactContext.startActivity(intent)
        promise.resolve("Settings opened")
      } else {
        promise.resolve("Not required on this Android version")
      }
    } catch (e: Exception) {
      promise.reject("SETTINGS_ERROR", e.message, e)
    }
  }

  /** True once per alarm launch — the JS root layout routes to /alarm/screen. */
  @ReactMethod
  fun checkAlarmLaunch(promise: Promise) {
    val activity = reactApplicationContext.currentActivity
    if (activity != null && activity.intent.getBooleanExtra(AlarmScreenActivity.EXTRA_SHOW_ALARM_SCREEN, false)) {
      activity.intent.putExtra(AlarmScreenActivity.EXTRA_SHOW_ALARM_SCREEN, false)
      promise.resolve(true)
    } else {
      promise.resolve(false)
    }
  }

  @ReactMethod
  fun canScheduleExactAlarms(promise: Promise) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      promise.resolve(alarmManager().canScheduleExactAlarms())
    } else {
      promise.resolve(true)
    }
  }
}
