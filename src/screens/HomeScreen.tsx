import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  Alert,
  Platform,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../theme';
import { Workout, GoalType } from '../types';
import {
  getWorkouts,
  deleteWorkout,
  formatDate,
  formatDuration,
  getProfile,
  saveProfile,
  GOAL_CONFIGS,
} from '../utils/storage';

const GOALS: GoalType[] = ['cut', 'maintain', 'bulk'];

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [currentGoal, setCurrentGoal] = useState<GoalType>('maintain');

  const loadData = useCallback(async () => {
    const [ws, profile] = await Promise.all([getWorkouts(), getProfile()]);
    setWorkouts(ws.slice().reverse());
    if (profile?.goal) {
      setCurrentGoal(profile.goal);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleGoalChange = async (goal: GoalType) => {
    setCurrentGoal(goal);
    const profile = await getProfile();
    await saveProfile({ ...(profile ?? {}), goal });
  };

  const handleDeleteWorkout = (workout: Workout) => {
    Alert.alert(
      'Supprimer la séance',
      `Supprimer "${workout.name}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            await deleteWorkout(workout.id);
            loadData();
          },
        },
      ]
    );
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalSessions = workouts.length;
  const totalSeries = workouts.reduce(
    (acc, w) =>
      acc +
      w.exercises.reduce((ea, ex) => ea + (ex.sets?.length ?? 0), 0),
    0
  );
  const avgDuration =
    workouts.length > 0
      ? Math.round(
          workouts.reduce((acc, w) => acc + (w.duration ?? 0), 0) /
            workouts.length
        )
      : 0;

  // ── Render helpers ─────────────────────────────────────────────────────────
  const renderStatCard = (label: string, value: string | number, icon: string) => (
    <View style={styles.statCard} key={label}>
      <Ionicons name={icon as any} size={22} color={COLORS.primary} style={styles.statIcon} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  const renderWorkout = ({ item }: { item: Workout }) => {
    const totalSets = item.exercises.reduce(
      (acc, ex) => acc + (ex.sets?.length ?? 0),
      0
    );
    return (
      <TouchableOpacity
        style={styles.workoutCard}
        onPress={() => navigation.navigate('WorkoutDetail', { workoutId: item.id })}
        onLongPress={() => handleDeleteWorkout(item)}
        activeOpacity={0.75}
      >
        <View style={styles.workoutHeader}>
          <View style={styles.workoutTitleRow}>
            <Ionicons name="barbell-outline" size={18} color={COLORS.primary} />
            <Text style={styles.workoutName} numberOfLines={1}>
              {item.name}
            </Text>
          </View>
          <Text style={styles.workoutDate}>{formatDate(item.date)}</Text>
        </View>

        <View style={styles.workoutMeta}>
          <View style={styles.workoutMetaItem}>
            <Ionicons name="layers-outline" size={14} color={COLORS.textSecondary} />
            <Text style={styles.workoutMetaText}>{totalSets} séries</Text>
          </View>
          <View style={styles.workoutMetaItem}>
            <Ionicons name="fitness-outline" size={14} color={COLORS.textSecondary} />
            <Text style={styles.workoutMetaText}>
              {item.exercises.length} exercice{item.exercises.length !== 1 ? 's' : ''}
            </Text>
          </View>
          {!!item.duration && (
            <View style={styles.workoutMetaItem}>
              <Ionicons name="time-outline" size={14} color={COLORS.textSecondary} />
              <Text style={styles.workoutMetaText}>{formatDuration(item.duration)}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const ListHeader = () => (
    <>
      {/* Goal switcher */}
      <View style={styles.goalSection}>
        <Text style={styles.sectionTitle}>Objectif</Text>
        <View style={styles.goalRow}>
          {GOALS.map((goal) => {
            const cfg = GOAL_CONFIGS[goal];
            const active = currentGoal === goal;
            return (
              <TouchableOpacity
                key={goal}
                style={[
                  styles.goalButton,
                  active && { backgroundColor: cfg.color, borderColor: cfg.color },
                ]}
                onPress={() => handleGoalChange(goal)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.goalButtonText,
                    active && styles.goalButtonTextActive,
                  ]}
                >
                  {cfg.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        {renderStatCard('Sessions', totalSessions, 'calendar-outline')}
        {renderStatCard('Séries totales', totalSeries, 'layers-outline')}
        {renderStatCard(
          'Durée moy.',
          avgDuration > 0 ? formatDuration(avgDuration) : '—',
          'time-outline'
        )}
      </View>

      {/* Recent workouts heading */}
      <Text style={styles.sectionTitle}>Séances récentes</Text>
    </>
  );

  const ListEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="barbell-outline" size={56} color={COLORS.border} />
      <Text style={styles.emptyTitle}>Aucune séance</Text>
      <Text style={styles.emptySubtitle}>
        Appuie sur + pour enregistrer ta première séance
      </Text>
    </View>
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        <View>
          <Text style={styles.headerTitle}>FitTrack</Text>
          <Text style={styles.headerSub}>Bienvenue 💪</Text>
        </View>
        <TouchableOpacity
          style={styles.profileBtn}
          onPress={() => navigation.navigate('Profile')}
          activeOpacity={0.8}
        >
          <Ionicons name="person-circle-outline" size={32} color={COLORS.primaryLight} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <FlatList
        data={workouts}
        keyExtractor={(item) => item.id}
        renderItem={renderWorkout}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + 90 },
        ]}
        showsVerticalScrollIndicator={false}
      />

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 24 }]}
        onPress={() => navigation.navigate('Workout')}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={32} color={COLORS.text} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // ── Header ─────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: 0.5,
  },
  headerSub: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  profileBtn: {
    padding: 4,
  },

  // ── List ───────────────────────────────────────────────────────────────────
  list: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
  },

  // ── Goal switcher ──────────────────────────────────────────────────────────
  goalSection: {
    marginBottom: SPACING.md,
  },
  goalRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  goalButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    alignItems: 'center',
  },
  goalButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  goalButtonTextActive: {
    color: COLORS.text,
  },

  // ── Stats ──────────────────────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statIcon: {
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },

  // ── Section title ──────────────────────────────────────────────────────────
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },

  // ── Workout card ───────────────────────────────────────────────────────────
  workoutCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  workoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  workoutTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: SPACING.sm,
  },
  workoutName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
  },
  workoutDate: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  workoutMeta: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  workoutMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  workoutMetaText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },

  // ── Empty state ────────────────────────────────────────────────────────────
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: SPACING.sm,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.border,
    textAlign: 'center',
    maxWidth: 240,
  },

  // ── FAB ────────────────────────────────────────────────────────────────────
  fab: {
    position: 'absolute',
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
  },
});
