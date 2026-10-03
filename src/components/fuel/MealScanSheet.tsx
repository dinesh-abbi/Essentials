import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';

import { AnimatedNumber } from '@/components/ui/animated-number';
import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { Sheet } from '@/components/ui/sheet';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import * as Coach from '@/utils/Coach';

type Palette = typeof Colors.dark;

/**
 * Photo → macros. The result is laid out like a nutrition label rebuilt in
 * this app's type: one hero number (kcal), three macro readouts with a
 * proportional split bar, the itemised guess, and a single line of advice.
 */
export function MealScanSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme] as Palette;
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scan, setScan] = useState<Coach.MealScan | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setPhoto(null);
    setScan(null);
    setError(null);
    setBusy(false);
  };

  const pick = async (camera: boolean) => {
    const perm = camera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', `Allow ${camera ? 'camera' : 'photo'} access to scan a meal.`);
      return;
    }
    const opts: ImagePicker.ImagePickerOptions = { base64: true, quality: 0.5, mediaTypes: ['images'] };
    const res = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    const asset = res.assets?.[0];
    if (res.canceled || !asset?.base64) return;

    setPhoto(asset.uri);
    setScan(null);
    setError(null);
    setBusy(true);
    const out = await Coach.scanMeal(asset.base64, asset.mimeType ?? 'image/jpeg');
    setBusy(false);
    if (out.ok) setScan(out.scan);
    else setError(out.message);
  };

  const t = scan?.total;
  const macroKcal = t ? t.protein * 4 + t.carbs * 4 + t.fat * 9 : 0;

  return (
    <Sheet
      visible={visible}
      onClose={() => {
        onClose();
        reset();
      }}
      dismissable={!busy}
      bracket="[ MEAL SCAN ]"
      title={scan ? 'Estimated for the portion shown' : 'Photograph your plate'}
    >
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {!Coach.isConfigured() && (
          <Text style={[Type.body, { color: colors.alert }]}>
            The coach isn’t configured — add EXPO_PUBLIC_GEMINI_API_KEY to .env and rebuild.
          </Text>
        )}

        {photo ? (
          <View style={[styles.photo, { borderColor: colors.hairline }]}>
            <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" />
            {busy && (
              <View style={[StyleSheet.absoluteFill, styles.busy]}>
                <ActivityIndicator color={colors.water} />
                <Text style={[Type.bracketLabel, { color: colors.textHi }]}>[ READING THE PLATE ]</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.pickRow}>
            <PickTile icon="camera" label="Camera" colors={colors} onPress={() => pick(true)} disabled={!Coach.isConfigured()} />
            <PickTile icon="image" label="From photos" colors={colors} onPress={() => pick(false)} disabled={!Coach.isConfigured()} />
          </View>
        )}

        {error && <Text style={[Type.body, { color: colors.alert }]}>{error}</Text>}

        {scan && t && (
          <>
            <View style={styles.kcalRow}>
              <AnimatedNumber value={Math.round(t.calories)} style={Type.hero} color={colors.textHi} height={92} />
              <Text style={[Type.heroUnit, styles.kcalUnit, { color: colors.textMid }]}>kcal</Text>
              <View style={{ flex: 1 }} />
              <View style={styles.score}>
                <Text style={[Type.bracketLabel, { color: colors.textMid }]}>[ SCORE ]</Text>
                <Text style={[Type.numberSm, { color: scan.score >= 7 ? colors.water : colors.textHi }]}>
                  {scan.score}
                  <Text style={[Type.subline, { color: colors.textMid }]}>/10</Text>
                </Text>
              </View>
            </View>

            {macroKcal > 0 && (
              <View style={styles.split}>
                <View style={{ flex: t.protein * 4, backgroundColor: colors.water, height: 6, borderRadius: 3 }} />
                <View style={{ flex: t.carbs * 4, backgroundColor: colors.textMid, height: 6, borderRadius: 3 }} />
                <View style={{ flex: t.fat * 9, backgroundColor: colors.hairline, height: 6, borderRadius: 3 }} />
              </View>
            )}
            <View style={styles.macros}>
              <Macro label="PROTEIN" grams={t.protein} swatch={colors.water} colors={colors} />
              <Macro label="CARBS" grams={t.carbs} swatch={colors.textMid} colors={colors} />
              <Macro label="FAT" grams={t.fat} swatch={colors.hairline} colors={colors} />
            </View>

            <View style={[styles.items, { borderTopColor: colors.hairline }]}>
              {scan.items.map((it, i) => (
                <View key={`${it.name}-${i}`} style={styles.itemRow}>
                  <Text style={[Type.body, { color: colors.textHi, flex: 1 }]}>{it.name}</Text>
                  <Text style={[Type.readout, { color: colors.textMid, fontSize: 14 }]}>{Math.round(it.calories)} kcal</Text>
                </View>
              ))}
            </View>

            {scan.advice ? (
              <View style={[styles.advice, { borderLeftColor: colors.water }]}>
                <Text style={[Type.body, { color: colors.textHi }]}>{scan.advice}</Text>
              </View>
            ) : null}
          </>
        )}

        {photo && !busy && (
          <AnimatedPressable
            onPress={reset}
            haptic="light"
            style={[styles.again, { borderColor: colors.hairline }]}
            accessibilityRole="button"
          >
            <Feather name="rotate-ccw" size={15} color={colors.textHi} />
            <Text style={[Type.controlLabel, { color: colors.textHi }]}>Scan another</Text>
          </AnimatedPressable>
        )}
      </ScrollView>
    </Sheet>
  );
}

function PickTile({
  icon,
  label,
  colors,
  onPress,
  disabled,
}: {
  icon: 'camera' | 'image';
  label: string;
  colors: Palette;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      haptic="light"
      style={[styles.tile, { borderColor: colors.hairline, backgroundColor: colors.surface, opacity: disabled ? 0.45 : 1 }]}
      accessibilityRole="button"
    >
      <Feather name={icon} size={24} color={colors.water} />
      <Text style={[Type.subline, { color: colors.textHi }]}>{label}</Text>
    </AnimatedPressable>
  );
}

function Macro({ label, grams, swatch, colors }: { label: string; grams: number; swatch: string; colors: Palette }) {
  return (
    <View style={styles.macro}>
      <View style={styles.macroHead}>
        <View style={[styles.swatch, { backgroundColor: swatch }]} />
        <Text style={[Type.bracketLabel, { color: colors.textMid }]}>{label}</Text>
      </View>
      <Text style={[Type.readout, { color: colors.textHi, fontSize: 22 }]}>
        {Math.round(grams)}
        <Text style={[Type.subline, { color: colors.textMid }]}> g</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.six, gap: Spacing.four },
  pickRow: { flexDirection: 'row', gap: Spacing.two },
  tile: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.five,
    alignItems: 'center',
    gap: Spacing.two,
  },
  photo: { height: 220, borderRadius: Radius.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  busy: { backgroundColor: 'rgba(5,12,10,0.6)', alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  kcalRow: { flexDirection: 'row', alignItems: 'flex-end' },
  kcalUnit: { marginLeft: Spacing.two, marginBottom: 14 },
  score: { alignItems: 'flex-end', marginBottom: Spacing.two },
  split: { flexDirection: 'row', gap: 3 },
  macros: { flexDirection: 'row', justifyContent: 'space-between' },
  macro: { gap: 4 },
  macroHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 8, height: 8, borderRadius: 2 },
  items: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.three, gap: Spacing.two },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  advice: { borderLeftWidth: 2, paddingLeft: Spacing.three },
  again: {
    height: 50,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
});
