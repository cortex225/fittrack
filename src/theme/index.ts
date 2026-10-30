// Design JL-Fit 2.0 — « Liquid Glass ».
// Un fond sombre et profond avec des halos de couleur (components/glass.tsx),
// des surfaces en verre translucide par-dessus, une seule couleur d'accent,
// et la typographie système (SF Pro sur iPhone, Roboto sur Android).

export const COLORS = {
  // Fond peint par <AppBackground /> derrière la navigation : les écrans sont transparents.
  background: 'transparent',
  backgroundSolid: '#05060B',

  // Surfaces en verre (à utiliser sur le fond à halos).
  surface: 'rgba(255,255,255,0.06)',
  card: 'rgba(255,255,255,0.07)',
  cardElevated: 'rgba(255,255,255,0.12)',
  glassFill: 'rgba(255,255,255,0.07)',
  glassHighlight: 'rgba(255,255,255,0.22)',

  primary: '#30D158',      // vert système Apple (mode sombre)
  primaryLight: '#7BE495',
  primaryDark: '#248A3D',
  primarySoft: 'rgba(48,209,88,0.16)',
  onPrimary: '#04140A',

  accent: '#FF9F0A',
  blue: '#0A84FF',
  purple: '#BF5AF2',
  red: '#FF453A',

  success: '#30D158',
  warning: '#FF9F0A',
  danger: '#FF453A',
  dangerSoft: 'rgba(255,69,58,0.16)',

  text: '#F5F5F7',
  textSecondary: 'rgba(235,235,245,0.64)',
  textMuted: 'rgba(235,235,245,0.38)',

  border: 'rgba(255,255,255,0.10)',
  borderStrong: 'rgba(255,255,255,0.18)',
  timer: '#FF9F0A',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 20,
  xl: 32,
  xxl: 48,
};

export const RADIUS = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 28,
  pill: 999,
};

export const SHADOW = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 0,
  },
};

// Échelle typographique inspirée d'iOS : grands titres serrés, texte courant
// lisible, petites étiquettes en casse normale (pas de capitales espacées).
export const TYPE = {
  largeTitle: { fontSize: 34, fontWeight: '700' as const, letterSpacing: -0.6 },
  display: { fontSize: 34, fontWeight: '700' as const, letterSpacing: -0.6 },
  title: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.35 },
  headline: { fontSize: 17, fontWeight: '600' as const, letterSpacing: -0.2 },
  body: { fontSize: 16, fontWeight: '400' as const, letterSpacing: -0.15 },
  callout: { fontSize: 15, fontWeight: '500' as const },
  caption: { fontSize: 13, fontWeight: '500' as const },
  footnote: { fontSize: 12, fontWeight: '500' as const },
  // Étiquette de section : petite, discrète, en casse normale.
  overline: { fontSize: 13, fontWeight: '600' as const, letterSpacing: -0.1 },
  number: { fontWeight: '700' as const, letterSpacing: -0.8, fontVariant: ['tabular-nums'] as ['tabular-nums'] },
};
