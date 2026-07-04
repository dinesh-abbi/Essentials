<<<<<<< HEAD
import AsyncStorage from '@react-native-async-storage/async-storage';
=======
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

import { auth, db, waitForAuth } from '@/utils/firebase';
import * as SyncManager from './SyncManager';

const generateId = () => `purchase_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
>>>>>>> 75a8f1eb581347a111be59164a8d408806e91506

export interface PurchaseLog {
  id: string;
  name: string;
  cost: number;
  category: 'Groceries' | 'Dairy' | 'Veggies' | 'Misc';
  timestamp: number;
}

<<<<<<< HEAD
const PURCHASES_STORAGE_KEY = '@catalyst_purchases_log';

const generateId = () => {
  return `purchase_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Retrieve all purchases logs sorted from newest to oldest
 */
export async function getPurchases(): Promise<PurchaseLog[]> {
  try {
    const dataStr = await AsyncStorage.getItem(PURCHASES_STORAGE_KEY);
    const logs: PurchaseLog[] = dataStr ? JSON.parse(dataStr) : [];
    return logs.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('Failed to get purchases from AsyncStorage', error);
    return [];
  }
}

/**
 * Save a new purchase log
=======
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
    const snapshot = await getDocs(q);
    dbLogs = snapshot.docs.map((d) => ({
      id: d.id,
      name: d.data().name,
      cost: d.data().cost,
      category: d.data().category,
      timestamp: d.data().timestamp,
    }));
  } catch (error) {
    console.warn('Failed to get purchases from Firestore, merging with offline', error);
  }
  return applyPurchasesOfflineMutations(dbLogs);
}

/**
 * Save a new purchase log to Firestore.
>>>>>>> 75a8f1eb581347a111be59164a8d408806e91506
 */
export async function savePurchase(
  name: string,
  cost: number,
<<<<<<< HEAD
  category: 'Groceries' | 'Dairy' | 'Veggies' | 'Misc'
): Promise<PurchaseLog> {
  const newLog: PurchaseLog = {
    id: generateId(),
    name: name.trim(),
    cost,
    category,
    timestamp: Date.now(),
  };

  try {
    const currentLogs = await getPurchases();
    currentLogs.push(newLog);
    await AsyncStorage.setItem(PURCHASES_STORAGE_KEY, JSON.stringify(currentLogs));
    return newLog;
  } catch (error) {
    console.error('Failed to save purchase log to AsyncStorage', error);
    throw error;
  }
}

/**
 * Delete a specific purchase log by ID
 */
export async function deletePurchase(id: string): Promise<void> {
  try {
    const currentLogs = await getPurchases();
    const filteredLogs = currentLogs.filter((log) => log.id !== id);
    await AsyncStorage.setItem(PURCHASES_STORAGE_KEY, JSON.stringify(filteredLogs));
  } catch (error) {
    console.error('Failed to delete purchase log', error);
    throw error;
  }
}

/**
 * Clear all purchase logs
 */
export async function clearPurchases(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PURCHASES_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear purchases storage', error);
    throw error;
  }
=======
  category: 'Groceries' | 'Dairy' | 'Veggies' | 'Misc',
  timestamp: number = Date.now()
): Promise<PurchaseLog> {
  const id = generateId();

  const isOnline = await SyncManager.isOnline();
  if (isOnline) {
    try {
      const coll = await purchasesCollection();
      const docRef = doc(coll, id);
      await setDoc(docRef, {
        name: name.trim(),
        cost,
        category,
        timestamp,
      });

      return {
        id,
        name: name.trim(),
        cost,
        category,
        timestamp,
      };
    } catch (error) {
      console.warn('Failed to save purchase directly to Firestore, queueing offline', error);
    }
  }

  // Save offline fallback action
  await SyncManager.queueAction({
    id: `action_${id}`,
    type: 'purchase_save',
    payload: { id, name: name.trim(), cost, category, timestamp },
  });

  return {
    id,
    name: name.trim(),
    cost,
    category,
    timestamp,
  };
}

/**
 * Update an existing purchase log.
 */
export async function updatePurchase(
  id: string,
  updates: Partial<Omit<PurchaseLog, 'id'>>
): Promise<void> {
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
>>>>>>> 75a8f1eb581347a111be59164a8d408806e91506
}
