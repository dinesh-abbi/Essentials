import { Stack } from 'expo-router';

/**
 * Water section nested layout.
 *
 * Creating this file turns `src/app/water/` into a proper Expo Router
 * navigator group. Without it, expo-router 56.2.13+ auto-registers
 * `water/index.tsx` as BOTH `__root > water` AND `__root > water/index`,
 * causing a "conflicting screens" crash at runtime.
 *
 * With this layout:
 *  - The ROOT Stack (root _layout.tsx) sees only `water` (the group).
 *  - Within this nested Stack, screens are `index`, `weekly`, `monthly`.
 *  - Tab switching (replace) happens inside this Stack → instant, no flash.
 *  - Entry from home → root Stack fade animation applies.
 */
export default function WaterLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Daily view — fade in from home, feels like a page transition */}
      <Stack.Screen name="index" options={{ animation: 'fade' }} />
      {/* Weekly / Monthly — instant switch, no blank-screen flash */}
      <Stack.Screen name="weekly" options={{ animation: 'none' }} />
      <Stack.Screen name="monthly" options={{ animation: 'none' }} />
    </Stack>
  );
}
