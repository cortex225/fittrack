import AsyncStorage from '@react-native-async-storage/async-storage';
import { Workout } from '../types';

const STORAGE_KEY = '@fittrack_workouts';

export const saveWorkout = async (workout: Workout): Promise<void> => {
  const existing = await getWorkouts();
  const updated = [workout, ...existing];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
};

export const getWorkouts = async (): Promise<Workout[]> => {
  const data = await AsyncStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
};

export const deleteWorkout = async (id: string): Promise<void> => {
  const workouts = await getWorkouts();
  const updated = workouts.filter((w) => w.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
};

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
