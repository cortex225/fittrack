import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { COLORS } from '../theme';

// Jauge demi-cercle 180° (de 9h à 3h en passant par le bas).
// On dessine un arc avec une <Path> et on contrôle son `pathLength` virtuel via `strokeDasharray`.

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

// Arc demi-cercle ouvert vers le bas, partant de 180° à 360°.
// On utilise une path SVG : M x1 y1 A r r 0 0 1 x2 y2
function arcPath(cx: number, cy: number, r: number): string {
  return `M ${cx - r},${cy} A ${r},${r} 0 0 1 ${cx + r},${cy}`;
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
  const cx = size / 2;
  const cy = size * 0.62; // décalé un peu vers le bas
  const rMain = size / 2 - 12;
  const strokeMain = 12;
  const strokeSub = 5;
  const gapBetweenArcs = 10;

  const pct = target > 0 ? Math.min(1, value / target) : 0;
  const isOver = value > target;

  // Auto-scale strict : la zone utile au centre d'un demi-cercle est bien plus étroite
  // qu'on pense — on ne dispose que de ~1.2 × rMain de largeur dans la zone visuellement "vide"
  // au dessus de la barre (le reste touche les arcs).
  const valueStr = String(Math.round(value));
  const digits = Math.max(1, valueStr.length);
  const fontByDigits = (rMain * 1.1) / (digits * 0.6 + 0.4);
  const valueFont = Math.min(size * 0.18, Math.max(16, fontByDigits));

  // Pour un demi-cercle, longueur de l'arc = π × r
  const lenMain = Math.PI * rMain;
  const mainDash = `${lenMain * pct} ${lenMain}`;

  const gradId = `gauge-${color.replace('#', '')}`;

  return (
    <View style={[styles.wrap, { width: size, height: cy + 30 }]}>
      <Svg width={size} height={cy + 30}>
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={color} stopOpacity={0.6} />
            <Stop offset="1" stopColor={color} stopOpacity={1} />
          </LinearGradient>
        </Defs>

        {/* Piste principale */}
        <Path
          d={arcPath(cx, cy, rMain)}
          stroke={COLORS.surface}
          strokeWidth={strokeMain}
          fill="none"
          strokeLinecap="round"
        />
        {/* Arc principal */}
        <Path
          d={arcPath(cx, cy, rMain)}
          stroke={isOver ? COLORS.danger : `url(#${gradId})`}
          strokeWidth={strokeMain}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={mainDash}
        />

        {/* Sub-arcs concentriques */}
        {subArcs.map((sub, i) => {
          const r = rMain - strokeMain / 2 - gapBetweenArcs - i * (strokeSub + 6);
          const len = Math.PI * r;
          const p = sub.target > 0 ? Math.min(1, sub.value / sub.target) : 0;
          return (
            <React.Fragment key={i}>
              <Path
                d={arcPath(cx, cy, r)}
                stroke={COLORS.surface}
                strokeWidth={strokeSub}
                fill="none"
                strokeLinecap="round"
              />
              <Path
                d={arcPath(cx, cy, r)}
                stroke={sub.color}
                strokeWidth={strokeSub}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${len * p} ${len}`}
              />
            </React.Fragment>
          );
        })}
      </Svg>

      {/* Contenu central : positionné dans la "cuvette" du demi-cercle, hauteur réduite */}
      <View style={[styles.center, { top: cy - valueFont * 0.95, width: rMain * 1.5 }]} pointerEvents="none">
        <View style={styles.valueRow}>
          <Text
            style={[styles.value, { fontSize: valueFont, lineHeight: valueFont * 1.0 }, isOver && { color: COLORS.danger }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
          >
            {Math.round(value)}
          </Text>
          {centerUnit && <Text style={[styles.unit, { fontSize: Math.max(10, valueFont * 0.4) }]}>{centerUnit}</Text>}
        </View>
        {centerLabel && (
          <Text style={styles.label} numberOfLines={1}>
            {centerLabel}
          </Text>
        )}
        {caption && <Text style={styles.caption} numberOfLines={1}>{caption}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'center', alignItems: 'center', justifyContent: 'flex-start' },
  center: {
    position: 'absolute',
    alignItems: 'center',
    alignSelf: 'center',
  },
  valueRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  value: { color: COLORS.text, fontWeight: '900', letterSpacing: -0.8, textAlign: 'center' },
  unit: { color: COLORS.textSecondary, fontWeight: '700', marginBottom: 2 },
  label: { color: COLORS.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginTop: 2 },
  caption: { color: COLORS.textMuted, fontSize: 10, fontWeight: '700', marginTop: 2 },
});
