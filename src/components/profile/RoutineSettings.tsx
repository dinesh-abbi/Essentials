import * as LocalAuthentication from 'expo-local-authentication';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { Chip, ChunkyButton, IconBlob, Tile, type IconName } from '@/components/ui/chunky';
import { SettingRow } from '@/components/ui/setting-row';
import { Colors, Hue, Radius, Spacing, Type, type HueName } from '@/constants/theme';
import * as Body from '@/utils/BodyStorage';
import { rescheduleRoutineReminders } from '@/utils/notifications';
import * as Prefs from '@/utils/Preferences';

const C = Colors.dark;

/**
 * The Profile sections added with the Catalyst merge: body metrics as four
 * picture tiles, and the reminder / app-lock switches as One UI rows.
 * Self-contained so profile.tsx only mounts it.
 */
export function RoutineSettings() {
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
      <View style={styles.groupHead}>
        <Text style={[Type.dotLabel, { color: C.textMid }]}>Body</Text>
        <View style={styles.chips}>
          {bmi ? <Chip icon="human" label={`BMI ${bmi}`} hue="profile" /> : null}
          {toGo !== null && toGo !== 0 ? (
            <Chip icon="bullseye-arrow" label={`${toGo > 0 ? '+' : ''}${toGo} kg`} hue="fuel" />
          ) : null}
        </View>
      </View>
      <View style={styles.metricGrid}>
        <Metric icon="scale-bathroom" hue="profile" label="Weight" unit="kg" value={draft.weightKg} onChange={(v) => setDraft((d) => ({ ...d, weightKg: v }))} />
        <Metric icon="bullseye-arrow" hue="fuel" label="Target" unit="kg" value={draft.targetWeightKg} onChange={(v) => setDraft((d) => ({ ...d, targetWeightKg: v }))} />
        <Metric icon="human-male-height" hue="water" label="Height" unit="cm" value={draft.heightCm} onChange={(v) => setDraft((d) => ({ ...d, heightCm: v }))} />
        <Metric icon="cake-variant" hue="alarm" label="Age" unit="yrs" value={draft.age} onChange={(v) => setDraft((d) => ({ ...d, age: v }))} integer />
      </View>
      {dirty && <ChunkyButton label="Save body" icon="check-bold" hue="profile" size="md" onPress={saveBody} loading={savingBody} />}

      {/* ── Reminders + lock ─────────────────────────────────────────── */}
      <Text style={[Type.dotLabel, styles.groupLabel, { color: C.textMid }]}>Reminders</Text>
      <Tile style={styles.group}>
        <SettingRow
          icon="dumbbell"
          hue="train"
          title="Training wake-ups"
          value="06:00 · 07:00 on training days"
          trailing={<Toggle value={reminders.training} hue="train" onChange={(v) => toggleReminder('training', v)} label="Training wake-ups" />}
        />
        <SettingRow
          icon="silverware-fork-knife"
          hue="fuel"
          title="Meal times"
          value="08:30 · 13:30 · 17:30 · 20:30"
          trailing={<Toggle value={reminders.meals} hue="fuel" onChange={(v) => toggleReminder('meals', v)} label="Meal times" />}
        />
        <SettingRow
          icon="cart"
          hue="spend"
          title="Restock day"
          value="07:30 on plan days 1 · 8 · 15 · 22"
          trailing={<Toggle value={reminders.restock} hue="spend" onChange={(v) => toggleReminder('restock', v)} label="Restock day" />}
        />
        <SettingRow
          icon="fingerprint"
          hue="profile"
          title="App lock"
          value="Fingerprint or face to open"
          trailing={<Toggle value={lock} hue="profile" onChange={toggleLock} label="App lock" />}
          last
        />
      </Tile>
    </View>
  );
}

function Toggle({ value, hue, onChange, label }: { value: boolean; hue: HueName; onChange: (v: boolean) => void; label: string }) {
  return (
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ false: C.surface2, true: Hue[hue].main }}
      thumbColor="#FFFFFF"
      accessibilityLabel={label}
    />
  );
}

function Metric({
  icon,
  hue,
  label,
  unit,
  value,
  onChange,
  integer,
}: {
  icon: IconName;
  hue: HueName;
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
  integer?: boolean;
}) {
  return (
    <Tile hue={hue} containerStyle={styles.metricBox} style={styles.metric}>
      <View style={styles.metricHead}>
        <IconBlob name={icon} hue={hue} size={32} />
        <Text style={[Type.dotLabel, { color: Hue[hue].main }]}>{label}</Text>
      </View>
      <View style={styles.metricValue}>
        <TextInput
          value={value}
          onChangeText={onChange}
          keyboardType={integer ? 'number-pad' : 'decimal-pad'}
          placeholder="--"
          placeholderTextColor={C.textLow}
          style={[Type.dotNumber, styles.metricInput, { color: C.textHi }]}
          accessibilityLabel={`${label} in ${unit}`}
          selectTextOnFocus
        />
        <Text style={[Type.controlLabel, { color: C.textMid }]}>{unit}</Text>
      </View>
    </Tile>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  groupHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.two, marginHorizontal: 6 },
  chips: { flexDirection: 'row', gap: 6 },
  groupLabel: { marginLeft: 6, marginTop: Spacing.three },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 4 },
  metricBox: { width: '48.8%' },
  metric: { gap: 8, borderRadius: Radius.xl },
  metricHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metricValue: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  metricInput: { padding: 0, includeFontPadding: false, minWidth: 44, flexShrink: 1 },
  group: { paddingVertical: 4, paddingHorizontal: 14 },
});
