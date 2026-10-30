import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, RADIUS, SPACING, TYPE } from '../theme';
import { AppBackground, Glass } from '../components/glass';
import { AnimatedNumber, Card, PressableScale, Segmented } from '../components/ui';
import { useApp } from '../contexts/AppContext';
import {
  addIngredientsToShoppingList,
  generateId,
  getFavorites,
  getTodayNutrition,
  saveFavorites,
  saveNutritionLog,
} from '../utils/storage';
import { FoodConflict, Meal, MealCategory, NutritionLog, Recipe } from '../types';
import {
  MissingApiKeyError,
  analyzeFoodImage,
  generateChefRecipes,
  AnalyzedFood,
} from '../services/gemini';
import RecipeSwipeStack, { recipeImageUrl } from '../components/RecipeSwipeStack';
import {
  BlockedRecipe,
  findFoodConflicts,
  describeStrictExclusions,
  findRecipeConflicts,
  summarizeConflicts,
} from '../utils/allergens';
import { OWNER_ID } from '../utils/storage';

const MEAL_CATS: { key: MealCategory; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'breakfast', label: 'Petit-déj', icon: 'cafe-outline' },
  { key: 'lunch', label: 'Déjeuner', icon: 'sunny-outline' },
  { key: 'snack', label: 'Collation', icon: 'nutrition-outline' },
  { key: 'dinner', label: 'Dîner', icon: 'moon-outline' },
];

const DIFFICULTIES = [
  { id: 'express', label: 'Express' },
  { id: 'medium', label: 'Moyen' },
  { id: 'chef', label: 'Chef' },
];

export default function NutritionScreen() {
  const insets = useSafeAreaInsets();
  const { profile, members, playFx, addXp } = useApp();
  const route = useRoute<any>();

  const [log, setLog] = useState<NutritionLog | null>(null);
  const [favorites, setFavorites] = useState<Recipe[]>([]);

  const [manualOpen, setManualOpen] = useState(false);
  const [manualForm, setManualForm] = useState({
    name: '',
    calories: '',
    protein: '',
    carbs: '',
    fats: '',
    category: 'snack' as MealCategory,
  });

  const [scanning, setScanning] = useState(false);
  const [analyzed, setAnalyzed] = useState<AnalyzedFood | null>(null);
  const [scanImageUri, setScanImageUri] = useState<string | null>(null);
  const [pendingCategory, setPendingCategory] = useState<MealCategory>('snack');

  const [chefOpen, setChefOpen] = useState(false);
  const [chefLoading, setChefLoading] = useState(false);
  const [chefParams, setChefParams] = useState({
    category: 'lunch' as MealCategory,
    complexity: 'express',
    fridge: '',
  });
  const [chefResults, setChefResults] = useState<Recipe[] | null>(null);
  const [chefBlocked, setChefBlocked] = useState<BlockedRecipe[]>([]);
  // Qui mange ce repas : par défaut tout le foyer, pour que les allergies
  // de chacun soient toujours appliquées.
  const [dinerIds, setDinerIds] = useState<string[] | null>(null);
  const activeDinerIds = dinerIds ?? members.map((m) => m.id);
  const diners = members.filter((m) => activeDinerIds.includes(m.id));
  const toggleDiner = (id: string) => {
    if (id === OWNER_ID) return; // le propriétaire mange toujours
    setDinerIds(
      activeDinerIds.includes(id) ? activeDinerIds.filter((x) => x !== id) : [...activeDinerIds, id]
    );
  };
  const [activeRecipe, setActiveRecipe] = useState<Recipe | null>(null);

  const loadData = useCallback(async () => {
    const [n, fs] = await Promise.all([getTodayNutrition(), getFavorites()]);
    setLog(n);
    setFavorites(fs);
  }, []);

  const navigation = useNavigation<any>();

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // Deep-link depuis Dashboard : autoOpen='camera' | 'manual'
  useFocusEffect(
    useCallback(() => {
      const auto = route.params?.autoOpen;
      if (auto === 'camera') {
        pickFromCamera();
        navigation.setParams({ autoOpen: undefined });
      } else if (auto === 'manual') {
        setManualOpen(true);
        navigation.setParams({ autoOpen: undefined });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [route.params?.autoOpen])
  );

  const meals = log?.meals ?? [];
  const totals = meals.reduce(
    (acc, m) => ({
      calories: acc.calories + m.calories,
      protein: acc.protein + m.protein,
      carbs: acc.carbs + m.carbs,
      fats: acc.fats + m.fats,
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0 }
  );

  const remaining = profile.targetCalories - totals.calories;

  const persistMeals = async (nextMeals: Meal[]) => {
    const updated: NutritionLog = {
      date: log?.date ?? new Date().toISOString().split('T')[0],
      meals: nextMeals,
      water: log?.water ?? 0,
    };
    await saveNutritionLog(updated);
    setLog(updated);
  };

  const addMeal = async (meal: Meal) => {
    await persistMeals([...meals, meal]);
    playFx('success');
    await addXp(25);
  };

  const removeMeal = async (id: string) => {
    await persistMeals(meals.filter((m) => m.id !== id));
    playFx('click');
  };

  // ── Manual ───────────────────────────────────────────────────────────────
  const submitManual = async () => {
    if (!manualForm.name.trim()) {
      Alert.alert('Erreur', 'Donne un nom à ton repas.');
      return;
    }
    await addMeal({
      id: generateId(),
      name: manualForm.name.trim(),
      calories: parseFloat(manualForm.calories.replace(',', '.')) || 0,
      protein: parseFloat(manualForm.protein.replace(',', '.')) || 0,
      carbs: parseFloat(manualForm.carbs.replace(',', '.')) || 0,
      fats: parseFloat(manualForm.fats.replace(',', '.')) || 0,
      category: manualForm.category,
      loggedAt: new Date().toISOString(),
    });
    setManualOpen(false);
    setManualForm({
      name: '',
      calories: '',
      protein: '',
      carbs: '',
      fats: '',
      category: 'snack',
    });
  };

  // ── Photo scan ───────────────────────────────────────────────────────────
  const pickFromCamera = async () => {
    playFx('click');
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'Active la caméra dans les réglages.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      base64: true,
      quality: 0.6,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });
    if (!res.canceled && res.assets[0]?.base64) {
      setScanImageUri(res.assets[0].uri);
      analyze(res.assets[0].base64, res.assets[0].mimeType ?? 'image/jpeg');
    }
  };

  const pickFromGallery = async () => {
    playFx('click');
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'Active la galerie dans les réglages.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      base64: true,
      quality: 0.6,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });
    if (!res.canceled && res.assets[0]?.base64) {
      setScanImageUri(res.assets[0].uri);
      analyze(res.assets[0].base64, res.assets[0].mimeType ?? 'image/jpeg');
    }
  };

  const analyze = async (base64: string, mime: string) => {
    setScanning(true);
    try {
      const food = await analyzeFoodImage(base64, mime);
      setAnalyzed(food);
      playFx('success');
    } catch (err: any) {
      console.error('[Gemini] analyzeFoodImage:', err);
      playFx('error');
      setScanImageUri(null);
      Alert.alert(
        'IA indisponible',
        err instanceof MissingApiKeyError
          ? 'Configure ta clé Gemini dans Réglages.'
          : `Erreur: ${err?.message ?? 'inconnue'}`
      );
    } finally {
      setScanning(false);
    }
  };

  const cancelScan = () => {
    setAnalyzed(null);
    setScanImageUri(null);
  };

  const confirmAnalyzed = async () => {
    if (!analyzed) return;
    await addMeal({
      id: generateId(),
      name: analyzed.name,
      calories: Math.round(analyzed.calories),
      protein: Math.round(analyzed.protein),
      carbs: Math.round(analyzed.carbs),
      fats: Math.round(analyzed.fats),
      category: pendingCategory,
      loggedAt: new Date().toISOString(),
    });
    cancelScan();
  };

  // ── AI Chef ─────────────────────────────────────────────────────────────
  const runChef = async () => {
    setChefLoading(true);
    setChefResults(null);
    setChefBlocked([]);
    playFx('click');
    try {
      const { recipes, blocked } = await generateChefRecipes({
        category: chefParams.category,
        goal: profile.goal,
        remainingCals: remaining,
        fridge: chefParams.fridge,
        complexity: chefParams.complexity,
        diners,
      });
      setChefResults(recipes);
      setChefBlocked(blocked);
      playFx('success');
    } catch (err: any) {
      console.error('[Gemini] generateChefRecipes:', err);
      playFx('error');
      Alert.alert(
        'IA indisponible',
        err instanceof MissingApiKeyError
          ? 'Configure ta clé Gemini dans Réglages.'
          : `Erreur: ${err?.message ?? 'inconnue'}`
      );
    } finally {
      setChefLoading(false);
    }
  };

  const toggleFavorite = async (r: Recipe) => {
    const exists = favorites.some((f) => f.name === r.name);
    const next = exists ? favorites.filter((f) => f.name !== r.name) : [...favorites, r];
    setFavorites(next);
    await saveFavorites(next);
    playFx(exists ? 'click' : 'success');
  };

  const addRecipeToShoppingList = async (r: Recipe) => {
    await addIngredientsToShoppingList(r.ingredients, r.name);
    playFx('success');
    Alert.alert(
      'Ajouté au panier',
      `${r.ingredients.length} ingrédients de "${r.name}" ajoutés à ta liste de course.`,
      [
        { text: 'OK', style: 'cancel' },
        { text: 'Voir la liste', onPress: () => navigation.navigate('ShoppingList') },
      ]
    );
  };

  const handleSwipeLike = async (r: Recipe) => {
    playFx('success');
    // ajoute en favori si pas déjà là
    if (!favorites.some((f) => f.name === r.name)) {
      const next = [...favorites, r];
      setFavorites(next);
      await saveFavorites(next);
    }
  };

  const handleSwipeSkip = (_r: Recipe) => {
    playFx('click');
  };

  const handleSwipeExhausted = () => {
    playFx('success');
  };

  const openRecipeDetails = (r: Recipe) => {
    setChefOpen(false);
    setActiveRecipe(r);
  };

  const logRecipe = async (r: Recipe) => {
    await addMeal({
      id: generateId(),
      name: r.name,
      calories: Math.round(r.calories),
      protein: Math.round(r.protein),
      carbs: Math.round(r.carbs),
      fats: Math.round(r.fats),
      category: chefParams.category,
      loggedAt: new Date().toISOString(),
    });
    setActiveRecipe(null);
  };

  // ── Render ──────────────────────────────────────────────────────────────
  const dateLabel = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const over = remaining < 0;
  const calPct = Math.min(100, Math.round((totals.calories / Math.max(1, profile.targetCalories)) * 100));
  const closeChef = () => {
    setChefOpen(false);
    setChefResults(null);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: SPACING.md, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.subtitle}>{dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}</Text>
            <Text style={styles.title}>Nutrition</Text>
          </View>
          <PressableScale onPress={() => navigation.navigate('ShoppingList')} hitSlop={8} accessibilityLabel="Liste d'épicerie">
            <Glass radius={20} style={styles.iconBtn}>
              <Ionicons name="cart-outline" size={20} color={COLORS.text} />
            </Glass>
          </PressableScale>
        </View>

        {/* ── Le jour en un coup d'œil ── */}
        <Card style={styles.dayCard}>
          <Text style={styles.cardCaption}>{over ? 'Au-dessus de l\'objectif' : 'Restant aujourd\'hui'}</Text>
          <View style={styles.bigNumberRow}>
            <AnimatedNumber value={Math.abs(remaining)} style={[styles.bigNumber, over && { color: COLORS.warning }]} />
            <Text style={styles.bigUnit}>kcal</Text>
          </View>
          <View style={styles.calTrack}>
            <View
              style={[styles.calFill, { width: `${calPct}%`, backgroundColor: over ? COLORS.warning : COLORS.primary }]}
            />
          </View>
          <Text style={styles.calCaption}>
            {Math.round(totals.calories).toLocaleString('fr-CA')} sur {profile.targetCalories.toLocaleString('fr-CA')} kcal
          </Text>

          <View style={styles.macroRow}>
            {[
              { label: 'Protéines', value: totals.protein, target: profile.targetProtein, color: COLORS.blue },
              { label: 'Glucides', value: totals.carbs, target: profile.targetCarbs, color: COLORS.accent },
              { label: 'Lipides', value: totals.fats, target: profile.targetFats, color: COLORS.purple },
            ].map((m) => {
              const pct = Math.min(100, Math.round((m.value / Math.max(1, m.target)) * 100));
              return (
                <View key={m.label} style={styles.macroItem}>
                  <Text style={styles.macroLabel}>{m.label}</Text>
                  <Text style={styles.macroValue}>
                    {Math.round(m.value)}
                    <Text style={styles.macroTarget}> / {m.target} g</Text>
                  </Text>
                  <View style={styles.macroBarTrack}>
                    <View style={[styles.macroBarFill, { width: `${pct}%`, backgroundColor: m.color }]} />
                  </View>
                </View>
              );
            })}
          </View>
        </Card>

        {/* ── Ta semaine ── */}
        <PressableScale onPress={() => navigation.navigate('MealPlan')} style={{ marginTop: SPACING.md }}>
          <Glass radius={RADIUS.xl} style={styles.weekCard}>
            <View style={styles.weekIcon}>
              <Ionicons name="calendar-outline" size={22} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.weekTitle}>{members.length > 1 ? 'Ta semaine à deux' : 'Ta semaine'}</Text>
              <Text style={styles.weekSub}>Menus, plats ivoiriens et portions pour chacun</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </Glass>
        </PressableScale>

        {/* ── Ajouter ── */}
        <Text style={styles.sectionTitle}>Ajouter un repas</Text>
        <View style={styles.actionGrid}>
          <ActionTile icon="camera-outline" label="Photo" sub="Scan IA" onPress={pickFromCamera} disabled={scanning} />
          <ActionTile icon="images-outline" label="Galerie" sub="Scan IA" onPress={pickFromGallery} disabled={scanning} />
          <ActionTile
            icon="restaurant-outline"
            label="Chef IA"
            sub="Swipe"
            onPress={() => {
              playFx('click');
              setChefResults(null);
              setChefOpen(true);
            }}
          />
          <ActionTile
            icon="create-outline"
            label="Manuel"
            sub="Saisie"
            onPress={() => {
              playFx('click');
              setManualOpen(true);
            }}
          />
        </View>

        {scanning && (
          <Glass radius={RADIUS.lg} style={styles.scanningBox}>
            <ActivityIndicator color={COLORS.textSecondary} />
            <Text style={styles.scanningText}>L'IA analyse ta photo…</Text>
          </Glass>
        )}

        {/* ── Journal du jour ── */}
        {MEAL_CATS.map(({ key, label, icon }) => {
          const items = meals.filter((m) => m.category === key);
          if (items.length === 0) return null;
          const calSum = items.reduce((a, m) => a + m.calories, 0);
          return (
            <View key={key}>
              <View style={styles.catHeader}>
                <View style={styles.catTitle}>
                  <Ionicons name={icon} size={16} color={COLORS.textSecondary} />
                  <Text style={styles.catLabel}>{label}</Text>
                </View>
                <Text style={styles.catSum}>{calSum} kcal</Text>
              </View>
              <Glass radius={RADIUS.xl}>
                {items.map((meal, idx) => (
                  <View key={meal.id}>
                    {idx > 0 && <View style={styles.separator} />}
                    <Pressable
                      style={({ pressed }) => [styles.mealRow, pressed && { backgroundColor: COLORS.surface }]}
                      onLongPress={() =>
                        Alert.alert(meal.name, 'Supprimer ce repas ?', [
                          { text: 'Annuler', style: 'cancel' },
                          { text: 'Supprimer', style: 'destructive', onPress: () => removeMeal(meal.id) },
                        ])
                      }
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.mealName} numberOfLines={1}>
                          {meal.name}
                        </Text>
                        <Text style={styles.mealSub}>
                          P {meal.protein} g · G {meal.carbs} g · L {meal.fats} g
                        </Text>
                      </View>
                      <Text style={styles.mealCal}>
                        {meal.calories}
                        <Text style={styles.mealCalUnit}> kcal</Text>
                      </Text>
                    </Pressable>
                  </View>
                ))}
              </Glass>
            </View>
          );
        })}

        {meals.length > 0 && <Text style={styles.footHint}>Appui long sur un repas pour le supprimer.</Text>}

        {meals.length === 0 && !scanning && (
          <View style={styles.empty}>
            <Ionicons name="restaurant-outline" size={40} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>Aucun repas aujourd'hui</Text>
            <Text style={styles.emptySub}>Utilise l'IA pour scanner une photo ou ajoute manuellement.</Text>
          </View>
        )}

        {/* ── Favoris ── */}
        {favorites.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Favoris</Text>
            <Glass radius={RADIUS.xl}>
              {favorites.map((r, idx) => (
                <View key={r.name}>
                  {idx > 0 && <View style={[styles.separator, { marginLeft: SPACING.md + 56 + 12 }]} />}
                  <Pressable
                    style={({ pressed }) => [styles.favRow, pressed && { backgroundColor: COLORS.surface }]}
                    onPress={() => setActiveRecipe(r)}
                  >
                    <Image
                      source={{ uri: r.image ?? recipeImageUrl(r.imageKeyword, r.name) }}
                      style={styles.favThumb}
                      contentFit="cover"
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.favName} numberOfLines={1}>
                        {r.name}
                      </Text>
                      <Text style={styles.favMeta}>
                        {r.calories} kcal · {r.prepTime}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
                  </Pressable>
                </View>
              ))}
            </Glass>
          </View>
        )}
      </ScrollView>

      {/* ── Saisie manuelle (feuille du bas) ─────────────────────────────── */}
      <Modal visible={manualOpen} animationType="slide" transparent onRequestClose={() => setManualOpen(false)}>
        <View style={styles.overlay}>
          <View style={[styles.sheetWrap, { marginBottom: Math.max(insets.bottom, SPACING.sm) }]}>
            <View style={styles.sheetBacking}>
              <Glass radius={RADIUS.xl} style={styles.sheet}>
                <View style={styles.grabber} />
                <View style={styles.sheetHeader}>
                  <Text style={styles.sheetTitle}>Ajouter un repas</Text>
                  <PressableScale onPress={() => setManualOpen(false)} accessibilityLabel="Fermer">
                    <View style={styles.sheetClose}>
                      <Ionicons name="close" size={18} color={COLORS.textSecondary} />
                    </View>
                  </PressableScale>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  <TextField label="Nom *" value={manualForm.name} onChangeText={(v) => setManualForm({ ...manualForm, name: v })} placeholder="Ex : Poulet riz" />
                  <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
                    <TextField label="Calories" value={manualForm.calories} onChangeText={(v) => setManualForm({ ...manualForm, calories: v })} keyboardType="numeric" placeholder="0" style={{ flex: 1 }} />
                    <TextField label="Protéines (g)" value={manualForm.protein} onChangeText={(v) => setManualForm({ ...manualForm, protein: v })} keyboardType="numeric" placeholder="0" style={{ flex: 1 }} />
                  </View>
                  <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
                    <TextField label="Glucides (g)" value={manualForm.carbs} onChangeText={(v) => setManualForm({ ...manualForm, carbs: v })} keyboardType="numeric" placeholder="0" style={{ flex: 1 }} />
                    <TextField label="Lipides (g)" value={manualForm.fats} onChangeText={(v) => setManualForm({ ...manualForm, fats: v })} keyboardType="numeric" placeholder="0" style={{ flex: 1 }} />
                  </View>

                  <Text style={styles.label}>Catégorie</Text>
                  <View style={styles.catRow}>
                    {MEAL_CATS.map((c) => (
                      <SelectPill
                        key={c.key}
                        label={c.label}
                        active={manualForm.category === c.key}
                        onPress={() => setManualForm({ ...manualForm, category: c.key })}
                      />
                    ))}
                  </View>

                  <PrimaryButton label="Enregistrer" xp="+25 XP" onPress={submitManual} />
                </ScrollView>
              </Glass>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Plat détecté (plein écran, avec la photo) ────────────────────── */}
      <Modal visible={!!analyzed} animationType="slide" onRequestClose={cancelScan}>
        <View style={[styles.modalRoot, { paddingTop: insets.top }]}>
          <AppBackground />
          <View style={styles.modalHeader}>
            <IconButton icon="close" label="Fermer" onPress={cancelScan} />
            <Text style={styles.modalTitle}>Plat détecté</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: SPACING.md, paddingBottom: insets.bottom + 120 }}
            showsVerticalScrollIndicator={false}
          >
            {scanImageUri && (
              <Image source={{ uri: scanImageUri }} style={styles.heroImage} contentFit="cover" />
            )}

            {analyzed && (
              <View style={{ paddingTop: SPACING.lg }}>
                <RecipeSafetyBanner conflicts={findFoodConflicts([analyzed.name], members)} />
                <Text style={styles.detailName}>{analyzed.name}</Text>
                <View style={styles.bigNumberRow}>
                  <Text style={styles.bigNumber}>{Math.round(analyzed.calories)}</Text>
                  <Text style={styles.bigUnit}>kcal</Text>
                </View>

                <View style={styles.statGrid}>
                  <MacroBig color={COLORS.blue} value={Math.round(analyzed.protein)} label="Protéines" suffix="g" />
                  <MacroBig color={COLORS.accent} value={Math.round(analyzed.carbs)} label="Glucides" suffix="g" />
                  <MacroBig color={COLORS.purple} value={Math.round(analyzed.fats)} label="Lipides" suffix="g" />
                </View>

                <Text style={styles.label}>Catégorie</Text>
                <View style={styles.catRow}>
                  {MEAL_CATS.map((c) => (
                    <SelectPill
                      key={c.key}
                      icon={c.icon}
                      label={c.label}
                      active={pendingCategory === c.key}
                      onPress={() => setPendingCategory(c.key)}
                    />
                  ))}
                </View>
              </View>
            )}
          </ScrollView>

          <View style={[styles.floatingFooter, { paddingBottom: insets.bottom + SPACING.md }]}>
            <PressableScale onPress={cancelScan}>
              <Glass radius={RADIUS.pill} style={styles.secondaryBtn}>
                <Text style={styles.secondaryBtnText}>Rejeter</Text>
              </Glass>
            </PressableScale>
            <PrimaryButton label="Valider" xp="+25 XP" onPress={confirmAnalyzed} style={{ flex: 1, marginTop: 0 }} />
          </View>
        </View>
      </Modal>

      {/* ── Chef IA (plein écran) ────────────────────────────────────────── */}
      <Modal visible={chefOpen} animationType="slide" onRequestClose={closeChef}>
        <View style={[styles.modalRoot, { paddingTop: insets.top }]}>
          <AppBackground />
          <View style={styles.modalHeader}>
            <IconButton icon="close" label="Fermer" onPress={closeChef} />
            <Text style={styles.modalTitle}>Chef IA</Text>
            {chefResults ? (
              <IconButton icon="refresh" label="Relancer le chef" onPress={runChef} disabled={chefLoading} />
            ) : (
              <View style={{ width: 40 }} />
            )}
          </View>

          {!chefResults && !chefLoading && (
            <ScrollView
              contentContainerStyle={{ paddingHorizontal: SPACING.md, paddingBottom: insets.bottom + 40 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.chefLead}>Des recettes calées sur ce qu'il te reste aujourd'hui.</Text>

              <Card style={{ marginTop: SPACING.lg }}>
                <Text style={[styles.label, { marginTop: 0 }]}>Type de repas</Text>
                <View style={styles.catRow}>
                  {MEAL_CATS.map((c) => (
                    <SelectPill
                      key={c.key}
                      icon={c.icon}
                      label={c.label}
                      active={chefParams.category === c.key}
                      onPress={() => setChefParams({ ...chefParams, category: c.key })}
                    />
                  ))}
                </View>

                {members.length > 1 && (
                  <>
                    <Text style={styles.label}>Pour qui</Text>
                    <View style={styles.catRow}>
                      {members.map((m) => {
                        const on = activeDinerIds.includes(m.id);
                        return (
                          <SelectPill
                            key={m.id}
                            icon={on ? 'checkmark-circle' : 'ellipse-outline'}
                            label={m.id === OWNER_ID ? 'Moi' : m.name}
                            active={on}
                            onPress={() => toggleDiner(m.id)}
                          />
                        );
                      })}
                    </View>
                  </>
                )}
                {diners.some((d) => (d.allergens?.length ?? 0) + (d.strictExclusions?.length ?? 0) > 0) && (
                  <SafetyNote
                    icon="lock-closed"
                    text={`Exclu d'office : ${describeStrictExclusions(diners.map((d) => (d.id === OWNER_ID ? { ...d, name: 'toi' } : d)))}`}
                  />
                )}

                <Text style={styles.label}>Complexité</Text>
                <Segmented
                  options={DIFFICULTIES.map((d) => ({ value: d.id, label: d.label }))}
                  value={chefParams.complexity}
                  onChange={(v) => setChefParams({ ...chefParams, complexity: v })}
                />

                <Text style={styles.label}>Ingrédients dispo (optionnel)</Text>
                <TextInput
                  multiline
                  numberOfLines={3}
                  value={chefParams.fridge}
                  onChangeText={(v) => setChefParams({ ...chefParams, fridge: v })}
                  placeholder="Poulet, riz, brocoli…"
                  placeholderTextColor={COLORS.textMuted}
                  style={[styles.input, { minHeight: 88, textAlignVertical: 'top' }]}
                />
              </Card>

              <PrimaryButton icon="sparkles" label="Générer 5 recettes" onPress={runChef} style={{ marginTop: SPACING.lg }} />
            </ScrollView>
          )}

          {chefLoading && (
            <View style={styles.chefLoading}>
              <ActivityIndicator color={COLORS.textSecondary} size="large" />
              <Text style={styles.chefLoadingText}>Le chef prépare le menu…</Text>
            </View>
          )}

          {chefResults && !chefLoading && chefBlocked.length > 0 && (
            <View style={{ marginHorizontal: SPACING.md }}>
              <SafetyNote
                icon="shield-checkmark"
                text={`${chefBlocked.length} recette${chefBlocked.length > 1 ? 's écartées' : ' écartée'} : ${summarizeConflicts(chefBlocked.flatMap((b) => b.conflicts))}`}
              />
            </View>
          )}

          {chefResults && !chefLoading && chefResults.length === 0 && (
            <View style={styles.chefLoading}>
              <Ionicons name="shield-checkmark-outline" size={36} color={COLORS.textMuted} />
              <Text style={styles.chefLoadingText}>Aucune recette sûre cette fois. Relance le chef.</Text>
            </View>
          )}

          {chefResults && !chefLoading && chefResults.length > 0 && (
            <View style={{ flex: 1, paddingHorizontal: SPACING.sm, paddingBottom: insets.bottom + SPACING.lg }}>
              <RecipeSwipeStack
                recipes={chefResults}
                onLike={handleSwipeLike}
                onSkip={handleSwipeSkip}
                onDetails={openRecipeDetails}
                onExhausted={handleSwipeExhausted}
              />
            </View>
          )}
        </View>
      </Modal>

      {/* ── Détail d'une recette (plein écran) ───────────────────────────── */}
      <Modal visible={!!activeRecipe} animationType="slide" onRequestClose={() => setActiveRecipe(null)}>
        <View style={[styles.modalRoot, { paddingTop: insets.top }]}>
          <AppBackground />
          <View style={styles.modalHeader}>
            <IconButton icon="chevron-back" label="Retour" onPress={() => setActiveRecipe(null)} />
            {activeRecipe && (
              <IconButton
                icon={favorites.some((f) => f.name === activeRecipe.name) ? 'star' : 'star-outline'}
                label={favorites.some((f) => f.name === activeRecipe.name) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                onPress={() => toggleFavorite(activeRecipe)}
              />
            )}
          </View>
          {activeRecipe && (
            <ScrollView
              contentContainerStyle={{ paddingHorizontal: SPACING.md, paddingBottom: insets.bottom + 120 }}
              showsVerticalScrollIndicator={false}
            >
              <Image
                source={{ uri: activeRecipe.image ?? recipeImageUrl(activeRecipe.imageKeyword, activeRecipe.name) }}
                style={styles.heroImage}
                contentFit="cover"
              />
              <View style={{ paddingTop: SPACING.lg }}>
                <RecipeSafetyBanner conflicts={findRecipeConflicts(activeRecipe, members)} />
                <Text style={styles.detailName}>{activeRecipe.name}</Text>
                <Text style={styles.detailDesc}>{activeRecipe.desc}</Text>
                <View style={styles.detailMetaRow}>
                  <View style={styles.metaPill}>
                    <Ionicons name="time-outline" size={14} color={COLORS.textSecondary} />
                    <Text style={styles.metaText}>{activeRecipe.prepTime}</Text>
                  </View>
                  <View style={styles.metaPill}>
                    <Ionicons name="speedometer-outline" size={14} color={COLORS.textSecondary} />
                    <Text style={styles.metaText}>{activeRecipe.difficulty}</Text>
                  </View>
                </View>
                <View style={styles.statGrid}>
                  <MacroBig value={activeRecipe.calories} label="Énergie" suffix="kcal" />
                  <MacroBig color={COLORS.blue} value={activeRecipe.protein} label="Protéines" suffix="g" />
                  <MacroBig color={COLORS.accent} value={activeRecipe.carbs} label="Glucides" suffix="g" />
                  <MacroBig color={COLORS.purple} value={activeRecipe.fats} label="Lipides" suffix="g" />
                </View>

                <View style={styles.ingHeader}>
                  <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Ingrédients</Text>
                  <PressableScale onPress={() => activeRecipe && addRecipeToShoppingList(activeRecipe)} style={{ marginTop: SPACING.xl }}>
                    <Glass radius={RADIUS.pill} style={styles.addToCartBtn}>
                      <Ionicons name="cart-outline" size={16} color={COLORS.text} />
                      <Text style={styles.addToCartText}>Au panier</Text>
                    </Glass>
                  </PressableScale>
                </View>
                <Glass radius={RADIUS.xl} style={{ marginTop: SPACING.sm }}>
                  {activeRecipe.ingredients.map((ing, i) => (
                    <View key={i}>
                      {i > 0 && <View style={styles.separator} />}
                      <View style={styles.ingRow}>
                        <View style={styles.ingDot} />
                        <Text style={styles.ingText}>{ing}</Text>
                      </View>
                    </View>
                  ))}
                </Glass>

                <Text style={styles.sectionTitle}>Préparation</Text>
                <Glass radius={RADIUS.xl} style={styles.stepsCard}>
                  {activeRecipe.instructions.map((step, i) => (
                    <View key={i} style={styles.stepRow}>
                      <View style={styles.stepNum}>
                        <Text style={styles.stepNumText}>{i + 1}</Text>
                      </View>
                      <Text style={styles.stepText}>{step}</Text>
                    </View>
                  ))}
                </Glass>
              </View>
            </ScrollView>
          )}
          <View style={[styles.floatingFooter, { paddingBottom: insets.bottom + SPACING.md }]}>
            <PrimaryButton
              icon="add-circle-outline"
              label="Ajouter à mon journal"
              xp="+25 XP"
              onPress={() => activeRecipe && logRecipe(activeRecipe)}
              style={{ flex: 1, marginTop: 0 }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Petites briques locales ────────────────────────────────────────────────
const IconButton: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}> = ({ icon, label, onPress, disabled }) => (
  <PressableScale onPress={onPress} disabled={disabled} hitSlop={8} accessibilityLabel={label}>
    <Glass radius={20} style={[styles.iconBtn, disabled && { opacity: 0.5 }]}>
      <Ionicons name={icon} size={20} color={COLORS.text} />
    </Glass>
  </PressableScale>
);

const PrimaryButton: React.FC<{
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  xp?: string;
  style?: StyleProp<ViewStyle>;
}> = ({ label, onPress, icon, xp, style }) => (
  <View style={[{ marginTop: SPACING.lg }, style]}>
    <PressableScale onPress={onPress} style={styles.primaryBtn}>
      {icon ? <Ionicons name={icon} size={19} color={COLORS.onPrimary} /> : null}
      <Text style={styles.primaryBtnText}>{label}</Text>
      {xp ? <Text style={styles.primaryBtnXp}>{xp}</Text> : null}
    </PressableScale>
  </View>
);

const SelectPill: React.FC<{
  label: string;
  active: boolean;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}> = ({ label, active, onPress, icon }) => (
  <PressableScale
    onPress={onPress}
    style={[styles.catChip, active && styles.catChipActive]}
    accessibilityRole="button"
    accessibilityState={{ selected: active }}
  >
    {icon ? <Ionicons name={icon} size={15} color={active ? COLORS.onPrimary : COLORS.textSecondary} /> : null}
    <Text style={[styles.catChipText, active && { color: COLORS.onPrimary }]}>{label}</Text>
  </PressableScale>
);

const ActionTile: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub: string;
  onPress: () => void;
  disabled?: boolean;
}> = ({ icon, label, sub, onPress, disabled }) => (
  <View style={[styles.actionTileWrap, disabled && { opacity: 0.5 }]}>
    <PressableScale onPress={onPress} disabled={disabled}>
      <Glass radius={RADIUS.lg + 4} style={styles.actionTile}>
        <View style={styles.actionIcon}>
          <Ionicons name={icon} size={21} color={COLORS.text} />
        </View>
        <Text style={styles.actionLabel}>{label}</Text>
        <Text style={styles.actionSub}>{sub}</Text>
      </Glass>
    </PressableScale>
  </View>
);

// Bandeau rouge des exclusions strictes et des recettes écartées.
const SafetyNote: React.FC<{ icon: keyof typeof Ionicons.glyphMap; text: string }> = ({ icon, text }) => (
  <View style={styles.safetyNote} accessibilityRole="alert">
    <View style={styles.safetyIcon}>
      <Ionicons name={icon} size={15} color={COLORS.danger} />
    </View>
    <Text style={styles.safetyText}>{text}</Text>
  </View>
);

// Alerte rouge quand une recette (favori ancien, scan photo) touche une
// exclusion stricte d'une personne du foyer.
const RecipeSafetyBanner: React.FC<{ conflicts: FoodConflict[] }> = ({ conflicts }) =>
  conflicts.length ? (
    <View style={styles.dangerBanner} accessibilityRole="alert">
      <View style={styles.safetyIcon}>
        <Ionicons name="warning" size={16} color={COLORS.danger} />
      </View>
      <Text style={styles.dangerText}>Contient : {summarizeConflicts(conflicts)}</Text>
    </View>
  ) : null;

const MacroBig: React.FC<{ color?: string; value: number; label: string; suffix?: string }> = ({ color, value, label, suffix }) => (
  <Glass radius={RADIUS.lg} style={styles.macroBig}>
    <Text style={styles.macroBigValue}>
      {value}
      {suffix ? <Text style={styles.macroBigUnit}> {suffix}</Text> : null}
    </Text>
    <View style={styles.macroBigLabelRow}>
      {color ? <View style={[styles.macroDot, { backgroundColor: color }]} /> : null}
      <Text style={styles.macroBigLabel}>{label}</Text>
    </View>
  </Glass>
);

const TextField: React.FC<{
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  keyboardType?: any;
  style?: any;
}> = ({ label, value, onChangeText, placeholder, keyboardType, style }) => (
  <View style={[{ marginBottom: SPACING.xs }, style]}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={COLORS.textMuted}
      keyboardType={keyboardType}
      style={styles.input}
    />
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  modalRoot: { flex: 1, backgroundColor: COLORS.background },

  // en-tête
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  subtitle: { ...TYPE.caption, color: COLORS.textSecondary },
  title: { ...TYPE.largeTitle, color: COLORS.text, marginTop: 2 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  // carte du jour
  dayCard: { paddingVertical: SPACING.lg },
  cardCaption: { ...TYPE.caption, color: COLORS.textSecondary },
  bigNumberRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 },
  bigNumber: { ...TYPE.number, fontSize: 52, color: COLORS.text },
  bigUnit: { ...TYPE.headline, color: COLORS.textSecondary },
  calTrack: { height: 8, borderRadius: 4, backgroundColor: COLORS.surface, marginTop: SPACING.md, overflow: 'hidden' },
  calFill: { height: '100%', borderRadius: 4 },
  calCaption: { ...TYPE.footnote, color: COLORS.textMuted, marginTop: SPACING.sm, fontVariant: ['tabular-nums'] },
  macroRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  macroItem: { flex: 1 },
  macroLabel: { ...TYPE.footnote, color: COLORS.textSecondary },
  macroValue: { ...TYPE.number, fontSize: 20, color: COLORS.text, marginTop: 2 },
  macroTarget: { fontSize: 12, fontWeight: '500', letterSpacing: 0, color: COLORS.textMuted },
  macroBarTrack: { height: 4, backgroundColor: COLORS.surface, borderRadius: 2, marginTop: 8, overflow: 'hidden' },
  macroBarFill: { height: '100%', borderRadius: 2 },

  // ta semaine
  weekCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: SPACING.md },
  weekIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekTitle: { ...TYPE.headline, color: COLORS.text },
  weekSub: { ...TYPE.footnote, fontWeight: '400', color: COLORS.textSecondary, marginTop: 2 },

  // actions
  sectionTitle: { ...TYPE.title, color: COLORS.text, marginTop: SPACING.xl, marginBottom: SPACING.md },
  actionGrid: { flexDirection: 'row', gap: SPACING.sm },
  actionTileWrap: { flex: 1 },
  actionTile: { alignItems: 'center', paddingVertical: SPACING.md, paddingHorizontal: 4 },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { ...TYPE.caption, fontWeight: '600', color: COLORS.text, marginTop: 8 },
  actionSub: { fontSize: 11, fontWeight: '400', color: COLORS.textMuted, marginTop: 1 },

  scanningBox: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: SPACING.md, marginTop: SPACING.md },
  scanningText: { ...TYPE.callout, color: COLORS.text },

  // journal
  catHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.xl,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  catTitle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  catLabel: { ...TYPE.overline, color: COLORS.textSecondary },
  catSum: { ...TYPE.caption, color: COLORS.textMuted, fontVariant: ['tabular-nums'] },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border, marginLeft: SPACING.md },
  mealRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: SPACING.md, paddingVertical: 14 },
  mealName: { ...TYPE.body, fontWeight: '500', color: COLORS.text },
  mealSub: { ...TYPE.footnote, fontWeight: '400', color: COLORS.textMuted, marginTop: 2 },
  mealCal: { ...TYPE.number, fontSize: 17, color: COLORS.text },
  mealCalUnit: { fontSize: 12, fontWeight: '500', letterSpacing: 0, color: COLORS.textSecondary },
  footHint: { ...TYPE.footnote, fontWeight: '400', color: COLORS.textMuted, marginTop: SPACING.sm, paddingHorizontal: SPACING.md },

  empty: { alignItems: 'center', paddingVertical: SPACING.xl, paddingHorizontal: SPACING.lg, marginTop: SPACING.md },
  emptyTitle: { ...TYPE.headline, color: COLORS.text, marginTop: SPACING.sm },
  emptySub: { ...TYPE.caption, fontWeight: '400', color: COLORS.textSecondary, marginTop: 4, textAlign: 'center', lineHeight: 18 },

  // favoris
  favRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: SPACING.md, paddingVertical: 10 },
  favThumb: { width: 56, height: 56, borderRadius: 14, backgroundColor: COLORS.surface },
  favName: { ...TYPE.body, fontWeight: '500', color: COLORS.text },
  favMeta: { ...TYPE.footnote, fontWeight: '400', color: COLORS.textMuted, marginTop: 2 },

  // feuille du bas
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheetWrap: { marginHorizontal: SPACING.sm, maxHeight: '90%' },
  sheetBacking: { borderRadius: RADIUS.xl, backgroundColor: 'rgba(18,20,28,0.85)', overflow: 'hidden' },
  sheet: { padding: SPACING.lg, paddingTop: SPACING.sm },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: COLORS.borderStrong, marginBottom: SPACING.md },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.xs },
  sheetTitle: { ...TYPE.title, color: COLORS.text },
  sheetClose: { width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.cardElevated, alignItems: 'center', justifyContent: 'center' },

  // formulaires
  label: { ...TYPE.overline, color: COLORS.textSecondary, marginBottom: SPACING.sm, marginTop: SPACING.md },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    color: COLORS.text,
    ...TYPE.body,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  catChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  catChipText: { ...TYPE.caption, fontWeight: '600', color: COLORS.textSecondary },

  // boutons
  primaryBtn: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: COLORS.onPrimary, fontSize: 17, fontWeight: '600' },
  primaryBtnXp: { color: COLORS.onPrimary, fontSize: 13, fontWeight: '500', opacity: 0.55 },
  secondaryBtn: { paddingVertical: 16, paddingHorizontal: SPACING.lg, alignItems: 'center', justifyContent: 'center' },
  secondaryBtnText: { color: COLORS.text, fontSize: 17, fontWeight: '600' },

  // sécurité (allergies) : rouge, toujours très visible
  safetyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.dangerSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${COLORS.danger}66`,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  safetyIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: `${COLORS.danger}26`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safetyText: { ...TYPE.caption, color: COLORS.text, flex: 1, lineHeight: 18 },
  dangerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.danger,
    backgroundColor: COLORS.dangerSoft,
    marginBottom: SPACING.md,
  },
  dangerText: { ...TYPE.callout, fontWeight: '600', color: COLORS.danger, flex: 1, lineHeight: 20 },

  // modales plein écran
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  modalTitle: { ...TYPE.headline, color: COLORS.text },
  heroImage: { width: '100%', aspectRatio: 4 / 3, borderRadius: RADIUS.xl, backgroundColor: COLORS.surface },
  detailName: { ...TYPE.largeTitle, fontSize: 30, color: COLORS.text },
  detailDesc: { ...TYPE.body, color: COLORS.textSecondary, marginTop: SPACING.sm, lineHeight: 22 },
  statGrid: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg },
  macroBig: { flex: 1, paddingVertical: 12, paddingHorizontal: 12 },
  macroBigValue: { ...TYPE.number, fontSize: 20, color: COLORS.text },
  macroBigUnit: { fontSize: 12, fontWeight: '500', letterSpacing: 0, color: COLORS.textSecondary },
  macroBigLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  macroDot: { width: 6, height: 6, borderRadius: 3 },
  macroBigLabel: { ...TYPE.footnote, color: COLORS.textSecondary },
  floatingFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
  },

  // chef
  chefLead: { ...TYPE.body, color: COLORS.textSecondary, textAlign: 'center', paddingHorizontal: SPACING.lg },
  chefLoading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: SPACING.xl },
  chefLoadingText: { ...TYPE.callout, color: COLORS.textSecondary, textAlign: 'center' },

  // détail recette
  detailMetaRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
  },
  metaText: { ...TYPE.footnote, color: COLORS.textSecondary },
  ingHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addToCartBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8 },
  addToCartText: { ...TYPE.caption, fontWeight: '600', color: COLORS.text },
  ingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: SPACING.md, paddingVertical: 13 },
  ingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.textMuted },
  ingText: { ...TYPE.body, color: COLORS.text, flex: 1 },
  stepsCard: { padding: SPACING.md, gap: SPACING.md },
  stepRow: { flexDirection: 'row', gap: 12 },
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumText: { ...TYPE.footnote, fontWeight: '600', color: COLORS.text },
  stepText: { ...TYPE.body, flex: 1, color: COLORS.text, lineHeight: 22 },
});
