import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { Colors, HitTarget, Motion, Radius, Spacing, Type } from '@/constants/theme';

const SCREEN_H = Dimensions.get('window').height;
const OPEN_SPRING = { damping: 26, stiffness: 260, mass: 0.9 };

/**
 * The bottom sheet every new flow uses (restock list, meal scan, split
 * import, anatomy, cycle alignment). `bg` panel on a dimmed backdrop, one
 * hairline edge, a bracket label as its title — no shadow, per the design
 * system. Drag the grabber/header down, tap the backdrop or press Android
 * back to dismiss; the panel tracks the finger on the UI thread and either
 * springs home or leaves based on distance and velocity.
 *
 * Children own their own scrolling — the sheet only sizes itself.
 */
export function Sheet({
  visible,
  onClose,
  bracket,
  title,
  heightRatio = 0.86,
  dismissable = true,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  bracket: string;
  title?: string;
  /** Fraction of the window height the panel occupies. */
  heightRatio?: number;
  /** Set false while a request is in flight so the sheet can't be closed mid-write. */
  dismissable?: boolean;
  children: React.ReactNode;
}) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const panelHeight = Math.round(SCREEN_H * heightRatio);

  // Stay mounted through the exit animation; unmount from its completion.
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);

  const y = useSharedValue(panelHeight);
  const backdrop = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      y.value = reduceMotion ? 0 : withSpring(0, OPEN_SPRING);
      backdrop.value = withTiming(1, { duration: Motion.duration.screen });
    } else {
      backdrop.value = withTiming(0, { duration: Motion.duration.fast + 60 });
      y.value = withTiming(panelHeight, { duration: reduceMotion ? 0 : 220, easing: Easing.in(Easing.cubic) }, (done) => {
        if (done) runOnJS(setMounted)(false);
      });
    }
  }, [visible, reduceMotion, panelHeight, y, backdrop]);

  const requestClose = () => {
    if (dismissable) onClose();
  };

  const drag = useMemo(
    () =>
      Gesture.Pan()
        .enabled(dismissable)
        .activeOffsetY(8)
        .failOffsetX([-16, 16])
        .onUpdate((e) => {
          y.value = Math.max(0, e.translationY);
        })
        .onEnd((e) => {
          if (e.translationY > panelHeight * 0.22 || e.velocityY > 900) {
            runOnJS(onClose)();
          } else {
            y.value = withSpring(0, OPEN_SPRING);
          }
        }),
    [dismissable, panelHeight, onClose, y],
  );

  const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={requestClose}>
      <GestureHandlerRootView style={styles.flex}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={requestClose} accessibilityLabel="Close" />
        </Animated.View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.anchor} pointerEvents="box-none">
          <Animated.View
            style={[
              styles.panel,
              { height: panelHeight, backgroundColor: colors.surface, borderColor: colors.hairline, paddingBottom: insets.bottom },
              panelStyle,
            ]}
          >
            <GestureDetector gesture={drag}>
              <View style={styles.header}>
                <View style={[styles.grabber, { backgroundColor: colors.textLow }]} />
                <View style={styles.headerRow}>
                  <View style={styles.headerText}>
                    <Text style={[Type.dotLabel, { color: colors.water }]}>{bracket.replace(/^\[\s*|\s*\]$/g, '')}</Text>
                    {title ? (
                      <Text style={[Type.title, { color: colors.textHi }]} numberOfLines={1}>
                        {title}
                      </Text>
                    ) : null}
                  </View>
                  <AnimatedPressable
                    onPress={requestClose}
                    disabled={!dismissable}
                    haptic="light"
                    style={[styles.close, { backgroundColor: colors.surface2, opacity: dismissable ? 1 : 0.4 }]}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                  >
                    <MaterialCommunityIcons name="close" size={20} color={colors.textHi} />
                  </AnimatedPressable>
                </View>
              </View>
            </GestureDetector>
            <View style={styles.flex}>{children}</View>
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.6)' },
  anchor: { flex: 1, justifyContent: 'flex-end' },
  panel: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  header: { paddingHorizontal: Spacing.four, paddingTop: Spacing.two, paddingBottom: Spacing.three },
  grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, marginBottom: Spacing.three },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three },
  headerText: { flex: 1, gap: Spacing.one },
  close: {
    width: HitTarget,
    height: HitTarget,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
