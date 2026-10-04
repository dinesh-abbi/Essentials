import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, AppState, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { CATEGORIES, categoryMeta } from '@/components/spend/categories';
import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { ChunkyButton, IconBlob, Tile } from '@/components/ui/chunky';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Colors, FontFace, Hue, Radius, Spacing, Type, withAlpha } from '@/constants/theme';
import { savePurchase } from '@/utils/PurchasesStorage';
import { saveUpiTransaction } from '@/utils/UpiStorage';
import * as WidgetSync from '@/utils/WidgetSync';

const C = Colors.dark;
const PAY_CATEGORIES = CATEGORIES.filter((c) => c !== 'Income');

const vpaUri = (upiId: string, amount: string, note: string) => {
  const payee = upiId.includes('@') ? upiId.split('@')[0] : upiId;
  return `upi://pay?pa=${upiId}&pn=${encodeURIComponent(payee)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note || 'Payment')}`;
};

/**
 * Pay a UPI ID: who you're paying, a giant amount, what it was for (picture
 * categories), then hand off to the UPI app. When you come back we ask if it
 * went through and log it to Spend.
 */
export default function UpiAmountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const upiId = params.upiId as string;
  const qrData = params.qrData as string;

  const [amount, setAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Misc');
  const appState = useRef(AppState.currentState);
  const waiting = useRef(false);


  const askResult = () =>
    Alert.alert(
      'Did it go through?',
      'Tell us if the payment succeeded so it can be added to Spend.',
      [
        { text: 'No', style: 'cancel', onPress: () => setProcessing(false) },
        {
          text: 'Yes, paid',
          onPress: async () => {
            try {
              const value = parseFloat(amount);
              await saveUpiTransaction(upiId, value);
              await savePurchase(description.trim() || `UPI to ${upiId}`, value, category);
              await WidgetSync.sync();
              Alert.alert('Logged', 'Added to your spending.');
              router.replace('/(tabs)');
            } catch (error) {
              console.error(error);
              Alert.alert('Error', 'Failed to log the payment.');
              setProcessing(false);
            }
          },
        },
      ],
      { cancelable: false },
    );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (appState.current.match(/inactive|background/) && next === 'active' && waiting.current) {
        waiting.current = false;
        askResult();
      }
      appState.current = next;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, upiId, description, category]);

  const pay = async () => {
    const value = parseFloat(amount);
    if (isNaN(value) || value <= 0) {
      Alert.alert('Add an amount', 'Enter how much to pay.');
      return;
    }
    setProcessing(true);
    // UPI spec: exactly two decimals; the VPA must not be double-encoded.
    const formatted = value.toFixed(2);
    let uri = vpaUri(upiId, formatted, description);
    if (qrData) {
      try {
        const q = qrData.indexOf('?');
        if (q !== -1) {
          // Keep every merchant parameter (mc, tr, orgid, sign…) from the QR.
          const sp = new URLSearchParams(qrData.substring(q + 1));
          sp.set('am', formatted);
          sp.set('tn', description || 'Payment');
          sp.set('cu', 'INR');
          const parts: string[] = [];
          sp.forEach((val, key) => parts.push(key === 'pa' ? `pa=${val}` : `${key}=${encodeURIComponent(val)}`));
          uri = `${qrData.substring(0, q)}?${parts.join('&')}`;
        }
      } catch (e) {
        console.error('Error constructing URI from qrData:', e);
      }
    }
    try {
      waiting.current = true;
      await Linking.openURL(uri);
    } catch (error) {
      console.error('Failed to open UPI URL:', error);
      Alert.alert('No UPI app', 'Couldn’t find a UPI app to finish the payment.');
      setProcessing(false);
      waiting.current = false;
    }
  };

  const sun = Hue.spend;

  return (
    <View style={[styles.root, { backgroundColor: C.bg }]}>
      <SafeAreaView style={styles.fill} edges={['top']}>
        <View style={styles.pad}>
          <ScreenHeader bracket="Pay with UPI" />
        </View>
        <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.four }]} keyboardShouldPersistTaps="handled">
            <Tile hue="spend" style={styles.payee}>
              <IconBlob name="account-circle" hue="spend" size={48} />
              <View style={styles.flex}>
                <Text style={[Type.dotLabel, { color: C.textMid }]}>Paying to</Text>
                <Text style={[Type.title, { color: C.textHi }]} numberOfLines={1} adjustsFontSizeToFit>
                  {upiId}
                </Text>
              </View>
              {qrData ? <MaterialCommunityIcons name="qrcode" size={26} color={sun.main} /> : null}
            </Tile>

            <View style={[styles.amount, { backgroundColor: C.surface }]}>
              <Text style={[styles.rupee, { color: sun.main }]}>₹</Text>
              <TextInput
                style={[Type.dotHero, styles.amountInput, { color: C.textHi }]}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={C.textLow}
                value={amount}
                onChangeText={setAmount}
                autoFocus
                editable={!processing}
                accessibilityLabel="Amount in rupees"
              />
            </View>

            <TextInput
              style={[Type.controlLabel, styles.note, { color: C.textHi, backgroundColor: C.surface }]}
              placeholder="What’s it for? (optional)"
              placeholderTextColor={C.textLow}
              value={description}
              onChangeText={setDescription}
              editable={!processing}
            />

            <Text style={[Type.dotLabel, { color: C.textMid }]}>Category</Text>
            <View style={styles.grid}>
              {PAY_CATEGORIES.map((cat) => {
                const meta = categoryMeta(cat);
                const on = category === cat;
                return (
                  <AnimatedPressable
                    key={cat}
                    onPress={() => setCategory(cat)}
                    disabled={processing}
                    haptic="selection"
                    pressScale={0.9}
                    style={[styles.cat, { backgroundColor: on ? withAlpha(meta.color, 0.18) : C.surface }, on && { borderColor: meta.color }]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={cat}
                  >
                    <View style={[styles.catIcon, { backgroundColor: on ? meta.color : withAlpha(meta.color, 0.16) }]}>
                      <MaterialCommunityIcons name={meta.icon} size={20} color={on ? C.onAccent : meta.color} />
                    </View>
                    <Text style={[Type.badge, { color: on ? C.textHi : C.textMid, fontSize: 11 }]} numberOfLines={1}>
                      {cat}
                    </Text>
                  </AnimatedPressable>
                );
              })}
            </View>

            <ChunkyButton
              label={processing ? 'Waiting for your UPI app…' : `Pay ₹${amount || '0'}`}
              icon="send"
              hue="spend"
              onPress={pay}
              loading={processing}
              disabled={!amount}
              style={styles.payBtn}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  flex: { flex: 1 },
  pad: { paddingHorizontal: Spacing.three },
  content: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, gap: 12 },
  payee: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  amount: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: Radius.xl, paddingVertical: 18, gap: 6 },
  rupee: { fontFamily: FontFace.displayBold, fontSize: 44 },
  amountInput: { minWidth: 90, textAlign: 'center', padding: 0, includeFontPadding: false },
  note: { borderRadius: Radius.lg, paddingHorizontal: 16, height: 52 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  cat: { width: '23.5%', alignItems: 'center', gap: 6, paddingVertical: 10, borderRadius: Radius.lg, borderWidth: 2, borderColor: 'transparent' },
  catIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  payBtn: { marginTop: Spacing.three },
});
