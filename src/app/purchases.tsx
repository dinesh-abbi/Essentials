import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import * as PurchasesStorage from '@/utils/PurchasesStorage';

type CategoryType = 'Groceries' | 'Dairy' | 'Veggies' | 'Misc';

export default function PurchasesScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // States
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<PurchasesStorage.PurchaseLog[]>([]);
  const [name, setName] = useState('');
  const [cost, setCost] = useState('');
  const [category, setCategory] = useState<CategoryType>('Groceries');

  // Load data
  useEffect(() => {
    loadPurchases();
  }, []);

  async function loadPurchases() {
    try {
      const data = await PurchasesStorage.getPurchases();
      setLogs(data);
    } catch (e) {
      Alert.alert('Error', 'Failed to load purchase logs.');
    } finally {
      setLoading(false);
    }
  }

  const handleAddPurchase = async () => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Please enter an item name.');
      return;
    }

    const price = parseFloat(cost);
    if (isNaN(price) || price <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid cost amount.');
      return;
    }

    setLoading(true);
    try {
      const newLog = await PurchasesStorage.savePurchase(name, price, category);
      setLogs((prev) => [newLog, ...prev]);
      setName('');
      setCost('');
      setCategory('Groceries');
      Keyboard.dismiss();
    } catch (e) {
      Alert.alert('Error', 'Failed to save purchase.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert('Delete Entry', 'Are you sure you want to delete this purchase?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try {
            await PurchasesStorage.deletePurchase(id);
            setLogs((prev) => prev.filter((log) => log.id !== id));
          } catch (e) {
            Alert.alert('Error', 'Failed to delete purchase.');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const handleClearAll = async () => {
    Alert.alert('Clear All Data', 'Are you sure you want to erase all purchases history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Wipe Memory',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try {
            await PurchasesStorage.clearPurchases();
            setLogs([]);
          } catch (e) {
            Alert.alert('Error', 'Failed to clear data.');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const totalSpent = logs.reduce((acc, curr) => acc + curr.cost, 0);

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.innerContainer, { paddingTop: insets.top + Spacing.two, paddingBottom: insets.bottom + Spacing.two }]}>
        
        {/* Top Header */}
        <View style={styles.header}>
          <AnimatedPressable
            onPress={() => router.back()}
            style={[
              styles.roundBtn,
              { borderColor: theme.border, backgroundColor: 'transparent' },
            ]}
          >
            <Feather name="arrow-left" size={20} color={theme.text} />
          </AnimatedPressable>
          <ThemedText type="smallBold" style={styles.headerTitle} themeColor="textSecondary">
            PURCHASES
          </ThemedText>
          {logs.length > 0 ? (
            <AnimatedPressable
              onPress={handleClearAll}
              style={[
                styles.clearBtn,
                { borderColor: theme.alert, backgroundColor: 'transparent' },
              ]}
            >
              <ThemedText type="code" style={{ color: theme.alert, fontSize: 10, fontWeight: '700' }}>
                WIPE_ALL
              </ThemedText>
            </AnimatedPressable>
          ) : (
            <View style={{ width: 60 }} />
          )}
        </View>

        {/* Dynamic Total Metrics Bar */}
        <View style={[styles.totalBar, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
          <View>
            <ThemedText type="code" style={{ fontSize: 10, fontWeight: '700' }} themeColor="textSecondary">
              TOTAL RECORDS
            </ThemedText>
            <ThemedText type="subtitle" style={[styles.totalCount, { color: theme.text }]}>
              {logs.length}
            </ThemedText>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <ThemedText type="code" style={{ fontSize: 10, fontWeight: '700' }} themeColor="textSecondary">
              CUMULATIVE SPEND
            </ThemedText>
            <ThemedText type="subtitle" style={[styles.totalCost, { color: theme.primary }]}>
              ₹{totalSpent.toFixed(2)}
            </ThemedText>
          </View>
        </View>

        {/* Input Form Panel */}
        <View style={[styles.formPanel, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="code" style={{ fontSize: 10, fontWeight: '700', marginBottom: Spacing.one }} themeColor="textSecondary">
            ADD NEW ENTRY
          </ThemedText>

          <TextInput
            style={[styles.textInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
            placeholder="Item name (e.g. Eggs, Milk...)"
            placeholderTextColor={theme.textSecondary}
            value={name}
            onChangeText={setName}
            autoCorrect={false}
          />

          <View style={styles.formRow}>
            <TextInput
              style={[
                styles.textInput,
                styles.costInput,
                { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
              ]}
              placeholder="Cost (₹)"
              placeholderTextColor={theme.textSecondary}
              value={cost}
              onChangeText={setCost}
              keyboardType="decimal-pad"
              autoCorrect={false}
            />

            {/* Category Select Toggles */}
            <View style={styles.categoryContainer}>
              {(['Groceries', 'Dairy', 'Veggies', 'Misc'] as CategoryType[]).map((cat) => {
                const selected = category === cat;
                return (
                  <AnimatedPressable
                    key={cat}
                    onPress={() => setCategory(cat)}
                    style={[
                      styles.catBtn,
                      {
                        borderColor: selected ? theme.primary : theme.border,
                        backgroundColor: selected ? theme.primary : 'transparent',
                      },
                    ]}
                  >
                    <ThemedText
                      type="code"
                      style={[
                        styles.catBtnText,
                        { color: selected ? '#FFF' : theme.text, fontWeight: '700' },
                      ]}
                    >
                      {cat.substring(0, 4).toUpperCase()}
                    </ThemedText>
                  </AnimatedPressable>
                );
              })}
            </View>
          </View>

          <AnimatedPressable
            onPress={handleAddPurchase}
            disabled={loading}
            style={[
              styles.submitBtn,
              {
                borderColor: theme.primary,
                backgroundColor: theme.primary,
              },
            ]}
          >
            <ThemedText type="smallBold" style={{ color: '#FFF' }}>
              Record Entry
            </ThemedText>
          </AnimatedPressable>
        </View>

        {/* Loading Indicator */}
        {loading && logs.length === 0 ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : (
          /* Logs List */
          <FlatList
            data={logs}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const formattedDate = new Date(item.timestamp).toLocaleDateString('en-IN', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'Asia/Kolkata',
              });
              return (
                <View style={[styles.itemCard, { borderColor: theme.border }]}>
                  <View style={{ flex: 1, gap: Spacing.half }}>
                    <View style={styles.itemNameRow}>
                      <ThemedText type="smallBold">{item.name}</ThemedText>
                      <View style={[styles.miniBadge, { borderColor: theme.border }]}>
                        <ThemedText type="code" style={{ fontSize: 9, fontWeight: '700', color: theme.textSecondary }}>
                          {item.category.toUpperCase()}
                        </ThemedText>
                      </View>
                    </View>
                    <ThemedText type="code" style={{ fontSize: 10 }} themeColor="textSecondary">
                      {formattedDate}
                    </ThemedText>
                  </View>
                  <View style={styles.rightItemBlock}>
                    <ThemedText type="subtitle" style={[styles.itemPrice, { color: theme.text }]}>
                      ₹{item.cost.toFixed(2)}
                    </ThemedText>
                    <AnimatedPressable
                      onPress={() => handleDelete(item.id)}
                      style={styles.trashBtn}
                    >
                      <Feather name="trash-2" size={16} color={theme.alert} />
                    </AnimatedPressable>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Feather name="clipboard" size={36} color={theme.textSecondary} style={{ marginBottom: Spacing.two }} />
                <ThemedText type="code" themeColor="textSecondary" style={{ textAlign: 'center', fontSize: 12 }}>
                  No records stored yet
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center', marginTop: Spacing.one }}>
                  Log items above to track shopping expenses.
                </ThemedText>
              </View>
            }
          />
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  innerContainer: {
    flex: 1,
    maxWidth: 500,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
  },
  roundBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 14,
    letterSpacing: 0.5,
  },
  clearBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  totalBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  totalCount: {
    fontSize: 24,
    fontWeight: '800',
  },
  totalCost: {
    fontSize: 24,
    fontWeight: '800',
  },
  formPanel: {
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  formRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  textInput: {
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 8,
    fontSize: 13,
  },
  costInput: {
    width: 100,
  },
  categoryContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 4,
  },
  catBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  catBtnText: {
    fontSize: 9,
  },
  submitBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: Spacing.five,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    paddingVertical: Spacing.three,
  },
  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  miniBadge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
  rightItemBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  itemPrice: {
    fontSize: 18,
    fontWeight: '700',
  },
  trashBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.six,
  },
});
