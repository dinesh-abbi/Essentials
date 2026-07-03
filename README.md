# Essentials

A production-grade personal utility app for Android, built with [Expo](https://expo.dev) (SDK 56) and React Native. Manages the three pillars of daily productivity — **Hydration**, **Attendance**, and **Expenses** — in a single, beautifully designed app.

---

## Features

### 💧 Hydration Tracker
- Log water intake in quick increments (250ml, 500ml, 1000ml)
- Animated water-fill progress indicator
- Hourly tracking timeline (8 AM – 10 PM)
- Daily, Weekly (bar chart), and Monthly (heat-map calendar) views
- Persistent hydration reminders via scheduled notifications with one-tap quick-log action

### 📸 Attendance (Check-In)
- Camera-based attendance capture
- Automated Discord webhook posting with timestamp and photo
- IST-localised timestamps on all submissions

### 💸 Expenses
- Log and categorise daily purchases
- Firestore-backed persistence per user account

### 🔔 Smart Notifications
- Exact-alarm hydration reminders every hour (8 AM – 10 PM)
- Custom notification sound (`water_remainder.mp3`)
- Self-healing scheduler — reschedules if fewer than expected reminders are found

### 🔐 Authentication
- Google Sign-In (native, via `@react-native-google-signin`)
- Email / Password sign-in and registration
- Firebase Auth with persistent session

### 🔄 OTA Updates (GitHub Releases)
- Self-hosted, completely free update distribution
- Checks `github.com/dinesh-abbi/Essentials/releases/latest` on every app launch
- Downloads and installs APK in-app without leaving to the browser
- Progress bar during download

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Expo SDK 56 / React Native 0.85 |
| Navigation | Expo Router v4 (file-based) |
| Auth | Firebase Auth + Google Sign-In |
| Database | Firebase Firestore |
| Animations | React Native Reanimated 4 |
| Notifications | expo-notifications |
| OTA Updates | GitHub Releases + expo-file-system |

---

## Project Structure

```
src/
├── app/
│   ├── (tabs)/          # Bottom tab screens (Home, Explore, Profile)
│   ├── water/           # Hydration screens (Daily, Weekly, Monthly)
│   ├── attendance.tsx   # Camera check-in screen
│   ├── purchases.tsx    # Expense logger
│   ├── discord.tsx      # Discord webhook setup
│   └── _layout.tsx      # Root layout + auth guard
├── components/
│   ├── AppLoader.tsx    # Branded loading spinner
│   ├── OTAUpdateChecker.tsx  # GitHub Releases update modal
│   └── ui/             # Reusable UI primitives
├── contexts/
│   └── AuthContext.tsx  # Firebase auth state + Firestore profile
├── utils/
│   ├── firebase.ts     # Firebase app initialisation
│   ├── WaterStorage.ts # Hydration data helpers (Firestore)
│   └── notifications.ts # Notification scheduling
└── constants/
    └── theme.ts        # Design tokens (colours, spacing, radii)
```

---

## Setup

### Prerequisites
- Node.js 20+
- JDK 17 (required for Android builds — Java 25 is NOT supported)
- Android SDK + a physical device or emulator
- GitHub CLI (`gh`) authenticated as `dinesh-abbi`

### 1. Clone & install

```bash
git clone https://github.com/dinesh-abbi/Essentials.git
cd Essentials
yarn install
```

### 2. Environment variables

Create a `.env` file in the project root (never commit this):

```env
# Firebase — project: essentials-77c5f
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=...

# Google Sign-In Web Client ID (from google-services.json)
EXPO_PUBLIC_FIREBASE_GOOGLE_WEB_CLIENT_ID=...
```

> **Note:** Discord webhook URLs are **user-provided** via the in-app setup screen. Do not add them to `.env`.

### 3. Run (development)

```bash
npx expo start
```

---

## Building & Releasing

### Local Release Build

```bash
cd android && ./gradlew assembleRelease
```

APK output: `android/app/build/outputs/apk/release/app-release.apk`

### Publish OTA Update (GitHub Releases)

> **Before every release:**
> 1. Bump `"version"` in `app.json` (e.g. `"1.0.1"`)
> 2. Bump `"android.versionCode"` in `app.json` (e.g. `3` → `4`)
> 3. Commit the version bump

```bash
npm run publish
```

This will:
- Build the release APK via Gradle
- Create a GitHub Release tagged `v{version}`
- Upload the APK as a release asset

Users will see an in-app update prompt the next time they open the app.

---

## Release Checklist

- [ ] Bump `version` in `app.json`
- [ ] Bump `android.versionCode` in `app.json` (must always increment)
- [ ] Commit version bump: `git commit -m "chore: bump version to vX.Y.Z"`
- [ ] Run `npm run publish`
- [ ] Verify at `https://github.com/dinesh-abbi/Essentials/releases`
- [ ] Sideload on test device and confirm update modal appears

---

## Notification Channels

All notifications use the `water_reminder` channel with custom sound `water_remainder.mp3`.

| Trigger | Time | Action |
|---|---|---|
| Hydration reminder | Every hour, 8 AM – 10 PM | Tap → Home, or "Yes" → logs 250ml |

---

## Secrets & Security

- `.env` is in `.gitignore` and must **never** be committed
- Firebase credentials are restricted to the `com.catalyst.essentials` package in the Firebase console
- Discord webhook URLs are stored per-user in Firestore (`users/{uid}.discordWebhookUrl`) — not in the codebase
