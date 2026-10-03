import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';

import * as FuelStorage from '@/utils/FuelStorage';
import { getReminderPrefs } from '@/utils/Preferences';
import * as TrainingStorage from '@/utils/TrainingStorage';

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
    dismissAllNotificationsAsync: async () => {},
    AndroidImportance: { MAX: 5 },
    cancelScheduledNotificationAsync: async () => {},
    SchedulableTriggerInputTypes: { DAILY: 'daily', WEEKLY: 'weekly', TIME_INTERVAL: 'timeInterval' },
    DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
  };
}

export { Notifications };

// ── Unified App Notification Channel ──────────────────────────────────────────
// All notifications from Essentials use this single channel so they have a
// distinct, recognizable sound separate from other apps on the device.
const APP_CHANNEL_ID = 'hydration#003';
const REMINDER_CATEGORY_ID = 'WATER_REMINDER_CATEGORY';

// Training / meal / restock nudges (merged in from Catalyst) get their own
// channel and sound, so a hydration ping and a "time to train" ping are
// distinguishable from the shade without looking. Android caches channel
// settings forever — bump the suffix to change the sound or importance.
const ROUTINE_CHANNEL_ID = 'routine#001';
const ROUTINE_SIGNATURE_KEY = '@essentials_routine_reminder_signature';

// Every scheduled notification carries a deterministic identifier, so one
// group can be rescheduled without wiping the other (the water scheduler
// used to cancel *everything* before re-adding its 15 reminders).
const waterId = (hour: number) => `water-${String(hour).padStart(2, '0')}`;
const ALL_ROUTINE_IDS = [
  ...[1, 2, 3, 4, 5, 6, 7].flatMap((d) => [`train-wake-${d}`, `train-go-${d}`]),
  ...FuelStorage.MEALS.map((m) => `meal-${m.type}`),
  'restock',
];

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
    await Notifications.setNotificationChannelAsync(ROUTINE_CHANNEL_ID, {
      name: 'Training & Fuel',
      description: 'Training-day wake-ups, meal times and restock reminders',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 120, 80, 120],
      lightColor: '#7FB8A4',
      sound: 'training_alert.wav',
    });
  }

  // ── Step 2: Check & Request Notification Permission ───────────────────────
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

  // ── Step 3: Register Interactive Action Categories (Yes/No buttons) ───────
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

  // Clear this group's existing schedules first to avoid duplicates — and
  // only this group's, so the training/meal reminders survive.
  await Promise.all(
    REMINDER_HOURS.map((h) => Notifications.cancelScheduledNotificationAsync(waterId(h)).catch(() => {}))
  );

  // Schedule daily notifications for each active hour (8 AM to 10 PM)
  for (const hour of REMINDER_HOURS) {
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: waterId(hour),
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
// Hydration Goal Notification
// ─────────────────────────────────────────────────────────────────────────────

/**
/**
 * Fire an immediate notification celebrating the daily goal.
 * Tapping the notification routes the user to the /water/goal screen.
 * Fires every time it is called (no daily guard).
 */
export async function triggerWaterGoalNotification(): Promise<void> {
  const isConfigured = await configureNotifications();
  if (!isConfigured) return;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🏆 Hydration Goal Reached!',
        body: "Amazing! You've hit your daily hydration goal. Your body thanks you! 💧",
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
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const ids = new Set<string>(scheduled.map((n: any) => n.identifier));

    // Old builds scheduled with random identifiers / an older channel —
    // anything unrecognised means a full, clean rebuild.
    const known = new Set<string>([...REMINDER_HOURS.map(waterId), ...ALL_ROUTINE_IDS]);
    const hasStranger = scheduled.some((n: any) => !known.has(n.identifier));
    const hasOldChannel =
      Platform.OS === 'android' &&
      scheduled.some(
        (n: any) => n.trigger?.channelId && ![APP_CHANNEL_ID, ROUTINE_CHANNEL_ID].includes(n.trigger.channelId)
      );
    const waterMissing = REMINDER_HOURS.some((h) => !ids.has(waterId(h)));

    if (hasStranger || hasOldChannel) {
      console.log('[Notifications] Unrecognised schedules found — rebuilding all reminders');
      await Notifications.cancelAllScheduledNotificationsAsync();
      await scheduleHourlyWaterReminder();
      await rescheduleRoutineReminders(true);
      return;
    }

    if (waterMissing) {
      console.log('[Notifications] Water reminders incomplete — re-scheduling');
      await scheduleHourlyWaterReminder();
    }

    // Routine reminders carry the split/offset in their text, so they are
    // rebuilt whenever that input changes (new week, new split, prefs…).
    await rescheduleRoutineReminders();
  } catch (error) {
    console.error('[Notifications] Failed to verify/restore schedules:', error);
    // Attempt to re-schedule as a safety net
    await scheduleHourlyWaterReminder();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Training · Meals · Restock (from Catalyst)
// ─────────────────────────────────────────────────────────────────────────────

/** Expo's WEEKLY trigger counts Sunday = 1 … Saturday = 7; ISO counts Monday = 1. */
const expoWeekday = (isoDay: number) => (isoDay % 7) + 1;

/**
 * (Re)builds the training, meal and restock reminders from the current split,
 * this week's schedule offset, the fuel cycle and the user's switches.
 * Skips all work when nothing that feeds the schedule has changed, so it is
 * cheap to call on every app open and after every relevant edit; pass
 * `force` to rebuild regardless.
 */
export async function rescheduleRoutineReminders(force = false): Promise<void> {
  try {
    const [prefs, split, offset] = await Promise.all([
      getReminderPrefs(),
      TrainingStorage.getCachedSplit(),
      TrainingStorage.getScheduleOffset(),
    ]);
    const cycleStart = prefs.restock ? await FuelStorage.getCycleStart() : '';

    const signature = JSON.stringify({
      prefs,
      offset,
      cycleStart,
      split: split.days.map((d) => [d.dayNumber, d.focus, d.isRecovery, d.exercises.length]),
    });
    if (!force) {
      const previous = await AsyncStorage.getItem(ROUTINE_SIGNATURE_KEY).catch(() => null);
      if (previous === signature) return;
    }

    const ok = await configureNotifications();
    if (!ok) return;

    await Promise.all(
      ALL_ROUTINE_IDS.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {}))
    );

    const schedule = async (identifier: string, content: any, trigger: any) => {
      try {
        await Notifications.scheduleNotificationAsync({
          identifier,
          content: { ...content, sound: Platform.OS === 'android' ? undefined : 'training_alert.wav' },
          trigger: { ...trigger, channelId: ROUTINE_CHANNEL_ID },
        });
      } catch (e) {
        console.warn(`[Notifications] Failed to schedule ${identifier}`, e);
      }
    };

    if (prefs.training) {
      for (let iso = 1; iso <= 7; iso++) {
        // Weekly triggers repeat every week, but the offset only lives until
        // Monday — the signature check above rebuilds these once it expires.
        const slot = (((iso - 1 + offset) % 7) + 7) % 7 + 1;
        const day = TrainingStorage.dayForSlot(split.days, slot);
        if (day.isRecovery || day.exercises.length === 0) continue;
        const weekday = expoWeekday(iso);
        await schedule(
          `train-wake-${iso}`,
          {
            title: `Morning. ${day.focus} today.`,
            body: 'Water first, then get moving.',
            data: { route: '/train/brief?kind=wake' },
          },
          { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday, hour: 6, minute: 0 }
        );
        await schedule(
          `train-go-${iso}`,
          {
            title: 'Time to train',
            body: `${day.focus} · ${day.exercises.length} movements. Start when you’re in.`,
            data: { route: '/train/brief?kind=go' },
          },
          { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday, hour: 7, minute: 0 }
        );
      }
    }

    if (prefs.meals) {
      for (const meal of FuelStorage.MEALS) {
        await schedule(
          `meal-${meal.type}`,
          {
            title: `${meal.label} time`,
            body: 'Your plan for today is in Fuel. Log it once you’ve eaten.',
            data: { route: '/fuel' },
          },
          { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: meal.hour, minute: meal.minute }
        );
      }
    }

    if (prefs.restock && cycleStart) {
      // Restock days (cycle days 1, 8, 15, 22) are exactly 7 days apart, so
      // they always fall on the cycle-start weekday — one weekly trigger.
      const [y, m, d] = cycleStart.split('-').map(Number);
      const startIso = ((new Date(y, m - 1, d).getDay() + 6) % 7) + 1;
      await schedule(
        'restock',
        {
          title: 'Restock day',
          body: 'This week’s list is ready. Ticked items log straight to Spend.',
          data: { route: '/fuel?sheet=restock' },
        },
        { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: expoWeekday(startIso), hour: 7, minute: 30 }
      );
    }

    await AsyncStorage.setItem(ROUTINE_SIGNATURE_KEY, signature).catch(() => {});
  } catch (error) {
    console.error('[Notifications] Failed to schedule routine reminders:', error);
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
