/**
 * Firebase App + Auth + Firestore initializer.
 * Uses EXPO_PUBLIC_ env vars — safe to use in client bundle.
 */
import { getApp, getApps, initializeApp } from 'firebase/app';
import { initializeAuth, onAuthStateChanged, type User } from 'firebase/auth';
import * as Auth from 'firebase/auth';
const getReactNativePersistence = (Auth as any).getReactNativePersistence;
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID!,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Prevent double-initialization during hot reloads
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Use AsyncStorage for auth persistence so the session survives app restarts
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

// Firestore for user profile data (webhook URLs, etc.)
export const db = getFirestore(app);

/**
 * Returns a promise that resolves with the current Firebase user once auth
 * state has been restored from AsyncStorage.  If the user is already
 * authenticated it resolves immediately, avoiding the race condition where
 * storage utils access `auth.currentUser` before the persisted session loads.
 */
export function waitForAuth(): Promise<User> {
  return new Promise((resolve, reject) => {
    if (auth.currentUser) {
      resolve(auth.currentUser);
      return;
    }
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      if (user) resolve(user);
      else reject(new Error('No authenticated user'));
    });
  });
}

export { app };
