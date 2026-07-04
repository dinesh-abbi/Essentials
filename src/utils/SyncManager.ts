import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, setDoc, deleteDoc, writeBatch, collection, getDocs } from 'firebase/firestore';
import { db, auth, waitForAuth } from './firebase';

const QUEUE_STORAGE_KEY = '@essentials_sync_actions_queue';

export interface SyncAction {
  id: string;
  type:
    | 'water_log'
    | 'water_delete'
    | 'water_clear'
    | 'purchase_save'
    | 'purchase_delete'
    | 'purchase_clear'
    | 'purchase_update';
  payload: any;
  timestamp: number;
}

let isSyncing = false;

/**
 * Perform a quick fetch check to verify if the internet is accessible.
 */
export async function isOnline(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const res = await fetch('https://www.google.com', {
      method: 'HEAD',
      cache: 'no-cache',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Fetch the current sync queue from AsyncStorage.
 */
export async function getSyncQueue(): Promise<SyncAction[]> {
  try {
    const queueStr = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
    return queueStr ? JSON.parse(queueStr) : [];
  } catch (error) {
    console.error('Failed to get sync queue', error);
    return [];
  }
}

/**
 * Queue a new sync action to AsyncStorage.
 */
export async function queueAction(action: Omit<SyncAction, 'timestamp'>): Promise<void> {
  try {
    const queue = await getSyncQueue();
    const newAction: SyncAction = {
      ...action,
      timestamp: Date.now(),
    };
    
    // If we clear, we can optimize the queue by purging prior log/delete actions
    if (action.type === 'water_clear') {
      const filtered = queue.filter(
        (a) => a.type !== 'water_log' && a.type !== 'water_delete'
      );
      filtered.push(newAction);
      await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(filtered));
      return;
    }
    if (action.type === 'purchase_clear') {
      const filtered = queue.filter(
        (a) => a.type !== 'purchase_save' && a.type !== 'purchase_delete' && a.type !== 'purchase_update'
      );
      filtered.push(newAction);
      await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(filtered));
      return;
    }

    queue.push(newAction);
    await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.error('Failed to queue action', error);
  }
}

/**
 * Remove an action from the queue.
 */
async function removeAction(actionId: string): Promise<void> {
  try {
    const queue = await getSyncQueue();
    const filtered = queue.filter((a) => a.id !== actionId);
    await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Failed to remove action', error);
  }
}

/**
 * Synchronize all pending actions to Firestore when network is available.
 */
export async function syncOfflineData(): Promise<{ successCount: number; failCount: number }> {
  if (isSyncing) return { successCount: 0, failCount: 0 };
  
  const online = await isOnline();
  if (!online) {
    return { successCount: 0, failCount: 0 };
  }

  isSyncing = true;
  let successCount = 0;
  let failCount = 0;

  try {
    // Wait for auth session
    if (!auth.currentUser) {
      await waitForAuth().catch(() => {});
    }
    const uid = auth.currentUser?.uid;
    if (!uid) {
      isSyncing = false;
      return { successCount: 0, failCount: 0 };
    }

    const queue = await getSyncQueue();
    for (const action of queue) {
      try {
        switch (action.type) {
          case 'water_log': {
            const { id, amountMl, timestamp } = action.payload;
            const logDocRef = doc(db, 'users', uid, 'waterLogs', id);
            await setDoc(logDocRef, { amountMl, timestamp });
            break;
          }
          case 'water_delete': {
            const { id } = action.payload;
            const logDocRef = doc(db, 'users', uid, 'waterLogs', id);
            await deleteDoc(logDocRef);
            break;
          }
          case 'water_clear': {
            const colRef = collection(db, 'users', uid, 'waterLogs');
            const snapshot = await getDocs(colRef);
            const batch = writeBatch(db);
            snapshot.docs.forEach((d) => {
              batch.delete(d.ref);
            });
            await batch.commit();
            break;
          }
          case 'purchase_save': {
            const { id, name, cost, category, timestamp } = action.payload;
            const purchaseDocRef = doc(db, 'users', uid, 'purchases', id);
            await setDoc(purchaseDocRef, { name, cost, category, timestamp });
            break;
          }
          case 'purchase_update': {
            const { id, updates } = action.payload;
            const purchaseDocRef = doc(db, 'users', uid, 'purchases', id);
            await setDoc(purchaseDocRef, updates, { merge: true });
            break;
          }
          case 'purchase_delete': {
            const { id } = action.payload;
            const purchaseDocRef = doc(db, 'users', uid, 'purchases', id);
            await deleteDoc(purchaseDocRef);
            break;
          }
          case 'purchase_clear': {
            const colRef = collection(db, 'users', uid, 'purchases');
            const snapshot = await getDocs(colRef);
            const batch = writeBatch(db);
            snapshot.docs.forEach((d) => {
              batch.delete(d.ref);
            });
            await batch.commit();
            break;
          }
        }
        successCount++;
        await removeAction(action.id);
      } catch (err) {
        failCount++;
        console.error(`Sync action ${action.id} (${action.type}) failed:`, err);
      }
    }
  } catch (error) {
    console.error('Offline sync failed', error);
  } finally {
    isSyncing = false;
  }

  return { successCount, failCount };
}
