package com.catalyst.essentials

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Bundle
import android.view.WindowManager

/**
 * A tiny trampoline that can show over the lock screen and wake the display.
 * It immediately launches MainActivity with EXTRA_SHOW_ALARM_SCREEN, which
 * the JS layer (AlarmScheduler.checkAlarmLaunch) turns into /alarm/screen.
 * Back is blocked — only a barcode scan dismisses the alarm.
 * Recovered from the v1.1.2 APK.
 */
class AlarmScreenActivity : Activity() {

  companion object {
    const val EXTRA_SHOW_ALARM_SCREEN = "SHOW_ALARM_SCREEN"

    /** Shared with MainActivity so both windows can appear over the keyguard. */
    fun applyLockScreenFlags(activity: Activity) {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
        activity.setShowWhenLocked(true)
        activity.setTurnScreenOn(true)
      } else {
        @Suppress("DEPRECATION")
        activity.window.addFlags(
          WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON,
        )
      }
      activity.window.addFlags(
        WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or WindowManager.LayoutParams.FLAG_ALLOW_LOCK_WHILE_SCREEN_ON,
      )
    }
  }

  private val dismissReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
      if (intent.action == AlarmForegroundService.ACTION_DISMISS_ALARM) finish()
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    applyLockScreenFlags(this)
    super.onCreate(null)

    val filter = IntentFilter(AlarmForegroundService.ACTION_DISMISS_ALARM)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      registerReceiver(dismissReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
    } else {
      @Suppress("UnspecifiedRegisterReceiverFlag")
      registerReceiver(dismissReceiver, filter)
    }

    startActivity(
      Intent(this, MainActivity::class.java).apply {
        putExtra(EXTRA_SHOW_ALARM_SCREEN, true)
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
      },
    )
  }

  override fun onDestroy() {
    super.onDestroy()
    try {
      unregisterReceiver(dismissReceiver)
    } catch (_: Exception) {
    }
  }

  @Deprecated("Back is intentionally blocked while the alarm rings")
  override fun onBackPressed() {
    // Only a barcode scan dismisses the alarm.
  }
}
