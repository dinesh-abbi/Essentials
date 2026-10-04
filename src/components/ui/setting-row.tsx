import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { IconBlob, type IconName } from '@/components/ui/chunky';
import { Colors, Type, type HueName } from '@/constants/theme';

const C = Colors.dark;

/**
 * A settings row, One UI style: a coloured squircle icon first (so the row is
 * found by colour), then a bold title and a short value, then a chevron or a
 * control. Rows sit inside a grouped `Tile`.
 */
export function SettingRow({
  icon,
  hue,
  title,
  value,
  onPress,
  trailing,
  badge,
  last,
}: {
  icon: IconName;
  hue: HueName;
  title: string;
  value?: string;
  onPress?: () => void;
  trailing?: ReactNode;
  /** Red "attention" dot (Nothing-style). */
  badge?: boolean;
  last?: boolean;
}) {
  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={!onPress}
      haptic="light"
      pressScale={0.98}
      style={[styles.row, !last && { borderBottomColor: C.hairline, borderBottomWidth: StyleSheet.hairlineWidth }]}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={value ? `${title}. ${value}` : title}
    >
      <IconBlob name={icon} hue={hue} size={38} />
      <View style={styles.text}>
        <Text style={[Type.controlLabel, { color: C.textHi }]} numberOfLines={1}>
          {title}
        </Text>
        {value ? (
          <Text style={[Type.subline, { color: C.textMid }]} numberOfLines={1}>
            {value}
          </Text>
        ) : null}
      </View>
      {badge ? <View style={[styles.badgeDot, { backgroundColor: C.alert }]} /> : null}
      {trailing ?? (onPress ? <MaterialCommunityIcons name="chevron-right" size={22} color={C.textLow} /> : null)}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, minHeight: 64 },
  text: { flex: 1 },
  badgeDot: { width: 9, height: 9, borderRadius: 5 },
});
