# ⏰ Barcode Alarm Feature — Release Notes & User Guide

Welcome to the **Barcode Alarm** feature update! This document provides complete configuration instructions, functional specs, and background architecture details to ensure the feature operates perfectly on your device.

---

## 🌟 What is the Barcode Alarm?
Unlike standard mobile alarms that you can easily swipe off in your sleep, the **Barcode Alarm** is designed to guarantee you wake up. It will **only** dismiss when you scan a pre-registered physical barcode (such as your toothpaste tube, a book, or a coffee mug) located outside your bed.

### Key Capabilities
1. **Bulletproof Background Service**: Uses a native Android Foreground Service. The alarm will fire even if the device is locked, in deep sleep (Doze mode), or if the React Native JS engine is closed.
2. **Motion-Mute (Smart Sensors)**: As soon as you physically pick up or move the device, the linear accelerometer registers the motion and immediately mutes/lowers the alarm sound, replacing it with a subtle vibration. This prevents disturbing others while you walk to scan the barcode.
3. **Lock-Screen Overlay**: Displays directly over the secure lock screen using native window flags (`FLAG_SHOW_WHEN_LOCKED`, `FLAG_TURN_SCREEN_ON`). You do not need to enter your PIN/pattern to scan the barcode.
4. **Boot Resilience**: Alarms survive device restarts. A native system listener automatically re-schedules the alarm when the phone boots up.
5. **Auto-Snooze Safety Loop**: Plays for a maximum of 60 seconds. If not dismissed, it auto-snoozes for 5 minutes (looping up to 5 times max) to protect your battery and device speakers.

---

## ⚙️ How to Setup the Alarm

1. **Navigate to Settings**:
   Open the application, navigate to the **Profile** tab, and tap **Barcode Alarm** under the *Alarm Settings* section.

2. **Enable the Switch**:
   Toggle the **Enable Barcode Alarm** switch.

3. **Schedule the Time**:
   Tap **Alarm Time** to select your daily wake-up time.

4. **Choose a Custom Sound**:
   Tap **Alarm Sound** to open your device's audio selector and choose any `.mp3`, `.wav`, or audio file.
   *Note: If your custom file is deleted or inaccessible, the app automatically falls back to your system's default alarm ringtone.*

5. **Register Your Barcode**:
   Tap **Unlock Barcode**. You can scan a physical barcode using your camera or import a photo of a barcode from your photo library.
   *Tip: Use a barcode on an item in your bathroom or kitchen (like a toothpaste bottle or cereal box) to force yourself to get out of bed!*

6. **Grant System Permissions**:
   * **Camera**: Required to scan the barcode during alarm dismissal.
   * **Exact Alarms (Android 12+)**: Tap **Configure Permission** if prompted to allow exact alarms, ensuring the system fires the alarm precisely at the scheduled second.
   * **Battery Optimizations**: Ensure the app is excluded from battery optimization so Android doesn't freeze the foreground service.

7. **Save**:
   Tap **Save Alarm Config** at the bottom of the screen to schedule the alarm.

---

## 🚀 Version Update Release Notes
*(Use this text to copy-paste into the version update screen logs so users are aware of the update)*

```markdown
🚀 NEW: Barcode Alarm (Beta)
- Stop sleeping through alarms! The alarm can only be dismissed by scanning a pre-registered physical barcode.
- Smart Sensor Muting: Picking up the phone instantly lowers/mutes the alarm sound and switches to a distinct vibration pattern.
- Native Android Service: Fully runs in the background, pierces Doze mode, and overlays on top of the lock screen.
- Boot Persistence: Alarms are restored automatically when your device restarts.
- Set custom wake-up audio, configure exact schedule timings, and scan any standard barcode format (EAN, UPC, QR).
```

---

## 🛠️ Native Technical Details (Under the Hood)
For developers verifying or maintaining the system:
* **Background Service**: `com.catalyst.essentials.AlarmForegroundService` (Runs with notification type `FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK`).
* **Triggering**: `AlarmManager.setExactAndAllowWhileIdle()` sends intent to `com.catalyst.essentials.AlarmBroadcastReceiver`.
* **Motion Listener**: Native Kotlin `SensorEventListener` on `Sensor.TYPE_LINEAR_ACCELERATION` with a low-pass motion threshold of `1.5 m/s²`.
* **Lock screen flags**: Native Kotlin `AlarmScreenActivity` forces lock screen visibility and blocks the Android back button gesture.
* **Storage Sync**: Config details are stored in `SharedPreferences` (`BarcodeAlarmPrefs`) so the Kotlin service can read the barcode payload and sound URI without booting the React Native JavaScript engine.
