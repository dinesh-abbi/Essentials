import { NativeModules } from 'react-native';
import * as WaterStorage from './WaterStorage';
import * as PurchasesStorage from './PurchasesStorage';

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

    // 1. Fetch current water metrics
    const waterMl = await WaterStorage.getTodayTotalMl();
    const waterGoal = await WaterStorage.getUserWaterGoal();

    // 2. Fetch today's spending metrics
    const purchases = await PurchasesStorage.getPurchases();
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const todaySpend = purchases
      .filter((p) => p.timestamp >= midnight.getTime())
      .reduce((sum, item) => sum + item.cost, 0);

    // 3. Update the native SharedPreferences and force a widget redraw
    NativeWidgetStorage.setWidgetData(waterMl, waterGoal, todaySpend);
  } catch (error) {
    console.error('Failed to sync widget data', error);
  }
}
