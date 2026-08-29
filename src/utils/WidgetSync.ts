import { AppRegistry, NativeModules, Platform } from 'react-native';
import * as WaterStorage from './WaterStorage';

const { WidgetStorage: NativeWidgetStorage } = NativeModules;

/**
 * Gathers the current day's totals and syncs them to the Android Home Screen Widget.
 */
export async function sync(): Promise<void> {
  try {
    if (!NativeWidgetStorage) {
      console.warn('Native WidgetStorage module is not available.');
      return;
    }

    // Fetch current water metrics
    const waterMl = await WaterStorage.getTodayTotalMl();
    const waterGoal = await WaterStorage.getUserWaterGoal();
    const logsToday = (await WaterStorage.getTodayWaterLogs()).length;

    // Update the native SharedPreferences and force a widget redraw
    NativeWidgetStorage.setWidgetData(waterMl, waterGoal, logsToday);
  } catch (error) {
    console.error('Failed to sync widget data', error);
  }
}

export interface WidgetData {
  waterMl: number;
  waterGoal: number;
  logsToday: number;
  isStale: boolean;
}

/**
 * Reads the widget's current SharedPreferences state so the app can reconcile
 * with Firestore/AsyncStorage on resume. Returns null when the native module
 * isn't available (iOS, or a build without the widget wired up).
 */
export async function readWidgetData(): Promise<WidgetData | null> {
  try {
    if (!NativeWidgetStorage?.getWidgetData) return null;
    const data = await NativeWidgetStorage.getWidgetData();
    return data ?? null;
  } catch (error) {
    console.warn('[WidgetSync] Failed to read widget data', error);
    return null;
  }
}

/**
 * Headless task run by WidgetQuickLogTaskService (native) when the user taps
 * a "+Nml" chip directly on the home-screen widget. Runs with no Activity —
 * WidgetQuickLogReceiver already bumped the widget's own SharedPreferences
 * for instant visual feedback, so this only needs to persist the log for
 * real and then re-sync from the authoritative total (covers double-taps,
 * a stale optimistic bump, etc.).
 */
if (Platform.OS === 'android') {
  AppRegistry.registerHeadlessTask('WidgetQuickLog', () => async (data: { amountMl?: number }) => {
    const amount = Number(data?.amountMl);
    if (!Number.isFinite(amount) || amount <= 0) return;

    try {
      await WaterStorage.logWaterIntake(amount);
    } catch (error) {
      console.error('[WidgetQuickLog] Failed to persist water intake', error);
    }

    await sync();
  });
}
