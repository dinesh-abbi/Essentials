import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { LiveDot } from '@/components/ui/dots';
import { Colors, Spacing, Type } from '@/constants/theme';

/**
 * The tab-screen header, One UI style: an airy title area so the big title
 * sits low (and the content below lands in thumb reach), with a dot-matrix
 * eyebrow above it and round actions on the right.
 */
export function LargeHeader({
  eyebrow,
  title,
  live,
  right,
  children,
}: {
  /** Tiny dot-matrix line above the title — a date, a day count. */
  eyebrow?: string;
  title: string;
  /** Show the red "live" dot before the eyebrow. */
  live?: boolean;
  right?: ReactNode;
  /** Optional line under the title. */
  children?: ReactNode;
}) {
  const c = Colors.dark;
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.text}>
          {eyebrow ? (
            <View style={styles.eyebrow}>
              {live ? <LiveDot size={7} /> : null}
              <Text style={[Type.dotLabel, { color: c.textMid }]} numberOfLines={1}>
                {eyebrow}
              </Text>
            </View>
          ) : null}
          <Text style={[Type.largeTitle, { color: c.textHi }]} numberOfLines={1} adjustsFontSizeToFit>
            {title}
          </Text>
        </View>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: Spacing.six - Spacing.three, paddingBottom: Spacing.four, gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.three },
  text: { flex: 1, gap: Spacing.one },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  right: { flexDirection: 'row', gap: Spacing.two, paddingBottom: 2 },
});
