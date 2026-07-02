import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

let Notifications: any = null;
let IntentLauncher: any = null;
const isExpoGo = Constants.appOwnership === 'expo';

if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications');
  } catch (e) {
    console.warn('Failed to load expo-notifications:', e);
  }
  try {
    IntentLauncher = require('expo-intent-launcher');
  } catch (e) {
    console.warn('Failed to load expo-intent-launcher:', e);
  }
}

if (!Notifications) {
  Notifications = {
    setNotificationHandler: () => {},
    addNotificationResponseReceivedListener: () => ({ remove: () => {} }),
    cancelAllScheduledNotificationsAsync: async () => {},
    scheduleNotificationAsync: async () => '',
    requestPermissionsAsync: async () => ({ status: 'granted' }),
    getPermissionsAsync: async () => ({ status: 'granted' }),
    setNotificationChannelAsync: async () => null,
    setNotificationCategoryAsync: async () => null,
    getAllScheduledNotificationsAsync: async () => [],
    AndroidImportance: { MAX: 5 },
    SchedulableTriggerInputTypes: { DAILY: 'daily', TIME_INTERVAL: 'timeInterval' },
    DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
  };
}

export { Notifications };

// ── Unified App Notification Channel ──────────────────────────────────────────
// All notifications from Essentials use this single channel so they have a
// distinct, recognizable sound separate from other apps on the device.
const APP_CHANNEL_ID = 'essentials_default_channel';
const REMINDER_CATEGORY_ID = 'WATER_REMINDER_CATEGORY';

// ── Expected number of hourly reminder notifications (8 AM to 10 PM = 15 hours) ──
const REMINDER_HOURS = Array.from({ length: 15 }, (_, i) => 8 + i); // [8, 9, ..., 22]
const EXPECTED_REMINDER_COUNT = REMINDER_HOURS.length;

// Configure default notification handler behaviors
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Permission & Configuration Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configure notifications: request permission, setup categories, and register sound channels
 */
export async function configureNotifications() {
  // 1. Check & Request Permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    console.warn('Notification permissions not granted');
    return false;
  }

  // 2. Register Interactive Action Categories (Yes/No buttons)
  await Notifications.setNotificationCategoryAsync(REMINDER_CATEGORY_ID, [
    {
      identifier: 'YES_ACTION',
      buttonTitle: 'Yes, drank 250ml 💧',
      options: {
        opensAppToForeground: true, // Open app to trigger auto-add and highlight
      },
    },
    {
      identifier: 'NO_ACTION',
      buttonTitle: 'No, remind later',
      options: {
        opensAppToForeground: false,
      },
    },
  ]);

  // 3. Register Unified Android Sound Channel for ALL app notifications
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(APP_CHANNEL_ID, {
      name: 'Essentials Alerts',
      description: 'All notifications from Essentials (water reminders, goals, etc.)',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#3B82F6',
      sound: 'water_remainder.mp3', // Matches app.json sounds array asset filename
    });
  }

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Battery Optimization & Exact Alarm Permission Checks (Android only)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if battery optimization is ignored (unrestricted) for this app.
 * Returns true if unrestricted, false if restricted, null if not applicable.
 */
export async function isBatteryOptimizationIgnored(): Promise<boolean | null> {
  if (Platform.OS !== 'android' || !IntentLauncher) return null;

  try {
    // We can't directly check battery optimization status from JS.
    // We store the user's response after they visit settings.
    const value = await AsyncStorage.getItem('@battery_optimization_dismissed');
    return value === 'true';
  } catch {
    return null;
  }
}

/**
 * Open the Android battery optimization settings for this app.
 * Prompts the user to set the app as "Unrestricted" to prevent Doze mode
 * from delaying notifications.
 */
export async function openBatteryOptimizationSettings(): Promise<void> {
  if (Platform.OS !== 'android' || !IntentLauncher) return;

  try {
    // Open the battery optimization exemption request dialog
    await IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
      {
        data: `package:com.catalyst.essentials`,
      }
    );
  } catch (e) {
    console.warn('Failed to open battery optimization settings, trying fallback:', e);
    try {
      // Fallback: open the general battery optimization settings list
      await IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS
      );
    } catch (e2) {
      console.warn('Fallback battery settings also failed:', e2);
    }
  }
}

/**
 * Mark battery optimization as having been addressed by the user.
 */
export async function markBatteryOptimizationDismissed(): Promise<void> {
  try {
    await AsyncStorage.setItem('@battery_optimization_dismissed', 'true');
  } catch {
    // Ignore storage errors
  }
}

/**
 * Open the "Alarms & Reminders" permission settings page (Android 14+).
 * This is where users grant SCHEDULE_EXACT_ALARM if it's denied by default.
 */
export async function openExactAlarmSettings(): Promise<void> {
  if (Platform.OS !== 'android' || !IntentLauncher) return;

  try {
    await IntentLauncher.startActivityAsync(
      'android.settings.REQUEST_SCHEDULE_EXACT_ALARM',
      {
        data: `package:com.catalyst.essentials`,
      }
    );
  } catch (e) {
    console.warn('Failed to open exact alarm settings:', e);
    // Fallback to general app settings
    try {
      await IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS,
        {
          data: `package:com.catalyst.essentials`,
        }
      );
    } catch (e2) {
      console.warn('Fallback app settings also failed:', e2);
    }
  }
}

/**
 * Run all permission and optimization checks for reliable notifications.
 * Returns a status object indicating what actions the user still needs to take.
 */
export async function getNotificationHealthStatus(): Promise<{
  notificationPermission: boolean;
  batteryOptimizationDismissed: boolean;
  scheduledCount: number;
  expectedCount: number;
  isHealthy: boolean;
}> {
  const { status } = await Notifications.getPermissionsAsync();
  const notificationPermission = status === 'granted';
  const batteryOptDismissed = await isBatteryOptimizationIgnored();
  const batteryOptimizationDismissed = batteryOptDismissed === true;

  let scheduledCount = 0;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    scheduledCount = scheduled.length;
  } catch {
    // fallback
  }

  const isHealthy =
    notificationPermission &&
    batteryOptimizationDismissed &&
    scheduledCount >= EXPECTED_REMINDER_COUNT;

  return {
    notificationPermission,
    batteryOptimizationDismissed,
    scheduledCount,
    expectedCount: EXPECTED_REMINDER_COUNT,
    isHealthy,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Scheduling Logic
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Schedule recurring hourly water reminders (8 AM to 10 PM).
 * Uses DAILY trigger which maps to AlarmManager.setExactAndAllowWhileIdle
 * when SCHEDULE_EXACT_ALARM permission is granted.
 */
export async function scheduleHourlyWaterReminder() {
  const isConfigured = await configureNotifications();
  if (!isConfigured) return;

  // Clear existing schedules first to avoid duplicates
  await Notifications.cancelAllScheduledNotificationsAsync();

  // Schedule daily notifications for each active hour (8 AM to 10 PM)
  for (const hour of REMINDER_HOURS) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Time to Hydrate! 💧',
          body: 'Have you drank some water recently? Select an action below.',
          sound: Platform.OS === 'android' ? undefined : 'water_remainder.mp3', // For Android, channel takes care of sound. For iOS, we specify here.
          categoryIdentifier: REMINDER_CATEGORY_ID,
          data: {
            highlight: 'water',
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          channelId: APP_CHANNEL_ID,
          hour,
          minute: 0,
        },
      });
    } catch (error) {
      console.error(`Failed to schedule water reminder for ${hour}:00`, error);
    }
  }
}

/**
 * Cancel all scheduled reminders
 */
export async function cancelAllReminders() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Mode (COMMENTED OUT — preserved for future use)
// ─────────────────────────────────────────────────────────────────────────────

// const TEST_MODE_KEY = '@water_reminder_test_mode';

// export async function isTestModeEnabled(): Promise<boolean> {
//   try {
//     const value = await AsyncStorage.getItem(TEST_MODE_KEY);
//     return value === 'true';
//   } catch {
//     return false;
//   }
// }

// export async function setTestModeEnabled(enabled: boolean): Promise<void> {
//   try {
//     await AsyncStorage.setItem(TEST_MODE_KEY, String(enabled));
//   } catch (error) {
//     console.error('Failed to save test mode state', error);
//   }
// }

// export async function scheduleOneMinuteTestReminder() {
//   const isConfigured = await configureNotifications();
//   if (!isConfigured) return;
//
//   // Clear existing schedules first to avoid duplicates
//   await Notifications.cancelAllScheduledNotificationsAsync();
//
//   // Schedule water hydration reminder every 1 minute (60 seconds)
//   await Notifications.scheduleNotificationAsync({
//     content: {
//       title: 'Time to Hydrate! (Test Mode) 💧',
//       body: 'This is your 1-minute water hydration test reminder. Keep drinking water!',
//       sound: Platform.OS === 'android' ? undefined : 'water_remainder.mp3',
//       categoryIdentifier: REMINDER_CATEGORY_ID,
//       data: {
//         highlight: 'water',
//       },
//     },
//     trigger: {
//       type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
//       channelId: APP_CHANNEL_ID,
//       seconds: 60,
//       repeats: true,
//     },
//   });
// }

// ─────────────────────────────────────────────────────────────────────────────
// Goal Notification (COMMENTED OUT — preserved for future use)
// ─────────────────────────────────────────────────────────────────────────────

// /**
//  * Notification for hitting the daily water goal
//  */
// export async function triggerWaterGoalNotification() {
//   const isConfigured = await configureNotifications();
//   if (!isConfigured) return;
//
//   await Notifications.scheduleNotificationAsync({
//     content: {
//       title: 'Daily Water Goal Reached! 🏆',
//       body: 'Congratulations! You have reached your daily hydration goal. Great job!',
//       sound: Platform.OS === 'android' ? undefined : 'water_remainder.mp3',
//       data: {
//         route: '/water',
//       },
//     },
//     trigger: {
//       type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
//       channelId: APP_CHANNEL_ID,
//       seconds: 1,
//       repeats: false,
//     },
//   });
// }

// ─────────────────────────────────────────────────────────────────────────────
// Self-Healing / Ensure Schedules
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Idempotent function that verifies scheduled notifications are still active
 * and re-creates them if any were cleared (by reboot, force-stop, etc.).
 * 
 * Call this on every app open to ensure self-healing behavior.
 */
export async function ensureNotificationsScheduled(): Promise<void> {
  try {
    // Verify we have all 15 hourly reminders
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    
    if (scheduled.length < EXPECTED_REMINDER_COUNT) {
      console.log(
        `[Notifications] Only ${scheduled.length}/${EXPECTED_REMINDER_COUNT} reminders scheduled — re-scheduling all`
      );
      await scheduleHourlyWaterReminder();
    } else {
      console.log(`[Notifications] All ${scheduled.length} reminders verified ✓`);
    }
  } catch (error) {
    console.error('[Notifications] Failed to verify/restore schedules:', error);
    // Attempt to re-schedule as a safety net
    await scheduleHourlyWaterReminder();
  }
}

/**
 * Debug helper: list all currently scheduled notifications
 */
export async function getScheduledNotificationsList(): Promise<
  Array<{ id: string; title: string; hour?: number; minute?: number }>
> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    return scheduled.map((n: any) => ({
      id: n.identifier,
      title: n.content?.title ?? '(no title)',
      hour: n.trigger?.dateComponents?.hour ?? n.trigger?.hour,
      minute: n.trigger?.dateComponents?.minute ?? n.trigger?.minute,
    }));
  } catch {
    return [];
  }
}
