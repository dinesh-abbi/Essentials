# Catalyst → Essentials merge (v1.2.0)

Catalyst (`dinesh-abbi/catalyst`, Expo SDK 54, NativeWind, zustand,
`@react-native-firebase`, Notifee, `@google/generative-ai`) was a separate
fitness app. In v1.2.0 its features were rebuilt inside Essentials (Expo SDK
56, Firebase JS SDK, the "Technical, but kind" design system) and the
Catalyst repo is retired. Nothing was copied wholesale: screens were
redesigned, state moved onto the Essentials local-first storage pattern, and
duplicated features were folded into the Essentials versions.

## Feature map

| Catalyst | Essentials | Notes |
|---|---|---|
| Today tab (`(tabs)/index.tsx`) — exercise cards, weights, finish workout | **Train** tab `src/app/(tabs)/train.tsx` | Rows expand to cue + load stepper; last-used weights pre-fill; finished sessions → `users/{uid}/workoutLogs` (was top-level `workout_logs`) |
| Weekly split (`(tabs)/weekly.tsx`), "activate this workout" shift | `src/app/train/week.tsx` | Offset per week, resets Monday (same as before) |
| AI split import (`WorkoutAiParser`) | `Coach.parseSplit` + import sheet in week plan | Validates 7 days, unique ids, allowed anatomy keys; preview before saving to `training/split` (was `custom_exercises` docs) |
| Gym morning/evening prompt (`GymPrompt`) | Check-in strip on Train | "Not today"/"Missed it" shifts the week by −1 |
| Tempo reminder | Dismissible tempo note on Train | |
| Anatomy modal + 8 plates | `components/training/AnatomySheet.tsx`, `assets/anatomy/` | |
| AI insight card | "Read-out" on Train | On demand only (Catalyst auto-called the API on every change) |
| Wake / Go / Complete screens | `src/app/train/brief.tsx?kind=…` | One route, three states |
| Workout notifications (06:00, 07:00, complete) | `rescheduleRoutineReminders()` | Own channel `routine#001`; complete is now the in-app brief after finishing |
| Fuel tab — 28-day plan, prev/next | **Fuel** tab `src/app/(tabs)/fuel.tsx` | Cycle from a start date; meal logs keyed by calendar date (`mealLogs/{date}`) |
| Meal status eaten/missed/alternative | eaten / skipped / swapped | Swap note kept |
| Grocery list modal (`purchase_logs` + `users.expenses[]`) | Restock sheet | Ticks write real **Spend** purchases (category Groceries) and untick deletes them — Catalyst kept a second, separate ledger |
| Meal/grocery reminders | `meal-*` / `restock` notifications | Switchable in Profile |
| AI meal scan | `components/fuel/MealScanSheet.tsx` | JSON-mode Gemini call, typed result |
| Catalyst AI chat (`/chat`) + model selector + per-model RPD in Firestore `ai_usage` | **Coach** `src/app/coach.tsx`, `utils/Coach.ts` | REST, no SDK; context-aware (today's session, meals, water, body); usage counted locally per device |
| Profile body metrics | `RoutineSettings` → `users/{uid}.body` | BMI + kg-to-target |
| Biometric "shield" (whole app) | `components/AppLock.tsx` | Opt-in, 5-min grace, never over the alarm |

## Folded into existing Essentials features (Catalyst version dropped)

| Catalyst | Kept instead |
|---|---|
| Water tracker (glasses, zustand) | Essentials hydration (ml logs, widget, reminders) |
| Office attendance → Discord (env webhook) | Essentials check-in (per-user webhook) |
| Expenses ledger / edit-expense screens | Essentials Spend (`purchases`) |
| Email/password login (`@react-native-firebase/auth`) | Essentials login (Google + email, Firebase JS SDK) |
| FCM + Notifee foreground pushes | Not needed — all reminders are local `expo-notifications` |
| Video splash (`expo-video`), CatalystLogo | Essentials animated splash |
| Firebase project `catalyst` | Firebase project `essentials-77c5f` (Catalyst data was not migrated) |

## Data

Catalyst's Firestore data lived in a different Firebase project and a
different shape (top-level `workout_logs`, `nutrition_logs`, `purchase_logs`,
`ai_usage`; expenses as an array on the user doc). It was **not** migrated —
v1.2.0 starts Training/Fuel history fresh in `essentials-77c5f`. If old
history matters, it can be exported from the Catalyst project and imported
into `users/{uid}/workoutLogs` / `mealLogs` with a one-off script.

## Gemini key

The key in Catalyst's `.env` was committed to the public Catalyst repo
(removed in a later commit but still in history) and Google has disabled it as
leaked. Create a new key, put it in `.env` as `EXPO_PUBLIC_GEMINI_API_KEY`,
and consider deleting the old one in Google AI Studio. Until then the coach
shows a "not configured / key rejected" state; everything else works.

## Recovered native code

Separately from the merge: the barcode alarm and gallery-QR native code had
only ever existed inside the gitignored `android/` folder on the old build
machine. It was decompiled from the v1.1.2 release APK, rewritten in
`native-android/`, and wired in by `withEssentialsNative.js`.
