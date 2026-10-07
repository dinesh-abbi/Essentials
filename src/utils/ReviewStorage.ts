import { cacheFirst, cacheGet, cacheSet, isoWeekday, localDateKey, readUserCollection, writeUserDoc } from '@/utils/userDocs';

/**
 * Weekly review (Forma's "weekly check-in", renamed so it isn't confused
 * with the office Check-in): one short reflection per week — a win, what got
 * in the way, the next step and a 1–5 confidence score.
 *
 * Firestore: users/{uid}/reviews/{monday date key} — one per week, so a
 * second save that week overwrites the first.
 */

export interface WeeklyReview {
  /** Monday of the week, local date key. Doubles as the document id. */
  week: string;
  win: string;
  challenge: string;
  nextStep: string;
  confidence: 1 | 2 | 3 | 4 | 5;
  updatedAt: number;
}

const CACHE = '@essentials_training_reviews';

export function mondayKey(d: Date = new Date()): string {
  const monday = new Date(d);
  monday.setHours(12, 0, 0, 0);
  monday.setDate(d.getDate() - (isoWeekday(d) - 1));
  return localDateKey(monday);
}

/** Newest week first. */
export async function getReviews(): Promise<WeeklyReview[]> {
  return cacheFirst<WeeklyReview[]>(
    CACHE,
    [],
    async () => {
      const rows = await readUserCollection<Omit<WeeklyReview, 'week'>>('reviews', 'updatedAt', 52);
      return rows ? rows.map(({ id, ...r }) => ({ ...r, week: id })) : null;
    },
    {
      merge: (cached, remote) => {
        const remoteWeeks = new Map(remote.map((r) => [r.week, r]));
        // A local edit newer than the server copy hasn't synced yet — keep it.
        const merged = remote.map((r) => {
          const local = cached.find((c) => c.week === r.week);
          return local && local.updatedAt > r.updatedAt ? local : r;
        });
        const pending = cached.filter((c) => !remoteWeeks.has(c.week));
        return [...pending, ...merged].sort((a, b) => b.week.localeCompare(a.week));
      },
    },
  );
}

export async function saveReview(review: Omit<WeeklyReview, 'updatedAt'>): Promise<WeeklyReview> {
  const full: WeeklyReview = { ...review, updatedAt: Date.now() };
  const cached = await cacheGet<WeeklyReview[]>(CACHE, []);
  await cacheSet(
    CACHE,
    [full, ...cached.filter((r) => r.week !== full.week)].sort((a, b) => b.week.localeCompare(a.week)),
  );
  const { week, ...data } = full;
  await writeUserDoc(['reviews', week], data, false);
  return full;
}
