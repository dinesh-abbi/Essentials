import { StyleSheet, Text, View } from 'react-native';

import { IconBlob, Tile, type IconName } from '@/components/ui/chunky';
import { Colors, FontFace, Type, type HueName } from '@/constants/theme';

const C = Colors.dark;

/**
 * One fact as a small tinted tile: icon blob, a dot-matrix number, a two-word
 * label. Lay them out two-up with `StatGrid`.
 */
export function StatTile({
  icon,
  hue,
  value,
  label,
  prefix,
  onPress,
}: {
  icon: IconName;
  hue: HueName;
  value: string;
  label: string;
  /** Rendered in Nunito before the number (Doto has no ₹). */
  prefix?: string;
  onPress?: () => void;
}) {
  return (
    <Tile hue={hue} containerStyle={styles.box} style={styles.face} onPress={onPress} accessibilityLabel={`${label}: ${prefix ?? ''}${value}`}>
      <IconBlob name={icon} hue={hue} size={34} />
      <View style={styles.valueRow}>
        {prefix ? <Text style={[styles.prefix, { color: C.textHi }]}>{prefix}</Text> : null}
        <Text style={[Type.dotNumber, styles.value, { color: C.textHi }]} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
      </View>
      <Text style={[Type.subline, { color: C.textMid }]} numberOfLines={1}>
        {label}
      </Text>
    </Tile>
  );
}

/** Two-column wrap for StatTiles. */
export function StatGrid({ children }: { children: React.ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 6 },
  box: { width: '48.8%' },
  face: { gap: 6 },
  valueRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, marginTop: 4 },
  value: { fontSize: 28, lineHeight: 34, flexShrink: 1 },
  prefix: { fontFamily: FontFace.displayBold, fontSize: 20, lineHeight: 30 },
});
