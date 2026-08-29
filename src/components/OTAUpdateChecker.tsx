import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useRouter, useSegments } from 'expo-router';

import { useAuth } from '@/contexts/AuthContext';
import { checkForUpdate, hasSeenUpdate } from '@/utils/updates';

/**
 * Launch-time update check. Renders nothing — when a newer release exists it
 * routes to the full-screen `/update` reader (see src/app/update.tsx), which
 * replaced the old cramped modal this component used to draw itself.
 *
 * Deliberately conservative about *when* it navigates:
 *  - Android only (the OTA flow installs an APK).
 *  - Waits for Firebase auth to resolve and requires a signed-in user, so it
 *    can't race the auth guard's redirect to /login in src/app/_layout.tsx.
 *  - Skips the login and alarm groups — the alarm screen is a
 *    dismiss-the-alarm-first flow and must never be navigated away from.
 *  - Offers each version once (persisted), instead of nagging every launch.
 *    Profile → What's New keeps it reachable on demand.
 */
export default function OTAUpdateChecker() {
  const router = useRouter();
  const segments = useSegments();
  const { user, loading } = useAuth();
  const hasNavigated = useRef(false);

  const group = segments[0] as string | undefined;
  const blockedRoute = group === 'login' || group === 'alarm' || group === 'update';

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (loading || !user) return;
    if (blockedRoute) return;
    if (hasNavigated.current) return;

    let cancelled = false;

    (async () => {
      const release = await checkForUpdate();
      if (cancelled || !release) return;
      if (await hasSeenUpdate(release.version)) return;
      if (cancelled || hasNavigated.current) return;

      hasNavigated.current = true;
      router.push(`/update?version=${release.version}` as any);
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, user, blockedRoute, router]);

  return null;
}
