# Changelog

## [1.4.0] - 2026-10-07
### Forma merged into Essentials
- Muscle explorer (`train/explore`) and exercise library (`train/exercise/[id]`): 34 moves, 14 muscles, react-native-svg `BodyMap`/`ExerciseArt`/`MuscleChip`, favourites, "add to a day". Catalog in `data/training/exercises.json`, `muscles.json`, `poses.ts`; `utils/ExerciseCatalog.ts`.
- Set-by-set logging in `ExerciseRow` (reps × kg per set, last-time fill, remaining-sets stepper, rest ring). Sessions gain optional `sets`/`minutes`; split exercises gain optional `catalogId`/`muscles`.
- Split editor (`train/edit-day`), reached from the week plan.
- Progress (`train/progress`): recap, muscle-load heat maps, sets per day, records (`TrainingRecords.ts`, e1RM, new-record callout on the finish brief), goals (`GoalStorage.ts`), weekly review (`ReviewStorage.ts`). Volume maths in `TrainingVolume.ts`.
- New Firestore docs under `users/{uid}`: `goals/{id}`, `reviews/{monday}`, `training/favourites`. Map of what moved: `docs/FORMA_MERGE.md`.

### Changed
- Train's "Muscles" opens a body-map sheet (`MusclesSheet`) instead of PNG plates; `TrainingDay.anatomyFocus` is no longer used.

## [1.3.0] - 2026-10-04
### "Glance" redesign
- New design system in `constants/theme.ts`: true-dark base, one hue per area (`Hue`), Nunito + Doto (dot-matrix) type, chunky `Tile`/`ChunkyButton`/`IconBlob`/`Chip` with a sinking lip, `LargeHeader`, `ProgressRing`, `DotMeter`/`LiveDot`, `SettingRow`.
- Home rebuilt: activity rings (water/meals/training), Drip mascot (`illustrations/Droplet.tsx`), bento tiles, hour dots. Train, Fuel, Profile, week plan and brief screens rebuilt on the same primitives; new hue tab bar with labels.
- Bracket labels removed app-wide; sheets and headers use dot-matrix eyebrows. Widget + notification accent recoloured.
- Every remaining screen rebuilt on the same primitives: Water (day/week/month, goal sheet, goal celebration, day report), Spend (grouped list, ExpenseSheet, week bars, category donut, day report), UPI scanner/pay, Check-in camera, Alarm setup + ringing screen, Login, App lock, Discord, What's new, Update, Restock sheet, Anatomy sheet, AppLoader.
- New shared primitives: Segmented, StatTile/StatGrid, BarChart, Donut, DateTimeSheet, ScanFrame, BigMessage, Confetti; spend categories with icons/colours (components/spend).
- Removed dead template code (explore tab, themed-text/view, Button, Collapsible, old line illustrations, use-theme/use-color-scheme hooks) and all Feather icon usage.
- Fixed: goal notification used the default goal instead of the user's; failed check-in uploads took a second photo for the offline copy.

### Removed
- AI features: Coach chat (`app/coach.tsx`), `utils/Coach.ts`, `data/coach/models.json`, meal scan sheet, AI split import, session read-out, `EXPO_PUBLIC_GEMINI_API_KEY`.
- Fonts Space Grotesk and Onest (replaced by Nunito and Doto).

## [1.2.0] - 2026-10-03
### Catalyst merged into Essentials
- **Train** tab (today's session, load stepper with last-used weights, finish & log, streak), **Week plan** (shift a day, Monday reset, AI split import from PDF/photo/text, default-split reset), anatomy plates.
- **Fuel** tab: 28-day meal cycle field, eaten/swapped/skipped logging, cycle realign, restock list that writes real Groceries purchases, AI meal scan.
- **Coach** (Gemini REST, no SDK): context-aware chat, per-model daily budgets, session read-out.
- Training / meal / restock reminders on a separate `routine#001` channel with deterministic notification ids, switchable in Profile.
- Body metrics on the profile doc; optional whole-app biometric lock.
- See `docs/CATALYST_MERGE.md` for the feature-by-feature mapping and what was intentionally dropped.

### Local-first data
- Every write now updates the AsyncStorage cache and enqueues a SyncManager action, then returns; a background flusher (debounced, on foreground, back-off retries) pushes to Firestore. Reads are cache-first with throttled background revalidation (`utils/localFirst.ts`, `userDocs.cacheFirst`) and change events (`SyncManager.subscribe`, `hooks/use-data-refresh.ts`).
- Fixed: the offline queue was never flushed (nothing called `syncOfflineData`), and a queued `water_clear` deleted the entire `waterLogs` collection.

### Native
- Barcode alarm + gallery QR native code recovered from the v1.1.2 APK into tracked `native-android/`, re-applied by the new `withEssentialsNative.js` config plugin. `android/` is now fully generated (the stale tracked `android/app/build.gradle` and `gradle.properties` were untracked).
- Firebase config falls back to `google-services.json`; `android.googleServicesFile` set.

### UI
- Four-tab nav; Home gains a Training/Fuel "today's plan" row; Profile rebuilt as instrument rows; shared draggable `Sheet`, `ScreenHeader`, `EntranceView`, `AnimatedNumber` primitives.

## [1.1.2] - 2026-08-29
### UI & UX Modernization
- **Reworked Hydration Hero**: Genuine dual-wave animated surface with independently-phased waves, floating bubbles that vanish at the liquid line, and a spring-driven fill on every log/remove action.
- **AM/PM Hourly Activity Dots**: New two-row dot grid on the hydration card showing exactly which hours water was logged today.
- **Calmer Secondary Cards**: Spend and Check-in now share a common bracket-labelled card shell with hand-drawn line illustrations.
- **Slimmer Floating Nav Bar**: Rebuilt bottom tab bar as a minimal hairline pill with a sliding active-tab indicator, replacing the prior glass/blur experiment.
- **Entrance Stagger Bug Fix**: Home screen entrance animation now genuinely staggers between elements (a prior build silently discarded the stagger delay).

### Bug Fixes
- **Home-Screen Widget Re-Themed**: The widget's colors were still on the old blue palette and hadn't been updated when the app's palette changed to sage-green; it now mirrors the app's current palette in both light and dark launcher themes.
- Assorted fixes and improvements across updates and other screens.

### Housekeeping
- Removed leftover files from an abandoned in-progress redesign experiment.
- v1.1.1 was a same-day housekeeping version bump published with an empty changelog before the redesign source was committed; v1.1.2 supersedes it with the complete, accurate release.

## [1.0.23] - 2026-08-19
### New Features & Enhancements
- **Smart Updates & Screen-Off Handling**: Instant cached APK detection with zero-redownload install flow, automated storage cleanup, and background install notification.
- **Scroll-Aware Floating Navigation**: Dynamic bottom navigation bar that slides away during scroll down and reveals smoothly on scroll up.
- **Profile 2x2 Bento Redesign**: Replaced vertical lists with a 2x2 Bento grid for Discord integrations, Barcode Alarm, App Version, and Cloud Sync. Clean hero profile card with inline name editing and full bottom tab clearance.
- **Hydration Fluid Chamber & Motion UI**: Redesigned Home screen water module with an animated fluid capsule vessel, real-time odometer count-up, interactive logging controls, and active-hour timeline dot indicator.
- **Spend & Attendance Cards**: Elevated secondary dashboard cards with budget indicator bars, animated viewfinder laser scanner, and direct action prompts.
- **Spacious Record Expense Form**: Enhanced expense entry with dedicated currency input, spacious date/time pickers, and a wrap-around category chip grid that avoids horizontal swipe conflicts.
- **Instant Widget Sync**: Immediate synchronization of home-screen widget water logs into app state upon opening.

## Previous Updates
- **Barcode Alarm System:** Introduced a new Barcode Alarm feature, including a new `alarm` routing directory (`src/app/alarm/`), persistent storage utility (`src/utils/BarcodeAlarmStorage.ts`), and documentation (`BARCODE_ALARM.md`).
- **Unified Reporting Views:** Consolidated the separate weekly and monthly views for both the Water and Purchases tracking modules into unified `report.tsx` files (`src/app/water/report.tsx`, `src/app/purchases/report.tsx`), simplifying the user flow.
- **Document Picker Integration:** Added `expo-document-picker` to dependencies in `package.json` to allow file selection capabilities (likely for backups or importing data).

## Bug Fixes
- **Restored Biometric Authentication:** Re-implemented the biometric lock (Face ID / Touch ID) on the Spend Tracker (`src/app/purchases/index.tsx`) that was missing after the recent layout refactor.
- **Flexible Purchase Categories:** Relaxed the `category` type definition in `src/utils/PurchasesStorage.ts` from a strict literal union to `string`, preventing errors when adding custom categories.
- **Historical Weekly Data:** Updated `getWeeklyData` in `src/utils/WaterStorage.ts` to accept an optional `refDateMs` parameter. This fixes the issue of only being able to retrieve weekly data for the current week, enabling historical charting.
- **Notification Mocking:** Added a mock implementation for `dismissAllNotificationsAsync` in `src/utils/notifications.ts` to prevent runtime crashes on environments where native Expo Notifications aren't available.

## UI Fixes & Refactoring
- **Simplified Routing:** Removed unnecessary layout wrappers and separated route files (`_layout.tsx`, `monthly.tsx`, `weekly.tsx`) for the `water` and `purchases` directories in favor of the new unified reports.
- **General Layout Tweaks:** Updated core layouts and main screens including `src/app/_layout.tsx`, `src/app/(tabs)/index.tsx`, `src/app/(tabs)/profile.tsx`, `src/app/purchases/index.tsx`, and `src/app/water/index.tsx` to accommodate the new routing structure and styling improvements.
- **Package Updates:** Bumped versions for several Expo packages (e.g., `expo`, `expo-router`, `@expo/ui`, `expo-notifications`) for improved stability and potential bug fixes.
