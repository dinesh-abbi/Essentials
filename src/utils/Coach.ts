import AsyncStorage from '@react-native-async-storage/async-storage';

import modelsJson from '@/data/coach/models.json';
import type { Exercise, TrainingDay } from '@/utils/TrainingStorage';
import { cacheGet, cacheSet, localDateKey } from '@/utils/userDocs';

/**
 * The coach — Catalyst's Gemini features (chat, meal scan, split import,
 * session insight) behind one small client.
 *
 * Calls the Gemini REST API directly with `fetch` instead of shipping the
 * `@google/generative-ai` SDK: four endpoints' worth of surface doesn't
 * justify a dependency, and `fetch` behaves identically under Hermes.
 *
 * The key comes from `EXPO_PUBLIC_GEMINI_API_KEY` in `.env` (baked into the
 * bundle at build time like the Firebase keys). With no key the coach UI
 * shows a calm "not configured" state instead of failing per request.
 *
 * `dailyBudget` in data/coach/models.json is a *local* guard counted per
 * device per day — not Google's quota (which changes and is per project).
 * It exists so a runaway loop can't burn the key; tune it freely.
 */

export interface CoachModel {
  id: string;
  name: string;
  description: string;
  dailyBudget: number;
  supportsVision: boolean;
}

export const MODELS = modelsJson as CoachModel[];
export const DEFAULT_MODEL = MODELS[0];

const MODEL_KEY = '@essentials_coach_model';
const USAGE_KEY = '@essentials_coach_usage';
const CHAT_KEY = '@essentials_coach_chat';

const API = 'https://generativelanguage.googleapis.com/v1beta/models';

export type CoachFailure = 'no_key' | 'bad_key' | 'budget' | 'busy' | 'unavailable' | 'network' | 'blocked' | 'error';
export type CoachResult = { ok: true; text: string } | { ok: false; reason: CoachFailure; message: string };

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  at: number;
}

const FAILURE_COPY: Record<CoachFailure, string> = {
  no_key: 'The coach isn’t configured. Add EXPO_PUBLIC_GEMINI_API_KEY to .env and rebuild.',
  bad_key: 'Google rejected the Gemini key (revoked or leaked). Put a fresh key in .env and rebuild.',
  budget: 'Today’s budget for this model is used up. Switch models or try tomorrow.',
  busy: 'The model is busy right now. Give it a minute and try again.',
  unavailable: 'This model isn’t available to your key. Pick another one.',
  network: 'No connection. The coach needs the internet.',
  blocked: 'That request was blocked by the model’s safety filter.',
  error: 'Something went wrong talking to the coach. Try again.',
};

function apiKey(): string {
  return process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';
}

export function isConfigured(): boolean {
  return apiKey().length > 0;
}

// ── Model choice & usage ──────────────────────────────────────────────────────

export async function getModel(): Promise<CoachModel> {
  const id = await AsyncStorage.getItem(MODEL_KEY).catch(() => null);
  return MODELS.find((m) => m.id === id) ?? DEFAULT_MODEL;
}

export async function setModel(id: string): Promise<void> {
  await AsyncStorage.setItem(MODEL_KEY, id).catch(() => {});
}

export async function getUsageToday(): Promise<Record<string, number>> {
  const stored = await cacheGet<{ date: string; counts: Record<string, number> } | null>(USAGE_KEY, null);
  return stored?.date === localDateKey() ? stored.counts : {};
}

async function bumpUsage(modelId: string): Promise<void> {
  const counts = await getUsageToday();
  counts[modelId] = (counts[modelId] ?? 0) + 1;
  await cacheSet(USAGE_KEY, { date: localDateKey(), counts });
}

// ── Core call ─────────────────────────────────────────────────────────────────

interface GenerateOptions {
  system?: string;
  history: { role: 'user' | 'model'; text: string }[];
  image?: { base64: string; mimeType: string };
  json?: boolean;
  model?: CoachModel;
}

export async function generate(opts: GenerateOptions): Promise<CoachResult> {
  const key = apiKey();
  if (!key) return fail('no_key');

  const model = opts.model ?? (await getModel());
  const used = (await getUsageToday())[model.id] ?? 0;
  if (used >= model.dailyBudget) return fail('budget');

  const contents = opts.history.map((m, i) => {
    const parts: any[] = [{ text: m.text }];
    if (opts.image && i === opts.history.length - 1) {
      parts.push({ inline_data: { mime_type: opts.image.mimeType, data: opts.image.base64 } });
    }
    return { role: m.role, parts };
  });

  const body: any = {
    contents,
    generationConfig: {
      temperature: opts.json ? 0.2 : 0.7,
      ...(opts.json ? { responseMimeType: 'application/json' } : {}),
    },
  };
  if (opts.system) body.systemInstruction = { parts: [{ text: opts.system }] };

  let delay = 1200;
  for (let attempt = 0; attempt < 3; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${API}/${model.id}:generateContent?key=${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch {
      return fail('network');
    }

    if (res.status === 429 || res.status === 503) {
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, delay));
        delay *= 2;
        continue;
      }
      return fail('busy');
    }
    if (res.status === 400 || res.status === 403) {
      const err: any = await res.json().catch(() => null);
      const msg = String(err?.error?.message ?? '');
      if (/api key/i.test(msg)) return fail('bad_key');
      if (res.status === 403) return fail('unavailable');
      return fail('error');
    }
    if (res.status === 404) return fail('unavailable');
    if (!res.ok) return fail('error');

    const data: any = await res.json().catch(() => null);
    await bumpUsage(model.id);
    const candidate = data?.candidates?.[0];
    if (!candidate && data?.promptFeedback?.blockReason) return fail('blocked');
    if (candidate?.finishReason === 'SAFETY') return fail('blocked');
    const text: string = (candidate?.content?.parts ?? []).map((p: any) => p.text ?? '').join('').trim();
    return text ? { ok: true, text } : fail('error');
  }
  return fail('busy');
}

function fail(reason: CoachFailure): CoachResult {
  return { ok: false, reason, message: FAILURE_COPY[reason] };
}

/** Lenient JSON extraction — tolerates ```json fences and leading prose. */
export function parseJson<T>(raw: string): T | null {
  const cleaned = raw.replace(/```(?:json)?/gi, '').trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.search(/[[{]/);
    const end = Math.max(cleaned.lastIndexOf(']'), cleaned.lastIndexOf('}'));
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

// ── Chat ──────────────────────────────────────────────────────────────────────

const COACH_PERSONA = `You are the coach inside Essentials, a personal app for training, food, hydration and daily habits.
Voice: calm, direct, specific. Short paragraphs. Use the user's own numbers when they help.
Format: plain sentences; "- " bullets only for lists; **bold** sparingly for the one thing that matters. No headings, no tables, no emoji.
You are not a doctor: for pain, injury or medical conditions, say so plainly and suggest a professional.`;

export async function getChat(): Promise<ChatMessage[]> {
  return cacheGet<ChatMessage[]>(CHAT_KEY, []);
}

export async function saveChat(messages: ChatMessage[]): Promise<void> {
  await cacheSet(CHAT_KEY, messages.slice(-60));
}

export async function clearChat(): Promise<void> {
  await cacheSet<ChatMessage[]>(CHAT_KEY, []);
}

/** Sends the running conversation (last 20 turns) plus today's context. */
export async function chat(messages: ChatMessage[], context: string): Promise<CoachResult> {
  const history = messages.slice(-20).map((m) => ({ role: m.role, text: m.text }));
  // Gemini requires the conversation to open with a user turn.
  while (history.length && history[0].role !== 'user') history.shift();
  return generate({
    system: `${COACH_PERSONA}\n\nWhat the app knows about the user today:\n${context}`,
    history,
  });
}

// ── Meal scan ─────────────────────────────────────────────────────────────────

export interface MealScan {
  items: { name: string; calories: number; protein: number; carbs: number; fat: number }[];
  total: { calories: number; protein: number; carbs: number; fat: number };
  score: number;
  advice: string;
}

export async function scanMeal(base64: string, mimeType = 'image/jpeg'): Promise<{ ok: true; scan: MealScan } | { ok: false; message: string }> {
  const model = await getModel();
  if (!model.supportsVision) return { ok: false, message: `${model.name} can’t read images. Pick a vision model.` };
  const res = await generate({
    model,
    json: true,
    image: { base64, mimeType },
    history: [
      {
        role: 'user',
        text: `Identify the food in this photo and estimate its nutrition for the portion shown.
Return JSON only, exactly this shape (numbers, grams for macros, kcal for calories):
{"items":[{"name":"","calories":0,"protein":0,"carbs":0,"fat":0}],"total":{"calories":0,"protein":0,"carbs":0,"fat":0},"score":0,"advice":""}
"score" is 1-10 for how well the meal supports fat loss while keeping muscle. "advice" is one short practical sentence.
If the photo is not food return {"items":[],"total":{"calories":0,"protein":0,"carbs":0,"fat":0},"score":0,"advice":"No food found in this photo."}`,
      },
    ],
  });
  if (!res.ok) return { ok: false, message: res.message };
  const scan = parseJson<MealScan>(res.text);
  if (!scan || !Array.isArray(scan.items) || !scan.total) {
    return { ok: false, message: 'The coach couldn’t read that photo. Try a clearer, closer shot.' };
  }
  return { ok: true, scan };
}

// ── Split import ──────────────────────────────────────────────────────────────

const SPLIT_PROMPT = `Convert the training plan provided into a 7-day weekly split.
Return a JSON array of exactly 7 objects, Monday (dayNumber 1) to Sunday (dayNumber 7):
{"dayNumber":1,"focus":"Chest & Biceps","isRecovery":false,"anatomyFocus":["chest","biceps"],"exercises":[{"id":"incline_db_press","name":"Incline Dumbbell Press","sets":"3","reps":"8-12","tempo":"3:1:2:1","notes":"one coaching cue","isCardio":false}]}
Rules:
- Every day 1..7 must exist, in order. Days the plan doesn't cover are {"focus":"Recovery","isRecovery":true,"exercises":[]}.
- anatomyFocus may only use: chest, back, shoulders, abs, biceps, triceps, forearms, lower_body.
- ids are unique snake_case. sets/reps/tempo are strings. Keep notes to one sentence.
- Return only the JSON array.`;

export async function parseSplit(
  source: { text: string } | { base64: string; mimeType: string },
): Promise<{ ok: true; days: TrainingDay[] } | { ok: false; message: string }> {
  const res =
    'text' in source
      ? await generate({ json: true, history: [{ role: 'user', text: `${SPLIT_PROMPT}\n\nThe plan:\n${source.text}` }] })
      : await generate({
          json: true,
          image: source,
          history: [{ role: 'user', text: `${SPLIT_PROMPT}\n\nThe plan is in the attached file.` }],
        });
  if (!res.ok) return { ok: false, message: res.message };

  const parsed = parseJson<any[]>(res.text);
  if (!Array.isArray(parsed) || parsed.length !== 7) {
    return { ok: false, message: 'That didn’t come back as a 7-day week. Try pasting the plan as text.' };
  }
  const allowed = new Set(['chest', 'back', 'shoulders', 'abs', 'biceps', 'triceps', 'forearms', 'lower_body']);
  const seen = new Set<string>();
  const days: TrainingDay[] = parsed.map((d, i) => ({
    dayNumber: i + 1,
    focus: String(d?.focus || (d?.isRecovery ? 'Recovery' : `Day ${i + 1}`)),
    isRecovery: !!d?.isRecovery || !Array.isArray(d?.exercises) || d.exercises.length === 0,
    anatomyFocus: Array.isArray(d?.anatomyFocus) ? d.anatomyFocus.filter((a: string) => allowed.has(a)) : [],
    exercises: (Array.isArray(d?.exercises) ? d.exercises : []).map((ex: any, j: number): Exercise => {
      let id = String(ex?.id || `d${i + 1}_${j + 1}`).replace(/[^a-zA-Z0-9_-]/g, '_');
      if (seen.has(id)) id = `${id}_${i + 1}_${j + 1}`;
      seen.add(id);
      return {
        id,
        name: String(ex?.name || 'Exercise'),
        sets: String(ex?.sets ?? '3'),
        reps: String(ex?.reps ?? '10'),
        tempo: String(ex?.tempo ?? ''),
        notes: String(ex?.notes ?? ''),
        isCardio: !!ex?.isCardio,
      };
    }),
  }));
  return { ok: true, days };
}

// ── Session read-out ──────────────────────────────────────────────────────────

export async function sessionInsight(log: {
  title: string;
  exercises: { name: string; isCompleted: boolean; weight: number; lastWeight?: number }[];
}): Promise<CoachResult> {
  return generate({
    system: COACH_PERSONA,
    history: [
      {
        role: 'user',
        text: `Here is today's session (weights in kg, lastWeight is what I used last time):
${JSON.stringify(log)}
In under 70 words: one thing that went well, one specific progressive-overload move for next time. No preamble.`,
      },
    ],
  });
}
