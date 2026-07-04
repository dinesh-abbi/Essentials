import { useEffect } from 'react';
<<<<<<< HEAD
import { DarkTheme, DefaultTheme, Redirect, ThemeProvider, Stack, router } from 'expo-router';
import { useColorScheme, ActivityIndicator, View } from 'react-native';
import { Notifications, scheduleHourlyWaterReminder } from '@/utils/notifications';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/theme';
import * as WaterStorage from '@/utils/WaterStorage';

// ── Inner layout that can access AuthContext ───────────────────────────────────
function AppStack() {
  const { user, loading } = useAuth();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];

  useEffect(() => {
    if (user) {
      scheduleHourlyWaterReminder().catch((err) => console.error('Schedule reminders failed', err));

      const subscription = Notifications.addNotificationResponseReceivedListener(async (response: any) => {
        const { actionIdentifier } = response;
        const notification = response.notification;
        const categoryIdentifier = notification.request.content.categoryIdentifier;
        const data = notification.request.content.data;

        // Check if this is a water reminder notification
        const isWaterReminder = categoryIdentifier === 'WATER_REMINDER_CATEGORY' || data?.highlight === 'water';

        if (isWaterReminder) {
          if (actionIdentifier === 'YES_ACTION' || actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
            try {
              await WaterStorage.logWaterIntake(250);
            } catch (e) {
              console.error('Failed to log water from notification', e);
            }
          }
        }

        // Tap or Yes opens home and highlights water widget, unless a specific route is provided
        if (actionIdentifier === 'YES_ACTION' || actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
          const route = data?.route;
          if (route) {
            router.replace(route as any);
          } else {
            router.replace('/(tabs)?highlight=water');
          }
        }
      });

      return () => subscription.remove();
    }
  }, [user]);

  // Show a neutral spinner while Firebase resolves the persisted session
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
=======
import { DarkTheme, DefaultTheme, ThemeProvider, Stack, useRouter, useSegments } from 'expo-router';
import { useColorScheme } from 'react-native';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import * as WaterStorage from '@/utils/WaterStorage';
import { ensureNotificationsScheduled, Notifications, triggerWaterGoalNotification } from '@/utils/notifications';
import { auth } from '@/utils/firebase';
import OTAUpdateChecker from '@/components/OTAUpdateChecker';
import AppLoader from '@/components/AppLoader';

// ── Inner layout that can access AuthContext ───────────────────────────────────
function AppStack() {
  const { user, loading, profileLoaded } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // ── Global Auth Guard Routing ───────────────────────────────────────────────
  useEffect(() => {
    if (loading) return;

    // Check if the user is currently on the login screen
    const inAuthGroup = segments[0] === 'login';

    if (!user && !inAuthGroup) {
      // Redirect to the login screen if signed out
      router.replace('/login');
    } else if (user && inAuthGroup) {
      // Redirect to the main tabs if logged in
      router.replace('/(tabs)');
    }
  }, [user, loading, segments]);

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
          // Only attempt logging if user is actually authenticated
          if (auth.currentUser) {
            const prevTotal = await WaterStorage.getTodayTotalMl();
            await WaterStorage.logWaterIntake(250);
            if (prevTotal < 3000) {
              const freshTotal = await WaterStorage.getTodayTotalMl();
              if (freshTotal >= 3000) {
                triggerWaterGoalNotification().catch((e) =>
                  console.warn('Goal notification (YES_ACTION) failed:', e)
                );
              }
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
          router.replace('/(tabs)?highlight=water');
        }
      }
    });

    return () => subscription.remove();
  }, []);

  // Block all rendering until Firebase resolves the persisted session.
  // Rendering AppLoader *before* <Stack> prevents the tabs from flashing
  // briefly before the redirect fires.
  if (loading || (user && !profileLoaded)) {
    return <AppLoader label="Signing in…" />;
>>>>>>> 75a8f1eb581347a111be59164a8d408806e91506
  }

  return (
    <Stack>
      {/* Login screen — shown only when not authenticated */}
      <Stack.Screen
        name="login"
        options={{ headerShown: false, animation: 'fade' }}
      />

      {/* Protected tabs */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

<<<<<<< HEAD
      {/* Feature modals */}
=======
      {/* Feature modals & Groups */}
      <Stack.Screen
        name="water"
        options={{ headerShown: false, animation: 'fade' }}
      />
>>>>>>> 75a8f1eb581347a111be59164a8d408806e91506
      <Stack.Screen
        name="attendance"
        options={{ presentation: 'modal', headerShown: false, animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="purchases"
        options={{ presentation: 'modal', headerShown: false, animation: 'slide_from_bottom' }}
      />
<<<<<<< HEAD
      <Stack.Screen
        name="water"
        options={{ presentation: 'modal', headerShown: false, animation: 'slide_from_bottom' }}
      />

      {/* Auth guard redirect */}
      {!user && <Redirect href="/login" />}
=======
>>>>>>> 75a8f1eb581347a111be59164a8d408806e91506
    </Stack>
  );
}

// ── Root layout — wraps everything in providers ────────────────────────────────
export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <AnimatedSplashOverlay />
<<<<<<< HEAD
=======
        <OTAUpdateChecker />
>>>>>>> 75a8f1eb581347a111be59164a8d408806e91506
        <AppStack />
      </AuthProvider>
    </ThemeProvider>
  );
}
