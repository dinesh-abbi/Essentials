import { Feather } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { Colors, FontFace, Radius, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AnimatedPressable } from '@/components/ui/animated-pressable';
import * as WidgetSync from '@/utils/WidgetSync';
import * as PurchasesStorage from '@/utils/PurchasesStorage';

// Expanded Categories List (20 categories)
const CATEGORIES = [
  'Groceries', 'Dairy', 'Veggies', 'Snacks', 'Transport',
  'Bills', 'Health', 'Food', 'Shopping', 'Misc',
  'Rent', 'Entertainment', 'Education', 'Subscriptions',
  'Travel', 'Clothing', 'Gadgets', 'Investments',
  'Insurance', 'Income'
];

type CategoryType = string;

// Helper to get days in a month
function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

// Helper to get first day of month weekday index (0 = Sun, 6 = Sat)
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

// ── Calendar Picker Component ──────────────────────────────────────────────
function CalendarPicker({ visible, onClose, selectedDate, onSelectDate, colors }: any) {
  const [navDate, setNavDate] = useState(new Date(selectedDate));

  const year = navDate.getFullYear();
  const month = navDate.getMonth();

  const daysInMonth = getDaysInMonth(year, month);
  const firstDayIndex = getFirstDayOfMonth(year, month);
  const prevMonthDays = getDaysInMonth(year, month - 1);

  // Generate days grid
  const gridCells = [];

  // Empty slots from previous month
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    gridCells.push({
      day: prevMonthDays - i,
      month: month - 1,
      year: month === 0 ? year - 1 : year,
      isCurrentMonth: false,
    });
  }

  // Days of current month
  for (let i = 1; i <= daysInMonth; i++) {
    gridCells.push({
      day: i,
      month: month,
      year: year,
      isCurrentMonth: true,
    });
  }

  // Fill up the rest of the cells to complete grid row
  const remaining = 42 - gridCells.length;
  for (let i = 1; i <= remaining; i++) {
    gridCells.push({
      day: i,
      month: month + 1,
      year: month === 11 ? year + 1 : year,
      isCurrentMonth: false,
    });
  }

  const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.calendarCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
          <View style={styles.calHeader}>
            <TouchableOpacity
              onPress={() => setNavDate(new Date(year, month - 1, 1))}
              style={styles.calNavBtn}
            >
              <Feather name="chevron-left" size={18} color={colors.text} />
            </TouchableOpacity>

            <Text style={[styles.calMonthText, { color: colors.text }]}>
              {monthNames[month]} {year}
            </Text>

            <TouchableOpacity
              onPress={() => setNavDate(new Date(year, month + 1, 1))}
              style={styles.calNavBtn}
            >
              <Feather name="chevron-right" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.calWeekdays}>
            {weekdays.map((w, idx) => (
              <Text key={idx} style={[styles.calWeekdayText, { color: colors.textSecondary }]}>
                {w}
              </Text>
            ))}
          </View>

          <View style={styles.calGrid}>
            {gridCells.map((cell, idx) => {
              const cellDateStr = new Date(cell.year, cell.month, cell.day).toDateString();
              const isSelected = selectedDate.toDateString() === cellDateStr;
              return (
                <TouchableOpacity
                  key={idx}
                  onPress={() => {
                    const d = new Date(cell.year, cell.month, cell.day);
                    const now = new Date();
                    d.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
                    onSelectDate(d);
                    onClose();
                  }}
                  style={[
                    styles.calCell,
                    isSelected && { backgroundColor: colors.primary },
                  ]}
                >
                  <Text
                    style={[
                      styles.calCellText,
                      { color: cell.isCurrentMonth ? colors.text : colors.textSecondary },
                      isSelected && { color: '#FFF', fontFamily: FontFace.bold },
                    ]}
                  >
                    {cell.day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            onPress={onClose}
            style={[styles.calCloseBtn, { borderColor: colors.border }]}
          >
            <Text style={[styles.calCloseBtnText, { color: colors.text }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Custom Time Picker Component ─────────────────────────────────────────────
function TimePicker({ visible, onClose, selectedDate, onSelectTime, colors }: any) {
  const date = new Date(selectedDate);
  let initialHours = date.getHours();
  const ampm = initialHours >= 12 ? 'PM' : 'AM';
  initialHours = initialHours % 12;
  if (initialHours === 0) initialHours = 12;
  const initialMinutes = date.getMinutes();

  const [hours, setHours] = useState(initialHours);
  const [minutes, setMinutes] = useState(initialMinutes);
  const [period, setPeriod] = useState(ampm);

  useEffect(() => {
    if (visible) {
      let h = selectedDate.getHours();
      const p = h >= 12 ? 'PM' : 'AM';
      h = h % 12;
      if (h === 0) h = 12;
      setHours(h);
      setMinutes(selectedDate.getMinutes());
      setPeriod(p);
    }
  }, [visible, selectedDate]);

  const incrementHours = () => {
    setHours((prev) => (prev === 12 ? 1 : prev + 1));
  };

  const decrementHours = () => {
    setHours((prev) => (prev === 1 ? 12 : prev - 1));
  };

  const incrementMinutes = () => {
    setMinutes((prev) => (prev >= 59 ? 0 : prev + 1));
  };

  const decrementMinutes = () => {
    setMinutes((prev) => (prev <= 0 ? 59 : prev - 1));
  };

  const handleSave = () => {
    const newDate = new Date(selectedDate);
    let h = hours;
    if (period === 'PM' && h < 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    newDate.setHours(h, minutes, 0, 0);
    onSelectTime(newDate);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.calendarCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border, padding: 20 }]}>
          <Text style={[styles.calMonthText, { color: colors.text, marginBottom: 20, alignSelf: 'center' }]}>
            Adjust Time
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 15, marginBottom: 25 }}>
            <View style={{ alignItems: 'center' }}>
              <TouchableOpacity onPress={incrementHours} style={styles.timeNavBtn}>
                <Feather name="chevron-up" size={24} color={colors.primary} />
              </TouchableOpacity>
              <Text style={{ fontSize: 32, fontFamily: FontFace.bold, color: colors.text, marginVertical: 8 }}>
                {hours.toString().padStart(2, '0')}
              </Text>
              <TouchableOpacity onPress={decrementHours} style={styles.timeNavBtn}>
                <Feather name="chevron-down" size={24} color={colors.primary} />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 32, fontFamily: FontFace.bold, color: colors.textSecondary, alignSelf: 'center', marginTop: -6 }}>
              :
            </Text>

            <View style={{ alignItems: 'center' }}>
              <TouchableOpacity onPress={incrementMinutes} style={styles.timeNavBtn}>
                <Feather name="chevron-up" size={24} color={colors.primary} />
              </TouchableOpacity>
              <Text style={{ fontSize: 32, fontFamily: FontFace.bold, color: colors.text, marginVertical: 8 }}>
                {minutes.toString().padStart(2, '0')}
              </Text>
              <TouchableOpacity onPress={decrementMinutes} style={styles.timeNavBtn}>
                <Feather name="chevron-down" size={24} color={colors.primary} />
              </TouchableOpacity>
            </View>

            <View style={{ gap: 8, marginLeft: 10 }}>
              <TouchableOpacity
                onPress={() => setPeriod('AM')}
                style={[
                  styles.ampmBtn,
                  { borderColor: colors.border },
                  period === 'AM' && { backgroundColor: colors.primary, borderColor: colors.primary }
                ]}
              >
                <Text style={{ color: period === 'AM' ? '#FFF' : colors.text, fontSize: 12, fontFamily: FontFace.bold }}>AM</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setPeriod('PM')}
                style={[
                  styles.ampmBtn,
                  { borderColor: colors.border },
                  period === 'PM' && { backgroundColor: colors.primary, borderColor: colors.primary }
                ]}
              >
                <Text style={{ color: period === 'PM' ? '#FFF' : colors.text, fontSize: 12, fontFamily: FontFace.bold }}>PM</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.calCloseBtn, { flex: 1, borderColor: colors.border }]}
            >
              <Text style={[styles.calCloseBtnText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              style={[styles.calCloseBtn, { flex: 1, backgroundColor: colors.primary, borderColor: colors.primary }]}
            >
              <Text style={[styles.calCloseBtnText, { color: '#FFF' }]}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Edit Expense Modal Component ─────────────────────────────────────────────
function EditExpenseModal({ visible, onClose, log, onSave, onDelete, colors, isSaving }: any) {
  if (!log) return null;

  const [editName, setEditName] = useState(log.name);
  const [editCost, setEditCost] = useState(log.cost.toString());
  const [editCategory, setEditCategory] = useState(log.category);
  const [editDate, setEditDate] = useState(new Date(log.timestamp));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    if (log) {
      setEditName(log.name);
      setEditCost(log.cost.toString());
      setEditCategory(log.category);
      setEditDate(new Date(log.timestamp));
    }
  }, [log]);

  const handleSave = () => {
    if (!editName.trim()) {
      Alert.alert('Validation Error', 'Please enter an item name.');
      return;
    }
    const price = parseFloat(editCost);
    if (isNaN(price) || price <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid cost amount.');
      return;
    }
    onSave(log.id, {
      name: editName.trim(),
      cost: price,
      category: editCategory,
      timestamp: editDate.getTime(),
    });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.editCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
          <Text style={[styles.editTitle, { color: colors.text }]}>Edit Expense</Text>

          <TextInput
            style={[styles.textInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
            placeholder="Item name"
            placeholderTextColor={colors.textSecondary}
            value={editName}
            onChangeText={setEditName}
          />

          <View style={styles.formRow}>
            <TextInput
              style={[
                styles.textInput,
                styles.costInput,
                { color: colors.text, borderColor: colors.border, backgroundColor: colors.background },
              ]}
              placeholder="Cost"
              placeholderTextColor={colors.textSecondary}
              value={editCost}
              onChangeText={setEditCost}
              keyboardType="decimal-pad"
            />

            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              style={[styles.datePickerBtn, { borderColor: colors.border, backgroundColor: colors.background }]}
            >
              <Feather name="calendar" size={14} color={colors.primary} />
              <Text style={{ color: colors.text, fontSize: 11, fontFamily: FontFace.semibold }} numberOfLines={1}>
                {editDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowTimePicker(true)}
              style={[styles.datePickerBtn, { borderColor: colors.border, backgroundColor: colors.background }]}
            >
              <Feather name="clock" size={14} color={colors.primary} />
              <Text style={{ color: colors.text, fontSize: 11, fontFamily: FontFace.semibold }} numberOfLines={1}>
                {editDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={{ fontSize: 10, fontFamily: FontFace.bold, color: colors.textSecondary, marginTop: 4 }}>
            CATEGORY
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryContainer}
            style={{ maxHeight: 50, marginBottom: 15 }}
          >
            {CATEGORIES.map((cat) => {
              const selected = editCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setEditCategory(cat)}
                  style={[
                    styles.catBtn,
                    {
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? colors.primary : 'transparent',
                      paddingHorizontal: 12,
                      marginRight: 6,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.catBtnText,
                      { color: selected ? '#FFF' : colors.text, fontFamily: FontFace.bold },
                    ]}
                  >
                    {cat.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.editActions}>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.actionBtn, { borderColor: colors.border }]}
            >
              <Text style={{ color: colors.text, fontFamily: FontFace.bold }}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                Alert.alert('Delete Log', 'Delete this purchase log?', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                      onDelete(log.id);
                      onClose();
                    },
                  },
                ]);
              }}
              style={[styles.actionBtn, { borderColor: colors.alert }]}
            >
              <Text style={{ color: colors.alert, fontFamily: FontFace.bold }}>Delete</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSave}
              disabled={isSaving}
              style={[styles.actionBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={{ color: '#FFF', fontFamily: FontFace.bold }}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <CalendarPicker
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        selectedDate={editDate}
        onSelectDate={setEditDate}
        colors={colors}
      />

      <TimePicker
        visible={showTimePicker}
        onClose={() => setShowTimePicker(false)}
        selectedDate={editDate}
        onSelectTime={setEditDate}
        colors={colors}
      />
    </Modal>
  );
}

export default function PurchasesDailyReportScreen() {
  const router = useRouter();
  const { dateMs } = useLocalSearchParams<{ dateMs: string }>();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];

  const targetDate = dateMs ? new Date(parseInt(dateMs)) : new Date();

  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<PurchasesStorage.PurchaseLog[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Edit Expense modal states
  const [editingLog, setEditingLog] = useState<PurchasesStorage.PurchaseLog | null>(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);

  const fetchDayData = async () => {
    setLoading(true);
    try {
      const allLogs = await PurchasesStorage.getPurchases();

      const dayStart = new Date(targetDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(targetDate);
      dayEnd.setHours(23, 59, 59, 999);

      const filtered = allLogs.filter(
        (l) => l.timestamp >= dayStart.getTime() && l.timestamp <= dayEnd.getTime()
      );
      setLogs(filtered.sort((a, b) => b.timestamp - a.timestamp));
    } catch (e) {
      console.warn('Failed to load purchases report:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDayData();
  }, [dateMs]);

  const handleEditSave = async (id: string, updates: Partial<Omit<PurchasesStorage.PurchaseLog, 'id'>>) => {
    setIsSaving(true);
    try {
      await PurchasesStorage.updatePurchase(id, updates);
      // Reload day data to sync
      await fetchDayData();
      WidgetSync.sync();
    } catch (e) {
      Alert.alert('Error', 'Failed to update entry.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setIsSaving(true);
    try {
      await PurchasesStorage.deletePurchase(id);
      setLogs((prev) => prev.filter((l) => l.id !== id));
      WidgetSync.sync();
    } catch (e) {
      Alert.alert('Error', 'Failed to delete purchase.');
    } finally {
      setIsSaving(false);
    }
  };

  const totalSpent = logs.reduce((sum, l) => sum + l.cost, 0);
  const totalTransactions = logs.length;
  const avgCost = totalTransactions > 0 ? totalSpent / totalTransactions : 0;

  const formattedDate = targetDate.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <AnimatedPressable
            onPress={() => router.back()}
            style={[styles.backBtn, { borderColor: colors.border }]}
          >
            <Feather name="arrow-left" size={20} color={colors.text} />
          </AnimatedPressable>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.headerTitle}>
            DAILY SPEND REPORT
          </ThemedText>
          <View style={{ width: 40 }} />
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={logs}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.scrollContent}
            ListHeaderComponent={
              <View style={{ gap: Spacing.four, marginBottom: Spacing.two }}>
                {/* Selected Day Title */}
                <Animated.View entering={FadeInDown.duration(400)} style={styles.titleCard}>
                  <Text style={[styles.dateLabel, { color: colors.text }]}>{formattedDate}</Text>
                  <Text style={[styles.subtitleLabel, { color: colors.textSecondary }]}>
                    Expenditures list and financial breakdown.
                  </Text>
                </Animated.View>

                {/* Spent Summary Card */}
                <Animated.View
                  entering={FadeInDown.duration(500).delay(100)}
                  style={[styles.summaryCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}
                >
                  <View style={styles.summaryRow}>
                    <View>
                      <Text style={{ fontSize: 11, fontFamily: FontFace.bold, color: colors.textSecondary, letterSpacing: 0.5 }}>
                        TOTAL SPENT
                      </Text>
                      <Text style={[styles.totalVolume, { color: colors.primary }]}>
                        ₹{totalSpent.toFixed(2)}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 11, fontFamily: FontFace.bold, color: colors.textSecondary, letterSpacing: 0.5 }}>
                        TRANSACTIONS
                      </Text>
                      <Text style={[styles.goalVolume, { color: colors.text }]}>
                        {totalTransactions}
                      </Text>
                    </View>
                  </View>

                  <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />

                  <View style={styles.summaryRow}>
                    <View>
                      <Text style={{ fontSize: 10, color: colors.textSecondary, fontFamily: FontFace.semibold }}>
                        Average transaction
                      </Text>
                      <Text style={{ fontSize: 14, color: colors.text, fontFamily: FontFace.bold, marginTop: 2 }}>
                        ₹{avgCost.toFixed(2)}
                      </Text>
                    </View>
                  </View>
                </Animated.View>

                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                  TRANSACTIONS ({logs.length} Entries)
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const itemDate = new Date(item.timestamp);
              const timeStr = itemDate.toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
                timeZone: 'Asia/Kolkata',
              });

              return (
                <TouchableOpacity
                  onPress={() => {
                    setEditingLog(item);
                    setIsEditModalVisible(true);
                  }}
                  style={[styles.itemRow, { borderColor: colors.border }]}
                >
                  <View style={styles.itemLeft}>
                    <View style={[styles.cupIconWrapper, { backgroundColor: colors.primary + '12' }]}>
                      <Feather name="shopping-bag" size={16} color={colors.primary} />
                    </View>
                    <View style={{ gap: 2 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.itemMlText, { color: colors.text }]}>
                          {item.name}
                        </Text>
                        <View style={[styles.miniBadge, { borderColor: colors.border }]}>
                          <Text style={{ fontSize: 8, fontFamily: FontFace.bold, color: colors.textSecondary, textTransform: 'uppercase' }}>
                            {item.category}
                          </Text>
                        </View>
                      </View>
                      <Text style={{ fontFamily: FontFace.regular, fontSize: 10, color: colors.textSecondary }}>
                        Logged at {timeStr}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Text style={{ color: colors.text, fontSize: 15, fontFamily: FontFace.bold }}>
                      ₹{item.cost.toFixed(2)}
                    </Text>
                    <Feather name="chevron-right" size={14} color={colors.textSecondary} />
                  </View>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Feather name="info" size={24} color={colors.textSecondary} style={{ marginBottom: Spacing.one, opacity: 0.6 }} />
                <Text style={{ fontFamily: FontFace.regular, fontSize: 12, color: colors.textSecondary }}>
                  No expenditures found for this day.
                </Text>
              </View>
            }
          />
        )}

        <EditExpenseModal
          visible={isEditModalVisible}
          onClose={() => {
            setIsEditModalVisible(false);
            setEditingLog(null);
          }}
          log={editingLog}
          onSave={handleEditSave}
          onDelete={handleDelete}
          colors={colors}
          isSaving={isSaving}
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
    fontFamily: FontFace.bold,
    letterSpacing: 1.5,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  titleCard: {
    marginTop: 10,
    gap: 4,
  },
  dateLabel: {
    fontSize: 22,
    fontFamily: FontFace.bold,
    letterSpacing: -0.5,
  },
  subtitleLabel: {
    fontSize: 12,
    fontFamily: FontFace.medium,
  },
  summaryCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalVolume: {
    fontSize: 32,
    fontFamily: FontFace.bold,
    letterSpacing: -1,
    marginTop: 4,
  },
  goalVolume: {
    fontSize: 24,
    fontFamily: FontFace.bold,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: FontFace.bold,
    letterSpacing: 0.8,
    marginTop: 20,
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cupIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemMlText: {
    fontSize: 15,
    fontFamily: FontFace.bold,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  miniBadge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  calendarCard: {
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  calHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  calNavBtn: {
    padding: 8,
  },
  calMonthText: {
    fontSize: 16,
    fontFamily: FontFace.bold,
  },
  calWeekdays: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  calWeekdayText: {
    width: 36,
    textAlign: 'center',
    fontSize: 11,
    fontFamily: FontFace.bold,
  },
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 8,
    columnGap: 8,
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  calCell: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calCellText: {
    fontSize: 12,
    fontFamily: FontFace.semibold,
  },
  calCloseBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calCloseBtnText: {
    fontSize: 13,
    fontFamily: FontFace.bold,
  },
  timeNavBtn: {
    padding: 4,
  },
  ampmBtn: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
  },
  editCard: {
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  editTitle: {
    fontSize: 18,
    fontFamily: FontFace.bold,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  actionBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textInput: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    fontSize: 13,
    fontFamily: FontFace.regular,
  },
  costInput: {
    width: 90,
  },
  datePickerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  categoryContainer: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  catBtn: {
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  catBtnText: {
    fontSize: 10,
    fontFamily: FontFace.bold,
    letterSpacing: 0.5,
  },
  formRow: {
    flexDirection: 'row',
    gap: 10,
  },
});
