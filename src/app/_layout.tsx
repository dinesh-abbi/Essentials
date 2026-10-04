import { useEffect, useRef, useState } from 'react';
import { DarkTheme, ThemeProvider, Stack, useRouter, useSegments } from 'expo-router';
import { AppState, NativeModules } from 'react-native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
// Per-weight subpaths, NOT the package index. Each index module `require()`s
// every weight and italic it ships, so importing from it would make Metro
// bundle ~16 unused faces. These six are the whole type ramp in
// constants/theme.ts.
import { Nunito_600SemiBold } from '@expo-google-fonts/nunito/600SemiBold';
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold';
import { Nunito_800ExtraBold } from '@expo-google-fonts/nunito/800ExtraBold';
import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black';
import { Doto_800ExtraBold } from '@expo-google-fonts/doto/800ExtraBold';
import { Doto_900Black } from '@expo-google-fonts/doto/900Black';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import * as WaterStorage from '@/utils/WaterStorage';
import * as WidgetSync from '@/utils/WidgetSync';
import { ensureNotificationsScheduled, Notifications, triggerWaterGoalNotification } from '@/utils/notifications';
import { auth, waitForAuth } from '@/utils/firebase';
import { cleanOldApks, handlePendingInstallIfActive } from '@/utils/updates';
import OTAUpdateChecker from '@/components/OTAUpdateChecker';
import AppLoader from '@/components/AppLoader';
import { AppLock } from '@/components/AppLock';
import { isAppLockEnabled } from '@/utils/Preferences';
import * as SyncManager from '@/utils/SyncManager';
import { Colors, Motion } from '@/constants/theme';

// Hold the native splash until the type ramp's faces are in memory. Swapping
// in a JS loader instead would paint one surface, then the real one — a visible
// flash of differently-metricked text on every cold start.
SplashScreen.preventAutoHideAsync().catch(() => {});

// How long the app may sit in the background before the (opt-in) app lock
// asks for biometrics again — short trips to another app shouldn't re-lock.
const LOCK_GRACE_MS = 5 * 60 * 1000;

// ── Inner layout that can access AuthContext ───────────────────────────────────
function AppStack() {
  const { user, loading, profileLoaded } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // ── Global Auth Guard Routing ───────────────────────────────────────────────
  useEffect(() => {
    if (loading) return;

    // Check segments
    const inAuthGroup = segments[0] === 'login';
    const inAlarmGroup = (segments[0] as string) === 'alarm';

    if (inAlarmGroup) return; // Never block or redirect alarm screen

    if (!user && !inAuthGroup) {
      // Redirect to the login screen if signed out
      router.replace('/login');
    } else if (user && inAuthGroup) {
      // Redirect to the main tabs if logged in
      router.replace('/(tabs)');
    }
  }, [user, loading, segments]);

  // ── Opt-in app lock (merged from Catalyst) ──────────────────────────────────
  // Locks on cold start and after LOCK_GRACE_MS in the background. Never
  // covers the alarm screen: a ringing alarm must stay dismissable.
  const [locked, setLocked] = useState(false);
  const backgroundedAt = useRef<number | null>(null);
  useEffect(() => {
    // Signed out → nothing to lock (showLock below also requires a user).
    if (!user) return;
    // Local-first writes: flush anything queued (including from last session)
    // and keep flushing in the background while the app is used.
    SyncManager.startBackgroundSync();
    isAppLockEnabled().then((on) => setLocked(on));
    const sub = AppState.addEventListener('change', async (next) => {
      if (next === 'background') {
        backgroundedAt.current = Date.now();
      } else if (next === 'active') {
        const away = backgroundedAt.current ? Date.now() - backgroundedAt.current : 0;
        backgroundedAt.current = null;
        if (away > LOCK_GRACE_MS && (await isAppLockEnabled())) setLocked(true);
      }
    });
    return () => sub.remove();
  }, [user]);
  const showLock = locked && !!user && (segments[0] as string) !== 'alarm';

  // ── Alarm Launch check & Notification Auto-Clear on startup and resume ──────
  useEffect(() => {
    const checkAlarmLaunch = async () => {
      try {
        const { AlarmScheduler } = NativeModules;
        if (AlarmScheduler && typeof AlarmScheduler.checkAlarmLaunch === 'function') {
          const isAlarmLaunch = await AlarmScheduler.checkAlarmLaunch();
          if (isAlarmLaunch) {
            router.push('/alarm/screen' as any);
          }
        }
      } catch (err) {
        console.error('Failed to check alarm launch state:', err);
      }
    };

    const clearNotifications = () => {
      if (Notifications && typeof Notifications.dismissAllNotificationsAsync === 'function') {
        Notifications.dismissAllNotificationsAsync().catch((err: any) =>
          console.warn('Failed to dismiss notifications:', err)
        );
      }
    };

    // Check & clear on mount
    checkAlarmLaunch();
    clearNotifications();
    handlePendingInstallIfActive();
    cleanOldApks();

    // Check & clear when App returns to foreground (e.g. via SingleTop activity launch)
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        checkAlarmLaunch();
        clearNotifications();
        handlePendingInstallIfActive();
      }
    });

    return () => subscription.remove();
  }, [router]);

  // ── Notification Setup & Listener on Startup ────────────────────────────────
  useEffect(() => {
    // Request permissions and schedule reminders on app startup
    ensureNotificationsScheduled().catch((err) =>
      console.error('Startup notifications setup failed:', err)
    );

    // Register global notification tap listener
    const subscription = Notifications.addNotificationResponseReceivedListener(async (response: any) => {
      const { actionIdentifier } = response;

      if (actionIdentifier === 'YES_ACTION') {
        try {
          await waitForAuth();
          // Only attempt logging if user is actually authenticated
          if (auth.currentUser) {
            const userGoal = await WaterStorage.getUserWaterGoal();
            await WaterStorage.logWaterIntake(250);
            const freshTotal = await WaterStorage.getTodayTotalMl();
            WidgetSync.sync();
            if (freshTotal >= userGoal) {
              triggerWaterGoalNotification().catch((e) =>
                console.warn('Goal notification (YES_ACTION) failed:', e)
              );
            }
          } else {
            console.warn('[Notifications] YES_ACTION tapped but no user session exists');
          }
        } catch (e) {
          console.error('Failed to log water from notification', e);
        }
      }

      // Route the user
      if (actionIdentifier === 'YES_ACTION' || actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
        const route = response.notification.request.content.data?.route;
        if (route) {
          router.replace(route as any);
        } else {
          // Pass a unique timestamp so the home screen always detects a change
          // even if it was already on the tab (param value changes → effect re-runs)
          router.replace(`/(tabs)?highlight=water&waterTs=${Date.now()}` as any);
        }
      }
    });

    return () => subscription.remove();
  }, []);

  // Block all rendering until Firebase resolves the persisted session.
  // Rendering AppLoader *before* <Stack> prevents the tabs from flashing
  // briefly before the redirect fires.
  if (loading || (user && !profileLoaded)) {
    return <AppLoader label="" />;
  }

  return (
    <>
    <Stack screenOptions={{ animationDuration: Motion.duration.screen }}>
      {/* Login screen — shown only when not authenticated */}
      <Stack.Screen
        name="login"
        options={{ headerShown: false, animation: 'fade' }}
      />

      {/* Protected tabs */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

      {/* Feature modals & Groups */}
      <Stack.Screen
        name="water"
        options={{ headerShown: false, animation: 'fade' }}
      />
      <Stack.Screen
        name="water/report"
        options={{ headerShown: false, animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="attendance"
        options={{ presentation: 'modal', headerShown: false, animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="purchases"
        options={{ presentation: 'modal', headerShown: false, animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="purchases/report"
        options={{ headerShown: false, animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="upi/scanner"
        options={{ presentation: 'modal', headerShown: false, animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="upi/amount"
        options={{ presentation: 'modal', headerShown: false, animation: 'slide_from_bottom' }}
      />

      {/* Barcode Alarm screens */}
      <Stack.Screen
        name="alarm/setup"
        options={{ presentation: 'modal', headerShown: false, animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="alarm/screen"
        options={{ headerShown: false, animation: 'none', gestureEnabled: false }}
      />

      {/* Release notes & OTA update readers */}
      <Stack.Screen
        name="whats-new"
        options={{ headerShown: false, animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="update"
        options={{ presentation: 'modal', headerShown: false, animation: 'slide_from_bottom' }}
      />

      {/* Training · Fuel (merged from Catalyst) */}
      <Stack.Screen
        name="train/week"
        options={{ headerShown: false, animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="train/brief"
        options={{ headerShown: false, animation: 'fade' }}
      />
    </Stack>
    {showLock && <AppLock onUnlock={() => setLocked(false)} />}
    </>
  );
}

// Single dark theme: navigation surfaces (screen backgrounds during a push)
// must match the app's base or a white frame flashes between screens.
const NAV_THEME = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: Colors.dark.bg, card: Colors.dark.bg, primary: Colors.dark.water },
};

// ── Root layout — wraps everything in providers ────────────────────────────────
export default function RootLayout() {
  // The type ramp in `theme.ts` names these four faces directly, so nothing
  // text-bearing may render until they resolve — otherwise the first frame
  // paints in system Roboto at the wrong metrics and visibly reflows.
  // A load *failure* is not worth blocking the app on: fall through and let
  // RN substitute the system face rather than hanging on the loader forever.
  const [fontsLoaded, fontError] = useFonts({
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
    Doto_800ExtraBold,
    Doto_900Black,
  });

  useEffect(() => {
    // A load *failure* must still release the splash, or the app hangs on it
    // forever; RN just substitutes the system face in that case.
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <ThemeProvider value={NAV_THEME}>
      <AuthProvider>
        <AnimatedSplashOverlay />
        <OTAUpdateChecker />
        <AppStack />
      </AuthProvider>
    </ThemeProvider>
  );
}
