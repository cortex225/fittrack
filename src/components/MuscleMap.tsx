import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Ellipse, G, Path, Rect } from 'react-native-svg';
import { COLORS, SPACING } from '../theme';
import { ExerciseMuscle } from '../data/exercises';

const PRIMARY = COLORS.primary;
const SECONDARY = '#F59E0B';
const IDLE = '#1F2937';
const STROKE = '#0F172A';

type MuscleKey =
  | 'neck' | 'shoulders' | 'chest' | 'biceps' | 'forearms' | 'abdominals'
  | 'abductors' | 'adductors' | 'quadriceps' | 'calves'
  | 'traps' | 'lats' | 'middle back' | 'lower back' | 'triceps' | 'glutes' | 'hamstrings';

interface Props {
  primaryMuscles: ExerciseMuscle[];
  secondaryMuscles: ExerciseMuscle[];
  view?: 'front' | 'back' | 'both';
  size?: number;
}

export default function MuscleMap({ primaryMuscles, secondaryMuscles, view = 'both', size = 140 }: Props) {
  const fill = (m: MuscleKey): string => {
    if ((primaryMuscles as MuscleKey[]).includes(m)) return PRIMARY;
    if ((secondaryMuscles as MuscleKey[]).includes(m)) return SECONDARY;
    return IDLE;
  };

  const front = (
    <View style={{ alignItems: 'center' }}>
      <Svg width={size} height={size * 2} viewBox="0 0 100 200">
        {/* Tête */}
        <Ellipse cx="50" cy="15" rx="11" ry="13" fill={IDLE} stroke={STROKE} strokeWidth="0.6" />
        {/* Cou */}
        <Rect x="44" y="26" width="12" height="8" rx="2" fill={fill('neck')} stroke={STROKE} strokeWidth="0.6" />
        {/* Trapèzes haut (visibles de face) */}
        <Path d="M30 36 Q50 28 70 36 L66 42 Q50 36 34 42 Z" fill={fill('traps')} stroke={STROKE} strokeWidth="0.6" />
        {/* Épaules */}
        <Ellipse cx="28" cy="46" rx="9" ry="7" fill={fill('shoulders')} stroke={STROKE} strokeWidth="0.6" />
        <Ellipse cx="72" cy="46" rx="9" ry="7" fill={fill('shoulders')} stroke={STROKE} strokeWidth="0.6" />
        {/* Pectoraux */}
        <Path d="M36 42 Q50 38 64 42 L62 64 Q50 60 38 64 Z" fill={fill('chest')} stroke={STROKE} strokeWidth="0.6" />
        {/* Abdos */}
        <Rect x="42" y="66" width="16" height="32" rx="3" fill={fill('abdominals')} stroke={STROKE} strokeWidth="0.6" />
        {/* Biceps */}
        <Ellipse cx="22" cy="62" rx="6" ry="12" fill={fill('biceps')} stroke={STROKE} strokeWidth="0.6" />
        <Ellipse cx="78" cy="62" rx="6" ry="12" fill={fill('biceps')} stroke={STROKE} strokeWidth="0.6" />
        {/* Avant-bras */}
        <Ellipse cx="20" cy="84" rx="5" ry="11" fill={fill('forearms')} stroke={STROKE} strokeWidth="0.6" />
        <Ellipse cx="80" cy="84" rx="5" ry="11" fill={fill('forearms')} stroke={STROKE} strokeWidth="0.6" />
        {/* Bassin / hanches (ne reçoit aucun muscle direct) */}
        <Path d="M36 98 Q50 102 64 98 L66 110 Q50 114 34 110 Z" fill={IDLE} stroke={STROKE} strokeWidth="0.6" />
        {/* Adducteurs (intérieur cuisses) */}
        <Path d="M44 112 L50 112 L50 145 L46 145 Z" fill={fill('adductors')} stroke={STROKE} strokeWidth="0.6" />
        <Path d="M50 112 L56 112 L54 145 L50 145 Z" fill={fill('adductors')} stroke={STROKE} strokeWidth="0.6" />
        {/* Quadriceps */}
        <Path d="M34 112 L44 112 L46 150 L36 150 Z" fill={fill('quadriceps')} stroke={STROKE} strokeWidth="0.6" />
        <Path d="M56 112 L66 112 L64 150 L54 150 Z" fill={fill('quadriceps')} stroke={STROKE} strokeWidth="0.6" />
        {/* Abducteurs (extérieur) — fines bandes */}
        <Path d="M32 114 L34 114 L36 145 L32 145 Z" fill={fill('abductors')} stroke={STROKE} strokeWidth="0.6" />
        <Path d="M66 114 L68 114 L68 145 L64 145 Z" fill={fill('abductors')} stroke={STROKE} strokeWidth="0.6" />
        {/* Mollets (face : tibial) */}
        <Ellipse cx="40" cy="170" rx="5" ry="13" fill={fill('calves')} stroke={STROKE} strokeWidth="0.6" />
        <Ellipse cx="60" cy="170" rx="5" ry="13" fill={fill('calves')} stroke={STROKE} strokeWidth="0.6" />
      </Svg>
      <Text style={styles.viewLabel}>Avant</Text>
    </View>
  );

  const back = (
    <View style={{ alignItems: 'center' }}>
      <Svg width={size} height={size * 2} viewBox="0 0 100 200">
        {/* Tête */}
        <Ellipse cx="50" cy="15" rx="11" ry="13" fill={IDLE} stroke={STROKE} strokeWidth="0.6" />
        {/* Cou */}
        <Rect x="44" y="26" width="12" height="8" rx="2" fill={fill('neck')} stroke={STROKE} strokeWidth="0.6" />
        {/* Trapèzes (gros) */}
        <Path d="M30 34 Q50 28 70 34 L60 58 Q50 50 40 58 Z" fill={fill('traps')} stroke={STROKE} strokeWidth="0.6" />
        {/* Épaules arrière */}
        <Ellipse cx="28" cy="46" rx="9" ry="7" fill={fill('shoulders')} stroke={STROKE} strokeWidth="0.6" />
        <Ellipse cx="72" cy="46" rx="9" ry="7" fill={fill('shoulders')} stroke={STROKE} strokeWidth="0.6" />
        {/* Grand dorsal (lats) */}
        <Path d="M36 56 L40 58 L42 86 L34 80 Z" fill={fill('lats')} stroke={STROKE} strokeWidth="0.6" />
        <Path d="M64 56 L60 58 L58 86 L66 80 Z" fill={fill('lats')} stroke={STROKE} strokeWidth="0.6" />
        {/* Dos milieu (rhomboïdes) */}
        <Rect x="42" y="60" width="16" height="24" rx="2" fill={fill('middle back')} stroke={STROKE} strokeWidth="0.6" />
        {/* Lombaires */}
        <Rect x="44" y="86" width="12" height="14" rx="2" fill={fill('lower back')} stroke={STROKE} strokeWidth="0.6" />
        {/* Triceps */}
        <Ellipse cx="22" cy="62" rx="6" ry="12" fill={fill('triceps')} stroke={STROKE} strokeWidth="0.6" />
        <Ellipse cx="78" cy="62" rx="6" ry="12" fill={fill('triceps')} stroke={STROKE} strokeWidth="0.6" />
        {/* Avant-bras */}
        <Ellipse cx="20" cy="84" rx="5" ry="11" fill={fill('forearms')} stroke={STROKE} strokeWidth="0.6" />
        <Ellipse cx="80" cy="84" rx="5" ry="11" fill={fill('forearms')} stroke={STROKE} strokeWidth="0.6" />
        {/* Fessiers */}
        <Path d="M36 100 Q50 96 50 96 L50 116 Q44 118 36 114 Z" fill={fill('glutes')} stroke={STROKE} strokeWidth="0.6" />
        <Path d="M50 96 Q50 96 64 100 L64 114 Q56 118 50 116 Z" fill={fill('glutes')} stroke={STROKE} strokeWidth="0.6" />
        {/* Ischios */}
        <Path d="M34 118 L46 118 L46 150 L36 150 Z" fill={fill('hamstrings')} stroke={STROKE} strokeWidth="0.6" />
        <Path d="M54 118 L66 118 L64 150 L54 150 Z" fill={fill('hamstrings')} stroke={STROKE} strokeWidth="0.6" />
        {/* Mollets (gros) */}
        <Ellipse cx="40" cy="170" rx="6" ry="14" fill={fill('calves')} stroke={STROKE} strokeWidth="0.6" />
        <Ellipse cx="60" cy="170" rx="6" ry="14" fill={fill('calves')} stroke={STROKE} strokeWidth="0.6" />
      </Svg>
      <Text style={styles.viewLabel}>Arrière</Text>
    </View>
  );

  return (
    <View style={styles.wrap}>
      {view !== 'back' && front}
      {view !== 'front' && back}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: SPACING.lg, justifyContent: 'center', alignItems: 'flex-start' },
  viewLabel: { color: COLORS.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginTop: 4 },
});
