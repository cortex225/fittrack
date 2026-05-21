import React, { useMemo, useState } from 'react';
import {
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
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SPACING } from '../theme';
import {
  ExerciseDef,
  ExerciseEquipment,
  ExerciseLevel,
  ExerciseMuscle,
} from '../data/exercises';
import {
  ALL_EQUIPMENT,
  ALL_LEVELS,
  ALL_MUSCLES,
  Location,
  equipmentFR,
  levelFR,
  muscleFR,
  searchExercises,
} from '../services/exercises';
import ExerciseCard from '../components/ExerciseCard';
import ExerciseDetailModal from '../components/ExerciseDetailModal';

const LOCATIONS: { key: Location; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'any',  label: 'Tout',    icon: 'apps-outline' },
  { key: 'home', label: 'Maison',  icon: 'home-outline' },
  { key: 'gym',  label: 'Salle',   icon: 'barbell-outline' },
];

export default function ExerciseLibraryScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState('');
  const [location, setLocation] = useState<Location>('any');
  const [selectedMuscles, setSelectedMuscles] = useState<ExerciseMuscle[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<NonNullable<ExerciseEquipment>[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<ExerciseLevel[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [active, setActive] = useState<ExerciseDef | null>(null);

  const results = useMemo(
    () =>
      searchExercises({
        query,
        location,
        muscles: selectedMuscles,
        equipment: selectedEquipment,
        level: selectedLevels,
      }),
    [query, location, selectedMuscles, selectedEquipment, selectedLevels]
  );

  const toggle = <T,>(list: T[], setList: (l: T[]) => void, value: T) => {
    setList(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  };

  const resetFilters = () => {
    setSelectedMuscles([]);
    setSelectedEquipment([]);
    setSelectedLevels([]);
    setLocation('any');
    setQuery('');
  };

  const activeFilterCount =
    selectedMuscles.length + selectedEquipment.length + selectedLevels.length + (location !== 'any' ? 1 : 0);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>BIBLIOTHÈQUE</Text>
        <TouchableOpacity onPress={() => setShowFilters(true)} hitSlop={12} style={styles.filterBtn}>
          <Ionicons name="options-outline" size={22} color={COLORS.text} />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Recherche */}
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

      {/* Chips lieu (toujours visibles) */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.locationRow} contentContainerStyle={{ paddingHorizontal: SPACING.md, gap: 8 }}>
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

      {/* Résumé filtres actifs */}
      {activeFilterCount > 0 && (
        <View style={styles.activeFiltersRow}>
          <Text style={styles.resultCount}>{results.length} exercice{results.length > 1 ? 's' : ''}</Text>
          <TouchableOpacity onPress={resetFilters}>
            <Text style={styles.clearLink}>Effacer les filtres</Text>
          </TouchableOpacity>
        </View>
      )}
      {activeFilterCount === 0 && (
        <Text style={[styles.resultCount, { paddingHorizontal: SPACING.md, marginVertical: 8 }]}>
          {results.length} exercice{results.length > 1 ? 's' : ''}
        </Text>
      )}

      {/* Liste */}
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ExerciseCard exercise={item} compact onPress={() => setActive(item)} />
        )}
        contentContainerStyle={{ paddingHorizontal: SPACING.md, paddingBottom: insets.bottom + 80 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="search-outline" size={32} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>Aucun exercice ne correspond aux filtres</Text>
            <TouchableOpacity onPress={resetFilters} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>RÉINITIALISER</Text>
            </TouchableOpacity>
          </View>
        }
        initialNumToRender={10}
        windowSize={7}
      />

      {/* Modal détail exercice (composant partagé) */}
      <ExerciseDetailModal
        visible={!!active}
        onClose={() => setActive(null)}
        exerciseDef={active}
      />

      {/* Modal filtres */}
      <Modal visible={showFilters} animationType="slide" onRequestClose={() => setShowFilters(false)}>
        <View style={[styles.root, { paddingTop: insets.top }]}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setShowFilters(false)} hitSlop={12}>
              <Ionicons name="close" size={26} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.title}>FILTRES</Text>
            <TouchableOpacity onPress={resetFilters} hitSlop={12}>
              <Text style={styles.clearLink}>Effacer</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: SPACING.md, paddingBottom: insets.bottom + 100, gap: SPACING.lg }}>
            <FilterSection title="MUSCLES" subtitle="Multi-sélection — match primaires OU secondaires">
              <View style={styles.chipsWrap}>
                {ALL_MUSCLES.map((m) => {
                  const active = selectedMuscles.includes(m);
                  return (
                    <TouchableOpacity
                      key={m}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => toggle(selectedMuscles, setSelectedMuscles, m)}
                    >
                      <Text style={[styles.chipText, active && { color: '#08110D' }]}>{muscleFR(m)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </FilterSection>

            <FilterSection title="ÉQUIPEMENT" subtitle="Multi-sélection">
              <View style={styles.chipsWrap}>
                {ALL_EQUIPMENT.map((e) => {
                  const active = selectedEquipment.includes(e);
                  return (
                    <TouchableOpacity
                      key={e}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => toggle(selectedEquipment, setSelectedEquipment, e)}
                    >
                      <Text style={[styles.chipText, active && { color: '#08110D' }]}>{equipmentFR(e)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </FilterSection>

            <FilterSection title="NIVEAU">
              <View style={styles.chipsWrap}>
                {ALL_LEVELS.map((l) => {
                  const active = selectedLevels.includes(l);
                  return (
                    <TouchableOpacity
                      key={l}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => toggle(selectedLevels, setSelectedLevels, l)}
                    >
                      <Text style={[styles.chipText, active && { color: '#08110D' }]}>{levelFR(l)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </FilterSection>
          </ScrollView>

          <View style={[styles.applyBar, { paddingBottom: insets.bottom + SPACING.sm }]}>
            <TouchableOpacity style={styles.applyBtn} onPress={() => setShowFilters(false)}>
              <Text style={styles.applyBtnText}>VOIR {results.length} EXERCICE{results.length > 1 ? 'S' : ''}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const FilterSection: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({
  title,
  subtitle,
  children,
}) => (
  <View>
    <Text style={styles.sectionTitle}>{title}</Text>
    {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
    <View style={{ marginTop: SPACING.sm }}>{children}</View>
  </View>
);

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
  filterBtn: { position: 'relative' },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -6,
    backgroundColor: COLORS.primary,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: { color: '#08110D', fontSize: 9, fontWeight: '900' },

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

  locationRow: { maxHeight: 40 },
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
  locChipText: { color: COLORS.textSecondary, fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },

  activeFiltersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    marginVertical: 8,
  },
  resultCount: { color: COLORS.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  clearLink: { color: COLORS.primary, fontSize: 12, fontWeight: '800' },

  empty: { alignItems: 'center', paddingVertical: SPACING.xl, gap: SPACING.md },
  emptyText: { color: COLORS.textSecondary, fontSize: 13 },

  primaryBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  primaryBtnText: { color: '#08110D', fontWeight: '900', fontSize: 12, letterSpacing: 1 },

  muscleMapCard: {
    padding: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  muscleMapTitle: { color: COLORS.textMuted, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  legendRow: { flexDirection: 'row', gap: SPACING.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700' },

  coachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  coachBtnText: { color: '#08110D', fontWeight: '900', fontSize: 12, letterSpacing: 1 },

  sectionTitle: { color: COLORS.textMuted, fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  sectionSubtitle: { color: COLORS.textMuted, fontSize: 10, marginTop: 2 },

  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700' },

  applyBar: {
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  applyBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
  },
  applyBtnText: { color: '#08110D', fontWeight: '900', fontSize: 13, letterSpacing: 1 },
});
