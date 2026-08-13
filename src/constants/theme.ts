/**
 * Essentials — Design System · "Cockpit"
 * A cool graphite instrument panel with one signal azure. Numbers read as
 * instrument readouts (monospaced, tabular). Depth comes from stacked surfaces
 * and hairline borders — not glass or heavy shadow.
 *
 * Every value here is shifted OFF the raw Tailwind default swatches the app
 * used to ship (blue-500 / slate / emerald-500 …), which is what separates a
 * designed panel from generic "AI" blue.
 *
 * Backward-compatible keys (primary / accent / success / backgroundElement /
 * backgroundSelected …) are kept so existing screens re-theme automatically;
 * new roles (signal / aqua / warn / surfaceRaised / hairline …) are additive.
 */

import '@/global.css';

import { Platform } from 'react-native';
import type { TextStyle } from 'react-native';


export const Colors = {
  light: {
    // ── Text ──────────────────────────────────────────────────────────────
    text: '#10161E',
    textSecondary: '#59657A',        // muted — was #777777
    textFaint: '#8A96A8',            // NEW — captions, disabled labels

    // ── Ground & surfaces (graphite ramp) ────────────────────────────────
    background: '#EEF1F5',           // cool paper — was #F5F5F0 (warm)
    backgroundElement: '#FFFFFF',    // surface / card
    backgroundSelected: '#E9EDF3',   // subtle raised fill — was #EFEFEA
    surfaceRaised: '#FFFFFF',        // NEW — raised panel (uses elevation)
    surfaceSunken: '#E5EAF1',        // NEW — inset / track wells
    hairline: '#E1E6EE',             // NEW — internal dividers (lighter than border)
    border: '#D3DAE4',               // was #E4E4DF

    // ── Signal (the one accent) ───────────────────────────────────────────
    primary: '#1F63D6',              // azure — was #4F46E5 (indigo-600)
    signal: '#1F63D6',               // NEW canonical name for primary
    signalInk: '#FFFFFF',            // NEW — foreground on signal
    signalWeak: 'rgba(31,99,214,0.10)',  // NEW — tinted fill / ghost hover
    signalLine: 'rgba(31,99,214,0.30)',  // NEW — tinted border
    accent: '#1F63D6',               // collapsed onto signal — was purple/indigo

    // ── Domain & semantic ─────────────────────────────────────────────────
    aqua: '#0E8FA8',                 // NEW — water domain tint (≠ signal)
    success: '#0F9257',              // positive — was #16A34A; collapses 4 greens
    warn: '#B26C05',                 // NEW — pending / caution (amber)
    alert: '#D33F45',                // was #DC2626
  },
  dark: {
    // ── Text ──────────────────────────────────────────────────────────────
    text: '#EAEEF4',
    textSecondary: '#8A97A8',        // muted — was #888888
    textFaint: '#5C6779',            // NEW

    // ── Ground & surfaces (graphite ramp) ────────────────────────────────
    background: '#0C0F16',           // graphite-ink — was #111111
    backgroundElement: '#141A23',    // surface / card — was #1C1C1C
    backgroundSelected: '#1B222D',   // subtle raised fill — was #272727
    surfaceRaised: '#1B222D',        // NEW
    surfaceSunken: '#0F141C',        // NEW — inset / track wells
    hairline: '#1E2733',             // NEW
    border: '#28313F',               // was #2A2A2A

    // ── Signal (the one accent) ───────────────────────────────────────────
    primary: '#4C90FF',              // azure — was #6366F1 (indigo-500)
    signal: '#4C90FF',
    signalInk: '#071019',            // dark ink on bright azure
    signalWeak: 'rgba(76,144,255,0.14)',
    signalLine: 'rgba(76,144,255,0.34)',
    accent: '#4C90FF',

    // ── Domain & semantic ─────────────────────────────────────────────────
    aqua: '#34C6DE',
    success: '#34C98A',              // was #22C55E
    warn: '#F0A73C',
    alert: '#F0575E',                // was #EF4444
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * Elevation — two levels only. Prefer stacked surfaces + `hairline`/`border`
 * over shadow; reach for these when a panel genuinely needs to lift.
 */
export const Elevation = {
  low: {
    light: { shadowColor: '#1B2430', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
    dark: { shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 4 },
  },
  high: {
    light: { shadowColor: '#1B2430', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 8 },
    dark: { shadowColor: '#000000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.5, shadowRadius: 32, elevation: 12 },
  },
} as const;

// Legacy alias — kept for existing imports. Prefer `Elevation`.
export const Shadows = {
  light: Elevation.low.light,
  dark: Elevation.low.dark,
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

/**
 * Type scale — one ramp, held everywhere. Replaces 22 ad-hoc sizes and the
 * mixed 'bold'/'800'/'900' weights. `readout` is the instrument face: system
 * mono + tabular figures, so numbers line up and the count-up doesn't jitter.
 */
export const Type: Record<'display' | 'title' | 'body' | 'label' | 'readout', TextStyle> = {
  display: { fontSize: 30, fontWeight: '800', letterSpacing: -0.9, lineHeight: 34 },
  title: { fontSize: 21, fontWeight: '700', letterSpacing: -0.4, lineHeight: 27 },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 22 },
  label: { fontSize: 11, fontWeight: '600', letterSpacing: 1.4, textTransform: 'uppercase' },
  readout: { fontFamily: Fonts?.mono, fontWeight: '600', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
};

/**
 * Motion — one convention for the whole app.
 *   fast   → press / toggle / state flip
 *   base   → enter / expand / layout
 *   screen → route transitions
 * `spring` is the single physical-UI spring (press-scale, tab pill, fills).
 * Standard timed easing is Easing.out(Easing.cubic); reversible is inOut.
 * Everything animated must degrade under useReducedMotion().
 */
export const Motion = {
  duration: { fast: 140, base: 240, screen: 300 },
  spring: { damping: 20, stiffness: 220, mass: 1 },
  stagger: 60,
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
} as const;

/**
 * Padding bottom that screens should add to their scrollable content so that
 * the last element clears the floating tab bar.
 *   TAB_BAR_HEIGHT (64) + FLOAT_OFFSET (12) + buffer (8) = 84 dp
 * Add useSafeAreaInsets().bottom on top of this for phones with home indicators.
 */
export const BottomTabInset = 84;
export const MaxContentWidth = 800;
