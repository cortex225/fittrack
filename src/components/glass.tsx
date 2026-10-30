// Matériaux « Liquid Glass ».
// - iOS 26+ : vrai Liquid Glass (expo-glass-effect).
// - iOS plus ancien : flou système (expo-blur).
// - Android et web : verre simulé (remplissage translucide, reflet en haut,
//   liseré clair), sans flou pour rester fluide.
import React from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { COLORS, RADIUS } from '../theme';

const LIQUID = Platform.OS === 'ios' && isLiquidGlassAvailable();

// ── Fond de l'app : noir profond et halos de couleur flous ────────────────
const Orb: React.FC<{ id: string; cx: string; cy: string; r: string; color: string; opacity: number }> = ({
  id,
  cx,
  cy,
  r,
  color,
  opacity,
}) => (
  <>
    <Defs>
      <RadialGradient id={id} cx={cx} cy={cy} r={r} gradientUnits="objectBoundingBox">
        <Stop offset="0" stopColor={color} stopOpacity={opacity} />
        <Stop offset="1" stopColor={color} stopOpacity={0} />
      </RadialGradient>
    </Defs>
    <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
  </>
);

export const AppBackground: React.FC = () => (
  <View style={[StyleSheet.absoluteFill, { backgroundColor: COLORS.backgroundSolid }]} pointerEvents="none">
    <Svg width="100%" height="100%">
      <Orb id="o1" cx="0.12" cy="0.08" r="0.65" color="#1E7A5A" opacity={0.55} />
      <Orb id="o2" cx="0.95" cy="0.32" r="0.55" color="#3B3FBF" opacity={0.42} />
      <Orb id="o3" cx="0.25" cy="0.85" r="0.6" color="#8A3FB0" opacity={0.28} />
      <Orb id="o4" cx="0.9" cy="0.95" r="0.45" color="#C2662D" opacity={0.18} />
    </Svg>
  </View>
);

// ── Surface de verre ───────────────────────────────────────────────────────
interface GlassProps {
  style?: StyleProp<ViewStyle>;
  radius?: number;
  tint?: string;        // teinte légère du verre (ex. COLORS.primary)
  interactive?: boolean;
  children?: React.ReactNode;
}

export const Glass: React.FC<GlassProps> = ({ style, radius = RADIUS.xl, tint, interactive, children }) => {
  const shape = { borderRadius: radius, overflow: 'hidden' as const };

  if (LIQUID) {
    return (
      <GlassView
        glassEffectStyle="regular"
        colorScheme="dark"
        tintColor={tint ? `${tint}33` : undefined}
        isInteractive={interactive}
        style={[shape, style]}
      >
        {children}
      </GlassView>
    );
  }

  return (
    <View style={[shape, styles.frame, style]}>
      {Platform.OS === 'ios' ? (
        <BlurView intensity={40} tint="systemUltraThinMaterialDark" style={StyleSheet.absoluteFill} />
      ) : null}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: tint ? `${tint}1F` : COLORS.glassFill }]} />
      <LinearGradient
        colors={['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.02)', 'rgba(255,255,255,0)']}
        locations={[0, 0.35, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {children}
    </View>
  );
};

// Carte de verre avec padding par défaut.
export const GlassCard: React.FC<GlassProps & { padding?: number }> = ({ padding = 20, style, ...rest }) => (
  <Glass {...rest} style={[{ padding }, style]} />
);

const styles = StyleSheet.create({
  frame: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.16)',
    borderTopColor: COLORS.glassHighlight,
  },
});
