import defaultSplitJson from '@/data/training/split.json';
import {
  cacheFirst,
  cacheGet,
  cacheSet,
  deleteUserDoc,
  isoWeekday,
  localDateKey,
  readUserCollection,
  readUserDoc,
  writeUserDoc,
} from '@/utils/userDocs';

/**
 * Training — the workout half of the old Catalyst app, rebuilt on the
 * Essentials storage pattern (see utils/userDocs.ts).
 *
 * Firestore layout (all under users/{uid}):
 *   training/split        { days: TrainingDay[], updatedAt }   custom split, absent = default
 *   workoutLogs/{id}      WorkoutSession                        one per finished session
 *
 * Local-only (AsyncStorage, per uid): today's checklist + weights, the
 * last weight used per exercise, and the weekly schedule offset. Those are
 * scratch state for one day/week — syncing every keystroke of a weight field
 * to Firestore would be noise; the finished session is what gets persisted.
 */

export interface Exercise {
  id: string;
  name: string;
  sets: string;
  reps: string;
  tempo: string;
  notes: string;
  rir?: string;
  isCardio?: boolean;
}

export interface TrainingDay {
  /** 1–7, the slot in the split (not necessarily the weekday it lands on). */
  dayNumber: number;
  assignedDay?: string;
  focus: string;
  isRecovery: boolean;
  anatomyFocus?: string[];
  exercises: Exercise[];
}

export interface DayState {
  date: string;
  completed: Record<string, boolean>;
  weights: Record<string, number>;
  /** Morning / evening "did you train?" check-ins — 'none' until answered. */
  morning: 'none' | 'yes' | 'no';
  evening: 'none' | 'yes' | 'no';
  /** Set once the session has been finished and logged today. */
  finishedAt?: number;
}

export interface WorkoutSession {
  id: string;
  title: string;
  dayNumber: number;
  completedAt: number;
  date: string;
  totalLoadKg: number;
  exercises: { id: string; name: string; isCompleted: boolean; weight: number; isCardio?: boolean }[];
}

export const DEFAULT_SPLIT = defaultSplitJson as TrainingDay[];

const SPLIT_CACHE = '@essentials_training_split';
const DAY_STATE = '@essentials_training_day';
const LAST_WEIGHTS = '@essentials_training_last_weights';
const OFFSET = '@essentials_training_offset';
const SESSIONS_CACHE = '@essentials_training_sessions';

export const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ── Split ─────────────────────────────────────────────────────────────────────

/** Cached split immediately — never blocks on the network. */
export async function getCachedSplit(): Promise<{ days: TrainingDay[]; isCustom: boolean }> {
  const cached = await cacheGet<TrainingDay[] | null>(SPLIT_CACHE, null);
  return cached && cached.length === 7 ? { days: cached, isCustom: true } : { days: DEFAULT_SPLIT, isCustom: false };
}

/** Cache first, then reconciles with Firestore. */
export async function getSplit(): Promise<{ days: TrainingDay[]; isCustom: boolean }> {
  const remote = await readUserDoc<{ days?: TrainingDay[] }>(['training', 'split']);
  if (remote && Array.isArray(remote.days) && remote.days.length === 7) {
    await cacheSet(SPLIT_CACHE, remote.days);
    return { days: remote.days, isCustom: true };
  }
  return getCachedSplit();
}

export async function saveCustomSplit(days: TrainingDay[]): Promise<void> {
  await cacheSet(SPLIT_CACHE, days);
  await writeUserDoc(['training', 'split'], { days, updatedAt: Date.now() }, false);
}

export async function clearCustomSplit(): Promise<void> {
  await cacheSet<TrainingDay[] | null>(SPLIT_CACHE, null);
  await deleteUserDoc(['training', 'split']);
}

// ── Schedule offset ───────────────────────────────────────────────────────────

/** Monday of the week containing `d`, as a date key — the offset's lifetime. */
function weekKey(d: Date = new Date()): string {
  const monday = new Date(d);
  monday.setDate(d.getDate() - (isoWeekday(d) - 1));
  return localDateKey(monday);
}

/**
 * Whole-day shift applied to the split for the current week ("I missed
 * yesterday — slide everything back one"). Expires on Monday so a missed
 * session can never drift the plan permanently.
 */
export async function getScheduleOffset(): Promise<number> {
  const stored = await cacheGet<{ offset: number; week: string } | null>(OFFSET, null);
  if (!stored || stored.week !== weekKey()) return 0;
  return stored.offset;
}

export async function setScheduleOffset(offset: number): Promise<void> {
  // Keep it in (-7, 7) — any whole multiple of 7 is the same plan.
  const normalised = ((offset % 7) + 7) % 7;
  const signed = normalised > 3 ? normalised - 7 : normalised;
  await cacheSet(OFFSET, { offset: signed, week: weekKey() });
}

/** Which split slot (1–7) a given calendar day lands on. */
export function splitSlotFor(date: Date, offset: number): number {
  return ((isoWeekday(date) - 1 + offset) % 7 + 7) % 7 + 1;
}

/** Which weekday (1–7) a split slot lands on this week. */
export function weekdayForSlot(slot: number, offset: number): number {
  return ((slot - 1 - offset) % 7 + 7) % 7 + 1;
}

/** Offset that makes `slot` today's workout, kept within ±3 days. */
export function offsetToMakeToday(slot: number, today: Date = new Date()): number {
  let offset = slot - isoWeekday(today);
  if (offset > 3) offset -= 7;
  if (offset < -3) offset += 7;
  return offset;
}

export function dayForSlot(days: TrainingDay[], slot: number): TrainingDay {
  return (
    days.find((d) => Number(d.dayNumber) === slot) ?? {
      dayNumber: slot,
      focus: 'Rest day',
      isRecovery: true,
      exercises: [],
    }
  );
}

// ── Today's checklist ─────────────────────────────────────────────────────────

function freshDayState(): DayState {
  return { date: localDateKey(), completed: {}, weights: {}, morning: 'none', evening: 'none' };
}

/** Today's state; silently starts a fresh one after midnight. */
export async function getDayState(): Promise<DayState> {
  const stored = await cacheGet<DayState | null>(DAY_STATE, null);
  if (!stored || stored.date !== localDateKey()) return freshDayState();
  return stored;
}

export async function saveDayState(state: DayState): Promise<void> {
  await cacheSet(DAY_STATE, state);
}

export async function getLastWeights(): Promise<Record<string, number>> {
  return cacheGet<Record<string, number>>(LAST_WEIGHTS, {});
}

export async function rememberWeight(exerciseId: string, weight: number): Promise<void> {
  const all = await getLastWeights();
  if (weight > 0) all[exerciseId] = weight;
  await cacheSet(LAST_WEIGHTS, all);
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export async function logSession(
  session: Omit<WorkoutSession, 'id' | 'completedAt' | 'date'>,
): Promise<WorkoutSession> {
  const completedAt = Date.now();
  const full: WorkoutSession = {
    ...session,
    id: `session_${completedAt}_${Math.random().toString(36).slice(2, 8)}`,
    completedAt,
    date: localDateKey(),
  };
  const cached = await cacheGet<WorkoutSession[]>(SESSIONS_CACHE, []);
  await cacheSet(SESSIONS_CACHE, [full, ...cached].slice(0, 120));
  const { id, ...data } = full;
  await writeUserDoc(['workoutLogs', id], data, false);
  return full;
}

/** Newest first. Cache-first; revalidated from Firestore in the background. */
export async function getRecentSessions(): Promise<WorkoutSession[]> {
  return cacheFirst<WorkoutSession[]>(
    SESSIONS_CACHE,
    [],
    () => readUserCollection<Omit<WorkoutSession, 'id'>>('workoutLogs', 'completedAt', 120),
    {
      merge: (cached, remote) => {
        // Keep locally-logged sessions that haven't reached Firestore yet.
        const remoteIds = new Set(remote.map((r) => r.id));
        const pending = cached.filter((c) => !remoteIds.has(c.id) && c.completedAt > Date.now() - 7 * 86_400_000);
        return [...pending, ...remote].sort((a, b) => b.completedAt - a.completedAt).slice(0, 120);
      },
    },
  );
}

/** Date keys (Mon→Sun of the current week) that have a logged session. */
export function sessionDatesThisWeek(sessions: WorkoutSession[], today: Date = new Date()): Set<string> {
  const monday = new Date(today);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(today.getDate() - (isoWeekday(today) - 1));
  const out = new Set<string>();
  for (const s of sessions) if (s.completedAt >= monday.getTime()) out.add(s.date);
  return out;
}

/** Consecutive training days ending today or yesterday. Recovery days don't break it. */
export function currentStreak(sessions: WorkoutSession[], days: TrainingDay[], offset: number): number {
  const dates = new Set(sessions.map((s) => s.date));
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(12, 0, 0, 0);
  if (!dates.has(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  for (let i = 0; i < 60; i++) {
    const key = localDateKey(cursor);
    const day = dayForSlot(days, splitSlotFor(cursor, offset));
    if (dates.has(key)) streak += 1;
    else if (!day.isRecovery) break;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** "3 × 12–15" (strength) / "20 min" (cardio). */
export function prescription(ex: Exercise): string {
  if (ex.isCardio) return ex.reps && ex.reps !== 'Time' ? `${ex.sets} × ${ex.reps}` : `${ex.tempo || 'Steady'} pace`;
  return `${ex.sets} × ${ex.reps.replace('-', '–')}`;
}
