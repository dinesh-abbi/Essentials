import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Device-level switches. Deliberately device-scoped (not per user, not in
 * Firestore): whether *this phone* buzzes at 6 AM or asks for a fingerprint
 * is a property of the phone, not of the account.
 */

export interface ReminderPrefs {
  /** 06:00 wake + 07:00 "time to train" on training days. */
  training: boolean;
  /** 08:30 / 13:30 / 17:30 / 20:30 meal nudges. */
  meals: boolean;
  /** 07:30 restock nudge on cycle days 1, 8, 15, 22. */
  restock: boolean;
}

export const DEFAULT_REMINDERS: ReminderPrefs = { training: true, meals: true, restock: true };

const REMINDERS_KEY = '@essentials_reminder_prefs';
const APP_LOCK_KEY = '@essentials_app_lock';

export async function getReminderPrefs(): Promise<ReminderPrefs> {
  try {
    const raw = await AsyncStorage.getItem(REMINDERS_KEY);
    return raw ? { ...DEFAULT_REMINDERS, ...JSON.parse(raw) } : DEFAULT_REMINDERS;
  } catch {
    return DEFAULT_REMINDERS;
  }
}

export async function setReminderPrefs(prefs: ReminderPrefs): Promise<void> {
  await AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify(prefs)).catch(() => {});
}

/** Whole-app biometric lock (Catalyst's "shield"). Off by default. */
export async function isAppLockEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(APP_LOCK_KEY)) === 'true';
  } catch {
    return false;
  }
}

export async function setAppLockEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(APP_LOCK_KEY, enabled ? 'true' : 'false').catch(() => {});
}
