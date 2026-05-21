import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Polygon, Text as SvgText } from 'react-native-svg';
import { COLORS, SPACING } from '../theme';

// Regroupement des 17 muscles ExerciseDB en 8 axes lisibles.
export const SPIDER_GROUPS: { key: string; label: string; muscles: string[] }[] = [
  { key: 'chest',     label: 'PECS',     muscles: ['chest'] },
  { key: 'back',      label: 'DOS',      muscles: ['lats', 'middle back', 'lower back', 'traps'] },
  { key: 'shoulders', label: 'ÉPAULES',  muscles: ['shoulders'] },
  { key: 'biceps',    label: 'BICEPS',   muscles: ['biceps', 'forearms'] },
  { key: 'triceps',   label: 'TRICEPS',  muscles: ['triceps'] },
  { key: 'abs',       label: 'ABDOS',    muscles: ['abdominals'] },
  { key: 'legs',      label: 'JAMBES',   muscles: ['quadriceps', 'hamstrings', 'glutes', 'abductors', 'adductors'] },
  { key: 'calves',    label: 'MOLLETS',  muscles: ['calves'] },
];

interface Props {
  /** Volume (nb séries) par muscle bas-niveau, ex: { chest: 12, lats: 8, ... }. */
  muscleVolume: Record<string, number>;
  size?: number;
}

export default function MuscleSpiderChart({ muscleVolume, size = 260 }: Props) {
  const N = SPIDER_GROUPS.length;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 40; // marge pour les labels

  // Agréger par groupe
  const groupValues = SPIDER_GROUPS.map((g) =>
    g.muscles.reduce((sum, m) => sum + (muscleVolume[m] ?? 0), 0)
  );
  const maxValue = Math.max(1, ...groupValues);

  // Calcule la position d'un point sur un axe (angle, fraction de rayon)
  const point = (i: number, fraction: number): [number, number] => {
    // -π/2 pour commencer en haut (12h)
    const angle = (i * 2 * Math.PI) / N - Math.PI / 2;
    return [cx + Math.cos(angle) * r * fraction, cy + Math.sin(angle) * r * fraction];
  };

  const polygonPoints = groupValues
    .map((v, i) => point(i, v / maxValue))
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');

  return (
    <View style={styles.wrap}>
      <Svg width={size} height={size}>
        {/* Cercles concentriques (25%, 50%, 75%, 100%) */}
        {[0.25, 0.5, 0.75, 1].map((f, i) => (
          <Circle
            key={i}
            cx={cx}
            cy={cy}
            r={r * f}
            stroke={i === 3 ? COLORS.border : `${COLORS.border}88`}
            strokeWidth={1}
            fill="none"
          />
        ))}

        {/* Axes radiaux */}
        {SPIDER_GROUPS.map((_, i) => {
          const [x, y] = point(i, 1);
          return <Line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={`${COLORS.border}88`} strokeWidth={1} />;
        })}

        {/* Polygone des valeurs */}
        <Polygon
          points={polygonPoints}
          fill={`${COLORS.primary}55`}
          stroke={COLORS.primary}
          strokeWidth={2}
        />

        {/* Points sur le polygone */}
        {groupValues.map((v, i) => {
          const [x, y] = point(i, v / maxValue);
          return <Circle key={i} cx={x} cy={y} r={3} fill={COLORS.primary} />;
        })}

        {/* Labels groupes (en dehors du cercle) */}
        {SPIDER_GROUPS.map((g, i) => {
          const [x, y] = point(i, 1.18);
          return (
            <G key={g.key}>
              <SvgText
                x={x}
                y={y}
                fontSize="9"
                fontWeight="900"
                fill={COLORS.textSecondary}
                textAnchor="middle"
              >
                {g.label}
              </SvgText>
              <SvgText
                x={x}
                y={y + 11}
                fontSize="9"
                fontWeight="700"
                fill={COLORS.primary}
                textAnchor="middle"
              >
                {groupValues[i]}
              </SvgText>
            </G>
          );
        })}
      </Svg>

      <View style={styles.scaleRow}>
        <View style={styles.scaleItem}>
          <View style={[styles.scaleDot, { backgroundColor: COLORS.primary }]} />
          <Text style={styles.scaleText}>Séries complétées</Text>
        </View>
        <Text style={styles.scaleMax}>Max: {maxValue}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: SPACING.sm },
  scaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: SPACING.sm,
  },
  scaleItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  scaleDot: { width: 8, height: 8, borderRadius: 4 },
  scaleText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700' },
  scaleMax: { color: COLORS.textMuted, fontSize: 11, fontWeight: '700' },
});
