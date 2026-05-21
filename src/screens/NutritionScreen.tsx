import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, RADIUS, SPACING } from '../theme';
import { useApp } from '../contexts/AppContext';
import {
  addIngredientsToShoppingList,
  generateId,
  getFavorites,
  getTodayNutrition,
  saveFavorites,
  saveNutritionLog,
} from '../utils/storage';
import { Meal, MealCategory, NutritionLog, Recipe } from '../types';
import {
  MissingApiKeyError,
  analyzeFoodImage,
  generateChefRecipes,
  AnalyzedFood,
} from '../services/gemini';
import RecipeSwipeStack, { recipeImageUrl } from '../components/RecipeSwipeStack';

const MEAL_CATS: { key: MealCategory; label: string; icon: any }[] = [
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
  const { profile, playFx, addXp } = useApp();
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
      calories: parseFloat(manualForm.calories) || 0,
      protein: parseFloat(manualForm.protein) || 0,
      carbs: parseFloat(manualForm.carbs) || 0,
      fats: parseFloat(manualForm.fats) || 0,
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
    playFx('click');
    try {
      const recipes = await generateChefRecipes({
        category: chefParams.category,
        goal: profile.goal,
        remainingCals: remaining,
        fridge: chefParams.fridge,
        complexity: chefParams.complexity,
      });
      setChefResults(recipes);
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
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Nutrition</Text>
          <Text style={styles.subtitle}>
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.cartBtn}
          onPress={() => navigation.navigate('ShoppingList')}
          hitSlop={8}
        >
          <Ionicons name="cart-outline" size={18} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.remainingChip}>
          <Text style={styles.remainingLabel}>RESTANT</Text>
          <Text style={[styles.remainingValue, remaining < 0 && { color: COLORS.danger }]}>{remaining}</Text>
          <Text style={styles.remainingUnit}>kcal</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: SPACING.md, paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.actionGrid}>
          <ActionTile icon="camera-outline" label="PHOTO" sub="Scan IA" color={COLORS.primary} onPress={pickFromCamera} disabled={scanning} />
          <ActionTile icon="image-outline" label="GALERIE" sub="Scan IA" color={COLORS.blue} onPress={pickFromGallery} disabled={scanning} />
          <ActionTile
            icon="restaurant-outline"
            label="CHEF IA"
            sub="Swipe"
            color={COLORS.accent}
            onPress={() => {
              playFx('click');
              setChefResults(null);
              setChefOpen(true);
            }}
          />
          <ActionTile
            icon="create-outline"
            label="MANUEL"
            sub="Saisie"
            color={COLORS.purple}
            onPress={() => {
              playFx('click');
              setManualOpen(true);
            }}
          />
        </View>

        {scanning && (
          <View style={styles.scanningBox}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={styles.scanningText}>L'IA analyse ta photo…</Text>
          </View>
        )}

        <View style={styles.macroCard}>
          {[
            { label: 'CAL', value: totals.calories, target: profile.targetCalories, color: COLORS.primary, unit: '' },
            { label: 'PROT', value: totals.protein, target: profile.targetProtein, color: COLORS.blue, unit: 'g' },
            { label: 'GLUC', value: totals.carbs, target: profile.targetCarbs, color: COLORS.accent, unit: 'g' },
            { label: 'LIP', value: totals.fats, target: profile.targetFats, color: COLORS.danger, unit: 'g' },
          ].map((m) => {
            const pct = Math.min(100, Math.round((m.value / Math.max(1, m.target)) * 100));
            return (
              <View key={m.label} style={styles.macroItem}>
                <Text style={[styles.macroLabel, { color: m.color }]}>{m.label}</Text>
                <Text style={styles.macroValue}>
                  {Math.round(m.value)}
                  {m.unit}
                </Text>
                <Text style={styles.macroTarget}>
                  / {m.target}
                  {m.unit}
                </Text>
                <View style={styles.macroBarTrack}>
                  <View style={[styles.macroBarFill, { width: `${pct}%`, backgroundColor: m.color }]} />
                </View>
              </View>
            );
          })}
        </View>

        {MEAL_CATS.map(({ key, label, icon }) => {
          const items = meals.filter((m) => m.category === key);
          if (items.length === 0) return null;
          const calSum = items.reduce((a, m) => a + m.calories, 0);
          return (
            <View key={key} style={styles.catBlock}>
              <View style={styles.catHeader}>
                <View style={styles.catTitle}>
                  <Ionicons name={icon} size={14} color={COLORS.primary} />
                  <Text style={styles.catLabel}>{label.toUpperCase()}</Text>
                </View>
                <Text style={styles.catSum}>{calSum} KCAL</Text>
              </View>
              {items.map((meal) => (
                <Pressable
                  key={meal.id}
                  style={styles.mealRow}
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
                      P {meal.protein}g · G {meal.carbs}g · L {meal.fats}g
                    </Text>
                  </View>
                  <Text style={styles.mealCal}>{meal.calories}</Text>
                </Pressable>
              ))}
            </View>
          );
        })}

        {meals.length === 0 && !scanning && (
          <View style={styles.empty}>
            <Ionicons name="restaurant-outline" size={48} color={COLORS.border} />
            <Text style={styles.emptyTitle}>Aucun repas aujourd'hui</Text>
            <Text style={styles.emptySub}>Utilise l'IA pour scanner une photo ou ajoute manuellement.</Text>
          </View>
        )}

        {favorites.length > 0 && (
          <View style={{ marginTop: SPACING.lg }}>
            <Text style={styles.sectionTitle}>FAVORIS</Text>
            {favorites.map((r) => (
              <TouchableOpacity
                key={r.name}
                style={styles.favRow}
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
                <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ── Manual modal ────────────────────────────────────────────────── */}
      <Modal visible={manualOpen} animationType="slide" transparent onRequestClose={() => setManualOpen(false)}>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + SPACING.md }]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Ajouter un repas</Text>
              <TouchableOpacity onPress={() => setManualOpen(false)}>
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <TextField label="Nom *" value={manualForm.name} onChangeText={(v) => setManualForm({ ...manualForm, name: v })} placeholder="Ex: Poulet riz" />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextField label="Calories" value={manualForm.calories} onChangeText={(v) => setManualForm({ ...manualForm, calories: v })} keyboardType="numeric" placeholder="0" style={{ flex: 1 }} />
                <TextField label="Protéines (g)" value={manualForm.protein} onChangeText={(v) => setManualForm({ ...manualForm, protein: v })} keyboardType="numeric" placeholder="0" style={{ flex: 1 }} />
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextField label="Glucides (g)" value={manualForm.carbs} onChangeText={(v) => setManualForm({ ...manualForm, carbs: v })} keyboardType="numeric" placeholder="0" style={{ flex: 1 }} />
                <TextField label="Lipides (g)" value={manualForm.fats} onChangeText={(v) => setManualForm({ ...manualForm, fats: v })} keyboardType="numeric" placeholder="0" style={{ flex: 1 }} />
              </View>

              <Text style={styles.label}>Catégorie</Text>
              <View style={styles.catRow}>
                {MEAL_CATS.map((c) => (
                  <TouchableOpacity key={c.key} style={[styles.catChip, manualForm.category === c.key && styles.catChipActive]} onPress={() => setManualForm({ ...manualForm, category: c.key })}>
                    <Text style={[styles.catChipText, manualForm.category === c.key && { color: '#08110D' }]}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.primaryBtn} onPress={submitManual}>
                <Ionicons name="checkmark-circle" size={18} color="#08110D" />
                <Text style={styles.primaryBtnText}>ENREGISTRER (+25 XP)</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Analyzed modal (full visual with photo) ─────────────────────── */}
      <Modal visible={!!analyzed} animationType="slide" onRequestClose={cancelScan}>
        <View style={[styles.root, { paddingTop: insets.top }]}>
          <View style={styles.scanHeader}>
            <TouchableOpacity onPress={cancelScan} hitSlop={10}>
              <Ionicons name="close" size={26} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.scanHeaderTitle}>PLAT DÉTECTÉ</Text>
            <View style={{ width: 26 }} />
          </View>

          <ScrollView
            contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
            showsVerticalScrollIndicator={false}
          >
            {scanImageUri && (
              <Image source={{ uri: scanImageUri }} style={styles.scanHero} contentFit="cover" />
            )}

            {analyzed && (
              <View style={{ padding: SPACING.lg }}>
                <Text style={styles.scanName}>{analyzed.name}</Text>
                <View style={styles.scanKcalRow}>
                  <Text style={styles.scanKcalBig}>{Math.round(analyzed.calories)}</Text>
                  <Text style={styles.scanKcalUnit}>kcal</Text>
                </View>

                <View style={styles.scanMacros}>
                  <MacroBig color={COLORS.blue} value={Math.round(analyzed.protein)} label="PROT" />
                  <MacroBig color={COLORS.accent} value={Math.round(analyzed.carbs)} label="GLUC" />
                  <MacroBig color={COLORS.danger} value={Math.round(analyzed.fats)} label="LIP" />
                </View>

                <Text style={styles.label}>Catégorie</Text>
                <View style={styles.catRow}>
                  {MEAL_CATS.map((c) => (
                    <TouchableOpacity
                      key={c.key}
                      style={[styles.catChip, pendingCategory === c.key && styles.catChipActive]}
                      onPress={() => setPendingCategory(c.key)}
                    >
                      <Ionicons name={c.icon} size={14} color={pendingCategory === c.key ? '#08110D' : COLORS.textSecondary} />
                      <Text style={[styles.catChipText, pendingCategory === c.key && { color: '#08110D' }]}>{c.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>

          <View style={[styles.scanFooter, { paddingBottom: insets.bottom + SPACING.md }]}>
            <TouchableOpacity style={styles.cancelBtn} onPress={cancelScan}>
              <Text style={styles.cancelText}>REJETER</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.primaryBtn, { flex: 1, marginTop: 0 }]} onPress={confirmAnalyzed}>
              <Ionicons name="checkmark-circle" size={18} color="#08110D" />
              <Text style={styles.primaryBtnText}>VALIDER (+25 XP)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Chef modal ─────────────────────────────────────────────────── */}
      <Modal
        visible={chefOpen}
        animationType="slide"
        onRequestClose={() => {
          setChefOpen(false);
          setChefResults(null);
        }}
      >
        <View style={[styles.root, { paddingTop: insets.top }]}>
          <View style={styles.scanHeader}>
            <TouchableOpacity
              onPress={() => {
                setChefOpen(false);
                setChefResults(null);
              }}
              hitSlop={10}
            >
              <Ionicons name="close" size={26} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.scanHeaderTitle}>CHEF IA</Text>
            {chefResults ? (
              <TouchableOpacity onPress={runChef} disabled={chefLoading} hitSlop={10}>
                <Ionicons name="refresh" size={22} color={COLORS.primary} />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 26 }} />
            )}
          </View>

          {!chefResults && !chefLoading && (
            <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Type de repas</Text>
              <View style={styles.catRow}>
                {MEAL_CATS.map((c) => (
                  <TouchableOpacity key={c.key} style={[styles.catChip, chefParams.category === c.key && styles.catChipActive]} onPress={() => setChefParams({ ...chefParams, category: c.key })}>
                    <Ionicons name={c.icon} size={14} color={chefParams.category === c.key ? '#08110D' : COLORS.textSecondary} />
                    <Text style={[styles.catChipText, chefParams.category === c.key && { color: '#08110D' }]}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Complexité</Text>
              <View style={styles.catRow}>
                {DIFFICULTIES.map((d) => (
                  <TouchableOpacity key={d.id} style={[styles.catChip, chefParams.complexity === d.id && styles.catChipActive]} onPress={() => setChefParams({ ...chefParams, complexity: d.id })}>
                    <Text style={[styles.catChipText, chefParams.complexity === d.id && { color: '#08110D' }]}>{d.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Ingrédients dispo (optionnel)</Text>
              <TextInput
                multiline
                numberOfLines={3}
                value={chefParams.fridge}
                onChangeText={(v) => setChefParams({ ...chefParams, fridge: v })}
                placeholder="Poulet, riz, brocoli…"
                placeholderTextColor={COLORS.textMuted}
                style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
              />

              <TouchableOpacity style={styles.primaryBtn} onPress={runChef}>
                <Ionicons name="sparkles" size={18} color="#08110D" />
                <Text style={styles.primaryBtnText}>GÉNÉRER 5 RECETTES</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {chefLoading && (
            <View style={styles.chefLoading}>
              <ActivityIndicator color={COLORS.primary} size="large" />
              <Text style={styles.chefLoadingText}>Le chef prépare le menu…</Text>
            </View>
          )}

          {chefResults && !chefLoading && (
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

      {/* ── Recipe details ──────────────────────────────────────────────── */}
      <Modal visible={!!activeRecipe} animationType="slide" onRequestClose={() => setActiveRecipe(null)}>
        <View style={[styles.root, { paddingTop: insets.top }]}>
          <View style={styles.scanHeader}>
            <TouchableOpacity onPress={() => setActiveRecipe(null)} hitSlop={10}>
              <Ionicons name="chevron-back" size={24} color={COLORS.text} />
            </TouchableOpacity>
            {activeRecipe && (
              <TouchableOpacity onPress={() => toggleFavorite(activeRecipe)} hitSlop={10}>
                <Ionicons
                  name={favorites.some((f) => f.name === activeRecipe.name) ? 'star' : 'star-outline'}
                  size={24}
                  color={COLORS.accent}
                />
              </TouchableOpacity>
            )}
          </View>
          {activeRecipe && (
            <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 110 }} showsVerticalScrollIndicator={false}>
              <Image
                source={{ uri: activeRecipe.image ?? recipeImageUrl(activeRecipe.imageKeyword, activeRecipe.name) }}
                style={styles.detailHero}
                contentFit="cover"
              />
              <View style={{ padding: SPACING.lg }}>
                <Text style={styles.recipeFullName}>{activeRecipe.name}</Text>
                <Text style={styles.recipeFullDesc}>{activeRecipe.desc}</Text>
                <View style={styles.recipeStatRow}>
                  <MacroBig color={COLORS.primary} value={activeRecipe.calories} label="KCAL" />
                  <MacroBig color={COLORS.blue} value={activeRecipe.protein} label="PROT" suffix="g" />
                  <MacroBig color={COLORS.accent} value={activeRecipe.carbs} label="GLUC" suffix="g" />
                  <MacroBig color={COLORS.danger} value={activeRecipe.fats} label="LIP" suffix="g" />
                </View>
                <View style={styles.detailMetaRow}>
                  <View style={styles.metaPill}>
                    <Ionicons name="time-outline" size={14} color={COLORS.textSecondary} />
                    <Text style={styles.metaText}>{activeRecipe.prepTime}</Text>
                  </View>
                  <View style={styles.metaPill}>
                    <Ionicons name="flame-outline" size={14} color={COLORS.textSecondary} />
                    <Text style={styles.metaText}>{activeRecipe.difficulty}</Text>
                  </View>
                </View>
                <View style={styles.ingHeader}>
                  <Text style={styles.sectionTitle}>INGRÉDIENTS</Text>
                  <TouchableOpacity
                    style={styles.addToCartBtn}
                    onPress={() => activeRecipe && addRecipeToShoppingList(activeRecipe)}
                  >
                    <Ionicons name="cart-outline" size={13} color={COLORS.primary} />
                    <Text style={styles.addToCartText}>AU PANIER</Text>
                  </TouchableOpacity>
                </View>
                {activeRecipe.ingredients.map((ing, i) => (
                  <View key={i} style={styles.ingRow}>
                    <View style={styles.ingDot} />
                    <Text style={styles.ingText}>{ing}</Text>
                  </View>
                ))}
                <Text style={styles.sectionTitle}>PRÉPARATION</Text>
                {activeRecipe.instructions.map((step, i) => (
                  <View key={i} style={styles.stepRow}>
                    <View style={styles.stepNum}>
                      <Text style={styles.stepNumText}>{i + 1}</Text>
                    </View>
                    <Text style={styles.stepText}>{step}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          )}
          <View style={[styles.recipeFooter, { paddingBottom: insets.bottom + SPACING.md }]}>
            <TouchableOpacity style={[styles.primaryBtn, { marginTop: 0 }]} onPress={() => activeRecipe && logRecipe(activeRecipe)}>
              <Ionicons name="restaurant" size={18} color="#08110D" />
              <Text style={styles.primaryBtnText}>LOG REPAS (+25 XP)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── small helpers ──────────────────────────────────────────────────────────
const ActionTile: React.FC<{
  icon: any;
  label: string;
  sub: string;
  color: string;
  onPress: () => void;
  disabled?: boolean;
}> = ({ icon, label, sub, color, onPress, disabled }) => (
  <TouchableOpacity style={[styles.actionTile, disabled && { opacity: 0.5 }]} onPress={onPress} disabled={disabled} activeOpacity={0.85}>
    <Ionicons name={icon} size={22} color={color} />
    <Text style={[styles.actionLabel, { color }]}>{label}</Text>
    <Text style={styles.actionSub}>{sub}</Text>
  </TouchableOpacity>
);

const MacroBig: React.FC<{ color: string; value: number; label: string; suffix?: string }> = ({ color, value, label, suffix }) => (
  <View style={styles.macroBig}>
    <Text style={[styles.macroBigValue, { color }]}>
      {value}
      {suffix ?? ''}
    </Text>
    <Text style={styles.macroBigLabel}>{label}</Text>
  </View>
);

const TextField: React.FC<{
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  keyboardType?: any;
  style?: any;
}> = ({ label, value, onChangeText, placeholder, keyboardType, style }) => (
  <View style={[{ marginBottom: SPACING.sm }, style]}>
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
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  title: { color: COLORS.text, fontSize: 24, fontWeight: '800' },
  subtitle: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2, textTransform: 'capitalize' },
  remainingChip: {
    alignItems: 'flex-end',
    backgroundColor: COLORS.card,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  remainingLabel: { color: COLORS.primary, fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  remainingValue: { color: COLORS.text, fontSize: 22, fontWeight: '900', lineHeight: 24 },
  remainingUnit: { color: COLORS.textSecondary, fontSize: 10, fontWeight: '700' },

  cartBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  ingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addToCartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.pill,
    backgroundColor: `${COLORS.primary}15`,
    borderWidth: 1,
    borderColor: `${COLORS.primary}55`,
  },
  addToCartText: { color: COLORS.primary, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },

  actionGrid: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap', marginBottom: SPACING.md },
  actionTile: {
    flex: 1,
    minWidth: '22%',
    backgroundColor: COLORS.card,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 4,
  },
  actionLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 0.8, marginTop: 4 },
  actionSub: { color: COLORS.textMuted, fontSize: 9, fontWeight: '700' },

  scanningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: `${COLORS.primary}11`,
    borderColor: `${COLORS.primary}33`,
    borderWidth: 1,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
  },
  scanningText: { color: COLORS.primary, fontWeight: '700', fontSize: 13 },

  macroCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  macroItem: { flex: 1, alignItems: 'center' },
  macroLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  macroValue: { color: COLORS.text, fontSize: 18, fontWeight: '900', marginTop: 4 },
  macroTarget: { color: COLORS.textMuted, fontSize: 10, fontWeight: '600' },
  macroBarTrack: {
    height: 4,
    width: '80%',
    backgroundColor: COLORS.surface,
    borderRadius: 2,
    marginTop: 6,
    overflow: 'hidden',
  },
  macroBarFill: { height: '100%', borderRadius: 2 },

  catBlock: { marginBottom: SPACING.md },
  catHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingHorizontal: 4 },
  catTitle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  catLabel: { color: COLORS.textSecondary, fontWeight: '800', fontSize: 11, letterSpacing: 1 },
  catSum: { color: COLORS.textMuted, fontSize: 10, fontWeight: '800' },

  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  mealName: { color: COLORS.text, fontWeight: '700' },
  mealSub: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  mealCal: { color: COLORS.primary, fontWeight: '900', fontSize: 16 },

  empty: { alignItems: 'center', padding: SPACING.xl },
  emptyTitle: { color: COLORS.textSecondary, fontSize: 16, fontWeight: '700', marginTop: 8 },
  emptySub: { color: COLORS.textMuted, fontSize: 12, marginTop: 4, textAlign: 'center' },

  sectionTitle: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  favRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.card,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  favThumb: { width: 48, height: 48, borderRadius: 8, backgroundColor: COLORS.surface },
  favName: { color: COLORS.text, fontWeight: '700', fontSize: 13 },
  favMeta: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
    maxHeight: '90%',
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  sheetTitle: { color: COLORS.text, fontSize: 18, fontWeight: '900' },

  label: { color: COLORS.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 6, marginTop: SPACING.sm },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    color: COLORS.text,
    fontSize: 14,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: SPACING.sm },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  catChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  catChipText: { color: COLORS.textSecondary, fontWeight: '700', fontSize: 12 },

  primaryBtn: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.md,
  },
  primaryBtnText: { color: '#08110D', fontWeight: '900', fontSize: 13, letterSpacing: 1 },
  cancelBtn: {
    backgroundColor: COLORS.surface,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { color: COLORS.textSecondary, fontWeight: '800', fontSize: 12, letterSpacing: 1 },

  // scan
  scanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  scanHeaderTitle: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  scanHero: { width: '100%', height: 260, backgroundColor: COLORS.surface },
  scanName: { color: COLORS.text, fontSize: 24, fontWeight: '900' },
  scanKcalRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 6, gap: 6 },
  scanKcalBig: { color: COLORS.primary, fontSize: 44, fontWeight: '900' },
  scanKcalUnit: { color: COLORS.textSecondary, fontSize: 16, fontWeight: '700' },
  scanMacros: { flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACING.md, gap: 8 },
  scanFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 8,
    padding: SPACING.md,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  macroBig: {
    flex: 1,
    backgroundColor: COLORS.card,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  macroBigValue: { fontSize: 20, fontWeight: '900' },
  macroBigLabel: { color: COLORS.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 1, marginTop: 2 },

  // chef
  chefLoading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  chefLoadingText: { color: COLORS.textSecondary, fontWeight: '700', fontSize: 14 },

  // recipe detail
  detailHero: { width: '100%', height: 240, backgroundColor: COLORS.surface },
  recipeFullName: { color: COLORS.text, fontSize: 26, fontWeight: '900' },
  recipeFullDesc: { color: COLORS.textSecondary, fontSize: 13, marginTop: 6, lineHeight: 18 },
  recipeStatRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACING.lg, gap: 6 },
  detailMetaRow: { flexDirection: 'row', gap: 8, marginTop: SPACING.md },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  metaText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700' },
  ingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  ingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.primary },
  ingText: { color: COLORS.text, fontSize: 14, flex: 1 },
  stepRow: { flexDirection: 'row', gap: 12, paddingVertical: 8 },
  stepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: '#08110D', fontWeight: '900' },
  stepText: { flex: 1, color: COLORS.text, fontSize: 14, lineHeight: 20 },
  recipeFooter: {
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
});
