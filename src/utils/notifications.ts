import { Platform } from 'react-native';
<<<<<<< HEAD
import Constants, { ExecutionEnvironment } from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const WATER_CHANNEL_ID = 'water_hydration_channel_#528';
const REMINDER_CATEGORY_ID = 'WATER_REMINDER_CATEGORY';
const WATER_REMINDER_TEST_INTERVAL_KEY = '@catalyst_water_reminder_test_interval';

export let Notifications: any;
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

if (Platform.OS === 'android' && isExpoGo) {
  // Mock the notifications module on Android in Expo Go to prevent crashes due to SDK 53+ limitations
  Notifications = {
    setNotificationHandler: () => {},
    getPermissionsAsync: async () => ({ status: 'undetermined' }),
    requestPermissionsAsync: async () => ({ status: 'undetermined' }),
    setNotificationCategoryAsync: async () => {},
    setNotificationChannelAsync: async () => {},
    cancelAllScheduledNotificationsAsync: async () => {},
    scheduleNotificationAsync: async () => '',
    getAllScheduledNotificationsAsync: async () => [],
    addNotificationResponseReceivedListener: () => ({ remove: () => {} }),
    DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
    AndroidImportance: { MAX: 4 },
    SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval', CALENDAR: 'calendar' },
  };
  console.warn('expo-notifications is mocked on Android because push notifications are not supported in Expo Go.');
} else {
  try {
    Notifications = require('expo-notifications');
  } catch (e) {
    console.error('Failed to import expo-notifications', e);
  }
}

// Configure default notification handler behaviors
if (Notifications && typeof Notifications.setNotificationHandler === 'function') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Check if the 1-minute testing reminders are enabled
 */
export async function isOneMinuteReminderEnabled(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(WATER_REMINDER_TEST_INTERVAL_KEY);
    return val === 'true';
  } catch {
    return false;
  }
}

/**
 * Set the 1-minute testing reminders mode
 */
export async function setOneMinuteReminderEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(WATER_REMINDER_TEST_INTERVAL_KEY, enabled ? 'true' : 'false');
  } catch (e) {
    console.error('Failed to save 1-minute reminder setting', e);
  }
}

/**
 * Configure notifications: request permission, setup categories, and register sound channels
 */
export async function configureNotifications() {
  if (Platform.OS === 'android' && isExpoGo) {
    return false;
  }

  // 1. Check & Request Permissions
=======
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';

let Notifications: any = null;
let IntentLauncher: any = null;

// Use the same ExecutionEnvironment check that AuthContext uses — appOwnership is deprecated in SDK 56
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

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
    requestPermissionsAsync: async () => ({ status: 'granted', canScheduleExactNotifications: true }),
    getPermissionsAsync: async () => ({ status: 'granted', canScheduleExactNotifications: true }),
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
 * Configure notifications: register sound channel FIRST (Android 13+ requires
 * at least one channel to exist before the permission dialog will appear),
 * then request permission, then set interactive action categories.
 */
export async function configureNotifications() {
  // ── Step 1: Register Unified Android Sound Channel FIRST ──────────────────
  // On Android 13+, the OS suppresses the permission dialog unless a channel
  // already exists. Creating the channel here guarantees the dialog appears.
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

  // ── Step 2: Check & Request Notification Permission ───────────────────────
>>>>>>> 75a8f1eb581347a111be59164a8d408806e91506
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

<<<<<<< HEAD
  // 2. Register Interactive Action Categories (Yes/No buttons)
=======
  // ── Step 3: Register Interactive Action Categories (Yes/No buttons) ───────
>>>>>>> 75a8f1eb581347a111be59164a8d408806e91506
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

<<<<<<< HEAD
  // 3. Register Custom Android Sound Channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(WATER_CHANNEL_ID, {
      name: 'Water Hydration Reminders (#528)',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#3B82F6',
      sound: 'water_remainder.mp3', // Matches app.json sounds array asset filename
    });
=======
  // ── Step 4: Exact Alarm Permission Health Check (Android 12+) ─────────────
  // SCHEDULE_EXACT_ALARM requires explicit user approval in Settings on Android 12+.
  // If not granted, open the "Alarms & Reminders" settings page so the user can
  // enable it — without this, daily-trigger notifications fire inexactly or not at all.
  if (Platform.OS === 'android') {
    try {
      const perms = await Notifications.getPermissionsAsync();
      if (perms.canScheduleExactNotifications === false) {
        console.warn('[Notifications] Exact alarm permission not granted — opening settings');
        await openExactAlarmSettings();
      }
    } catch (e) {
      console.warn('[Notifications] Could not check exact alarm permission:', e);
    }
>>>>>>> 75a8f1eb581347a111be59164a8d408806e91506
  }

  return true;
}

<<<<<<< HEAD
/**
 * Schedule recurring water reminders
 */
export async function scheduleHourlyWaterReminder(forceReschedule = false) {
  if (Platform.OS === 'android' && isExpoGo) {
    console.warn('Skipping scheduleHourlyWaterReminder: notifications are not supported in Expo Go on Android.');
    return;
  }

  const isConfigured = await configureNotifications();
  if (!isConfigured) return;

  const useOneMinute = await isOneMinuteReminderEnabled();

  // Inspect what is currently scheduled to see if we need to reschedule
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const reminderNotifs = scheduled.filter(
    (notif: any) => notif.content.categoryIdentifier === REMINDER_CATEGORY_ID
  );

  let needsReschedule = forceReschedule;

  if (!needsReschedule) {
    if (useOneMinute) {
      // 1-minute test reminders: we expect exactly 1 reminder with a 60-second time interval
      if (reminderNotifs.length !== 1) {
        needsReschedule = true;
      } else {
        const trigger = reminderNotifs[0].trigger;
        if (!trigger || trigger.seconds !== 60) {
          needsReschedule = true;
        }
      }
    } else {
      // Hourly reminders: we expect exactly 15 calendar reminders
      if (reminderNotifs.length !== 15) {
        needsReschedule = true;
      } else {
        // If any has a time interval instead of calendar, reschedule
        const hasTimeInterval = reminderNotifs.some(
          (notif: any) => notif.trigger && notif.trigger.seconds !== undefined
        );
        if (hasTimeInterval) {
          needsReschedule = true;
        }
      }
    }
  }

  if (!needsReschedule) {
    return; // Already correctly scheduled
  }

  // Cancel only the water reminders to avoid interfering with other notifications
  for (const notif of reminderNotifs) {
    try {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    } catch (e) {
      console.error('Failed to cancel reminder notification', e);
    }
  }

  // Brief pause to allow the native cancellation to complete
  await new Promise((resolve) => setTimeout(resolve, 300));

  if (useOneMinute) {
    // Schedule water hydration reminder every 1 minute
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Time to Hydrate! 💧',
        body: 'Have you drank some water recently? Select an action below.',
        sound: Platform.OS === 'android' ? undefined : 'water_remainder.mp3',
        categoryIdentifier: REMINDER_CATEGORY_ID,
        channelId: WATER_CHANNEL_ID, // Placed inside content for Android channel mapping
        data: {
          highlight: 'water',
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 60,
        repeats: true,
        channelId: WATER_CHANNEL_ID,
      },
    });
  } else {
    // Schedule water hydration reminders on the hour (sharp 8:00, 9:00, etc.) from 8 AM to 10 PM
    for (let hour = 8; hour <= 22; hour++) {
=======
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
 * Open the "Alarms & Reminders" permission settings page (Android 12+).
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
>>>>>>> 75a8f1eb581347a111be59164a8d408806e91506
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Time to Hydrate! 💧',
          body: 'Have you drank some water recently? Select an action below.',
<<<<<<< HEAD
          sound: Platform.OS === 'android' ? undefined : 'water_remainder.mp3',
          categoryIdentifier: REMINDER_CATEGORY_ID,
          channelId: WATER_CHANNEL_ID, // Placed inside content for Android channel mapping
=======
          sound: Platform.OS === 'android' ? undefined : 'water_remainder.mp3', // For Android, channel takes care of sound. For iOS, we specify here.
          categoryIdentifier: REMINDER_CATEGORY_ID,
>>>>>>> 75a8f1eb581347a111be59164a8d408806e91506
          data: {
            highlight: 'water',
          },
        },
        trigger: {
<<<<<<< HEAD
          type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
          hour,
          minute: 0,
          repeats: true,
          channelId: WATER_CHANNEL_ID,
        },
      });
=======
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          channelId: APP_CHANNEL_ID,
          hour,
          minute: 0,
        },
      });
    } catch (error) {
      console.error(`Failed to schedule water reminder for ${hour}:00`, error);
>>>>>>> 75a8f1eb581347a111be59164a8d408806e91506
    }
  }
}

/**
 * Cancel all scheduled reminders
 */
export async function cancelAllReminders() {
<<<<<<< HEAD
  if (Platform.OS === 'android' && isExpoGo) {
    return;
  }
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const reminderNotifs = scheduled.filter(
    (notif: any) => notif.content.categoryIdentifier === REMINDER_CATEGORY_ID
  );
  for (const notif of reminderNotifs) {
    try {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    } catch (e) {
      console.error(e);
    }
=======
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// ─────────────────────────────────────────────────────────────────────────────
// Hydration Goal Notification
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Module-level daily guard — tracks the date of the last goal notification
 * so we fire at most once per calendar day, no matter how much water is logged.
 * Resets automatically every new day (date string changes).
 */
let goalNotifiedDate: string | null = null;

/**
 * Fire an immediate notification celebrating the 3000ml daily goal.
 * Tapping the notification routes the user to the /water/goal screen.
 * Protected by a daily guard so it fires at most once per calendar day.
 */
export async function triggerWaterGoalNotification(): Promise<void> {
  const today = new Date().toDateString(); // e.g. "Fri Jul 04 2026"
  if (goalNotifiedDate === today) {
    console.log('[Notifications] Goal notification already fired today — skipping');
    return;
  }
  goalNotifiedDate = today;

  const isConfigured = await configureNotifications();
  if (!isConfigured) return;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🏆 Hydration Goal Reached!',
        body: "Amazing! You've hit 3000ml today. Your body thanks you! 💧",
        sound: Platform.OS === 'android' ? undefined : 'water_remainder.mp3',
        data: {
          route: '/water/goal', // Tap opens the celebration screen
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        channelId: APP_CHANNEL_ID,
        seconds: 1,
        repeats: false,
      },
    });
    console.log('[Notifications] Goal notification scheduled ✓');
  } catch (error) {
    console.error('[Notifications] Failed to schedule goal notification:', error);
    // Reset guard so it can be retried
    goalNotifiedDate = null;
  }
}

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
>>>>>>> 75a8f1eb581347a111be59164a8d408806e91506
  }
}

/**
<<<<<<< HEAD
 * Test notification for hourly reminder (trigger immediately / 1 second)
 */
export async function triggerHourlyWaterReminderTest() {
  if (Platform.OS === 'android' && isExpoGo) {
    throw new Error('Notifications cannot be triggered in Expo Go on Android. Please build and use a Development Build or APK to test notifications.');
  }

  const isConfigured = await configureNotifications();
  if (!isConfigured) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Time to Hydrate! 💧',
      body: 'Have you drank some water recently? Select an action below.',
      sound: Platform.OS === 'android' ? undefined : 'water_remainder.mp3',
      categoryIdentifier: REMINDER_CATEGORY_ID,
      channelId: WATER_CHANNEL_ID, // Correct placement
      data: {
        highlight: 'water',
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 1,
      repeats: false,
      channelId: WATER_CHANNEL_ID,
    },
  });
}

/**
 * Test notification for hitting the daily water goal
 */
export async function triggerWaterGoalNotification() {
  if (Platform.OS === 'android' && isExpoGo) {
    throw new Error('Notifications cannot be triggered in Expo Go on Android. Please build and use a Development Build or APK to test notifications.');
  }

  const isConfigured = await configureNotifications();
  if (!isConfigured) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Daily Water Goal Reached! 🏆',
      body: 'Congratulations! You have reached your daily hydration goal. Great job!',
      sound: Platform.OS === 'android' ? undefined : 'water_remainder.mp3',
      channelId: WATER_CHANNEL_ID, // Correct placement
      data: {
        route: '/water',
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 1,
      repeats: false,
      channelId: WATER_CHANNEL_ID,
    },
  });
=======
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
>>>>>>> 75a8f1eb581347a111be59164a8d408806e91506
}
