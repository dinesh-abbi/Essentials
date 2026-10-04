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

## Design ("Glance" — `src/constants/theme.ts`)

Every screen must be understood from shapes and colours before a word is
read. The look blends Apple (activity rings, bento tiles), Samsung One UI
(large airy titles, grouped cards, coloured squircle icons) and Nothing
(dot-matrix numerals, dot meters, a red "live" dot).

11. **One hue per area, everywhere.** `Hue.water` (cyan), `train` (coral),
    `fuel` (lime), `spend` (sunshine), `checkin` (lavender), `alarm`
    (pink), `profile` (blue). Never borrow another area's hue for decoration.
    `alert` (red) is for real problems and the "live" dot only.
12. **Picture first, number second, words last.** Prefer a ring, a dot meter,
    an icon blob, the Drip mascot or a row of plates to a sentence. Numbers
    use the dot-matrix styles (`dotHero` / `dotNumber` / `dotSmall`);
    labels are short (`dotLabel`). No literal `[ BRACKET ]` labels.
13. **Pressable things look pressable.** Use `Tile`, `ChunkyButton`,
    `IconBlob`, `Chip` (`components/ui/chunky.tsx`) — the darker lip that
    sinks on press is the only depth cue. No drop shadows.
14. **Motion is friendly but gated.** Springs (`Motion.bouncy`) for pops and
    completions, `EntranceView` for arrivals. Every looping animation checks
    `useReducedMotion()`.
15. **Shared primitives first** (all in `components/ui/`): `LargeHeader` for
    tab titles, `ScreenHeader` for pushed screens, `Segmented` for Day/Week/
    Month switches, `SettingRow` in grouped tiles, `StatTile`/`StatGrid`,
    `ProgressRing`, `Donut`, `BarChart`, `DotMeter`/`LiveDot`, `ScanFrame` over
    cameras, `BigMessage` for permission/empty/error screens, `DateTimeSheet`,
    `Confetti`, `Sheet`, `AnimatedNumber`. No `Feather` icons — use
    `MaterialCommunityIcons`. No literal `[ BRACKET ]` labels.
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
20. No AI/chat features — they were removed in v1.3.0 on purpose. Don't add
    LLM calls or API keys back without the user asking.
21. Releases: bump `app.json` + `package.json` version, increment
    `versionCode`, add `changelogs/vX.Y.Z.md` (the release body the app
    renders) and a `CHANGELOG.md` entry.
