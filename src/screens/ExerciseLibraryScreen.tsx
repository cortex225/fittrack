import React, { useMemo, useState } from 'react';
import {
  FlatList,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Modal } from '../components/Modal';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SPACING, TYPE } from '../theme';
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
import { AppBackground, Glass } from '../components/glass';
import { Chip, PressableScale, Segmented } from '../components/ui';

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

  const countLabel = `${results.length} exercice${results.length > 1 ? 's' : ''}`;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />

      {/* Barre du haut */}
      <View style={styles.topBar}>
        <IconButton icon="chevron-back" label="Retour" onPress={() => navigation.goBack()} />
        <View>
          <IconButton icon="options-outline" label="Filtres" onPress={() => setShowFilters(true)} />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge} pointerEvents="none">
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.titleBlock}>
        <Text style={styles.largeTitle}>Bibliothèque</Text>
        <Text style={styles.subtitle}>{countLabel}</Text>
      </View>

      {/* Recherche */}
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

      {/* Lieu (toujours visible) */}
      <View style={styles.segmentWrap}>
        <Segmented
          options={LOCATIONS.map((l) => ({ value: l.key, label: l.label }))}
          value={location}
          onChange={setLocation}
        />
      </View>

      {/* Résumé filtres actifs */}
      {activeFilterCount > 0 && (
        <View style={styles.activeFiltersRow}>
          <Text style={styles.resultCount}>
            {activeFilterCount} filtre{activeFilterCount > 1 ? 's' : ''} actif{activeFilterCount > 1 ? 's' : ''}
          </Text>
          <PressableScale onPress={resetFilters} hitSlop={8}>
            <Text style={styles.clearLink}>Effacer les filtres</Text>
          </PressableScale>
        </View>
      )}

      {/* Liste */}
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ExerciseCard exercise={item} compact onPress={() => setActive(item)} />
        )}
        contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, paddingBottom: insets.bottom + 48 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="search-outline" size={32} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>Aucun résultat</Text>
            <Text style={styles.emptyText}>Aucun exercice ne correspond aux filtres.</Text>
            <PressableScale onPress={resetFilters} accessibilityRole="button">
              <Glass radius={RADIUS.pill} style={styles.secondaryBtn}>
                <Text style={styles.secondaryBtnText}>Réinitialiser</Text>
              </Glass>
            </PressableScale>
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
          <AppBackground />
          <StatusBar barStyle="light-content" />
          <View style={styles.topBar}>
            <IconButton icon="close" label="Fermer" onPress={() => setShowFilters(false)} />
            <PressableScale onPress={resetFilters} hitSlop={12}>
              <Text style={styles.clearLink}>Tout effacer</Text>
            </PressableScale>
          </View>

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingBottom: insets.bottom + 120 }}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.largeTitle, { marginBottom: SPACING.sm }]}>Filtres</Text>

            <FilterSection title="Muscles" subtitle="Plusieurs choix possibles. Compte les muscles principaux et secondaires.">
              <View style={styles.chipsWrap}>
                {ALL_MUSCLES.map((m) => (
                  <Chip
                    key={m}
                    label={muscleFR(m)}
                    active={selectedMuscles.includes(m)}
                    onPress={() => toggle(selectedMuscles, setSelectedMuscles, m)}
                  />
                ))}
              </View>
            </FilterSection>

            <FilterSection title="Équipement" subtitle="Plusieurs choix possibles.">
              <View style={styles.chipsWrap}>
                {ALL_EQUIPMENT.map((e) => (
                  <Chip
                    key={e}
                    label={equipmentFR(e)}
                    active={selectedEquipment.includes(e)}
                    onPress={() => toggle(selectedEquipment, setSelectedEquipment, e)}
                  />
                ))}
              </View>
            </FilterSection>

            <FilterSection title="Niveau">
              <View style={styles.chipsWrap}>
                {ALL_LEVELS.map((l) => (
                  <Chip
                    key={l}
                    label={levelFR(l)}
                    active={selectedLevels.includes(l)}
                    onPress={() => toggle(selectedLevels, setSelectedLevels, l)}
                  />
                ))}
              </View>
            </FilterSection>
          </ScrollView>

          <View style={[styles.applyBar, { paddingBottom: insets.bottom + SPACING.md }]}>
            <PressableScale style={styles.applyBtn} onPress={() => setShowFilters(false)} accessibilityRole="button">
              <Text style={styles.applyBtnText}>Voir {countLabel}</Text>
            </PressableScale>
          </View>
        </View>
      </Modal>
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

const FilterSection: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({
  title,
  subtitle,
  children,
}) => (
  <View style={{ marginTop: SPACING.xl }}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
    <View style={{ marginTop: SPACING.md }}>{children}</View>
  </View>
);

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
  filterBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: COLORS.primary,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  filterBadgeText: { color: COLORS.onPrimary, fontSize: 11, fontWeight: '700' },

  titleBlock: { paddingHorizontal: SPACING.lg, marginBottom: SPACING.md },
  largeTitle: { ...TYPE.largeTitle, color: COLORS.text },
  subtitle: { ...TYPE.callout, color: COLORS.textSecondary, marginTop: 2 },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: SPACING.lg,
    paddingHorizontal: SPACING.md,
    height: 46,
  },
  searchInput: { flex: 1, minWidth: 0, color: COLORS.text, fontSize: 16 },

  segmentWrap: { paddingHorizontal: SPACING.lg, marginTop: SPACING.md },

  activeFiltersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.md,
  },
  resultCount: { ...TYPE.caption, color: COLORS.textSecondary },
  clearLink: { ...TYPE.callout, color: COLORS.primary },

  empty: { alignItems: 'center', paddingVertical: SPACING.xxl, gap: SPACING.sm },
  emptyTitle: { ...TYPE.headline, color: COLORS.text, marginTop: 4 },
  emptyText: { ...TYPE.callout, color: COLORS.textSecondary, marginBottom: SPACING.sm },

  secondaryBtn: { paddingHorizontal: SPACING.lg, paddingVertical: 12, alignItems: 'center' },
  secondaryBtnText: { color: COLORS.text, fontSize: 17, fontWeight: '600' },

  sectionTitle: { ...TYPE.headline, color: COLORS.text },
  sectionSubtitle: { ...TYPE.caption, color: COLORS.textMuted, marginTop: 4 },

  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  applyBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  applyBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
  },
  applyBtnText: { color: COLORS.onPrimary, fontSize: 17, fontWeight: '600' },
});
