/**
 * Essentials — Design System · "Technical, but kind"
 *
 * One point of view: technical precision, softened by one human touch. A deep
 * muted-green instrument face, huge confident type, generous negative space,
 * hairline detail, small bracket labels (`[ TODAY ]`) standing in for card
 * titles. The boldness budget is spent entirely on TYPE and NEGATIVE SPACE —
 * everything else (color, shadow, motion) stays quiet on purpose. A second
 * accent, a gradient, a shadow-heavy card, or a second illustration per screen
 * is the instinct that made earlier passes look like a token swap rather than
 * a design; this file has exactly one accent and no gradients or shadows.
 *
 * ── The colour rule ─────────────────────────────────────────────────────────
 * ONE accent — `water`, muted sage-teal, deliberately not vibrant. It is the
 * hydration fill, active states, the bracket labels, and the illustration
 * stroke. Nothing else in the app is allowed a second colour identity.
 * Surfaces barely lift off `bg` (`surface` is only slightly lighter) —
 * separation comes from SPACE and a `hairline`, never from heavy elevation.
 *
 * This is a single dark instrument face: `Colors.light` and `Colors.dark`
 * intentionally hold the SAME green values, so a device set to light mode
 * still gets this design rather than an unrelated pale palette. (Flagged to
 * the user during planning; this is the agreed default — a real light theme
 * was not part of this brief.)
 *
 * ── Backward compatibility ─────────────────────────────────────────────────
 * Legacy keys (primary / accent / success / backgroundElement / aqua /
 * signal* / …) are retained as aliases onto the roles above, so the screens
 * that have not been rebuilt in this pass re-theme automatically instead of
 * breaking. `alert` has no equivalent in the brief's 8-token list — kept at
 * its previous value since it is only a genuine-error color on 15 call sites
 * in purchases/alarm/profile, not part of this redesign's surface.
 */

import '@/global.css';

import type { TextStyle } from 'react-native';


const GREEN = {
  // ── The eight tokens, verbatim ────────────────────────────────────────
  bg: '#14231F',
  surface: '#1C2E28',
  surface2: '#24382F',
  hairline: '#354A40',
  water: '#7FB8A4',
  waterStrong: '#A8D5C4',
  textHi: '#EFF4F1',
  textMid: '#9DB3AA',
  // textLow is graphics/hints-only at 3.24:1 on `bg`. On `surface` it drops
  // to 2.84:1 — under the 3:1 floor for non-text — so it must never sit on a
  // card; use `textMid` there instead. Never use it as small TEXT anywhere.
  textLow: '#5E7469',
  onAccent: '#14231F',

  // Not in the brief's list — genuine error/warning states only, unrelated to
  // the one-accent rule (alert is never decorative, only "something is wrong").
  alert: '#F4785F',
  alertWeak: 'rgba(244,120,95,0.14)',
  warnTone: '#E8B84B',
} as const;

function build() {
  return {
    ...GREEN,

    // ── Legacy aliases (do not use in new code) ───────────────────────────
    text: GREEN.textHi,
    textSecondary: GREEN.textMid,
    textFaint: GREEN.textMid,   // textLow can't clear 4.5:1 as small text
    background: GREEN.bg,
    backgroundElement: GREEN.surface,
    backgroundSelected: GREEN.surface2,
    surfaceRaised: GREEN.surface,
    surfaceSunken: GREEN.surface2,
    border: GREEN.hairline,
    primary: GREEN.water,
    signal: GREEN.water,
    signalInk: GREEN.onAccent,
    signalWeak: 'rgba(127,184,164,0.14)',
    signalLine: 'rgba(127,184,164,0.34)',
    accent: GREEN.water,
    aqua: GREEN.water,
    success: GREEN.water,
    warn: GREEN.warnTone,

    // Legacy names from the previous (teal) pass still read by app-tabs.tsx
    // and the hero's own styling until those call sites are swept.
    card: GREEN.surface,
    cardBorder: GREEN.hairline,
    track: GREEN.surface2,
    trackSoft: GREEN.surface2,
    heroBase: GREEN.bg,
    heroLine: GREEN.hairline,
    heroTextHi: GREEN.textHi,
    heroTextMid: GREEN.textMid,
    accentLime: GREEN.water,     // no second accent in this system
    onAqua: GREEN.onAccent,
    onLime: GREEN.onAccent,
    textLowText: GREEN.textMid,  // the small-text-safe version of textLow
  } as const;
}

export const Colors = {
  light: build(),
  dark: build(),
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * No elevation system in this design — depth comes from the bg → surface step
 * plus `hairline`, never shadow. Retained only because a handful of
 * not-yet-rebuilt screens still import these names; both resolve to "no lift".
 */
export const Elevation = {
  low: {
    light: { shadowColor: '#000000', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 },
    dark: { shadowColor: '#000000', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 },
  },
  high: {
    light: { shadowColor: '#000000', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 },
    dark: { shadowColor: '#000000', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 },
  },
} as const;

// Legacy alias — kept for existing imports.
export const Shadows = { light: Elevation.low.light, dark: Elevation.low.dark };

/**
 * Legacy alias for screens still importing card "lift" from the previous
 * pass. In this design nothing is lifted — all three resolve to zero, so a
 * not-yet-rebuilt screen degrades to a flat hairline card instead of keeping
 * a shadow that would fight the new discipline.
 */
export const Lift = {
  hero: { shadowColor: '#000000', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 },
  card: { shadowColor: '#000000', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 },
  nav: { shadowColor: '#000000', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 },
} as const;

/**
 * Two families. Space Grotesk carries the personality — technical-grotesque,
 * slightly squared, built for confident data-forward headlines. Onest is
 * quiet UI text that recedes so the display face stands out.
 *
 * Both verified (by parsing the shipped .ttf) to carry the `tnum` OpenType
 * feature, so `fontVariant: ['tabular-nums']` genuinely produces fixed-width
 * digits — the 84px hero number cannot jitter the layout when it changes.
 *
 * IMPORTANT (Android): the weight lives in the family NAME. Pairing these
 * with `fontWeight` makes Android synthesise a fake bold over an already-bold
 * face, so every style below sets `fontFamily` and never `fontWeight`.
 */
export const FontFace = {
  body: 'Onest_400Regular',           // body, sub-lines, hints
  bodyMedium: 'Onest_500Medium',      // bracket labels, small emphasis
  display: 'SpaceGrotesk_500Medium',  // the hero number, secondary numbers
  displayBold: 'SpaceGrotesk_700Bold',// screen headline

  // ── Legacy aliases (do not use in new code) ─────────────────────────────
  // A prior pass ran a codemod that routed every text style app-wide through
  // FontFace.regular/medium/semibold/bold — ~19 screens outside this brief's
  // scope reference those names directly. Aliasing them here means every
  // screen keeps using a real loaded face after this swap: body copy stays on
  // Onest, and anything that was "the numeric/heading weight" (semibold/bold)
  // now renders in Space Grotesk — a real, visible, INTENTIONAL side effect
  // of sharing one token file, not an accident. Flagged in the write-up.
  regular: 'Onest_400Regular',
  medium: 'Onest_500Medium',
  semibold: 'SpaceGrotesk_500Medium',
  bold: 'SpaceGrotesk_700Bold',
} as const;

// Legacy shape — `Fonts.mono` is consumed by themed-text / ChangelogView.
// There is no mono face in this system; numerals are tabular instead.
export const Fonts = {
  sans: FontFace.body,
  serif: 'serif',
  rounded: FontFace.body,
  mono: FontFace.body,
} as const;

const TABULAR: TextStyle = { fontVariant: ['tabular-nums'] };

/**
 * Type scale. Deliberately brutal: an 84px hero next to 13px body text, with
 * almost nothing in between. `bracketLabel` is the technical signature —
 * used as the card "title" in place of a plain label, e.g. "[ HYDRATION ]".
 * Sentence case for real sentences; UPPERCASE only on bracket labels.
 */
export const Type: Record<
  | 'hero' | 'heroUnit' | 'headline' | 'greeting' | 'bracketLabel' | 'numberSm'
  | 'subline' | 'body' | 'controlLabel'
  // Retained at their previous metrics (re-fonted) for not-yet-rebuilt screens.
  | 'display' | 'title' | 'label' | 'readout' | 'cardLabel' | 'badge' | 'number',
  TextStyle
> = {
  // ── The redesign ramp ──────────────────────────────────────────────────
  hero: { fontFamily: FontFace.display, fontSize: 84, lineHeight: 88, letterSpacing: -3, ...TABULAR },
  heroUnit: { fontFamily: FontFace.body, fontSize: 20, lineHeight: 24 },
  headline: { fontFamily: FontFace.displayBold, fontSize: 30, lineHeight: 36, letterSpacing: -0.6 },
  greeting: { fontFamily: FontFace.body, fontSize: 13, lineHeight: 18 },
  bracketLabel: { fontFamily: FontFace.bodyMedium, fontSize: 11, letterSpacing: 2, lineHeight: 15, textTransform: 'uppercase' },
  numberSm: { fontFamily: FontFace.display, fontSize: 40, lineHeight: 44, letterSpacing: -1, ...TABULAR },
  subline: { fontFamily: FontFace.body, fontSize: 13, lineHeight: 18 },
  body: { fontFamily: FontFace.body, fontSize: 14, lineHeight: 20 },
  // A real button label: sentence case, no forced letter-spacing/uppercase.
  // The hero's "+ 250 ml" previously borrowed `bracketLabel` (11px, uppercase,
  // +2 tracking) for its CTA text — the brief reserves uppercase for bracket
  // labels only ("Sentence case for real sentences"), so the action text was
  // both mis-cased and too small to read as the card's primary action.
  controlLabel: { fontFamily: FontFace.bodyMedium, fontSize: 15, lineHeight: 20 },

  // ── Retained for not-yet-rebuilt screens ───────────────────────────────
  display: { fontFamily: FontFace.displayBold, fontSize: 28, lineHeight: 34, letterSpacing: -0.6 },
  title: { fontFamily: FontFace.displayBold, fontSize: 19, lineHeight: 25, letterSpacing: -0.3 },
  label: { fontFamily: FontFace.bodyMedium, fontSize: 11, letterSpacing: 1.2, lineHeight: 15, textTransform: 'uppercase' },
  readout: { fontFamily: FontFace.display, letterSpacing: -0.4, ...TABULAR },
  cardLabel: { fontFamily: FontFace.bodyMedium, fontSize: 13, lineHeight: 18 },
  badge: { fontFamily: FontFace.display, fontSize: 12, lineHeight: 16, ...TABULAR },
  number: { fontFamily: FontFace.display, fontSize: 52, lineHeight: 58, letterSpacing: -2, ...TABULAR },
};

/**
 * Motion — precise, not bouncy. This aesthetic is a technical instrument, so
 * entrances are smooth ease-out, never a spring overshoot.
 *   fast   → press / toggle / state flip
 *   count  → a number catching up to a tap (must feel attached to the thumb)
 *   entrance → the mount stagger (fade + translateY 10→0)
 *   fill   → the hydration bar charging on entrance / after a log
 */
export const Motion = {
  duration: {
    fast: 140, count: 420, entrance: 350, fill: 500, screen: 300,
    base: 350, // legacy alias — 3 not-yet-rebuilt call sites read `.base`
  },
  stagger: 50,
  entranceOffset: 10,
  // Retained: `spring`/`softSpring` still back the −/+ press-scale (a tap is
  // a physical action, not a layout entrance) and app-tabs' sliding lozenge.
  spring: { damping: 20, stiffness: 220, mass: 1 },
  softSpring: { damping: 16, stiffness: 140, mass: 0.9 },
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
  xl: 24,
  pill: 999,
} as const;

/** Minimum interactive size. Android/WCAG both want 44 dp. */
export const HitTarget = 44;

export const TabBar = {
  height: 56,
  floatOffset: 24,
} as const;

export const BottomTabInset = TabBar.height + TabBar.floatOffset + 8;
export const MaxContentWidth = 800;
