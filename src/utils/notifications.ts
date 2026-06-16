import { Platform } from 'react-native';
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

  // 3. Register Custom Android Sound Channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(WATER_CHANNEL_ID, {
      name: 'Water Hydration Reminders (#528)',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#3B82F6',
      sound: 'water_remainder.mp3', // Matches app.json sounds array asset filename
    });
  }

  return true;
}

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
          type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
          hour,
          minute: 0,
          repeats: true,
          channelId: WATER_CHANNEL_ID,
        },
      });
    }
  }
}

/**
 * Cancel all scheduled reminders
 */
export async function cancelAllReminders() {
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
  }
}

/**
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
}
