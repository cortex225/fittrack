export const COLORS = {
  background: '#0F0F1A',
  surface: '#16182A',
  card: '#1A1D33',
  cardElevated: '#222542',

  primary: '#10B981',      // emerald-500
  primaryLight: '#34D399',
  primaryDark: '#059669',
  primarySoft: 'rgba(16,185,129,0.12)',

  accent: '#F59E0B',       // amber/yellow
  blue: '#3B82F6',
  purple: '#A855F7',
  red: '#EF4444',

  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  dangerSoft: 'rgba(239,68,68,0.12)',

  text: '#FFFFFF',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',

  border: '#252842',
  borderStrong: '#2F334F',
  timer: '#F59E0B',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
};

export const SHADOW = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 4,
  },
};

// Échelle typographique de JL-Fit 2.0 : peu de tailles, un vrai contraste
// entre les titres et le reste.
export const TYPE = {
  display: { fontSize: 32, fontWeight: '800' as const, letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.3 },
  headline: { fontSize: 17, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '500' as const },
  caption: { fontSize: 12, fontWeight: '600' as const },
  overline: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.4, textTransform: 'uppercase' as const },
};
