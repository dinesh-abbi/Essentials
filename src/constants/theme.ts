/**
 * Essentials — Design System
 * Inspired by Nothing OS & Google Pixel: clean, high-contrast, single warm accent.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#111111',
    textSecondary: '#777777',
    background: '#F5F5F0',         // Warm off-white — feels premium, not clinical
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#EFEFEA',
    primary: '#4F46E5',            // Premium Indigo
    success: '#16A34A',
    border: '#E4E4DF',
    alert: '#DC2626',
    accent: '#4F46E5',
  },
  dark: {
    text: '#F0F0EB',
    textSecondary: '#888888',
    background: '#111111',         // True near-black
    backgroundElement: '#1C1C1C',
    backgroundSelected: '#272727',
    primary: '#6366F1',            // Sleek Indigo in dark mode
    success: '#22C55E',
    border: '#2A2A2A',
    alert: '#EF4444',
    accent: '#6366F1',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Shadows = {
  light: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  dark: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
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

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
