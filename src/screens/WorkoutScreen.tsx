import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, SafeAreaView, Alert, Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../theme';
import { Exercise, Set } from '../types';
import { saveWorkout, generateId } from '../utils/storage';

const REST_TIMES = [30, 60, 90, 120];

export default function WorkoutScreen() {
  const navigation = useNavigation<any>();
  const [workoutName, setWorkoutName] = useState(`Workout ${new Date().toLocaleDateString('fr-CA')}`);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [restTimer, setRestTimer] = useState<number | null>(null);
  const [showRestModal, setShowRestModal] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [showAddExercise, setShowAddExercise] = useState(false);
  const intervalRef = useRef<any>(null);
  const restRef = useRef<any>(null);

  // Main timer
  useEffect(() => {
    intervalRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(intervalRef.current);
  }, []);

  // Rest timer
  useEffect(() => {
    if (restTimer === null) return;
    if (restTimer <= 0) { setRestTimer(null); setShowRestModal(false); return; }
    restRef.current = setTimeout(() => setRestTimer((t) => (t ?? 0) - 1), 1000);
    return () => clearTimeout(restRef.current);
  }, [restTimer]);

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const addExercise = () => {
    if (!newExerciseName.trim()) return;
    const ex: Exercise = {
      id: generateId(),
      name: newExerciseName.trim(),
      sets: [{ id: generateId(), reps: 10, weight: 20, completed: false }],
    };
    setExercises((prev) => [...prev, ex]);
    setNewExerciseName('');
    setShowAddExercise(false);
  };

  const addSet = (exerciseId: string) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === exerciseId
          ? { ...ex, sets: [...ex.sets, { id: generateId(), reps: 10, weight: 20, completed: false }] }
          : ex
      )
    );
  };

  const updateSet = (exId: string, setId: string, field: 'reps' | 'weight', value: string) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) return;
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === exId
          ? { ...ex, sets: ex.sets.map((s) => (s.id === setId ? { ...s, [field]: num } : s)) }
          : ex
      )
    );
  };

  const toggleSet = (exId: string, setId: string) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === exId
          ? { ...ex, sets: ex.sets.map((s) => (s.id === setId ? { ...s, completed: !s.completed } : s)) }
          : ex
      )
    );
    setRestTimer(60);
    setShowRestModal(true);
  };

  const finishWorkout = async () => {
    if (exercises.length === 0) { Alert.alert('Oops', 'Ajoute au moins un exercice.'); return; }
    await saveWorkout({
      id: generateId(),
      name: workoutName,
      date: new Date().toISOString(),
      duration: elapsed,
      exercises,
    });
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={26} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <View style={styles.timerBadge}>
          <Ionicons name="time-outline" size={14} color={COLORS.timer} />
          <Text style={styles.timerText}>{formatTime(elapsed)}</Text>
        </View>
        <TouchableOpacity style={styles.finishBtn} onPress={finishWorkout}>
          <Text style={styles.finishBtnText}>Terminer</Text>
        </TouchableOpacity>
      </View>

      {/* Workout name */}
      <TextInput
        style={styles.workoutName}
        value={workoutName}
        onChangeText={setWorkoutName}
        placeholderTextColor={COLORS.textSecondary}
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        {exercises.map((ex) => (
          <View key={ex.id} style={styles.exerciseCard}>
            <Text style={styles.exerciseName}>{ex.name}</Text>
            {/* Set header */}
            <View style={styles.setHeader}>
              <Text style={[styles.setHeaderText, { flex: 0.5 }]}>#</Text>
              <Text style={[styles.setHeaderText, { flex: 1.5 }]}>Poids (kg)</Text>
              <Text style={[styles.setHeaderText, { flex: 1.5 }]}>Reps</Text>
              <Text style={[styles.setHeaderText, { flex: 1 }]}>✓</Text>
            </View>
            {ex.sets.map((set, idx) => (
              <View key={set.id} style={[styles.setRow, set.completed && styles.setCompleted]}>
                <Text style={[styles.setNum, { flex: 0.5 }]}>{idx + 1}</Text>
                <TextInput
                  style={[styles.setInput, { flex: 1.5 }]}
                  keyboardType="numeric"
                  value={String(set.weight)}
                  onChangeText={(v) => updateSet(ex.id, set.id, 'weight', v)}
                />
                <TextInput
                  style={[styles.setInput, { flex: 1.5 }]}
                  keyboardType="numeric"
                  value={String(set.reps)}
                  onChangeText={(v) => updateSet(ex.id, set.id, 'reps', v)}
                />
                <TouchableOpacity
                  style={[styles.checkBtn, set.completed && styles.checkBtnDone]}
                  onPress={() => toggleSet(ex.id, set.id)}
                >
                  <Ionicons name={set.completed ? 'checkmark' : 'ellipse-outline'} size={20} color={set.completed ? COLORS.text : COLORS.textSecondary} />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.addSetBtn} onPress={() => addSet(ex.id)}>
              <Ionicons name="add-circle-outline" size={18} color={COLORS.primary} />
              <Text style={styles.addSetText}>Ajouter une série</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* Add exercise */}
        {showAddExercise ? (
          <View style={styles.addExerciseBox}>
            <TextInput
              style={styles.addExerciseInput}
              placeholder="Nom de l'exercice (ex: Squat)"
              placeholderTextColor={COLORS.textSecondary}
              value={newExerciseName}
              onChangeText={setNewExerciseName}
              autoFocus
            />
            <View style={styles.addExerciseRow}>
              <TouchableOpacity style={styles.confirmBtn} onPress={addExercise}>
                <Text style={styles.confirmBtnText}>Ajouter</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowAddExercise(false)}>
                <Text style={styles.cancelText}>Annuler</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.addExerciseBtn} onPress={() => setShowAddExercise(true)}>
            <Ionicons name="add-circle" size={22} color={COLORS.primary} />
            <Text style={styles.addExerciseBtnText}>Ajouter un exercice</Text>
          </TouchableOpacity>
        )}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Rest timer modal */}
      <Modal visible={showRestModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>⏱ Temps de repos</Text>
            <Text style={styles.modalTimer}>{formatTime(restTimer ?? 0)}</Text>
            <View style={styles.restOptions}>
              {REST_TIMES.map((t) => (
                <TouchableOpacity key={t} style={styles.restOption} onPress={() => setRestTimer(t)}>
                  <Text style={styles.restOptionText}>{t}s</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.skipBtn} onPress={() => { setRestTimer(null); setShowRestModal(false); }}>
              <Text style={styles.skipBtnText}>Passer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, paddingHorizontal: SPACING.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: SPACING.md },
  timerBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.surface, paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: 20 },
  timerText: { color: COLORS.timer, fontWeight: '700', fontSize: 14 },
  finishBtn: { backgroundColor: COLORS.primary, paddingHorizontal: SPACING.md, paddingVertical: 8, borderRadius: 10 },
  finishBtnText: { color: COLORS.text, fontWeight: '700', fontSize: 14 },
  workoutName: { fontSize: 22, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingBottom: SPACING.sm },
  exerciseCard: { backgroundColor: COLORS.card, borderRadius: 14, padding: SPACING.md, marginBottom: SPACING.md },
  exerciseName: { fontSize: 16, fontWeight: '700', color: COLORS.primaryLight, marginBottom: SPACING.sm },
  setHeader: { flexDirection: 'row', marginBottom: 4 },
  setHeaderText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderRadius: 8, marginBottom: 4, paddingHorizontal: 4 },
  setCompleted: { backgroundColor: COLORS.surface, opacity: 0.7 },
  setNum: { color: COLORS.textSecondary, fontSize: 14 },
  setInput: { backgroundColor: COLORS.surface, color: COLORS.text, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, fontSize: 14, marginRight: 4 },
  checkBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 4 },
  checkBtnDone: { backgroundColor: COLORS.primary, borderRadius: 8 },
  addSetBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.sm, paddingVertical: 4 },
  addSetText: { color: COLORS.primary, fontSize: 13 },
  addExerciseBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.card, borderRadius: 14, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, borderStyle: 'dashed' },
  addExerciseBtnText: { color: COLORS.primary, fontSize: 15, fontWeight: '600' },
  addExerciseBox: { backgroundColor: COLORS.card, borderRadius: 14, padding: SPACING.md, marginBottom: SPACING.md },
  addExerciseInput: { backgroundColor: COLORS.surface, color: COLORS.text, borderRadius: 10, padding: SPACING.sm, fontSize: 15, marginBottom: SPACING.sm },
  addExerciseRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  confirmBtn: { backgroundColor: COLORS.primary, paddingHorizontal: SPACING.md, paddingVertical: 8, borderRadius: 10 },
  confirmBtnText: { color: COLORS.text, fontWeight: '700' },
  cancelText: { color: COLORS.textSecondary, fontSize: 14 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalCard: { backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: SPACING.xl, alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.md },
  modalTimer: { fontSize: 64, fontWeight: '700', color: COLORS.timer, marginBottom: SPACING.lg },
  restOptions: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  restOption: { backgroundColor: COLORS.card, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: 10 },
  restOptionText: { color: COLORS.text, fontWeight: '600' },
  skipBtn: { backgroundColor: COLORS.border, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.sm, borderRadius: 10 },
  skipBtnText: { color: COLORS.textSecondary, fontWeight: '600' },
});
