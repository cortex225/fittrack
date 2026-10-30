import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { COLORS, TYPE } from '../theme';

// Jauge en demi-cercle (180°), sobre : un arc principal plein et, à l'intérieur,
// des arcs fins pour les sous-valeurs. Chaque piste reprend la couleur de son
// arc, très atténuée, comme les anneaux de l'app Forme.

interface SubArc {
  value: number;
  target: number;
  color: string;
}

interface Props {
  value: number;
  target: number;
  size?: number;
  color?: string;
  subArcs?: SubArc[];
  centerLabel?: string;
  centerUnit?: string;
  caption?: string;
}

// Arc demi-cercle ouvert vers le bas : M x1 y1 A r r 0 0 1 x2 y2
function arcPath(cx: number, cy: number, r: number): string {
  return `M ${cx - r},${cy} A ${r},${r} 0 0 1 ${cx + r},${cy}`;
}

function trackOf(color: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? `${color}2E` : COLORS.surface;
}

export default function SemiGauge({
  value,
  target,
  size = 200,
  color = COLORS.primary,
  subArcs = [],
  centerLabel,
  centerUnit,
  caption,
}: Props) {
  const strokeMain = Math.max(10, size * 0.065);
  const strokeSub = Math.max(4, size * 0.026);
  const gap = Math.max(4, size * 0.03);

  const cx = size / 2;
  const cy = size / 2 + strokeMain / 2; // les extrémités de l'arc reposent sur cette ligne
  const rMain = size / 2 - strokeMain / 2;
  const height = cy + strokeMain / 2 + 4;

  const pct = target > 0 ? Math.min(1, value / target) : 0;
  const isOver = value > target;

  // Rayon intérieur libre (sous le dernier sous-arc) pour placer le chiffre.
  const lastR = subArcs.length > 0
    ? rMain - strokeMain / 2 - gap - strokeSub / 2 - (subArcs.length - 1) * (strokeSub + gap)
    : rMain;
  const innerR = Math.max(20, lastR - (subArcs.length > 0 ? strokeSub / 2 : strokeMain / 2) - 4);

  const valueStr = String(Math.round(value));
  const digits = Math.max(1, valueStr.length);
  const valueFont = Math.min(size * 0.17, Math.max(16, (innerR * 1.5) / (digits * 0.6 + 0.6)));

  const lenMain = Math.PI * rMain;

  return (
    <View style={[styles.wrap, { width: size, height }]}>
      <Svg width={size} height={height}>
        {/* Piste principale */}
        <Path d={arcPath(cx, cy, rMain)} stroke={trackOf(color)} strokeWidth={strokeMain} fill="none" strokeLinecap="round" />
        {/* Arc principal */}
        {pct > 0 && (
          <Path
            d={arcPath(cx, cy, rMain)}
            stroke={isOver ? COLORS.danger : color}
            strokeWidth={strokeMain}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${lenMain * pct} ${lenMain}`}
          />
        )}

        {/* Sous-arcs concentriques */}
        {subArcs.map((sub, i) => {
          const r = rMain - strokeMain / 2 - gap - strokeSub / 2 - i * (strokeSub + gap);
          const len = Math.PI * r;
          const p = sub.target > 0 ? Math.min(1, sub.value / sub.target) : 0;
          return (
            <React.Fragment key={i}>
              <Path d={arcPath(cx, cy, r)} stroke={trackOf(sub.color)} strokeWidth={strokeSub} fill="none" strokeLinecap="round" />
              {p > 0 && (
                <Path
                  d={arcPath(cx, cy, r)}
                  stroke={sub.color}
                  strokeWidth={strokeSub}
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${len * p} ${len}`}
                />
              )}
            </React.Fragment>
          );
        })}
      </Svg>

      {/* Chiffre central, posé dans la cuvette du demi-cercle */}
      <View style={[styles.center, { bottom: height - cy, width: innerR * 2 }]} pointerEvents="none">
        <View style={styles.valueRow}>
          <Text
            style={[styles.value, { fontSize: valueFont, lineHeight: valueFont * 1.05 }, isOver && { color: COLORS.danger }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
          >
            {valueStr}
          </Text>
          {centerUnit && (
            <Text style={[styles.unit, { fontSize: Math.max(12, valueFont * 0.36) }]}>{centerUnit}</Text>
          )}
        </View>
        {centerLabel && <Text style={styles.label} numberOfLines={1}>{centerLabel}</Text>}
        {caption && <Text style={styles.caption} numberOfLines={1}>{caption}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'center', alignItems: 'center', justifyContent: 'flex-start' },
  center: { position: 'absolute', alignItems: 'center', alignSelf: 'center' },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  value: { ...TYPE.number, color: COLORS.text, textAlign: 'center' },
  unit: { color: COLORS.textSecondary, fontWeight: '500' },
  label: { ...TYPE.footnote, color: COLORS.textSecondary, marginTop: 2 },
  caption: { ...TYPE.footnote, color: COLORS.textMuted, marginTop: 2 },
});
