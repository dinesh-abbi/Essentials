import {
  GoogleAuthProvider,
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import Constants, { ExecutionEnvironment } from 'expo-constants';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let GoogleSignin: any;
let statusCodes: any;
let isErrorWithCode: any;

if (!isExpoGo) {
  try {
    const GSignin = require('@react-native-google-signin/google-signin');
    GoogleSignin = GSignin.GoogleSignin;
    statusCodes = GSignin.statusCodes;
    isErrorWithCode = GSignin.isErrorWithCode;
  } catch (e) {
    console.warn('Google Signin module not found');
  }
}
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { auth, db } from '@/utils/firebase';

// ─── Types ────────────────────────────────────────────────────────────────────
interface AuthContextValue {
  user: User | null;
  loading: boolean;
  /** The user's saved Discord webhook URL (null if not set yet) */
  discordWebhookUrl: string | null;
  /** Whether the Firestore profile has been fetched yet */
  profileLoaded: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
  updateDiscordWebhook: (url: string) => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  discordWebhookUrl: null,
  profileLoaded: false,
  signInWithGoogle: async () => {},
  signInWithEmail: async () => {},
  signUpWithEmail: async () => {},
  signOut: async () => {},
  updateDisplayName: async () => {},
  updateDiscordWebhook: async () => {},
});

// ─── Configure Google Sign-In (run once at module load) ───────────────────────
if (!isExpoGo && GoogleSignin) {
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_FIREBASE_GOOGLE_WEB_CLIENT_ID,
    offlineAccess: false,
  });
}

// ─── Firestore helpers ────────────────────────────────────────────────────────

/** Ensure a user document exists in the `users` collection. Creates one on first login. */
async function ensureUserDocument(u: User): Promise<string | null> {
  const userRef = doc(db, 'users', u.uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    // First-time registration — create the document
    await setDoc(userRef, {
      uid: u.uid,
      email: u.email ?? null,
      discordWebhookUrl: null,
      createdAt: serverTimestamp(),
    });
    return null; // no webhook yet
  }

  return snap.data()?.discordWebhookUrl ?? null;
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState<string | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  // ── Firebase auth state listener ──────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);

      if (u) {
        try {
          const webhookUrl = await ensureUserDocument(u);
          setDiscordWebhookUrl(webhookUrl);
        } catch (err) {
          console.error('Failed to load user profile from Firestore:', err);
          setDiscordWebhookUrl(null);
        }
        setProfileLoaded(true);
      } else {
        setDiscordWebhookUrl(null);
        setProfileLoaded(false);
      }

      setLoading(false);
    });
    return unsub;
  }, []);

  // ── Auth actions ──────────────────────────────────────────────────────────────
  const signInWithGoogle = useCallback(async () => {
    if (isExpoGo || !GoogleSignin) {
      Alert.alert('Not Available', 'Google Sign-In is not supported in Expo Go. Please use a Development Build.');
      return;
    }

    try {
      // Check Google Play Services available on device
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      // Native Google Sign-In popup
      const response = await GoogleSignin.signIn();

      // Extract the ID token from the response
      const idToken = response.data?.idToken;
      if (!idToken) {
        throw new Error('No ID token returned from Google Sign-In.');
      }

      // Exchange for a Firebase credential
      const credential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(auth, credential);

    } catch (error: any) {
      if (isErrorWithCode && isErrorWithCode(error)) {
        switch (error.code) {
          case statusCodes.SIGN_IN_CANCELLED:
            // User dismissed the dialog — silent, no alert needed
            break;
          case statusCodes.IN_PROGRESS:
            Alert.alert('Sign-In in progress', 'Please wait...');
            break;
          case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
            Alert.alert('Google Play Services required', 'Please update Google Play Services and try again.');
            break;
          default:
            Alert.alert('Google Sign-In failed', (error as Error).message);
        }
      } else {
        Alert.alert('Google Sign-In failed', (error as Error).message ?? 'Unknown error');
      }
    }
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    await createUserWithEmailAndPassword(auth, email, password);
  }, []);

  const signOut = useCallback(async () => {
    // Also sign out from Google so the picker shows on next sign-in
    if (!isExpoGo && GoogleSignin) {
      try { await GoogleSignin.signOut(); } catch { /* not signed in via Google, ignore */ }
    }
    await firebaseSignOut(auth);
  }, []);

  const updateDisplayName = useCallback(async (name: string) => {
    if (auth.currentUser) {
      await updateProfile(auth.currentUser, { displayName: name });
      setUser(Object.assign({}, auth.currentUser) as User);
    }
  }, []);

  const updateDiscordWebhook = useCallback(async (url: string) => {
    if (!auth.currentUser) return;
    const userRef = doc(db, 'users', auth.currentUser.uid);
    await updateDoc(userRef, { discordWebhookUrl: url });
    setDiscordWebhookUrl(url);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        discordWebhookUrl,
        profileLoaded,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        updateDisplayName,
        updateDiscordWebhook,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useAuth() {
  return useContext(AuthContext);
}
