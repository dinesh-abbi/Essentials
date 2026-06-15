import { useEffect } from 'react';
import { DarkTheme, DefaultTheme, Redirect, ThemeProvider, Stack, router } from 'expo-router';
import { useColorScheme, ActivityIndicator, View } from 'react-native';
import * as Notifications from 'expo-notifications';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/theme';
import * as WaterStorage from '@/utils/WaterStorage';
import { scheduleHourlyWaterReminder } from '@/utils/notifications';

// ── Inner layout that can access AuthContext ───────────────────────────────────
function AppStack() {
  const { user, loading } = useAuth();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];

  useEffect(() => {
    if (user) {
      scheduleHourlyWaterReminder().catch((err) => console.error('Schedule reminders failed', err));

      const subscription = Notifications.addNotificationResponseReceivedListener(async (response) => {
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

  // Show a neutral spinner while Firebase resolves the persisted session
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
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
      <Stack.Screen
        name="attendance"
        options={{ presentation: 'modal', headerShown: false, animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="purchases"
        options={{ presentation: 'modal', headerShown: false, animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="water"
        options={{ presentation: 'modal', headerShown: false, animation: 'slide_from_bottom' }}
      />

      {/* Auth guard redirect */}
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
        <AppStack />
      </AuthProvider>
    </ThemeProvider>
  );
}
