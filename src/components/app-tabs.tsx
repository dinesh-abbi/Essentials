import React, { useEffect } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import type { IconName } from '@/components/ui/chunky';
import { Colors, FontFace, Hue, Lip, Motion, NeutralTile, Radius, Spacing, TabBar, type HueName } from '@/constants/theme';
import { tabBarHideDistance, tabBarTranslateY } from '@/utils/tabBarVisibility';

const { width: windowWidth } = Dimensions.get('window');

// ── Bar sizing ────────────────────────────────────────────────────────────────
// Four tabs (Home · Train · Fuel · You), each a fixed slot so the pill stays
// compact and centred instead of stretching edge-to-edge.
const TAB_SLOT = 78;
export const TAB_BAR_HEIGHT = TabBar.height;
const PADDING = 6;
const FLOAT_OFFSET = TabBar.floatOffset;

// Routes that should never appear in the tab bar (none today).
const HIDDEN_ROUTES = new Set<string>([]);

const TABS: Record<string, { icon: IconName; label: string; hue: HueName }> = {
  index: { icon: 'home-variant', label: 'Home', hue: 'water' },
  train: { icon: 'dumbbell', label: 'Train', hue: 'train' },
  fuel: { icon: 'food-apple', label: 'Fuel', hue: 'fuel' },
  profile: { icon: 'account-circle', label: 'You', hue: 'profile' },
};

/**
 * The floating tab bar. Each tab wears its area's hue (the same colour as its
 * tiles on Home), so the bar doubles as a colour key for the whole app. The
 * active tab gets a hue-tinted lozenge that springs between slots, its icon
 * pops, and its label lights up. The bar is a chunky surface with the same
 * darker lip as every tile.
 */
function CustomTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const colors = Colors.dark;

  const visibleRoutes = state.routes.filter((route: any) => !HIDDEN_ROUTES.has(route.name));
  const activeIndex = visibleRoutes.findIndex((r: any) => r.name === state.routes[state.index].name);
  const totalTabs = visibleRoutes.length;
  const containerWidth = Math.min(windowWidth - Spacing.four * 2, TAB_SLOT * totalTabs + PADDING * 2);
  const tabWidth = (containerWidth - PADDING * 2) / totalTabs;

  const indicatorOffset = useSharedValue(activeIndex !== -1 ? activeIndex * tabWidth + PADDING : 0);
  useEffect(() => {
    if (activeIndex === -1) return;
    const target = activeIndex * tabWidth + PADDING;
    indicatorOffset.value = reduceMotion ? target : withSpring(target, Motion.spring);
  }, [activeIndex, tabWidth, reduceMotion, indicatorOffset]);
  const animatedIndicatorStyle = useAnimatedStyle(() => ({ transform: [{ translateX: indicatorOffset.value }] }));

  const activeHue = Hue[TABS[visibleRoutes[activeIndex]?.name]?.hue ?? 'water'];

  const bottomPosition = insets.bottom + FLOAT_OFFSET;
  const hideDistance = TAB_BAR_HEIGHT + Lip + FLOAT_OFFSET + insets.bottom + 12;
  useEffect(() => {
    tabBarHideDistance.value = hideDistance;
  }, [hideDistance]);

  const revealStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: tabBarTranslateY.value }],
    opacity: interpolate(tabBarTranslateY.value, [0, hideDistance * 0.6, hideDistance], [1, 0.7, 0], 'clamp'),
  }));

  // Final beat of the entrance sequence. The bar is mounted by the navigator,
  // so this doesn't replay on every tab switch.
  const enteringOpacity = useSharedValue(reduceMotion ? 1 : 0);
  const enteringY = useSharedValue(reduceMotion ? 0 : Motion.entranceOffset);
  useEffect(() => {
    if (reduceMotion) return;
    enteringOpacity.value = withTiming(1, { duration: Motion.duration.entrance, easing: Easing.out(Easing.cubic) });
    enteringY.value = withSpring(0, Motion.softSpring);
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
      <View style={{ width: containerWidth, paddingBottom: Lip }}>
        <View style={[styles.lip, { backgroundColor: NeutralTile.tileEdge }]} />
        <View style={[styles.tabBarContainer, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
          <Animated.View
            style={[styles.activeIndicator, animatedIndicatorStyle, { width: tabWidth, backgroundColor: activeHue.soft }]}
            pointerEvents="none"
          />

          {visibleRoutes.map((route: any, index: number) => {
            const isFocused = activeIndex === index;
            const tab = TABS[route.name] ?? TABS.index;
            const onPress = () => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
            };
            return (
              <TabButton
                key={route.key}
                focused={isFocused}
                icon={tab.icon}
                label={tab.label}
                hue={tab.hue}
                onPress={onPress}
                accessibilityLabel={descriptors?.[route.key]?.options?.title ?? tab.label}
              />
            );
          })}
        </View>
      </View>
    </Animated.View>
  );
}

function TabButton({
  focused,
  icon,
  label,
  hue,
  onPress,
  accessibilityLabel,
}: {
  focused: boolean;
  icon: IconName;
  label: string;
  hue: HueName;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const reduceMotion = useReducedMotion();
  const pop = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    pop.value = reduceMotion ? (focused ? 1 : 0) : withSpring(focused ? 1 : 0, Motion.bouncy);
  }, [focused, reduceMotion, pop]);
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pop.value * 0.14 }, { translateY: -pop.value }],
  }));
  const tint = focused ? Hue[hue].main : Colors.dark.textMid;
  return (
    <AnimatedPressable
      onPress={onPress}
      haptic="selection"
      style={styles.tabBtn}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View style={iconStyle}>
        <MaterialCommunityIcons name={icon} size={24} color={tint} />
      </Animated.View>
      <Text style={[styles.label, { color: tint }]}>{label}</Text>
    </AnimatedPressable>
  );
}

export default function AppTabs() {
  return (
    <Tabs tabBar={(props) => <CustomTabBar {...props} />}>
      <Tabs.Screen name="index" options={{ headerShown: false, title: 'Home' }} />
      <Tabs.Screen name="train" options={{ headerShown: false, title: 'Train' }} />
      <Tabs.Screen name="fuel" options={{ headerShown: false, title: 'Fuel' }} />
      <Tabs.Screen name="profile" options={{ headerShown: false, title: 'Profile' }} />
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
  lip: { position: 'absolute', left: 0, right: 0, bottom: 0, top: Lip * 2, borderRadius: Radius.xl },
  tabBarContainer: {
    height: TAB_BAR_HEIGHT,
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: PADDING,
  },
  activeIndicator: {
    position: 'absolute',
    top: PADDING,
    bottom: PADDING,
    left: 0,
    borderRadius: Radius.lg,
  },
  tabBtn: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  label: { fontFamily: FontFace.display, fontSize: 11, lineHeight: 14 },
});
