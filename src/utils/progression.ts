import { Exercise, LibraryExercise, Workout } from '../types';
import { normalizeFoodText } from './allergens';

// Double progression : même charge tant que toutes les séries n'atteignent
// pas le haut de la fourchette ; ensuite +increment et retour au bas.

export const parseRepRange = (reps: string): { min: number; max: number } | null => {
  const m = reps.match(/(\d+)\s*[-–à]\s*(\d+)/);
  if (m) return { min: Number(m[1]), max: Number(m[2]) };
  const single = reps.match(/^\s*(\d+)\s*$/);
  return single ? { min: Number(single[1]), max: Number(single[1]) } : null;
};

const sameExercise = (a: string, b: string) => normalizeFoodText(a).trim() === normalizeFoodText(b).trim();

export interface LastPerformance {
  date: string;
  sets: { weight: number; reps: number }[];
}

// Dernière séance où l'exercice a des séries terminées avec une charge.
export const findLastPerformance = (workouts: Workout[], name: string): LastPerformance | null => {
  for (const w of workouts) {
    const ex = w.exercises.find((e) => sameExercise(e.name, name));
    const sets = ex?.sets.filter((s) => s.completed && s.reps > 0) ?? [];
    if (sets.length) return { date: w.date, sets: sets.map((s) => ({ weight: s.weight, reps: s.reps })) };
  }
  return null;
};

export interface Suggestion {
  weight: number;
  reps: number[]; // cible par série
  bumped: boolean; // true si la charge monte aujourd'hui
}

export const suggestNext = (ex: LibraryExercise, last: LastPerformance | null): Suggestion | null => {
  const range = parseRepRange(ex.reps);
  if (!range || !last) return null;
  const weight = Math.max(...last.sets.map((s) => s.weight));
  const topSets = last.sets.filter((s) => s.weight === weight);
  const allTop = topSets.length >= ex.sets && topSets.every((s) => s.reps >= range.max);
  if (allTop && ex.increment) {
    return { weight: weight + ex.increment, reps: Array(ex.sets).fill(range.min), bumped: true };
  }
  const reps = Array.from({ length: ex.sets }, (_, i) => {
    const prev = topSets[i]?.reps ?? range.min;
    return Math.min(range.max, Math.max(range.min, prev + 1));
  });
  return { weight, reps, bumped: false };
};

// 1RM estimé (Epley), pour repérer les records.
export const estimate1RM = (weight: number, reps: number): number =>
  reps <= 0 || weight <= 0 ? 0 : weight * (1 + reps / 30);

export const bestEstimate = (sets: { weight: number; reps: number; completed?: boolean }[]): number =>
  Math.max(0, ...sets.filter((s) => s.completed !== false).map((s) => estimate1RM(s.weight, s.reps)));

// Records battus pendant la séance, comparés à tout l'historique.
export const findRecords = (session: Exercise[], history: Workout[]): { name: string; e1rm: number }[] =>
  session
    .map((ex) => {
      const now = bestEstimate(ex.sets.filter((s) => s.completed));
      const before = Math.max(
        0,
        ...history.flatMap((w) => w.exercises.filter((e) => sameExercise(e.name, ex.name)).map((e) => bestEstimate(e.sets.filter((s) => s.completed))))
      );
      return { name: ex.name, e1rm: now, before };
    })
    .filter((r) => r.e1rm > 0 && r.before > 0 && r.e1rm > r.before)
    .map(({ name, e1rm }) => ({ name, e1rm: Math.round(e1rm * 10) / 10 }));

export const formatKg = (kg: number): string => `${kg.toLocaleString('fr-CA')} kg`;
