export type GoalType = 'cut' | 'maintain' | 'bulk';

export type MealCategory = 'breakfast' | 'lunch' | 'dinner' | 'snack';

// ── Workouts ───────────────────────────────────────────────────────────────
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
  muscleGroup?: string;
}

export interface Workout {
  id: string;
  name: string;
  date: string; // ISO
  duration: number; // seconds
  exercises: Exercise[];
}

// Library exercise (template for sessions, not logged)
export interface LibraryExercise {
  name: string;
  sets: number;
  reps: string;
  rest: number;
  setup?: string;
  execution?: string;
  mistakes?: string[];
  goalSpecificTip?: string;
  gifUrl?: string;
}

export interface WorkoutSession {
  title: string;
  focus: string;
  type: string;
  exercises: LibraryExercise[];
}

export interface ScheduleDay {
  id: number;
  dayName: string;
  title: string;
  focus: string;
  type: string;
}

// ── Nutrition ──────────────────────────────────────────────────────────────
export interface Meal {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  category: MealCategory;
  loggedAt?: string;
}

export interface NutritionLog {
  date: string; // YYYY-MM-DD
  meals: Meal[];
  water: number; // ml
}

export interface Recipe {
  name: string;
  desc: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  prepTime: string;
  difficulty: string;
  ingredients: string[];
  instructions: string[];
  imageKeyword: string;
  image?: string;
}

// ── Body metrics ───────────────────────────────────────────────────────────
export interface WeightEntry {
  date: string; // YYYY-MM-DD
  weight: number; // kg
}

// ── User profile ───────────────────────────────────────────────────────────
export interface UserProfile {
  name: string;
  goal: GoalType;
  weightKg: number;
  heightCm: number;
  age: number;
  sex: 'male' | 'female' | 'other';
  tee: number;            // total energy expenditure
  targetCalories: number;
  targetProtein: number;
  targetCarbs: number;
  targetFats: number;
  targetWater: number;    // ml
}

// ── Gamification ───────────────────────────────────────────────────────────
export interface Level {
  level: number;
  name: string;
  xpNeeded: number;
}

export interface Gamification {
  xp: number;
  level: number;
}

// ── Settings ───────────────────────────────────────────────────────────────
export interface AppSettings {
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  hasApiKey: boolean; // mirror only — key stored in SecureStore
}
