import React, { useEffect } from 'react';
import { View, StyleSheet, Pressable, useColorScheme, Dimensions } from 'react-native';
import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius } from '@/constants/theme';

const { width: windowWidth } = Dimensions.get('window');
const MAX_BAR_WIDTH = 480;
export const TAB_BAR_HEIGHT = 64;
const PADDING = 8;
const FLOAT_OFFSET = 12;

// Routes that should NEVER appear in the tab bar
const HIDDEN_ROUTES = new Set(['explore']);

function CustomTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const isDark = scheme === 'dark';
  const themeColors = Colors[scheme];

  const primary = isDark ? '#6366F1' : '#4F46E5';

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

  const indicatorOffset = useSharedValue(activeIndex !== -1 ? activeIndex * tabWidth : 0);

  useEffect(() => {
    if (activeIndex !== -1) {
      indicatorOffset.value = withSpring(activeIndex * tabWidth, {
        damping: 18,
        stiffness: 140,
        mass: 1,
      });
    }
  }, [activeIndex, tabWidth]);

  const animatedIndicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorOffset.value }],
  }));

  const bottomPosition = insets.bottom + FLOAT_OFFSET;

  // Solid frosted surface — no content bleed, dark/light adaptive
  const surfaceColor = isDark
    ? 'rgba(28, 28, 30, 0.96)'   // near-black with tiny transparency
    : 'rgba(252, 252, 252, 0.96)'; // near-white

  const borderColor = isDark
    ? 'rgba(255, 255, 255, 0.09)'
    : 'rgba(0, 0, 0, 0.08)';

  const pillColor = isDark
    ? 'rgba(255, 255, 255, 0.10)'
    : 'rgba(0, 0, 0, 0.07)';

  return (
    <View
      style={[styles.absoluteContainer, { bottom: bottomPosition }]}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.tabBarContainer,
          {
            width: containerWidth,
            backgroundColor: surfaceColor,
            borderColor,
            shadowColor: isDark ? '#000' : '#6B7280',
          },
        ]}
      >
        {/* Sliding active pill indicator */}
        <Animated.View
          style={[
            styles.activeIndicator,
            animatedIndicatorStyle,
            { width: tabWidth, backgroundColor: pillColor },
          ]}
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
            <TabItemButton
              key={route.key}
              isFocused={isFocused}
              onPress={onPress}
              name={route.name}
              primary={primary}
              textSecondary={themeColors.textSecondary}
            />
          );
        })}
      </View>
    </View>
  );
}

// ─── Individual Tab Button ────────────────────────────────────────────────────
function TabItemButton({ isFocused, onPress, name, primary, textSecondary }: any) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.86, { damping: 14, stiffness: 240 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 14, stiffness: 240 });
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.tabBtn}
    >
      <Animated.View style={[styles.iconWrapper, animatedStyle]}>
        <Feather
          name={getIconName(name)}
          size={22}
          color={isFocused ? primary : textSecondary}
        />
      </Animated.View>
    </Pressable>
  );
}

function getIconName(routeName: string): any {
  switch (routeName) {
    case 'index':   return 'home';
    case 'profile': return 'user';
    default:        return 'home'; // fallback — should never be reached
  }
}

// Bottom padding screens should add: bar height + float offset + buffer
export const TAB_BAR_BOTTOM_INSET = TAB_BAR_HEIGHT + FLOAT_OFFSET + 8;

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
    borderRadius: Radius.xl,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: PADDING,
    // Elevation for subtle lift, no content bleed
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 10,
    overflow: 'hidden',
  },
  activeIndicator: {
    position: 'absolute',
    top: PADDING,
    bottom: PADDING,
    left: PADDING,
    borderRadius: Radius.lg,
  },
  tabBtn: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
    borderRadius: 22,
  },
});
