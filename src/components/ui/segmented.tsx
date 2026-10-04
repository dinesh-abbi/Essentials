import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import type { IconName } from '@/components/ui/chunky';
import { Colors, Hue, Motion, Radius, Type, type HueName } from '@/constants/theme';

const C = Colors.dark;
const PAD = 4;

/**
 * A pill segmented control (One UI / iOS): the active segment is a hue-filled
 * lozenge that springs between options. Use for Day / Week / Month style
 * switches.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  hue = 'water',
}: {
  options: { value: T; label: string; icon?: IconName }[];
  value: T;
  onChange: (v: T) => void;
  hue?: HueName;
}) {
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const segW = width > 0 ? (width - PAD * 2) / options.length : 0;
  const x = useSharedValue(0);

  useEffect(() => {
    const target = index * segW;
    x.value = reduceMotion ? target : withSpring(target, Motion.spring);
  }, [index, segW, reduceMotion, x]);

  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const set = Hue[hue];

  return (
    <View
      style={[styles.track, { backgroundColor: C.surface }]}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      accessibilityRole="tablist"
    >
      {segW > 0 && <Animated.View style={[styles.pill, { width: segW, backgroundColor: set.main }, pillStyle]} />}
      {options.map((o) => {
        const active = o.value === value;
        const ink = active ? set.on : C.textMid;
        return (
          <AnimatedPressable
            key={o.value}
            onPress={() => onChange(o.value)}
            haptic="selection"
            pressScale={0.95}
            style={styles.seg}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={o.label}
          >
            {o.icon ? <MaterialCommunityIcons name={o.icon} size={16} color={ink} /> : null}
            <Text style={[Type.controlLabel, styles.label, { color: ink }]}>{o.label}</Text>
          </AnimatedPressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', borderRadius: Radius.pill, padding: PAD, height: 48 },
  pill: { position: 'absolute', top: PAD, bottom: PAD, left: PAD, borderRadius: Radius.pill },
  seg: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  label: { fontSize: 14 },
});
