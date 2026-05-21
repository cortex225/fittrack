import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { COLORS } from '../theme';

// Anneau d'énergie : 1 arc principal (kcal) + 3 arcs concentriques fins (Prot/Gluc/Lip).
// Tout est SVG circulaire ; on calcule `strokeDasharray` à partir du % atteint.

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

function arcDashArray(percent: number, circumference: number): [string, number] {
  // Le `dasharray` est `[traitVisible, gap]`. La rotation est gérée à l'extérieur.
  const visible = Math.max(0, Math.min(1, percent / 100)) * circumference;
  return [`${visible} ${circumference}`, visible];
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

  // Rayons (de l'extérieur vers l'intérieur)
  const rMain = size / 2 - 10; // kcal
  const rProt = rMain - 18;
  const rCarbs = rProt - 12;
  const rFats = rCarbs - 12;

  const cMain = TAU * rMain;
  const cProt = TAU * rProt;
  const cCarbs = TAU * rCarbs;
  const cFats = TAU * rFats;

  const kcalPct = kcalTarget > 0 ? (kcal / kcalTarget) * 100 : 0;
  const protPct = protein.target > 0 ? (protein.value / protein.target) * 100 : 0;
  const carbsPct = carbs.target > 0 ? (carbs.value / carbs.target) * 100 : 0;
  const fatsPct = fats.target > 0 ? (fats.value / fats.target) * 100 : 0;

  const [mainDash] = arcDashArray(kcalPct, cMain);
  const [protDash] = arcDashArray(protPct, cProt);
  const [carbsDash] = arcDashArray(carbsPct, cCarbs);
  const [fatsDash] = arcDashArray(fatsPct, cFats);

  const remaining = Math.max(0, kcalTarget - kcal);
  const isOver = kcal > kcalTarget;

  // Auto-scale du nombre central selon le nombre de chiffres et la taille de l'anneau.
  // Largeur exploitable = diamètre intérieur - 2× la stroke de l'arc principal (10), moins marge.
  const kcalStr = String(kcal);
  const digits = Math.max(1, kcalStr.length);
  const innerDiameter = size - 28; // diamètre dispo à l'intérieur du dernier arc
  // Largeur par chiffre : on alloue ~0.55em par digit (chiffres tabulaires sont plus étroits que ça).
  const fontByDigits = innerDiameter / (digits * 0.6 + 0.5);
  const kcalFont = Math.min(size * 0.26, Math.max(14, fontByDigits));
  const lineHeight = kcalFont * 1.0;

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* On tourne tout de -90° pour démarrer en haut */}
        <G originX={cx} originY={cy} rotation={-90}>
          {/* Pistes (background) */}
          <Circle cx={cx} cy={cy} r={rMain} stroke={COLORS.surface} strokeWidth={10} fill="none" />
          <Circle cx={cx} cy={cy} r={rProt} stroke={COLORS.surface} strokeWidth={5} fill="none" />
          <Circle cx={cx} cy={cy} r={rCarbs} stroke={COLORS.surface} strokeWidth={5} fill="none" />
          <Circle cx={cx} cy={cy} r={rFats} stroke={COLORS.surface} strokeWidth={5} fill="none" />

          {/* Arc kcal */}
          <Circle
            cx={cx}
            cy={cy}
            r={rMain}
            stroke={isOver ? COLORS.danger : COLORS.primary}
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={mainDash}
            fill="none"
          />
          {/* Arcs macros */}
          <Circle
            cx={cx}
            cy={cy}
            r={rProt}
            stroke={protein.color}
            strokeWidth={5}
            strokeLinecap="round"
            strokeDasharray={protDash}
            fill="none"
          />
          <Circle
            cx={cx}
            cy={cy}
            r={rCarbs}
            stroke={carbs.color}
            strokeWidth={5}
            strokeLinecap="round"
            strokeDasharray={carbsDash}
            fill="none"
          />
          <Circle
            cx={cx}
            cy={cy}
            r={rFats}
            stroke={fats.color}
            strokeWidth={5}
            strokeLinecap="round"
            strokeDasharray={fatsDash}
            fill="none"
          />
        </G>
      </Svg>

      {/* Contenu central absolu */}
      <View style={[styles.center, { maxWidth: innerDiameter }]} pointerEvents="none">
        <Text
          style={[styles.kcal, { fontSize: kcalFont, lineHeight }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
        >
          {kcal}
        </Text>
        <Text style={styles.kcalUnit}>kcal</Text>
        {size >= 140 && (
          <>
            <Text style={styles.target} numberOfLines={1}>
              {isOver ? `+${kcal - kcalTarget} au-dessus` : `${remaining} restantes`}
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
  kcal: { color: COLORS.text, fontWeight: '900', letterSpacing: -1, textAlign: 'center' },
  kcalUnit: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginTop: 2 },
  target: { color: COLORS.textMuted, fontSize: 11, fontWeight: '700', marginTop: 6 },
  caption: { color: COLORS.textMuted, fontSize: 10, fontWeight: '700', marginTop: 2 },
});
