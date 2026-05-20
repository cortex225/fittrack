export interface Set {
  id: string;
  reps: number;
  weight: number;
  completed: boolean;
}

export interface Exercise {
  id: string;
  name: string;
  sets: Set[];
}

export interface Workout {
  id: string;
  name: string;
  date: string; // ISO
  duration: number; // seconds
  exercises: Exercise[];
}

export type GoalType = 'cut' | 'maintain' | 'bulk';

export interface Meal {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  category: 'breakfast' | 'lunch' | 'dinner' | 'snack';
}

export interface NutritionLog {
  date: string; // YYYY-MM-DD
  meals: Meal[];
  water: number; // ml
}

export interface WeightEntry {
  date: string; // YYYY-MM-DD
  weight: number; // kg
}

export interface UserProfile {
  goal: GoalType;
  targetCalories: number;
  targetProtein: number;
  targetCarbs: number;
  targetFats: number;
  targetWater: number; // ml
}
