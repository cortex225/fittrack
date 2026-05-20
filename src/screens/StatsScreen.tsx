import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../theme';
import { WeightEntry, Workout } from '../types';
import {
  getWeightHistory,
  saveWeightEntry,
  getWorkouts,
  getTodayKey,
} from '../utils/storage';

const BAR_MAX_HEIGHT = 120;

export default function StatsScreen() {
  const insets = useSafeAreaInsets();

  const [weightInput, setWeightInput] = useState('');
  const [weightHistory, setWeightHistory] = useState<WeightEntry[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const loadData = useCallback(async () => {
    const [history, allWorkouts] = await Promise.all([
      getWeightHistory(),
      getWorkouts(),
    ]);
    setWeightHistory(history);
    setWorkouts(allWorkouts);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleSaveWeight = async () => {
    const value = parseFloat(weightInput);
    if (isNaN(value) || value <= 0) return;
    setSaving(true);
    const entry: WeightEntry = {
      date: getTodayKey(),
      weight: value,
    };
    await saveWeightEntry(entry);
    setWeightInput('');
    setSaveSuccess(true);
    await loadData();
    setSaving(false);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  // --- Bar chart helpers ---
  const last10 = weightHistory.slice(-10);
  const weights = last10.map((e) => e.weight);
  const minWeight = weights.length > 0 ? Math.min(...weights) : 0;
  const maxWeight = weights.length > 0 ? Math.max(...weights) : 0;
  const weightRange = maxWeight - minWeight || 1;

  const getBarHeight = (weight: number) => {
    if (weights.length === 1) return BAR_MAX_HEIGHT * 0.6;
    return ((weight - minWeight) / weightRange) * (BAR_MAX_HEIGHT * 0.8) + BAR_MAX_HEIGHT * 0.2;
  };

  const formatDateLabel = (dateStr: string) => {
    // dateStr format: YYYY-MM-DD
    const parts = dateStr.split('-');
    if (parts.length >= 3) {
      return `${parts[2]}/${parts[1]}`;
    }
    return dateStr;
  };

  // --- Summary stats ---
  const totalWorkouts = workouts.length;

  const totalSets = workouts.reduce((acc, workout) => {
    return (
      acc +
      (workout.exercises || []).reduce((eAcc: number, exercise: any) => {
        return eAcc + (exercise.sets ? exercise.sets.length : 0);
      }, 0)
    );
  }, 0);

  const muscleGroupCount: Record<string, number> = {};
  workouts.forEach((workout) => {
    (workout.exercises || []).forEach((exercise: any) => {
      const muscle = exercise.muscleGroup || exercise.muscle || null;
      if (muscle) {
        muscleGroupCount[muscle] = (muscleGroupCount[muscle] || 0) + 1;
      }
    });
  });

  const mostTrainedMuscle =
    Object.keys(muscleGroupCount).length > 0
      ? Object.entries(muscleGroupCount).sort((a, b) => b[1] - a[1])[0][0]
      : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="bar-chart-outline" size={24} color={COLORS.primary} />
        <Text style={styles.headerTitle}>Statistiques</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Weight Input Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="scale-outline" size={16} color={COLORS.primaryLight} />
            {'  '}Poids du jour
          </Text>
          <View style={styles.weightInputRow}>
            <TextInput
              style={styles.weightInput}
              value={weightInput}
              onChangeText={setWeightInput}
              placeholder="Ex: 75.5"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="decimal-pad"
              returnKeyType="done"
            />
            <Text style={styles.weightUnit}>kg</Text>
            <TouchableOpacity
              style={[
                styles.saveButton,
                saving && styles.saveButtonDisabled,
                saveSuccess && styles.saveButtonSuccess,
              ]}
              onPress={handleSaveWeight}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saveSuccess ? (
                <Ionicons name="checkmark" size={18} color={COLORS.text} />
              ) : (
                <Text style={styles.saveButtonText}>Enregistrer</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Weight Bar Chart */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="trending-up-outline" size={16} color={COLORS.primaryLight} />
            {'  '}Historique du poids
          </Text>
          {last10.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="analytics-outline" size={32} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>Aucune donnée de poids</Text>
              <Text style={styles.emptySubText}>Commencez à enregistrer votre poids ci-dessus</Text>
            </View>
          ) : (
            <View style={styles.chartCard}>
              <View style={styles.chartBars}>
                {last10.map((entry, index) => (
                  <View key={entry.date + index} style={styles.barWrapper}>
                    <Text style={styles.barWeightLabel}>{entry.weight}</Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.bar,
                          {
                            height: getBarHeight(entry.weight),
                            backgroundColor:
                              index === last10.length - 1
                                ? COLORS.primary
                                : COLORS.primaryLight,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.barDateLabel}>{formatDateLabel(entry.date)}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.chartLegend}>
                <Text style={styles.chartLegendText}>
                  Min: {minWeight} kg{'  '}|{'  '}Max: {maxWeight} kg
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Summary Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="trophy-outline" size={16} color={COLORS.primaryLight} />
            {'  '}Résumé général
          </Text>
          <View style={styles.statsGrid}>
            {/* Total Workouts */}
            <View style={styles.statCard}>
              <View style={styles.statIconWrapper}>
                <Ionicons name="barbell-outline" size={22} color={COLORS.primary} />
              </View>
              <Text style={styles.statValue}>{totalWorkouts}</Text>
              <Text style={styles.statLabel}>Séances{'\n'}totales</Text>
            </View>

            {/* Total Sets */}
            <View style={styles.statCard}>
              <View style={styles.statIconWrapper}>
                <Ionicons name="repeat-outline" size={22} color={COLORS.primary} />
              </View>
              <Text style={styles.statValue}>{totalSets}</Text>
              <Text style={styles.statLabel}>Séries{'\n'}complétées</Text>
            </View>

            {/* Most Trained Muscle */}
            <View style={[styles.statCard, styles.statCardWide]}>
              <View style={styles.statIconWrapper}>
                <Ionicons name="body-outline" size={22} color={COLORS.primary} />
              </View>
              <Text style={styles.statValueSmall}>
                {mostTrainedMuscle ?? '—'}
              </Text>
              <Text style={styles.statLabel}>Muscle le plus{'\n'}entraîné</Text>
            </View>
          </View>
        </View>

        <View style={{ height: SPACING.xl + insets.bottom }} />
      </ScrollView>
    </View>
  );
}

const COLORS_LOCAL = {
  background: '#0F0F1A',
  surface: '#1A1A2E',
  card: '#16213E',
  primary: '#6C63FF',
  primaryLight: '#8B83FF',
  text: '#FFFFFF',
  textSecondary: '#A0A0B8',
  border: '#2A2A40',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background ?? COLORS_LOCAL.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg ?? 20,
    paddingVertical: SPACING.md ?? 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border ?? COLORS_LOCAL.border,
    backgroundColor: COLORS.surface ?? COLORS_LOCAL.surface,
    gap: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text ?? COLORS_LOCAL.text,
    letterSpacing: 0.3,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.md ?? 16,
    paddingTop: SPACING.lg ?? 20,
  },
  section: {
    marginBottom: SPACING.xl ?? 24,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textSecondary ?? COLORS_LOCAL.textSecondary,
    marginBottom: SPACING.sm ?? 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // Weight input
  weightInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card ?? COLORS_LOCAL.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border ?? COLORS_LOCAL.border,
    paddingHorizontal: SPACING.md ?? 16,
    paddingVertical: SPACING.sm ?? 10,
    gap: 8,
  },
  weightInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text ?? COLORS_LOCAL.text,
    paddingVertical: 4,
  },
  weightUnit: {
    fontSize: 16,
    color: COLORS.textSecondary ?? COLORS_LOCAL.textSecondary,
    fontWeight: '500',
    marginRight: 4,
  },
  saveButton: {
    backgroundColor: COLORS.primary ?? COLORS_LOCAL.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 110,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonSuccess: {
    backgroundColor: '#27AE60',
  },
  saveButtonText: {
    color: COLORS.text ?? COLORS_LOCAL.text,
    fontWeight: '700',
    fontSize: 14,
  },

  // Chart
  emptyCard: {
    backgroundColor: COLORS.card ?? COLORS_LOCAL.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border ?? COLORS_LOCAL.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    gap: 8,
  },
  emptyText: {
    color: COLORS.textSecondary ?? COLORS_LOCAL.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  emptySubText: {
    color: COLORS.textSecondary ?? COLORS_LOCAL.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  chartCard: {
    backgroundColor: COLORS.card ?? COLORS_LOCAL.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border ?? COLORS_LOCAL.border,
    padding: SPACING.md ?? 16,
  },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: BAR_MAX_HEIGHT + 48,
    paddingTop: 8,
  },
  barWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginHorizontal: 2,
  },
  barWeightLabel: {
    fontSize: 9,
    color: COLORS.textSecondary ?? COLORS_LOCAL.textSecondary,
    marginBottom: 3,
    textAlign: 'center',
  },
  barTrack: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: BAR_MAX_HEIGHT,
  },
  bar: {
    width: '70%',
    borderRadius: 4,
    minHeight: 4,
  },
  barDateLabel: {
    fontSize: 9,
    color: COLORS.textSecondary ?? COLORS_LOCAL.textSecondary,
    marginTop: 5,
    textAlign: 'center',
  },
  chartLegend: {
    marginTop: 8,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.border ?? COLORS_LOCAL.border,
    paddingTop: 8,
  },
  chartLegendText: {
    fontSize: 11,
    color: COLORS.textSecondary ?? COLORS_LOCAL.textSecondary,
  },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm ?? 10,
  },
  statCard: {
    flex: 1,
    minWidth: '40%',
    backgroundColor: COLORS.card ?? COLORS_LOCAL.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border ?? COLORS_LOCAL.border,
    padding: SPACING.md ?? 16,
    alignItems: 'center',
    gap: 6,
  },
  statCardWide: {
    flexBasis: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 14,
  },
  statIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: `${COLORS_LOCAL.primary}22`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text ?? COLORS_LOCAL.text,
    lineHeight: 32,
  },
  statValueSmall: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text ?? COLORS_LOCAL.text,
    textTransform: 'capitalize',
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary ?? COLORS_LOCAL.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
});
