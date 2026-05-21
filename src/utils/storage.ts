import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import {
  AppSettings,
  CustomWorkout,
  Gamification,
  GoalType,
  LibraryExercise,
  NutritionLog,
  Recipe,
  ShoppingItem,
  UserProfile,
  WeightEntry,
  Workout,
  WorkoutSession,
} from '../types';
import { LEVELS } from '../data/library';
import {
  computeBMR,
  computeSafeCalorieOffset,
  computeTDEE,
} from './health';

const KEYS = {
  WORKOUTS: '@jlfit_workouts',
  NUTRITION_PREFIX: '@jlfit_nutrition_',
  WEIGHT: '@jlfit_weight',
  PROFILE: '@jlfit_profile',
  GAMIFICATION: '@jlfit_gamification',
  SETTINGS: '@jlfit_settings',
  FAVORITES: '@jlfit_favorites',
  CUSTOM_WORKOUTS: '@jlfit_custom_workouts',
  SHOPPING: '@jlfit_shopping',
};

const SECURE_KEYS = {
  GEMINI_API_KEY: 'jlfit_gemini_key',
};

// ── Utils ──────────────────────────────────────────────────────────────────
export const generateId = (): string =>
  Math.random().toString(36).substring(2) + Date.now().toString(36);

export const getTodayKey = (): string => new Date().toISOString().split('T')[0];

export const formatDateKey = (date: Date): string => date.toISOString().split('T')[0];

export const formatDuration = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
};

export const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-CA', { weekday: 'short', month: 'short', day: 'numeric' });
};

// ── Workouts ───────────────────────────────────────────────────────────────
export const saveWorkout = async (workout: Workout): Promise<void> => {
  const existing = await getWorkouts();
  await AsyncStorage.setItem(KEYS.WORKOUTS, JSON.stringify([workout, ...existing]));
};

export const getWorkouts = async (): Promise<Workout[]> => {
  const data = await AsyncStorage.getItem(KEYS.WORKOUTS);
  return data ? JSON.parse(data) : [];
};

export const deleteWorkout = async (id: string): Promise<void> => {
  const workouts = await getWorkouts();
  await AsyncStorage.setItem(
    KEYS.WORKOUTS,
    JSON.stringify(workouts.filter((w) => w.id !== id))
  );
};

// Résumé textuel des séances des N derniers jours, à injecter dans le contexte IA.
// Calcule : nombre de séances, durée totale, tonnage par muscle, exos les plus fréquents.
export const getRecentTrainingContext = async (days = 7): Promise<string> => {
  const workouts = await getWorkouts();
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const recent = workouts.filter((w) => new Date(w.date).getTime() >= since);
  if (recent.length === 0) {
    return `Aucune séance loggée sur les ${days} derniers jours.`;
  }

  const muscleVolume: Record<string, number> = {};
  const exerciseFreq: Record<string, number> = {};
  let totalSets = 0;
  let totalReps = 0;
  let totalDurationMin = 0;

  for (const w of recent) {
    totalDurationMin += Math.round(w.duration / 60);
    for (const ex of w.exercises) {
      const completedSets = ex.sets.filter((s) => s.completed);
      totalSets += completedSets.length;
      const reps = completedSets.reduce((sum, s) => sum + s.reps, 0);
      totalReps += reps;
      exerciseFreq[ex.name] = (exerciseFreq[ex.name] ?? 0) + completedSets.length;
      // Le tonnage approximatif (sets complétés) par muscle
      if (ex.musclesWorked?.length) {
        for (const m of ex.musclesWorked) {
          muscleVolume[m] = (muscleVolume[m] ?? 0) + completedSets.length;
        }
      }
    }
  }

  const topMuscles = Object.entries(muscleVolume)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([m, v]) => `${m}: ${v} séries`)
    .join(', ');

  const topExercises = Object.entries(exerciseFreq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([n]) => n)
    .join(', ');

  return [
    `Historique ${days}j : ${recent.length} séance${recent.length > 1 ? 's' : ''}, ${totalDurationMin} min cumulées, ${totalSets} séries / ${totalReps} reps complétées.`,
    topMuscles ? `Volume par muscle : ${topMuscles}.` : '',
    topExercises ? `Exercices les plus pratiqués : ${topExercises}.` : '',
  ].filter(Boolean).join(' ');
};

// ── Nutrition (per-day) ────────────────────────────────────────────────────
const nutritionKey = (date: string) => `${KEYS.NUTRITION_PREFIX}${date}`;

export const getNutritionLog = async (date: string): Promise<NutritionLog> => {
  const raw = await AsyncStorage.getItem(nutritionKey(date));
  return raw ? JSON.parse(raw) : { date, meals: [], water: 0 };
};

export const getTodayNutrition = async (): Promise<NutritionLog> =>
  getNutritionLog(getTodayKey());

export const saveNutritionLog = async (log: NutritionLog): Promise<void> => {
  await AsyncStorage.setItem(nutritionKey(log.date), JSON.stringify(log));
};

// Récupère les kcal/jour sur N jours (du plus ancien au plus récent).
export const getNutritionKcalRange = async (days: number): Promise<number[]> => {
  const out: number[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const log = await getNutritionLog(formatDateKey(d));
    out.push(log.meals.reduce((a, m) => a + m.calories, 0));
  }
  return out;
};

// ── Weight ─────────────────────────────────────────────────────────────────
export const getWeightHistory = async (): Promise<WeightEntry[]> => {
  const data = await AsyncStorage.getItem(KEYS.WEIGHT);
  const list: WeightEntry[] = data ? JSON.parse(data) : [];
  return list.sort((a, b) => a.date.localeCompare(b.date));
};

export const saveWeightEntry = async (entry: WeightEntry): Promise<void> => {
  const history = await getWeightHistory();
  const filtered = history.filter((e) => e.date !== entry.date);
  await AsyncStorage.setItem(
    KEYS.WEIGHT,
    JSON.stringify([entry, ...filtered].slice(0, 365))
  );
};

// ── Profile ────────────────────────────────────────────────────────────────
const DEFAULT_PROFILE: UserProfile = {
  name: 'Athlète',
  goal: 'maintain',
  weightKg: 80,
  heightCm: 178,
  age: 30,
  sex: 'male',
  activityLevel: 'moderate',
  tee: 2700,
  targetCalories: 2700,
  targetProtein: 160,
  targetCarbs: 280,
  targetFats: 80,
  targetWater: 2500,
};

export const getProfile = async (): Promise<UserProfile> => {
  const data = await AsyncStorage.getItem(KEYS.PROFILE);
  if (!data) return DEFAULT_PROFILE;
  return { ...DEFAULT_PROFILE, ...JSON.parse(data) };
};

export const saveProfile = async (profile: Partial<UserProfile>): Promise<UserProfile> => {
  const current = await getProfile();
  const next = { ...current, ...profile };
  await AsyncStorage.setItem(KEYS.PROFILE, JSON.stringify(next));
  return next;
};

// Recalcule TEE, calories cibles et macros à partir du poids/taille/âge/sexe/activité/objectif.
// TEE est auto-dérivé (BMR Mifflin-St Jeor × facteur d'activité). L'utilisateur n'a plus à le saisir.
export const computeTargetsForGoal = (profile: UserProfile, goal: GoalType): UserProfile => {
  const bmr = computeBMR(profile);
  const tee = computeTDEE(bmr, profile.activityLevel);
  const calorieOffset = computeSafeCalorieOffset(tee, goal);
  const targetCalories = Math.round(tee + calorieOffset);
  // Protéines : 2.0 g/kg en sèche, 1.8 g/kg ailleurs (préserve la masse maigre en déficit).
  // Lipides : 0.9 g/kg.
  const proteinPerKg = goal === 'cut' ? 2.0 : 1.8;
  const targetProtein = Math.round(profile.weightKg * proteinPerKg);
  const targetFats = Math.round(profile.weightKg * 0.9);
  const kcalFromProtFat = targetProtein * 4 + targetFats * 9;
  const targetCarbs = Math.max(0, Math.round((targetCalories - kcalFromProtFat) / 4));
  // Hydratation : 35 ml/kg, plancher 2 L.
  const targetWater = Math.max(2000, Math.round(profile.weightKg * 35));
  return {
    ...profile,
    goal,
    tee,
    targetCalories,
    targetProtein,
    targetCarbs,
    targetFats,
    targetWater,
  };
};

// Conservé pour compat avec les écrans existants qui affichent les couleurs/labels.
// La logique kcal est désormais dans utils/health.ts (GOAL_CONFIGS canonique).
export { GOAL_CONFIGS } from './health';

// ── Gamification ───────────────────────────────────────────────────────────
const DEFAULT_GAMIFICATION: Gamification = { xp: 0, level: 1 };

export const getGamification = async (): Promise<Gamification> => {
  const data = await AsyncStorage.getItem(KEYS.GAMIFICATION);
  return data ? JSON.parse(data) : DEFAULT_GAMIFICATION;
};

export const saveGamification = async (state: Gamification): Promise<void> => {
  await AsyncStorage.setItem(KEYS.GAMIFICATION, JSON.stringify(state));
};

export interface XpResult {
  state: Gamification;
  leveledUpTo: number | null;
}

export const addXp = async (amount: number): Promise<XpResult> => {
  const current = await getGamification();
  const newXp = current.xp + amount;
  let level = current.level;
  let leveledUpTo: number | null = null;
  for (const lvl of LEVELS) {
    if (newXp >= lvl.xpNeeded && lvl.level > level) {
      level = lvl.level;
      leveledUpTo = lvl.level;
    }
  }
  const next: Gamification = { xp: newXp, level };
  await saveGamification(next);
  return { state: next, leveledUpTo };
};

// ── Settings ───────────────────────────────────────────────────────────────
const DEFAULT_SETTINGS: AppSettings = {
  soundEnabled: true,
  hapticsEnabled: true,
  hasApiKey: false,
};

export const getSettings = async (): Promise<AppSettings> => {
  const data = await AsyncStorage.getItem(KEYS.SETTINGS);
  const stored = data ? JSON.parse(data) : DEFAULT_SETTINGS;
  // hasApiKey = vrai si clé embarquée OU clé stockée sur l'appareil.
  const embedded = (process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '').length > 0;
  const key = embedded ? 'embedded' : await getApiKey();
  return { ...DEFAULT_SETTINGS, ...stored, hasApiKey: !!key };
};

export const saveSettings = async (next: Partial<AppSettings>): Promise<AppSettings> => {
  const current = await getSettings();
  const merged = { ...current, ...next };
  await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(merged));
  return merged;
};

// ── Gemini API key (SecureStore) ───────────────────────────────────────────
export const getApiKey = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(SECURE_KEYS.GEMINI_API_KEY);
  } catch {
    return null;
  }
};

export const setApiKey = async (key: string): Promise<void> => {
  if (!key) {
    await SecureStore.deleteItemAsync(SECURE_KEYS.GEMINI_API_KEY);
  } else {
    await SecureStore.setItemAsync(SECURE_KEYS.GEMINI_API_KEY, key);
  }
};

// ── Custom workouts (séances perso sauvegardées) ───────────────────────────
export const getCustomWorkouts = async (): Promise<CustomWorkout[]> => {
  const data = await AsyncStorage.getItem(KEYS.CUSTOM_WORKOUTS);
  return data ? JSON.parse(data) : [];
};

export const saveCustomWorkout = async (workout: CustomWorkout): Promise<CustomWorkout[]> => {
  const list = await getCustomWorkouts();
  const idx = list.findIndex((w) => w.id === workout.id);
  const next = workout;
  let updated: CustomWorkout[];
  if (idx >= 0) {
    updated = list.map((w, i) => (i === idx ? { ...next, updatedAt: new Date().toISOString() } : w));
  } else {
    updated = [{ ...next, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, ...list];
  }
  await AsyncStorage.setItem(KEYS.CUSTOM_WORKOUTS, JSON.stringify(updated));
  return updated;
};

export const deleteCustomWorkout = async (id: string): Promise<CustomWorkout[]> => {
  const list = await getCustomWorkouts();
  const updated = list.filter((w) => w.id !== id);
  await AsyncStorage.setItem(KEYS.CUSTOM_WORKOUTS, JSON.stringify(updated));
  return updated;
};

export const duplicateCustomWorkout = async (id: string): Promise<CustomWorkout[]> => {
  const list = await getCustomWorkouts();
  const src = list.find((w) => w.id === id);
  if (!src) return list;
  const copy: CustomWorkout = {
    ...src,
    id: generateId(),
    name: `${src.name} (copie)`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const updated = [copy, ...list];
  await AsyncStorage.setItem(KEYS.CUSTOM_WORKOUTS, JSON.stringify(updated));
  return updated;
};

// Convertit une CustomWorkout en WorkoutSession lançable par LiveWorkoutScreen.
export const customToSession = (cw: CustomWorkout): WorkoutSession => ({
  title: cw.name,
  focus: cw.focus,
  type: 'Custom',
  exercises: cw.exercises,
});

// Factory pour créer un LibraryExercise par défaut (utilisé dans le builder)
export const defaultLibraryExercise = (overrides: Partial<LibraryExercise>): LibraryExercise => ({
  name: '',
  sets: 3,
  reps: '10',
  rest: 60,
  ...overrides,
});

// ── Shopping list (consolidée par nom normalisé) ───────────────────────────
const normalizeIngredient = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

export const getShoppingList = async (): Promise<ShoppingItem[]> => {
  const data = await AsyncStorage.getItem(KEYS.SHOPPING);
  return data ? JSON.parse(data) : [];
};

const persistShoppingList = (list: ShoppingItem[]) =>
  AsyncStorage.setItem(KEYS.SHOPPING, JSON.stringify(list));

export const addIngredientsToShoppingList = async (
  ingredients: string[],
  recipeName: string
): Promise<ShoppingItem[]> => {
  const list = await getShoppingList();
  const map = new Map<string, ShoppingItem>(list.map((it) => [it.normalized, it]));

  for (const raw of ingredients) {
    const name = raw.trim();
    if (!name) continue;
    const key = normalizeIngredient(name);
    if (!key) continue;
    const existing = map.get(key);
    if (existing) {
      if (!existing.recipes.includes(recipeName)) existing.recipes = [...existing.recipes, recipeName];
    } else {
      map.set(key, {
        id: generateId(),
        name,
        normalized: key,
        checked: false,
        recipes: [recipeName],
        addedAt: new Date().toISOString(),
      });
    }
  }

  const next = Array.from(map.values()).sort((a, b) => Number(a.checked) - Number(b.checked));
  await persistShoppingList(next);
  return next;
};

export const addManualShoppingItem = async (name: string): Promise<ShoppingItem[]> => {
  const list = await getShoppingList();
  const key = normalizeIngredient(name);
  if (!key) return list;
  if (list.some((it) => it.normalized === key)) return list;
  const next: ShoppingItem[] = [
    {
      id: generateId(),
      name: name.trim(),
      normalized: key,
      checked: false,
      recipes: [],
      addedAt: new Date().toISOString(),
    },
    ...list,
  ];
  await persistShoppingList(next);
  return next;
};

export const toggleShoppingItem = async (id: string): Promise<ShoppingItem[]> => {
  const list = await getShoppingList();
  const next = list
    .map((it) => (it.id === id ? { ...it, checked: !it.checked } : it))
    .sort((a, b) => Number(a.checked) - Number(b.checked));
  await persistShoppingList(next);
  return next;
};

export const removeShoppingItem = async (id: string): Promise<ShoppingItem[]> => {
  const list = await getShoppingList();
  const next = list.filter((it) => it.id !== id);
  await persistShoppingList(next);
  return next;
};

export const clearCheckedShoppingItems = async (): Promise<ShoppingItem[]> => {
  const list = await getShoppingList();
  const next = list.filter((it) => !it.checked);
  await persistShoppingList(next);
  return next;
};

export const clearShoppingList = async (): Promise<ShoppingItem[]> => {
  await persistShoppingList([]);
  return [];
};

// ── Favorites (recipes) ────────────────────────────────────────────────────
export const getFavorites = async (): Promise<Recipe[]> => {
  const data = await AsyncStorage.getItem(KEYS.FAVORITES);
  return data ? JSON.parse(data) : [];
};

export const saveFavorites = async (favorites: Recipe[]): Promise<void> => {
  await AsyncStorage.setItem(KEYS.FAVORITES, JSON.stringify(favorites));
};

// ── Reset (settings/debug) ─────────────────────────────────────────────────
export const wipeAllData = async (): Promise<void> => {
  const keys = await AsyncStorage.getAllKeys();
  const jlKeys = keys.filter((k) => k.startsWith('@jlfit_'));
  await AsyncStorage.multiRemove([...jlKeys, KEYS.CUSTOM_WORKOUTS]);
  try {
    await SecureStore.deleteItemAsync(SECURE_KEYS.GEMINI_API_KEY);
  } catch {
    // noop
  }
};
