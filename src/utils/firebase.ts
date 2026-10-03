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

import googleServices from '../../google-services.json';

// .env wins; anything it doesn't set falls back to the Essentials project's
// google-services.json (project essentials-77c5f), so a fresh clone without
// a .env still talks to the right Firebase project. These are client
// identifiers, not secrets — access is enforced by Firestore rules.
const gsClient = googleServices.client.find(
  (c) => c.client_info.android_client_info.package_name === 'com.catalyst.essentials'
) ?? googleServices.client[0];
const gsProject = googleServices.project_info;

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || gsClient.api_key[0].current_key,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || `${gsProject.project_id}.firebaseapp.com`,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || gsProject.project_id,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || gsProject.storage_bucket,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || gsProject.project_number,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || gsClient.client_info.mobilesdk_app_id,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

/** OAuth "web" client (type 3) — what Google Sign-In needs as `webClientId`. */
export const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_FIREBASE_GOOGLE_WEB_CLIENT_ID ||
  gsClient.oauth_client.find((o) => o.client_type === 3)?.client_id;

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

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Query timeout'));
    }, timeoutMs);

    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

