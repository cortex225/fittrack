import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

interface Props {
  data: number[];
  color: string;
  width: number;
  height: number;
  /** Affiche un area-fill sous la courbe avec un gradient discret */
  filled?: boolean;
  /** Affiche un dot sur le dernier point */
  showLastDot?: boolean;
  strokeWidth?: number;
}

// Tracé en spline (Catmull-Rom approximé) → courbe plus douce qu'un polyline brut.
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
  if (data.length === 0) {
    return <View style={{ width, height }} />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = Math.max(1, max - min);

  const padX = strokeWidth;
  const padY = strokeWidth + 2;
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

  const gradientId = `spark-${color.replace('#', '')}`;
  const last = points[points.length - 1];

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.4} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>

      {filled && fillPath && <Path d={fillPath} fill={`url(#${gradientId})`} />}
      <Path d={linePath} stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />

      {showLastDot && (
        <>
          <Circle cx={last.x} cy={last.y} r={4} fill="#0F0F1A" />
          <Circle cx={last.x} cy={last.y} r={3} fill={color} />
        </>
      )}
    </Svg>
  );
}
