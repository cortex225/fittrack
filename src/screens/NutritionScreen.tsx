import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  StatusBar,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../theme';
import { Meal, NutritionLog } from '../types';
import { getTodayNutrition, saveNutritionLog, getProfile, generateId } from '../utils/storage';

const MEAL_CATEGORIES = [
  { key: 'breakfast', label: 'Petit-déj' },
  { key: 'lunch', label: 'Déjeuner' },
  { key: 'dinner', label: 'Dîner' },
  { key: 'snack', label: 'Collation' },
];

const WATER_TARGET = 2500;
const WATER_STEP = 250;

interface ProfileTargets {
  targetCalories?: number;
  targetProtein?: number;
  targetCarbs?: number;
  targetFats?: number;
}

const defaultTargets: ProfileTargets = {
  targetCalories: 2000,
  targetProtein: 150,
  targetCarbs: 250,
  targetFats: 65,
};

export default function NutritionScreen() {
  const insets = useSafeAreaInsets();

  const [nutritionLog, setNutritionLog] = useState<NutritionLog | null>(null);
  const [targets, setTargets] = useState<ProfileTargets>(defaultTargets);
  const [water, setWaterMl] = useState<number>(0);
  const [modalVisible, setModalVisible] = useState(false);

  const [mealName, setMealName] = useState('');
  const [mealCalories, setMealCalories] = useState('');
  const [mealProtein, setMealProtein] = useState('');
  const [mealCarbs, setMealCarbs] = useState('');
  const [mealFats, setMealFats] = useState('');
  const [mealCategory, setMealCategory] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('breakfast');

  const loadData = useCallback(async () => {
    try {
      const [log, profile] = await Promise.all([getTodayNutrition(), getProfile()]);
      setNutritionLog(log);
      if (log?.water !== undefined) {
        setWaterMl(log.water);
      }
      if (profile) {
        setTargets({
          targetCalories: profile.targetCalories ?? defaultTargets.targetCalories,
          targetProtein: profile.targetProtein ?? defaultTargets.targetProtein,
          targetCarbs: profile.targetCarbs ?? defaultTargets.targetCarbs,
          targetFats: profile.targetFats ?? defaultTargets.targetFats,
        });
      }
    } catch (e) {
      console.error('Failed to load nutrition data', e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const meals: Meal[] = nutritionLog?.meals ?? [];

  const totalCalories = meals.reduce((s, m) => s + (m.calories ?? 0), 0);
  const totalProtein = meals.reduce((s, m) => s + (m.protein ?? 0), 0);
  const totalCarbs = meals.reduce((s, m) => s + (m.carbs ?? 0), 0);
  const totalFats = meals.reduce((s, m) => s + (m.fats ?? 0), 0);

  const clampedPct = (value: number, target: number) =>
    target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;

  const calPct = clampedPct(totalCalories, targets.targetCalories ?? 2000);
  const protPct = clampedPct(totalProtein, targets.targetProtein ?? 150);
  const carbsPct = clampedPct(totalCarbs, targets.targetCarbs ?? 250);
  const fatsPct = clampedPct(totalFats, targets.targetFats ?? 65);
  const waterPct = clampedPct(water, WATER_TARGET);

  const handleAddWater = async () => {
    const newWater = water + WATER_STEP;
    setWaterMl(newWater);
    try {
      const updated: NutritionLog = {
        ...(nutritionLog ?? { date: new Date().toISOString().split('T')[0], meals: [] }),
        water: newWater,
      };
      await saveNutritionLog(updated);
      setNutritionLog(updated);
    } catch (e) {
      console.error('Failed to save water', e);
    }
  };

  const resetForm = () => {
    setMealName('');
    setMealCalories('');
    setMealProtein('');
    setMealCarbs('');
    setMealFats('');
    setMealCategory('breakfast');
  };

  const handleAddMeal = async () => {
    if (!mealName.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer un nom de repas.');
      return;
    }
    const newMeal: Meal = {
      id: generateId(),
      name: mealName.trim(),
      calories: parseFloat(mealCalories) || 0,
      protein: parseFloat(mealProtein) || 0,
      carbs: parseFloat(mealCarbs) || 0,
      fats: parseFloat(mealFats) || 0,
      category: mealCategory,
    };
    const updatedMeals = [...meals, newMeal];
    const updated: NutritionLog = {
      ...(nutritionLog ?? { date: new Date().toISOString().split('T')[0], water: water }),
      meals: updatedMeals,
      water: water,
    };
    try {
      await saveNutritionLog(updated);
      setNutritionLog(updated);
      setModalVisible(false);
      resetForm();
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de sauvegarder le repas.');
    }
  };

  const getMealsByCategory = (cat: string) => meals.filter((m) => m.category === cat);

  const renderProgressBar = (
    label: string,
    value: number,
    target: number,
    pct: number,
    unit: string,
    color: string
  ) => (
    <View style={styles.macroItem} key={label}>
      <View style={styles.macroHeader}>
        <Text style={styles.macroLabel}>{label}</Text>
        <Text style={styles.macroValues}>
          <Text style={[styles.macroValueCurrent, { color }]}>{value}</Text>
          <Text style={styles.macroValueSep}>/{target}{unit}</Text>
        </Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={styles.macroPct}>{pct}%</Text>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Nutrition</Text>
        <Text style={styles.headerDate}>
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Macro Progress */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Macronutriments</Text>
          <View style={styles.card}>
            {renderProgressBar('Calories', totalCalories, targets.targetCalories ?? 2000, calPct, ' kcal', COLORS.primary)}
            {renderProgressBar('Protéines', totalProtein, targets.targetProtein ?? 150, protPct, 'g', COLORS.success)}
            {renderProgressBar('Glucides', totalCarbs, targets.targetCarbs ?? 250, carbsPct, 'g', COLORS.accent)}
            {renderProgressBar('Lipides', totalFats, targets.targetFats ?? 65, fatsPct, 'g', '#FFB74D')}
          </View>
        </View>

        {/* Water Tracker */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hydratation</Text>
          <View style={styles.card}>
            <View style={styles.waterRow}>
              <View style={styles.waterInfo}>
                <Ionicons name="water" size={22} color="#42A5F5" />
                <Text style={styles.waterText}>
                  <Text style={styles.waterCurrent}>{water}</Text>
                  <Text style={styles.waterTarget}> / {WATER_TARGET} ml</Text>
                </Text>
              </View>
              <TouchableOpacity style={styles.waterBtn} onPress={handleAddWater}>
                <Ionicons name="add" size={16} color={COLORS.text} />
                <Text style={styles.waterBtnText}>+250 ml</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${waterPct}%` as any, backgroundColor: '#42A5F5' },
                ]}
              />
            </View>
            <Text style={styles.macroPct}>{waterPct}%</Text>
          </View>
        </View>

        {/* Meals by Category */}
        {MEAL_CATEGORIES.map(({ key, label }) => {
          const categoryMeals = getMealsByCategory(key);
          return (
            <View style={styles.section} key={key}>
              <Text style={styles.sectionTitle}>{label}</Text>
              <View style={styles.card}>
                {categoryMeals.length === 0 ? (
                  <Text style={styles.emptyText}>Aucun repas ajouté</Text>
                ) : (
                  categoryMeals.map((meal) => (
                    <View style={styles.mealRow} key={meal.id}>
                      <View style={styles.mealLeft}>
                        <Text style={styles.mealName}>{meal.name}</Text>
                        <Text style={styles.mealMacros}>
                          P: {meal.protein}g · G: {meal.carbs}g · L: {meal.fats}g
                        </Text>
                      </View>
                      <Text style={styles.mealCalories}>{meal.calories} kcal</Text>
                    </View>
                  ))
                )}
              </View>
            </View>
          );
        })}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 80 }]}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color={COLORS.text} />
      </TouchableOpacity>

      {/* Add Meal Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setModalVisible(false);
          resetForm();
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ajouter un repas</Text>
              <TouchableOpacity
                onPress={() => {
                  setModalVisible(false);
                  resetForm();
                }}
              >
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Nom du repas *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Poulet grillé"
                placeholderTextColor={COLORS.textSecondary}
                value={mealName}
                onChangeText={setMealName}
              />

              <Text style={styles.inputLabel}>Calories (kcal)</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                placeholderTextColor={COLORS.textSecondary}
                value={mealCalories}
                onChangeText={setMealCalories}
                keyboardType="numeric"
              />

              <Text style={styles.inputLabel}>Protéines (g)</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                placeholderTextColor={COLORS.textSecondary}
                value={mealProtein}
                onChangeText={setMealProtein}
                keyboardType="numeric"
              />

              <Text style={styles.inputLabel}>Glucides (g)</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                placeholderTextColor={COLORS.textSecondary}
                value={mealCarbs}
                onChangeText={setMealCarbs}
                keyboardType="numeric"
              />

              <Text style={styles.inputLabel}>Lipides (g)</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                placeholderTextColor={COLORS.textSecondary}
                value={mealFats}
                onChangeText={setMealFats}
                keyboardType="numeric"
              />

              <Text style={styles.inputLabel}>Catégorie</Text>
              <View style={styles.categoryRow}>
                {MEAL_CATEGORIES.map(({ key, label }) => (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.categoryChip,
                      mealCategory === key && styles.categoryChipActive,
                    ]}
                    onPress={() => setMealCategory(key as any)}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        mealCategory === key && styles.categoryChipTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.saveBtn} onPress={handleAddMeal}>
                <Ionicons name="checkmark-circle" size={20} color={COLORS.text} />
                <Text style={styles.saveBtnText}>Enregistrer</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    backgroundColor: COLORS.background,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: 0.5,
  },
  headerDate: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
    letterSpacing: 0.3,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  macroItem: {
    marginBottom: SPACING.md,
  },
  macroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  macroLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  macroValues: {
    fontSize: 13,
  },
  macroValueCurrent: {
    fontWeight: '700',
    fontSize: 14,
  },
  macroValueSep: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  progressTrack: {
    height: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  macroPct: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'right',
  },
  waterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  waterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  waterText: {
    marginLeft: 6,
  },
  waterCurrent: {
    fontSize: 18,
    fontWeight: '700',
    color: '#42A5F5',
  },
  waterTarget: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  waterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 4,
  },
  waterBtnText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
  },
  mealRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  mealLeft: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  mealName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 3,
  },
  mealMacros: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  mealCalories: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: SPACING.sm,
  },
  fab: {
    position: 'absolute',
    right: SPACING.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 6,
    marginTop: SPACING.sm,
  },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 4,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
    marginBottom: SPACING.md,
  },
  categoryChip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  categoryChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryChipText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  categoryChipTextActive: {
    color: COLORS.text,
    fontWeight: '700',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
    gap: 8,
    elevation: 3,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  saveBtnText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
});
