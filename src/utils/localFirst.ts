import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, getDocs } from 'firebase/firestore';

import { auth, db, waitForAuth, withTimeout } from '@/utils/firebase';
import * as SyncManager from '@/utils/SyncManager';

/**
 * Stale-while-revalidate reads for a users/{uid}/<collection> list.
 *
 *   read()  → the AsyncStorage cache *immediately* (plus queued, not-yet-
 *             synced mutations), and kicks off a throttled background refresh
 *             from Firestore. Only a cold cache (first run on a device) waits
 *             for the network, once.
 *   refresh → fetches the collection, merges it into the cache, and emits a
 *             SyncManager change event if anything actually changed, so
 *             subscribed screens re-read.
 *
 * Writes don't live here: callers update the cache through `upsert`/`remove`
 * and enqueue the matching SyncManager action, which flushes in the
 * background (see SyncManager.ts).
 */
export interface Timestamped {
  id: string;
  timestamp: number;
}

export function createCollectionCache<T extends Timestamped>(opts: {
  collection: string;
  cacheKey: string;
  scope: SyncManager.DataScope;
  fromDoc: (id: string, data: any) => T;
  applyQueue: (items: T[]) => Promise<T[]>;
  /** Minimum gap between background refreshes. */
  throttleMs?: number;
}) {
  const throttleMs = opts.throttleMs ?? 20_000;
  let lastRefresh = 0;
  let inFlight: Promise<boolean> | null = null;

  async function uid(): Promise<string> {
    if (auth.currentUser?.uid) return auth.currentUser.uid;
    return (await waitForAuth()).uid;
  }

  /** `null` = never cached on this device for this user. */
  async function getCacheRaw(): Promise<T[] | null> {
    try {
      const raw = await AsyncStorage.getItem(`${opts.cacheKey}_${await uid()}`);
      return raw ? (JSON.parse(raw) as T[]) : null;
    } catch {
      return null;
    }
  }

  async function getCache(): Promise<T[]> {
    return (await getCacheRaw()) ?? [];
  }

  async function setCache(items: T[]): Promise<void> {
    try {
      const sorted = [...items].sort((a, b) => b.timestamp - a.timestamp);
      await AsyncStorage.setItem(`${opts.cacheKey}_${await uid()}`, JSON.stringify(sorted));
    } catch (e) {
      console.error(`[${opts.collection}] cache write failed`, e);
    }
  }

  async function upsert(items: T[]): Promise<void> {
    const map = new Map((await getCache()).map((i) => [i.id, i]));
    items.forEach((i) => map.set(i.id, i));
    await setCache(Array.from(map.values()));
  }

  async function remove(ids: string[]): Promise<void> {
    const drop = new Set(ids);
    await setCache((await getCache()).filter((i) => !drop.has(i.id)));
  }

  /** Fetch from Firestore and merge into the cache. Resolves true if it changed. */
  function refresh(timeoutMs = 8000): Promise<boolean> {
    if (inFlight) return inFlight;
    inFlight = (async () => {
      const startedAt = Date.now();
      try {
        const snap = await withTimeout(getDocs(collection(db, 'users', await uid(), opts.collection)), timeoutMs);
        const remote = snap.docs.map((d) => opts.fromDoc(d.id, d.data()));
        const cached = await getCache();
        const remoteIds = new Set(remote.map((r) => r.id));
        // Items written on this device moments ago may have synced *after*
        // this snapshot was taken (so they're no longer in the queue either);
        // keep them rather than flicker them out until the next refresh.
        const recentLocal = cached.filter((c) => !remoteIds.has(c.id) && c.timestamp > startedAt - 120_000);
        const next = [...remote, ...recentLocal];
        const changed =
          next.length !== cached.length ||
          JSON.stringify([...next].sort((a, b) => b.timestamp - a.timestamp)) !== JSON.stringify(cached);
        await setCache(next);
        lastRefresh = Date.now();
        if (changed) SyncManager.notifyDataChanged(opts.scope);
        return changed;
      } catch (e: any) {
        console.warn(`[${opts.collection}] background refresh failed — serving cache`, e?.message ?? e);
        lastRefresh = Date.now();
        return false;
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  }

  /** Cache-first read; network only on a cold cache. */
  async function read(): Promise<T[]> {
    const cached = await getCacheRaw();
    if (cached === null) {
      await refresh(4000);
    } else if (Date.now() - lastRefresh > throttleMs) {
      refresh().catch(() => {});
    }
    return opts.applyQueue(await getCache());
  }

  return { read, refresh, getCache, setCache, upsert, remove };
}
