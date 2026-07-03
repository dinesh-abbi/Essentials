import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import {
  Alert,
  FlatList,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import * as PurchasesStorage from '@/utils/PurchasesStorage';

export type CategoryType = 'Groceries' | 'Dairy' | 'Veggies' | 'Misc';

// ── Purchases Navigation Tabs ────────────────────────────────────────────────
export function PurchasesTabs({ activeTab }: { activeTab: 'daily' | 'weekly' | 'monthly' }) {
  const router = useRouter();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];

  return (
    <View style={[styles.tabsWrapper, { backgroundColor: colors.backgroundSelected }]}>
      <TouchableOpacity
        onPress={() => router.replace('/purchases')}
        style={[styles.tabBtn, activeTab === 'daily' && [styles.tabActiveBtn, { backgroundColor: colors.backgroundElement }]]}
      >
        <Text style={[styles.tabText, { color: activeTab === 'daily' ? colors.text : colors.textSecondary }]}>Daily</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => router.replace('/purchases/weekly')}
        style={[styles.tabBtn, activeTab === 'weekly' && [styles.tabActiveBtn, { backgroundColor: colors.backgroundElement }]]}
      >
        <Text style={[styles.tabText, { color: activeTab === 'weekly' ? colors.text : colors.textSecondary }]}>Weekly</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => router.replace('/purchases/monthly')}
        style={[styles.tabBtn, activeTab === 'monthly' && [styles.tabActiveBtn, { backgroundColor: colors.backgroundElement }]]}
      >
        <Text style={[styles.tabText, { color: activeTab === 'monthly' ? colors.text : colors.textSecondary }]}>Monthly</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Main Daily Purchases Screen ──────────────────────────────────────────────
export default function DailyPurchasesScreen() {
  const router = useRouter();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];

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
      // Sort newest first
      setLogs(data.sort((a, b) => b.timestamp - a.timestamp));
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

  // Filter logs for today only
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const todayLogs = logs.filter((log) => log.timestamp >= midnight.getTime());
  const todayTotal = todayLogs.reduce((acc, curr) => acc + curr.cost, 0);

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* Top Header */}
        <View style={styles.header}>
          <AnimatedPressable
            onPress={() => router.back()}
            style={[styles.backBtn, { borderColor: colors.border }]}
          >
            <Feather name="arrow-left" size={20} color={colors.text} />
          </AnimatedPressable>
          <ThemedText type="smallBold" style={styles.headerTitle} themeColor="textSecondary">
            SPEND TRACKER
          </ThemedText>
          {logs.length > 0 ? (
            <AnimatedPressable
              onPress={handleClearAll}
              style={[styles.clearBtn, { borderColor: colors.alert }]}
            >
              <ThemedText type="code" style={{ color: colors.alert, fontSize: 10, fontWeight: '700' }}>
                WIPE_ALL
              </ThemedText>
            </AnimatedPressable>
          ) : (
            <View style={{ width: 60 }} />
          )}
        </View>

        {/* Navigation Tabs */}
        <PurchasesTabs activeTab="daily" />

        {/* Main List */}
        <FlatList
          data={todayLogs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={{ gap: Spacing.four, marginBottom: Spacing.two }}>
              {/* Daily Total Summary Card */}
              <View style={[styles.totalBar, { borderColor: colors.border, backgroundColor: colors.backgroundElement }]}>
                <View>
                  <ThemedText type="code" style={{ fontSize: 10, fontWeight: '700' }} themeColor="textSecondary">
                    TODAY'S ITEMS
                  </ThemedText>
                  <ThemedText type="subtitle" style={[styles.totalCount, { color: colors.text }]}>
                    {todayLogs.length}
                  </ThemedText>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <ThemedText type="code" style={{ fontSize: 10, fontWeight: '700' }} themeColor="textSecondary">
                    TODAY'S SPEND
                  </ThemedText>
                  <ThemedText type="subtitle" style={[styles.totalCost, { color: colors.primary }]}>
                    ₹{todayTotal.toFixed(2)}
                  </ThemedText>
                </View>
              </View>

              {/* Input Form Panel */}
              <View style={[styles.formPanel, { borderColor: colors.border, backgroundColor: colors.backgroundElement }]}>
                <ThemedText type="code" style={{ fontSize: 10, fontWeight: '700', marginBottom: Spacing.one }} themeColor="textSecondary">
                  RECORD NEW EXPENSE
                </ThemedText>

                <TextInput
                  style={[styles.textInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                  placeholder="Item name (e.g. Eggs, Milk...)"
                  placeholderTextColor={colors.textSecondary}
                  value={name}
                  onChangeText={setName}
                  autoCorrect={false}
                />

                <View style={styles.formRow}>
                  <TextInput
                    style={[
                      styles.textInput,
                      styles.costInput,
                      { color: colors.text, borderColor: colors.border, backgroundColor: colors.background },
                    ]}
                    placeholder="Cost (₹)"
                    placeholderTextColor={colors.textSecondary}
                    value={cost}
                    onChangeText={setCost}
                    keyboardType="decimal-pad"
                    autoCorrect={false}
                  />

                  {/* Category Toggles */}
                  <View style={styles.categoryContainer}>
                    {(['Groceries', 'Dairy', 'Veggies', 'Misc'] as CategoryType[]).map((cat) => {
                      const selected = category === cat;
                      return (
                        <TouchableOpacity
                          key={cat}
                          onPress={() => setCategory(cat)}
                          style={[
                            styles.catBtn,
                            {
                              borderColor: selected ? colors.primary : colors.border,
                              backgroundColor: selected ? colors.primary : 'transparent',
                            },
                          ]}
                        >
                          <ThemedText
                            type="code"
                            style={[
                              styles.catBtnText,
                              { color: selected ? '#FFF' : colors.text, fontWeight: '700' },
                            ]}
                          >
                            {cat.substring(0, 4).toUpperCase()}
                          </ThemedText>
                        </TouchableOpacity>
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
                      borderColor: colors.primary,
                      backgroundColor: colors.primary,
                    },
                  ]}
                >
                  <ThemedText type="smallBold" style={{ color: '#FFF' }}>
                    Record Entry
                  </ThemedText>
                </AnimatedPressable>
              </View>

              <ThemedText type="smallBold" style={styles.sectionTitle} themeColor="textSecondary">
                TODAY'S SPENDS
              </ThemedText>
            </View>
          }
          renderItem={({ item }) => {
            const formattedDate = new Date(item.timestamp).toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'Asia/Kolkata',
            });
            return (
              <View style={[styles.itemCard, { borderColor: colors.border }]}>
                <View style={{ flex: 1, gap: Spacing.half }}>
                  <View style={styles.itemNameRow}>
                    <ThemedText type="smallBold">{item.name}</ThemedText>
                    <View style={[styles.miniBadge, { borderColor: colors.border }]}>
                      <ThemedText type="code" style={{ fontSize: 9, fontWeight: '700', color: colors.textSecondary }}>
                        {item.category.toUpperCase()}
                      </ThemedText>
                    </View>
                  </View>
                  <ThemedText type="code" style={{ fontSize: 10 }} themeColor="textSecondary">
                    at {formattedDate}
                  </ThemedText>
                </View>
                <View style={styles.rightItemBlock}>
                  <ThemedText type="subtitle" style={[styles.itemPrice, { color: colors.text }]}>
                    ₹{item.cost.toFixed(2)}
                  </ThemedText>
                  <AnimatedPressable
                    onPress={() => handleDelete(item.id)}
                    style={styles.trashBtn}
                  >
                    <Feather name="trash-2" size={16} color={colors.alert} />
                  </AnimatedPressable>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="shopping-bag" size={32} color={colors.textSecondary} style={{ marginBottom: Spacing.two, opacity: 0.8 }} />
              <ThemedText type="code" themeColor="textSecondary" style={{ textAlign: 'center', fontSize: 12 }}>
                No records logged today
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center', marginTop: Spacing.one }}>
                Log items above to track today's shopping expenses.
              </ThemedText>
            </View>
          }
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  clearBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tabsWrapper: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginVertical: 10,
    borderRadius: 12,
    padding: 3,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 9,
  },
  tabActiveBtn: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  totalBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  totalCount: {
    fontSize: 22,
    fontWeight: '800',
  },
  totalCost: {
    fontSize: 22,
    fontWeight: '800',
  },
  formPanel: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  formRow: {
    flexDirection: 'row',
    gap: 10,
  },
  textInput: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    fontSize: 13,
  },
  costInput: {
    width: 90,
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
    paddingVertical: 8,
    alignItems: 'center',
  },
  catBtnText: {
    fontSize: 9,
  },
  submitBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 20,
    marginBottom: 4,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
  },
  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  miniBadge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  rightItemBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '700',
  },
  trashBtn: {
    padding: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
});
