import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Modal } from '../components/Modal';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SPACING, TYPE } from '../theme';
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
import { AppBackground, Glass, GlassCard } from '../components/glass';
import { Chip, PressableScale, Segmented } from '../components/ui';

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
      <StatusBar barStyle="light-content" />

      <View style={styles.topBar}>
        <IconButton icon="chevron-back" label="Retour" onPress={() => navigation.goBack()} />
        <PressableScale onPress={() => persistAndExit(false)} hitSlop={12} accessibilityRole="button">
          <Text style={styles.saveLink}>Enregistrer</Text>
        </PressableScale>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingBottom: insets.bottom + 120 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.largeTitle}>{existing ? 'Modifier la séance' : 'Nouvelle séance'}</Text>
        <Text style={styles.subtitle}>Compose ta séance à partir de la bibliothèque.</Text>

        {/* Nom + focus : tableau groupé */}
        <Glass radius={RADIUS.xl} style={styles.formCard}>
          <View style={styles.formRow}>
            <Text style={styles.formLabel}>Nom</Text>
            <TextInput
              style={styles.formInput}
              value={name}
              onChangeText={setName}
              placeholder="Ex. Push lourd, Full-body maison"
              placeholderTextColor={COLORS.textMuted}
            />
          </View>
          <View style={styles.separator} />
          <View style={styles.formRow}>
            <Text style={styles.formLabel}>Objectif</Text>
            <TextInput
              style={styles.formInput}
              value={focus}
              onChangeText={setFocus}
              placeholder="Ex. Pectoraux et triceps, Bas du corps"
              placeholderTextColor={COLORS.textMuted}
            />
          </View>
        </Glass>

        {/* Liste des exercices */}
        <View style={styles.exercisesHeader}>
          <Text style={styles.sectionTitle}>
            Exercices <Text style={styles.sectionCount}>{exercises.length}</Text>
          </Text>
          <PressableScale onPress={() => setShowPicker(true)} accessibilityRole="button" accessibilityLabel="Ajouter un exercice">
            <Glass radius={RADIUS.pill} style={styles.addBtn}>
              <Ionicons name="add" size={18} color={COLORS.primary} />
              <Text style={styles.addBtnText}>Ajouter</Text>
            </Glass>
          </PressableScale>
        </View>

        {exercises.length === 0 && (
          <GlassCard style={styles.empty}>
            <Ionicons name="barbell-outline" size={28} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>Aucun exercice</Text>
            <Text style={styles.emptyText}>Touche Ajouter pour piocher dans la bibliothèque.</Text>
          </GlassCard>
        )}

        {exercises.map((ex, idx) => {
          const cat = ex.exerciseId ? findExerciseById(ex.exerciseId) : undefined;
          const isFirst = idx === 0;
          const isLast = idx === exercises.length - 1;
          return (
            <Glass key={`${ex.exerciseId ?? ex.name}-${idx}`} radius={RADIUS.xl} style={styles.exCard}>
              <View style={styles.exHeader}>
                <View style={{ flex: 1 }}>
                  <PressableScale
                    style={styles.exTapZone}
                    onPress={() => setDetailExercise(ex)}
                    scaleTo={0.98}
                    accessibilityRole="button"
                  >
                    {cat ? (
                      <View style={styles.thumb}>
                        <AnimatedExerciseImage exercise={cat} height={52} rounded />
                      </View>
                    ) : (
                      <View style={[styles.thumb, styles.thumbPlaceholder]}>
                        <Ionicons name="barbell-outline" size={18} color={COLORS.textMuted} />
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
                  </PressableScale>
                </View>
              </View>

              <View style={styles.metaRow}>
                <Field
                  label="Séries"
                  value={String(ex.sets)}
                  onChangeText={(v) => updateExercise(idx, { sets: parseInt(v, 10) || 0 })}
                  keyboardType="numeric"
                />
                <Field
                  label="Répétitions"
                  value={ex.reps}
                  onChangeText={(v) => updateExercise(idx, { reps: v })}
                  placeholder="8-12"
                />
                <Field
                  label="Repos (s)"
                  value={String(ex.rest)}
                  onChangeText={(v) => updateExercise(idx, { rest: parseInt(v, 10) || 0 })}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.separator} />

              <View style={styles.exActions}>
                <PressableScale
                  onPress={() => moveExercise(idx, -1)}
                  disabled={isFirst}
                  hitSlop={6}
                  style={[styles.smallAction, isFirst && { opacity: 0.35 }]}
                  accessibilityLabel="Monter"
                >
                  <Ionicons name="arrow-up" size={16} color={COLORS.textSecondary} />
                  <Text style={styles.smallActionText}>Monter</Text>
                </PressableScale>
                <PressableScale
                  onPress={() => moveExercise(idx, 1)}
                  disabled={isLast}
                  hitSlop={6}
                  style={[styles.smallAction, isLast && { opacity: 0.35 }]}
                  accessibilityLabel="Descendre"
                >
                  <Ionicons name="arrow-down" size={16} color={COLORS.textSecondary} />
                  <Text style={styles.smallActionText}>Descendre</Text>
                </PressableScale>
                <View style={{ flex: 1 }} />
                <PressableScale
                  onPress={() => removeExercise(idx)}
                  hitSlop={6}
                  style={styles.smallAction}
                  accessibilityLabel="Retirer l'exercice"
                >
                  <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
                  <Text style={[styles.smallActionText, { color: COLORS.danger }]}>Retirer</Text>
                </PressableScale>
              </View>
            </Glass>
          );
        })}
      </ScrollView>

      {/* Actions du bas */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.sm }]}>
        <View style={{ flex: 1 }}>
          <PressableScale onPress={() => persistAndExit(false)} accessibilityRole="button">
            <Glass radius={RADIUS.pill} style={styles.secondaryBtn}>
              <Text style={styles.secondaryBtnText}>Enregistrer</Text>
            </Glass>
          </PressableScale>
        </View>
        <View style={{ flex: 1 }}>
          <PressableScale style={styles.primaryBtn} onPress={() => persistAndExit(true)} accessibilityRole="button">
            <Ionicons name="play" size={16} color={COLORS.onPrimary} />
            <Text style={styles.primaryBtnText}>Lancer</Text>
          </PressableScale>
        </View>
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

const IconButton: React.FC<{ icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }> = ({
  icon,
  label,
  onPress,
}) => (
  <PressableScale onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={label}>
    <Glass radius={20} style={styles.iconBtn}>
      <Ionicons name={icon} size={20} color={COLORS.text} />
    </Glass>
  </PressableScale>
);

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
      selectTextOnFocus
    />
  </View>
);

// ── Choix d'un exercice (plein écran) ──────────────────────────────────────
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
        <AppBackground />
        <StatusBar barStyle="light-content" />
        <View style={styles.topBar}>
          <IconButton icon="close" label="Fermer" onPress={onClose} />
        </View>

        <View style={{ paddingHorizontal: SPACING.lg }}>
          <Text style={styles.largeTitle}>Choisir un exercice</Text>
          <Text style={styles.subtitle}>
            {results.length} résultat{results.length > 1 ? 's' : ''}
          </Text>
        </View>

        <Glass radius={RADIUS.pill} style={styles.searchWrap}>
          <Ionicons name="search-outline" size={18} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Rechercher un exercice"
            placeholderTextColor={COLORS.textMuted}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <PressableScale onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Effacer la recherche">
              <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
            </PressableScale>
          )}
        </Glass>

        <View style={{ paddingHorizontal: SPACING.lg, marginTop: SPACING.md }}>
          <Segmented
            options={LOCATIONS.map((l) => ({ value: l.key, label: l.label }))}
            value={location}
            onChange={setLocation}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: SPACING.lg, gap: 8, alignItems: 'center' }}
          style={{ flexGrow: 0, marginTop: SPACING.md }}
        >
          {ALL_MUSCLES.map((m) => (
            <Chip key={m} label={muscleFR(m)} active={muscles.includes(m)} onPress={() => toggleMuscle(m)} />
          ))}
        </ScrollView>

        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          style={{ marginTop: SPACING.md }}
          contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingBottom: insets.bottom + 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <PressableScale onPress={() => onPick(item)} scaleTo={0.98} style={{ marginBottom: SPACING.sm }} accessibilityRole="button">
              <Glass radius={RADIUS.xl} style={styles.pickerRow}>
                <View style={styles.pickerThumb}>
                  <AnimatedExerciseImage exercise={item} height={56} rounded />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={styles.pickerName} numberOfLines={2}>{item.name}</Text>
                  <Text style={styles.pickerMuscles} numberOfLines={1}>
                    {item.primaryMuscles.map(muscleFR).join(' · ')}
                  </Text>
                </View>
                <Ionicons name="add-circle-outline" size={24} color={COLORS.primary} />
              </Glass>
            </PressableScale>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  saveLink: { color: COLORS.primary, fontSize: 17, fontWeight: '600' },

  largeTitle: { ...TYPE.largeTitle, color: COLORS.text },
  subtitle: { ...TYPE.callout, color: COLORS.textSecondary, marginTop: 2 },

  formCard: { marginTop: SPACING.lg },
  formRow: { paddingHorizontal: SPACING.lg, paddingVertical: 12 },
  formLabel: { ...TYPE.footnote, color: COLORS.textMuted, marginBottom: 2 },
  formInput: { color: COLORS.text, fontSize: 17, paddingVertical: 4 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border, marginLeft: SPACING.lg },

  exercisesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.xl,
    marginBottom: SPACING.md,
  },
  sectionTitle: { ...TYPE.title, color: COLORS.text },
  sectionCount: { color: COLORS.textMuted, fontWeight: '600' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addBtnText: { color: COLORS.text, fontSize: 15, fontWeight: '600' },

  empty: { alignItems: 'center', gap: 6, paddingVertical: SPACING.xl },
  emptyTitle: { ...TYPE.headline, color: COLORS.text, marginTop: 4 },
  emptyText: { ...TYPE.callout, color: COLORS.textSecondary, textAlign: 'center' },

  exCard: { marginBottom: SPACING.md, padding: SPACING.md, gap: SPACING.md },
  exHeader: { flexDirection: 'row', alignItems: 'center' },
  exTapZone: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 52, height: 52, borderRadius: RADIUS.md, overflow: 'hidden' },
  thumbPlaceholder: { backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' },
  exName: { ...TYPE.headline, color: COLORS.text },
  exMuscles: { ...TYPE.caption, color: COLORS.textSecondary },

  metaRow: { flexDirection: 'row', gap: SPACING.sm },
  metaLabel: { ...TYPE.footnote, color: COLORS.textMuted, marginBottom: 6, textAlign: 'center' },
  metaInput: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 10,
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },

  exActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginTop: -4 },
  smallAction: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2 },
  smallActionText: { ...TYPE.caption, color: COLORS.textSecondary },

  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
  },
  secondaryBtn: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  secondaryBtnText: { color: COLORS.text, fontSize: 17, fontWeight: '600' },
  primaryBtn: {
    flexDirection: 'row',
    paddingVertical: 16,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  primaryBtnText: { color: COLORS.onPrimary, fontSize: 17, fontWeight: '600' },

  // Picker
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.md,
    height: 46,
  },
  searchInput: { flex: 1, minWidth: 0, color: COLORS.text, fontSize: 16 },

  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, paddingRight: SPACING.md },
  pickerThumb: { width: 56, height: 56, borderRadius: RADIUS.md, overflow: 'hidden' },
  pickerName: { ...TYPE.headline, color: COLORS.text },
  pickerMuscles: { ...TYPE.caption, color: COLORS.textSecondary },
});
