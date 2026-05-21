import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACING } from '../theme';
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
      backgroundColor: variant === 'product' ? '#FFFFFF' : COLORS.surface,
    },
  ];

  if (urls.length === 0 || errored) {
    return (
      <View style={[...wrapStyle, styles.imageFallback]}>
        <Ionicons name="barbell-outline" size={32} color={COLORS.textMuted} />
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
      <TouchableOpacity style={styles.cardCompact} onPress={onPress} activeOpacity={0.85}>
        <View style={styles.thumbWrap}>
          <AnimatedExerciseImage exercise={exercise} height={72} rounded />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.nameCompact} numberOfLines={2}>{exercise.name}</Text>
          <View style={styles.metaRow}>
            <View style={[styles.levelDot, { backgroundColor: LEVEL_COLOR[exercise.level] }]} />
            <Text style={styles.metaText}>{levelFR(exercise.level)}</Text>
            <Text style={styles.metaSep}>·</Text>
            <Text style={styles.metaText}>{equipmentFR(exercise.equipment)}</Text>
          </View>
          <View style={styles.musclesRow}>
            {exercise.primaryMuscles.slice(0, 3).map((m) => (
              <View key={m} style={[styles.musclePill, styles.musclePillPrimary]}>
                <Text style={styles.musclePillText}>{muscleFR(m)}</Text>
              </View>
            ))}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.card}>
      <AnimatedExerciseImage exercise={exercise} height={220} rounded={false} />
      <View style={styles.body}>
        <View style={styles.headerRow}>
          <Text style={styles.name} numberOfLines={2}>{exercise.name}</Text>
          <View style={[styles.levelBadge, { backgroundColor: `${LEVEL_COLOR[exercise.level]}22`, borderColor: LEVEL_COLOR[exercise.level] }]}>
            <Text style={[styles.levelBadgeText, { color: LEVEL_COLOR[exercise.level] }]}>
              {levelFR(exercise.level)}
            </Text>
          </View>
        </View>

        <View style={styles.musclesSection}>
          {exercise.primaryMuscles.map((m) => (
            <View key={`p-${m}`} style={[styles.musclePill, styles.musclePillPrimary]}>
              <Text style={styles.musclePillText}>{muscleFR(m)}</Text>
            </View>
          ))}
          {exercise.secondaryMuscles.map((m) => (
            <View key={`s-${m}`} style={[styles.musclePill, styles.musclePillSecondary]}>
              <Text style={styles.musclePillSubtleText}>{muscleFR(m)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.metaRow}>
          <Ionicons name="barbell-outline" size={13} color={COLORS.textSecondary} />
          <Text style={styles.metaText}>{equipmentFR(exercise.equipment)}</Text>
          {exercise.mechanic && (
            <>
              <Text style={styles.metaSep}>·</Text>
              <Text style={styles.metaText}>{exercise.mechanic === 'compound' ? 'Polyarticulaire' : 'Isolation'}</Text>
            </>
          )}
        </View>

        {exercise.instructions.length > 0 && (
          <View style={styles.instructions}>
            <Text style={styles.instructionsTitle}>EXÉCUTION</Text>
            {exercise.instructions.map((step, i) => (
              <View key={i} style={styles.instructionRow}>
                <Text style={styles.instructionNum}>{i + 1}</Text>
                <Text style={styles.instructionText}>{step}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
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

  // Compact (list item)
  cardCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.sm,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
  thumbWrap: { width: 72, height: 72, borderRadius: RADIUS.md, overflow: 'hidden' },
  nameCompact: { color: COLORS.text, fontSize: 14, fontWeight: '800' },

  // Detailed
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  body: { padding: SPACING.md, gap: SPACING.sm },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  name: { color: COLORS.text, fontSize: 18, fontWeight: '900', flex: 1 },
  levelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  levelBadgeText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  metaText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '600' },
  metaSep: { color: COLORS.textMuted, fontSize: 11 },

  levelDot: { width: 6, height: 6, borderRadius: 3 },

  musclesSection: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  musclesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  musclePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.pill, borderWidth: 1 },
  musclePillPrimary: { backgroundColor: `${COLORS.primary}22`, borderColor: COLORS.primary },
  musclePillSecondary: { backgroundColor: COLORS.surface, borderColor: COLORS.border },
  musclePillText: { color: COLORS.primary, fontSize: 10, fontWeight: '800' },
  musclePillSubtleText: { color: COLORS.textSecondary, fontSize: 10, fontWeight: '700' },

  instructions: { marginTop: 4, gap: 6 },
  instructionsTitle: { color: COLORS.textMuted, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  instructionRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  instructionNum: {
    color: COLORS.primary,
    fontWeight: '900',
    fontSize: 12,
    minWidth: 16,
  },
  instructionText: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 18, flex: 1 },
});
