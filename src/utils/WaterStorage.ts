import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc } from 'firebase/firestore';

import { auth, db, waitForAuth, withTimeout } from '@/utils/firebase';
import { createCollectionCache } from '@/utils/localFirst';
import * as SyncManager from './SyncManager';

/**
 * Hydration logs — local-first (see utils/localFirst.ts + SyncManager.ts).
 * Reads come from the AsyncStorage cache instantly and revalidate against
 * users/{uid}/waterLogs in the background; writes update the cache and queue
 * a background push. No call here waits on the network except the very
 * first read on a fresh install.
 */

const generateId = () => `water_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

export interface WaterLog {
  id: string;
  amountMl: number; // e.g. 250, 500, 1000
  timestamp: number;
}

export const DEFAULT_DAILY_GOAL = 3000; // ml

const WATER_CACHE_KEY = '@essentials_water_logs_cache';
const WATER_GOAL_KEY = '@essentials_water_goal';

async function getCurrentUserId(): Promise<string> {
  if (auth.currentUser?.uid) return auth.currentUser.uid;
  const user = await waitForAuth();
  return user.uid;
}

/**
 * Applies pending (queued, not yet synced) actions on top of a list, so a
 * background refresh that predates a local write can't hide it.
 */
export async function applyWaterOfflineMutations(logs: WaterLog[]): Promise<WaterLog[]> {
  const queue = await SyncManager.getSyncQueue();
  let result = [...logs];

  for (const action of queue) {
    if (action.type === 'water_clear') {
      const ids: string[] | undefined = action.payload?.ids;
      if (ids) {
        const drop = new Set(ids);
        result = result.filter((r) => !drop.has(r.id));
      } else {
        const from = new Date(action.timestamp);
        from.setHours(0, 0, 0, 0);
        result = result.filter((r) => r.timestamp < from.getTime() || r.timestamp >= from.getTime() + 86_400_000);
      }
    } else if (action.type === 'water_log') {
      const { id, amountMl, timestamp } = action.payload;
      if (!result.some((r) => r.id === id)) result.push({ id, amountMl, timestamp });
    } else if (action.type === 'water_delete') {
      result = result.filter((r) => r.id !== action.payload.id);
    }
  }

  return result.sort((a, b) => b.timestamp - a.timestamp);
}

const logs = createCollectionCache<WaterLog>({
  collection: 'waterLogs',
  cacheKey: WATER_CACHE_KEY,
  scope: 'water',
  fromDoc: (id, d) => ({ id, amountMl: d.amountMl, timestamp: d.timestamp }),
  applyQueue: applyWaterOfflineMutations,
});

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

// ─────────────────────────────────────────────────────────────────────────────
// Reads (cache-first)
// ─────────────────────────────────────────────────────────────────────────────

/** All water logs for the current user, newest first. */
export async function getWaterLogs(): Promise<WaterLog[]> {
  return logs.read();
}

/** Forces a revalidation against Firestore (e.g. pull-to-refresh). */
export async function refreshWaterLogs(): Promise<void> {
  await logs.refresh();
}

/** Water logs logged today (local time). */
export async function getTodayWaterLogs(): Promise<WaterLog[]> {
  const from = startOfToday();
  return (await logs.read()).filter((log) => log.timestamp >= from);
}

/** Total ml drank today. */
export async function getTodayTotalMl(): Promise<number> {
  const todayLogs = await getTodayWaterLogs();
  return todayLogs.reduce((acc, curr) => acc + curr.amountMl, 0);
}

/**
 * Hourly hydration logging status for today, hours 6–22 → has intake.
 */
export async function getTodayHourlyStatus(): Promise<Record<number, boolean>> {
  const todayLogs = await getTodayWaterLogs();
  const hourlyStatus: Record<number, boolean> = {};
  for (let h = 6; h <= 22; h++) hourlyStatus[h] = false;
  todayLogs.forEach((log) => {
    const hour = new Date(log.timestamp).getHours();
    if (hour >= 6 && hour <= 22) hourlyStatus[hour] = true;
  });
  return hourlyStatus;
}

/** Total ml drank this month. */
export async function getMonthlyTotalMl(): Promise<number> {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  return (await logs.read()).filter((l) => l.timestamp >= from).reduce((acc, curr) => acc + curr.amountMl, 0);
}

/** Number of unique days with water logs this month. */
export async function getMonthlyDaysTracked(): Promise<number> {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const uniqueDays = new Set<string>();
  (await logs.read())
    .filter((l) => l.timestamp >= from)
    .forEach((log) => {
      const date = new Date(log.timestamp);
      uniqueDays.add(`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`);
    });
  return uniqueDays.size;
}

/** Water logs between two timestamps (inclusive). */
export async function getWaterLogsBetween(startMs: number, endMs: number): Promise<WaterLog[]> {
  return (await logs.read()).filter((log) => log.timestamp >= startMs && log.timestamp <= endMs);
}

/** Daily intake totals for the week (Monday to Sunday) containing `refDateMs`. */
export async function getWeeklyData(refDateMs?: number): Promise<{ date: Date; totalMl: number; logsCount: number }[]> {
  const now = refDateMs ? new Date(refDateMs) : new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon...
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const weekLogs = await getWaterLogsBetween(monday.getTime(), sunday.getTime());

  const result: { date: Date; totalMl: number; logsCount: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
    const dayEnd = dayStart + 86400000 - 1;
    const dayLogs = weekLogs.filter((l) => l.timestamp >= dayStart && l.timestamp <= dayEnd);
    result.push({
      date: day,
      totalMl: dayLogs.reduce((sum, l) => sum + l.amountMl, 0),
      logsCount: dayLogs.length,
    });
  }
  return result;
}

/** Per-day intake totals for a month as Map<dayOfMonth, totalMl>. */
export async function getMonthlyCalendarData(
  year: number,
  month: number // 0-indexed (0=Jan, 11=Dec)
): Promise<Map<number, number>> {
  const start = new Date(year, month, 1).getTime();
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime();
  const dayMap = new Map<number, number>();
  (await getWaterLogsBetween(start, end)).forEach((l) => {
    const day = new Date(l.timestamp).getDate();
    dayMap.set(day, (dayMap.get(day) || 0) + l.amountMl);
  });
  return dayMap;
}

// ─────────────────────────────────────────────────────────────────────────────
// Writes (local first, pushed in the background)
// ─────────────────────────────────────────────────────────────────────────────

/** Log a new water intake event. Returns as soon as it's saved on-device. */
export async function logWaterIntake(amountMl: number): Promise<WaterLog> {
  const newLog: WaterLog = { id: generateId(), amountMl, timestamp: Date.now() };
  await logs.upsert([newLog]);
  await SyncManager.queueAction({ id: `action_${newLog.id}`, type: 'water_log', payload: newLog });
  return newLog;
}

/** Delete a specific water log by ID. */
export async function deleteWaterLog(id: string): Promise<void> {
  await logs.remove([id]);
  await SyncManager.queueAction({
    id: `action_delete_${id}_${Date.now()}`,
    type: 'water_delete',
    payload: { id },
  });
}

/** Clear today's water logs (and only today's). */
export async function clearWaterLogs(): Promise<void> {
  const ids = (await getTodayWaterLogs()).map((l) => l.id);
  if (ids.length === 0) return;
  await logs.remove(ids);
  await SyncManager.queueAction({
    id: `action_clear_water_${Date.now()}`,
    type: 'water_clear',
    payload: { ids },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Goal
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The user's hydration goal (ml). Cache first; a cold cache asks Firestore
 * once (bounded by a short timeout) before falling back to the default.
 */
export async function getUserWaterGoal(): Promise<number> {
  let uid: string;
  try {
    uid = await getCurrentUserId();
    const cachedGoal = await AsyncStorage.getItem(`${WATER_GOAL_KEY}_${uid}`);
    if (cachedGoal) return parseInt(cachedGoal, 10);
  } catch (e) {
    console.warn('Failed to read water goal cache', e);
    return DEFAULT_DAILY_GOAL;
  }

  try {
    const snap = await withTimeout(getDoc(doc(db, 'users', uid)), 1500);
    const goal = snap.exists() ? snap.data()?.waterGoal : null;
    if (goal) {
      await AsyncStorage.setItem(`${WATER_GOAL_KEY}_${uid}`, String(goal));
      return goal;
    }
  } catch (err) {
    console.warn('Failed to query water goal from Firestore', err);
  }
  return DEFAULT_DAILY_GOAL;
}

/** Sets the hydration goal — cached immediately, pushed in the background. */
export async function setUserWaterGoal(goal: number): Promise<void> {
  const uid = await getCurrentUserId();
  try {
    await AsyncStorage.setItem(`${WATER_GOAL_KEY}_${uid}`, goal.toString());
  } catch (e) {
    console.error('Failed to cache water goal', e);
  }
  await SyncManager.queueAction({
    id: `action_water_goal_${Date.now()}`,
    type: 'doc_set',
    payload: { path: [], data: { waterGoal: goal }, merge: true },
  });
}
