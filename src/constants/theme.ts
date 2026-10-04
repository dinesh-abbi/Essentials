/**
 * Essentials — Design System · "Glance" (v1.3)
 *
 * The app is read in two-second glances, so every screen should be
 * understood from SHAPES and COLOURS before a single word is read. It blends
 * three signatures people already know how to read:
 *
 *  • Apple — activity rings for "how far along", bento widget tiles on Home,
 *    vivid ring colours on a true-dark base, springy physical motion.
 *  • Samsung One UI — a big, airy title area at the top of each tab (content
 *    sits lower, in thumb reach), grouped rounded cards, settings rows that
 *    lead with a coloured squircle icon.
 *  • Nothing — dot-matrix numerals and labels (Doto), dot grids and dotted
 *    progress instead of plain bars, a monochrome base with one red "live" dot.
 *
 * Rules:
 *  1. Every area of life owns a HUE (`Hue` below) — water is cyan, training is
 *     coral, food is lime, money is sunshine, check-in is lavender, the alarm
 *     is pink. A hue means the same thing everywhere, tab bar included.
 *  2. Show, don't tell — a ring, a filling drop, a row of plates, a lit dot per
 *     day. Numbers are big; words are few.
 *  3. Pressable things look pressable: chunky tiles/buttons with a darker lip
 *     that sinks on tap.
 *  4. Motion is friendly (springs, a mascot that reacts, a pop on completion),
 *     always gated on `useReducedMotion()`.
 *  5. Type: Nunito for words, Doto (dot-matrix) for numerals and tiny labels.
 *
 * `Colors.light` and `Colors.dark` intentionally hold the same values (single
 * dark theme). Legacy keys (primary / accent / signal* / card / …) remain as
 * aliases so older screens keep working with the new palette.
 */

import '@/global.css';

import type { TextStyle } from 'react-native';

// ─── Colour helpers ───────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** `hex` at `alpha` as an rgba() string. */
export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Solid blend of `a` over `b` (t = share of `a`). Used for tinted tiles. */
export function mix(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const c = ca.map((v, i) => Math.round(v * t + cb[i] * (1 - t)));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

// ─── Palette ──────────────────────────────────────────────────────────────────

const BASE = {
  bg: '#0B0B0F',
  surface: '#18181E',
  surface2: '#25252D',
  hairline: '#33333D',
  textHi: '#FFFFFF',
  textMid: '#A6A6B3',
  // Graphics / hints only — never small text.
  textLow: '#5F5F6B',
  onAccent: '#0B0B0F',

  // The primary hue (water) doubles as the app's generic accent in older screens.
  water: '#38D3FF',
  waterStrong: '#A5EEFF',

  // Nothing-style "live" red: alerts, recording dots, destructive actions.
  alert: '#FF3B30',
  alertWeak: 'rgba(255,59,48,0.16)',
  warnTone: '#FFC233',
} as const;

export type HueName = 'water' | 'train' | 'fuel' | 'spend' | 'checkin' | 'alarm' | 'profile';

export interface HueSet {
  /** The hue itself — fills, icons, rings. */
  main: string;
  /** Darker edge for the chunky "3D" lip under buttons and tiles. */
  deep: string;
  /** Solid tinted tile background (hue blended into `surface`). */
  tile: string;
  /** Edge under a tinted tile. */
  tileEdge: string;
  /** Transparent wash for chips and tracks. */
  soft: string;
  /** Text / icon colour that sits on `main`. */
  on: string;
}

function hue(main: string, deep: string): HueSet {
  return {
    main,
    deep,
    tile: mix(main, BASE.surface, 0.14),
    tileEdge: mix(main, BASE.bg, 0.3),
    soft: withAlpha(main, 0.18),
    on: BASE.onAccent,
  };
}

/** One hue per area of the app. Same meaning everywhere. */
export const Hue: Record<HueName, HueSet> = {
  water: hue('#38D3FF', '#1C93BA'),
  train: hue('#FF6B4A', '#C4452A'),
  fuel: hue('#A6E840', '#6FA61C'),
  spend: hue('#FFC233', '#C28A0E'),
  checkin: hue('#A98BFF', '#7354D4'),
  alarm: hue('#FF5FA2', '#C43A77'),
  profile: hue('#6E9BFF', '#4467CC'),
};

/** Neutral chunky surface (non-hued tiles). */
export const NeutralTile = {
  tile: BASE.surface,
  tileEdge: mix(BASE.surface, '#000000', 0.62),
} as const;

function build() {
  return {
    ...BASE,

    // ── Legacy aliases ────────────────────────────────────────────────────
    text: BASE.textHi,
    textSecondary: BASE.textMid,
    textFaint: BASE.textMid,
    background: BASE.bg,
    backgroundElement: BASE.surface,
    backgroundSelected: BASE.surface2,
    surfaceRaised: BASE.surface,
    surfaceSunken: BASE.surface2,
    border: BASE.hairline,
    primary: BASE.water,
    signal: BASE.water,
    signalInk: BASE.onAccent,
    signalWeak: withAlpha(BASE.water, 0.16),
    signalLine: withAlpha(BASE.water, 0.45),
    accent: BASE.water,
    aqua: BASE.water,
    success: Hue.fuel.main,
    warn: BASE.warnTone,

    card: BASE.surface,
    cardBorder: BASE.hairline,
    track: BASE.surface2,
    trackSoft: BASE.surface2,
    heroBase: BASE.bg,
    heroLine: BASE.hairline,
    heroTextHi: BASE.textHi,
    heroTextMid: BASE.textMid,
    accentLime: Hue.fuel.main,
    onAqua: BASE.onAccent,
    onLime: BASE.onAccent,
    textLowText: BASE.textMid,
  } as const;
}

export const Colors = {
  light: build(),
  dark: build(),
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * Depth comes from the chunky bottom lip (see ChunkyButton / Tile), not from
 * drop shadows — shadows vanish on a dark base. Kept for old imports.
 */
const NO_SHADOW = { shadowColor: '#000000', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 };
export const Elevation = {
  low: { light: NO_SHADOW, dark: NO_SHADOW },
  high: { light: NO_SHADOW, dark: NO_SHADOW },
} as const;
export const Shadows = { light: NO_SHADOW, dark: NO_SHADOW };
export const Lift = { hero: NO_SHADOW, card: NO_SHADOW, nav: NO_SHADOW } as const;

/**
 * Nunito — rounded, friendly, very legible at heavy weights. Its digits are
 * fixed-width by default (all 600 units), so counting numbers never jitter.
 *
 * IMPORTANT (Android): the weight lives in the family NAME. Never pair these
 * with `fontWeight` — Android would synthesise a fake bold on top.
 */
export const FontFace = {
  body: 'Nunito_600SemiBold',
  bodyMedium: 'Nunito_700Bold',
  display: 'Nunito_800ExtraBold',
  displayBold: 'Nunito_900Black',

  // Legacy aliases used across older screens.
  regular: 'Nunito_600SemiBold',
  medium: 'Nunito_700Bold',
  semibold: 'Nunito_800ExtraBold',
  bold: 'Nunito_900Black',

  /** Dot-matrix numerals / micro-labels (Nothing). Monospaced; no ₹ glyph. */
  dot: 'Doto_800ExtraBold',
  dotBlack: 'Doto_900Black',
} as const;

export const Fonts = {
  sans: FontFace.body,
  serif: 'serif',
  rounded: FontFace.body,
  mono: FontFace.body,
} as const;

const TABULAR: TextStyle = { fontVariant: ['tabular-nums'] };

/**
 * Type ramp. Big, heavy numbers; short bold labels; friendly body copy.
 * `bracketLabel` is kept as the name of the small uppercase label style for
 * older screens — it no longer implies literal [ brackets ].
 */
export const Type: Record<
  | 'hero' | 'heroUnit' | 'headline' | 'greeting' | 'bracketLabel' | 'numberSm'
  | 'subline' | 'body' | 'controlLabel'
  | 'display' | 'title' | 'label' | 'readout' | 'cardLabel' | 'badge' | 'number'
  | 'dotHero' | 'dotNumber' | 'dotSmall' | 'dotLabel' | 'largeTitle',
  TextStyle
> = {
  hero: { fontFamily: FontFace.displayBold, fontSize: 56, lineHeight: 62, letterSpacing: -1.5, ...TABULAR },
  heroUnit: { fontFamily: FontFace.bodyMedium, fontSize: 18, lineHeight: 22 },
  headline: { fontFamily: FontFace.displayBold, fontSize: 28, lineHeight: 34, letterSpacing: -0.4 },
  greeting: { fontFamily: FontFace.bodyMedium, fontSize: 14, lineHeight: 19 },
  bracketLabel: { fontFamily: FontFace.display, fontSize: 12, letterSpacing: 0.8, lineHeight: 16, textTransform: 'uppercase' },
  numberSm: { fontFamily: FontFace.displayBold, fontSize: 32, lineHeight: 38, letterSpacing: -0.6, ...TABULAR },
  subline: { fontFamily: FontFace.body, fontSize: 13, lineHeight: 18 },
  body: { fontFamily: FontFace.body, fontSize: 15, lineHeight: 21 },
  controlLabel: { fontFamily: FontFace.display, fontSize: 16, lineHeight: 21 },

  display: { fontFamily: FontFace.displayBold, fontSize: 28, lineHeight: 34, letterSpacing: -0.4 },
  title: { fontFamily: FontFace.displayBold, fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
  label: { fontFamily: FontFace.display, fontSize: 12, letterSpacing: 0.8, lineHeight: 16, textTransform: 'uppercase' },
  readout: { fontFamily: FontFace.displayBold, letterSpacing: -0.3, ...TABULAR },
  cardLabel: { fontFamily: FontFace.bodyMedium, fontSize: 14, lineHeight: 19 },
  badge: { fontFamily: FontFace.display, fontSize: 12, lineHeight: 16, ...TABULAR },
  number: { fontFamily: FontFace.displayBold, fontSize: 48, lineHeight: 54, letterSpacing: -1, ...TABULAR },

  // ── Signature styles ──────────────────────────────────────────────────
  /** One UI-style tab title: big, airy, sits low in the header area. */
  largeTitle: { fontFamily: FontFace.displayBold, fontSize: 38, lineHeight: 44, letterSpacing: -0.8 },
  /** Dot-matrix numerals (Nothing). */
  dotHero: { fontFamily: FontFace.dotBlack, fontSize: 60, lineHeight: 66, letterSpacing: -1 },
  dotNumber: { fontFamily: FontFace.dotBlack, fontSize: 34, lineHeight: 40, letterSpacing: -0.5 },
  dotSmall: { fontFamily: FontFace.dotBlack, fontSize: 20, lineHeight: 24 },
  /** Dot-matrix micro label — uppercase, tracked. */
  dotLabel: { fontFamily: FontFace.dotBlack, fontSize: 13, lineHeight: 16, letterSpacing: 1.2, textTransform: 'uppercase' },
};

/**
 * Motion — friendly and physical. Springs may overshoot a little (a tap is a
 * physical act); entrances rise and settle. Everything is skipped under
 * Reduce Motion.
 */
export const Motion = {
  duration: {
    fast: 140, count: 520, entrance: 420, fill: 700, screen: 300,
    base: 350,
  },
  stagger: 60,
  entranceOffset: 18,
  spring: { damping: 18, stiffness: 240, mass: 1 },
  softSpring: { damping: 14, stiffness: 140, mass: 0.9 },
  /** For pops, the mascot and completed states. */
  bouncy: { damping: 9, stiffness: 180, mass: 0.8 },
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
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

/** Height of the chunky lip under pressable tiles and buttons. */
export const Lip = 5;

/** Minimum interactive size. Android/WCAG both want 44 dp. */
export const HitTarget = 44;

export const TabBar = {
  height: 64,
  floatOffset: 16,
} as const;

export const BottomTabInset = TabBar.height + TabBar.floatOffset + 8;
export const MaxContentWidth = 800;
