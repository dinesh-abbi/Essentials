import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, doc, getDoc, getDocs, limit as limitTo, orderBy, query } from 'firebase/firestore';

import { auth, db, waitForAuth, withTimeout } from '@/utils/firebase';
import * as SyncManager from '@/utils/SyncManager';

/**
 * Shared plumbing for the storage modules added in the Catalyst merge
 * (Training, Fuel, Body). Local-first like the rest of the app: an
 * AsyncStorage cache (namespaced per uid) is what screens read and write;
 * Firestore under `users/{uid}/…` is the durable copy, written by
 * SyncManager's background flusher via generic `doc_set`/`doc_delete`
 * actions and read back opportunistically to revalidate the cache.
 *
 * Paths are segment lists *below* `users/{uid}` — `[]` is the profile doc
 * itself, `['workoutLogs', id]` a sub-document.
 */

export type DocPath = string[];

export async function getUid(): Promise<string> {
  if (auth.currentUser?.uid) return auth.currentUser.uid;
  const user = await waitForAuth();
  return user.uid;
}

function userDocRef(uid: string, path: DocPath) {
  return path.length === 0
    ? doc(db, 'users', uid)
    : doc(db, 'users', uid, ...(path as [string, ...string[]]));
}

// ── Local cache (per user) ────────────────────────────────────────────────────

export async function cacheGet<T>(key: string, fallback: T): Promise<T> {
  try {
    const uid = await getUid();
    const raw = await AsyncStorage.getItem(`${key}_${uid}`);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function cacheSet<T>(key: string, value: T): Promise<void> {
  try {
    const uid = await getUid();
    await AsyncStorage.setItem(`${key}_${uid}`, JSON.stringify(value));
  } catch (e) {
    console.warn(`[userDocs] cache write failed for ${key}`, e);
  }
}

// ── Cache-first reads ─────────────────────────────────────────────────────────

const lastRevalidate = new Map<string, number>();

/**
 * Stale-while-revalidate for a cached value: returns the cache immediately
 * and refreshes it from Firestore in the background (at most every
 * `throttleMs`), emitting a SyncManager 'docs' change when the refreshed
 * value differs so subscribed screens re-read. Only a never-cached value
 * waits for the network.
 */
export async function cacheFirst<T>(
  key: string,
  fallback: T,
  fetchRemote: () => Promise<T | null>,
  opts: { throttleMs?: number; merge?: (cached: T, remote: T) => T } = {},
): Promise<T> {
  const uid = await getUid().catch(() => null);
  if (!uid) return fallback;
  const storageKey = `${key}_${uid}`;
  const raw = await AsyncStorage.getItem(storageKey).catch(() => null);

  const revalidate = async (): Promise<T | null> => {
    const remote = await fetchRemote();
    if (remote === null) return null;
    const cachedRaw = await AsyncStorage.getItem(storageKey).catch(() => null);
    const cached: T = cachedRaw ? JSON.parse(cachedRaw) : fallback;
    const next = opts.merge ? opts.merge(cached, remote) : remote;
    const nextRaw = JSON.stringify(next);
    if (nextRaw !== cachedRaw) {
      await AsyncStorage.setItem(storageKey, nextRaw).catch(() => {});
      if (cachedRaw !== null) SyncManager.notifyDataChanged('docs');
    }
    return next;
  };

  if (raw === null) {
    lastRevalidate.set(storageKey, Date.now());
    return (await revalidate()) ?? fallback;
  }
  if (Date.now() - (lastRevalidate.get(storageKey) ?? 0) > (opts.throttleMs ?? 20_000)) {
    lastRevalidate.set(storageKey, Date.now());
    revalidate().catch(() => {});
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// ── Firestore reads ───────────────────────────────────────────────────────────

/** Reads one document; resolves `null` when missing, offline or slow. */
export async function readUserDoc<T = any>(path: DocPath, timeoutMs = 2000): Promise<T | null> {
  try {
    const uid = await getUid();
    const snap = await withTimeout(getDoc(userDocRef(uid, path)), timeoutMs);
    return snap.exists() ? (snap.data() as T) : null;
  } catch {
    return null;
  }
}

/**
 * Reads a sub-collection newest-first. Resolves `null` (not `[]`) on failure
 * so callers can tell "really empty" apart from "couldn't reach Firestore"
 * and keep their cached copy in the second case.
 */
export async function readUserCollection<T = any>(
  name: string,
  orderField: string,
  max = 120,
  timeoutMs = 2500,
): Promise<(T & { id: string })[] | null> {
  try {
    const uid = await getUid();
    const q = query(collection(db, 'users', uid, name), orderBy(orderField, 'desc'), limitTo(max));
    const snap = await withTimeout(getDocs(q), timeoutMs);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) }));
  } catch {
    return null;
  }
}

// ── Firestore writes (online first, queued otherwise) ─────────────────────────

/**
 * Local-first: callers update their cache first, then this queues the write
 * and returns — SyncManager pushes it to Firestore in the background.
 */
export async function writeUserDoc(path: DocPath, data: Record<string, any>, merge = true): Promise<void> {
  const clean = stripUndefined(data);
  await SyncManager.queueAction({
    id: `action_set_${path.join('_')}_${Date.now()}`,
    type: 'doc_set',
    payload: { path, data: clean, merge },
  });
}

export async function deleteUserDoc(path: DocPath): Promise<void> {
  await SyncManager.queueAction({
    id: `action_del_${path.join('_')}_${Date.now()}`,
    type: 'doc_delete',
    payload: { path },
  });
}

/** Firestore rejects `undefined` field values — drop them recursively. */
function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripUndefined) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value as Record<string, any>)) {
      if (v !== undefined) out[k] = stripUndefined(v);
    }
    return out as T;
  }
  return value;
}

// ── Dates ─────────────────────────────────────────────────────────────────────

/** Local-calendar `YYYY-MM-DD` (never UTC — a 1 AM log belongs to *today*). */
export function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Monday = 1 … Sunday = 7. */
export function isoWeekday(d: Date = new Date()): number {
  const js = d.getDay();
  return js === 0 ? 7 : js;
}
