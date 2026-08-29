import { Feather } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  AppStateStatus,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  View,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FontFace, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { saveUpiTransaction } from '@/utils/UpiStorage';
import { savePurchase } from '@/utils/PurchasesStorage';
import * as WidgetSync from '@/utils/WidgetSync';

export default function UpiAmountScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const upiId = params.upiId as string;
  const qrData = params.qrData as string;

  const [amount, setAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'Groceries' | 'Dairy' | 'Veggies' | 'Snacks' | 'Transport' | 'Bills' | 'Health' | 'Food' | 'Shopping' | 'Misc'>('Misc');
  const appState = useRef(AppState.currentState);
  const waitingForPaymentReturn = useRef(false);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App has come to the foreground!
        if (waitingForPaymentReturn.current) {
          waitingForPaymentReturn.current = false;
          promptPaymentSuccess();
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [amount, upiId]);

  const promptPaymentSuccess = () => {
    Alert.alert(
      'Payment Status',
      'Did the payment go through successfully?',
      [
        {
          text: 'No',
          style: 'cancel',
          onPress: () => setIsProcessing(false),
        },
        {
          text: 'Yes',
          onPress: async () => {
            try {
              const numericAmount = parseFloat(amount);
              await saveUpiTransaction(upiId, numericAmount);
              await savePurchase(
                description.trim() || `UPI to ${upiId}`,
                numericAmount,
                category
              );
              await WidgetSync.sync();
              Alert.alert('Success', 'Transaction logged successfully!');
              router.replace('/(tabs)');
            } catch (error) {
              console.error(error);
              Alert.alert('Error', 'Failed to log transaction.');
              setIsProcessing(false);
            }
          },
        },
      ],
      { cancelable: false }
    );
  };

  const handlePay = async () => {
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid payment amount.');
      return;
    }

    setIsProcessing(true);
    // UPI spec: exactly two decimal places, VPA must not be double URL-encoded
    const formattedAmount = numericAmount.toFixed(2);
    
    let upiUri = '';
    if (qrData) {
      // If we scanned a QR code, preserve all merchant context parameters (e.g. mc, tr, orgid, sign)
      try {
        const qIndex = qrData.indexOf('?');
        if (qIndex !== -1) {
          const baseUrl = qrData.substring(0, qIndex);
          const queryString = qrData.substring(qIndex + 1);
          
          // Re-construct the query params list manually or using URLSearchParams to avoid losing merchant info
          const searchParams = new URLSearchParams(queryString);
          searchParams.set('am', formattedAmount);
          if (description) {
            searchParams.set('tn', description);
          } else {
            searchParams.set('tn', 'Payment');
          }
          searchParams.set('cu', 'INR'); // ensure currency is set
          
          // Generate raw URI string without double-encoding the pa parameter
          const decodedParams: string[] = [];
          searchParams.forEach((val, key) => {
            if (key === 'pa') {
              // VPA must remain literal (e.g., name@bank, not name%40bank)
              decodedParams.push(`pa=${val}`);
            } else {
              decodedParams.push(`${key}=${encodeURIComponent(val)}`);
            }
          });
          upiUri = `${baseUrl}?${decodedParams.join('&')}`;
        } else {
          const payeeName = upiId.includes('@') ? upiId.split('@')[0] : upiId;
          upiUri = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(payeeName)}&am=${formattedAmount}&cu=INR&tn=${encodeURIComponent(description || 'Payment')}`;
        }
      } catch (e) {
        console.error('Error constructing URI from qrData:', e);
        const payeeName = upiId.includes('@') ? upiId.split('@')[0] : upiId;
        upiUri = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(payeeName)}&am=${formattedAmount}&cu=INR&tn=${encodeURIComponent(description || 'Payment')}`;
      }
    } else {
      // Manual entry, fallback to direct peer-to-peer VPA scheme
      const payeeName = upiId.includes('@') ? upiId.split('@')[0] : upiId;
      upiUri = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(payeeName)}&am=${formattedAmount}&cu=INR&tn=${encodeURIComponent(description || 'Payment')}`;
    }

    try {
      waitingForPaymentReturn.current = true;
      await Linking.openURL(upiUri);
    } catch (error) {
      console.error('Failed to open UPI URL directly:', error);
      Alert.alert('No UPI App Found', 'Could not find a supported UPI app to complete the payment.');
      setIsProcessing(false);
      waitingForPaymentReturn.current = false;
    }
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <AnimatedPressable
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: theme.backgroundElement }]}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </AnimatedPressable>
        <ThemedText style={styles.headerTitle}>Pay via UPI</ThemedText>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView style={styles.content} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ThemedView style={styles.card}>
          <ThemedText themeColor="textSecondary" style={styles.label}>Paying to</ThemedText>
          <ThemedText style={styles.upiIdText} numberOfLines={1} adjustsFontSizeToFit>{upiId}</ThemedText>

          <View style={styles.amountContainer}>
            <ThemedText style={[styles.currencySymbol, { color: theme.text }]}>₹</ThemedText>
            <TextInput
              style={[styles.amountInput, { color: theme.text }]}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={theme.textSecondary}
              value={amount}
              onChangeText={setAmount}
              autoFocus
              editable={!isProcessing}
            />
          </View>
        </ThemedView>

        <ThemedView style={styles.formCard}>
          <ThemedText themeColor="textSecondary" style={styles.formLabel}>What was this spent on?</ThemedText>
          <TextInput
            style={[styles.formInput, { color: theme.text, borderColor: theme.border }]}
            placeholder="e.g. Milk, Veggies, Lunch (optional)"
            placeholderTextColor={theme.textSecondary}
            value={description}
            onChangeText={setDescription}
            editable={!isProcessing}
          />

          <ThemedText themeColor="textSecondary" style={[styles.formLabel, { marginTop: Spacing.four }]}>Category</ThemedText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryContainer}
          >
            {(['Groceries', 'Dairy', 'Veggies', 'Snacks', 'Transport', 'Bills', 'Health', 'Food', 'Shopping', 'Misc'] as const).map((cat) => {
              const isSelected = category === cat;
              return (
                <AnimatedPressable
                  key={cat}
                  onPress={() => setCategory(cat)}
                  disabled={isProcessing}
                  style={[
                    styles.categoryChip,
                    {
                      backgroundColor: isSelected ? theme.primary : theme.backgroundElement,
                      borderColor: isSelected ? theme.primary : theme.border,
                      paddingHorizontal: 16,
                      flex: 0,
                      minWidth: 80,
                    }
                  ]}>
                  <ThemedText
                    style={[
                      styles.categoryChipText,
                      { color: isSelected ? '#FFF' : theme.textSecondary }
                    ]}>
                    {cat}
                  </ThemedText>
                </AnimatedPressable>
              );
            })}
          </ScrollView>
        </ThemedView>

        <View style={{ flex: 1 }} />

        <AnimatedPressable
          onPress={handlePay}
          disabled={isProcessing || !amount}
          style={[
            styles.payBtn,
            { backgroundColor: isProcessing || !amount ? theme.border : theme.primary }
          ]}>
          <ThemedText style={styles.payBtnText}>
            {isProcessing ? 'Processing...' : `Pay ₹${amount || '0'}`}
          </ThemedText>
        </AnimatedPressable>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: FontFace.bold,
  },
  content: {
    flex: 1,
    padding: Spacing.four,
  },
  card: {
    padding: Spacing.five,
    borderRadius: 24,
    backgroundColor: 'rgba(128, 128, 128, 0.1)', // subtle surface
    alignItems: 'center',
    marginTop: Spacing.six,
  },
  label: {
    fontSize: 14,
    fontFamily: FontFace.regular,
    marginBottom: Spacing.two,
  },
  upiIdText: {
    fontSize: 20,
    fontFamily: FontFace.semibold,
    marginBottom: Spacing.six,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencySymbol: {
    fontSize: 42,
    fontFamily: FontFace.semibold,
    marginRight: Spacing.two,
  },
  amountInput: {
    fontSize: 48,
    fontFamily: FontFace.bold,
    minWidth: 100,
    textAlign: 'center',
  },
  payBtn: {
    paddingVertical: Spacing.four,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: Spacing.six,
  },
  payBtnText: {
    color: '#FFF',
    fontSize: 18,
    fontFamily: FontFace.bold,
  },
  formCard: {
    padding: Spacing.four,
    borderRadius: 20,
    backgroundColor: 'rgba(128, 128, 128, 0.08)',
    marginTop: Spacing.four,
    width: '100%',
  },
  formLabel: {
    fontSize: 14,
    fontFamily: FontFace.semibold,
    marginBottom: Spacing.two,
  },
  formInput: {
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
    fontFamily: FontFace.regular,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  categoryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  categoryChip: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryChipText: {
    fontSize: 12,
    fontFamily: FontFace.bold,
  },
});
