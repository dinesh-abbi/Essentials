import {
  addDoc,
  collection,
  doc,
  setDoc,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { auth, db, waitForAuth } from '@/utils/firebase';
import * as SyncManager from './SyncManager';

const generateId = () => `upi_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

export interface UpiLog {
  id: string;
  upiId: string;
  amount: number;
  status: string;
  timestamp: number;
}

const UPI_CACHE_KEY = '@essentials_upi_cache';

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
 * Returns a reference to the user's upi_transactions subcollection.
 */
async function upiCollection() {
  const uid = await getCurrentUserId();
  return collection(db, 'users', uid, 'upi_transactions');
}

/**
 * Helper to write upi transactions list completely to local AsyncStorage cache.
 */
async function saveUpiCache(logs: UpiLog[]): Promise<void> {
  try {
    const uid = await getCurrentUserId();
    const key = `${UPI_CACHE_KEY}_${uid}`;
    await AsyncStorage.setItem(key, JSON.stringify(logs));
  } catch (error) {
    console.error('Failed to save UPI cache', error);
  }
}

/**
 * Helper to get all cached upi transactions from AsyncStorage.
 */
async function getUpiCache(): Promise<UpiLog[]> {
  try {
    const uid = await getCurrentUserId();
    const key = `${UPI_CACHE_KEY}_${uid}`;
    const cached = await AsyncStorage.getItem(key);
    return cached ? JSON.parse(cached) : [];
  } catch (error) {
    console.error('Failed to get UPI cache', error);
    return [];
  }
}

/**
 * Helper to merge new upi transactions into local cache.
 */
async function updateUpiCache(newLogs: UpiLog[]): Promise<void> {
  try {
    const currentCache = await getUpiCache();
    const mergedMap = new Map<string, UpiLog>();
    currentCache.forEach((log) => mergedMap.set(log.id, log));
    newLogs.forEach((log) => mergedMap.set(log.id, log));
    const mergedList = Array.from(mergedMap.values()).sort((a, b) => b.timestamp - a.timestamp);
    await saveUpiCache(mergedList);
  } catch (error) {
    console.error('Failed to update UPI cache', error);
  }
}

/**
 * Save a new UPI transaction log to Firestore.
 */
export async function saveUpiTransaction(
  upiId: string,
  amount: number,
  status: string = 'Manual Success',
  timestamp: number = Date.now()
): Promise<UpiLog> {
  const id = generateId();
  const newLog: UpiLog = { id, upiId: upiId.trim(), amount, status, timestamp };

  // Optimistically sync to local cache immediately
  await updateUpiCache([newLog]);

  const isOnline = await SyncManager.isOnline();
  if (isOnline) {
    try {
      const coll = await upiCollection();
      const docRef = doc(coll, id);
      await setDoc(docRef, {
        upiId: upiId.trim(),
        amount,
        status,
        timestamp,
      });

      return newLog;
    } catch (error) {
      console.warn('Failed to save UPI transaction directly to Firestore, queueing offline', error);
    }
  }

  // Save offline fallback action (reusing purchase_save logic pattern or a dedicated upi_save in SyncManager)
  // For simplicity, we just queue an action that could be handled by SyncManager later
  await SyncManager.queueAction({
    id: `action_upi_${id}`,
    type: 'upi_save',
    payload: newLog,
  });

  return newLog;
}
