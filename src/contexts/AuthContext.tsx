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

import { auth } from '@/utils/firebase';

// ─── Types ────────────────────────────────────────────────────────────────────
interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signInWithGoogle: async () => {},
  signInWithEmail: async () => {},
  signUpWithEmail: async () => {},
  signOut: async () => {},
  updateDisplayName: async () => {},
});

// ─── Configure Google Sign-In (run once at module load) ───────────────────────
if (!isExpoGo && GoogleSignin) {
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_FIREBASE_GOOGLE_WEB_CLIENT_ID,
    offlineAccess: false,
  });
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Firebase auth state listener ──────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
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

  return (
    <AuthContext.Provider
      value={{ user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut, updateDisplayName }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useAuth() {
  return useContext(AuthContext);
}
