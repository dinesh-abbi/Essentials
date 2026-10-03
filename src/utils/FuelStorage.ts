import planJson from '@/data/fuel/plan.json';
import * as PurchasesStorage from '@/utils/PurchasesStorage';
import * as WidgetSync from '@/utils/WidgetSync';
import { cacheFirst, cacheGet, getUid, cacheSet, localDateKey, readUserCollection, readUserDoc, writeUserDoc } from '@/utils/userDocs';

/**
 * Fuel — the 28-day meal cycle + restock list from the old Catalyst app.
 *
 * Firestore (under users/{uid}):
 *   fuel/cycle           { start: 'YYYY-MM-DD' }          day 1 of the running cycle
 *   fuel/bought          { [windowKey]: { item: purchaseId } }
 *   mealLogs/{date}      { date, cycleDay, meals: { breakfast: MealEntry, … } }
 *
 * Grocery ticks are *real expenses*: ticking an item writes a purchase
 * through PurchasesStorage (category "Groceries"), so it shows up in the
 * Spend card, the reports and the widget like any other purchase; unticking
 * deletes that exact purchase again. That replaces Catalyst's separate
 * `purchase_logs` collection — one ledger, not two.
 */

export const CYCLE_LENGTH = 28;
export const RESTOCK_DAYS = [1, 8, 15, 22];

export type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner';
export type MealStatus = 'eaten' | 'missed' | 'swapped';

export interface MealEntry {
  status: MealStatus;
  note?: string;
  at: number;
}

export interface DayMeals {
  date: string;
  cycleDay: number;
  meals: Partial<Record<MealType, MealEntry>>;
}

export interface GroceryItem {
  item: string;
  cost: number;
}

export interface PlanDay {
  day: number;
  breakfast: string;
  lunch: string;
  snack: string;
  dinner: string;
}

export const MEALS: { type: MealType; label: string; hour: number; minute: number }[] = [
  { type: 'breakfast', label: 'Breakfast', hour: 8, minute: 30 },
  { type: 'lunch', label: 'Lunch', hour: 13, minute: 30 },
  { type: 'snack', label: 'Snack', hour: 17, minute: 30 },
  { type: 'dinner', label: 'Dinner', hour: 20, minute: 30 },
];

export const PLAN = planJson.meal_plan as PlanDay[];
export const GROCERY = planJson.grocery as { monthly: GroceryItem[]; weekly: GroceryItem[]; daily: GroceryItem[] };

const CYCLE_CACHE = '@essentials_fuel_cycle';
const MEALS_CACHE = '@essentials_fuel_meals';
const BOUGHT_CACHE = '@essentials_fuel_bought';

const DAY_MS = 86_400_000;

function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0); // noon — immune to DST edges
}

function daysBetween(fromKey: string, to: Date): number {
  const a = parseKey(fromKey).getTime();
  const b = parseKey(localDateKey(to)).getTime();
  return Math.round((b - a) / DAY_MS);
}

// ── Cycle ─────────────────────────────────────────────────────────────────────

export interface CyclePosition {
  start: string;
  /** 1–28 */
  day: number;
  /** How many full cycles have elapsed since `start` (keys restock windows). */
  index: number;
}

export async function getCycleStart(): Promise<string> {
  // Signed out (e.g. reminders scheduling at launch): answer, but persist nothing —
  // writing a fresh start here would overwrite the account's real cycle later.
  if (!(await getUid().catch(() => null))) return localDateKey();
  const cached = await cacheGet<string | null>(CYCLE_CACHE, null);
  if (cached) return cached;
  const remote = await readUserDoc<{ start?: string }>(['fuel', 'cycle']);
  if (remote?.start) {
    await cacheSet(CYCLE_CACHE, remote.start);
    return remote.start;
  }
  // First run: today is day 1.
  const start = localDateKey();
  await cacheSet(CYCLE_CACHE, start);
  writeUserDoc(['fuel', 'cycle'], { start }).catch(() => {});
  return start;
}

/** Re-anchors the cycle so that `today` becomes `day`. */
export async function alignCycle(day: number, today: Date = new Date()): Promise<string> {
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - (day - 1));
  const start = localDateKey(startDate);
  await cacheSet(CYCLE_CACHE, start);
  await writeUserDoc(['fuel', 'cycle'], { start });
  return start;
}

export function positionFor(start: string, date: Date = new Date()): CyclePosition {
  const diff = Math.max(0, daysBetween(start, date));
  return { start, day: (diff % CYCLE_LENGTH) + 1, index: Math.floor(diff / CYCLE_LENGTH) };
}

/** Calendar date of `cycleDay` inside the cycle that contains `today`. */
export function dateForCycleDay(start: string, cycleDay: number, today: Date = new Date()): Date {
  const pos = positionFor(start, today);
  const d = new Date(today);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + (cycleDay - pos.day));
  return d;
}

export function planFor(cycleDay: number): PlanDay | undefined {
  return PLAN.find((p) => p.day === cycleDay);
}

/** The restock window (1, 8, 15 or 22) that `cycleDay` belongs to. */
export function windowStartFor(cycleDay: number): number {
  return [...RESTOCK_DAYS].reverse().find((d) => cycleDay >= d) ?? 1;
}

export function daysUntilRestock(cycleDay: number): number {
  const next = RESTOCK_DAYS.find((d) => d > cycleDay) ?? CYCLE_LENGTH + 1;
  return next - cycleDay;
}

// ── Meal logs ─────────────────────────────────────────────────────────────────

/** Cache-first; revalidated from users/{uid}/mealLogs in the background. */
export async function getMealLogs(): Promise<Record<string, DayMeals>> {
  return cacheFirst<Record<string, DayMeals>>(
    MEALS_CACHE,
    {},
    async () => {
      const remote = await readUserCollection<DayMeals>('mealLogs', 'date', 60);
      return remote ? Object.fromEntries(remote.map((r) => [r.date, { date: r.date, cycleDay: r.cycleDay, meals: r.meals ?? {} }])) : null;
    },
    {
      merge: (cached, remote) => {
        const merged: Record<string, DayMeals> = { ...cached };
        for (const r of Object.values(remote)) {
          const local = cached[r.date];
          // A local edit newer than Firestore's copy (still queued) wins.
          const localNewest = local ? Math.max(0, ...Object.values(local.meals).map((m) => m?.at ?? 0)) : 0;
          const remoteNewest = Math.max(0, ...Object.values(r.meals).map((m) => m?.at ?? 0));
          if (!local || remoteNewest >= localNewest) merged[r.date] = r;
        }
        return prune(merged);
      },
    },
  );
}

function prune(map: Record<string, DayMeals>): Record<string, DayMeals> {
  const keys = Object.keys(map).sort().slice(-90);
  return Object.fromEntries(keys.map((k) => [k, map[k]]));
}

/** Sets (or with `status = null`, clears) one meal for one calendar day. */
export async function setMealStatus(
  date: Date,
  cycleDay: number,
  meal: MealType,
  status: MealStatus | null,
  note?: string,
): Promise<Record<string, DayMeals>> {
  const key = localDateKey(date);
  const all = await cacheGet<Record<string, DayMeals>>(MEALS_CACHE, {});
  const day: DayMeals = all[key] ?? { date: key, cycleDay, meals: {} };
  if (status === null) delete day.meals[meal];
  else day.meals[meal] = { status, note: note?.trim() || undefined, at: Date.now() };
  day.cycleDay = cycleDay;
  all[key] = day;
  await cacheSet(MEALS_CACHE, prune(all));
  // Whole-day doc, not a merge: a cleared meal has to disappear remotely too.
  await writeUserDoc(['mealLogs', key], { date: key, cycleDay, meals: day.meals }, false);
  return all;
}

export function eatenCount(day?: DayMeals): number {
  if (!day) return 0;
  return Object.values(day.meals).filter((m) => m && m.status !== 'missed').length;
}

// ── Restock list ──────────────────────────────────────────────────────────────

type BoughtMap = Record<string, Record<string, string>>; // windowKey → item → purchaseId

export function windowKey(pos: CyclePosition, cycleDay: number = pos.day): string {
  return `${pos.start}|${pos.index}|${windowStartFor(cycleDay)}`;
}

export async function getBought(): Promise<BoughtMap> {
  const cached = await cacheGet<BoughtMap | null>(BOUGHT_CACHE, null);
  if (cached) return cached;
  const remote = await readUserDoc<BoughtMap>(['fuel', 'bought']);
  return remote ?? {};
}

/**
 * Ticks / unticks a grocery item for the current restock window. Ticking
 * records a real purchase; unticking deletes that same purchase.
 */
export async function toggleGrocery(key: string, item: GroceryItem): Promise<BoughtMap> {
  const bought = await getBought();
  const windowMap = { ...(bought[key] ?? {}) };
  const existing = windowMap[item.item];

  if (existing) {
    delete windowMap[item.item];
    await PurchasesStorage.deletePurchase(existing).catch((e) => console.warn('[Fuel] untick failed', e));
  } else {
    const saved = await PurchasesStorage.savePurchase(item.item, item.cost, 'Groceries');
    windowMap[item.item] = saved.id;
  }
  WidgetSync.sync();

  // Only the last few windows matter — keep the map from growing forever.
  const next: BoughtMap = { ...bought, [key]: windowMap };
  const trimmed = Object.fromEntries(Object.entries(next).slice(-6));
  await cacheSet(BOUGHT_CACHE, trimmed);
  await writeUserDoc(['fuel', 'bought'], trimmed, false);
  return trimmed;
}

/** Items due in the window containing `cycleDay` (monthly only in the first window). */
export function dueItems(cycleDay: number, showAll = false) {
  const first = windowStartFor(cycleDay) === 1;
  return {
    monthly: showAll || first ? GROCERY.monthly : [],
    weekly: GROCERY.weekly,
    daily: GROCERY.daily,
  };
}

export function sumCost(items: GroceryItem[]): number {
  return items.reduce((a, b) => a + b.cost, 0);
}
