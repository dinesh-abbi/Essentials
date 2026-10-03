# Rules

The short list of things that must stay true in this repo. `AGENTS.md`
explains *why* and *where*; this file is the checklist. If a change breaks a
rule, either don't make it or update the rule here in the same change.

## Data

1. **Local-first, always.** A user action writes the AsyncStorage cache and
   queues a `SyncManager` action, then returns. Never `await` Firestore,
   `isOnline()`, or any network call on the tap path.
2. **Reads come from the cache.** Use `createCollectionCache` (lists) or
   `cacheFirst` (docs/maps). Only a never-cached value may wait on the
   network, once. Background revalidation must be throttled and must emit
   `notifyDataChanged` only when data actually changed.
3. **Everything lives under `users/{uid}`.** New persisted data goes through
   `writeUserDoc` / `deleteUserDoc` paths below the user doc. No new
   top-level collections.
4. **Queue writes are idempotent.** Use deterministic document ids
   (`water_…`, `purchase_…`, `session_…`, date keys) so a replay can't
   duplicate. A "clear" carries explicit ids — never delete a whole
   collection from a queued action.
5. **Dates are local.** Use `localDateKey()` / local midnight, never
   `toISOString().split('T')[0]` (that's UTC and files a 1 AM log under
   yesterday).
6. **No secrets in the repo.** `.env` is gitignored. `EXPO_PUBLIC_*` values
   ship inside the APK — treat them as public identifiers, protect data with
   Firestore rules. Discord webhooks are per user in Firestore.

## Native

7. **`android/` is generated.** Never hand-edit it. Native code lives in
   `widget-native/` and `native-android/` and reaches `android/` through
   `withWaterWidget.js` / `withEssentialsNative.js`.
8. **One name per native module.** `"WidgetStorage"`, `"AlarmScheduler"`,
   `"QrCodeScanner"` are taken. A duplicate `getName()` crashes at launch.
9. **Never block the alarm.** Nothing (auth guard, app lock, update
   checker, redirects) may cover or navigate away from the `alarm` segment.
10. **Keep the signing key.** Releases are signed with the template debug
    keystore the installed app already has. Changing keys breaks OTA updates.

## Design ("Technical, but kind" — `src/constants/theme.ts`)

11. **One accent.** `water` is the only colour with identity. `alert` is for
    genuine problems only (an error, a skipped meal). No second accent, no
    gradients for decoration, no shadows.
12. **Type and space carry the design.** Use the `Type` ramp — big tabular
    numbers (`hero`, `numberSm`, `readout`) next to quiet body text; UPPERCASE
    only inside bracket labels (`[ TRAINING ]`). Sentence case everywhere else.
13. **Hairlines, not boxes.** Separate with space and `hairline` borders.
    Don't wrap every section in a card, and never give a screen a grid of
    identical cards.
14. **Motion is precise.** Ease-out entrances via `EntranceView`; springs
    only for direct manipulation (press, drag, a fill after a tap). Every
    looping animation is gated on `useReducedMotion()`.
15. **Shared primitives first.** `AnimatedPressable`, `Sheet`,
    `ScreenHeader`, `EntranceView`, `AnimatedNumber`, the line illustrations.
    One illustration per screen at most.
16. **Real state only.** No fake "Synced ✓" badges — show what the app
    actually knows (e.g. Profile's pending-sync count).
17. **Tap targets ≥ 44 dp**, every interactive element has an
    `accessibilityLabel`/role, and text never uses `textLow`.

## Code

18. Typecheck must pass: `npx tsc --noEmit -p .` (no new `any` casts on
    routes beyond the existing `as any` pattern for typed routes).
19. New lint errors in files you touch are fixed, not suppressed — except
    the known React-Compiler false positive on Reanimated shared-value
    writes inside gesture/press handlers.
20. AI calls (`utils/Coach.ts`) happen only on an explicit user action, never
    on render or focus.
21. Releases: bump `app.json` + `package.json` version, increment
    `versionCode`, add `changelogs/vX.Y.Z.md` (the release body the app
    renders) and a `CHANGELOG.md` entry.
