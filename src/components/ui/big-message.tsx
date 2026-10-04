import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useReducedMotion, ZoomIn } from 'react-native-reanimated';

import { IconBlob, type IconName } from '@/components/ui/chunky';
import { Colors, Spacing, Type, type HueName } from '@/constants/theme';

const C = Colors.dark;

/**
 * A full-screen moment: one big picture, a short title, one line, and an
 * action. Used for permission asks, empty screens and errors.
 */
export function BigMessage({
  icon,
  hue,
  title,
  text,
  children,
}: {
  icon: IconName;
  hue: HueName;
  title: string;
  text?: string;
  children?: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <View style={styles.wrap}>
      <Animated.View entering={reduceMotion ? undefined : ZoomIn.springify().damping(12)}>
        <IconBlob name={icon} hue={hue} size={104} />
      </Animated.View>
      <Text style={[Type.headline, styles.center, { color: C.textHi }]}>{title}</Text>
      {text ? <Text style={[Type.body, styles.center, { color: C.textMid }]}>{text}</Text> : null}
      {children ? <View style={styles.actions}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: Spacing.four },
  center: { textAlign: 'center' },
  actions: { alignSelf: 'stretch', gap: 10, marginTop: Spacing.three },
});
