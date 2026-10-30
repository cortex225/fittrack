import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { COLORS, TYPE } from '../theme';

// Anneaux d'énergie, façon app Forme : un anneau épais pour les kcal et trois
// anneaux concentriques plus fins pour les macros (protéines, glucides, lipides).
// Chaque piste est la même couleur que son arc, très atténuée.

interface MacroSlice {
  value: number;
  target: number;
  color: string;
  short: string; // 'P' | 'G' | 'L'
}

interface Props {
  kcal: number;
  kcalTarget: number;
  protein: MacroSlice;
  carbs: MacroSlice;
  fats: MacroSlice;
  size?: number;
  /** Sur-fragment : "5 / 18 protéines" sous le chiffre central */
  caption?: string;
}

const TAU = Math.PI * 2;

// Version atténuée d'une couleur pour la piste. Les couleurs hex (#RRGGBB)
// reçoivent une opacité ; les autres (rgba…) retombent sur la surface neutre.
function trackOf(color: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? `${color}2E` : COLORS.surface;
}

function dash(percent: number, circumference: number): string {
  const visible = Math.max(0, Math.min(1, percent / 100)) * circumference;
  return `${visible} ${circumference}`;
}

export default function EnergyRing({
  kcal,
  kcalTarget,
  protein,
  carbs,
  fats,
  size = 220,
  caption,
}: Props) {
  const cx = size / 2;
  const cy = size / 2;

  const strokeMain = Math.max(8, size * 0.08);
  const strokeSub = Math.max(4, size * 0.04);
  const gap = Math.max(2.5, size * 0.022);

  // Rayons (de l'extérieur vers l'intérieur)
  const rMain = size / 2 - strokeMain / 2;
  const rProt = rMain - strokeMain / 2 - gap - strokeSub / 2;
  const rCarbs = rProt - strokeSub - gap;
  const rFats = rCarbs - strokeSub - gap;

  const kcalPct = kcalTarget > 0 ? (kcal / kcalTarget) * 100 : 0;
  const isOver = kcal > kcalTarget;
  const remaining = Math.max(0, kcalTarget - kcal);
  const mainColor = isOver ? COLORS.danger : COLORS.primary;

  const rings = [
    { r: rMain, w: strokeMain, color: mainColor, track: trackOf(COLORS.primary), pct: kcalPct },
    { r: rProt, w: strokeSub, color: protein.color, track: trackOf(protein.color), pct: protein.target > 0 ? (protein.value / protein.target) * 100 : 0 },
    { r: rCarbs, w: strokeSub, color: carbs.color, track: trackOf(carbs.color), pct: carbs.target > 0 ? (carbs.value / carbs.target) * 100 : 0 },
    { r: rFats, w: strokeSub, color: fats.color, track: trackOf(fats.color), pct: fats.target > 0 ? (fats.value / fats.target) * 100 : 0 },
  ];

  // Espace libre au centre, à l'intérieur du dernier anneau.
  const innerDiameter = Math.max(24, 2 * (rFats - strokeSub / 2) - 6);
  const kcalStr = String(Math.round(kcal));
  const digits = Math.max(1, kcalStr.length);
  const kcalFont = Math.min(size * 0.2, Math.max(13, innerDiameter / (digits * 0.58 + 0.3)));
  const roomy = size >= 140;

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* Rotation de -90° pour démarrer en haut */}
        <G originX={cx} originY={cy} rotation={-90}>
          {rings.map((ring, i) => (
            <Circle key={`t${i}`} cx={cx} cy={cy} r={ring.r} stroke={ring.track} strokeWidth={ring.w} fill="none" />
          ))}
          {rings.map((ring, i) =>
            ring.pct > 0 ? (
              <Circle
                key={`a${i}`}
                cx={cx}
                cy={cy}
                r={ring.r}
                stroke={ring.color}
                strokeWidth={ring.w}
                strokeLinecap="round"
                strokeDasharray={dash(ring.pct, TAU * ring.r)}
                fill="none"
              />
            ) : null
          )}
        </G>
      </Svg>

      {/* Contenu central */}
      <View style={[styles.center, { maxWidth: innerDiameter }]} pointerEvents="none">
        <Text
          style={[styles.kcal, { fontSize: kcalFont, lineHeight: kcalFont * 1.05 }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
        >
          {kcalStr}
        </Text>
        <Text style={[styles.unit, !roomy && { fontSize: 11 }]}>kcal</Text>
        {roomy && (
          <>
            <Text style={styles.target} numberOfLines={1}>
              {isOver ? `+${Math.round(kcal - kcalTarget)} au-dessus` : `${Math.round(remaining)} restantes`}
            </Text>
            {caption && <Text style={styles.caption} numberOfLines={1}>{caption}</Text>}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'center', justifyContent: 'center', alignItems: 'center' },
  center: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  kcal: { ...TYPE.number, color: COLORS.text, textAlign: 'center' },
  unit: { ...TYPE.footnote, color: COLORS.textSecondary, marginTop: 1 },
  target: { ...TYPE.footnote, color: COLORS.textMuted, marginTop: 4 },
  caption: { ...TYPE.footnote, color: COLORS.textMuted, marginTop: 2 },
});
