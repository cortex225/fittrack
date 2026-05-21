import React from 'react';
import {
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SPACING } from '../theme';
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
import MuscleMap from './MuscleMap';

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
        <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={26} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.title}>EXERCICE</Text>
          <View style={{ width: 26 }} />
        </View>

        <ScrollView
          contentContainerStyle={{ padding: SPACING.md, paddingBottom: insets.bottom + 100, gap: SPACING.md }}
          showsVerticalScrollIndicator={false}
        >
          {/* Média */}
          {def ? (
            <View style={styles.mediaWrap}>
              <AnimatedExerciseImage exercise={def} height={260} rounded />
            </View>
          ) : (
            <View style={[styles.mediaWrap, styles.mediaFallback]}>
              <Ionicons name="barbell-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.mediaFallbackText}>Pas d'animation disponible</Text>
            </View>
          )}

          {/* Titre */}
          <View>
            <Text style={styles.exName}>{displayName}</Text>
            {def && (
              <View style={styles.headerMeta}>
                <View style={[styles.levelBadge, { backgroundColor: `${LEVEL_COLOR[def.level]}22`, borderColor: LEVEL_COLOR[def.level] }]}>
                  <Text style={[styles.levelBadgeText, { color: LEVEL_COLOR[def.level] }]}>{levelFR(def.level)}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="barbell-outline" size={13} color={COLORS.textSecondary} />
                  <Text style={styles.metaText}>{equipmentFR(def.equipment)}</Text>
                </View>
                {def.mechanic && (
                  <View style={styles.metaItem}>
                    <Ionicons name="git-merge-outline" size={13} color={COLORS.textSecondary} />
                    <Text style={styles.metaText}>
                      {def.mechanic === 'compound' ? 'Polyarticulaire' : 'Isolation'}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Config séance (si on vient d'une séance) */}
          {libraryExercise && (
            <View style={styles.configCard}>
              <Config label="SÉRIES" value={String(libraryExercise.sets)} />
              <View style={styles.configSep} />
              <Config label="REPS" value={libraryExercise.reps} />
              <View style={styles.configSep} />
              <Config label="REPOS" value={`${libraryExercise.rest}s`} />
            </View>
          )}

          {/* Muscle map */}
          {def && (
            <View style={styles.muscleMapCard}>
              <Text style={styles.sectionLabel}>MUSCLES TRAVAILLÉS</Text>
              <MuscleMap
                primaryMuscles={def.primaryMuscles}
                secondaryMuscles={def.secondaryMuscles}
                size={120}
              />
              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: COLORS.primary }]} />
                  <Text style={styles.legendText}>Principal</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
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
                  <View key={`s-${m}`} style={[styles.musclePill, styles.musclePillSecondary]}>
                    <Text style={styles.musclePillSecondaryText}>{muscleFR(m)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Setup */}
          {libraryExercise?.setup && (
            <Section icon="locate" title="Installation">
              <Text style={styles.bodyText}>{libraryExercise.setup}</Text>
            </Section>
          )}

          {/* Execution (priorité libraryExercise sinon instructions catalogue) */}
          {(libraryExercise?.execution || (def && def.instructions.length > 0)) && (
            <Section icon="play-circle" title="Exécution">
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
            <Section icon="warning" title="Erreurs à éviter">
              {libraryExercise.mistakes.map((m, i) => (
                <Text key={i} style={styles.bullet}>• {m}</Text>
              ))}
            </Section>
          )}

          {/* Conseil objectif */}
          {libraryExercise?.goalSpecificTip && (
            <Section icon="bulb" title="Conseil objectif">
              <Text style={styles.bodyText}>"{libraryExercise.goalSpecificTip}"</Text>
            </Section>
          )}

          {/* CTA Coach */}
          <TouchableOpacity style={styles.coachBtn} onPress={askCoach}>
            <Ionicons name="sparkles" size={18} color="#08110D" />
            <Text style={styles.coachBtnText}>DEMANDER CONSEIL AU COACH</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const Section: React.FC<{ icon: keyof typeof Ionicons.glyphMap; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <View>
    <View style={styles.sectionRow}>
      <Ionicons name={icon} size={16} color={COLORS.primary} />
      <Text style={styles.sectionLabel}>{title.toUpperCase()}</Text>
    </View>
    <View style={styles.sectionBody}>{children}</View>
  </View>
);

const Config: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.configItem}>
    <Text style={styles.configValue}>{value}</Text>
    <Text style={styles.configLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: { color: COLORS.text, fontSize: 13, fontWeight: '900', letterSpacing: 1.2 },

  mediaWrap: {
    width: '100%',
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
  },
  mediaFallback: { height: 220, alignItems: 'center', justifyContent: 'center', gap: 6 },
  mediaFallbackText: { color: COLORS.textMuted, fontSize: 11, fontWeight: '700' },

  exName: { color: COLORS.text, fontSize: 24, fontWeight: '900' },
  headerMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: SPACING.sm },
  levelBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.pill, borderWidth: 1 },
  levelBadgeText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700' },

  configCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    alignItems: 'center',
  },
  configItem: { flex: 1, alignItems: 'center' },
  configSep: { width: 1, height: 24, backgroundColor: COLORS.border },
  configValue: { color: COLORS.text, fontSize: 20, fontWeight: '900' },
  configLabel: { color: COLORS.textMuted, fontSize: 9, fontWeight: '900', letterSpacing: 1, marginTop: 2 },

  muscleMapCard: {
    padding: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  sectionLabel: { color: COLORS.textMuted, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  legendRow: { flexDirection: 'row', gap: SPACING.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700' },
  musclePillsSection: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  musclePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.pill, borderWidth: 1 },
  musclePillPrimary: { backgroundColor: `${COLORS.primary}22`, borderColor: COLORS.primary },
  musclePillSecondary: { backgroundColor: COLORS.surface, borderColor: COLORS.border },
  musclePillPrimaryText: { color: COLORS.primary, fontSize: 10, fontWeight: '800' },
  musclePillSecondaryText: { color: COLORS.textSecondary, fontSize: 10, fontWeight: '700' },

  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  sectionBody: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  bodyText: { color: COLORS.text, fontSize: 14, lineHeight: 20 },
  bullet: { color: COLORS.text, fontSize: 13, lineHeight: 18 },
  stepRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  stepNum: { color: COLORS.primary, fontWeight: '900', fontSize: 13, minWidth: 16 },
  stepText: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 18, flex: 1 },

  coachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  coachBtnText: { color: '#08110D', fontWeight: '900', fontSize: 12, letterSpacing: 1 },
});
