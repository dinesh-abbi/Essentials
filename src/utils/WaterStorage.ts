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
  getDoc,
  updateDoc,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { auth, db, waitForAuth, withTimeout } from '@/utils/firebase';
import * as SyncManager from './SyncManager';

const generateId = () => `water_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

export interface WaterLog {
  id: string;
  amountMl: number; // e.g. 250, 500, 1000
  timestamp: number;
}

export const DEFAULT_DAILY_GOAL = 3000; // ml

const WATER_CACHE_KEY = '@essentials_water_logs_cache';

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
 * Helper to write water logs list completely to local AsyncStorage cache.
 */
async function saveWaterLogsCache(logs: WaterLog[]): Promise<void> {
  try {
    const uid = await getCurrentUserId();
    const key = `${WATER_CACHE_KEY}_${uid}`;
    await AsyncStorage.setItem(key, JSON.stringify(logs));
  } catch (error) {
    console.error('Failed to save water logs cache', error);
  }
}

/**
 * Helper to get all cached water logs from AsyncStorage.
 */
async function getWaterLogsCache(): Promise<WaterLog[]> {
  try {
    const uid = await getCurrentUserId();
    const key = `${WATER_CACHE_KEY}_${uid}`;
    const cached = await AsyncStorage.getItem(key);
    return cached ? JSON.parse(cached) : [];
  } catch (error) {
    console.error('Failed to get water logs cache', error);
    return [];
  }
}

/**
 * Helper to merge new water logs into the local cache.
 */
async function updateWaterLogsCache(newLogs: WaterLog[]): Promise<void> {
  try {
    const currentCache = await getWaterLogsCache();
    const mergedMap = new Map<string, WaterLog>();
    currentCache.forEach((log) => mergedMap.set(log.id, log));
    newLogs.forEach((log) => mergedMap.set(log.id, log));
    const mergedList = Array.from(mergedMap.values()).sort((a, b) => b.timestamp - a.timestamp);
    await saveWaterLogsCache(mergedList);
  } catch (error) {
    console.error('Failed to update water logs cache', error);
  }
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
    const snapshot = await withTimeout(getDocs(await waterLogsCollection()), 1500);
    dbLogs = snapshot.docs.map((d) => ({
      id: d.id,
      amountMl: d.data().amountMl,
      timestamp: d.data().timestamp,
    }));
    await saveWaterLogsCache(dbLogs);
  } catch (error) {
    console.warn('Failed to get water logs from Firestore, using offline cache', error);
    dbLogs = await getWaterLogsCache();
  }
  return applyWaterOfflineMutations(dbLogs);
}

/**
 * Log a new water intake event to Firestore.
 */
export async function logWaterIntake(amountMl: number): Promise<WaterLog> {
  const timestamp = Date.now();
  const id = generateId();
  const newLog: WaterLog = { id, amountMl, timestamp };

  // Optimistically sync to local cache immediately
  await updateWaterLogsCache([newLog]);

  const isOnline = await SyncManager.isOnline();
  if (isOnline) {
    try {
      const coll = await waterLogsCollection();
      const docRef = doc(coll, id);
      await setDoc(docRef, {
        amountMl,
        timestamp,
      });

      return newLog;
    } catch (error) {
      console.warn('Failed to log water intake directly to Firestore, queueing offline', error);
    }
  }

  // Save offline fallback
  await SyncManager.queueAction({
    id: `action_${id}`,
    type: 'water_log',
    payload: newLog,
  });

  return newLog;
}

/**
 * Get water logs logged today (local time) from Firestore.
 */
export async function getTodayWaterLogs(): Promise<WaterLog[]> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTodayMs = startOfToday.getTime();

  let dbLogs: WaterLog[] = [];
  try {
    const q = query(
      await waterLogsCollection(),
      where('timestamp', '>=', startOfTodayMs)
    );
    const snapshot = await withTimeout(getDocs(q), 1500);
    dbLogs = snapshot.docs.map((d) => ({
      id: d.id,
      amountMl: d.data().amountMl,
      timestamp: d.data().timestamp,
    }));
    await updateWaterLogsCache(dbLogs);
  } catch (error) {
    console.warn('Failed to get today water logs from Firestore, using offline cache', error);
    dbLogs = await getWaterLogsCache();
  }

  // Merge with offline actions
  const merged = await applyWaterOfflineMutations(dbLogs);
  // Filter for today
  return merged.filter((log) => log.timestamp >= startOfTodayMs);
}

/**
 * Get total ml drank today.
 */
export async function getTodayTotalMl(): Promise<number> {
  const todayLogs = await getTodayWaterLogs();
  return todayLogs.reduce((acc, curr) => acc + curr.amountMl, 0);
}

/**
 * Get hourly hydration logging status for today.
 * Checks hours from 8:00 (8 AM) to 22:00 (10 PM).
 * Returns a mapping of hour to boolean (has intake in that hour).
 */
export async function getTodayHourlyStatus(): Promise<Record<number, boolean>> {
  const todayLogs = await getTodayWaterLogs();
  const hourlyStatus: Record<number, boolean> = {};

  // Initialize hours 6 to 22
  for (let h = 6; h <= 22; h++) {
    hourlyStatus[h] = false;
  }

  todayLogs.forEach((log) => {
    const date = new Date(log.timestamp);
    const hour = date.getHours();
    if (hour >= 6 && hour <= 22) {
      hourlyStatus[hour] = true;
    }
  });

  return hourlyStatus;
}

/**
 * Delete a specific water log by ID from Firestore.
 */
export async function deleteWaterLog(id: string): Promise<void> {
  // Update local cache immediately
  try {
    const currentCache = await getWaterLogsCache();
    const updatedCache = currentCache.filter((log) => log.id !== id);
    await saveWaterLogsCache(updatedCache);
  } catch (err) {
    console.error('Failed to delete log from cache', err);
  }

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
  // Clear today's logs from cache immediately
  try {
    const currentCache = await getWaterLogsCache();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTodayMs = startOfToday.getTime();
    const updatedCache = currentCache.filter((log) => log.timestamp < startOfTodayMs);
    await saveWaterLogsCache(updatedCache);
  } catch (err) {
    console.error('Failed to clear logs from cache', err);
  }

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

  let dbLogs: WaterLog[] = [];
  try {
    const q = query(
      await waterLogsCollection(),
      where('timestamp', '>=', startOfMonthMs)
    );
    const snapshot = await withTimeout(getDocs(q), 1500);
    dbLogs = snapshot.docs.map((d) => ({
      id: d.id,
      amountMl: d.data().amountMl,
      timestamp: d.data().timestamp,
    }));
    await updateWaterLogsCache(dbLogs);
  } catch (error) {
    console.warn('Failed to get monthly water total from Firestore, using offline cache', error);
    dbLogs = await getWaterLogsCache();
  }

  const merged = await applyWaterOfflineMutations(dbLogs);
  const filtered = merged.filter((log) => log.timestamp >= startOfMonthMs);
  return filtered.reduce((acc, curr) => acc + curr.amountMl, 0);
}

/**
 * Get the number of unique days with water logs this month.
 */
export async function getMonthlyDaysTracked(): Promise<number> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfMonthMs = startOfMonth.getTime();

  let dbLogs: WaterLog[] = [];
  try {
    const q = query(
      await waterLogsCollection(),
      where('timestamp', '>=', startOfMonthMs)
    );
    const snapshot = await withTimeout(getDocs(q), 1500);
    dbLogs = snapshot.docs.map((d) => ({
      id: d.id,
      amountMl: d.data().amountMl,
      timestamp: d.data().timestamp,
    }));
    await updateWaterLogsCache(dbLogs);
  } catch (error) {
    console.warn('Failed to get monthly days tracked from Firestore, using offline cache', error);
    dbLogs = await getWaterLogsCache();
  }

  const merged = await applyWaterOfflineMutations(dbLogs);
  const filtered = merged.filter((log) => log.timestamp >= startOfMonthMs);

  const uniqueDays = new Set<string>();
  filtered.forEach((log) => {
    const date = new Date(log.timestamp);
    uniqueDays.add(`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`);
  });

  return uniqueDays.size;
}

// ─────────────────────────────────────────────────────────────────────────────
// Weekly & Monthly Data for Redesigned Views
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get water logs between two timestamps (inclusive).
 */
export async function getWaterLogsBetween(startMs: number, endMs: number): Promise<WaterLog[]> {
  let dbLogs: WaterLog[] = [];
  try {
    const col = await waterLogsCollection();
    const q = query(col, where('timestamp', '>=', startMs), where('timestamp', '<=', endMs));
    const snapshot = await withTimeout(getDocs(q), 1500);
    dbLogs = snapshot.docs.map((d) => ({
      id: d.id,
      amountMl: d.data().amountMl,
      timestamp: d.data().timestamp,
    }));
    await updateWaterLogsCache(dbLogs);
  } catch (error) {
    console.warn('Failed to get water logs between dates, using offline cache', error);
    dbLogs = await getWaterLogsCache();
  }

  const merged = await applyWaterOfflineMutations(dbLogs);
  return merged.filter((log) => log.timestamp >= startMs && log.timestamp <= endMs);
}

/**
 * Get daily intake totals for the current week (Monday to Sunday).
 */
export async function getWeeklyData(refDateMs?: number): Promise<{ date: Date; totalMl: number; logsCount: number }[]> {
  const now = refDateMs ? new Date(refDateMs) : new Date();
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

const WATER_GOAL_KEY = '@essentials_water_goal';

/**
 * Gets the current user's hydration goal (in ml).
 * Uses local AsyncStorage cache first, and queries Firestore if offline/cache empty.
 */
export async function getUserWaterGoal(): Promise<number> {
  try {
    const uid = await getCurrentUserId();
    const cachedGoal = await AsyncStorage.getItem(`${WATER_GOAL_KEY}_${uid}`);
    if (cachedGoal) {
      return parseInt(cachedGoal, 10);
    }
  } catch (e) {
    console.warn('Failed to read water goal cache', e);
  }

  const isOnline = await SyncManager.isOnline();
  if (isOnline) {
    try {
      const uid = await getCurrentUserId();
      const userRef = doc(db, 'users', uid);
      const snap = await withTimeout(getDoc(userRef), 1500);
      if (snap.exists() && snap.data()?.waterGoal) {
        const goal = snap.data().waterGoal;
        const uidCurrent = await getCurrentUserId();
        await AsyncStorage.setItem(`${WATER_GOAL_KEY}_${uidCurrent}`, goal.toString());
        return goal;
      }
    } catch (err) {
      console.warn('Failed to query water goal from Firestore', err);
    }
  }

  return DEFAULT_DAILY_GOAL;
}

/**
 * Sets the current user's hydration goal (in ml).
 * Saves to local cache immediately and updates Firestore asynchronously.
 */
export async function setUserWaterGoal(goal: number): Promise<void> {
  const uid = await getCurrentUserId();
  try {
    await AsyncStorage.setItem(`${WATER_GOAL_KEY}_${uid}`, goal.toString());
  } catch (e) {
    console.error('Failed to cache water goal', e);
  }

  const isOnline = await SyncManager.isOnline();
  if (isOnline) {
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, { waterGoal: goal });
    } catch (err) {
      console.warn('Failed to update water goal in Firestore', err);
    }
  }
}
