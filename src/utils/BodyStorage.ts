import { cacheFirst, cacheSet, readUserDoc, writeUserDoc } from '@/utils/userDocs';

/**
 * Body metrics (from Catalyst's profile screen). Stored as a `body` map on
 * the existing users/{uid} profile document rather than a new collection —
 * it is one small record per user, same as `discordWebhookUrl`.
 */
export interface BodyMetrics {
  weightKg: number | null;
  heightCm: number | null;
  age: number | null;
  targetWeightKg: number | null;
  updatedAt?: number;
}

const CACHE = '@essentials_body_metrics';

export const EMPTY_BODY: BodyMetrics = { weightKg: null, heightCm: null, age: null, targetWeightKg: null };

/** Cache-first; revalidated from the profile doc in the background. */
export async function getBody(): Promise<BodyMetrics> {
  const body = await cacheFirst<BodyMetrics>(
    CACHE,
    EMPTY_BODY,
    async () => (await readUserDoc<{ body?: BodyMetrics }>([]))?.body ?? null,
    { merge: (cached, remote) => ((remote.updatedAt ?? 0) >= (cached.updatedAt ?? 0) ? remote : cached) },
  );
  return { ...EMPTY_BODY, ...body };
}

export async function saveBody(body: BodyMetrics): Promise<BodyMetrics> {
  const next = { ...body, updatedAt: Date.now() };
  await cacheSet(CACHE, next);
  await writeUserDoc([], { body: next }, true);
  return next;
}

export function bmi(b: BodyMetrics): number | null {
  if (!b.weightKg || !b.heightCm) return null;
  const m = b.heightCm / 100;
  return Math.round((b.weightKg / (m * m)) * 10) / 10;
}

/** Signed kg still to go (negative = lose). */
export function toTarget(b: BodyMetrics): number | null {
  if (!b.weightKg || !b.targetWeightKg) return null;
  return Math.round((b.targetWeightKg - b.weightKg) * 10) / 10;
}

/** Parses a user-typed number, accepting a comma decimal separator. */
export function parseMetric(text: string): number | null {
  const n = parseFloat(text.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}
