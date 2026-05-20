import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, SafeAreaView, StatusBar,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../theme';
import { Workout } from '../types';
import { getWorkouts, formatDate, formatDuration } from '../utils/storage';

export default function HistoryScreen() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);

  useFocusEffect(
    useCallback(() => {
      getWorkouts().then(setWorkouts);
    }, [])
  );

  const totalVolume = (workout: Workout) =>
    workout.exercises.reduce(
      (acc, ex) => acc + ex.sets.filter(s => s.completed).reduce((a, s) => a + s.reps * s.weight, 0),
      0
    );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <Text style={styles.title}>Historique</Text>
      {workouts.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="calendar-outline" size={64} color={COLORS.border} />
          <Text style={styles.emptyText}>Aucun workout enregistré</Text>
        </View>
      ) : (
        <FlatList
          data={workouts}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.cardName}>{item.name}</Text>
                <Text style={styles.cardDate}>{formatDate(item.date)}</Text>
              </View>
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Ionicons name="time-outline" size={14} color={COLORS.primary} />
                  <Text style={styles.statText}>{formatDuration(item.duration)}</Text>
                </View>
                <View style={styles.stat}>
                  <Ionicons name="barbell-outline" size={14} color={COLORS.primary} />
                  <Text style={styles.statText}>{item.exercises.length} exercices</Text>
                </View>
                <View style={styles.stat}>
                  <Ionicons name="trending-up-outline" size={14} color={COLORS.accent} />
                  <Text style={styles.statText}>{totalVolume(item)} kg vol.</Text>
                </View>
              </View>
              {/* Exercises list */}
              {item.exercises.map((ex) => (
                <View key={ex.id} style={styles.exRow}>
                  <Text style={styles.exName}>{ex.name}</Text>
                  <Text style={styles.exSets}>
                    {ex.sets.filter(s => s.completed).length}/{ex.sets.length} séries
                  </Text>
                </View>
              ))}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, paddingHorizontal: SPACING.md },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.text, marginTop: SPACING.md, marginBottom: SPACING.lg },
  card: { backgroundColor: COLORS.card, borderRadius: 14, padding: SPACING.md, marginBottom: SPACING.sm },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  cardName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  cardDate: { fontSize: 12, color: COLORS.textSecondary },
  statsRow: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.sm },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 12, color: COLORS.textSecondary },
  exRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderTopWidth: 1, borderTopColor: COLORS.border },
  exName: { fontSize: 13, color: COLORS.text },
  exSets: { fontSize: 13, color: COLORS.textSecondary },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
  emptyText: { color: COLORS.textSecondary, fontSize: 16 },
});
