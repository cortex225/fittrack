import AsyncStorage from '@react-native-async-storage/async-storage';
import { Workout, NutritionLog, WeightEntry, UserProfile, GoalType } from '../types';

const KEYS = {
  WORKOUTS: '@fittrack_workouts',
  NUTRITION: '@fittrack_nutrition',
  WEIGHT: '@fittrack_weight',
  PROFILE: '@fittrack_profile',
};

// ── Workouts ──────────────────────────────────────────────────
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
  await AsyncStorage.setItem(KEYS.WORKOUTS, JSON.stringify(workouts.filter((w) => w.id !== id)));
};

// ── Nutrition ────────────────────────────────────────────────
export const getTodayKey = (): string => new Date().toISOString().split('T')[0];

export const getTodayNutrition = async (): Promise<NutritionLog> => {
  const key = getTodayKey();
  const data = await AsyncStorage.getItem(`${KEYS.NUTRITION}_${key}`);
  return data ? JSON.parse(data) : { date: key, meals: [], water: 0 };
};

export const saveNutritionLog = async (log: NutritionLog): Promise<void> => {
  await AsyncStorage.setItem(`${KEYS.NUTRITION}_${log.date}`, JSON.stringify(log));
};

// ── Weight ───────────────────────────────────────────────────
export const getWeightHistory = async (): Promise<WeightEntry[]> => {
  const data = await AsyncStorage.getItem(KEYS.WEIGHT);
  return data ? JSON.parse(data) : [];
};

export const saveWeightEntry = async (entry: WeightEntry): Promise<void> => {
  const history = await getWeightHistory();
  const filtered = history.filter((e) => e.date !== entry.date);
  await AsyncStorage.setItem(KEYS.WEIGHT, JSON.stringify([entry, ...filtered].slice(0, 90)));
};

// ── Profile ──────────────────────────────────────────────────
const DEFAULT_PROFILE: UserProfile = {
  goal: 'maintain',
  targetCalories: 2200,
  targetProtein: 160,
  targetCarbs: 240,
  targetFats: 70,
  targetWater: 2500,
};

export const getProfile = async (): Promise<UserProfile> => {
  const data = await AsyncStorage.getItem(KEYS.PROFILE);
  return data ? { ...DEFAULT_PROFILE, ...JSON.parse(data) } : DEFAULT_PROFILE;
};

export const saveProfile = async (profile: Partial<UserProfile>): Promise<void> => {
  const current = await getProfile();
  await AsyncStorage.setItem(KEYS.PROFILE, JSON.stringify({ ...current, ...profile }));
};

export const GOAL_CONFIGS: Record<GoalType, { label: string; calorieOffset: number; color: string }> = {
  cut:      { label: 'Sèche',    calorieOffset: -500, color: '#FF6584' },
  maintain: { label: 'Maintien', calorieOffset: 0,    color: '#6C63FF' },
  bulk:     { label: 'Masse',    calorieOffset: 300,  color: '#4CAF50' },
};

// ── Utils ─────────────────────────────────────────────────────
export const generateId = (): string =>
  Math.random().toString(36).substring(2) + Date.now().toString(36);

export const formatDuration = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
};

export const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-CA', { weekday: 'short', month: 'short', day: 'numeric' });
};
