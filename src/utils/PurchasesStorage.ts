import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  writeBatch,
} from 'firebase/firestore';

import { auth, db, waitForAuth } from '@/utils/firebase';

export interface PurchaseLog {
  id: string;
  name: string;
  cost: number;
  category: 'Groceries' | 'Dairy' | 'Veggies' | 'Misc';
  timestamp: number;
}

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
 * Retrieve all purchases logs sorted from newest to oldest.
 */
export async function getPurchases(): Promise<PurchaseLog[]> {
  try {
    const q = query(await purchasesCollection(), orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({
      id: d.id,
      name: d.data().name,
      cost: d.data().cost,
      category: d.data().category,
      timestamp: d.data().timestamp,
    }));
  } catch (error) {
    console.error('Failed to get purchases from Firestore', error);
    return [];
  }
}

/**
 * Save a new purchase log to Firestore.
 */
export async function savePurchase(
  name: string,
  cost: number,
  category: 'Groceries' | 'Dairy' | 'Veggies' | 'Misc'
): Promise<PurchaseLog> {
  const timestamp = Date.now();

  try {
    const docRef = await addDoc(await purchasesCollection(), {
      name: name.trim(),
      cost,
      category,
      timestamp,
    });

    return {
      id: docRef.id,
      name: name.trim(),
      cost,
      category,
      timestamp,
    };
  } catch (error) {
    console.error('Failed to save purchase to Firestore', error);
    throw error;
  }
}

/**
 * Delete a specific purchase log by ID from Firestore.
 */
export async function deletePurchase(id: string): Promise<void> {
  try {
    const uid = await getCurrentUserId();
    await deleteDoc(doc(db, 'users', uid, 'purchases', id));
  } catch (error) {
    console.error('Failed to delete purchase from Firestore', error);
    throw error;
  }
}

/**
 * Clear all purchase logs from Firestore (batch delete).
 */
export async function clearPurchases(): Promise<void> {
  try {
    const allPurchases = await getPurchases();
    if (allPurchases.length === 0) return;

    const uid = await getCurrentUserId();
    const batch = writeBatch(db);

    allPurchases.forEach((purchase) => {
      batch.delete(doc(db, 'users', uid, 'purchases', purchase.id));
    });

    await batch.commit();
  } catch (error) {
    console.error('Failed to clear purchases from Firestore', error);
    throw error;
  }
}
