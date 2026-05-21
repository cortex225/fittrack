import React, { useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SPACING } from '../theme';
import { Exercise, Set, WorkoutSession } from '../types';
import { generateId, saveWorkout } from '../utils/storage';
import { useApp } from '../contexts/AppContext';
import { findExerciseById, muscleFR } from '../services/exercises';
import { AnimatedExerciseImage } from '../components/ExerciseCard';
import MuscleMap from '../components/MuscleMap';
import ExerciseDetailModal from '../components/ExerciseDetailModal';

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

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const updateSet = (setIdx: number, field: 'reps' | 'weight', value: string) => {
    const v = parseInt(value, 10);
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
    return (
      <View style={[styles.doneRoot, { paddingTop: insets.top }]}>
        <View style={styles.doneCard}>
          <Ionicons name="trophy" size={64} color={COLORS.primary} />
          <Text style={styles.doneTitle}>TERMINÉ !</Text>
          <Text style={styles.doneSub}>Ton corps te remerciera.</Text>
          <View style={styles.xpPill}>
            <Text style={styles.xpPillBig}>+250</Text>
            <Text style={styles.xpPillSmall}>XP</Text>
          </View>
          <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.doneBtnText}>RETOUR</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Ionicons name="close" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, paddingHorizontal: SPACING.md }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{session.title.toUpperCase()}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        </View>
        <View style={styles.timer}>
          <Ionicons name="time-outline" size={12} color={COLORS.accent} />
          <Text style={styles.timerText}>{formatTime(elapsed)}</Text>
        </View>
      </View>

      {/* Rest banner */}
      {rest !== null && rest > 0 && (
        <View style={styles.restBanner}>
          <Ionicons name="timer-outline" size={20} color={COLORS.primary} />
          <Text style={styles.restText}>REPOS {rest}s</Text>
          <TouchableOpacity onPress={() => setRest(null)}>
            <Text style={styles.restSkip}>PASSER</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        contentContainerStyle={{ padding: SPACING.md, paddingBottom: 140 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {(() => {
          const cat = currentSrc.exerciseId ? findExerciseById(currentSrc.exerciseId) : undefined;
          if (cat) {
            return (
              <View style={styles.mediaBlock}>
                <TouchableOpacity
                  style={styles.mediaWrap}
                  onPress={() => setShowDetail(true)}
                  activeOpacity={0.9}
                >
                  <AnimatedExerciseImage exercise={cat} height={200} rounded />
                  <View style={styles.mediaInfoBadge}>
                    <Ionicons name="information-circle" size={18} color={COLORS.text} />
                    <Text style={styles.mediaInfoText}>DÉTAIL</Text>
                  </View>
                </TouchableOpacity>
                <View style={styles.musclesPreview}>
                  <View style={styles.muscleMapSide}>
                    <MuscleMap
                      primaryMuscles={cat.primaryMuscles}
                      secondaryMuscles={cat.secondaryMuscles}
                      size={70}
                    />
                  </View>
                  <View style={styles.musclePillsCol}>
                    <Text style={styles.musclesHeading}>MUSCLES TRAVAILLÉS</Text>
                    <View style={styles.musclePillsRow}>
                      {cat.primaryMuscles.map((m) => (
                        <View key={`p-${m}`} style={[styles.musclePill, styles.musclePillPrimary]}>
                          <Text style={styles.musclePillPrimaryText}>{muscleFR(m)}</Text>
                        </View>
                      ))}
                      {cat.secondaryMuscles.slice(0, 3).map((m) => (
                        <View key={`s-${m}`} style={[styles.musclePill, styles.musclePillSecondary]}>
                          <Text style={styles.musclePillSecondaryText}>{muscleFR(m)}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              </View>
            );
          }
          return null;
        })()}

        <Text style={styles.exTitle}>{currentSrc.name}</Text>
        <Text style={styles.exMeta}>
          {currentSrc.sets} SÉRIES · {currentSrc.reps} REPS · {currentSrc.rest}s REPOS
        </Text>

        {/* Sets */}
        <View style={{ marginTop: SPACING.lg }}>
          {currentEx.sets.map((set, i) => (
            <View key={set.id} style={[styles.setRow, set.completed && styles.setRowDone]}>
              <View style={[styles.setNum, set.completed && styles.setNumDone]}>
                <Text style={[styles.setNumText, set.completed && { color: '#08110D' }]}>
                  {i + 1}
                </Text>
              </View>
              <View style={styles.setInputWrap}>
                <Text style={styles.setInputLabel}>POIDS</Text>
                <TextInput
                  style={styles.setInput}
                  keyboardType="numeric"
                  placeholder="kg"
                  placeholderTextColor={COLORS.textMuted}
                  value={set.weight ? String(set.weight) : ''}
                  onChangeText={(v) => updateSet(i, 'weight', v)}
                />
              </View>
              <View style={styles.setInputWrap}>
                <Text style={styles.setInputLabel}>REPS</Text>
                <TextInput
                  style={styles.setInput}
                  keyboardType="numeric"
                  placeholder={currentSrc.reps}
                  placeholderTextColor={COLORS.textMuted}
                  value={set.reps ? String(set.reps) : ''}
                  onChangeText={(v) => updateSet(i, 'reps', v)}
                />
              </View>
              <TouchableOpacity
                style={[styles.checkBtn, set.completed && styles.checkBtnDone]}
                onPress={() => toggleSet(i)}
              >
                <Ionicons
                  name={set.completed ? 'checkmark' : 'ellipse-outline'}
                  size={26}
                  color={set.completed ? '#08110D' : COLORS.textSecondary}
                />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {currentSrc.execution && (
          <View style={styles.tipCard}>
            <Ionicons name="bulb" size={18} color={COLORS.accent} />
            <Text style={styles.tipText}>{currentSrc.execution}</Text>
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.sm }]}>
        <TouchableOpacity
          style={styles.footerSide}
          onPress={prev}
          disabled={currentIdx === 0}
        >
          <Ionicons
            name="chevron-back"
            size={22}
            color={currentIdx === 0 ? COLORS.textMuted : COLORS.text}
          />
        </TouchableOpacity>

        {currentIdx === totalEx - 1 ? (
          <TouchableOpacity style={styles.footerMainFinish} onPress={finish}>
            <Text style={styles.footerMainFinishText}>TERMINER 🔥</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.footerMain} onPress={next}>
            <Text style={styles.footerMainText}>EXERCICE SUIVANT</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.text} />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.footerSide}
          onPress={next}
          disabled={currentIdx === totalEx - 1}
        >
          <Ionicons
            name="chevron-forward"
            size={22}
            color={currentIdx === totalEx - 1 ? COLORS.textMuted : COLORS.text}
          />
        </TouchableOpacity>
      </View>

      {/* Détail d'exercice depuis la GIF */}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: COLORS.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  progressTrack: {
    height: 4,
    backgroundColor: COLORS.surface,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressFill: { height: '100%', backgroundColor: COLORS.primary },
  timer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: `${COLORS.accent}22`,
    borderWidth: 1,
    borderColor: `${COLORS.accent}44`,
  },
  timerText: { color: COLORS.accent, fontWeight: '800', fontSize: 11 },

  restBanner: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    backgroundColor: `${COLORS.primary}22`,
    borderColor: `${COLORS.primary}44`,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  restText: { color: COLORS.primary, fontWeight: '900', fontSize: 14, letterSpacing: 1, flex: 1 },
  restSkip: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 1 },

  mediaBlock: { marginBottom: SPACING.md },
  mediaWrap: {
    width: '100%',
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
    position: 'relative',
  },
  mediaInfoBadge: {
    position: 'absolute',
    bottom: SPACING.sm,
    right: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(8, 17, 13, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  mediaInfoText: { color: COLORS.text, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  musclesPreview: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.sm,
    padding: SPACING.sm,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  muscleMapSide: { width: 140, alignItems: 'center' },
  musclePillsCol: { flex: 1, gap: 6 },
  musclesHeading: { color: COLORS.textMuted, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  musclePillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  musclePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  musclePillPrimary: { backgroundColor: `${COLORS.primary}22`, borderColor: COLORS.primary },
  musclePillSecondary: { backgroundColor: COLORS.surface, borderColor: COLORS.border },
  musclePillPrimaryText: { color: COLORS.primary, fontSize: 10, fontWeight: '800' },
  musclePillSecondaryText: { color: COLORS.textSecondary, fontSize: 10, fontWeight: '700' },

  exTitle: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginTop: SPACING.md,
  },
  exMeta: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textAlign: 'center',
    marginTop: 6,
  },

  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.card,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 8,
  },
  setRowDone: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}11`,
  },
  setNum: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setNumDone: { backgroundColor: COLORS.primary },
  setNumText: { color: COLORS.textSecondary, fontWeight: '900', fontSize: 16 },
  setInputWrap: { flex: 1, position: 'relative' },
  setInputLabel: {
    position: 'absolute',
    top: 4,
    left: 8,
    color: COLORS.textMuted,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
    zIndex: 2,
  },
  setInput: {
    height: 48,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    color: COLORS.text,
    textAlign: 'center',
    fontWeight: '900',
    fontSize: 16,
    paddingTop: 14,
  },
  checkBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBtnDone: { backgroundColor: COLORS.primary },

  tipCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tipText: { flex: 1, color: COLORS.textSecondary, fontSize: 13, lineHeight: 18 },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 8,
    padding: SPACING.md,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  footerSide: {
    width: 56,
    height: 56,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerMain: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
  },
  footerMainText: { color: COLORS.text, fontWeight: '900', fontSize: 13, letterSpacing: 1 },
  footerMainFinish: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
  },
  footerMainFinishText: { color: '#08110D', fontWeight: '900', fontSize: 14, letterSpacing: 1 },

  doneRoot: { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  doneCard: { alignItems: 'center', gap: SPACING.md, maxWidth: 320 },
  doneTitle: { color: COLORS.text, fontSize: 44, fontWeight: '900', letterSpacing: -0.5 },
  doneSub: { color: COLORS.textMuted, fontSize: 12, letterSpacing: 1.5, fontWeight: '700' },
  xpPill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    backgroundColor: COLORS.card,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.primary,
    marginTop: SPACING.md,
  },
  xpPillBig: { color: COLORS.primary, fontSize: 36, fontWeight: '900' },
  xpPillSmall: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  doneBtn: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  doneBtnText: { color: '#08110D', fontWeight: '900', fontSize: 14, letterSpacing: 1 },
});
