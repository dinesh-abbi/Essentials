import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { collection, deleteDoc, doc, getDocs, query, setDoc, where, writeBatch } from 'firebase/firestore';
import { db, auth, waitForAuth } from './firebase';

/**
 * Local-first write path.
 *
 * Every mutation in the app lands in two places synchronously-ish: the
 * feature's AsyncStorage cache (so the UI is correct immediately) and this
 * queue. The queue is then flushed to Firestore in the background — a short
 * debounce after each write, again whenever the app returns to the
 * foreground, and on a back-off timer while anything is still pending. The
 * caller never waits on the network.
 *
 * Before this, every write first did a `HEAD https://www.google.com`
 * reachability probe and then awaited the Firestore server ack (the JS SDK
 * has no on-device persistence in React Native), so each tap cost one to
 * three round-trips — and anything queued while offline was never flushed
 * at all, because nothing ever called `syncOfflineData()`.
 */

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
    | 'purchase_update'
    | 'upi_save'
    // Generic document writes used by the Training / Fuel / Body / profile
    // modules. `path` is the segment list under users/{uid} (e.g.
    // ['workoutLogs', id], or [] for the profile doc itself), so a queued
    // write can never escape the signed-in user's own subtree.
    | 'doc_set'
    | 'doc_delete';
  payload: any;
  timestamp: number;
}

// ── Change notifications ──────────────────────────────────────────────────────

export type DataScope = 'water' | 'purchases' | 'upi' | 'docs' | 'all';
type Listener = (scope: DataScope) => void;
const listeners = new Set<Listener>();

/** Subscribe to "data under this scope changed" (sync landed / cache refreshed). */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyDataChanged(scope: DataScope): void {
  listeners.forEach((l) => {
    try {
      l(scope);
    } catch (e) {
      console.warn('[Sync] listener failed', e);
    }
  });
}

// ── Queue (serialised read-modify-write) ──────────────────────────────────────

// AsyncStorage has no transactions; two interleaved read-modify-writes (a
// tap enqueueing while the flusher removes a finished action) could drop an
// action. Every queue mutation goes through this promise chain instead.
let queueLock: Promise<unknown> = Promise.resolve();
function withQueueLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = queueLock.then(fn, fn);
  queueLock = run.catch(() => {});
  return run;
}

async function readQueue(): Promise<SyncAction[]> {
  try {
    const queueStr = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
    return queueStr ? JSON.parse(queueStr) : [];
  } catch (error) {
    console.error('Failed to get sync queue', error);
    return [];
  }
}

/** Fetch the current sync queue from AsyncStorage. */
export async function getSyncQueue(): Promise<SyncAction[]> {
  return readQueue();
}

/**
 * Queue a write and schedule a background flush. Returns as soon as the
 * action is persisted locally — never waits on the network.
 */
export async function queueAction(action: Omit<SyncAction, 'timestamp'>): Promise<void> {
  await withQueueLock(async () => {
    try {
      let queue = await readQueue();
      const newAction: SyncAction = { ...action, timestamp: Date.now() };

      // A clear supersedes earlier per-item actions for the same collection.
      if (action.type === 'purchase_clear') {
        queue = queue.filter(
          (a) => a.type !== 'purchase_save' && a.type !== 'purchase_delete' && a.type !== 'purchase_update'
        );
      }
      // Writing the same document twice: collapse into one action. A merge
      // on top of a pending merge combines the fields (the profile doc gets
      // both `waterGoal` and `body` writes); a full set or a delete wins.
      if (action.type === 'doc_set' || action.type === 'doc_delete') {
        const key = JSON.stringify(action.payload?.path ?? []);
        const samePath = (a: SyncAction) =>
          (a.type === 'doc_set' || a.type === 'doc_delete') && JSON.stringify(a.payload?.path ?? []) === key;
        const previous = queue.filter(samePath).pop();
        if (action.type === 'doc_set' && action.payload?.merge && previous?.type === 'doc_set') {
          newAction.payload = {
            ...action.payload,
            merge: !!previous.payload?.merge,
            data: { ...previous.payload?.data, ...action.payload.data },
          };
        }
        queue = queue.filter((a) => !samePath(a));
      }

      queue.push(newAction);
      await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
    } catch (error) {
      console.error('Failed to queue action', error);
    }
  });
  scheduleSync();
}

async function removeAction(actionId: string): Promise<void> {
  await withQueueLock(async () => {
    try {
      const queue = await readQueue();
      await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue.filter((a) => a.id !== actionId)));
    } catch (error) {
      console.error('Failed to remove action', error);
    }
  });
}

// ── Reachability (kept for screens that show an online/offline hint) ─────────

/**
 * Quick reachability probe. No longer on the write path — the flusher just
 * tries Firestore and leaves failures queued — but still used by a couple of
 * screens to word their status text.
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

// ── Background flusher ────────────────────────────────────────────────────────

let isSyncing = false;
let rerunRequested = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryDelay = 15_000;
const MAX_RETRY_DELAY = 5 * 60_000;
let appStateHooked = false;

/** Debounced background flush. Safe to call as often as you like. */
export function scheduleSync(delayMs = 400): void {
  hookAppState();
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    syncOfflineData().catch((e) => console.warn('[Sync] flush failed', e));
  }, delayMs);
}

/** Starts the foreground listener and flushes anything left from last session. */
export function startBackgroundSync(): void {
  hookAppState();
  scheduleSync(1500);
}

function hookAppState() {
  if (appStateHooked) return;
  appStateHooked = true;
  AppState.addEventListener('change', (state) => {
    if (state === 'active') scheduleSync(800);
  });
}

function scheduleRetry() {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    syncOfflineData().catch(() => {});
  }, retryDelay);
  retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY);
}

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Push every queued action to Firestore, in order. Failed actions stay
 * queued and a back-off retry is scheduled. Never throws.
 */
export async function syncOfflineData(): Promise<{ successCount: number; failCount: number }> {
  if (isSyncing) {
    rerunRequested = true;
    return { successCount: 0, failCount: 0 };
  }

  isSyncing = true;
  let successCount = 0;
  let failCount = 0;
  const touched = new Set<DataScope>();

  try {
    // Wait for auth session
    if (!auth.currentUser) {
      await waitForAuth().catch(() => {});
    }
    const uid = auth.currentUser?.uid;
    if (!uid) return { successCount: 0, failCount: 0 };

    const queue = await readQueue();
    for (const action of queue) {
      try {
        switch (action.type) {
          case 'water_log': {
            const { id, amountMl, timestamp } = action.payload;
            await setDoc(doc(db, 'users', uid, 'waterLogs', id), { amountMl, timestamp });
            touched.add('water');
            break;
          }
          case 'water_delete': {
            await deleteDoc(doc(db, 'users', uid, 'waterLogs', action.payload.id));
            touched.add('water');
            break;
          }
          case 'water_clear': {
            // Clears *one day* of logs. Newer clients enqueue the exact ids;
            // a legacy payload without ids means "the day it was queued" —
            // never the whole collection (which the old handler did).
            const ids: string[] | undefined = action.payload?.ids;
            const batch = writeBatch(db);
            if (ids) {
              ids.forEach((id) => batch.delete(doc(db, 'users', uid, 'waterLogs', id)));
            } else {
              const from = startOfDay(action.timestamp);
              const snapshot = await getDocs(
                query(
                  collection(db, 'users', uid, 'waterLogs'),
                  where('timestamp', '>=', from),
                  where('timestamp', '<', from + 86_400_000)
                )
              );
              snapshot.docs.forEach((d) => batch.delete(d.ref));
            }
            await batch.commit();
            touched.add('water');
            break;
          }
          case 'purchase_save': {
            const { id, name, cost, category, timestamp } = action.payload;
            await setDoc(doc(db, 'users', uid, 'purchases', id), { name, cost, category, timestamp });
            touched.add('purchases');
            break;
          }
          case 'purchase_update': {
            const { id, updates } = action.payload;
            await setDoc(doc(db, 'users', uid, 'purchases', id), updates, { merge: true });
            touched.add('purchases');
            break;
          }
          case 'purchase_delete': {
            await deleteDoc(doc(db, 'users', uid, 'purchases', action.payload.id));
            touched.add('purchases');
            break;
          }
          case 'purchase_clear': {
            const snapshot = await getDocs(collection(db, 'users', uid, 'purchases'));
            const batch = writeBatch(db);
            snapshot.docs.forEach((d) => batch.delete(d.ref));
            await batch.commit();
            touched.add('purchases');
            break;
          }
          case 'upi_save': {
            const { id, upiId, amount, status, timestamp } = action.payload;
            await setDoc(doc(db, 'users', uid, 'upi_transactions', id), { upiId, amount, status, timestamp });
            touched.add('upi');
            break;
          }
          case 'doc_set': {
            const { path, data, merge } = action.payload as { path: string[]; data: any; merge?: boolean };
            const ref = path.length === 0 ? doc(db, 'users', uid) : doc(db, 'users', uid, ...(path as [string, ...string[]]));
            await setDoc(ref, data, { merge: !!merge });
            touched.add('docs');
            break;
          }
          case 'doc_delete': {
            const { path } = action.payload as { path: string[] };
            await deleteDoc(doc(db, 'users', uid, ...(path as [string, ...string[]])));
            touched.add('docs');
            break;
          }
        }
        successCount++;
        await removeAction(action.id);
      } catch (err: any) {
        failCount++;
        console.warn(`[Sync] ${action.type} (${action.id}) failed — kept for retry:`, err?.message ?? err);
        // Offline: no point hammering the rest of the queue this pass.
        if (String(err?.code ?? err?.message ?? '').match(/unavailable|network|offline|timeout/i)) break;
      }
    }
  } catch (error) {
    console.error('Offline sync failed', error);
  } finally {
    isSyncing = false;
  }

  if (failCount > 0) scheduleRetry();
  else retryDelay = 15_000;
  touched.forEach((s) => notifyDataChanged(s));

  if (rerunRequested) {
    rerunRequested = false;
    scheduleSync(100);
  }
  return { successCount, failCount };
}

/** Number of writes still waiting to reach Firestore. */
export async function pendingCount(): Promise<number> {
  return (await readQueue()).length;
}
