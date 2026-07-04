import AsyncStorage from '@react-native-async-storage/async-storage';
import { Paths, Directory, File, UploadType } from 'expo-file-system';
import { auth, db, waitForAuth } from '@/utils/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import * as SyncManager from './SyncManager';

export interface OfflineLog {
  id: string;
  fileUri: string;
  timestamp: number;
}

// Keep a reference to our persistent folder
const DIRECTORY_PATH = new Directory(Paths.document, 'attendance_logs');
const QUEUE_STORAGE_KEY = '@attendance_sync_queue';

// Generate a simple unique ID
const generateId = () => {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
};

/**
 * Ensures the persistent folder exists
 */
function ensureDirectoryExists(): void {
  if (!DIRECTORY_PATH.exists) {
    DIRECTORY_PATH.create();
  }
}

/**
 * Gets the last check-in time, resetting daily
 */
export async function getLastCheckInTime(): Promise<number | null> {
  try {
    const timeStr = await AsyncStorage.getItem('@last_check_in_time');
    if (!timeStr) return null;
    const lastTime = parseInt(timeStr, 10);
    if (isNaN(lastTime)) return null;

    // Check if it's from a previous day (resets daily)
    const lastDate = new Date(lastTime);
    const today = new Date();
    if (
      lastDate.getDate() !== today.getDate() ||
      lastDate.getMonth() !== today.getMonth() ||
      lastDate.getFullYear() !== today.getFullYear()
    ) {
      await AsyncStorage.removeItem('@last_check_in_time');
      return null;
    }
    return lastTime;
  } catch (error) {
    console.error('Failed to get last check in time', error);
    return null;
  }
}

/**
 * Saves the last check-in time locally and to Firestore user document
 */
export async function saveLastCheckInTime(timestamp: number): Promise<void> {
  try {
    await AsyncStorage.setItem('@last_check_in_time', timestamp.toString());

    const isOnline = await SyncManager.isOnline();
    if (isOnline) {
      await waitForAuth();
      const user = auth.currentUser;
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, { lastCheckInTime: timestamp });
      }
    }
  } catch (error) {
    console.error('Failed to save last check in time', error);
  }
}

/**
 * Moves temporary camera file to persistent directory and logs to AsyncStorage queue
 */
export async function saveOfflineLog(tempUri: string, timestamp: number): Promise<void> {
  ensureDirectoryExists();
  const id = generateId();
  
  // Create File instances for both source and destination
  const sourceFile = new File(tempUri);
  const destFile = new File(DIRECTORY_PATH, `${id}.jpg`);

  // Move the photo to persistent storage
  await sourceFile.move(destFile);

  // Save metadata
  const queue = await getOfflineQueue();
  queue.push({
    id,
    fileUri: destFile.uri,
    timestamp,
  });

  await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));

  // Save check-in timestamp offline too
  await saveLastCheckInTime(timestamp);
}

/**
 * Retrieves the metadata list of offline logs
 */
export async function getOfflineQueue(): Promise<OfflineLog[]> {
  try {
    const queueStr = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
    return queueStr ? JSON.parse(queueStr) : [];
  } catch (error) {
    console.error('Failed to retrieve offline queue', error);
    return [];
  }
}

/**
 * Deletes local persistent file and removes from AsyncStorage queue
 */
export async function removeOfflineLog(id: string, fileUri: string): Promise<void> {
  try {
    const file = new File(fileUri);
    if (file.exists) {
      file.delete();
    }
  } catch (error) {
    console.warn(`Could not delete file ${fileUri}:`, error);
  }

  try {
    const queue = await getOfflineQueue();
    const updatedQueue = queue.filter((item) => item.id !== id);
    await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(updatedQueue));
  } catch (error) {
    console.error('Failed to update offline queue metadata:', error);
  }
}

/**
 * Iterates through the offline queue and attempts to upload files to Discord Webhook
 */
export async function syncQueue(webhookUrl: string): Promise<{ successCount: number; failCount: number }> {
  const queue = await getOfflineQueue();
  let successCount = 0;
  let failCount = 0;

  for (const log of queue) {
    try {
      // Check if file exists
      const file = new File(log.fileUri);
      if (!file.exists) {
        // File was deleted or moved, remove from queue
        await removeOfflineLog(log.id, log.fileUri);
        continue;
      }

      const formattedTime = new Date(log.timestamp).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'medium',
        timeStyle: 'medium',
      }) + ' IST';

      // Prepare payload JSON
      const payload = {
        content: `📸 **Attendance Log Synced (Offline Mode)**\n**Captured at**: ${formattedTime}\n**Log ID**: \`${log.id}\``,
      };

      const result = await file.upload(webhookUrl, {
        uploadType: UploadType.MULTIPART,
        fieldName: 'files[0]',
        mimeType: 'image/jpeg',
        parameters: {
          payload_json: JSON.stringify(payload),
        },
      });

      if (result.status >= 200 && result.status < 300) {
        successCount++;
        await removeOfflineLog(log.id, log.fileUri);
        await saveLastCheckInTime(log.timestamp);
      } else {
        failCount++;
        console.warn(`Sync failed for log ${log.id} with status code ${result.status}`);
      }
    } catch (error) {
      failCount++;
      console.error(`Error syncing log ${log.id}:`, error);
    }
  }

  return { successCount, failCount };
}
