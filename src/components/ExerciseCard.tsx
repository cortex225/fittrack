import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACING, TYPE } from '../theme';
import { Glass } from './glass';
import { PressableScale } from './ui';
import { ExerciseDef, exerciseImageUrls } from '../data/exercises';
import {
  LEVEL_COLOR,
  equipmentFR,
  levelFR,
  muscleFR,
} from '../services/exercises';

interface AnimatedExerciseImageProps {
  exercise: ExerciseDef;
  height?: number;
  rounded?: boolean;
  /** "product" = fond blanc + padding pour faire ressortir les illustrations anatomiques (style catalogue).
   *  "raw" = pas de fond ni padding (utile en thumbnail compact si on veut gagner de la place). */
  variant?: 'product' | 'raw';
}

// Alterne les 2 frames toutes les ~600ms pour simuler une GIF.
// On précharge les 2 frames pour éviter le flicker au switch.
export function AnimatedExerciseImage({ exercise, height = 180, rounded = true, variant = 'product' }: AnimatedExerciseImageProps) {
  const urls = exerciseImageUrls(exercise);
  const [frame, setFrame] = useState(0);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    if (urls.length < 2) return;
    const id = setInterval(() => setFrame((f) => (f + 1) % urls.length), 600);
    return () => clearInterval(id);
  }, [exercise.id, urls.length]);

  const wrapStyle = [
    styles.imageWrap,
    {
      height,
      borderRadius: rounded ? RADIUS.lg : 0,
      backgroundColor: variant === 'product' ? '#F5F5F7' : COLORS.surface,
    },
  ];

  if (urls.length === 0 || errored) {
    return (
      <View style={[...wrapStyle, styles.imageFallback]}>
        <Ionicons name="barbell-outline" size={Math.min(28, Math.max(18, height / 4))} color={COLORS.textMuted} />
      </View>
    );
  }

  return (
    <View style={wrapStyle}>
      {/* On rend les 2 frames empilées et on bascule l'opacité — plus fluide qu'un swap source */}
      {urls.map((uri, i) => (
        <Image
          key={i}
          source={{ uri }}
          style={[
            styles.image,
            { opacity: i === frame ? 1 : 0 },
          ]}
          contentFit="contain"
          transition={150}
          onError={() => setErrored(true)}
        />
      ))}
    </View>
  );
}

interface ExerciseCardProps {
  exercise: ExerciseDef;
  onPress?: () => void;
  compact?: boolean;
}

export default function ExerciseCard({ exercise, onPress, compact = false }: ExerciseCardProps) {
  if (compact) {
    return (
      <PressableScale onPress={onPress} scaleTo={0.98} style={styles.compactOuter} accessibilityRole="button">
        <Glass radius={RADIUS.xl} style={styles.cardCompact}>
          <View style={styles.thumbWrap}>
            <AnimatedExerciseImage exercise={exercise} height={68} rounded />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={styles.nameCompact} numberOfLines={2}>{exercise.name}</Text>
            <Text style={styles.musclesText} numberOfLines={1}>
              {exercise.primaryMuscles.slice(0, 3).map(muscleFR).join(' · ')}
            </Text>
            <View style={styles.metaRow}>
              <View style={[styles.levelDot, { backgroundColor: LEVEL_COLOR[exercise.level] }]} />
              <Text style={styles.metaText}>{levelFR(exercise.level)}</Text>
              <Text style={styles.metaSep}>·</Text>
              <Text style={styles.metaText}>{equipmentFR(exercise.equipment)}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
        </Glass>
      </PressableScale>
    );
  }

  return (
    <Glass radius={RADIUS.xl}>
      <AnimatedExerciseImage exercise={exercise} height={220} rounded={false} />
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>{exercise.name}</Text>

        <View style={styles.metaRow}>
          <View style={[styles.levelDot, { backgroundColor: LEVEL_COLOR[exercise.level] }]} />
          <Text style={styles.metaText}>{levelFR(exercise.level)}</Text>
          <Text style={styles.metaSep}>·</Text>
          <Text style={styles.metaText}>{equipmentFR(exercise.equipment)}</Text>
          {exercise.mechanic && (
            <>
              <Text style={styles.metaSep}>·</Text>
              <Text style={styles.metaText}>{exercise.mechanic === 'compound' ? 'Polyarticulaire' : 'Isolation'}</Text>
            </>
          )}
        </View>

        <View style={styles.musclesSection}>
          {exercise.primaryMuscles.map((m) => (
            <View key={`p-${m}`} style={[styles.musclePill, styles.musclePillPrimary]}>
              <Text style={styles.musclePillText}>{muscleFR(m)}</Text>
            </View>
          ))}
          {exercise.secondaryMuscles.map((m) => (
            <View key={`s-${m}`} style={styles.musclePill}>
              <Text style={styles.musclePillSubtleText}>{muscleFR(m)}</Text>
            </View>
          ))}
        </View>

        {exercise.instructions.length > 0 && (
          <View style={styles.instructions}>
            <Text style={styles.instructionsTitle}>Exécution</Text>
            {exercise.instructions.map((step, i) => (
              <View key={i} style={styles.instructionRow}>
                <Text style={styles.instructionNum}>{i + 1}</Text>
                <Text style={styles.instructionText}>{step}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  imageWrap: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
    position: 'relative',
  },
  image: { position: 'absolute', width: '100%', height: '100%' },
  imageFallback: { alignItems: 'center', justifyContent: 'center' },

  // Compact (ligne de liste)
  compactOuter: { marginBottom: SPACING.sm },
  cardCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 10,
    paddingRight: SPACING.md,
  },
  thumbWrap: { width: 68, height: 68, borderRadius: RADIUS.lg, overflow: 'hidden' },
  nameCompact: { ...TYPE.headline, color: COLORS.text },
  musclesText: { ...TYPE.caption, color: COLORS.textSecondary },

  // Détaillé
  body: { padding: SPACING.lg, gap: SPACING.sm },
  name: { ...TYPE.title, color: COLORS.text },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  metaText: { ...TYPE.footnote, color: COLORS.textMuted },
  metaSep: { ...TYPE.footnote, color: COLORS.textMuted },
  levelDot: { width: 6, height: 6, borderRadius: 3 },

  musclesSection: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  musclePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surface,
  },
  musclePillPrimary: { backgroundColor: COLORS.primarySoft },
  musclePillText: { ...TYPE.footnote, color: COLORS.primaryLight },
  musclePillSubtleText: { ...TYPE.footnote, color: COLORS.textSecondary },

  instructions: { marginTop: SPACING.sm, gap: 8 },
  instructionsTitle: { ...TYPE.overline, color: COLORS.textSecondary },
  instructionRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  instructionNum: { ...TYPE.callout, color: COLORS.textMuted, minWidth: 16, fontVariant: ['tabular-nums'] },
  instructionText: { ...TYPE.body, fontSize: 15, lineHeight: 21, color: COLORS.textSecondary, flex: 1 },
});
