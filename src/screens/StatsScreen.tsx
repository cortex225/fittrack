import React, { useCallback, useState } from 'react';
import {
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SPACING } from '../theme';
import { useApp } from '../contexts/AppContext';
import {
  deleteWorkout,
  formatDate,
  formatDuration,
  getTodayKey,
  getWeightHistory,
  getWorkouts,
  saveWeightEntry,
} from '../utils/storage';
import { LEVELS } from '../data/library';
import { WeightEntry, Workout } from '../types';

const BAR_HEIGHT = 96;

export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const { gamification, currentLevel, nextLevel, xpProgress, playFx } = useApp();

  const [weightInput, setWeightInput] = useState('');
  const [history, setHistory] = useState<WeightEntry[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [h, w] = await Promise.all([getWeightHistory(), getWorkouts()]);
    setHistory(h);
    setWorkouts(w);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const saveWeight = async () => {
    const v = parseFloat(weightInput);
    if (isNaN(v) || v <= 0) {
      Alert.alert('Erreur', 'Saisis un poids valide.');
      return;
    }
    setSaving(true);
    await saveWeightEntry({ date: getTodayKey(), weight: v });
    setWeightInput('');
    playFx('success');
    await load();
    setSaving(false);
  };

  const removeWorkout = (w: Workout) => {
    Alert.alert('Supprimer ?', `Supprimer "${w.name}" de l'historique ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          await deleteWorkout(w.id);
          await load();
        },
      },
    ]);
  };

  const last10 = history.slice(-10);
  const weights = last10.map((e) => e.weight);
  const minW = weights.length ? Math.min(...weights) : 0;
  const maxW = weights.length ? Math.max(...weights) : 0;
  const span = Math.max(1, maxW - minW);

  const barHeight = (w: number) => {
    if (weights.length <= 1) return BAR_HEIGHT * 0.6;
    return ((w - minW) / span) * (BAR_HEIGHT * 0.7) + BAR_HEIGHT * 0.3;
  };

  const totalWorkouts = workouts.length;
  const totalSets = workouts.reduce(
    (a, w) => a + w.exercises.reduce((b, e) => b + e.sets.filter((s) => s.completed).length, 0),
    0
  );
  const totalVolume = workouts.reduce(
    (a, w) =>
      a +
      w.exercises.reduce(
        (b, e) => b + e.sets.filter((s) => s.completed).reduce((c, s) => c + s.weight * s.reps, 0),
        0
      ),
    0
  );

  const formatDateLabel = (date: string) => {
    const parts = date.split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}` : date;
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      <View style={styles.header}>
        <Text style={styles.title}>Stats</Text>
        <View style={styles.levelBadge}>
          <Ionicons name="flash" size={12} color={COLORS.accent} />
          <Text style={styles.levelBadgeText}>NIV. {gamification.level}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: SPACING.md, paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
      >
        {/* XP progression */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Progression</Text>
            <Text style={styles.cardSub}>
              {currentLevel.name} → {nextLevel.name}
            </Text>
          </View>
          <View style={styles.xpRow}>
            <Text style={styles.xpCurrent}>{gamification.xp}</Text>
            <Text style={styles.xpTarget}> / {nextLevel.xpNeeded} XP</Text>
          </View>
          <View style={styles.bar}>
            <View style={[styles.barFill, { width: `${xpProgress}%`, backgroundColor: COLORS.accent }]} />
          </View>
          <View style={styles.levelLadder}>
            {LEVELS.map((l) => {
              const reached = gamification.xp >= l.xpNeeded;
              return (
                <View key={l.level} style={styles.ladderItem}>
                  <View
                    style={[
                      styles.ladderDot,
                      reached && { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
                    ]}
                  >
                    <Text style={[styles.ladderNum, reached && { color: '#08110D' }]}>{l.level}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Weight */}
        <Text style={styles.sectionTitle}>POIDS</Text>
        <View style={styles.card}>
          <View style={styles.weightInputRow}>
            <TextInput
              style={styles.weightInput}
              keyboardType="decimal-pad"
              placeholder="0.0"
              placeholderTextColor={COLORS.textMuted}
              value={weightInput}
              onChangeText={setWeightInput}
            />
            <Text style={styles.weightUnit}>kg</Text>
            <TouchableOpacity style={styles.saveBtn} onPress={saveWeight} disabled={saving}>
              <Ionicons name={saving ? 'hourglass-outline' : 'add'} size={18} color="#08110D" />
              <Text style={styles.saveBtnText}>SAUVER</Text>
            </TouchableOpacity>
          </View>

          {last10.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="analytics-outline" size={32} color={COLORS.border} />
              <Text style={styles.emptyText}>Aucune donnée de poids</Text>
            </View>
          ) : (
            <>
              <View style={styles.chart}>
                {last10.map((e, i) => (
                  <View key={e.date + i} style={styles.barCol}>
                    <Text style={styles.barLabel}>{e.weight}</Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.weightBar,
                          {
                            height: barHeight(e.weight),
                            backgroundColor: i === last10.length - 1 ? COLORS.primary : COLORS.primaryDark,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.barDate}>{formatDateLabel(e.date)}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.chartLegend}>
                <Text style={styles.chartLegendText}>
                  Min {minW} kg · Max {maxW} kg · Δ {(maxW - minW).toFixed(1)} kg
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Workouts summary */}
        <Text style={styles.sectionTitle}>ENTRAÎNEMENTS</Text>
        <View style={styles.statGrid}>
          <StatCard icon="barbell-outline" value={totalWorkouts} label="Séances" />
          <StatCard icon="repeat-outline" value={totalSets} label="Séries" />
          <StatCard
            icon="trending-up-outline"
            value={totalVolume > 999 ? `${(totalVolume / 1000).toFixed(1)}k` : totalVolume}
            label="Vol. (kg)"
          />
        </View>

        {/* Workout history */}
        {workouts.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>HISTORIQUE</Text>
            {workouts.slice(0, 10).map((w) => {
              const completedSets = w.exercises.reduce(
                (a, e) => a + e.sets.filter((s) => s.completed).length,
                0
              );
              return (
                <TouchableOpacity
                  key={w.id}
                  style={styles.workoutCard}
                  onLongPress={() => removeWorkout(w)}
                >
                  <View style={styles.workoutHeader}>
                    <Text style={styles.workoutName} numberOfLines={1}>{w.name}</Text>
                    <Text style={styles.workoutDate}>{formatDate(w.date)}</Text>
                  </View>
                  <View style={styles.workoutMeta}>
                    <Meta icon="time-outline" text={formatDuration(w.duration)} />
                    <Meta icon="fitness-outline" text={`${w.exercises.length} ex.`} />
                    <Meta icon="checkmark-outline" text={`${completedSets} séries`} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const StatCard: React.FC<{ icon: any; value: string | number; label: string }> = ({ icon, value, label }) => (
  <View style={styles.statCard}>
    <Ionicons name={icon} size={20} color={COLORS.primary} />
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const Meta: React.FC<{ icon: any; text: string }> = ({ icon, text }) => (
  <View style={styles.metaItem}>
    <Ionicons name={icon} size={12} color={COLORS.textSecondary} />
    <Text style={styles.metaText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  title: { color: COLORS.text, fontSize: 24, fontWeight: '800' },
  levelBadge: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: `${COLORS.accent}22`,
    borderColor: `${COLORS.accent}44`,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
  },
  levelBadgeText: { color: COLORS.accent, fontWeight: '900', fontSize: 11, letterSpacing: 0.8 },

  sectionTitle: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: COLORS.text, fontSize: 14, fontWeight: '800' },
  cardSub: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700' },

  xpRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: SPACING.sm },
  xpCurrent: { color: COLORS.accent, fontSize: 28, fontWeight: '900' },
  xpTarget: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '700' },
  bar: { height: 6, backgroundColor: COLORS.surface, borderRadius: 3, overflow: 'hidden', marginTop: 4 },
  barFill: { height: '100%' },
  levelLadder: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.md,
  },
  ladderItem: { alignItems: 'center' },
  ladderDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ladderNum: { color: COLORS.textSecondary, fontWeight: '800', fontSize: 10 },

  weightInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  weightInput: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '800',
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  weightUnit: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '700' },
  saveBtn: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  saveBtnText: { color: '#08110D', fontWeight: '900', fontSize: 11, letterSpacing: 0.8 },

  empty: { alignItems: 'center', padding: SPACING.lg, gap: 6 },
  emptyText: { color: COLORS.textSecondary, fontSize: 12 },

  chart: { flexDirection: 'row', justifyContent: 'space-between', height: BAR_HEIGHT + 40, marginTop: SPACING.md },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', marginHorizontal: 1 },
  barLabel: { fontSize: 9, color: COLORS.textSecondary, marginBottom: 3 },
  barTrack: { width: '100%', alignItems: 'center', justifyContent: 'flex-end', height: BAR_HEIGHT },
  weightBar: { width: '70%', borderTopLeftRadius: 4, borderTopRightRadius: 4, minHeight: 4 },
  barDate: { fontSize: 9, color: COLORS.textMuted, marginTop: 4, fontWeight: '700' },
  chartLegend: { marginTop: SPACING.sm, alignItems: 'center', borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: SPACING.sm },
  chartLegendText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '600' },

  statGrid: { flexDirection: 'row', gap: 8 },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    gap: 4,
  },
  statValue: { color: COLORS.text, fontSize: 22, fontWeight: '900' },
  statLabel: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700' },

  workoutCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 8,
  },
  workoutHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  workoutName: { color: COLORS.text, fontSize: 14, fontWeight: '800', flex: 1, marginRight: 8 },
  workoutDate: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700' },
  workoutMeta: { flexDirection: 'row', gap: SPACING.md },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: COLORS.textSecondary, fontSize: 11 },
});
