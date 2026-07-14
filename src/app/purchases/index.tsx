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
  Modal,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Skeleton from '@/components/SkeletonLoader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import * as PurchasesStorage from '@/utils/PurchasesStorage';
import * as WidgetSync from '@/utils/WidgetSync';

export type CategoryType = 'Groceries' | 'Dairy' | 'Veggies' | 'Snacks' | 'Transport' | 'Bills' | 'Health' | 'Food' | 'Shopping' | 'Misc';

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

  // Fill up the rest of the cells to complete grid row (multiple of 7, total 42 max for a clean grid)
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

  const handlePrevMonth = () => {
    setNavDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setNavDate(new Date(year, month + 1, 1));
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.calendarCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
          {/* Calendar Header */}
          <View style={styles.calHeader}>
            <TouchableOpacity onPress={handlePrevMonth} style={styles.calNavBtn}>
              <Feather name="chevron-left" size={18} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.calMonthText, { color: colors.text }]}>
              {monthNames[month]} {year}
            </Text>
            <TouchableOpacity onPress={handleNextMonth} style={styles.calNavBtn}>
              <Feather name="chevron-right" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Weekday headers */}
          <View style={styles.calWeekdaysRow}>
            {weekdays.map((w) => (
              <Text key={w} style={[styles.calWeekdayText, { color: colors.textSecondary }]}>
                {w}
              </Text>
            ))}
          </View>

          {/* Days Grid */}
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
                      isSelected && { color: '#FFF', fontWeight: '800' },
                    ]}
                  >
                    {cell.day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Close button */}
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
            {/* Hours Adjuster */}
            <View style={{ alignItems: 'center' }}>
              <TouchableOpacity onPress={incrementHours} style={styles.timeNavBtn}>
                <Feather name="chevron-up" size={24} color={colors.primary} />
              </TouchableOpacity>
              <Text style={{ fontSize: 32, fontWeight: '700', color: colors.text, marginVertical: 8 }}>
                {hours.toString().padStart(2, '0')}
              </Text>
              <TouchableOpacity onPress={decrementHours} style={styles.timeNavBtn}>
                <Feather name="chevron-down" size={24} color={colors.primary} />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 32, fontWeight: '700', color: colors.textSecondary, alignSelf: 'center', marginTop: -6 }}>
              :
            </Text>

            {/* Minutes Adjuster */}
            <View style={{ alignItems: 'center' }}>
              <TouchableOpacity onPress={incrementMinutes} style={styles.timeNavBtn}>
                <Feather name="chevron-up" size={24} color={colors.primary} />
              </TouchableOpacity>
              <Text style={{ fontSize: 32, fontWeight: '700', color: colors.text, marginVertical: 8 }}>
                {minutes.toString().padStart(2, '0')}
              </Text>
              <TouchableOpacity onPress={decrementMinutes} style={styles.timeNavBtn}>
                <Feather name="chevron-down" size={24} color={colors.primary} />
              </TouchableOpacity>
            </View>

            {/* AM/PM Selector */}
            <View style={{ gap: 8, marginLeft: 10 }}>
              <TouchableOpacity
                onPress={() => setPeriod('AM')}
                style={[
                  styles.ampmBtn,
                  { borderColor: colors.border },
                  period === 'AM' && { backgroundColor: colors.primary, borderColor: colors.primary }
                ]}
              >
                <Text style={{ color: period === 'AM' ? '#FFF' : colors.text, fontWeight: '700', fontSize: 13 }}>
                  AM
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setPeriod('PM')}
                style={[
                  styles.ampmBtn,
                  { borderColor: colors.border },
                  period === 'PM' && { backgroundColor: colors.primary, borderColor: colors.primary }
                ]}
              >
                <Text style={{ color: period === 'PM' ? '#FFF' : colors.text, fontWeight: '700', fontSize: 13 }}>
                  PM
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.calCloseBtn, { flex: 1, borderColor: colors.border, marginTop: 0 }]}
            >
              <Text style={{ color: colors.text, fontWeight: '700' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              style={[styles.calCloseBtn, { flex: 1, backgroundColor: colors.primary, borderColor: colors.primary, marginTop: 0 }]}
            >
              <Text style={{ color: '#FFF', fontWeight: '700' }}>Set Time</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Edit Expense Modal Component ────────────────────────────────────────────
function EditExpenseModal({ visible, onClose, log, onSave, onDelete, colors, isSaving }: any) {
  if (!log) return null;

  const [editName, setEditName] = useState(log.name);
  const [editCost, setEditCost] = useState(log.cost.toString());
  const [editCategory, setEditCategory] = useState(log.category);
  const [editDate, setEditDate] = useState(new Date(log.timestamp));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Sync state if modal log changes
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
              <Text style={{ color: colors.text, fontSize: 11, fontWeight: '600' }} numberOfLines={1}>
                {editDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowTimePicker(true)}
              style={[styles.datePickerBtn, { borderColor: colors.border, backgroundColor: colors.background }]}
            >
              <Feather name="clock" size={14} color={colors.primary} />
              <Text style={{ color: colors.text, fontSize: 11, fontWeight: '600' }} numberOfLines={1}>
                {editDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Category Selector */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryContainer}
            style={{ maxHeight: 50, marginBottom: 15 }}
          >
            {(['Groceries', 'Dairy', 'Veggies', 'Snacks', 'Transport', 'Bills', 'Health', 'Food', 'Shopping', 'Misc'] as CategoryType[]).map((cat) => {
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
                  <Text style={{ color: selected ? '#FFF' : colors.text, fontSize: 10, fontWeight: '700' }}>
                    {cat.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Action Row */}
          <View style={styles.editActionRow}>
            <TouchableOpacity
              onPress={() => {
                onClose();
                onDelete(log.id);
              }}
              style={[styles.actionBtn, styles.deleteActionBtn, { borderColor: colors.alert }]}
            >
              <Feather name="trash-2" size={16} color={colors.alert} />
              <Text style={{ color: colors.alert, fontWeight: '700', fontSize: 13 }}>Delete</Text>
            </TouchableOpacity>

            <View style={{ flex: 1, flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
              <TouchableOpacity
                onPress={onClose}
                style={[styles.actionBtn, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSave}
                disabled={isSaving}
                style={[styles.actionBtn, { backgroundColor: colors.primary, borderColor: colors.primary, opacity: isSaving ? 0.8 : 1 }]}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 13 }}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Calendar Picker modal */}
          <CalendarPicker
            visible={showDatePicker}
            onClose={() => setShowDatePicker(false)}
            selectedDate={editDate}
            onSelectDate={setEditDate}
            colors={colors}
          />

          {/* Time Picker modal */}
          <TimePicker
            visible={showTimePicker}
            onClose={() => setShowTimePicker(false)}
            selectedDate={editDate}
            onSelectTime={setEditDate}
            colors={colors}
          />
        </View>
      </View>
    </Modal>
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
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Edit states
  const [editingLog, setEditingLog] = useState<PurchasesStorage.PurchaseLog | null>(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);

  // Load data
  useEffect(() => {
    loadPurchases();
  }, []);

  async function loadPurchases() {
    try {
      const data = await PurchasesStorage.getPurchases();
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

    setIsSaving(true);
    try {
      const newLog = await PurchasesStorage.savePurchase(name, price, category, selectedDate.getTime());
      setLogs((prev) => [newLog, ...prev].sort((a, b) => b.timestamp - a.timestamp));
      setName('');
      setCost('');
      setCategory('Groceries');
      setSelectedDate(new Date());
      Keyboard.dismiss();
      WidgetSync.sync();
    } catch (e) {
      Alert.alert('Error', 'Failed to save purchase.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditSave = async (id: string, updates: Partial<Omit<PurchasesStorage.PurchaseLog, 'id'>>) => {
    setIsSaving(true);
    try {
      await PurchasesStorage.updatePurchase(id, updates);
      setLogs((prev) =>
        prev
          .map((log) => (log.id === id ? { ...log, ...updates } : log))
          .sort((a, b) => b.timestamp - a.timestamp)
      );
      WidgetSync.sync();
    } catch (e) {
      Alert.alert('Error', 'Failed to update purchase.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert('Delete Entry', 'Are you sure you want to delete this purchase?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setIsSaving(true);
          try {
            await PurchasesStorage.deletePurchase(id);
            setLogs((prev) => prev.filter((log) => log.id !== id));
            WidgetSync.sync();
          } catch (e) {
            Alert.alert('Error', 'Failed to delete purchase.');
          } finally {
            setIsSaving(false);
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
          setIsSaving(true);
          try {
            await PurchasesStorage.clearPurchases();
            setLogs([]);
            WidgetSync.sync();
          } catch (e) {
            Alert.alert('Error', 'Failed to clear data.');
          } finally {
            setIsSaving(false);
          }
        },
      },
    ]);
  };

  // Stats calculation
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const todayLogs = logs.filter((log) => log.timestamp >= midnight.getTime());
  const todayTotal = todayLogs.reduce((acc, curr) => acc + curr.cost, 0);
  const allTimeTotal = logs.reduce((acc, curr) => acc + curr.cost, 0);

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
        {loading ? (
          <View style={styles.scrollContent}>
            {/* Daily Total Summary Card Skeleton */}
            <View style={[styles.totalBar, { borderColor: colors.border, backgroundColor: colors.backgroundElement }]}>
              <View style={{ gap: 4 }}>
                <Skeleton width={80} height={10} />
                <Skeleton width={100} height={24} style={{ marginTop: 4 }} />
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Skeleton width={90} height={10} />
                <Skeleton width={100} height={24} style={{ marginTop: 4 }} />
              </View>
            </View>

            {/* Input Form Panel Skeleton */}
            <View style={[styles.formPanel, { borderColor: colors.border, backgroundColor: colors.backgroundElement, gap: 12 }]}>
              <Skeleton width={100} height={10} />
              <Skeleton width="100%" height={40} borderRadius={8} />
              <View style={[styles.formRow, { gap: 10 }]}>
                <Skeleton width="40%" height={40} borderRadius={8} />
                <Skeleton width="28%" height={40} borderRadius={8} />
                <Skeleton width="28%" height={40} borderRadius={8} />
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginVertical: 4 }}>
                <Skeleton width={70} height={30} borderRadius={15} />
                <Skeleton width={60} height={30} borderRadius={15} />
                <Skeleton width={65} height={30} borderRadius={15} />
                <Skeleton width={60} height={30} borderRadius={15} />
                <Skeleton width={60} height={30} borderRadius={15} />
              </View>
              <Skeleton width="100%" height={44} borderRadius={8} />
            </View>

            {/* Spends Title Skeleton */}
            <Skeleton width={180} height={12} style={{ alignSelf: 'flex-start', marginTop: 24, marginBottom: 8 }} />

            {/* Spends List Item Skeletons */}
            <View style={{ gap: 12, width: '100%' }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <View key={i} style={[styles.itemCard, { borderColor: colors.border, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                  <View style={{ gap: 6, flex: 1 }}>
                    <Skeleton width={120} height={14} />
                    <Skeleton width={160} height={10} />
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <Skeleton width={60} height={16} />
                    <Skeleton width={50} height={10} borderRadius={4} />
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            data={logs}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View style={{ gap: Spacing.four, marginBottom: Spacing.two }}>
                {/* Daily Total Summary Card */}
                <View style={[styles.totalBar, { borderColor: colors.border, backgroundColor: colors.backgroundElement }]}>
                  <View>
                    <ThemedText type="code" style={{ fontSize: 10, fontWeight: '700' }} themeColor="textSecondary">
                      TODAY'S SPEND
                    </ThemedText>
                    <ThemedText type="subtitle" style={[styles.totalCost, { color: colors.primary }]}>
                      ₹{todayTotal.toFixed(2)}
                    </ThemedText>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <ThemedText type="code" style={{ fontSize: 10, fontWeight: '700' }} themeColor="textSecondary">
                      ALL-TIME SPEND
                    </ThemedText>
                    <ThemedText type="subtitle" style={[styles.totalCost, { color: colors.text }]}>
                      ₹{allTimeTotal.toFixed(2)}
                    </ThemedText>
                  </View>
                </View>

                {/* Input Form Panel */}
                <View style={[styles.formPanel, { borderColor: colors.border, backgroundColor: colors.backgroundElement }]}>
                  <ThemedText type="code" style={{ fontSize: 10, fontWeight: '700', marginBottom: Spacing.one }} themeColor="textSecondary">
                    RECORD EXPENSE
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

                    {/* Custom Date Field */}
                    <TouchableOpacity
                      onPress={() => setShowDatePicker(true)}
                      style={[styles.datePickerBtn, { borderColor: colors.border, backgroundColor: colors.background }]}
                    >
                      <Feather name="calendar" size={14} color={colors.primary} />
                      <Text style={{ color: colors.text, fontSize: 11, fontWeight: '600' }} numberOfLines={1}>
                        {selectedDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </Text>
                    </TouchableOpacity>

                    {/* Custom Time Field */}
                    <TouchableOpacity
                      onPress={() => setShowTimePicker(true)}
                      style={[styles.datePickerBtn, { borderColor: colors.border, backgroundColor: colors.background }]}
                    >
                      <Feather name="clock" size={14} color={colors.primary} />
                      <Text style={{ color: colors.text, fontSize: 11, fontWeight: '600' }} numberOfLines={1}>
                        {selectedDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Category Toggles */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.categoryContainer}
                    style={{ maxHeight: 50, marginBottom: 15 }}
                  >
                    {(['Groceries', 'Dairy', 'Veggies', 'Snacks', 'Transport', 'Bills', 'Health', 'Food', 'Shopping', 'Misc'] as CategoryType[]).map((cat) => {
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
                              paddingHorizontal: 12,
                              marginRight: 6,
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
                            {cat.toUpperCase()}
                          </ThemedText>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  <AnimatedPressable
                    onPress={handleAddPurchase}
                    disabled={isSaving}
                    style={[
                      styles.submitBtn,
                      {
                        borderColor: colors.primary,
                        backgroundColor: colors.primary,
                        opacity: isSaving ? 0.8 : 1,
                      },
                    ]}
                  >
                    {isSaving ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <ThemedText type="smallBold" style={{ color: '#FFF' }}>
                        Record Entry
                      </ThemedText>
                    )}
                  </AnimatedPressable>
                </View>

                <ThemedText type="smallBold" style={styles.sectionTitle} themeColor="textSecondary">
                  ALL RECORDED SPENDS (TAP TO EDIT)
                </ThemedText>
              </View>
            }
            renderItem={({ item }) => {
              const itemDate = new Date(item.timestamp);
              const todayStr = new Date().toDateString();
              const yesterday = new Date();
              yesterday.setDate(yesterday.getDate() - 1);
              const yesterdayStr = yesterday.toDateString();

              let dateStr = '';
              if (itemDate.toDateString() === todayStr) {
                dateStr = 'Today';
              } else if (itemDate.toDateString() === yesterdayStr) {
                dateStr = 'Yesterday';
              } else {
                dateStr = itemDate.toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: itemDate.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
                  timeZone: 'Asia/Kolkata',
                });
              }
              const timeStr = itemDate.toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'Asia/Kolkata',
              });
              const formattedDate = `${dateStr} • ${timeStr}`;

              return (
                <TouchableOpacity
                  onPress={() => {
                    setEditingLog(item);
                    setIsEditModalVisible(true);
                  }}
                  style={[styles.itemCard, { borderColor: colors.border }]}
                >
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
                      {formattedDate}
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
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Feather name="shopping-bag" size={32} color={colors.textSecondary} style={{ marginBottom: Spacing.two, opacity: 0.8 }} />
                <ThemedText type="code" themeColor="textSecondary" style={{ textAlign: 'center', fontSize: 12 }}>
                  No records logged
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center', marginTop: Spacing.one }}>
                  Log items above to track shopping expenses.
                </ThemedText>
              </View>
            }
          />
        )}

        {/* Global Calendar Picker modal */}
        <CalendarPicker
          visible={showDatePicker}
          onClose={() => setShowDatePicker(false)}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          colors={colors}
        />

        {/* Global Time Picker modal */}
        <TimePicker
          visible={showTimePicker}
          onClose={() => setShowTimePicker(false)}
          selectedDate={selectedDate}
          onSelectTime={setSelectedDate}
          colors={colors}
        />

        {/* Edit Expense Modal */}
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
  totalCost: {
    fontSize: 20,
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
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  calendarCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
  },
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 16,
  },
  calNavBtn: {
    padding: 8,
  },
  calMonthText: {
    fontSize: 15,
    fontWeight: '800',
  },
  calWeekdaysRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  calWeekdayText: {
    width: 38,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
  },
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    justifyContent: 'space-between',
    gap: 4,
    marginBottom: 16,
  },
  calCell: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calCellText: {
    fontSize: 12,
    fontWeight: '600',
  },
  calCloseBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '100%',
  },
  calCloseBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  editCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 14,
  },
  editTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  editActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 10,
  },
  actionBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  deleteActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeNavBtn: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ampmBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
  },
});
