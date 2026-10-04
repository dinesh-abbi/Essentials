import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { ChunkyButton } from '@/components/ui/chunky';
import { Segmented } from '@/components/ui/segmented';
import { Sheet } from '@/components/ui/sheet';
import { Colors, Hue, Radius, Spacing, Type, type HueName } from '@/constants/theme';

const C = Colors.dark;

/**
 * Pick a date (month of dot cells) or a time (big dot-matrix hour : minute
 * with chunky steppers) in a bottom sheet. Keeps the rest of the Date when
 * changing one half.
 */
export function DateTimeSheet({
  mode,
  visible,
  value,
  onClose,
  onChange,
  hue = 'spend',
  minuteStep = 5,
}: {
  mode: 'date' | 'time';
  visible: boolean;
  value: Date;
  onClose: () => void;
  onChange: (d: Date) => void;
  hue?: HueName;
  /** Arrow step for minutes (alarms want 1). */
  minuteStep?: number;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} bracket={mode === 'date' ? 'Pick a day' : 'Pick a time'} title={mode === 'date' ? 'Which day?' : 'What time?'} heightRatio={mode === 'date' ? 0.7 : 0.55}>
      {/* Re-mount on open so the picker starts from the current value. */}
      {visible ? (
        mode === 'date' ? (
          <DateBody value={value} hue={hue} onPick={(d) => (onChange(d), onClose())} />
        ) : (
          <TimeBody value={value} hue={hue} step={minuteStep} onPick={(d) => (onChange(d), onClose())} />
        )
      ) : null}
    </Sheet>
  );
}

function DateBody({ value, hue, onPick }: { value: Date; hue: HueName; onPick: (d: Date) => void }) {
  const [nav, setNav] = useState(() => new Date(value.getFullYear(), value.getMonth(), 1));
  const y = nav.getFullYear();
  const m = nav.getMonth();
  const lead = (new Date(y, m, 1).getDay() + 6) % 7;
  const days = new Date(y, m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const today = new Date();
  const set = Hue[hue];

  return (
    <View style={styles.body}>
      <View style={styles.nav}>
        <ChunkyButton icon="chevron-left" variant="soft" hue={hue} size="sm" haptic="selection" onPress={() => setNav(new Date(y, m - 1, 1))} accessibilityLabel="Previous month" />
        <Text style={[Type.title, styles.navTitle, { color: C.textHi }]}>
          {nav.toLocaleString('default', { month: 'long' })} {y}
        </Text>
        <ChunkyButton icon="chevron-right" variant="soft" hue={hue} size="sm" haptic="selection" onPress={() => setNav(new Date(y, m + 1, 1))} accessibilityLabel="Next month" />
      </View>
      <View style={styles.row}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <Text key={i} style={[Type.dotLabel, styles.head, { color: C.textLow }]}>
            {d}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((d, i) => {
          if (d === null) return <View key={`e${i}`} style={styles.cell} />;
          const sel = value.getFullYear() === y && value.getMonth() === m && value.getDate() === d;
          const isToday = today.getFullYear() === y && today.getMonth() === m && today.getDate() === d;
          return (
            <AnimatedPressable
              key={d}
              onPress={() => {
                const next = new Date(value);
                next.setFullYear(y, m, d);
                onPick(next);
              }}
              haptic="selection"
              pressScale={0.85}
              style={styles.cell}
              accessibilityRole="button"
              accessibilityLabel={`${d}`}
            >
              <View
                style={[
                  styles.dot,
                  { backgroundColor: sel ? set.main : C.bg },
                  isToday && !sel && { borderWidth: 2, borderColor: set.main },
                ]}
              >
                <Text style={[Type.badge, { color: sel ? set.on : C.textHi, fontSize: 13 }]}>{d}</Text>
              </View>
            </AnimatedPressable>
          );
        })}
      </View>
    </View>
  );
}

function TimeBody({ value, hue, step, onPick }: { value: Date; hue: HueName; step: number; onPick: (d: Date) => void }) {
  const [h24, setH24] = useState(value.getHours());
  const [min, setMin] = useState(value.getMinutes());
  const period: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 || 12;

  return (
    <View style={styles.body}>
      <View style={styles.time}>
        <TimeCol hue={hue} label="Hour" v={String(h12).padStart(2, '0')} up={() => setH24((h) => (h + 1) % 24)} down={() => setH24((h) => (h + 23) % 24)} />
        <Text style={[Type.dotHero, { color: C.textMid }]}>:</Text>
        <TimeCol hue={hue} label="Minute" v={String(min).padStart(2, '0')} up={() => setMin((x) => (x + step) % 60)} down={() => setMin((x) => (x + 60 - step) % 60)} />
      </View>
      <View style={styles.quick}>
        {[0, 15, 30, 45].map((q) => (
          <ChunkyButton key={q} label={':' + String(q).padStart(2, '0')} hue={hue} variant={min === q ? 'solid' : 'soft'} size="sm" haptic="selection" style={styles.quickBtn} onPress={() => setMin(q)} />
        ))}
      </View>
      <Segmented
        hue={hue}
        value={period}
        onChange={(p) => setH24((h) => (p === 'PM' ? (h < 12 ? h + 12 : h) : h >= 12 ? h - 12 : h))}
        options={[
          { value: 'AM', label: 'AM', icon: 'weather-sunny' },
          { value: 'PM', label: 'PM', icon: 'weather-night' },
        ]}
      />
      <ChunkyButton
        label="Set time"
        icon="check-bold"
        hue={hue}
        onPress={() => {
          const next = new Date(value);
          next.setHours(h24, min, 0, 0);
          onPick(next);
        }}
      />
    </View>
  );
}

function TimeCol({ hue, label, v, up, down }: { hue: HueName; label: string; v: string; up: () => void; down: () => void }) {
  return (
    <View style={styles.col}>
      <ChunkyButton icon="chevron-up" variant="soft" hue={hue} size="md" haptic="selection" onPress={up} accessibilityLabel={label + " up"} />
      <Text style={[Type.dotHero, { color: C.textHi }]}>{v}</Text>
      <ChunkyButton icon="chevron-down" variant="soft" hue={hue} size="md" haptic="selection" onPress={down} accessibilityLabel={label + " down"} />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: Spacing.four, gap: 12 },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navTitle: { flex: 1, textAlign: 'center' },
  row: { flexDirection: 'row' },
  head: { width: `${100 / 7}%`, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dot: { width: '84%', aspectRatio: 1, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  time: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  col: { alignItems: 'center', gap: 6 },
  quick: { flexDirection: 'row', gap: 8 },
  quickBtn: { flex: 1 },
});
