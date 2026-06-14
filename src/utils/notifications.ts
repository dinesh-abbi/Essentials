import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const WATER_CHANNEL_ID = 'water_hydration_channel_#528';
const REMINDER_CATEGORY_ID = 'WATER_REMINDER_CATEGORY';

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
 * Schedule recurring hourly water reminders
 */
export async function scheduleHourlyWaterReminder() {
  const isConfigured = await configureNotifications();
  if (!isConfigured) return;

  // Clear existing schedules first to avoid duplicates
  await Notifications.cancelAllScheduledNotificationsAsync();

  // Schedule water hydration reminder every 1 hour (3600 seconds)
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
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      channelId: WATER_CHANNEL_ID,
      seconds: 3600, // Every hour
      repeats: true,
    },
  });
}

/**
 * Cancel all scheduled reminders
 */
export async function cancelAllReminders() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
