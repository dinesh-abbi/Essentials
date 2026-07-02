import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';

import { auth, db, waitForAuth } from '@/utils/firebase';

export interface WaterLog {
  id: string;
  amountMl: number; // e.g. 250, 500, 1000
  timestamp: number;
}

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
 * Retrieve all water logs for the current user.
 */
export async function getWaterLogs(): Promise<WaterLog[]> {
  try {
    const snapshot = await getDocs(await waterLogsCollection());
    return snapshot.docs.map((d) => ({
      id: d.id,
      amountMl: d.data().amountMl,
      timestamp: d.data().timestamp,
    }));
  } catch (error) {
    console.error('Failed to get water logs from Firestore', error);
    return [];
  }
}

/**
 * Log a new water intake event to Firestore.
 */
export async function logWaterIntake(amountMl: number): Promise<WaterLog> {
  const timestamp = Date.now();

  try {
    const docRef = await addDoc(await waterLogsCollection(), {
      amountMl,
      timestamp,
    });

    return {
      id: docRef.id,
      amountMl,
      timestamp,
    };
  } catch (error) {
    console.error('Failed to log water intake to Firestore', error);
    throw error;
  }
}

/**
 * Get water logs logged today (local time) from Firestore.
 */
export async function getTodayWaterLogs(): Promise<WaterLog[]> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTodayMs = startOfToday.getTime();

  try {
    const q = query(
      await waterLogsCollection(),
      where('timestamp', '>=', startOfTodayMs)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({
      id: d.id,
      amountMl: d.data().amountMl,
      timestamp: d.data().timestamp,
    }));
  } catch (error) {
    console.error('Failed to get today water logs from Firestore', error);
    return [];
  }
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
 * Delete a specific water log by ID from Firestore.
 */
export async function deleteWaterLog(id: string): Promise<void> {
  try {
    const uid = await getCurrentUserId();
    await deleteDoc(doc(db, 'users', uid, 'waterLogs', id));
  } catch (error) {
    console.error('Failed to delete water log from Firestore', error);
    throw error;
  }
}

/**
 * Clear all water logs for today from Firestore (batch delete).
 */
export async function clearWaterLogs(): Promise<void> {
  try {
    const todayLogs = await getTodayWaterLogs();
    if (todayLogs.length === 0) return;

    const uid = await getCurrentUserId();
    const batch = writeBatch(db);

    todayLogs.forEach((log) => {
      batch.delete(doc(db, 'users', uid, 'waterLogs', log.id));
    });

    await batch.commit();
  } catch (error) {
    console.error('Failed to clear water logs from Firestore', error);
    throw error;
  }
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
  }
}

/**
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

