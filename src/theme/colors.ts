/**
 * Design tokens. The palette follows the app icon: deep navy surfaces, a sky-blue
 * primary (the glowing arm) and warm orange → amber highlights (the progress bars).
 * Use one accent at a time; most UI should be neutral surfaces and text.
 */
export type ThemeColors = {
  /** Main brand color: primary buttons, active states, links. */
  primary: string;
  primaryDark: string;
  primaryLight: string;
  /** Text and icons drawn on a primary fill. */
  onPrimary: string;
  /** Subtle primary tint for selected chips, tonal buttons and icon backgrounds. */
  primarySoft: string;
  /** AI / coach features. */
  secondary: string;
  secondaryDark: string;
  secondaryLight: string;
  onSecondary: string;
  secondarySoft: string;
  /** Energy highlights: PRs, streaks, celebrations. */
  accent: string;
  accentLight: string;
  accentSoft: string;
  background: string;
  surface: string;
  surfaceLight: string;
  surfaceElevated: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  success: string;
  successDark: string;
  successSoft: string;
  warning: string;
  warningDark: string;
  warningSoft: string;
  error: string;
  errorDark: string;
  errorSoft: string;
  border: string;
  borderLight: string;
  white: string;
  black: string;
  overlay: string;
  gradients: {
    primary: string[];
    accent: string[];
    surface: string[];
    warm: string[];
  };
};

export const darkColors: ThemeColors = {
  primary: '#4FB8FF',
  primaryDark: '#2E9BEF',
  primaryLight: '#8AD1FF',
  onPrimary: '#06121F',
  primarySoft: 'rgba(79, 184, 255, 0.13)',

  secondary: '#9B8CFF',
  secondaryDark: '#7F6BFF',
  secondaryLight: '#BDB3FF',
  onSecondary: '#0E0A24',
  secondarySoft: 'rgba(155, 140, 255, 0.14)',

  accent: '#FFA94D',
  accentLight: '#FFC98A',
  accentSoft: 'rgba(255, 169, 77, 0.14)',

  background: '#0B0F1A',
  surface: '#131828',
  surfaceLight: '#1A2033',
  surfaceElevated: '#20273D',

  text: '#EEF1F8',
  textSecondary: '#A3ABC2',
  textMuted: '#77809B',

  success: '#3DD68C',
  successDark: '#22B573',
  successSoft: 'rgba(61, 214, 140, 0.13)',
  warning: '#FFC24A',
  warningDark: '#F0A92B',
  warningSoft: 'rgba(255, 194, 74, 0.14)',
  error: '#FF6B6B',
  errorDark: '#F04848',
  errorSoft: 'rgba(255, 107, 107, 0.13)',

  border: '#262E45',
  borderLight: '#1D2438',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(4, 7, 15, 0.72)',

  gradients: {
    primary: ['#4FB8FF', '#9B8CFF'],
    accent: ['#FF8A3D', '#FFC24A'],
    surface: ['#131828', '#0B0F1A'],
    warm: ['#FFC24A', '#FF8A3D'],
  },
};

export const lightColors: ThemeColors = {
  primary: '#1774CC',
  primaryDark: '#1260AA',
  primaryLight: '#5AA6EC',
  onPrimary: '#FFFFFF',
  primarySoft: 'rgba(23, 116, 204, 0.09)',

  secondary: '#5848D9',
  secondaryDark: '#4636C2',
  secondaryLight: '#8E83EE',
  onSecondary: '#FFFFFF',
  secondarySoft: 'rgba(88, 72, 217, 0.09)',

  accent: '#B85A0A',
  accentLight: '#F2A057',
  accentSoft: 'rgba(232, 128, 30, 0.12)',

  background: '#F4F6FB',
  surface: '#FFFFFF',
  surfaceLight: '#EEF1F7',
  surfaceElevated: '#FFFFFF',

  text: '#0F1526',
  textSecondary: '#4B5470',
  textMuted: '#687186',

  success: '#13854A',
  successDark: '#0E6D3C',
  successSoft: 'rgba(19, 133, 74, 0.10)',
  warning: '#A86A00',
  warningDark: '#8A5700',
  warningSoft: 'rgba(214, 145, 0, 0.12)',
  error: '#D93A3A',
  errorDark: '#B82E2E',
  errorSoft: 'rgba(217, 58, 58, 0.09)',

  border: '#E0E5EF',
  borderLight: '#EBEFF5',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(15, 21, 38, 0.45)',

  gradients: {
    primary: ['#1774CC', '#5848D9'],
    accent: ['#E8741C', '#F2A93B'],
    surface: ['#FFFFFF', '#EEF1F7'],
    warm: ['#F2A93B', '#E8741C'],
  },
};

// Backward-compatible alias while migrating static imports.
export const colors = darkColors;

export const spacing = {
  xxs: 2,
  xs: 4,
  s: 8,
  m: 16,
  l: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

export const borderRadius = {
  xs: 4,
  s: 8,
  m: 12,
  l: 18,
  xl: 24,
  xxl: 32,
  full: 999,
};

/** Soft shadows; they mostly matter in the light theme (dark surfaces rely on borders). */
export const shadows = {
  small: {
    shadowColor: '#0F1526',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 1,
  },
  medium: {
    shadowColor: '#0F1526',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 4,
  },
  large: {
    shadowColor: '#0F1526',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 10,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 4,
  }),
};
