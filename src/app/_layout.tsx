import { useEffect } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider, Stack, useRouter, useSegments } from 'expo-router';
import { AppState, NativeModules, useColorScheme } from 'react-native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
// Per-weight subpaths, NOT the package index. Each index module `require()`s
// every weight and italic it ships, so importing from it would make Metro
// bundle 5-9 unused faces per family. These four back the "Technical, but
// kind" screens (Home, Profile, Water, Purchases, Alarm, …) via
// constants/theme.ts.
import { SpaceGrotesk_500Medium } from '@expo-google-fonts/space-grotesk/500Medium';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk/700Bold';
import { Onest_400Regular } from '@expo-google-fonts/onest/400Regular';
import { Onest_500Medium } from '@expo-google-fonts/onest/500Medium';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import * as WaterStorage from '@/utils/WaterStorage';
import * as WidgetSync from '@/utils/WidgetSync';
import { ensureNotificationsScheduled, Notifications, triggerWaterGoalNotification } from '@/utils/notifications';
import { auth, waitForAuth } from '@/utils/firebase';
import { cleanOldApks, handlePendingInstallIfActive } from '@/utils/updates';
import OTAUpdateChecker from '@/components/OTAUpdateChecker';
import AppLoader from '@/components/AppLoader';
import { Motion } from '@/constants/theme';

// Hold the native splash until the type ramp's faces are in memory. Swapping
// in a JS loader instead would paint one surface, then the real one — a visible
// flash of differently-metricked text on every cold start.
SplashScreen.preventAutoHideAsync().catch(() => {});

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
    </Stack>
  );
}

// ── Root layout — wraps everything in providers ────────────────────────────────
export default function RootLayout() {
  const colorScheme = useColorScheme();

  // The type ramp in `theme.ts` names these four faces directly, so nothing
  // text-bearing may render until they resolve — otherwise the first frame
  // paints in system Roboto at the wrong metrics and visibly reflows.
  // A load *failure* is not worth blocking the app on: fall through and let
  // RN substitute the system face rather than hanging on the loader forever.
  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
    Onest_400Regular,
    Onest_500Medium,
  });

  useEffect(() => {
    // A load *failure* must still release the splash, or the app hangs on it
    // forever; RN just substitutes the system face in that case.
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <AnimatedSplashOverlay />
        <OTAUpdateChecker />
        <AppStack />
      </AuthProvider>
    </ThemeProvider>
  );
}
