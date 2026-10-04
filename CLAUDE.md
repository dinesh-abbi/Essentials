@AGENTS.md
@RULES.md

## Quick commands

```bash
npm ci                                   # install (lockfile)
npx tsc --noEmit -p .                    # typecheck — run after every change
npx eslint <files you touched>           # lint only what you changed
npx expo start                           # Metro (the user starts dev servers themselves — don't, unless asked)
npx expo prebuild --platform android --clean        # regenerate android/ (safe since v1.2.0)
cd android && ./gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a
```

## Working here

- There is no device or emulator. Verify with `tsc` and a Gradle build, then
  hand the APK to the user to sideload; say plainly that a successful build
  doesn't prove runtime behaviour.
- Don't commit, push, tag or publish a release unless the user asks.
- The design system is strict ("Glance": one hue per area, picture first,
  chunky tiles, dot-matrix numbers) — read `src/constants/theme.ts` and
  `RULES.md` before touching UI.
- Catalyst is retired; don't reintroduce its packages (NativeWind, zustand,
  @react-native-firebase, notifee, @google/generative-ai, expo-video). Map of
  what went where: `docs/CATALYST_MERGE.md`.
