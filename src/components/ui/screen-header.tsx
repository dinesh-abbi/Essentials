import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { Colors, HitTarget, Radius, Spacing, Type } from '@/constants/theme';

/**
 * Header for pushed (non-tab) screens: a hairline back circle, a bracket
 * label, and an optional trailing action. Deliberately no title bar fill —
 * the screen's own headline does that job below it.
 */
export function ScreenHeader({
  bracket,
  onBack,
  icon = 'arrow-left',
  right,
}: {
  bracket: string;
  onBack?: () => void;
  icon?: 'arrow-left' | 'x' | 'chevron-down';
  right?: React.ReactNode;
}) {
  const router = useRouter();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];

  const back = () => {
    if (onBack) return onBack();
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)' as any);
  };

  return (
    <View style={styles.row}>
      <AnimatedPressable
        onPress={back}
        haptic="light"
        style={[styles.circle, { borderColor: colors.hairline, backgroundColor: colors.surface }]}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <Feather name={icon} size={19} color={colors.textHi} />
      </AnimatedPressable>
      <Text style={[Type.bracketLabel, styles.label, { color: colors.textMid }]} numberOfLines={1}>
        {bracket}
      </Text>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

/** A secondary round icon button matching the header's back circle. */
export function HeaderIconButton({
  icon,
  onPress,
  accessibilityLabel,
  disabled,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  onPress: () => void;
  accessibilityLabel: string;
  disabled?: boolean;
}) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];
  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      haptic="light"
      style={[
        styles.circle,
        { borderColor: colors.hairline, backgroundColor: colors.surface, opacity: disabled ? 0.4 : 1 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Feather name={icon} size={18} color={colors.textHi} />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two },
  circle: {
    width: HitTarget,
    height: HitTarget,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { flex: 1 },
  right: { flexDirection: 'row', gap: Spacing.two },
});
