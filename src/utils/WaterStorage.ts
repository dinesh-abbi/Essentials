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

import { auth, db } from '@/utils/firebase';

export interface WaterLog {
  id: string;
  amountMl: number; // e.g. 250, 500, 1000
  timestamp: number;
}

export const DEFAULT_DAILY_GOAL = 3000; // ml

/**
 * Returns the current authenticated user's UID.
 * Throws if no user is signed in.
 */
function getCurrentUserId(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('User is not authenticated. Cannot access water logs.');
  }
  return uid;
}

/**
 * Returns a reference to the user's waterLogs subcollection.
 */
function waterLogsCollection() {
  const uid = getCurrentUserId();
  return collection(db, 'users', uid, 'waterLogs');
}

/**
 * Retrieve all water logs for the current user.
 */
export async function getWaterLogs(): Promise<WaterLog[]> {
  try {
    const snapshot = await getDocs(waterLogsCollection());
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
    const docRef = await addDoc(waterLogsCollection(), {
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
      waterLogsCollection(),
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
    const uid = getCurrentUserId();
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

    const uid = getCurrentUserId();
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
      waterLogsCollection(),
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
      waterLogsCollection(),
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
