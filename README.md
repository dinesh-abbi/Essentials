# Essentials

A personal Android app for the daily basics — **hydration, training, food, spend, check-in and a barcode alarm** — with an AI coach that knows your day. Built with Expo SDK 56 / React Native 0.85, Firebase, and a deliberately quiet "technical, but kind" design.

As of **v1.2.0** the separate **Catalyst** fitness app lives inside Essentials (Train, Fuel, Coach). The Catalyst repo is retired; see [`docs/CATALYST_MERGE.md`](docs/CATALYST_MERGE.md) for what moved where.

---

## What's in it

| Area | Where | What it does |
|---|---|---|
| **Home** | `src/app/(tabs)/index.tsx` | Hydration hero (animated vessel, hourly dots), Spend + Check-in cards, today's Training/Fuel progress, armed alarm |
| **Train** | `src/app/(tabs)/train.tsx`, `src/app/train/*` | Today's session from the weekly split, load stepper with last-used weights, finish & log, streak, week plan, shift a day, AI split import, anatomy plates |
| **Fuel** | `src/app/(tabs)/fuel.tsx` | 28-day meal plan as a cycle field, eaten / swapped / skipped logging, restock list (logs real Groceries purchases), AI meal scan |
| **Coach** | `src/app/coach.tsx` | Gemini chat with today's context, per-model daily budget |
| **Hydration** | `src/app/water/*` | Daily/weekly/monthly views, goal, celebration, home-screen widget |
| **Spend** | `src/app/purchases/*`, `src/app/upi/*` | Expenses, reports, biometric gate, UPI QR pay |
| **Check-in** | `src/app/attendance.tsx` | Camera check-in posted to your own Discord webhook |
| **Barcode alarm** | `src/app/alarm/*` + `native-android/` | An alarm you can only stop by scanning a barcode across the room |
| **Profile** | `src/app/(tabs)/profile.tsx` | Services, sync status, body metrics, reminder switches, app lock |

**Data is local-first.** Every change is saved on the phone instantly and pushed to Firestore in the background; reads come from the on-device cache and refresh quietly. Works offline; Profile shows how many changes are waiting to upload.

---

## Setup

### Prerequisites
- Node.js 20+ (24 works)
- JDK 17 (`winget install Microsoft.OpenJDK.17`) — newer JDKs break the Android build
- Android SDK with platform 36, build-tools 36.0.0, NDK 27.1.12297006, CMake 3.22.1
- GitHub CLI (`gh`) logged in as `dinesh-abbi` (for releases)

### Install

```bash
git clone git@github.com:dinesh-abbi/Essentials.git
cd Essentials
npm ci
cp .env.example .env    # then fill it in — see below
```

### Environment (`.env`, never committed)

```env
# Firebase web config (project essentials-77c5f). Any key left empty falls back
# to google-services.json, so the app still points at the right project.
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=essentials-77c5f.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=essentials-77c5f
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=essentials-77c5f.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=228016196
EXPO_PUBLIC_FIREBASE_APP_ID=
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=
EXPO_PUBLIC_FIREBASE_GOOGLE_WEB_CLIENT_ID=

# The coach (chat, meal scan, split import). Get a key at https://aistudio.google.com/apikey
EXPO_PUBLIC_GEMINI_API_KEY=
```

`EXPO_PUBLIC_*` values are inlined into the JS bundle at build time — rebuild after changing them. Discord webhooks are per-user and set in the app, never here.

### Run in development

```bash
npx expo start          # Metro
npm run android         # build + install a dev client on a connected device
```

---

## Building a release APK

`android/` is **generated** — never edit it by hand. Everything native lives in tracked sources and config plugins:

| Tracked source | Plugin | Becomes |
|---|---|---|
| `widget-native/` | `withWaterWidget.js` | home-screen hydration widget |
| `native-android/` | `withEssentialsNative.js` | barcode alarm service/receiver/activity, QR-from-image module, lock-screen MainActivity |
| `app.json` → queries | `withAndroidQueries.js` | UPI app visibility |

```bash
npx expo prebuild --platform android --clean
cd android
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a
# → android/app/build/outputs/apk/release/app-release.apk
```

On Windows use `gradlew.bat`, and create `android/local.properties` with `sdk.dir=C:/Users/<you>/AppData/Local/Android/Sdk` if `ANDROID_HOME` isn't set.

### Publishing an update (OTA via GitHub Releases)

The app checks `github.com/dinesh-abbi/Essentials/releases/latest` on launch and installs the attached APK.

1. Bump `version` in `app.json` **and** `package.json`; increment `android.versionCode` (must always go up).
2. Write `changelogs/vX.Y.Z.md` (`node scripts/prepare-changelog.js` drafts one) and add a summary to `CHANGELOG.md`. The release body *is* this file — the in-app reader parses its `###` sections.
3. Build the APK (above), commit, tag `vX.Y.Z`, push.
4. `gh release create vX.Y.Z <apk> --title "Essentials vX.Y.Z" --notes-file changelogs/vX.Y.Z.md`

(`npm run publish` / `./build.sh` automate 1–4 on Linux/macOS.)

Release APKs are signed with the template debug keystore that previous releases used, so updates install over the existing app. Don't switch keys without a migration plan — Android refuses an update signed with a different key.

---

## Firestore layout (`users/{uid}`)

| Path | Written by |
|---|---|
| `users/{uid}` (doc) | profile: `discordWebhookUrl`, `waterGoal`, `body` |
| `waterLogs/{id}` | hydration |
| `purchases/{id}` | spend (incl. ticked groceries) |
| `upi_transactions/{id}` | UPI pay |
| `workoutLogs/{id}` | finished training sessions |
| `training/split` | imported custom split |
| `mealLogs/{YYYY-MM-DD}` | meal statuses per day |
| `fuel/cycle`, `fuel/bought` | meal-cycle anchor, restock ticks |

---

## Docs

- [`AGENTS.md`](AGENTS.md) — architecture, native gotchas, release workflow (read before changing code)
- [`RULES.md`](RULES.md) — engineering + design rules
- [`CLAUDE.md`](CLAUDE.md) — entry point for Claude Code
- [`BARCODE_ALARM.md`](BARCODE_ALARM.md) — alarm design
- [`docs/CATALYST_MERGE.md`](docs/CATALYST_MERGE.md) — the Catalyst → Essentials merge
- [`CHANGELOG.md`](CHANGELOG.md), [`changelogs/`](changelogs)
