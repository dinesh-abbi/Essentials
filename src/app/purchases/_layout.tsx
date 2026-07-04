import React, { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import AppLoader from '@/components/AppLoader';
import { Alert } from 'react-native';

/**
 * Purchases group layout.
 * Enforces biometric check (Face ID / Touch ID / Device passcode)
 * to unlock the spend/purchases logs.
 */
export default function PurchasesLayout() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authenticateUser();
  }, []);

  async function authenticateUser() {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (hasHardware && isEnrolled) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Authenticate to access Spend Tracker',
          fallbackLabel: 'Use Device Passcode',
          disableDeviceFallback: false,
        });

        if (result.success) {
          setIsAuthenticated(true);
        } else {
          Alert.alert('Access Denied', 'Authentication is required to view purchases.');
          router.back();
        }
      } else {
        // Biometrics not set up or not supported — bypass check safely
        setIsAuthenticated(true);
      }
    } catch (e) {
      console.error('Biometric authentication failed', e);
      Alert.alert('Security Error', 'Biometric verification failed.');
      router.back();
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <AppLoader label="Verifying credentials…" />;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ animation: 'fade' }} />
      <Stack.Screen name="weekly" options={{ animation: 'none' }} />
      <Stack.Screen name="monthly" options={{ animation: 'none' }} />
    </Stack>
  );
}
