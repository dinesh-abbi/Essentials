import exercisesJson from '@/data/training/exercises.json';
import musclesJson from '@/data/training/muscles.json';
import defaultSplitJson from '@/data/training/split.json';
import type { Exercise } from '@/utils/TrainingStorage';

/**
 * The exercise library and muscle atlas, ported from Forma (the old `gym`
 * repo). Static data shipped in the bundle — nothing here touches storage.
 * Starter education content: simplified illustrations, not medical advice.
 */

export type MuscleId =
  | 'chest'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'obliques'
  | 'quads'
  | 'calves'
  | 'upper-back'
  | 'lats'
  | 'lower-back'
  | 'glutes'
  | 'hamstrings';

export interface Muscle {
  id: MuscleId;
  name: string;
  anatomical_name: string;
  side: 'front' | 'back' | 'both';
  group: string;
  movement: string;
  description: string;
  cue: string;
}

export interface CatalogExercise {
  id: string;
  name: string;
  /** Display group ("Chest", "Arms", …). */
  muscle: string;
  secondary: string;
  equipment: string;
  level: 'Beginner' | 'Intermediate';
  sets: number;
  reps: number;
  weight: number;
  cue: string;
  steps: string[];
  alternative: string;
  /** First id is the primary target; the rest are supporting muscles. */
  muscle_ids: MuscleId[];
  primary_muscle: MuscleId;
  breathing: string;
  mistakes: string[];
}

export const EXERCISES = exercisesJson as CatalogExercise[];
export const MUSCLES = musclesJson as Muscle[];

export const EQUIPMENT = [...new Set(EXERCISES.map((e) => e.equipment))];
export const LEVELS = ['Beginner', 'Intermediate'] as const;

const BY_ID = new Map(EXERCISES.map((e) => [e.id, e]));
const MUSCLE_BY_ID = new Map(MUSCLES.map((m) => [m.id, m]));

export function getExercise(id: string | undefined): CatalogExercise | undefined {
  return id ? BY_ID.get(id) : undefined;
}

export function getMuscle(id: string | null | undefined): Muscle | undefined {
  return id ? MUSCLE_BY_ID.get(id as MuscleId) : undefined;
}

/** Library filter: every argument is optional; `q` matches name + equipment. */
export function search({
  muscle,
  equipment,
  level,
  q = '',
}: { muscle?: string | null; equipment?: string | null; level?: string | null; q?: string } = {}): CatalogExercise[] {
  const needle = q.trim().toLowerCase();
  return EXERCISES.filter(
    (e) =>
      (!muscle || e.muscle_ids.includes(muscle as MuscleId)) &&
      (!equipment || e.equipment === equipment) &&
      (!level || e.level === level) &&
      `${e.name} ${e.equipment}`.toLowerCase().includes(needle),
  );
}

/** Every muscle with how many library movements train it. */
export function regionsWithCounts(): (Muscle & { exerciseCount: number })[] {
  return MUSCLES.map((m) => ({ ...m, exerciseCount: EXERCISES.filter((e) => e.muscle_ids.includes(m.id)).length }));
}

// ── Split exercises → muscles ────────────────────────────────────────────────

const DEFAULT_BY_NAME = new Map<string, Exercise>();
for (const day of defaultSplitJson as { exercises: Exercise[] }[])
  for (const ex of day.exercises) DEFAULT_BY_NAME.set(ex.name.toLowerCase(), ex);

/**
 * Muscles a split exercise trains, primary first. Custom splits saved before
 * v1.4.0 carry no `muscles`, so fall back to the catalog link, then to the
 * default split's entry of the same name.
 */
export function musclesFor(ex: Pick<Exercise, 'name' | 'muscles' | 'catalogId'>): MuscleId[] {
  if (ex.muscles?.length) return ex.muscles as MuscleId[];
  const linked = getExercise(ex.catalogId);
  if (linked) return linked.muscle_ids;
  const known = DEFAULT_BY_NAME.get(ex.name.toLowerCase());
  if (known?.muscles?.length) return known.muscles as MuscleId[];
  const byName = EXERCISES.find((e) => e.name.toLowerCase() === ex.name.toLowerCase());
  return byName?.muscle_ids ?? [];
}

/** The catalog entry behind a split exercise, if it is the same movement. */
export function catalogFor(ex: Pick<Exercise, 'name' | 'catalogId'>): CatalogExercise | undefined {
  return (
    getExercise(ex.catalogId) ??
    getExercise(DEFAULT_BY_NAME.get(ex.name.toLowerCase())?.catalogId) ??
    EXERCISES.find((e) => e.name.toLowerCase() === ex.name.toLowerCase())
  );
}

/** A split exercise built from a catalog entry, for "Add to day". */
export function toSplitExercise(entry: CatalogExercise, dayNumber: number): Exercise {
  return {
    id: `${dayNumber}-${entry.id}`,
    name: entry.name,
    sets: String(entry.sets),
    reps: String(entry.reps),
    tempo: '',
    notes: entry.cue,
    catalogId: entry.id,
    muscles: entry.muscle_ids,
  };
}
