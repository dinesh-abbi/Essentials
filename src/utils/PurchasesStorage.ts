import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PurchaseLog {
  id: string;
  name: string;
  cost: number;
  category: 'Groceries' | 'Dairy' | 'Veggies' | 'Misc';
  timestamp: number;
}

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
 */
export async function savePurchase(
  name: string,
  cost: number,
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
}
