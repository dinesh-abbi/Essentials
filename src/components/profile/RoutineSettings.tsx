import { Feather } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Switch, Text, TextInput, View, useColorScheme } from 'react-native';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import * as Body from '@/utils/BodyStorage';
import * as Coach from '@/utils/Coach';
import { rescheduleRoutineReminders } from '@/utils/notifications';
import * as Prefs from '@/utils/Preferences';

type Palette = typeof Colors.dark;

/**
 * The Profile sections added with the Catalyst merge: body metrics, the
 * training/meal/restock reminder switches, the whole-app lock and the
 * coach's status. Self-contained so profile.tsx only mounts it.
 */
export function RoutineSettings() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme] as Palette;

  const [body, setBody] = useState<Body.BodyMetrics>(Body.EMPTY_BODY);
  const [draft, setDraft] = useState<Record<keyof Omit<Body.BodyMetrics, 'updatedAt'>, string>>({
    weightKg: '',
    heightCm: '',
    age: '',
    targetWeightKg: '',
  });
  const [savingBody, setSavingBody] = useState(false);
  const [reminders, setReminders] = useState<Prefs.ReminderPrefs>(Prefs.DEFAULT_REMINDERS);
  const [lock, setLock] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const [b, r, l] = await Promise.all([Body.getBody(), Prefs.getReminderPrefs(), Prefs.isAppLockEnabled()]);
        setBody(b);
        setDraft({
          weightKg: b.weightKg ? String(b.weightKg) : '',
          heightCm: b.heightCm ? String(b.heightCm) : '',
          age: b.age ? String(b.age) : '',
          targetWeightKg: b.targetWeightKg ? String(b.targetWeightKg) : '',
        });
        setReminders(r);
        setLock(l);
      })();
    }, []),
  );

  const dirty =
    (Body.parseMetric(draft.weightKg) ?? null) !== body.weightKg ||
    (Body.parseMetric(draft.heightCm) ?? null) !== body.heightCm ||
    (Body.parseMetric(draft.age) ?? null) !== body.age ||
    (Body.parseMetric(draft.targetWeightKg) ?? null) !== body.targetWeightKg;

  const saveBody = async () => {
    setSavingBody(true);
    try {
      const age = Body.parseMetric(draft.age);
      const next = await Body.saveBody({
        weightKg: Body.parseMetric(draft.weightKg),
        heightCm: Body.parseMetric(draft.heightCm),
        age: age ? Math.round(age) : null,
        targetWeightKg: Body.parseMetric(draft.targetWeightKg),
      });
      setBody(next);
    } catch {
      Alert.alert('Couldn’t save', 'Your body metrics weren’t saved. Try again.');
    } finally {
      setSavingBody(false);
    }
  };

  const toggleReminder = async (key: keyof Prefs.ReminderPrefs, value: boolean) => {
    const next = { ...reminders, [key]: value };
    setReminders(next);
    await Prefs.setReminderPrefs(next);
    rescheduleRoutineReminders().catch(() => {});
  };

  const toggleLock = async (value: boolean) => {
    if (value) {
      const [hw, enrolled] = await Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync()]);
      if (!hw || !enrolled) {
        Alert.alert('No biometrics set up', 'Enrol a fingerprint or face in your phone’s settings first.');
        return;
      }
      const res = await LocalAuthentication.authenticateAsync({ promptMessage: 'Turn on app lock' });
      if (!res.success) return;
    }
    setLock(value);
    await Prefs.setAppLockEnabled(value);
  };

  const bmi = Body.bmi(body);
  const toGo = Body.toTarget(body);

  return (
    <View style={styles.wrap}>
      {/* ── Body ─────────────────────────────────────────────────────── */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
        <View style={styles.cardHead}>
          <Text style={[Type.bracketLabel, { color: colors.water }]}>[ BODY ]</Text>
          <Text style={[Type.subline, { color: colors.textMid }]}>
            {bmi ? `BMI ${bmi}` : 'Used by the coach'}
            {toGo !== null && toGo !== 0 ? `  ·  ${toGo > 0 ? '+' : ''}${toGo} kg to target` : ''}
          </Text>
        </View>
        <View style={styles.metricGrid}>
          <Metric label="WEIGHT" unit="kg" value={draft.weightKg} onChange={(v) => setDraft((d) => ({ ...d, weightKg: v }))} colors={colors} />
          <Metric label="TARGET" unit="kg" value={draft.targetWeightKg} onChange={(v) => setDraft((d) => ({ ...d, targetWeightKg: v }))} colors={colors} />
          <Metric label="HEIGHT" unit="cm" value={draft.heightCm} onChange={(v) => setDraft((d) => ({ ...d, heightCm: v }))} colors={colors} />
          <Metric label="AGE" unit="yrs" value={draft.age} onChange={(v) => setDraft((d) => ({ ...d, age: v }))} colors={colors} integer />
        </View>
        {dirty && (
          <AnimatedPressable
            onPress={saveBody}
            disabled={savingBody}
            haptic="medium"
            style={[styles.save, { backgroundColor: colors.water }]}
            accessibilityRole="button"
          >
            {savingBody ? <ActivityIndicator color={colors.onAccent} /> : <Text style={[Type.controlLabel, { color: colors.onAccent }]}>Save</Text>}
          </AnimatedPressable>
        )}
      </View>

      {/* ── Reminders + lock ─────────────────────────────────────────── */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
        <Text style={[Type.bracketLabel, { color: colors.water }]}>[ ROUTINE ]</Text>
        <SwitchRow
          title="Training wake-ups"
          detail="06:00 and 07:00 on training days"
          value={reminders.training}
          onChange={(v) => toggleReminder('training', v)}
          colors={colors}
        />
        <SwitchRow
          title="Meal times"
          detail="08:30 · 13:30 · 17:30 · 20:30"
          value={reminders.meals}
          onChange={(v) => toggleReminder('meals', v)}
          colors={colors}
        />
        <SwitchRow
          title="Restock day"
          detail="07:30 on plan days 1, 8, 15, 22"
          value={reminders.restock}
          onChange={(v) => toggleReminder('restock', v)}
          colors={colors}
        />
        <SwitchRow
          title="App lock"
          detail="Fingerprint or face to open Essentials"
          value={lock}
          onChange={toggleLock}
          colors={colors}
          last
        />
      </View>

      {/* ── Coach status ─────────────────────────────────────────────── */}
      <View style={[styles.coachRow, { borderColor: colors.hairline }]}>
        <Feather name={Coach.isConfigured() ? 'check-circle' : 'alert-circle'} size={16} color={Coach.isConfigured() ? colors.water : colors.warn} />
        <Text style={[Type.subline, { color: colors.textMid, flex: 1 }]}>
          {Coach.isConfigured()
            ? 'Coach connected (Gemini). Chat, meal scans and split imports are on.'
            : 'Coach off — set EXPO_PUBLIC_GEMINI_API_KEY in .env and rebuild.'}
        </Text>
      </View>
    </View>
  );
}

function Metric({
  label,
  unit,
  value,
  onChange,
  colors,
  integer,
}: {
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
  colors: Palette;
  integer?: boolean;
}) {
  return (
    <View style={[styles.metric, { borderColor: colors.hairline, backgroundColor: colors.bg }]}>
      <Text style={[Type.bracketLabel, { color: colors.textMid }]}>{label}</Text>
      <View style={styles.metricValue}>
        <TextInput
          value={value}
          onChangeText={onChange}
          keyboardType={integer ? 'number-pad' : 'decimal-pad'}
          placeholder="—"
          placeholderTextColor={colors.textLow}
          style={[styles.metricInput, { color: colors.textHi }]}
          accessibilityLabel={`${label.toLowerCase()} in ${unit}`}
          selectTextOnFocus
        />
        <Text style={[Type.subline, { color: colors.textMid }]}>{unit}</Text>
      </View>
    </View>
  );
}

function SwitchRow({
  title,
  detail,
  value,
  onChange,
  colors,
  last,
}: {
  title: string;
  detail: string;
  value: boolean;
  onChange: (v: boolean) => void;
  colors: Palette;
  last?: boolean;
}) {
  return (
    <View style={[styles.switchRow, !last && { borderBottomColor: colors.hairline, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[Type.body, { color: colors.textHi }]}>{title}</Text>
        <Text style={[Type.subline, { color: colors.textMid }]}>{detail}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.surface2, true: colors.signalLine }}
        thumbColor={value ? colors.water : colors.textMid}
        accessibilityLabel={title}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.lg, padding: Spacing.three + 2, gap: Spacing.three },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  metric: {
    width: '48.6%',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    gap: 2,
  },
  metricValue: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metricInput: { ...Type.readout, fontSize: 24, padding: 0, includeFontPadding: false, minWidth: 40, flexShrink: 1 },
  save: { height: 48, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two + 2 },
  coachRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    borderRadius: Radius.md,
    padding: Spacing.three,
  },
});
