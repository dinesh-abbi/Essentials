<<<<<<< HEAD
import AsyncStorage from '@react-native-async-storage/async-storage';
=======
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
  setDoc,
} from 'firebase/firestore';

import { auth, db, waitForAuth } from '@/utils/firebase';
import * as SyncManager from './SyncManager';

const generateId = () => `water_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
>>>>>>> 75a8f1eb581347a111be59164a8d408806e91506

export interface WaterLog {
  id: string;
  amountMl: number; // e.g. 250, 500, 1000
  timestamp: number;
}

<<<<<<< HEAD
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
=======
export const DEFAULT_DAILY_GOAL = 3000; // ml

/**
 * Returns the current authenticated user's UID.
 * Waits for auth state to be restored on cold-start before accessing uid.
 */
async function getCurrentUserId(): Promise<string> {
  if (auth.currentUser?.uid) return auth.currentUser.uid;
  const user = await waitForAuth();
  return user.uid;
}

/**
 * Returns a reference to the user's waterLogs subcollection.
 */
async function waterLogsCollection() {
  const uid = await getCurrentUserId();
  return collection(db, 'users', uid, 'waterLogs');
}

/**
 * Applies pending offline actions to the water logs array to keep UI updated.
 */
export async function applyWaterOfflineMutations(logs: WaterLog[]): Promise<WaterLog[]> {
  const queue = await SyncManager.getSyncQueue();
  let result = [...logs];

  for (const action of queue) {
    if (action.type === 'water_clear') {
      result = [];
    } else if (action.type === 'water_log') {
      const { id, amountMl, timestamp } = action.payload;
      if (!result.some((r) => r.id === id)) {
        result.push({ id, amountMl, timestamp });
      }
    } else if (action.type === 'water_delete') {
      const { id } = action.payload;
      result = result.filter((r) => r.id !== id);
    }
  }

  return result.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Retrieve all water logs for the current user.
 */
export async function getWaterLogs(): Promise<WaterLog[]> {
  let dbLogs: WaterLog[] = [];
  try {
    const snapshot = await getDocs(await waterLogsCollection());
    dbLogs = snapshot.docs.map((d) => ({
      id: d.id,
      amountMl: d.data().amountMl,
      timestamp: d.data().timestamp,
    }));
  } catch (error) {
    console.warn('Failed to get water logs from Firestore, using offline logs', error);
  }
  return applyWaterOfflineMutations(dbLogs);
}

/**
 * Log a new water intake event to Firestore.
 */
export async function logWaterIntake(amountMl: number): Promise<WaterLog> {
  const timestamp = Date.now();
  const id = generateId();

  const isOnline = await SyncManager.isOnline();
  if (isOnline) {
    try {
      const coll = await waterLogsCollection();
      const docRef = doc(coll, id);
      await setDoc(docRef, {
        amountMl,
        timestamp,
      });

      return {
        id,
        amountMl,
        timestamp,
      };
    } catch (error) {
      console.warn('Failed to log water intake directly to Firestore, queueing offline', error);
    }
  }

  // Save offline fallback
  await SyncManager.queueAction({
    id: `action_${id}`,
    type: 'water_log',
    payload: { id, amountMl, timestamp },
  });

  return {
    id,
    amountMl,
    timestamp,
  };
}

/**
 * Get water logs logged today (local time) from Firestore.
 */
export async function getTodayWaterLogs(): Promise<WaterLog[]> {
>>>>>>> 75a8f1eb581347a111be59164a8d408806e91506
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTodayMs = startOfToday.getTime();

<<<<<<< HEAD
  return allLogs.filter((log) => log.timestamp >= startOfTodayMs);
}

/**
 * Get total ml drank today
=======
  let dbLogs: WaterLog[] = [];
  try {
    const q = query(
      await waterLogsCollection(),
      where('timestamp', '>=', startOfTodayMs)
    );
    const snapshot = await getDocs(q);
    dbLogs = snapshot.docs.map((d) => ({
      id: d.id,
      amountMl: d.data().amountMl,
      timestamp: d.data().timestamp,
    }));
  } catch (error) {
    console.warn('Failed to get today water logs from Firestore, merging with offline', error);
  }

  // Merge with offline actions
  const merged = await applyWaterOfflineMutations(dbLogs);
  // Filter for today
  return merged.filter((log) => log.timestamp >= startOfTodayMs);
}

/**
 * Get total ml drank today.
>>>>>>> 75a8f1eb581347a111be59164a8d408806e91506
 */
export async function getTodayTotalMl(): Promise<number> {
  const todayLogs = await getTodayWaterLogs();
  return todayLogs.reduce((acc, curr) => acc + curr.amountMl, 0);
}

/**
<<<<<<< HEAD
 * Get hourly hydration logging status for today
 * Checks hours from 8:00 (8 AM) to 22:00 (10 PM)
 * Returns a mapping of hour to boolean (has intake in that hour)
=======
 * Get hourly hydration logging status for today.
 * Checks hours from 8:00 (8 AM) to 22:00 (10 PM).
 * Returns a mapping of hour to boolean (has intake in that hour).
>>>>>>> 75a8f1eb581347a111be59164a8d408806e91506
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
<<<<<<< HEAD
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
=======
 * Delete a specific water log by ID from Firestore.
 */
export async function deleteWaterLog(id: string): Promise<void> {
  const isOnline = await SyncManager.isOnline();
  if (isOnline) {
    try {
      const uid = await getCurrentUserId();
      await deleteDoc(doc(db, 'users', uid, 'waterLogs', id));
      return;
    } catch (error) {
      console.warn('Failed to delete water log directly from Firestore, queueing offline', error);
    }
  }

  // Save offline delete action
  await SyncManager.queueAction({
    id: `action_delete_${id}_${Date.now()}`,
    type: 'water_delete',
    payload: { id },
  });
}

/**
 * Clear all water logs for today from Firestore (batch delete).
 */
export async function clearWaterLogs(): Promise<void> {
  const isOnline = await SyncManager.isOnline();
  if (isOnline) {
    try {
      const todayLogs = await getTodayWaterLogs();
      if (todayLogs.length === 0) return;

      const uid = await getCurrentUserId();
      const batch = writeBatch(db);

      todayLogs.forEach((log) => {
        batch.delete(doc(db, 'users', uid, 'waterLogs', log.id));
      });

      await batch.commit();
      return;
    } catch (error) {
      console.warn('Failed to clear water logs directly from Firestore, queueing offline', error);
    }
  }

  // Save offline clear action
  await SyncManager.queueAction({
    id: `action_clear_water_${Date.now()}`,
    type: 'water_clear',
    payload: {},
  });
}

/**
 * Get total ml drank this month from Firestore.
 */
export async function getMonthlyTotalMl(): Promise<number> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfMonthMs = startOfMonth.getTime();

  try {
    const q = query(
      await waterLogsCollection(),
      where('timestamp', '>=', startOfMonthMs)
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.reduce((acc, d) => acc + (d.data().amountMl || 0), 0);
  } catch (error) {
    console.error('Failed to get monthly water total from Firestore', error);
    return 0;
>>>>>>> 75a8f1eb581347a111be59164a8d408806e91506
  }
}

/**
<<<<<<< HEAD
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
=======
 * Get the number of unique days with water logs this month.
 */
export async function getMonthlyDaysTracked(): Promise<number> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfMonthMs = startOfMonth.getTime();

  try {
    const q = query(
      await waterLogsCollection(),
      where('timestamp', '>=', startOfMonthMs)
    );
    const snapshot = await getDocs(q);

    const uniqueDays = new Set<string>();
    snapshot.docs.forEach((d) => {
      const date = new Date(d.data().timestamp);
      uniqueDays.add(`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`);
    });

    return uniqueDays.size;
  } catch (error) {
    console.error('Failed to get monthly days tracked from Firestore', error);
    return 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Weekly & Monthly Data for Redesigned Views
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get water logs between two timestamps (inclusive).
 */
export async function getWaterLogsBetween(startMs: number, endMs: number): Promise<WaterLog[]> {
  try {
    const col = await waterLogsCollection();
    const q = query(col, where('timestamp', '>=', startMs), where('timestamp', '<=', endMs));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({
      id: d.id,
      amountMl: d.data().amountMl,
      timestamp: d.data().timestamp,
    }));
  } catch (error) {
    console.error('Failed to get water logs between dates', error);
    return [];
  }
}

/**
 * Get daily intake totals for the current week (Monday to Sunday).
 */
export async function getWeeklyData(): Promise<{ date: Date; totalMl: number; logsCount: number }[]> {
  const now = new Date();
  // Find Monday of the current week
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon...
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const logs = await getWaterLogsBetween(monday.getTime(), sunday.getTime());

  // Build 7-day result array
  const result: { date: Date; totalMl: number; logsCount: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
    const dayEnd = dayStart + 86400000 - 1; // end of that day

    const dayLogs = logs.filter((l) => l.timestamp >= dayStart && l.timestamp <= dayEnd);
    result.push({
      date: day,
      totalMl: dayLogs.reduce((sum, l) => sum + l.amountMl, 0),
      logsCount: dayLogs.length,
    });
  }

  return result;
}

/**
 * Get per-day intake totals for a given month as a Map<dayOfMonth, totalMl>.
 */
export async function getMonthlyCalendarData(
  year: number,
  month: number // 0-indexed (0=Jan, 11=Dec)
): Promise<Map<number, number>> {
  const startOfMonth = new Date(year, month, 1);
  const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

  const logs = await getWaterLogsBetween(startOfMonth.getTime(), endOfMonth.getTime());

  const dayMap = new Map<number, number>();
  logs.forEach((l) => {
    const day = new Date(l.timestamp).getDate();
    dayMap.set(day, (dayMap.get(day) || 0) + l.amountMl);
  });

  return dayMap;
}

>>>>>>> 75a8f1eb581347a111be59164a8d408806e91506
