import type { LoggedSet, WorkoutSession } from '@/utils/TrainingStorage';

/**
 * Personal records, computed on the phone from logged sessions — nothing is
 * stored. Moves are matched by name so the same lift on two split days
 * shares one record. Sessions from before v1.4.0 (no sets) contribute their
 * top weight but no rep counts.
 */

export interface MoveRecord {
  key: string;
  name: string;
  catalogId?: string;
  /** Heaviest single set (kg) and the reps done with it. */
  bestWeight: number;
  bestWeightReps?: number;
  /** Best estimated one-rep max (Epley), from sets with reps. */
  bestE1rm: number;
  lastDate: string;
  sessions: number;
}

export interface NewRecord {
  name: string;
  kind: 'weight' | 'e1rm';
  value: number;
  previous: number;
}

/** Epley: kg × (1 + reps / 30); a single is the weight itself. */
export function e1rm(set: LoggedSet): number {
  if (set.weight <= 0 || set.reps <= 0) return 0;
  return set.reps === 1 ? set.weight : set.weight * (1 + set.reps / 30);
}

const keyOf = (name: string) => name.trim().toLowerCase();
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Records per move, heaviest first. `sessions` in any order. */
export function computeRecords(sessions: WorkoutSession[]): MoveRecord[] {
  const out = new Map<string, MoveRecord>();
  for (const s of sessions)
    for (const e of s.exercises) {
      if (!e.isCompleted || e.isCardio) continue;
      const sets = e.sets?.length ? e.sets : e.weight > 0 ? [{ reps: 0, weight: e.weight }] : [];
      if (!sets.length) continue;
      const key = keyOf(e.name);
      const rec =
        out.get(key) ??
        ({ key, name: e.name, catalogId: e.catalogId, bestWeight: 0, bestE1rm: 0, lastDate: s.date, sessions: 0 } as MoveRecord);
      rec.sessions += 1;
      if (s.date > rec.lastDate) rec.lastDate = s.date;
      for (const set of sets) {
        if (set.weight > rec.bestWeight || (set.weight === rec.bestWeight && set.reps > (rec.bestWeightReps ?? 0))) {
          rec.bestWeight = set.weight;
          rec.bestWeightReps = set.reps || undefined;
        }
        rec.bestE1rm = Math.max(rec.bestE1rm, round1(e1rm(set)));
      }
      out.set(key, rec);
    }
  return [...out.values()].sort((a, b) => b.bestWeight - a.bestWeight || a.name.localeCompare(b.name));
}

/**
 * What `session` beat compared with everything logged before it. A move's
 * first ever session sets the baseline and isn't a record.
 */
export function newRecords(session: WorkoutSession, history: WorkoutSession[]): NewRecord[] {
  const before = computeRecords(history.filter((h) => h.id !== session.id && h.completedAt < session.completedAt));
  const byKey = new Map(before.map((r) => [r.key, r]));
  const found: NewRecord[] = [];
  for (const e of session.exercises) {
    if (!e.isCompleted || e.isCardio || !e.sets?.length) continue;
    const prev = byKey.get(keyOf(e.name));
    if (!prev) continue;
    const topWeight = Math.max(...e.sets.map((s) => s.weight));
    const topE1rm = round1(Math.max(...e.sets.map(e1rm)));
    if (topWeight > prev.bestWeight) found.push({ name: e.name, kind: 'weight', value: topWeight, previous: prev.bestWeight });
    else if (prev.bestE1rm > 0 && topE1rm > prev.bestE1rm)
      found.push({ name: e.name, kind: 'e1rm', value: topE1rm, previous: prev.bestE1rm });
  }
  return found;
}
