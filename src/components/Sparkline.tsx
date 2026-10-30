import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { COLORS } from '../theme';

let sparkCount = 0;

interface Props {
  data: number[];
  color: string;
  width: number;
  height: number;
  /** Affiche un remplissage discret sous la courbe */
  filled?: boolean;
  /** Affiche un point sur la dernière valeur */
  showLastDot?: boolean;
  strokeWidth?: number;
}

// Tracé lissé (Catmull-Rom approché) : courbe plus douce qu'une simple polyligne.
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x},${points[0].y}`;

  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return d;
}

export default function Sparkline({
  data,
  color,
  width,
  height,
  filled = true,
  showLastDot = true,
  strokeWidth = 2,
}: Props) {
  // Id unique par instance : sur le web, un id répété pointe vers un écran masqué.
  const uid = React.useRef(`spark${++sparkCount}`).current;
  if (data.length === 0) {
    return <View style={{ width, height }} />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = Math.max(1, max - min);

  const dotR = showLastDot ? 3.5 : 0;
  const padX = Math.max(strokeWidth, dotR + 1);
  const padY = Math.max(strokeWidth + 1, dotR + 1);
  const usableW = width - padX * 2;
  const usableH = height - padY * 2;

  const points = data.map((v, i) => ({
    x: padX + (data.length === 1 ? usableW / 2 : (i / (data.length - 1)) * usableW),
    y: padY + (1 - (v - min) / range) * usableH,
  }));

  const linePath = smoothPath(points);
  const fillPath =
    points.length > 1
      ? `${linePath} L ${points[points.length - 1].x},${height} L ${points[0].x},${height} Z`
      : '';

  const gradientId = `${uid}-${color.replace(/[^a-zA-Z0-9]/g, '')}`;
  const last = points[points.length - 1];

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.22} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>

      {filled && fillPath ? <Path d={fillPath} fill={`url(#${gradientId})`} /> : null}
      <Path
        d={linePath}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {showLastDot && (
        <>
          <Circle cx={last.x} cy={last.y} r={dotR + 1.5} fill={COLORS.backgroundSolid} />
          <Circle cx={last.x} cy={last.y} r={dotR} fill={color} />
        </>
      )}
    </Svg>
  );
}
