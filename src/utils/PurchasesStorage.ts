import { createCollectionCache } from '@/utils/localFirst';
import * as SyncManager from './SyncManager';

/**
 * Purchases (Spend) — local-first, same shape as WaterStorage: the cache
 * answers immediately, users/{uid}/purchases revalidates in the background,
 * and every write is queued for a background push.
 */

const generateId = () => `purchase_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

export interface PurchaseLog {
  id: string;
  name: string;
  cost: number;
  category: string;
  timestamp: number;
}

const PURCHASES_CACHE_KEY = '@essentials_purchases_cache';

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

const purchases = createCollectionCache<PurchaseLog>({
  collection: 'purchases',
  cacheKey: PURCHASES_CACHE_KEY,
  scope: 'purchases',
  fromDoc: (id, d) => ({ id, name: d.name, cost: d.cost, category: d.category, timestamp: d.timestamp }),
  applyQueue: applyPurchasesOfflineMutations,
});

/** All purchases, newest first (cache-first). */
export async function getPurchases(): Promise<PurchaseLog[]> {
  return purchases.read();
}

/** Forces a revalidation against Firestore. */
export async function refreshPurchases(): Promise<void> {
  await purchases.refresh();
}

/** Save a new purchase. Returns as soon as it's saved on-device. */
export async function savePurchase(
  name: string,
  cost: number,
  category: string,
  timestamp: number = Date.now()
): Promise<PurchaseLog> {
  const newPurchase: PurchaseLog = { id: generateId(), name: name.trim(), cost, category, timestamp };
  await purchases.upsert([newPurchase]);
  await SyncManager.queueAction({ id: `action_${newPurchase.id}`, type: 'purchase_save', payload: newPurchase });
  return newPurchase;
}

/** Update an existing purchase. */
export async function updatePurchase(id: string, updates: Partial<Omit<PurchaseLog, 'id'>>): Promise<void> {
  const current = (await purchases.getCache()).find((p) => p.id === id);
  if (current) await purchases.upsert([{ ...current, ...updates }]);
  await SyncManager.queueAction({
    id: `action_update_${id}_${Date.now()}`,
    type: 'purchase_update',
    payload: { id, updates },
  });
}

/** Delete one purchase. */
export async function deletePurchase(id: string): Promise<void> {
  await purchases.remove([id]);
  await SyncManager.queueAction({
    id: `action_delete_${id}_${Date.now()}`,
    type: 'purchase_delete',
    payload: { id },
  });
}

/** Clear every purchase. */
export async function clearPurchases(): Promise<void> {
  await purchases.setCache([]);
  await SyncManager.queueAction({
    id: `action_clear_purchases_${Date.now()}`,
    type: 'purchase_clear',
    payload: {},
  });
}
