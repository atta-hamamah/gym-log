export const colors = {
  // Primary palette – electric cyan/teal gradient
  primary: '#00E5FF',
  primaryDark: '#00B8D4',
  primaryLight: '#18FFFF',

  // Secondary palette – deep violet
  secondary: '#7C4DFF',
  secondaryDark: '#651FFF',
  secondaryLight: '#B388FF',

  // Accent – warm coral-pink
  accent: '#FF4081',
  accentLight: '#FF80AB',

  // Backgrounds – rich dark surfaces
  background: '#0A0A12',
  surface: '#14141F',
  surfaceLight: '#1E1E2E',
  surfaceElevated: '#252538',

  // Text
  text: '#F0F0F5',
  textSecondary: '#8888A0',
  textMuted: '#55556A',

  // Semantic
  success: '#00E676',
  successDark: '#00C853',
  warning: '#FFD740',
  warningDark: '#FFC400',
  error: '#FF5252',
  errorDark: '#FF1744',

  // Utility
  border: '#2A2A3C',
  borderLight: '#1E1E2E',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0, 0, 0, 0.65)',

  // Gradients
  gradients: {
    primary: ['#00E5FF', '#7C4DFF'],
    accent: ['#FF4081', '#7C4DFF'],
    surface: ['#14141F', '#0A0A12'],
    warm: ['#FFD740', '#FF4081'],
  },
};

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
  l: 16,
  xl: 24,
  xxl: 32,
  full: 999,
};

export const shadows = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  }),
};
