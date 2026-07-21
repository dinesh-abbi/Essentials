import { NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { AlarmScheduler } = NativeModules;

export interface BarcodeAlarmConfig {
  enabled: boolean;
  hour: number;
  minute: number;
  barcodePayload: string | null;
  soundUri: string | null;
  soundName: string | null;
}

const STORAGE_KEY = '@barcode_alarm_config';

/**
 * Fetch the current alarm configuration.
 */
export async function getAlarmConfig(): Promise<BarcodeAlarmConfig | null> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    return json ? JSON.parse(json) : null;
  } catch (error) {
    console.error('Failed to get alarm config:', error);
    return null;
  }
}

/**
 * Save alarm configuration. Syncs to SharedPreferences and schedules/cancels
 * the alarm using the native AlarmManager.
 */
export async function saveAlarmConfig(config: BarcodeAlarmConfig): Promise<void> {
  try {
    // 1. Persist to AsyncStorage
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(config));

    // 2. Sync to Native Layer
    if (!AlarmScheduler) {
      console.warn('Native AlarmScheduler module is not available.');
      return;
    }

    if (config.enabled && config.barcodePayload !== null) {
      // Write to SharedPreferences
      await AlarmScheduler.saveAlarmConfig(
        config.hour,
        config.minute,
        config.barcodePayload,
        config.soundUri || ''
      );
      // Schedule in AlarmManager
      await AlarmScheduler.scheduleAlarm(config.hour, config.minute);
      console.log(`Alarm scheduled at ${config.hour}:${config.minute}`);
    } else {
      // Clear native state
      await AlarmScheduler.clearAlarmConfig();
      await AlarmScheduler.cancelAlarm();
      console.log('Alarm cancelled and native config cleared.');
    }
  } catch (error) {
    console.error('Failed to save alarm config:', error);
    throw error;
  }
}

/**
 * Helper to disable the alarm (e.g. on toggle switch disabled).
 */
export async function disableAlarm(): Promise<void> {
  try {
    const current = await getAlarmConfig();
    if (current) {
      current.enabled = false;
      await saveAlarmConfig(current);
    }
  } catch (error) {
    console.error('Failed to disable alarm:', error);
  }
}
