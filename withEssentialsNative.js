const fs = require('fs');
const path = require('path');
const {
  withAndroidManifest,
  withAppBuildGradle,
  withDangerousMod,
  withMainActivity,
  withMainApplication,
  AndroidConfig,
} = require('@expo/config-plugins');

const { getMainApplicationOrThrow } = AndroidConfig.Manifest;

const PACKAGE_PATH = 'com/catalyst/essentials';
const SOURCE_DIR = 'native-android';
const MARK = '// essentials-native';

/**
 * Makes the barcode alarm + QR scanner native code durable.
 *
 * Until v1.2.0 these classes existed only inside the gitignored android/
 * folder, so a fresh clone (or `expo prebuild --clean`) silently produced an
 * app whose alarm and gallery-QR features were missing. They were recovered
 * from the v1.1.2 release APK into ./native-android, and this plugin puts
 * them back on every prebuild — same pattern as withWaterWidget.js:
 *
 *   1. copies native-android/*.kt into app/src/main/java/com/catalyst/essentials
 *   2. declares the service, receiver, lock-screen activity and permissions
 *   3. registers EssentialsNativePackage in MainApplication
 *   4. teaches MainActivity to show over the lock screen for an alarm launch
 *   5. adds the ML Kit barcode dependency the QR module needs
 */

const withNativeSources = (config) =>
  withDangerousMod(config, [
    'android',
    async (config) => {
      const src = path.join(config.modRequest.projectRoot, SOURCE_DIR);
      const dest = path.join(config.modRequest.platformProjectRoot, 'app/src/main/java', PACKAGE_PATH);
      fs.mkdirSync(dest, { recursive: true });
      for (const file of fs.readdirSync(src)) {
        if (file.endsWith('.kt')) fs.copyFileSync(path.join(src, file), path.join(dest, file));
      }
      return config;
    },
  ]);

const PERMISSIONS = [
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
  'android.permission.RECEIVE_BOOT_COMPLETED',
  'android.permission.WAKE_LOCK',
  'android.permission.VIBRATE',
  'android.permission.USE_FULL_SCREEN_INTENT',
  'android.permission.HIGH_SAMPLING_RATE_SENSORS',
  'android.permission.READ_MEDIA_AUDIO',
  'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
  'android.permission.SYSTEM_ALERT_WINDOW',
];

const withNativeManifest = (config) =>
  withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest['uses-permission'] = manifest['uses-permission'] ?? [];
    for (const name of PERMISSIONS) {
      if (!manifest['uses-permission'].some((p) => p.$?.['android:name'] === name)) {
        manifest['uses-permission'].push({ $: { 'android:name': name } });
      }
    }

    const app = getMainApplicationOrThrow(config.modResults);
    app.service = app.service ?? [];
    app.receiver = app.receiver ?? [];
    app.activity = app.activity ?? [];

    if (!app.service.some((s) => s.$?.['android:name'] === '.AlarmForegroundService')) {
      app.service.push({
        $: {
          'android:name': '.AlarmForegroundService',
          'android:exported': 'false',
          'android:stopWithTask': 'false',
          'android:foregroundServiceType': 'mediaPlayback',
        },
      });
    }

    if (!app.receiver.some((r) => r.$?.['android:name'] === '.AlarmBroadcastReceiver')) {
      app.receiver.push({
        // Exported for BOOT_COMPLETED; the alarm actions are sent explicitly.
        $: { 'android:name': '.AlarmBroadcastReceiver', 'android:exported': 'true' },
        'intent-filter': [
          {
            action: [
              'android.intent.action.BOOT_COMPLETED',
              'android.intent.action.QUICKBOOT_POWERON',
              'com.catalyst.essentials.ACTION_ALARM_TRIGGER',
              'com.catalyst.essentials.ACTION_AUTO_SNOOZE',
              'com.catalyst.essentials.ACTION_DISMISS_ALARM',
            ].map((name) => ({ $: { 'android:name': name } })),
          },
        ],
      });
    }

    if (!app.activity.some((a) => a.$?.['android:name'] === '.AlarmScreenActivity')) {
      app.activity.push({
        $: {
          'android:name': '.AlarmScreenActivity',
          'android:theme': '@style/AppTheme',
          'android:exported': 'true',
          'android:taskAffinity': '',
          'android:excludeFromRecents': 'true',
          'android:launchMode': 'singleTop',
          'android:showWhenLocked': 'true',
          'android:turnScreenOn': 'true',
        },
      });
    }
    return config;
  });

const withNativePackage = (config) =>
  withMainApplication(config, (config) => {
    const contents = config.modResults.contents;
    if (contents.includes('EssentialsNativePackage()')) return config;
    config.modResults.contents = contents.replace(
      /(PackageList\(this\)\.packages\.apply\s*\{)/,
      `$1\n          add(EssentialsNativePackage()) ${MARK}`
    );
    return config;
  });

const withAlarmAwareMainActivity = (config) =>
  withMainActivity(config, (config) => {
    let contents = config.modResults.contents;
    if (contents.includes(MARK)) return config;

    if (!contents.includes('import android.content.Intent')) {
      contents = contents.replace(/(package [^\n]+\n)/, `$1\nimport android.content.Intent\n`);
    }
    // Run before super.onCreate so the very first frame can draw over the keyguard.
    contents = contents.replace(
      /(override fun onCreate\(savedInstanceState: Bundle\?\)\s*\{)/,
      `$1\n    showOverLockScreenForAlarm(intent) ${MARK}`
    );
    // Append the helpers just before the class's final closing brace.
    const lastBrace = contents.lastIndexOf('}');
    contents =
      contents.slice(0, lastBrace) +
      `
  ${MARK}: an alarm launch (AlarmScreenActivity → here) must appear over the lock screen.
  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    showOverLockScreenForAlarm(intent)
  }

  private fun showOverLockScreenForAlarm(intent: Intent?) {
    if (intent?.getBooleanExtra(AlarmScreenActivity.EXTRA_SHOW_ALARM_SCREEN, false) == true) {
      AlarmScreenActivity.applyLockScreenFlags(this)
    }
  }
` +
      contents.slice(lastBrace);
    config.modResults.contents = contents;
    return config;
  });

const withMlKit = (config) =>
  withAppBuildGradle(config, (config) => {
    const contents = config.modResults.contents;
    if (contents.includes('com.google.mlkit:barcode-scanning')) return config;
    config.modResults.contents = contents.replace(
      /dependencies\s*\{/,
      `dependencies {\n    implementation("com.google.mlkit:barcode-scanning:17.2.0") ${MARK}`
    );
    return config;
  });

module.exports = function withEssentialsNative(config) {
  config = withNativeSources(config);
  config = withNativeManifest(config);
  config = withNativePackage(config);
  config = withAlarmAwareMainActivity(config);
  config = withMlKit(config);
  return config;
};
