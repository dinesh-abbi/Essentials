import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  writeBatch,
  setDoc,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { auth, db, waitForAuth, withTimeout } from '@/utils/firebase';
import * as SyncManager from './SyncManager';

const generateId = () => `purchase_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

export interface PurchaseLog {
  id: string;
  name: string;
  cost: number;
  category: 'Groceries' | 'Dairy' | 'Veggies' | 'Misc';
  timestamp: number;
}

const PURCHASES_CACHE_KEY = '@essentials_purchases_cache';

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
 * Returns a reference to the user's purchases subcollection.
 */
async function purchasesCollection() {
  const uid = await getCurrentUserId();
  return collection(db, 'users', uid, 'purchases');
}

/**
 * Helper to write purchases list completely to local AsyncStorage cache.
 */
async function savePurchasesCache(logs: PurchaseLog[]): Promise<void> {
  try {
    const uid = await getCurrentUserId();
    const key = `${PURCHASES_CACHE_KEY}_${uid}`;
    await AsyncStorage.setItem(key, JSON.stringify(logs));
  } catch (error) {
    console.error('Failed to save purchases cache', error);
  }
}

/**
 * Helper to get all cached purchases from AsyncStorage.
 */
async function getPurchasesCache(): Promise<PurchaseLog[]> {
  try {
    const uid = await getCurrentUserId();
    const key = `${PURCHASES_CACHE_KEY}_${uid}`;
    const cached = await AsyncStorage.getItem(key);
    return cached ? JSON.parse(cached) : [];
  } catch (error) {
    console.error('Failed to get purchases cache', error);
    return [];
  }
}

/**
 * Helper to merge new purchases into local cache.
 */
async function updatePurchasesCache(newLogs: PurchaseLog[]): Promise<void> {
  try {
    const currentCache = await getPurchasesCache();
    const mergedMap = new Map<string, PurchaseLog>();
    currentCache.forEach((log) => mergedMap.set(log.id, log));
    newLogs.forEach((log) => mergedMap.set(log.id, log));
    const mergedList = Array.from(mergedMap.values()).sort((a, b) => b.timestamp - a.timestamp);
    await savePurchasesCache(mergedList);
  } catch (error) {
    console.error('Failed to update purchases cache', error);
  }
}

/**
 * Applies pending offline actions to the purchases array to keep UI updated.
 */
export async function applyPurchasesOfflineMutations(logs: PurchaseLog[]): Promise<PurchaseLog[]> {
  const queue = await SyncManager.getSyncQueue();
  let result = [...logs];

  for (const action of queue) {
    if (action.type === 'purchase_clear') {
      result = [];
    } else if (action.type === 'purchase_save') {
      const { id, name, cost, category, timestamp } = action.payload;
      if (!result.some((r) => r.id === id)) {
        result.push({ id, name, cost, category, timestamp });
      }
    } else if (action.type === 'purchase_update') {
      const { id, updates } = action.payload;
      result = result.map((r) => (r.id === id ? { ...r, ...updates } : r));
    } else if (action.type === 'purchase_delete') {
      const { id } = action.payload;
      result = result.filter((r) => r.id !== id);
    }
  }

  return result.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Retrieve all purchases logs sorted from newest to oldest.
 */
export async function getPurchases(): Promise<PurchaseLog[]> {
  let dbLogs: PurchaseLog[] = [];
  try {
    const q = query(await purchasesCollection(), orderBy('timestamp', 'desc'));
    const snapshot = await withTimeout(getDocs(q), 1500);
    dbLogs = snapshot.docs.map((d) => ({
      id: d.id,
      name: d.data().name,
      cost: d.data().cost,
      category: d.data().category,
      timestamp: d.data().timestamp,
    }));
    await savePurchasesCache(dbLogs);
  } catch (error) {
    console.warn('Failed to get purchases from Firestore, using offline cache', error);
    dbLogs = await getPurchasesCache();
  }
  return applyPurchasesOfflineMutations(dbLogs);
}

/**
 * Save a new purchase log to Firestore.
 */
export async function savePurchase(
  name: string,
  cost: number,
  category: 'Groceries' | 'Dairy' | 'Veggies' | 'Misc',
  timestamp: number = Date.now()
): Promise<PurchaseLog> {
  const id = generateId();
  const trimmedName = name.trim();
  const newPurchase: PurchaseLog = { id, name: trimmedName, cost, category, timestamp };

  // Optimistically sync to local cache immediately
  await updatePurchasesCache([newPurchase]);

  const isOnline = await SyncManager.isOnline();
  if (isOnline) {
    try {
      const coll = await purchasesCollection();
      const docRef = doc(coll, id);
      await setDoc(docRef, {
        name: trimmedName,
        cost,
        category,
        timestamp,
      });

      return newPurchase;
    } catch (error) {
      console.warn('Failed to save purchase directly to Firestore, queueing offline', error);
    }
  }

  // Save offline fallback action
  await SyncManager.queueAction({
    id: `action_${id}`,
    type: 'purchase_save',
    payload: newPurchase,
  });

  return newPurchase;
}

/**
 * Update an existing purchase log.
 */
export async function updatePurchase(
  id: string,
  updates: Partial<Omit<PurchaseLog, 'id'>>
): Promise<void> {
  // Update in local cache immediately
  try {
    const currentCache = await getPurchasesCache();
    const updatedCache = currentCache.map((log) =>
      log.id === id ? { ...log, ...updates } : log
    );
    await savePurchasesCache(updatedCache);
  } catch (err) {
    console.error('Failed to update purchase in cache', err);
  }

  const isOnline = await SyncManager.isOnline();
  if (isOnline) {
    try {
      const uid = await getCurrentUserId();
      const docRef = doc(db, 'users', uid, 'purchases', id);
      await setDoc(docRef, updates, { merge: true });
      return;
    } catch (error) {
      console.warn('Failed to update purchase directly on Firestore, queueing offline', error);
    }
  }

  // Save offline update action
  await SyncManager.queueAction({
    id: `action_update_${id}_${Date.now()}`,
    type: 'purchase_update',
    payload: { id, updates },
  });
}

/**
 * Delete a specific purchase log by ID from Firestore.
 */
export async function deletePurchase(id: string): Promise<void> {
  // Delete from local cache immediately
  try {
    const currentCache = await getPurchasesCache();
    const updatedCache = currentCache.filter((log) => log.id !== id);
    await savePurchasesCache(updatedCache);
  } catch (err) {
    console.error('Failed to delete purchase from cache', err);
  }

  const isOnline = await SyncManager.isOnline();
  if (isOnline) {
    try {
      const uid = await getCurrentUserId();
      await deleteDoc(doc(db, 'users', uid, 'purchases', id));
      return;
    } catch (error) {
      console.warn('Failed to delete purchase directly from Firestore, queueing offline', error);
    }
  }

  // Save offline delete action
  await SyncManager.queueAction({
    id: `action_delete_${id}_${Date.now()}`,
    type: 'purchase_delete',
    payload: { id },
  });
}

/**
 * Clear all purchase logs from Firestore (batch delete).
 */
export async function clearPurchases(): Promise<void> {
  // Clear local cache immediately
  await savePurchasesCache([]);

  const isOnline = await SyncManager.isOnline();
  if (isOnline) {
    try {
      const allPurchases = await getPurchases();
      if (allPurchases.length === 0) return;

      const uid = await getCurrentUserId();
      const batch = writeBatch(db);

      allPurchases.forEach((purchase) => {
        batch.delete(doc(db, 'users', uid, 'purchases', purchase.id));
      });

      await batch.commit();
      return;
    } catch (error) {
      console.warn('Failed to clear purchases directly from Firestore, queueing offline', error);
    }
  }

  // Save offline clear action
  await SyncManager.queueAction({
    id: `action_clear_purchases_${Date.now()}`,
    type: 'purchase_clear',
    payload: {},
  });
}
