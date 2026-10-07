import type { WorkoutSession } from '@/utils/TrainingStorage';
import { cacheFirst, cacheGet, cacheSet, deleteUserDoc, readUserCollection, writeUserDoc } from '@/utils/userDocs';

/**
 * Training goals (from Forma): "12 sessions this month", "600 minutes by
 * June". Progress is always derived from logged sessions — never typed in.
 *
 * Firestore: users/{uid}/goals/{goal_<createdAt>}
 */

export type GoalMetric = 'sessions' | 'minutes' | 'active_days';
export type GoalStatus = 'achieved' | 'upcoming' | 'ended' | 'active';

export interface Goal {
  id: string;
  metric: GoalMetric;
  target: number;
  /** Local date keys, inclusive. */
  start: string;
  end: string;
  createdAt: number;
}

export const MAX_GOALS = 50;
export const METRIC_LABEL: Record<GoalMetric, string> = {
  sessions: 'Sessions',
  minutes: 'Minutes',
  active_days: 'Active days',
};

const CACHE = '@essentials_training_goals';
/** Ids deleted locally whose delete may not have reached Firestore yet. */
const DELETED = '@essentials_training_goals_deleted';

/** Newest first. Cache-first; revalidated from Firestore in the background. */
export async function getGoals(): Promise<Goal[]> {
  const deleted = new Set(await cacheGet<string[]>(DELETED, []));
  return cacheFirst<Goal[]>(CACHE, [], () => readUserCollection<Omit<Goal, 'id'>>('goals', 'createdAt', MAX_GOALS), {
    merge: (cached, remote) => {
      const live = remote.filter((g) => !deleted.has(g.id));
      // Once the server no longer has a deleted goal, its tombstone can go.
      if (deleted.size && live.length === remote.length) cacheSet(DELETED, []);
      const remoteIds = new Set(live.map((g) => g.id));
      const pending = cached.filter((g) => !remoteIds.has(g.id) && g.createdAt > Date.now() - 7 * 86_400_000);
      return [...pending, ...live].sort((a, b) => b.createdAt - a.createdAt);
    },
  });
}

export async function saveGoal(input: Omit<Goal, 'id' | 'createdAt'> & { id?: string; createdAt?: number }): Promise<Goal> {
  const createdAt = input.createdAt ?? Date.now();
  const goal: Goal = { ...input, id: input.id ?? `goal_${createdAt}`, createdAt };
  const cached = await cacheGet<Goal[]>(CACHE, []);
  await cacheSet(CACHE, [goal, ...cached.filter((g) => g.id !== goal.id)]);
  const { id, ...data } = goal;
  await writeUserDoc(['goals', id], data, false);
  return goal;
}

export async function deleteGoal(id: string): Promise<void> {
  const cached = await cacheGet<Goal[]>(CACHE, []);
  await cacheSet(CACHE, cached.filter((g) => g.id !== id));
  const deleted = await cacheGet<string[]>(DELETED, []);
  await cacheSet(DELETED, [...deleted, id]);
  await deleteUserDoc(['goals', id]);
}

/** Current value of the goal's metric over its window, up to `today`. */
export function goalProgress(goal: Goal, sessions: WorkoutSession[], today: string): number {
  const inside = sessions.filter((s) => s.date >= goal.start && s.date <= goal.end && s.date <= today);
  if (goal.metric === 'sessions') return inside.length;
  if (goal.metric === 'minutes') return inside.reduce((sum, s) => sum + (s.minutes ?? 0), 0);
  return new Set(inside.map((s) => s.date)).size;
}

export function goalStatus(goal: Goal, current: number, today: string): GoalStatus {
  if (current >= goal.target) return 'achieved';
  if (goal.start > today) return 'upcoming';
  if (goal.end < today) return 'ended';
  return 'active';
}

/** Validation shared by the goal form: a 1–366-day window and a reachable target. */
export function goalError(metric: GoalMetric, target: number, start: string, end: string): string | null {
  if (!Number.isFinite(target) || target < 1) return 'Set a target of at least 1.';
  const days = Math.round((new Date(`${end}T12:00:00`).getTime() - new Date(`${start}T12:00:00`).getTime()) / 86_400_000);
  if (days < 0 || days > 365) return 'Pick a window of up to a year.';
  if (metric === 'active_days' && target > days + 1) return 'More active days than the window has.';
  return null;
}
