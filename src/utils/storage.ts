import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import {
  AppSettings,
  Gamification,
  GoalType,
  NutritionLog,
  Recipe,
  UserProfile,
  WeightEntry,
  Workout,
} from '../types';
import { LEVELS } from '../data/library';

const KEYS = {
  WORKOUTS: '@jlfit_workouts',
  NUTRITION_PREFIX: '@jlfit_nutrition_',
  WEIGHT: '@jlfit_weight',
  PROFILE: '@jlfit_profile',
  GAMIFICATION: '@jlfit_gamification',
  SETTINGS: '@jlfit_settings',
  FAVORITES: '@jlfit_favorites',
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

export const computeTargetsForGoal = (profile: UserProfile, goal: GoalType): UserProfile => {
  const calorieOffset = GOAL_CONFIGS[goal].calorieOffset;
  const targetCalories = Math.round(profile.tee + calorieOffset);
  // protein ~2g/kg, fats ~0.9g/kg, rest = carbs
  const targetProtein = Math.round(profile.weightKg * 2);
  const targetFats = Math.round(profile.weightKg * 0.9);
  const kcalFromProtFat = targetProtein * 4 + targetFats * 9;
  const targetCarbs = Math.max(0, Math.round((targetCalories - kcalFromProtFat) / 4));
  return {
    ...profile,
    goal,
    targetCalories,
    targetProtein,
    targetCarbs,
    targetFats,
  };
};

export const GOAL_CONFIGS: Record<GoalType, { label: string; calorieOffset: number; color: string }> = {
  cut:      { label: 'Sèche',    calorieOffset: -500, color: '#EF4444' },
  maintain: { label: 'Maintien', calorieOffset: 0,    color: '#10B981' },
  bulk:     { label: 'Masse',    calorieOffset: 300,  color: '#3B82F6' },
};

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
  // refresh hasApiKey from secure store
  const key = await getApiKey();
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
  await AsyncStorage.multiRemove(jlKeys);
  try {
    await SecureStore.deleteItemAsync(SECURE_KEYS.GEMINI_API_KEY);
  } catch {
    // noop
  }
};
