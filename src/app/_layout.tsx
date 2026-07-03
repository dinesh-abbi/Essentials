import { useEffect } from 'react';
import { DarkTheme, DefaultTheme, Redirect, ThemeProvider, Stack, router } from 'expo-router';
import { useColorScheme } from 'react-native';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import * as WaterStorage from '@/utils/WaterStorage';
import { ensureNotificationsScheduled, Notifications } from '@/utils/notifications';
import OTAUpdateChecker from '@/components/OTAUpdateChecker';
import AppLoader from '@/components/AppLoader';

// ── Inner layout that can access AuthContext ───────────────────────────────────
function AppStack() {
  const { user, loading, profileLoaded } = useAuth();

  useEffect(() => {
    if (user) {
      ensureNotificationsScheduled().catch((err) => console.error('Ensure notifications failed', err));

      const subscription = Notifications.addNotificationResponseReceivedListener(async (response: any) => {
        const { actionIdentifier } = response;

        if (actionIdentifier === 'YES_ACTION') {
          try {
            await WaterStorage.logWaterIntake(250);
          } catch (e) {
            console.error('Failed to log water from notification', e);
          }
        }

        // Tap or Yes opens home and highlights water widget, unless a specific route is provided
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
    }
  }, [user]);

  // Block all rendering until Firebase resolves the persisted session.
  // Rendering AppLoader *before* <Stack> prevents the tabs from flashing
  // briefly before the <Redirect href="/login" /> fires.
  if (loading || (user && !profileLoaded)) {
    return <AppLoader label="Signing in…" />;
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

      {/* Feature modals */}
      {/* Water screens — plain fade push so opening from home feels like a
          page transition, not a modal sheet. Weekly/Monthly use none so
          tab-switching is instant with no blank-screen flash. */}
      <Stack.Screen
        name="water/index"
        options={{ headerShown: false, animation: 'fade' }}
      />
      <Stack.Screen
        name="water/weekly"
        options={{ headerShown: false, animation: 'none' }}
      />
      <Stack.Screen
        name="water/monthly"
        options={{ headerShown: false, animation: 'none' }}
      />
      <Stack.Screen
        name="attendance"
        options={{ presentation: 'modal', headerShown: false, animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="purchases"
        options={{ presentation: 'modal', headerShown: false, animation: 'slide_from_bottom' }}
      />

      {/* Auth guard redirect — safe here because AppLoader fully blocks
          the Stack from rendering while loading === true, so the tabs
          never flash before this redirect fires. */}
      {!user && <Redirect href="/login" />}

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
        <OTAUpdateChecker />
        <AppStack />
      </AuthProvider>
    </ThemeProvider>
  );
}
