package com.catalyst.essentials

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.CountDownTimer
import android.os.IBinder
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import androidx.core.app.NotificationCompat
import java.io.File
import kotlin.math.sqrt

/**
 * The ringing alarm: loops the chosen sound, launches the lock-screen alarm
 * activity via a full-screen notification, mutes to vibration once the phone
 * is picked up (linear-acceleration threshold), and auto-snoozes after a
 * 60-second scan window. Recovered from the v1.1.2 APK.
 */
class AlarmForegroundService : Service(), SensorEventListener {

  companion object {
    const val ACTION_ALARM_TRIGGER = "com.catalyst.essentials.ACTION_ALARM_TRIGGER"
    const val ACTION_AUTO_SNOOZE = "com.catalyst.essentials.ACTION_AUTO_SNOOZE"
    const val ACTION_DISMISS_ALARM = "com.catalyst.essentials.ACTION_DISMISS_ALARM"
    private const val CHANNEL_ID = "barcode_alarm_channel"
    private const val CHANNEL_NAME = "Barcode Alarm"
    private const val MOTION_THRESHOLD_MS2 = 2.5f
    private const val NOTIF_ID = 9001
    private const val FULLSCREEN_NOTIF_ID = 9002
    private const val SCAN_WINDOW_MS = 60_000L
    private const val TAG = "AlarmForegroundService"
    private val VIBRATION_PATTERN = longArrayOf(0, 400, 200, 400, 200, 400)
  }

  private var mediaPlayer: MediaPlayer? = null
  private var sensorManager: SensorManager? = null
  private var accelerometer: Sensor? = null
  private var countDownTimer: CountDownTimer? = null
  private var isMotionDetected = false
  private var isRunning = false

  private val dismissReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
      if (intent.action == ACTION_DISMISS_ALARM) stopSelf()
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    createNotificationChannel()
    val filter = IntentFilter(ACTION_DISMISS_ALARM)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      registerReceiver(dismissReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
    } else {
      @Suppress("UnspecifiedRegisterReceiverFlag")
      registerReceiver(dismissReceiver, filter)
    }
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (isRunning) return START_STICKY
    isRunning = true
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIF_ID, buildOngoingNotification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
    } else {
      startForeground(NOTIF_ID, buildOngoingNotification())
    }
    startAudio()
    startSensorTracking()
    launchAlarmScreen()
    startScanWindowTimer()
    return START_STICKY
  }

  override fun onDestroy() {
    super.onDestroy()
    isRunning = false
    countDownTimer?.cancel()
    stopAudio()
    stopSensorTracking()
    stopVibration()
    (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).cancel(FULLSCREEN_NOTIF_ID)
    try {
      unregisterReceiver(dismissReceiver)
    } catch (_: Exception) {
    }
  }

  // ── Audio ─────────────────────────────────────────────────────────────────

  private fun startAudio() {
    val uri = resolveAudioUri(
      getSharedPreferences(AlarmSchedulerModule.PREFS_NAME, Context.MODE_PRIVATE)
        .getString(AlarmSchedulerModule.KEY_SOUND_URI, null),
    )
    try {
      mediaPlayer = MediaPlayer().apply {
        setAudioAttributes(
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
            .build(),
        )
        setDataSource(applicationContext, uri)
        isLooping = true
        prepare()
        start()
      }
    } catch (e: Exception) {
      Log.e(TAG, "Primary audio failed, trying system fallback: ${e.message}")
      playSystemAlarmFallback()
    }
  }

  private fun systemAlarmUri(): Uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)

  private fun resolveAudioUri(uriStr: String?): Uri {
    if (uriStr.isNullOrBlank()) return systemAlarmUri()
    return try {
      val uri = Uri.parse(uriStr)
      when (uri.scheme) {
        "file" -> if (File(uri.path ?: "").exists()) uri else systemAlarmUri()
        "content" -> contentResolver.openInputStream(uri)?.use { uri } ?: systemAlarmUri()
        else -> uri
      }
    } catch (e: Exception) {
      Log.e(TAG, "URI resolution failed — falling back to system alarm: ${e.message}")
      systemAlarmUri()
    }
  }

  private fun playSystemAlarmFallback() {
    try {
      mediaPlayer?.release()
      mediaPlayer = MediaPlayer().apply {
        setAudioAttributes(
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build(),
        )
        setDataSource(applicationContext, systemAlarmUri())
        isLooping = true
        prepare()
        start()
      }
    } catch (e: Exception) {
      Log.e(TAG, "Even system alarm fallback failed: ${e.message}")
    }
  }

  private fun stopAudio() {
    try {
      mediaPlayer?.let {
        if (it.isPlaying) it.stop()
        it.release()
      }
    } catch (e: Exception) {
      Log.e(TAG, "Error stopping audio: ${e.message}")
    }
    mediaPlayer = null
  }

  private fun muteAudio() {
    try {
      mediaPlayer?.setVolume(0f, 0f)
    } catch (e: Exception) {
      Log.e(TAG, "Error muting audio: ${e.message}")
    }
  }

  // ── Motion → mute ────────────────────────────────────────────────────────

  private fun startSensorTracking() {
    val sm = getSystemService(Context.SENSOR_SERVICE) as? SensorManager
    sensorManager = sm
    accelerometer = sm?.getDefaultSensor(Sensor.TYPE_LINEAR_ACCELERATION)
      ?: sm?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
    accelerometer?.let { sm?.registerListener(this, it, SensorManager.SENSOR_DELAY_NORMAL) }
  }

  private fun stopSensorTracking() {
    sensorManager?.unregisterListener(this)
    sensorManager = null
    accelerometer = null
  }

  override fun onSensorChanged(event: SensorEvent) {
    if (isMotionDetected) return
    val (x, y, z) = Triple(event.values[0], event.values[1], event.values[2])
    if (sqrt(x * x + y * y + z * z) > MOTION_THRESHOLD_MS2) {
      isMotionDetected = true
      muteAudio()
      startVibration()
      updateNotificationToScanPrompt()
    }
  }

  override fun onAccuracyChanged(sensor: Sensor, accuracy: Int) = Unit

  private fun vibrator(): Vibrator =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      (getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
    } else {
      @Suppress("DEPRECATION")
      getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
    }

  private fun startVibration() {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        vibrator().vibrate(VibrationEffect.createWaveform(VIBRATION_PATTERN, 0))
      } else {
        @Suppress("DEPRECATION")
        vibrator().vibrate(VIBRATION_PATTERN, 0)
      }
    } catch (e: Exception) {
      Log.e(TAG, "Vibration failed: ${e.message}")
    }
  }

  private fun stopVibration() {
    try {
      vibrator().cancel()
    } catch (e: Exception) {
      Log.e(TAG, "Error stopping vibration: ${e.message}")
    }
  }

  // ── Screen + timers ──────────────────────────────────────────────────────

  private fun alarmActivityIntent(): PendingIntent {
    val intent = Intent(this, AlarmScreenActivity::class.java).apply {
      action = ACTION_ALARM_TRIGGER
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
    }
    return PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  private fun launchAlarmScreen() {
    val notification = baseNotification("⏰ Barcode Alarm", "Scan barcode to dismiss")
      .setFullScreenIntent(alarmActivityIntent(), true)
      .build()
    (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).notify(FULLSCREEN_NOTIF_ID, notification)
  }

  private fun startScanWindowTimer() {
    countDownTimer = object : CountDownTimer(SCAN_WINDOW_MS, 1000L) {
      override fun onTick(millisUntilFinished: Long) = Unit
      override fun onFinish() {
        val intent = Intent(this@AlarmForegroundService, AlarmBroadcastReceiver::class.java).apply {
          action = ACTION_AUTO_SNOOZE
        }
        sendBroadcast(intent)
      }
    }.start()
  }

  // ── Notifications ────────────────────────────────────────────────────────

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_HIGH).apply {
        description = "Barcode Alarm active notification"
        setSound(null, null)
        enableVibration(false)
        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      }
      (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(channel)
    }
  }

  private fun baseNotification(title: String, text: String): NotificationCompat.Builder =
    NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
      .setContentTitle(title)
      .setContentText(text)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setOngoing(true)
      .setAutoCancel(false)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)

  private fun buildOngoingNotification(): Notification =
    baseNotification("⏰ Barcode Alarm", "Open to scan your barcode and dismiss")
      .setContentIntent(alarmActivityIntent())
      .build()

  private fun updateNotificationToScanPrompt() {
    val notification = baseNotification("📷 Scan Barcode to Dismiss", "Audio muted — scan the barcode to turn off alarm")
      .setContentIntent(alarmActivityIntent())
      .build()
    (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).notify(NOTIF_ID, notification)
  }
}
