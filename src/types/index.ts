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
  increment?: number;  // kg ajoutés quand la fourchette de reps est atteinte (double progression)
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

// ── Shopping list ──────────────────────────────────────────────────────────
export interface ShoppingItem {
  id: string;
  name: string;     // libellé tel que stocké, ex. "Poulet 200g"
  normalized: string; // pour dédoublonnage : minuscules + sans accents
  checked: boolean;
  recipes: string[];  // noms des recettes qui ont contribué cet ingrédient
  addedAt: string;    // ISO
  quantity?: string;  // ex. "1,4 kg" (liste générée depuis le menu)
  category?: GroceryCategory;
  fromPlan?: boolean; // remplacé à chaque nouvelle génération depuis le menu
  note?: string;
}

export type GroceryCategory = 'protein' | 'starch' | 'veg' | 'sauce' | 'pantry' | 'other';

export interface GroceryTrip {
  id: string;
  date: string;      // YYYY-MM-DD
  amount: number;    // total payé, saisi par l'utilisateur
  weeks: number;     // nombre de semaines couvertes par cette épicerie
}

export interface GroceryBudget {
  weekly: number | null; // budget épicerie par semaine, saisi par l'utilisateur
  trips: GroceryTrip[];
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
  // Exclusions alimentaires. Les allergènes et exclusions strictes bloquent une
  // recette dans le code ; les "dislikes" ne sont que des préférences envoyées à l'IA.
  allergens?: AllergenKey[];
  strictExclusions?: string[];
  dislikes?: string[];
  cuisines?: string[];
  // Ajustement des calories décidé au bilan (ex. +200 si le poids stagne).
  calorieAdjustment?: number;
}

// ── Foyer ──────────────────────────────────────────────────────────────────
export type AllergenKey =
  | 'peanut'
  | 'tree_nut'
  | 'milk'
  | 'egg'
  | 'gluten'
  | 'fish'
  | 'shellfish'
  | 'soy'
  | 'sesame';

// Personne avec qui on partage les repas. Le propriétaire de l'app reste
// le `UserProfile` principal (id OWNER_ID).
export interface HouseholdMember extends UserProfile {
  id: string;
}

export interface FoodConflict {
  memberId: string;
  memberName: string;
  label: string;   // ex. "Arachides" ou l'exclusion saisie
  matched: string; // terme trouvé dans la recette
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

// ── Menus de la semaine (mode foyer) ───────────────────────────────────────
// Un plat commun est décrit par ses composants pour UNE portion standard.
// Les portions de chaque personne sont ensuite calculées dans le code
// (utils/portions.ts) : on ne demande pas à l'IA de faire l'arithmétique.
export type ComponentRole = 'protein' | 'starch' | 'veg' | 'sauce';

export interface MealComponent {
  name: string;      // ex. "Attiéké", "Poisson braisé (tilapia)"
  role: ComponentRole;
  grams: number;     // portion standard, cru ou tel qu'acheté
  calories: number;  // pour ces grammes
  protein: number;
  carbs: number;
  fats: number;
}

export interface PortionLine {
  name: string;
  grams: number;
}

export interface MemberPortion {
  memberId: string;
  memberName: string;
  lines: PortionLine[];
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

export type PlanSlot = 'lunch' | 'dinner';

export interface PlannedMeal {
  id: string;
  slot: PlanSlot;
  days: number[];        // 0 = lundi … 6 = dimanche
  name: string;
  desc: string;
  cuisine: string;       // ex. "Ivoirienne"
  prepTime: string;
  costLevel: 1 | 2 | 3;  // $, $$, $$$ (indicatif, pas un prix)
  components: MealComponent[];
  extras: string[];      // assaisonnements et petits ingrédients
  instructions: string[];
  imageKeyword: string;
  image?: string;
  imageCredit?: { author: string; url: string; source: 'Pexels' };
  portions: MemberPortion[];
}

export interface WeekPlan {
  id: string;
  weekStart: string;     // YYYY-MM-DD (lundi)
  createdAt: string;
  dinerIds: string[];
  meals: PlannedMeal[];
  blockedCount: number;  // plats écartés par les exclusions strictes
}

// ── Bilans (poids et mensurations toutes les 2 semaines) ───────────────────
export type MeasureKey =
  | 'neck'
  | 'shoulders'
  | 'chest'
  | 'arm'
  | 'forearm'
  | 'waist'
  | 'hips'
  | 'glutes'
  | 'thigh'
  | 'calf';

export interface CheckIn {
  id: string;
  memberId: string;
  date: string;     // YYYY-MM-DD
  weightKg: number;
  measures: Partial<Record<MeasureKey, number>>; // cm
  appliedAdjustment?: number; // kcal appliquées après ce bilan
}
