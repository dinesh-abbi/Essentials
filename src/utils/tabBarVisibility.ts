import {
  Easing,
  makeMutable,
  useAnimatedScrollHandler,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

/**
 * Shared scroll-reveal state for the floating tab bar.
 *
 * Value is a **pixel offset** (0 = fully visible, positive = tucked down).
 * The tab bar reads this via `useAnimatedStyle` and applies it as
 * `translateY`. By tracking the actual scroll delta instead of a binary 0/1
 * spring, the bar slides in sync with the finger — matching the feel shown
 * in the reference GIF (YouGov-style position-tracking reveal).
 *
 * Lives at module scope because the bar and the scroll views are in
 * different component trees (same bridging problem as utils/blurTarget.ts).
 *
 * It's a Reanimated mutable written from the scroll worklet on the UI
 * thread every frame — routing through React would re-render per frame.
 */
export const tabBarTranslateY = makeMutable(0);

// Fast, no-overshoot settle for the final snap-to-hidden / snap-to-visible.
const SETTLE_CONFIG = { duration: 180, easing: Easing.out(Easing.cubic) };

/** Ignore sub-pixel scroll jitter so the bar doesn't flicker while idle. */
const DELTA_THRESHOLD = 14;

/** Near the top the bar is always shown, so a short list can never hide it. */
const TOP_ZONE = 30;

/**
 * Force the bar back into view. Called on tab focus so it's impossible to
 * land on a screen with the bar stuck off-screen from a previous scroll.
 */
export function showTabBar() {
  tabBarTranslateY.value = withTiming(0, SETTLE_CONFIG);
}

/**
 * The maximum distance (dp) the bar can tuck down. Must be set by the bar
 * component itself (it knows its own height + float offset + insets).
 * Default covers the 48-pt bar with generous clearance.
 */
export const tabBarHideDistance = makeMutable(100);

/**
 * Returns an `onScroll` handler for a screen's Animated.ScrollView.
 *
 * Unlike the previous binary 0/1 approach, this **accumulates** the raw
 * scroll delta into `tabBarTranslateY`, clamped to [0, hideDistance].
 * When the user lifts their finger or changes direction, a short timing
 * animation snaps the bar fully hidden or fully visible (whichever is
 * closer) so it never sits half-way.
 */
export function useTabBarScrollHandler() {
  const lastY = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  // Tracks whether we last scrolled down or up — used to pick snap direction.
  const lastDirection = useSharedValue(0); // +1 = down, -1 = up

  return useAnimatedScrollHandler(
    {
      onScroll: (event) => {
        'worklet';
        const y = event.contentOffset.y;
        const dy = y - lastY.value;
        lastY.value = y;

        // Hiding the bar is itself motion — under "Reduce Motion" the bar
        // simply stays put rather than sliding around.
        if (reduceMotion) {
          tabBarTranslateY.value = 0;
          return;
        }

        // Near the top → always visible.
        if (y <= TOP_ZONE) {
          tabBarTranslateY.value = withTiming(0, SETTLE_CONFIG);
          lastDirection.value = 0;
          return;
        }

        // Sub-threshold jitter → ignore.
        if (Math.abs(dy) < 2) return;

        const hideDistance = tabBarHideDistance.value;
        const direction = dy > 0 ? 1 : -1;

        // Accumulate translation proportionally to the scroll delta.
        // Multiplying by 1.2 makes the bar feel like it's tracking the
        // finger rather than lagging behind it.
        const raw = tabBarTranslateY.value + dy * 1.2;
        const clamped = Math.min(Math.max(raw, 0), hideDistance);
        tabBarTranslateY.value = clamped;

        // Record direction for the settle snap.
        if (Math.abs(dy) > DELTA_THRESHOLD) {
          lastDirection.value = direction;
        }
      },

      onEndDrag: () => {
        'worklet';
        if (reduceMotion) return;
        // Snap to fully hidden or visible based on last scroll direction.
        const target = lastDirection.value > 0 ? tabBarHideDistance.value : 0;
        tabBarTranslateY.value = withTiming(target, SETTLE_CONFIG);
      },

      onMomentumEnd: () => {
        'worklet';
        if (reduceMotion) return;
        // Same snap after momentum scroll settles.
        const target = lastDirection.value > 0 ? tabBarHideDistance.value : 0;
        tabBarTranslateY.value = withTiming(target, SETTLE_CONFIG);
      },
    },
    [reduceMotion]
  );
}
