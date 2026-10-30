import React from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Modal } from './Modal';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SPACING, TYPE } from '../theme';
import { ExerciseDef } from '../data/exercises';
import { LibraryExercise } from '../types';
import {
  LEVEL_COLOR,
  equipmentFR,
  findExerciseById,
  levelFR,
  muscleFR,
} from '../services/exercises';
import { AnimatedExerciseImage } from './ExerciseCard';
import MuscleMap, { MUSCLE_PRIMARY, MUSCLE_SECONDARY } from './MuscleMap';
import { AppBackground, Glass, GlassCard } from './glass';
import { PressableScale } from './ui';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Si fourni, on prend ses sets/reps/rest et conseils éventuels (séance). */
  libraryExercise?: LibraryExercise | null;
  /** Sinon on s'appuie uniquement sur le catalogue ExerciseDB. */
  exerciseDef?: ExerciseDef | null;
}

export default function ExerciseDetailModal({
  visible,
  onClose,
  libraryExercise,
  exerciseDef,
}: Props) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  // Résoudre l'ExerciseDef à partir du libraryExercise.exerciseId si pas fourni directement.
  const def: ExerciseDef | undefined =
    exerciseDef ??
    (libraryExercise?.exerciseId ? findExerciseById(libraryExercise.exerciseId) : undefined) ??
    undefined;

  const displayName = libraryExercise?.name ?? def?.name ?? '';

  const askCoach = () => {
    if (!displayName) return;
    const muscles = def ? def.primaryMuscles.map(muscleFR).join(', ') : '';
    onClose();
    navigation.navigate('CoachChat', {
      seedMessage: muscles
        ? `Donne-moi tes conseils sur l'exercice "${displayName}" (${muscles}). Erreurs courantes à éviter, progression, alternatives selon mon niveau.`
        : `Donne-moi tes conseils sur l'exercice "${displayName}". Erreurs courantes à éviter, progression, alternatives selon mon niveau.`,
    });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <AppBackground />
        <StatusBar barStyle="light-content" />

        <View style={styles.header}>
          <PressableScale onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Fermer">
            <Glass radius={20} style={styles.iconBtn}>
              <Ionicons name="close" size={20} color={COLORS.text} />
            </Glass>
          </PressableScale>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingBottom: insets.bottom + 48, gap: SPACING.md }}
          showsVerticalScrollIndicator={false}
        >
          {/* Titre */}
          <View style={{ marginBottom: 4 }}>
            <Text style={styles.exName}>{displayName}</Text>
            {def && (
              <View style={styles.headerMeta}>
                <View style={[styles.levelDot, { backgroundColor: LEVEL_COLOR[def.level] }]} />
                <Text style={styles.metaText}>{levelFR(def.level)}</Text>
                <Text style={styles.metaSep}>·</Text>
                <Text style={styles.metaText}>{equipmentFR(def.equipment)}</Text>
                {def.mechanic && (
                  <>
                    <Text style={styles.metaSep}>·</Text>
                    <Text style={styles.metaText}>
                      {def.mechanic === 'compound' ? 'Polyarticulaire' : 'Isolation'}
                    </Text>
                  </>
                )}
              </View>
            )}
          </View>

          {/* Média */}
          {def ? (
            <Glass radius={RADIUS.xl} style={styles.mediaWrap}>
              <AnimatedExerciseImage exercise={def} height={260} rounded={false} />
            </Glass>
          ) : (
            <Glass radius={RADIUS.xl} style={styles.mediaFallback}>
              <Ionicons name="barbell-outline" size={40} color={COLORS.textMuted} />
              <Text style={styles.mediaFallbackText}>Pas d'animation disponible</Text>
            </Glass>
          )}

          {/* Config séance (si on vient d'une séance) */}
          {libraryExercise && (
            <GlassCard style={styles.configCard} padding={SPACING.md}>
              <Config label="Séries" value={String(libraryExercise.sets)} />
              <View style={styles.configSep} />
              <Config label="Répétitions" value={libraryExercise.reps} />
              <View style={styles.configSep} />
              <Config label="Repos" value={String(libraryExercise.rest)} unit="s" />
            </GlassCard>
          )}

          {/* Muscle map */}
          {def && (
            <View>
              <Text style={styles.sectionLabel}>Muscles travaillés</Text>
              <GlassCard style={styles.muscleMapCard}>
                <MuscleMap
                  primaryMuscles={def.primaryMuscles}
                  secondaryMuscles={def.secondaryMuscles}
                  size={110}
                />
                <View style={styles.legendRow}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: MUSCLE_PRIMARY }]} />
                    <Text style={styles.legendText}>Principal</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: MUSCLE_SECONDARY }]} />
                    <Text style={styles.legendText}>Secondaire</Text>
                  </View>
                </View>
                <View style={styles.musclePillsSection}>
                  {def.primaryMuscles.map((m) => (
                    <View key={`p-${m}`} style={[styles.musclePill, styles.musclePillPrimary]}>
                      <Text style={styles.musclePillPrimaryText}>{muscleFR(m)}</Text>
                    </View>
                  ))}
                  {def.secondaryMuscles.map((m) => (
                    <View key={`s-${m}`} style={styles.musclePill}>
                      <Text style={styles.musclePillSecondaryText}>{muscleFR(m)}</Text>
                    </View>
                  ))}
                </View>
              </GlassCard>
            </View>
          )}

          {/* Setup */}
          {libraryExercise?.setup && (
            <Section icon="locate-outline" title="Installation">
              <Text style={styles.bodyText}>{libraryExercise.setup}</Text>
            </Section>
          )}

          {/* Execution (priorité libraryExercise sinon instructions catalogue) */}
          {(libraryExercise?.execution || (def && def.instructions.length > 0)) && (
            <Section icon="play-circle-outline" title="Exécution">
              {libraryExercise?.execution ? (
                <Text style={styles.bodyText}>{libraryExercise.execution}</Text>
              ) : (
                def!.instructions.map((step, i) => (
                  <View key={i} style={styles.stepRow}>
                    <Text style={styles.stepNum}>{i + 1}</Text>
                    <Text style={styles.stepText}>{step}</Text>
                  </View>
                ))
              )}
            </Section>
          )}

          {/* Erreurs courantes */}
          {libraryExercise?.mistakes && libraryExercise.mistakes.length > 0 && (
            <Section icon="warning-outline" title="Erreurs à éviter">
              {libraryExercise.mistakes.map((m, i) => (
                <View key={i} style={styles.stepRow}>
                  <View style={styles.bulletDot} />
                  <Text style={styles.stepText}>{m}</Text>
                </View>
              ))}
            </Section>
          )}

          {/* Conseil objectif */}
          {libraryExercise?.goalSpecificTip && (
            <Section icon="bulb-outline" title="Conseil selon ton objectif">
              <Text style={styles.bodyText}>{libraryExercise.goalSpecificTip}</Text>
            </Section>
          )}

          {/* CTA Coach */}
          <PressableScale style={styles.coachBtn} onPress={askCoach} accessibilityRole="button">
            <Ionicons name="sparkles-outline" size={20} color={COLORS.onPrimary} />
            <Text style={styles.coachBtnText}>Demander conseil au coach</Text>
          </PressableScale>
        </ScrollView>
      </View>
    </Modal>
  );
}

const Section: React.FC<{ icon: keyof typeof Ionicons.glyphMap; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <View>
    <View style={styles.sectionRow}>
      <Ionicons name={icon} size={15} color={COLORS.textSecondary} />
      <Text style={[styles.sectionLabel, { marginBottom: 0 }]}>{title}</Text>
    </View>
    <GlassCard style={styles.sectionBody}>{children}</GlassCard>
  </View>
);

const Config: React.FC<{ label: string; value: string; unit?: string }> = ({ label, value, unit }) => (
  <View style={styles.configItem}>
    <Text style={styles.configValue} numberOfLines={1} adjustsFontSizeToFit>
      {value}
      {unit ? <Text style={styles.configUnit}> {unit}</Text> : null}
    </Text>
    <Text style={styles.configLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  mediaWrap: { width: '100%' },
  mediaFallback: { height: 200, alignItems: 'center', justifyContent: 'center', gap: 8 },
  mediaFallbackText: { ...TYPE.caption, color: COLORS.textMuted },

  exName: { ...TYPE.largeTitle, color: COLORS.text },
  headerMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 6 },
  levelDot: { width: 7, height: 7, borderRadius: 4 },
  metaText: { ...TYPE.callout, color: COLORS.textSecondary },
  metaSep: { ...TYPE.callout, color: COLORS.textMuted },

  configCard: { flexDirection: 'row', alignItems: 'center' },
  configItem: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  configSep: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: COLORS.border },
  configValue: { ...TYPE.number, fontSize: 28, color: COLORS.text },
  configUnit: { fontSize: 15, fontWeight: '500', color: COLORS.textSecondary, letterSpacing: 0 },
  configLabel: { ...TYPE.footnote, color: COLORS.textMuted, marginTop: 2 },

  muscleMapCard: { alignItems: 'center', gap: SPACING.md },
  sectionLabel: { ...TYPE.overline, color: COLORS.textSecondary, marginBottom: SPACING.sm, marginLeft: 4 },
  legendRow: { flexDirection: 'row', gap: SPACING.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { ...TYPE.caption, color: COLORS.textSecondary },
  musclePillsSection: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  musclePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surface,
  },
  musclePillPrimary: { backgroundColor: COLORS.primarySoft },
  musclePillPrimaryText: { ...TYPE.caption, color: COLORS.primaryLight },
  musclePillSecondaryText: { ...TYPE.caption, color: COLORS.textSecondary },

  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.sm, marginLeft: 4 },
  sectionBody: { gap: 10 },
  bodyText: { ...TYPE.body, color: COLORS.text, lineHeight: 23 },
  stepRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stepNum: { ...TYPE.callout, color: COLORS.textMuted, minWidth: 16, fontVariant: ['tabular-nums'], lineHeight: 22 },
  stepText: { ...TYPE.body, fontSize: 15, color: COLORS.textSecondary, lineHeight: 22, flex: 1 },
  bulletDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.textMuted, marginTop: 9, marginLeft: 4 },

  coachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: RADIUS.pill,
    marginTop: SPACING.sm,
  },
  coachBtnText: { color: COLORS.onPrimary, fontSize: 17, fontWeight: '600' },
});
