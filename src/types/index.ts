export type GoalType = 'cut' | 'maintain' | 'bulk';

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

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
  exerciseId?: string;       // ref vers le catalogue free-exercise-db
  musclesWorked?: string[];  // union primaires + secondaires (stockés en EN comme dans le dataset)
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
  exerciseId?: string; // ref vers le catalogue ExerciseDB (free-exercise-db)
}

export interface WorkoutSession {
  title: string;
  focus: string;
  type: string;
  exercises: LibraryExercise[];
}

// Séance créée manuellement par l'utilisateur, sauvegardée pour réutilisation.
export interface CustomWorkout {
  id: string;
  name: string;
  focus: string;
  exercises: LibraryExercise[];
  createdAt: string; // ISO
  updatedAt: string; // ISO
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
  activityLevel: ActivityLevel;
  tee: number;            // total energy expenditure (auto-calculé)
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
