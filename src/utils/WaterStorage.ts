import AsyncStorage from '@react-native-async-storage/async-storage';

export interface WaterLog {
  id: string;
  amountMl: number; // e.g. 250, 500, 1000
  timestamp: number;
}

const WATER_STORAGE_KEY = '@catalyst_water_log';
export const DEFAULT_DAILY_GOAL = 3000; // ml

const generateId = () => {
  return `water_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Retrieve all water logs
 */
export async function getWaterLogs(): Promise<WaterLog[]> {
  try {
    const dataStr = await AsyncStorage.getItem(WATER_STORAGE_KEY);
    return dataStr ? JSON.parse(dataStr) : [];
  } catch (error) {
    console.error('Failed to get water logs', error);
    return [];
  }
}

/**
 * Log a new water intake event
 */
export async function logWaterIntake(amountMl: number): Promise<WaterLog> {
  const newLog: WaterLog = {
    id: generateId(),
    amountMl,
    timestamp: Date.now(),
  };

  try {
    const currentLogs = await getWaterLogs();
    currentLogs.push(newLog);
    await AsyncStorage.setItem(WATER_STORAGE_KEY, JSON.stringify(currentLogs));
    return newLog;
  } catch (error) {
    console.error('Failed to log water intake', error);
    throw error;
  }
}

/**
 * Get water logs logged today (local time)
 */
export async function getTodayWaterLogs(): Promise<WaterLog[]> {
  const allLogs = await getWaterLogs();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTodayMs = startOfToday.getTime();

  return allLogs.filter((log) => log.timestamp >= startOfTodayMs);
}

/**
 * Get total ml drank today
 */
export async function getTodayTotalMl(): Promise<number> {
  const todayLogs = await getTodayWaterLogs();
  return todayLogs.reduce((acc, curr) => acc + curr.amountMl, 0);
}

/**
 * Get hourly hydration logging status for today
 * Checks hours from 8:00 (8 AM) to 22:00 (10 PM)
 * Returns a mapping of hour to boolean (has intake in that hour)
 */
export async function getTodayHourlyStatus(): Promise<Record<number, boolean>> {
  const todayLogs = await getTodayWaterLogs();
  const hourlyStatus: Record<number, boolean> = {};

  // Initialize hours 8 to 22
  for (let h = 8; h <= 22; h++) {
    hourlyStatus[h] = false;
  }

  todayLogs.forEach((log) => {
    const date = new Date(log.timestamp);
    const hour = date.getHours();
    if (hour >= 8 && hour <= 22) {
      hourlyStatus[hour] = true;
    }
  });

  return hourlyStatus;
}

/**
 * Delete a specific water log by ID
 */
export async function deleteWaterLog(id: string): Promise<void> {
  try {
    const currentLogs = await getWaterLogs();
    const filteredLogs = currentLogs.filter((log) => log.id !== id);
    await AsyncStorage.setItem(WATER_STORAGE_KEY, JSON.stringify(filteredLogs));
  } catch (error) {
    console.error('Failed to delete water log', error);
    throw error;
  }
}

/**
 * Clear all water logs
 */
export async function clearWaterLogs(): Promise<void> {
  try {
    await AsyncStorage.removeItem(WATER_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear water storage', error);
    throw error;
  }
}

/**
 * Get total ml drank this month
 */
export async function getMonthlyTotalMl(): Promise<number> {
  const allLogs = await getWaterLogs();
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const monthlyLogs = allLogs.filter((log) => {
    const logDate = new Date(log.timestamp);
    return logDate.getMonth() === currentMonth && logDate.getFullYear() === currentYear;
  });

  return monthlyLogs.reduce((acc, curr) => acc + curr.amountMl, 0);
}
