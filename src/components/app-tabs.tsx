import React, { useEffect } from 'react';
import { View, StyleSheet, useColorScheme, Dimensions } from 'react-native';
import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import Animated, {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  useReducedMotion,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { Colors, Motion, Radius, Spacing, TabBar } from '@/constants/theme';
import { tabBarTranslateY, tabBarHideDistance } from '@/utils/tabBarVisibility';

const { width: windowWidth } = Dimensions.get('window');

// ── Compact bar sizing ────────────────────────────────────────────────────────
// Only two visible tabs (Home + Profile) → the bar is a tight floating pill.
const MAX_BAR_WIDTH = 220;
export const TAB_BAR_HEIGHT = TabBar.height;
const PADDING = 5;
const FLOAT_OFFSET = TabBar.floatOffset;

// Routes that should NEVER appear in the tab bar
const HIDDEN_ROUTES = new Set(['explore']);

/**
 * The floating nav pill — minimal, per the design thesis. `bg` fill, one
 * `hairline` border, no shadow (this system has none). The active tab is
 * marked two ways: `water` (the ONE accent in the whole app, spent nowhere
 * else in the nav) tints the icon, and a quiet `surface2` lozenge slides
 * behind it. Inactive icons are `textMid` — `textLow` only reaches 2.7:1 as a
 * graphic here, under the 3:1 floor, so it can't be used on this surface.
 *
 * Icon-only: with two tabs and unambiguous glyphs a text label would be
 * redundant chrome; `accessibilityLabel` still carries the name for screen
 * readers.
 */
function CustomTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];

  // Filter out hidden routes by name — reliable across expo-router versions
  const visibleRoutes = state.routes.filter(
    (route: any) => !HIDDEN_ROUTES.has(route.name)
  );

  const activeIndex = visibleRoutes.findIndex(
    (r: any) => r.name === state.routes[state.index].name
  );

  const containerWidth = Math.min(windowWidth - Spacing.four * 2, MAX_BAR_WIDTH);
  const totalTabs = visibleRoutes.length;
  const tabWidth = (containerWidth - PADDING * 2) / totalTabs;

  const indicatorOffset = useSharedValue(activeIndex !== -1 ? activeIndex * tabWidth + PADDING : 0);

  useEffect(() => {
    if (activeIndex === -1) return;
    const target = activeIndex * tabWidth + PADDING;
    // Precise, not bouncy — a short ease rather than a spring, matching the
    // rest of this system's motion.
    indicatorOffset.value = reduceMotion
      ? target
      : withTiming(target, { duration: Motion.duration.fast, easing: Easing.out(Easing.cubic) });
  }, [activeIndex, tabWidth, reduceMotion, indicatorOffset]);

  const animatedIndicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorOffset.value }],
  }));

  const bottomPosition = insets.bottom + FLOAT_OFFSET;

  const hideDistance = TAB_BAR_HEIGHT + FLOAT_OFFSET + insets.bottom + 12;
  useEffect(() => {
    tabBarHideDistance.value = hideDistance;
  }, [hideDistance]);

  const revealStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: tabBarTranslateY.value }],
    opacity: interpolate(
      tabBarTranslateY.value,
      [0, hideDistance * 0.6, hideDistance],
      [1, 0.7, 0],
      'clamp',
    ),
  }));

  // Final beat of the entrance sequence (greeting → hero → cards → nav).
  // `entering` fires on mount only, and the bar is mounted by the navigator
  // rather than by a screen, so this does not replay on every tab switch.
  const enteringOpacity = useSharedValue(reduceMotion ? 1 : 0);
  const enteringY = useSharedValue(reduceMotion ? 0 : Motion.entranceOffset);
  useEffect(() => {
    if (reduceMotion) return;
    enteringOpacity.value = withTiming(1, {
      duration: Motion.duration.entrance,
      easing: Easing.out(Easing.cubic),
    });
    enteringY.value = withTiming(0, {
      duration: Motion.duration.entrance,
      easing: Easing.out(Easing.cubic),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const enteringStyle = useAnimatedStyle(() => ({
    opacity: enteringOpacity.value,
    transform: [{ translateY: enteringY.value }],
  }));

  return (
    <Animated.View
      style={[styles.absoluteContainer, { bottom: bottomPosition }, revealStyle, enteringStyle]}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.tabBarContainer,
          { width: containerWidth, backgroundColor: colors.bg, borderColor: colors.hairline },
        ]}
      >
        <Animated.View
          style={[
            styles.activeIndicator,
            animatedIndicatorStyle,
            { width: tabWidth - PADDING * 2, backgroundColor: colors.surface2 },
          ]}
          pointerEvents="none"
        />

        {/* Tab buttons */}
        {visibleRoutes.map((route: any, index: number) => {
          const isFocused = activeIndex === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <AnimatedPressable
              key={route.key}
              onPress={onPress}
              haptic="light"
              style={styles.tabBtn}
              accessibilityRole="button"
              accessibilityState={{ selected: isFocused }}
              accessibilityLabel={descriptors?.[route.key]?.options?.title ?? route.name}
            >
              <Feather
                name={getIconName(route.name)}
                size={21}
                color={isFocused ? colors.water : colors.textMid}
              />
            </AnimatedPressable>
          );
        })}
      </View>
    </Animated.View>
  );
}

function getIconName(routeName: string): any {
  switch (routeName) {
    case 'index':   return 'home';
    case 'profile': return 'user';
    default:        return 'home';
  }
}

export default function AppTabs() {
  return (
    <Tabs tabBar={(props) => <CustomTabBar {...props} />}>
      <Tabs.Screen
        name="index"
        options={{
          headerShown: false,
          title: 'Home',
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          headerShown: false,
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          headerShown: false,
          title: 'Profile',
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  absoluteContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 99,
  },
  tabBarContainer: {
    height: TAB_BAR_HEIGHT,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: PADDING,
    // No shadow — this system has none; the pill separates from the page by
    // its hairline border alone, same as every card.
  },
  activeIndicator: {
    position: 'absolute',
    top: PADDING,
    bottom: PADDING,
    left: PADDING,
    borderRadius: Radius.pill,
  },
  tabBtn: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
