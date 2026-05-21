import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
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
import { CustomWorkout, LibraryExercise } from '../types';
import {
  customToSession,
  defaultLibraryExercise,
  generateId,
  saveCustomWorkout,
} from '../utils/storage';
import { useApp } from '../contexts/AppContext';
import { ExerciseDef, ExerciseMuscle } from '../data/exercises';
import {
  ALL_MUSCLES,
  Location,
  findExerciseById,
  muscleFR,
  searchExercises,
} from '../services/exercises';
import { AnimatedExerciseImage } from '../components/ExerciseCard';
import ExerciseDetailModal from '../components/ExerciseDetailModal';

const LOCATIONS: { key: Location; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'any',  label: 'Tout',   icon: 'apps-outline' },
  { key: 'home', label: 'Maison', icon: 'home-outline' },
  { key: 'gym',  label: 'Salle',  icon: 'barbell-outline' },
];

export default function WorkoutBuilderScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { playFx } = useApp();

  const existing: CustomWorkout | undefined = route.params?.workout;

  const [id] = useState(existing?.id ?? generateId());
  const [name, setName] = useState(existing?.name ?? '');
  const [focus, setFocus] = useState(existing?.focus ?? '');
  const [exercises, setExercises] = useState<LibraryExercise[]>(existing?.exercises ?? []);
  const [showPicker, setShowPicker] = useState(false);
  const [detailExercise, setDetailExercise] = useState<LibraryExercise | null>(null);

  const updateExercise = (idx: number, patch: Partial<LibraryExercise>) => {
    setExercises((prev) => prev.map((ex, i) => (i === idx ? { ...ex, ...patch } : ex)));
  };

  const removeExercise = (idx: number) => {
    setExercises((prev) => prev.filter((_, i) => i !== idx));
    playFx('click');
  };

  const moveExercise = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= exercises.length) return;
    setExercises((prev) => {
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
    playFx('click');
  };

  const addFromCatalog = (def: ExerciseDef) => {
    setExercises((prev) => [
      ...prev,
      defaultLibraryExercise({
        name: def.name,
        exerciseId: def.id,
      }),
    ]);
    setShowPicker(false);
    playFx('success');
  };

  const persistAndExit = async (launchAfter: boolean) => {
    if (!name.trim()) {
      Alert.alert('Nom requis', 'Donne un nom à ta séance avant de la sauvegarder.');
      return;
    }
    if (exercises.length === 0) {
      Alert.alert('Aucun exercice', 'Ajoute au moins un exercice pour sauvegarder la séance.');
      return;
    }
    const cw: CustomWorkout = {
      id,
      name: name.trim(),
      focus: focus.trim() || 'Personnalisé',
      exercises,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveCustomWorkout(cw);
    playFx('success');
    if (launchAfter) {
      navigation.replace('LiveWorkout', { session: customToSession(cw) });
    } else {
      navigation.goBack();
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{existing ? 'ÉDITER' : 'NOUVELLE SÉANCE'}</Text>
        <TouchableOpacity onPress={() => persistAndExit(false)} hitSlop={12}>
          <Text style={styles.saveLink}>Sauver</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: SPACING.md, paddingBottom: insets.bottom + 120 }}>
        {/* Nom + focus */}
        <View style={styles.card}>
          <Text style={styles.label}>NOM</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Ex. Push lourd, Full-body maison, …"
            placeholderTextColor={COLORS.textMuted}
          />
          <Text style={[styles.label, { marginTop: SPACING.md }]}>OBJECTIF / FOCUS</Text>
          <TextInput
            style={styles.input}
            value={focus}
            onChangeText={setFocus}
            placeholder="Ex. Pectoraux & triceps, Bas du corps, …"
            placeholderTextColor={COLORS.textMuted}
          />
        </View>

        {/* Liste des exercices */}
        <View style={styles.exercisesHeader}>
          <Text style={styles.sectionTitle}>EXERCICES ({exercises.length})</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowPicker(true)}>
            <Ionicons name="add" size={18} color="#08110D" />
            <Text style={styles.addBtnText}>AJOUTER</Text>
          </TouchableOpacity>
        </View>

        {exercises.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="barbell-outline" size={32} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>Aucun exercice. Tape "Ajouter" pour piocher dans la bibliothèque.</Text>
          </View>
        )}

        {exercises.map((ex, idx) => {
          const cat = ex.exerciseId ? findExerciseById(ex.exerciseId) : undefined;
          return (
            <View key={`${ex.exerciseId ?? ex.name}-${idx}`} style={styles.exCard}>
              <View style={styles.exHeader}>
                <TouchableOpacity
                  style={styles.exTapZone}
                  onPress={() => setDetailExercise(ex)}
                  activeOpacity={0.7}
                >
                  {cat && (
                    <View style={styles.thumb}>
                      <AnimatedExerciseImage exercise={cat} height={56} rounded />
                    </View>
                  )}
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.exName} numberOfLines={2}>{ex.name}</Text>
                    {cat && (
                      <Text style={styles.exMuscles} numberOfLines={1}>
                        {cat.primaryMuscles.map(muscleFR).join(' · ')}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
                <View style={styles.reorderCol}>
                  <TouchableOpacity onPress={() => moveExercise(idx, -1)} hitSlop={6} disabled={idx === 0}>
                    <Ionicons name="chevron-up" size={18} color={idx === 0 ? COLORS.textMuted : COLORS.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => moveExercise(idx, 1)} hitSlop={6} disabled={idx === exercises.length - 1}>
                    <Ionicons name="chevron-down" size={18} color={idx === exercises.length - 1 ? COLORS.textMuted : COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => removeExercise(idx)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                </TouchableOpacity>
              </View>

              <View style={styles.metaRow}>
                <Field
                  label="SÉRIES"
                  value={String(ex.sets)}
                  onChangeText={(v) => updateExercise(idx, { sets: parseInt(v, 10) || 0 })}
                  keyboardType="numeric"
                />
                <Field
                  label="REPS"
                  value={ex.reps}
                  onChangeText={(v) => updateExercise(idx, { reps: v })}
                  placeholder="ex. 8-12"
                />
                <Field
                  label="REPOS (s)"
                  value={String(ex.rest)}
                  onChangeText={(v) => updateExercise(idx, { rest: parseInt(v, 10) || 0 })}
                  keyboardType="numeric"
                />
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Footer actions */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.sm }]}>
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => persistAndExit(false)}>
          <Text style={styles.secondaryBtnText}>SAUVEGARDER</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => persistAndExit(true)}>
          <Ionicons name="play" size={16} color="#08110D" />
          <Text style={styles.primaryBtnText}>LANCER</Text>
        </TouchableOpacity>
      </View>

      {/* Picker */}
      <ExercisePicker
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        onPick={addFromCatalog}
      />

      {/* Détail d'exercice */}
      <ExerciseDetailModal
        visible={!!detailExercise}
        onClose={() => setDetailExercise(null)}
        libraryExercise={detailExercise}
      />
    </View>
  );
}

const Field: React.FC<{ label: string; value: string; onChangeText: (v: string) => void; keyboardType?: any; placeholder?: string }> = ({
  label,
  value,
  onChangeText,
  keyboardType,
  placeholder,
}) => (
  <View style={{ flex: 1 }}>
    <Text style={styles.metaLabel}>{label}</Text>
    <TextInput
      style={styles.metaInput}
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
      placeholder={placeholder}
      placeholderTextColor={COLORS.textMuted}
    />
  </View>
);

// ── Picker en bottom-sheet ─────────────────────────────────────────────────
function ExercisePicker({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (def: ExerciseDef) => void;
}) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState<Location>('any');
  const [muscles, setMuscles] = useState<ExerciseMuscle[]>([]);

  const results = useMemo(
    () => searchExercises({ query, location, muscles, limit: 100 }),
    [query, location, muscles]
  );

  const toggleMuscle = (m: ExerciseMuscle) =>
    setMuscles((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={26} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.title}>CHOISIR UN EXERCICE</Text>
          <View style={{ width: 26 }} />
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={18} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Recherche un exercice…"
            placeholderTextColor={COLORS.textMuted}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SPACING.md, gap: 8 }} style={{ maxHeight: 40 }}>
          {LOCATIONS.map((loc) => {
            const active = location === loc.key;
            return (
              <TouchableOpacity
                key={loc.key}
                style={[styles.locChip, active && styles.locChipActive]}
                onPress={() => setLocation(loc.key)}
              >
                <Ionicons name={loc.icon} size={14} color={active ? '#08110D' : COLORS.textSecondary} />
                <Text style={[styles.locChipText, active && { color: '#08110D' }]}>{loc.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SPACING.md, gap: 6 }} style={{ maxHeight: 44, marginTop: 6 }}>
          {ALL_MUSCLES.map((m) => {
            const active = muscles.includes(m);
            return (
              <TouchableOpacity
                key={m}
                style={[styles.muscleChip, active && styles.muscleChipActive]}
                onPress={() => toggleMuscle(m)}
              >
                <Text style={[styles.muscleChipText, active && { color: '#08110D' }]}>{muscleFR(m)}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={[styles.resultCount, { paddingHorizontal: SPACING.md, marginVertical: 8 }]}>
          {results.length} résultats
        </Text>

        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: SPACING.md, paddingBottom: insets.bottom + 40 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.pickerRow} onPress={() => onPick(item)}>
              <View style={styles.pickerThumb}>
                <AnimatedExerciseImage exercise={item} height={56} rounded />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.pickerName} numberOfLines={2}>{item.name}</Text>
                <Text style={styles.pickerMuscles} numberOfLines={1}>
                  {item.primaryMuscles.map(muscleFR).join(' · ')}
                </Text>
              </View>
              <Ionicons name="add-circle" size={24} color={COLORS.primary} />
            </TouchableOpacity>
          )}
          initialNumToRender={10}
          windowSize={7}
        />
      </View>
    </Modal>
  );
}

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
  saveLink: { color: COLORS.primary, fontSize: 13, fontWeight: '800' },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
  },
  label: { color: COLORS.textMuted, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontSize: 14,
  },

  exercisesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.xl,
    marginBottom: SPACING.sm,
  },
  sectionTitle: { color: COLORS.textMuted, fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
  },
  addBtnText: { color: '#08110D', fontWeight: '900', fontSize: 11, letterSpacing: 0.8 },

  empty: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: SPACING.xl,
    padding: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  emptyText: { color: COLORS.textMuted, fontSize: 12, textAlign: 'center' },

  exCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  exHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  exTapZone: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  thumb: { width: 56, height: 56, borderRadius: RADIUS.md, overflow: 'hidden' },
  exName: { color: COLORS.text, fontWeight: '800', fontSize: 14 },
  exMuscles: { color: COLORS.textMuted, fontSize: 10, fontWeight: '700' },
  reorderCol: { alignItems: 'center', gap: 2 },

  metaRow: { flexDirection: 'row', gap: 6 },
  metaLabel: { color: COLORS.textMuted, fontSize: 9, fontWeight: '900', letterSpacing: 0.8, marginBottom: 4 },
  metaInput: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 8,
    color: COLORS.text,
    fontSize: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontWeight: '800',
    textAlign: 'center',
  },

  footer: {
    flexDirection: 'row',
    gap: 8,
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  secondaryBtnText: { color: COLORS.text, fontWeight: '800', fontSize: 12, letterSpacing: 1 },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  primaryBtnText: { color: '#08110D', fontWeight: '900', fontSize: 12, letterSpacing: 1 },

  // Picker
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: { flex: 1, color: COLORS.text, fontSize: 14 },

  locChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  locChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  locChipText: { color: COLORS.textSecondary, fontWeight: '800', fontSize: 12 },

  muscleChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  muscleChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  muscleChipText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700' },

  resultCount: { color: COLORS.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1 },

  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: SPACING.sm,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 6,
  },
  pickerThumb: { width: 56, height: 56, borderRadius: RADIUS.md, overflow: 'hidden' },
  pickerName: { color: COLORS.text, fontWeight: '800', fontSize: 13 },
  pickerMuscles: { color: COLORS.textMuted, fontSize: 10, fontWeight: '700' },
});
