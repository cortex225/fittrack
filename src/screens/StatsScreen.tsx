import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SPACING, TYPE } from '../theme';
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
import MuscleSpiderChart from '../components/MuscleSpiderChart';
import { Glass } from '../components/glass';
import { Card, PressableScale, SectionLabel, Segmented } from '../components/ui';

const BAR_HEIGHT = 96;
const HAIRLINE = StyleSheet.hairlineWidth;

type Period = '7d' | '30d' | '365d' | 'all';

const PERIOD_LABELS: Record<Period, { label: string; days: number | null }> = {
  '7d':   { label: '7 jours',  days: 7 },
  '30d':  { label: '30 jours', days: 30 },
  '365d': { label: '1 an',     days: 365 },
  'all':  { label: 'Tout',     days: null },
};

const PERIOD_OPTIONS = (Object.keys(PERIOD_LABELS) as Period[]).map((p) => ({
  value: p,
  label: PERIOD_LABELS[p].label,
}));

export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { gamification, currentLevel, nextLevel, xpProgress, playFx } = useApp();

  const [weightInput, setWeightInput] = useState('');
  const [history, setHistory] = useState<WeightEntry[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [saving, setSaving] = useState(false);
  const [period, setPeriod] = useState<Period>('7d');

  // Workouts filtrés selon la période sélectionnée
  const filteredWorkouts = useMemo(() => {
    const cfg = PERIOD_LABELS[period];
    if (cfg.days === null) return workouts;
    const since = Date.now() - cfg.days * 24 * 60 * 60 * 1000;
    return workouts.filter((w) => new Date(w.date).getTime() >= since);
  }, [workouts, period]);

  // Volume par muscle agrégé pour le spider chart
  const muscleVolume = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const w of filteredWorkouts) {
      for (const ex of w.exercises) {
        const completed = ex.sets.filter((s) => s.completed).length;
        if (!ex.musclesWorked?.length) continue;
        for (const m of ex.musclesWorked) {
          acc[m] = (acc[m] ?? 0) + completed;
        }
      }
    }
    return acc;
  }, [filteredWorkouts]);

  // Top muscle group (label FR)
  const topMuscle = useMemo(() => {
    const entries = Object.entries(muscleVolume);
    if (entries.length === 0) return null;
    return entries.sort(([, a], [, b]) => b - a)[0];
  }, [muscleVolume]);

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
    const v = parseFloat(weightInput.replace(',', '.'));
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

  const totalWorkouts = filteredWorkouts.length;
  const totalSets = filteredWorkouts.reduce(
    (a, w) => a + w.exercises.reduce((b, e) => b + e.sets.filter((s) => s.completed).length, 0),
    0
  );
  const totalVolume = filteredWorkouts.reduce(
    (a, w) =>
      a +
      w.exercises.reduce(
        (b, e) => b + e.sets.filter((s) => s.completed).reduce((c, s) => c + s.weight * s.reps, 0),
        0
      ),
    0
  );
  const totalMinutes = Math.round(
    filteredWorkouts.reduce((a, w) => a + w.duration, 0) / 60
  );

  const formatDateLabel = (date: string) => {
    const parts = date.split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}` : date;
  };

  const latestWeight = last10.length ? last10[last10.length - 1].weight : null;
  const historyShown = filteredWorkouts.slice(0, 10);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: SPACING.md,
          paddingTop: SPACING.sm,
          paddingBottom: insets.bottom + 120,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Grand titre */}
        <View style={styles.header}>
          <Text style={styles.title}>Stats</Text>
          <Text style={styles.subtitle}>
            Niveau {gamification.level} · {currentLevel.name}
          </Text>
        </View>

        {/* Progression XP */}
        <Card>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>Progression</Text>
            <Text style={styles.cardSub}>
              {currentLevel.name} → {nextLevel.name}
            </Text>
          </View>
          <View style={styles.bigNumberRow}>
            <Text style={styles.bigNumber}>{gamification.xp.toLocaleString('fr-CA')}</Text>
            <Text style={styles.bigUnit}> / {nextLevel.xpNeeded.toLocaleString('fr-CA')} XP</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.trackFill, { width: `${xpProgress}%` }]} />
          </View>
          <View style={styles.levelLadder}>
            {LEVELS.map((l) => {
              const reached = gamification.xp >= l.xpNeeded;
              return (
                <View
                  key={l.level}
                  style={[styles.ladderDot, reached && styles.ladderDotReached]}
                  accessibilityLabel={`Niveau ${l.level}${reached ? ', atteint' : ''}`}
                >
                  <Text style={[styles.ladderNum, reached && { color: COLORS.onPrimary }]}>{l.level}</Text>
                </View>
              );
            })}
          </View>
        </Card>

        {/* Filtres temporels */}
        <View style={styles.periodWrap}>
          <Segmented options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
        </View>

        {/* Stats du training filtrées */}
        <Glass style={styles.statGrid}>
          <View style={styles.statRow}>
            <Stat label="Séances" value={totalWorkouts} />
            <View style={styles.vSep} />
            <Stat label="Durée" value={totalMinutes} unit="min" />
          </View>
          <View style={styles.hSep} />
          <View style={styles.statRow}>
            <Stat label="Séries" value={totalSets} />
            <View style={styles.vSep} />
            <Stat
              label="Volume"
              value={totalVolume > 999 ? `${(totalVolume / 1000).toFixed(1).replace('.', ',')} k` : totalVolume}
              unit="kg"
            />
          </View>
        </Glass>

        {/* Spider chart muscles */}
        <SectionLabel>Muscles travaillés</SectionLabel>
        <Card>
          {Object.keys(muscleVolume).length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="body-outline" size={28} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>
                Aucune séance enregistrée sur cette période. Lance une séance pour voir ton équilibre.
              </Text>
            </View>
          ) : (
            <>
              <MuscleSpiderChart muscleVolume={muscleVolume} size={280} />
              {topMuscle && (
                <View style={styles.topMuscleRow}>
                  <Text style={styles.topMuscleLabel}>Le plus travaillé</Text>
                  <Text style={styles.topMuscleValue}>
                    {topMuscle[0]}
                    <Text style={styles.topMuscleUnit}> · {topMuscle[1]} séries</Text>
                  </Text>
                </View>
              )}
            </>
          )}
        </Card>

        {/* Bilan */}
        <SectionLabel>Bilan</SectionLabel>
        <PressableScale onPress={() => navigation.navigate('CheckIn')} scaleTo={0.98} accessibilityRole="button">
          <Glass style={styles.listRow}>
            <View style={styles.rowIcon}>
              <Ionicons name="body-outline" size={20} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Bilan des 2 semaines</Text>
              <Text style={styles.rowSub}>Poids, mensurations et calories ajustées</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </Glass>
        </PressableScale>

        {/* Poids */}
        <SectionLabel>Poids</SectionLabel>
        <Card>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>Dernière pesée</Text>
            {latestWeight !== null && (
              <Text style={styles.cardSub}>{formatDateLabel(last10[last10.length - 1].date)}</Text>
            )}
          </View>
          {latestWeight !== null && (
            <View style={styles.bigNumberRow}>
              <Text style={styles.bigNumber}>{latestWeight}</Text>
              <Text style={styles.bigUnit}> kg</Text>
            </View>
          )}

          <View style={styles.weightInputRow}>
            <View style={styles.inputField}>
              <TextInput
                style={styles.weightInput}
                keyboardType="decimal-pad"
                placeholder="0,0"
                placeholderTextColor={COLORS.textMuted}
                value={weightInput}
                onChangeText={setWeightInput}
                accessibilityLabel="Poids du jour en kilogrammes"
              />
              <Text style={styles.weightUnit}>kg</Text>
            </View>
            <PressableScale
              style={[styles.primaryBtn, saving && { opacity: 0.6 }]}
              onPress={saveWeight}
              disabled={saving}
              accessibilityRole="button"
            >
              <Text style={styles.primaryBtnText}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Text>
            </PressableScale>
          </View>

          {last10.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="analytics-outline" size={28} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>Aucune donnée de poids</Text>
            </View>
          ) : (
            <>
              <View style={styles.chart}>
                {last10.map((e, i) => {
                  const last = i === last10.length - 1;
                  return (
                    <View key={e.date + i} style={styles.barCol}>
                      <Text style={[styles.barLabel, last && { color: COLORS.text }]}>{e.weight}</Text>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.weightBar,
                            {
                              height: barHeight(e.weight),
                              backgroundColor: last ? COLORS.primary : `${COLORS.primary}4D`,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.barDate}>{formatDateLabel(e.date)}</Text>
                    </View>
                  );
                })}
              </View>
              <View style={styles.chartLegend}>
                <Legend label="Min" value={`${minW} kg`} />
                <Legend label="Max" value={`${maxW} kg`} />
                <Legend label="Écart" value={`${(maxW - minW).toFixed(1).replace('.', ',')} kg`} />
              </View>
            </>
          )}
        </Card>

        {/* Historique (filtré sur la période) */}
        {filteredWorkouts.length > 0 && (
          <>
            <SectionLabel
              hint={`${filteredWorkouts.length} séance${filteredWorkouts.length > 1 ? 's' : ''}`}
            >
              Historique
            </SectionLabel>
            <Glass>
              {historyShown.map((w, idx) => {
                const completedSets = w.exercises.reduce(
                  (a, e) => a + e.sets.filter((s) => s.completed).length,
                  0
                );
                return (
                  <View key={w.id}>
                    {idx > 0 && <View style={styles.rowSep} />}
                    <PressableScale
                      style={styles.workoutRow}
                      onLongPress={() => removeWorkout(w)}
                      scaleTo={0.98}
                      accessibilityHint="Appui long pour supprimer"
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle} numberOfLines={1}>{w.name}</Text>
                        <Text style={styles.rowSub}>
                          {formatDuration(w.duration)} · {w.exercises.length} ex. · {completedSets} séries
                        </Text>
                      </View>
                      <Text style={styles.workoutDate}>{formatDate(w.date)}</Text>
                    </PressableScale>
                  </View>
                );
              })}
            </Glass>
            <Text style={styles.footnote}>Appui long sur une séance pour la supprimer.</Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const Stat: React.FC<{ label: string; value: string | number; unit?: string }> = ({ label, value, unit }) => (
  <View style={styles.statCell}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
      {value}
      {unit ? <Text style={styles.statUnit}> {unit}</Text> : null}
    </Text>
  </View>
);

const Legend: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.legendItem}>
    <Text style={styles.legendLabel}>{label}</Text>
    <Text style={styles.legendValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },

  header: { marginBottom: SPACING.lg, paddingHorizontal: SPACING.xs },
  title: { ...TYPE.largeTitle, color: COLORS.text },
  subtitle: { ...TYPE.callout, color: COLORS.textSecondary, marginTop: 2 },

  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { ...TYPE.headline, color: COLORS.text },
  cardSub: { ...TYPE.caption, color: COLORS.textSecondary },

  bigNumberRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: SPACING.sm },
  bigNumber: { ...TYPE.number, fontSize: 40, color: COLORS.text },
  bigUnit: { ...TYPE.callout, color: COLORS.textSecondary },

  track: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: SPACING.md,
  },
  trackFill: { height: '100%', borderRadius: 3, backgroundColor: COLORS.primary },
  levelLadder: { flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACING.md },
  ladderDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: HAIRLINE,
    borderColor: COLORS.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ladderDotReached: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  ladderNum: { ...TYPE.footnote, color: COLORS.textSecondary, fontVariant: ['tabular-nums'] },

  periodWrap: { marginTop: SPACING.lg, marginBottom: SPACING.md },

  statGrid: {},
  statRow: { flexDirection: 'row' },
  statCell: { flex: 1, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  statLabel: { ...TYPE.caption, color: COLORS.textSecondary },
  statValue: { ...TYPE.number, fontSize: 28, color: COLORS.text, marginTop: 2 },
  statUnit: { ...TYPE.callout, color: COLORS.textSecondary },
  hSep: { height: HAIRLINE, backgroundColor: COLORS.border, marginHorizontal: SPACING.lg },
  vSep: { width: HAIRLINE, backgroundColor: COLORS.border, marginVertical: SPACING.md },

  empty: { alignItems: 'center', paddingVertical: SPACING.lg, paddingHorizontal: SPACING.md, gap: SPACING.sm },
  emptyText: { ...TYPE.callout, fontWeight: '400', color: COLORS.textSecondary, textAlign: 'center' },

  topMuscleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: HAIRLINE,
    borderTopColor: COLORS.border,
  },
  topMuscleLabel: { ...TYPE.body, color: COLORS.textSecondary },
  topMuscleValue: { ...TYPE.headline, color: COLORS.text, textTransform: 'capitalize' },
  topMuscleUnit: { ...TYPE.callout, color: COLORS.textSecondary, textTransform: 'none' },

  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { ...TYPE.headline, color: COLORS.text },
  rowSub: { ...TYPE.caption, fontWeight: '400', color: COLORS.textSecondary, marginTop: 2 },
  rowSep: { height: HAIRLINE, backgroundColor: COLORS.border, marginLeft: SPACING.lg },

  weightInputRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.md },
  inputField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md,
    height: 48,
  },
  weightInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    paddingVertical: 0,
  },
  weightUnit: { ...TYPE.callout, color: COLORS.textSecondary },
  primaryBtn: {
    height: 48,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: COLORS.onPrimary, fontSize: 17, fontWeight: '600' },

  chart: { flexDirection: 'row', justifyContent: 'space-between', height: BAR_HEIGHT + 40, marginTop: SPACING.lg },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', marginHorizontal: 1 },
  barLabel: { fontSize: 10, fontWeight: '500', color: COLORS.textMuted, marginBottom: 4, fontVariant: ['tabular-nums'] },
  barTrack: { width: '100%', alignItems: 'center', justifyContent: 'flex-end', height: BAR_HEIGHT },
  weightBar: { width: 12, borderRadius: 6, minHeight: 6 },
  barDate: { fontSize: 10, fontWeight: '500', color: COLORS.textMuted, marginTop: 6, fontVariant: ['tabular-nums'] },
  chartLegend: {
    flexDirection: 'row',
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: HAIRLINE,
    borderTopColor: COLORS.border,
  },
  legendItem: { flex: 1 },
  legendLabel: { ...TYPE.footnote, color: COLORS.textMuted },
  legendValue: { ...TYPE.callout, color: COLORS.text, marginTop: 2, fontVariant: ['tabular-nums'] },

  workoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 14,
  },
  workoutDate: { ...TYPE.caption, color: COLORS.textMuted },
  footnote: { ...TYPE.footnote, color: COLORS.textMuted, marginTop: SPACING.sm, paddingHorizontal: SPACING.lg },
});
