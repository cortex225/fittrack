import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SPACING, TYPE } from '../theme';
import { Exercise, Set, Workout, WorkoutSession } from '../types';
import { generateId, getWorkouts, saveWorkout } from '../utils/storage';
import { findLastPerformance, findRecords, formatKg, suggestNext } from '../utils/progression';
import { useApp } from '../contexts/AppContext';
import { findExerciseById, muscleFR } from '../services/exercises';
import { AnimatedExerciseImage } from '../components/ExerciseCard';
import MuscleMap from '../components/MuscleMap';
import ExerciseDetailModal from '../components/ExerciseDetailModal';
import { Glass, GlassCard } from '../components/glass';
import { PressableScale } from '../components/ui';

// Chiffre seul (sans l'unité) pour l'afficher en grand, l'unité à côté.
const kgValue = (kg: number) => kg.toLocaleString('fr-CA');

export default function LiveWorkoutScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { addXp, playFx } = useApp();

  const session: WorkoutSession = route.params?.session;

  const [currentIdx, setCurrentIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [rest, setRest] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  const [exercises, setExercises] = useState<Exercise[]>(() =>
    session.exercises.map((ex) => {
      const cat = ex.exerciseId ? findExerciseById(ex.exerciseId) : undefined;
      return {
        id: generateId(),
        name: ex.name,
        exerciseId: ex.exerciseId,
        musclesWorked: cat ? [...cat.primaryMuscles, ...cat.secondaryMuscles] : undefined,
        sets: Array.from({ length: ex.sets }).map(() => ({
          id: generateId(),
          reps: 0,
          weight: 0,
          completed: false,
        })),
      };
    })
  );

  // Historique pour la double progression et les records.
  const [history, setHistory] = useState<Workout[]>([]);
  const [records, setRecords] = useState<{ name: string; e1rm: number }[]>([]);
  // Texte saisi pour les charges, pour pouvoir taper 62,5.
  const [weightDrafts, setWeightDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    getWorkouts().then(setHistory);
  }, []);

  const elapsedRef = useRef<any>(null);
  const restRef = useRef<any>(null);

  useEffect(() => {
    elapsedRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(elapsedRef.current);
  }, []);

  useEffect(() => {
    if (rest === null) return;
    if (rest <= 0) {
      playFx('tick');
      setRest(null);
      return;
    }
    restRef.current = setTimeout(() => setRest((r) => (r ?? 1) - 1), 1000);
    return () => clearTimeout(restRef.current);
  }, [rest, playFx]);

  const totalEx = exercises.length;
  const currentSrc = session.exercises[currentIdx];
  const currentEx = exercises[currentIdx];
  const progress = ((currentIdx + 1) / totalEx) * 100;

  const last = useMemo(
    () => (currentSrc ? findLastPerformance(history, currentSrc.name) : null),
    [history, currentSrc]
  );
  const suggestion = useMemo(() => (currentSrc ? suggestNext(currentSrc, last) : null), [currentSrc, last]);

  const fillSuggestion = () => {
    if (!suggestion) return;
    playFx('click');
    setWeightDrafts((d) => {
      const next = { ...d };
      currentEx.sets.forEach((st) => delete next[st.id]);
      return next;
    });
    setExercises((prev) =>
      prev.map((ex, i) =>
        i === currentIdx ? { ...ex, sets: ex.sets.map((st) => (st.weight ? st : { ...st, weight: suggestion.weight })) } : ex
      )
    );
  };

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const updateSet = (setIdx: number, field: 'reps' | 'weight', value: string) => {
    if (field === 'weight') {
      const id = currentEx.sets[setIdx].id;
      setWeightDrafts((d) => ({ ...d, [id]: value }));
    }
    const v = field === 'weight' ? parseFloat(value.replace(',', '.')) : parseInt(value, 10);
    setExercises((prev) =>
      prev.map((ex, i) =>
        i === currentIdx
          ? {
              ...ex,
              sets: ex.sets.map((s, j) =>
                j === setIdx ? { ...s, [field]: isNaN(v) ? 0 : v } : s
              ),
            }
          : ex
      )
    );
  };

  const toggleSet = (setIdx: number) => {
    setExercises((prev) =>
      prev.map((ex, i) => {
        if (i !== currentIdx) return ex;
        const sets = ex.sets.map((s, j) => (j === setIdx ? { ...s, completed: !s.completed } : s));
        return { ...ex, sets };
      })
    );
    const wasCompleted = currentEx.sets[setIdx].completed;
    if (!wasCompleted) {
      playFx('success');
      if (currentSrc.rest > 0) setRest(currentSrc.rest);
    }
  };

  const next = () => {
    playFx('click');
    setRest(null);
    setCurrentIdx((c) => Math.min(c + 1, totalEx - 1));
  };
  const prev = () => {
    playFx('click');
    setRest(null);
    setCurrentIdx((c) => Math.max(0, c - 1));
  };

  const finish = async () => {
    playFx('success');
    setRecords(findRecords(exercises, history));
    await saveWorkout({
      id: generateId(),
      name: session.title,
      date: new Date().toISOString(),
      duration: elapsed,
      exercises,
    });
    await addXp(250);
    setDone(true);
  };

  if (done) {
    const setsDone = exercises.reduce((n, ex) => n + ex.sets.filter((st) => st.completed).length, 0);
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" />
        <ScrollView
          contentContainerStyle={[styles.doneScroll, { paddingBottom: insets.bottom + SPACING.xl }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.doneIcon}>
            <Ionicons name="trophy-outline" size={40} color={COLORS.primary} />
          </View>
          <Text style={styles.doneTitle}>Séance terminée</Text>
          <Text style={styles.doneSub}>Ton corps te remerciera.</Text>

          <GlassCard style={styles.doneStats}>
            <View style={styles.doneStat}>
              <Text style={styles.doneStatValue}>{formatTime(elapsed)}</Text>
              <Text style={styles.doneStatLabel}>Durée</Text>
            </View>
            <View style={styles.vSep} />
            <View style={styles.doneStat}>
              <Text style={styles.doneStatValue}>{setsDone}</Text>
              <Text style={styles.doneStatLabel}>Séries faites</Text>
            </View>
            <View style={styles.vSep} />
            <View style={styles.doneStat}>
              <Text style={styles.doneStatValue}>{totalEx}</Text>
              <Text style={styles.doneStatLabel}>Exercices</Text>
            </View>
          </GlassCard>

          {records.length > 0 && (
            <Glass radius={RADIUS.xl} style={styles.recordBox}>
              <View style={styles.recordHead}>
                <Ionicons name="ribbon-outline" size={20} color={COLORS.primary} />
                <Text style={styles.recordTitle}>
                  {records.length > 1 ? 'Nouveaux records' : 'Nouveau record'}
                </Text>
              </View>
              {records.map((r) => (
                <View key={r.name}>
                  <View style={styles.hairline} />
                  <View style={styles.recordRow}>
                    <Text style={styles.recordName} numberOfLines={1}>{r.name}</Text>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.recordValue}>
                        {kgValue(r.e1rm)}
                        <Text style={styles.recordUnit}> kg</Text>
                      </Text>
                      <Text style={styles.recordHint}>1RM estimé</Text>
                    </View>
                  </View>
                </View>
              ))}
            </Glass>
          )}

          <Text style={styles.xpLine}>+250 XP gagnés</Text>

          <View style={{ alignSelf: 'stretch', marginTop: SPACING.sm }}>
            <PressableScale style={styles.primaryBtn} onPress={() => navigation.goBack()} accessibilityRole="button">
              <Text style={styles.primaryBtnText}>Fermer</Text>
            </PressableScale>
          </View>
        </ScrollView>
      </View>
    );
  }

  const cat = currentSrc.exerciseId ? findExerciseById(currentSrc.exerciseId) : undefined;
  const isLast = currentIdx === totalEx - 1;
  const restActive = rest !== null && rest > 0;
  const restRatio = restActive && currentSrc.rest > 0 ? Math.min(1, (rest as number) / currentSrc.rest) : 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />

      {/* En-tête */}
      <View style={styles.header}>
        <PressableScale onPress={() => navigation.goBack()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Quitter la séance">
          <Glass radius={20} style={styles.iconBtn}>
            <Ionicons name="close" size={20} color={COLORS.text} />
          </Glass>
        </PressableScale>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{session.title}</Text>
          <Text style={styles.headerSub}>
            Exercice {currentIdx + 1} sur {totalEx}
          </Text>
        </View>
        <Glass radius={RADIUS.pill} style={styles.timer}>
          <Text style={styles.timerText}>{formatTime(elapsed)}</Text>
        </Glass>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>

      {/* Repos : toujours visible, en gros */}
      {restActive && (
        <Glass radius={RADIUS.xl} tint={COLORS.primary} style={styles.restCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.restLabel}>Repos</Text>
            <Text style={styles.restValue}>{formatTime(rest as number)}</Text>
          </View>
          <PressableScale onPress={() => setRest(null)} accessibilityRole="button">
            <Glass radius={RADIUS.pill} style={styles.restSkip}>
              <Text style={styles.restSkipText}>Passer</Text>
            </Glass>
          </PressableScale>
          <View style={styles.restTrack}>
            <View style={[styles.restFill, { width: `${restRatio * 100}%` }]} />
          </View>
        </Glass>
      )}

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: 130 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.exTitle}>{currentSrc.name}</Text>
        <Text style={styles.exMeta}>
          {currentSrc.sets} séries · {currentSrc.reps} reps · {currentSrc.rest} s de repos
        </Text>

        {cat && (
          <PressableScale onPress={() => setShowDetail(true)} scaleTo={0.98} accessibilityRole="button" accessibilityLabel="Voir le détail de l'exercice">
            <Glass radius={RADIUS.xl} style={styles.mediaCard}>
              <AnimatedExerciseImage exercise={cat} height={190} rounded={false} />
              <View style={styles.musclesRow}>
                <MuscleMap primaryMuscles={cat.primaryMuscles} secondaryMuscles={cat.secondaryMuscles} size={34} />
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={styles.musclesHeading}>Muscles travaillés</Text>
                  <View style={styles.musclePillsRow}>
                    {cat.primaryMuscles.map((m) => (
                      <View key={`p-${m}`} style={[styles.musclePill, styles.musclePillPrimary]}>
                        <Text style={styles.musclePillPrimaryText}>{muscleFR(m)}</Text>
                      </View>
                    ))}
                    {cat.secondaryMuscles.slice(0, 3).map((m) => (
                      <View key={`s-${m}`} style={styles.musclePill}>
                        <Text style={styles.musclePillSecondaryText}>{muscleFR(m)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
                <Ionicons name="information-circle-outline" size={22} color={COLORS.textSecondary} />
              </View>
            </Glass>
          </PressableScale>
        )}

        {/* Double progression : dernière fois / aujourd'hui */}
        {last && (
          <GlassCard style={styles.progCard}>
            <View style={styles.progCols}>
              <View style={styles.progCol}>
                <Text style={styles.progLabel}>Dernière fois</Text>
                <Text style={styles.progBig}>
                  {kgValue(Math.max(...last.sets.map((x) => x.weight)))}
                  <Text style={styles.progUnit}> kg</Text>
                </Text>
                <Text style={styles.progReps}>× {last.sets.map((x) => x.reps).join(', ')}</Text>
              </View>
              {suggestion && (
                <>
                  <View style={styles.vSep} />
                  <View style={styles.progCol}>
                    <Text style={styles.progLabel}>
                      {suggestion.bumped ? 'Aujourd\'hui, charge en hausse' : 'Aujourd\'hui'}
                    </Text>
                    <Text style={[styles.progBig, suggestion.bumped && { color: COLORS.primary }]}>
                      {kgValue(suggestion.weight)}
                      <Text style={styles.progUnit}> kg</Text>
                    </Text>
                    <Text style={styles.progReps}>vise {suggestion.reps.join(' · ')}</Text>
                  </View>
                </>
              )}
            </View>
            {suggestion && (
              <PressableScale onPress={fillSuggestion} accessibilityRole="button">
                <Glass radius={RADIUS.pill} style={styles.fillBtn}>
                  <Ionicons name="arrow-down-circle-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.fillBtnText}>Remplir {formatKg(suggestion.weight)}</Text>
                </Glass>
              </PressableScale>
            )}
          </GlassCard>
        )}

        {/* Séries */}
        <Glass radius={RADIUS.xl} style={styles.setsCard}>
          <View style={styles.setsHead}>
            <Text style={[styles.setsHeadText, styles.colNum]}>Série</Text>
            <Text style={[styles.setsHeadText, styles.colInput]}>Kg</Text>
            <Text style={[styles.setsHeadText, styles.colInput]}>Reps</Text>
            <View style={styles.colCheck} />
          </View>
          {currentEx.sets.map((set, i) => (
            <View key={set.id}>
              <View style={styles.hairline} />
              <View style={styles.setRow}>
                <Text style={[styles.setNum, styles.colNum, set.completed && { color: COLORS.primary }]}>{i + 1}</Text>
                <TextInput
                  style={[styles.setInput, styles.colInput, set.completed && styles.setInputDone]}
                  keyboardType="decimal-pad"
                  placeholder={suggestion ? kgValue(suggestion.weight) : 'kg'}
                  placeholderTextColor={COLORS.textMuted}
                  value={weightDrafts[set.id] ?? (set.weight ? String(set.weight) : '')}
                  onChangeText={(v) => updateSet(i, 'weight', v)}
                  selectTextOnFocus
                  accessibilityLabel={`Charge de la série ${i + 1}`}
                />
                <TextInput
                  style={[styles.setInput, styles.colInput, set.completed && styles.setInputDone]}
                  keyboardType="numeric"
                  placeholder={suggestion ? String(suggestion.reps[i] ?? currentSrc.reps) : currentSrc.reps}
                  placeholderTextColor={COLORS.textMuted}
                  value={set.reps ? String(set.reps) : ''}
                  onChangeText={(v) => updateSet(i, 'reps', v)}
                  selectTextOnFocus
                  accessibilityLabel={`Répétitions de la série ${i + 1}`}
                />
                <View style={styles.colCheck}>
                  <PressableScale
                    onPress={() => toggleSet(i)}
                    style={[styles.checkBtn, set.completed && styles.checkBtnDone]}
                    accessibilityRole="button"
                    accessibilityState={{ checked: set.completed }}
                    accessibilityLabel={`Valider la série ${i + 1}`}
                  >
                    <Ionicons
                      name="checkmark"
                      size={22}
                      color={set.completed ? COLORS.onPrimary : COLORS.textMuted}
                    />
                  </PressableScale>
                </View>
              </View>
            </View>
          ))}
        </Glass>

        {currentSrc.execution && (
          <GlassCard style={styles.tipCard}>
            <Ionicons name="bulb-outline" size={20} color={COLORS.textSecondary} />
            <Text style={styles.tipText}>{currentSrc.execution}</Text>
          </GlassCard>
        )}
      </ScrollView>

      {/* Barre du bas */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.sm }]}>
        <PressableScale
          onPress={prev}
          disabled={currentIdx === 0}
          style={currentIdx === 0 && { opacity: 0.4 }}
          accessibilityRole="button"
          accessibilityLabel="Exercice précédent"
        >
          <Glass radius={28} strong style={styles.footerSide}>
            <Ionicons name="chevron-back" size={22} color={COLORS.text} />
          </Glass>
        </PressableScale>

        <View style={styles.footerMain}>
          {isLast ? (
            <PressableScale style={styles.primaryBtn} onPress={finish} accessibilityRole="button">
              <Text style={styles.primaryBtnText}>Terminer la séance</Text>
            </PressableScale>
          ) : (
            <PressableScale onPress={next} accessibilityRole="button">
              <Glass radius={RADIUS.pill} strong style={styles.footerNext}>
                <Text style={styles.footerNextText}>Exercice suivant</Text>
                <Ionicons name="chevron-forward" size={18} color={COLORS.text} />
              </Glass>
            </PressableScale>
          )}
        </View>

        <PressableScale
          onPress={next}
          disabled={isLast}
          style={isLast && { opacity: 0.4 }}
          accessibilityRole="button"
          accessibilityLabel="Exercice suivant"
        >
          <Glass radius={28} strong style={styles.footerSide}>
            <Ionicons name="chevron-forward" size={22} color={COLORS.text} />
          </Glass>
        </PressableScale>
      </View>

      {/* Détail d'exercice depuis l'image */}
      <ExerciseDetailModal
        visible={showDetail}
        onClose={() => setShowDetail(false)}
        libraryExercise={currentSrc}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },

  // En-tête
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
    gap: SPACING.md,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1 },
  headerTitle: { ...TYPE.headline, color: COLORS.text },
  headerSub: { ...TYPE.caption, color: COLORS.textSecondary, marginTop: 1 },
  timer: { paddingHorizontal: 14, height: 40, justifyContent: 'center' },
  timerText: { ...TYPE.number, fontSize: 20, letterSpacing: -0.4, color: COLORS.text },
  progressTrack: {
    height: 3,
    marginHorizontal: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 2 },

  // Repos
  restCard: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  restLabel: { ...TYPE.callout, color: COLORS.textSecondary },
  restValue: { ...TYPE.number, fontSize: 56, lineHeight: 62, letterSpacing: -1.5, color: COLORS.text },
  restSkip: { paddingHorizontal: SPACING.lg, paddingVertical: 12 },
  restSkipText: { color: COLORS.text, fontSize: 17, fontWeight: '600' },
  restTrack: {
    position: 'absolute',
    left: SPACING.lg,
    right: SPACING.lg,
    bottom: 12,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.surface,
    overflow: 'hidden',
  },
  restFill: { height: '100%', borderRadius: 2, backgroundColor: COLORS.primary },

  // Exercice
  exTitle: { ...TYPE.largeTitle, color: COLORS.text },
  exMeta: { ...TYPE.callout, color: COLORS.textSecondary, marginTop: 4, marginBottom: SPACING.lg },

  mediaCard: { marginBottom: SPACING.md },
  musclesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
  },
  musclesHeading: { ...TYPE.footnote, color: COLORS.textMuted },
  musclePillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  musclePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surface,
  },
  musclePillPrimary: { backgroundColor: COLORS.primarySoft },
  musclePillPrimaryText: { ...TYPE.footnote, color: COLORS.primaryLight },
  musclePillSecondaryText: { ...TYPE.footnote, color: COLORS.textSecondary },

  // Double progression
  progCard: { marginBottom: SPACING.md, gap: SPACING.md },
  progCols: { flexDirection: 'row', alignItems: 'stretch' },
  progCol: { flex: 1, paddingRight: SPACING.sm },
  progLabel: { ...TYPE.footnote, color: COLORS.textMuted },
  progBig: { ...TYPE.number, fontSize: 32, lineHeight: 38, color: COLORS.text, marginTop: 4 },
  progUnit: { fontSize: 17, fontWeight: '600', letterSpacing: 0, color: COLORS.textSecondary },
  progReps: { ...TYPE.callout, color: COLORS.textSecondary, marginTop: 2, fontVariant: ['tabular-nums'] },
  vSep: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.md,
  },
  fillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  fillBtnText: { color: COLORS.primary, fontSize: 17, fontWeight: '600' },

  // Séries : tableau groupé
  setsCard: { paddingHorizontal: SPACING.md, paddingBottom: 4 },
  setsHead: { flexDirection: 'row', alignItems: 'center', paddingTop: 14, paddingBottom: 10 },
  setsHeadText: { ...TYPE.footnote, color: COLORS.textMuted, textAlign: 'center' },
  colNum: { width: 48, textAlign: 'center' },
  colInput: { flex: 1, marginHorizontal: 5 },
  colCheck: { width: 56, alignItems: 'flex-end' },
  hairline: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  setNum: { ...TYPE.number, fontSize: 22, color: COLORS.textSecondary },
  setInput: {
    height: 54,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    color: COLORS.text,
    textAlign: 'center',
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
    paddingVertical: 0,
  },
  setInputDone: { color: COLORS.textSecondary, backgroundColor: 'transparent' },
  checkBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: COLORS.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBtnDone: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },

  tipCard: { flexDirection: 'row', gap: 12, marginTop: SPACING.md },
  tipText: { ...TYPE.body, fontSize: 15, flex: 1, color: COLORS.textSecondary, lineHeight: 21 },

  // Barre du bas
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
  },
  footerSide: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  footerMain: { flex: 1 },
  footerNext: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  footerNextText: { color: COLORS.text, fontSize: 17, fontWeight: '600' },

  primaryBtn: {
    height: 56,
    alignSelf: 'stretch',
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: COLORS.onPrimary, fontSize: 17, fontWeight: '600' },

  // Fin de séance
  doneScroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.lg, gap: SPACING.md },
  doneIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneTitle: { ...TYPE.largeTitle, color: COLORS.text, marginTop: SPACING.sm },
  doneSub: { ...TYPE.body, color: COLORS.textSecondary, marginTop: -8 },
  doneStats: { flexDirection: 'row', alignSelf: 'stretch', marginTop: SPACING.md },
  doneStat: { flex: 1, alignItems: 'center' },
  doneStatValue: { ...TYPE.number, fontSize: 26, color: COLORS.text },
  doneStatLabel: { ...TYPE.footnote, color: COLORS.textMuted, marginTop: 2 },
  recordBox: { alignSelf: 'stretch', paddingHorizontal: SPACING.lg, paddingBottom: 6 },
  recordHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14 },
  recordTitle: { ...TYPE.headline, color: COLORS.text },
  recordRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.md, paddingVertical: 12 },
  recordName: { ...TYPE.body, color: COLORS.text, flex: 1 },
  recordValue: { ...TYPE.number, fontSize: 22, color: COLORS.text },
  recordUnit: { fontSize: 15, fontWeight: '500', letterSpacing: 0, color: COLORS.textSecondary },
  recordHint: { ...TYPE.footnote, color: COLORS.textMuted },
  xpLine: { ...TYPE.caption, color: COLORS.textMuted, marginTop: SPACING.sm },
});
