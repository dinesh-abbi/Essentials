import { MUSCLES, musclesFor } from '@/utils/ExerciseCatalog';
import { plannedSetCount, type Exercise, type SessionExercise, type WorkoutSession } from '@/utils/TrainingStorage';
import { localDateKey } from '@/utils/userDocs';

/**
 * Pure aggregations over logged sessions for the Progress screen — the
 * client-side version of Forma's recap and muscle-load maps. Sessions from
 * before v1.4.0 carry no sets; a completed move there counts as one set.
 */

export type MuscleLoad = Record<string, number>;

const setsOf = (e: SessionExercise) => (e.sets?.length ? e.sets.length : e.isCompleted && !e.isCardio ? 1 : 0);

/**
 * Each set credits its move's primary muscle in full and every supporting
 * muscle at half weight, so pressing lights the chest and warms the triceps.
 */
export function muscleLoad(sessions: WorkoutSession[]): MuscleLoad {
  const load: MuscleLoad = {};
  for (const s of sessions)
    for (const e of s.exercises) {
      const sets = setsOf(e);
      if (!sets) continue;
      musclesFor(e).forEach((id, index) => {
        load[id] = (load[id] || 0) + sets * (index === 0 ? 1 : 0.5);
      });
    }
  return load;
}

/** The same weighting over a day's plan, before anything is lifted. */
export function plannedLoad(exercises: Exercise[]): MuscleLoad {
  const load: MuscleLoad = {};
  for (const e of exercises) {
    if (e.isCardio) continue;
    const sets = plannedSetCount(e);
    musclesFor(e).forEach((id, index) => {
      load[id] = (load[id] || 0) + sets * (index === 0 ? 1 : 0.5);
    });
  }
  return load;
}

/** Scales a load map to 0..1 against its own busiest muscle. */
export function normalise(load: MuscleLoad): MuscleLoad {
  const peak = Math.max(0, ...Object.values(load));
  if (!peak) return {};
  return Object.fromEntries(Object.entries(load).map(([id, value]) => [id, value / peak]));
}

/** The muscles carrying the most work, busiest first. */
export function busiest(load: MuscleLoad, limit = 3): [string, number][] {
  return Object.entries(load)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

/** Muscles with no logged work in the period. */
export function untrained(load: MuscleLoad): string[] {
  return MUSCLES.map((m) => m.id).filter((id) => !load[id]);
}

/** The last `count` local date keys, oldest first, ending today. */
export function lastDays(count: number, today: Date = new Date()): string[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(today);
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - (count - 1 - i));
    return localDateKey(d);
  });
}

/** Sessions whose date falls in `days`. */
export function inDays(sessions: WorkoutSession[], days: string[]): WorkoutSession[] {
  const set = new Set(days);
  return sessions.filter((s) => set.has(s.date));
}

/** Working sets completed on each of the given days. */
export function setsPerDay(sessions: WorkoutSession[], days: string[]): number[] {
  return days.map((day) =>
    sessions.filter((s) => s.date === day).reduce((total, s) => total + s.exercises.reduce((n, e) => n + setsOf(e), 0), 0),
  );
}

export interface Recap {
  sessions: number;
  minutes: number;
  sets: number;
  /** Σ reps × kg over logged sets. */
  volumeKg: number;
  activeDays: number;
}

export function recap(sessions: WorkoutSession[]): Recap {
  let sets = 0;
  let volumeKg = 0;
  for (const s of sessions)
    for (const e of s.exercises) {
      sets += setsOf(e);
      for (const set of e.sets ?? []) volumeKg += set.reps * set.weight;
    }
  return {
    sessions: sessions.length,
    minutes: sessions.reduce((sum, s) => sum + (s.minutes ?? 0), 0),
    sets,
    volumeKg,
    activeDays: new Set(sessions.map((s) => s.date)).size,
  };
}
