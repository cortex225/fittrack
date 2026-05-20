import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  SafeAreaView, StatusBar, Alert,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../theme';
import { Workout } from '../types';
import { getWorkouts, deleteWorkout, formatDate, formatDuration } from '../utils/storage';

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const [workouts, setWorkouts] = useState<Workout[]>([]);

  useFocusEffect(
    useCallback(() => {
      getWorkouts().then(setWorkouts);
    }, [])
  );

  const handleDelete = (id: string) => {
    Alert.alert('Supprimer', 'Supprimer cet entraînement ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          await deleteWorkout(id);
          setWorkouts((prev) => prev.filter((w) => w.id !== id));
        },
      },
    ]);
  };

  const totalSets = workouts.reduce((acc, w) =>
    acc + w.exercises.reduce((a, e) => a + e.sets.filter(s => s.completed).length, 0), 0);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Bonjour, JL 👋</Text>
          <Text style={styles.subtitle}>{workouts.length} entraînements · {totalSets} séries</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('Workout')}
        >
          <Ionicons name="add" size={28} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      {/* Stats cards */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{workouts.length}</Text>
          <Text style={styles.statLabel}>Sessions</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{totalSets}</Text>
          <Text style={styles.statLabel}>Séries totales</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            {workouts.length > 0
              ? formatDuration(Math.round(workouts.reduce((a, w) => a + w.duration, 0) / workouts.length))
              : '—'}
          </Text>
          <Text style={styles.statLabel}>Durée moy.</Text>
        </View>
      </View>

      {/* Workout list */}
      <Text style={styles.sectionTitle}>Historique</Text>
      {workouts.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="barbell-outline" size={64} color={COLORS.border} />
          <Text style={styles.emptyText}>Aucun entraînement</Text>
          <TouchableOpacity style={styles.startBtn} onPress={() => navigation.navigate('Workout')}>
            <Text style={styles.startBtnText}>Commencer un workout</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={workouts}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onLongPress={() => handleDelete(item.id)}
            >
              <View style={styles.cardLeft}>
                <View style={styles.iconBg}>
                  <Ionicons name="barbell" size={22} color={COLORS.primary} />
                </View>
                <View>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  <Text style={styles.cardDate}>{formatDate(item.date)}</Text>
                </View>
              </View>
              <View style={styles.cardRight}>
                <Text style={styles.cardDuration}>{formatDuration(item.duration)}</Text>
                <Text style={styles.cardExercises}>{item.exercises.length} exercices</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, paddingHorizontal: SPACING.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.md, marginBottom: SPACING.lg },
  greeting: { fontSize: 24, fontWeight: '700', color: COLORS.text },
  subtitle: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  addBtn: { width: 48, height: 48, backgroundColor: COLORS.primary, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  statCard: { flex: 1, backgroundColor: COLORS.card, borderRadius: 14, padding: SPACING.md, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '700', color: COLORS.primaryLight },
  statLabel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2, textAlign: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text, marginBottom: SPACING.sm },
  card: { backgroundColor: COLORS.card, borderRadius: 14, padding: SPACING.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  iconBg: { width: 44, height: 44, backgroundColor: COLORS.surface, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  cardDate: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  cardRight: { alignItems: 'flex-end' },
  cardDuration: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
  cardExercises: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
  emptyText: { fontSize: 16, color: COLORS.textSecondary },
  startBtn: { backgroundColor: COLORS.primary, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.sm + 4, borderRadius: 12 },
  startBtnText: { color: COLORS.text, fontWeight: '700', fontSize: 15 },
});
