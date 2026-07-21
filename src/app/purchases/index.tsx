import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState, useCallback, useRef } from 'react';
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
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Skeleton from '@/components/SkeletonLoader';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  Easing,
  FadeInDown,
} from 'react-native-reanimated';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AnimatedPressable } from '@/components/ui/animated-pressable';
import * as PurchasesStorage from '@/utils/PurchasesStorage';
import * as WidgetSync from '@/utils/WidgetSync';
import * as LocalAuthentication from 'expo-local-authentication';
import AppLoader from '@/components/AppLoader';

// Expanded Categories List (20 categories)
export const CATEGORIES = [
  'Groceries', 'Dairy', 'Veggies', 'Snacks', 'Transport',
  'Bills', 'Health', 'Food', 'Shopping', 'Misc',
  'Rent', 'Entertainment', 'Education', 'Subscriptions',
  'Travel', 'Clothing', 'Gadgets', 'Investments',
  'Insurance', 'Income'
];

export type CategoryType = string;

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
          {/* Header controls */}
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

          {/* Weekday headers */}
          <View style={styles.calWeekdays}>
            {weekdays.map((w, idx) => (
              <Text key={idx} style={[styles.calWeekdayText, { color: colors.textSecondary }]}>
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
                <Text style={{ color: period === 'AM' ? '#FFF' : colors.text, fontSize: 12, fontWeight: '700' }}>AM</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setPeriod('PM')}
                style={[
                  styles.ampmBtn,
                  { borderColor: colors.border },
                  period === 'PM' && { backgroundColor: colors.primary, borderColor: colors.primary }
                ]}
              >
                <Text style={{ color: period === 'PM' ? '#FFF' : colors.text, fontSize: 12, fontWeight: '700' }}>PM</Text>
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
          <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textSecondary, marginTop: 4 }}>
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
                      { color: selected ? '#FFF' : colors.text, fontWeight: '700' },
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
              <Text style={{ color: colors.text, fontWeight: '700' }}>Cancel</Text>
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
              <Text style={{ color: colors.alert, fontWeight: '700' }}>Delete</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSave}
              disabled={isSaving}
              style={[styles.actionBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={{ color: '#FFF', fontWeight: '700' }}>Save</Text>
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

// ── Weekly Chart Animated Bar ───────────────────────────────────────────────
function WeeklySpendBar({
  dayName,
  amount,
  maxAmount,
  colors,
  isSelected,
  onPress,
}: {
  dayName: string;
  amount: number;
  maxAmount: number;
  colors: any;
  isSelected: boolean;
  onPress: () => void;
}) {
  const heightPercent = maxAmount > 0 ? Math.min(amount / maxAmount, 1.2) : 0;
  const heightVal = useSharedValue(0);

  useEffect(() => {
    heightVal.value = withTiming(heightPercent * 130, { duration: 1000 });
  }, [amount, maxAmount]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: heightVal.value,
  }));

  const getBarColor = () => {
    if (amount > 0) return colors.primary;
    return colors.border;
  };

  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={styles.barCol}>
      <Text style={[styles.barValText, { color: isSelected ? colors.primary : colors.textSecondary, fontWeight: isSelected ? '900' : '700' }]}>
        {amount > 0 ? `₹${amount.toFixed(0)}` : '0'}
      </Text>
      <View style={[styles.barTrack, { backgroundColor: colors.backgroundSelected, borderColor: isSelected ? colors.primary : 'transparent', borderWidth: isSelected ? 1.5 : 0 }]}>
        <Animated.View
          style={[
            styles.barFill,
            animatedStyle,
            { backgroundColor: getBarColor() },
          ]}
        />
      </View>
      <Text style={[styles.barLabel, { color: isSelected ? colors.primary : colors.text, fontWeight: isSelected ? '900' : '700' }]}>
        {dayName}
      </Text>
    </TouchableOpacity>
  );
}

// ── Monthly Category Bar Component ───────────────────────────────────────────
function CategoryBar({ category, amount, percentage, color, textColor }: any) {
  const progressWidth = useSharedValue(0);

  useEffect(() => {
    progressWidth.value = withTiming(percentage, { duration: 1000 });
  }, [percentage]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  return (
    <View style={styles.catRow}>
      <View style={styles.catInfo}>
        <Text style={[styles.catName, { color: textColor }]}>
          {category}
        </Text>
        <Text style={[styles.catAmount, { color: textColor }]}>
          ₹{amount.toFixed(2)} ({percentage.toFixed(0)}%)
        </Text>
      </View>
      <View style={[styles.progressBarTrack, { backgroundColor: '#E2E8F015' }]}>
        <Animated.View
          style={[
            styles.progressBarFill,
            progressStyle,
            { backgroundColor: color },
          ]}
        />
      </View>
    </View>
  );
}

// ── Navigation Tabs ──────────────────────────────────────────────────────────
export function PurchasesTabs({ activeTab, onTabPress }: { activeTab: 'daily' | 'weekly' | 'monthly'; onTabPress: (tab: 'daily' | 'weekly' | 'monthly') => void }) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];

  return (
    <View style={[styles.tabsWrapper, { backgroundColor: colors.backgroundSelected }]}>
      <TouchableOpacity
        onPress={() => onTabPress('daily')}
        style={[styles.tabBtn, activeTab === 'daily' && [styles.tabActiveBtn, { backgroundColor: colors.backgroundElement }]]}
      >
        <Text style={[styles.tabText, { color: activeTab === 'daily' ? colors.text : colors.textSecondary }]}>Daily</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => onTabPress('weekly')}
        style={[styles.tabBtn, activeTab === 'weekly' && [styles.tabActiveBtn, { backgroundColor: colors.backgroundElement }]]}
      >
        <Text style={[styles.tabText, { color: activeTab === 'weekly' ? colors.text : colors.textSecondary }]}>Weekly</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => onTabPress('monthly')}
        style={[styles.tabBtn, activeTab === 'monthly' && [styles.tabActiveBtn, { backgroundColor: colors.backgroundElement }]]}
      >
        <Text style={[styles.tabText, { color: activeTab === 'monthly' ? colors.text : colors.textSecondary }]}>Monthly</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Spend Tracker Screen ─────────────────────────────────────────────────────
function SpendTrackerContent() {
  const router = useRouter();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];
  const { width: windowWidth } = useWindowDimensions();
  const scrollViewRef = useRef<ScrollView>(null);

  const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  // Shared pulse animation for loading states
  const pulseVal = useSharedValue(0.35);
  useEffect(() => {
    pulseVal.value = withRepeat(
      withTiming(0.8, { duration: 1000, easing: Easing.bezier(0.25, 0.1, 0.25, 1) }),
      -1,
      true
    );
  }, []);

  const skeletonPulseStyle = useAnimatedStyle(() => ({
    opacity: pulseVal.value,
  }));

  // ───────────────────────────────────────────────────────────────────────────
  // ── DAILY TAB STATES & LOGIC ───────────────────────────────────────────────
  // ───────────────────────────────────────────────────────────────────────────
  const [logs, setLogs] = useState<PurchasesStorage.PurchaseLog[]>([]);
  const [loadingDaily, setLoadingDaily] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form Fields
  const [name, setName] = useState('');
  const [cost, setCost] = useState('');
  const [category, setCategory] = useState<CategoryType>('Groceries');
  const [selectedDate, setSelectedDate] = useState(new Date());

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Edit Expense modal states
  const [editingLog, setEditingLog] = useState<PurchasesStorage.PurchaseLog | null>(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);

  const loadDailyLogs = async () => {
    setLoadingDaily(true);
    try {
      const data = await PurchasesStorage.getPurchases();
      // sort desc by timestamp
      setLogs(data.sort((a, b) => b.timestamp - a.timestamp));
    } catch (e) {
      console.warn('Failed to load purchases', e);
    } finally {
      setLoadingDaily(false);
    }
  };

  const handleAddPurchase = async () => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Please enter an item name.');
      return;
    }
    const costVal = parseFloat(cost);
    if (isNaN(costVal) || costVal <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid price/cost.');
      return;
    }

    setIsSaving(true);
    try {
      const newLog = await PurchasesStorage.savePurchase(
        name.trim(),
        costVal,
        category,
        selectedDate.getTime()
      );
      setLogs((prev) => [newLog, ...prev]);

      // Reset form
      setName('');
      setCost('');
      setSelectedDate(new Date());
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
        prev.map((log) => (log.id === id ? { ...log, ...updates } : log))
      );
      WidgetSync.sync();
    } catch (e) {
      Alert.alert('Error', 'Failed to update entry.');
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

  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const todayLogs = logs.filter((log) => log.timestamp >= midnight.getTime());
  const todayTotal = todayLogs.reduce((acc, curr) => acc + curr.cost, 0);
  const allTimeTotal = logs.reduce((acc, curr) => acc + curr.cost, 0);

  // ───────────────────────────────────────────────────────────────────────────
  // ── WEEKLY TAB STATES & LOGIC ──────────────────────────────────────────────
  // ───────────────────────────────────────────────────────────────────────────
  const [loadingWeekly, setLoadingWeekly] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week, -1 = last week, etc.
  const [weeklySpends, setWeeklySpends] = useState<{ dayName: string; date: Date; amount: number }[]>([]);
  const [weeklyRawLogs, setWeeklyRawLogs] = useState<PurchasesStorage.PurchaseLog[]>([]);
  const [selectedWeeklyDay, setSelectedWeeklyDay] = useState<{ dayName: string; date: Date; amount: number } | null>(null);
  const [selectedWeeklyLogs, setSelectedWeeklyLogs] = useState<PurchasesStorage.PurchaseLog[]>([]);

  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const refreshWeeklyData = async () => {
    setLoadingWeekly(true);
    try {
      const refDateMs = Date.now() + weekOffset * 7 * 24 * 60 * 60 * 1000;
      const now = new Date(refDateMs);
      const dayOfWeek = now.getDay();
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
      monday.setHours(0, 0, 0, 0);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      // Filter from master logs list
      const rawLogs = logs.filter(
        (log: PurchasesStorage.PurchaseLog) => log.timestamp >= monday.getTime() && log.timestamp <= sunday.getTime()
      );
      setWeeklyRawLogs(rawLogs);

      // Accumulate daily totals
      const dailyTotals = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const dayStart = d.getTime();
        const dayEnd = dayStart + 86400000 - 1;
        const total = rawLogs
          .filter((log: PurchasesStorage.PurchaseLog) => log.timestamp >= dayStart && log.timestamp <= dayEnd)
          .reduce((acc: number, l: PurchasesStorage.PurchaseLog) => acc + l.cost, 0);

        return {
          dayName: weekdays[i],
          date: d,
          amount: total,
        };
      });
      setWeeklySpends(dailyTotals);

      // Default selected day to Monday or the active selection
      if (dailyTotals.length > 0) {
        setSelectedWeeklyDay(dailyTotals[0]);
        const dayStart = dailyTotals[0].date.getTime();
        const dayEnd = dayStart + 86400000 - 1;
        const filtered = rawLogs.filter((l: PurchasesStorage.PurchaseLog) => l.timestamp >= dayStart && l.timestamp <= dayEnd);
        setSelectedWeeklyLogs(filtered.sort((a: PurchasesStorage.PurchaseLog, b: PurchasesStorage.PurchaseLog) => b.timestamp - a.timestamp));
      } else {
        setSelectedWeeklyDay(null);
        setSelectedWeeklyLogs([]);
      }
    } catch (e) {
      console.warn('Failed to load weekly spend data:', e);
    } finally {
      setLoadingWeekly(false);
    }
  };

  const handleSelectWeeklyDay = (day: { dayName: string; date: Date; amount: number }) => {
    router.push({
      pathname: '/purchases/report' as any,
      params: { dateMs: day.date.getTime().toString() }
    });
  };

  // Weekly calculations
  const weeklyTotal = weeklySpends.reduce((acc: number, curr: { amount: number }) => acc + curr.amount, 0);
  const weeklyAvg = weeklyTotal / 7;
  const weeklyMax = weeklySpends.reduce((acc: number, curr: { amount: number }) => (curr.amount > acc ? curr.amount : acc), 0);
  const getWeeklySubtitleRange = () => {
    if (weeklySpends.length < 7) return 'Loading...';
    const firstDate = weeklySpends[0].date;
    const lastDate = weeklySpends[6].date;
    return `${firstDate.toLocaleDateString([], { day: 'numeric', month: 'short' })} — ${lastDate.toLocaleDateString([], { day: 'numeric', month: 'short' })}`;
  };

  // ───────────────────────────────────────────────────────────────────────────
  // ── MONTHLY TAB STATES & LOGIC ─────────────────────────────────────────────
  // ───────────────────────────────────────────────────────────────────────────
  const [loadingMonthly, setLoadingMonthly] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [monthlyLogs, setMonthlyLogs] = useState<PurchasesStorage.PurchaseLog[]>([]);
  const [categoryAllocation, setCategoryAllocation] = useState<{ category: string; amount: number; percentage: number; color: string }[]>([]);

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const monthName = currentDate.toLocaleString('default', { month: 'long' });

  const refreshMonthlyData = async () => {
    setLoadingMonthly(true);
    try {
      const startOfMonth = new Date(currentYear, currentMonth, 1);
      const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);

      // Filter from master logs list
      const rawLogs = logs.filter(
        (log: PurchasesStorage.PurchaseLog) => log.timestamp >= startOfMonth.getTime() && log.timestamp <= endOfMonth.getTime()
      );
      setMonthlyLogs(rawLogs);

      const total = rawLogs.reduce((acc: number, curr: PurchasesStorage.PurchaseLog) => acc + curr.cost, 0);
      setMonthlyTotal(total);

      // Group categories
      const catMap: Record<string, number> = {};
      rawLogs.forEach((l: PurchasesStorage.PurchaseLog) => {
        catMap[l.category] = (catMap[l.category] || 0) + l.cost;
      });

      const catColors = [
        '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
        '#EC4899', '#06B6D4', '#F97316', '#14B8A6', '#64748B'
      ];

      const allocation = Object.entries(catMap)
        .map(([cat, amt]: [string, number], idx: number) => ({
          category: cat,
          amount: amt,
          percentage: total > 0 ? (amt / total) * 100 : 0,
          color: catColors[idx % catColors.length],
        }))
        .sort((a: any, b: any) => b.amount - a.amount);

      setCategoryAllocation(allocation);
    } catch (e) {
      console.warn('Failed to load monthly purchases:', e);
    } finally {
      setLoadingMonthly(false);
    }
  };

  // Monthly stats calculations
  const monthlyTransactions = monthlyLogs.length;
  const monthlyAvgPerSpend = monthlyTransactions > 0 ? monthlyTotal / monthlyTransactions : 0;

  // ───────────────────────────────────────────────────────────────────────────
  // ── CENTRAL DISPATCH & TAB BINDING ─────────────────────────────────────────
  // ───────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadDailyLogs();
  }, []);

  useEffect(() => {
    refreshWeeklyData();
  }, [weekOffset]);

  useEffect(() => {
    refreshMonthlyData();
  }, [currentDate]);

  const handleTabPress = (tab: 'daily' | 'weekly' | 'monthly') => {
    setActiveTab(tab);
    let index = 0;
    if (tab === 'weekly') index = 1;
    if (tab === 'monthly') index = 2;
    scrollViewRef.current?.scrollTo({ x: index * windowWidth, animated: true });
  };

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

        {/* Swipeable Tabs Bar */}
        <PurchasesTabs activeTab={activeTab} onTabPress={handleTabPress} />

        <Animated.ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            const offsetX = e.nativeEvent.contentOffset.x;
            const index = Math.round(offsetX / windowWidth);
            if (index === 0) setActiveTab('daily');
            else if (index === 1) setActiveTab('weekly');
            else if (index === 2) setActiveTab('monthly');
          }}
        >
          {/* ============================================== */}
          {/* ================ 1. DAILY PANEL ============== */}
          {/* ============================================== */}
          <View style={{ width: windowWidth }}>
            <FlatList
              data={loadingDaily ? [] : logs}
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
                      {CATEGORIES.map((cat) => {
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
                loadingDaily ? (
                  <View style={{ gap: 12, width: '100%' }}>
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Animated.View key={i} style={[styles.itemCard, { borderColor: colors.border, padding: 12, opacity: pulseVal.value }]}>
                        <View style={{ gap: 6, flex: 1 }}>
                          <Skeleton width={120} height={14} />
                          <Skeleton width={160} height={10} />
                        </View>
                      </Animated.View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.emptyContainer}>
                    <Feather name="shopping-bag" size={32} color={colors.textSecondary} style={{ marginBottom: Spacing.two, opacity: 0.8 }} />
                    <ThemedText type="code" themeColor="textSecondary" style={{ textAlign: 'center', fontSize: 12 }}>
                      No records logged
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center', marginTop: Spacing.one }}>
                      Log items above to track shopping expenses.
                    </ThemedText>
                  </View>
                )
              }
            />
          </View>

          {/* ============================================== */}
          {/* ================ 2. WEEKLY PANEL ============= */}
          {/* ============================================== */}
          <View style={{ width: windowWidth }}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              {/* Week Navigation controls */}
              <View style={styles.navRow}>
                <TouchableOpacity onPress={() => setWeekOffset((prev) => prev - 1)} style={[styles.navBtn, { borderColor: colors.border }]}>
                  <Feather name="chevron-left" size={16} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.monthLabel, { color: colors.text }]}>
                  {weekOffset === 0 ? 'This Week' : weekOffset === -1 ? 'Last Week' : `Week (${weekOffset} w)`}
                </Text>
                <TouchableOpacity onPress={() => setWeekOffset((prev) => Math.min(0, prev + 1))} disabled={weekOffset === 0} style={[styles.navBtn, { borderColor: colors.border, opacity: weekOffset === 0 ? 0.3 : 1 }]}>
                  <Feather name="chevron-right" size={16} color={colors.text} />
                </TouchableOpacity>
              </View>

              {/* Weekly bar chart card */}
              {loadingWeekly ? (
                <Animated.View style={[styles.chartCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border, gap: 16 }, skeletonPulseStyle]}>
                  <Skeleton width={160} height={10} />
                  <View style={[styles.barsContainer, { justifyContent: 'space-between', alignItems: 'flex-end', height: 130 }]}>
                    {Array.from({ length: 7 }).map((_, i) => (
                      <View key={i} style={{ alignItems: 'center', gap: 8 }}>
                        <Skeleton width={14} height={20 + i * 12} borderRadius={4} />
                        <Skeleton width={20} height={8} />
                      </View>
                    ))}
                  </View>
                </Animated.View>
              ) : (
                <Animated.View entering={FadeInDown.duration(400)}>
                  <View style={[styles.chartCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
                    <View style={styles.chartHeader}>
                      <Text style={[styles.chartTitle, { color: colors.textSecondary }]}>WEEKLY EXPENSE HISTORY</Text>
                      <Text style={[styles.chartSubtitle, { color: colors.text }]}>{getWeeklySubtitleRange()}</Text>
                    </View>

                    <View style={styles.barsContainer}>
                      {weeklySpends.map((d, index) => (
                        <WeeklySpendBar
                          key={index}
                          dayName={d.dayName}
                          amount={d.amount}
                          maxAmount={weeklyMax}
                          colors={colors}
                          isSelected={selectedWeeklyDay?.date.toDateString() === d.date.toDateString()}
                          onPress={() => handleSelectWeeklyDay(d)}
                        />
                      ))}
                    </View>
                  </View>
                </Animated.View>
              )}

              {/* Weekly Stats Grid */}
              <View style={styles.statsGrid}>
                {loadingWeekly ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <Animated.View key={i} style={[styles.statItem, { backgroundColor: colors.backgroundElement, borderColor: colors.border }, skeletonPulseStyle]}>
                      <Skeleton width={60} height={10} />
                      <Skeleton width={90} height={20} style={{ marginTop: 4 }} />
                    </Animated.View>
                  ))
                ) : (
                  <>
                    <View style={[styles.statItem, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
                      <Feather name="activity" size={16} color={colors.primary} />
                      <Text style={[styles.statVal, { color: colors.text }]}>₹{weeklyTotal.toFixed(2)}</Text>
                      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Spent</Text>
                    </View>

                    <View style={[styles.statItem, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
                      <Feather name="trending-up" size={16} color="#10B981" />
                      <Text style={[styles.statVal, { color: colors.text }]}>₹{weeklyAvg.toFixed(2)}</Text>
                      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Daily Average</Text>
                    </View>

                    <View style={[styles.statItem, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
                      <Feather name="award" size={16} color="#F59E0B" />
                      <Text style={[styles.statVal, { color: colors.text }]}>₹{weeklyMax.toFixed(2)}</Text>
                      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Highest Spend</Text>
                    </View>
                  </>
                )}
              </View>


            </ScrollView>
          </View>

          {/* ============================================== */}
          {/* ================ 3. MONTHLY PANEL ============ */}
          {/* ============================================== */}
          <View style={{ width: windowWidth }}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              {/* Monthly controls */}
              <View style={styles.navRow}>
                <TouchableOpacity onPress={() => setCurrentDate(new Date(currentYear, currentMonth - 1, 1))} style={[styles.navBtn, { borderColor: colors.border }]}>
                  <Feather name="chevron-left" size={16} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.monthLabel, { color: colors.text }]}>
                  {monthName} {currentYear}
                </Text>
                <TouchableOpacity onPress={() => setCurrentDate(new Date(currentYear, currentMonth + 1, 1))} style={[styles.navBtn, { borderColor: colors.border }]}>
                  <Feather name="chevron-right" size={16} color={colors.text} />
                </TouchableOpacity>
              </View>

              {/* Monthly Summary card */}
              {loadingMonthly ? (
                <Animated.View style={[styles.summaryCard, { borderColor: colors.border, backgroundColor: colors.backgroundElement, gap: 12 }, skeletonPulseStyle]}>
                  <Skeleton width={140} height={10} />
                  <Skeleton width={180} height={28} style={{ marginTop: 4 }} />
                </Animated.View>
              ) : (
                <Animated.View entering={FadeInDown.duration(500)}>
                  <View style={[styles.summaryCard, { borderColor: colors.border, backgroundColor: colors.backgroundElement }]}>
                    <View style={styles.summaryHeader}>
                      <Text style={[styles.summaryTitle, { color: colors.textSecondary }]}>
                        {monthName.toUpperCase()} SUMMARY
                      </Text>
                      <Feather name="pie-chart" size={14} color={colors.primary} />
                    </View>

                    <View style={styles.totalRow}>
                      <Text style={[styles.totalSpentText, { color: colors.primary }]}>
                        ₹{monthlyTotal.toFixed(2)}
                      </Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 10, fontWeight: '700', marginLeft: 8 }}>
                        SPENT IN TOTAL
                      </Text>
                    </View>
                  </View>
                </Animated.View>
              )}

              {/* Category Allocation breakdown */}
              {loadingMonthly ? (
                <Animated.View style={[styles.breakdownCard, { borderColor: colors.border, backgroundColor: colors.backgroundElement, gap: 15 }, skeletonPulseStyle]}>
                  <Skeleton width={160} height={10} style={{ marginBottom: 4 }} />
                  <View style={{ gap: 12 }}>
                    {Array.from({ length: 4 }).map((_, i) => (
                      <View key={i} style={{ gap: 6 }}>
                        <Skeleton width={80} height={10} />
                        <Skeleton width="100%" height={8} borderRadius={4} />
                      </View>
                    ))}
                  </View>
                </Animated.View>
              ) : (
                <View style={[styles.breakdownCard, { borderColor: colors.border, backgroundColor: colors.backgroundElement }]}>
                  <Text style={[styles.cardSectionTitle, { color: colors.textSecondary }]}>
                    CATEGORY ALLOCATION
                  </Text>

                  {categoryAllocation.length === 0 ? (
                    <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                      <Text style={{ fontSize: 12, color: colors.textSecondary }}>No expenditures logged in this month.</Text>
                    </View>
                  ) : (
                    <View style={styles.categoriesList}>
                      {categoryAllocation.map((cat, idx) => (
                        <CategoryBar
                          key={idx}
                          category={cat.category}
                          amount={cat.amount}
                          percentage={cat.percentage}
                          color={cat.color}
                          textColor={colors.textSecondary}
                        />
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* Monthly transaction stats grid */}
              <View style={styles.statsGrid}>
                {loadingMonthly ? (
                  Array.from({ length: 2 }).map((_, i) => (
                    <Animated.View key={i} style={[styles.statBox, { borderColor: colors.border, backgroundColor: colors.backgroundElement, gap: 8 }, skeletonPulseStyle]}>
                      <Skeleton width={90} height={10} />
                      <Skeleton width={60} height={20} />
                    </Animated.View>
                  ))
                ) : (
                  <>
                    <View style={[styles.statBox, { borderColor: colors.border, backgroundColor: colors.backgroundElement }]}>
                      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                        TRANSACTIONS
                      </Text>
                      <Text style={[styles.statValue, { color: colors.text }]}>
                        {monthlyTransactions}
                      </Text>
                    </View>

                    <View style={[styles.statBox, { borderColor: colors.border, backgroundColor: colors.backgroundElement }]}>
                      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                        AVG PER SPEND
                      </Text>
                      <Text style={[styles.statValue, { color: colors.text }]}>
                        ₹{monthlyAvgPerSpend.toFixed(2)}
                      </Text>
                    </View>
                  </>
                )}
              </View>
            </ScrollView>
          </View>
        </Animated.ScrollView>

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

// ── StyleSheet ──────────────────────────────────────────────────────────────
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
    gap: 20,
  },
  totalBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 10,
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
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  submitBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 24,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  itemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  rightItemBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '800',
  },
  trashBtn: {
    padding: 6,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
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
    fontWeight: '800',
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
    fontWeight: '800',
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
    fontWeight: '600',
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
    fontWeight: '700',
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
    fontWeight: '800',
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
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    fontSize: 18,
    fontWeight: '800',
  },
  chartCard: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: 16,
    gap: 24,
  },
  chartHeader: {
    gap: 4,
  },
  chartTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  chartSubtitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  barsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 170,
    paddingBottom: 8,
  },
  barCol: {
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  barValText: {
    fontSize: 9,
  },
  barTrack: {
    width: 14,
    height: 130,
    borderRadius: 7,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: '100%',
    borderRadius: 7,
  },
  barLabel: {
    fontSize: 10,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statItem: {
    flex: 1,
    minWidth: '45%',
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 14,
    gap: 4,
  },
  statVal: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  breakdownCard: {
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  summaryCard: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: 16,
    marginTop: 10,
    gap: 8,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  totalSpentText: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -1,
  },
  breakdownCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardSectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  categoriesList: {
    gap: 16,
  },
  catRow: {
    gap: 6,
  },
  catInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  catName: {
    fontSize: 12,
  },
  catAmount: {
    fontSize: 11,
    fontWeight: '600',
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  statBox: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 16,
    gap: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
});

export default function SpendTrackerScreen() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);

  useEffect(() => {
    async function authenticateUser() {
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();

        if (hasHardware && isEnrolled) {
          const result = await LocalAuthentication.authenticateAsync({
            promptMessage: 'Authenticate to access Spend Tracker',
            fallbackLabel: 'Use Device Passcode',
            disableDeviceFallback: false,
          });

          if (result.success) {
            setIsAuthenticated(true);
          } else {
            Alert.alert('Access Denied', 'Authentication is required to view purchases.');
            router.back();
          }
        } else {
          setIsAuthenticated(true);
        }
      } catch (e) {
        console.error('Biometric auth failed', e);
        Alert.alert('Security Error', 'Biometric verification failed.');
        router.back();
      } finally {
        setIsVerifying(false);
      }
    }
    authenticateUser();
  }, []);

  if (isVerifying) {
    return <AppLoader label="Verifying credentials…" />;
  }

  if (!isAuthenticated) {
    return null;
  }

  return <SpendTrackerContent />;
}
