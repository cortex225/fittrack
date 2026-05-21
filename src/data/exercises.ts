import raw from './exercises.json';

export type ExerciseLevel = 'beginner' | 'intermediate' | 'expert';
export type ExerciseForce = 'push' | 'pull' | 'static' | null;
export type ExerciseMechanic = 'compound' | 'isolation' | null;

export type ExerciseEquipment =
  | 'bands'
  | 'barbell'
  | 'body only'
  | 'cable'
  | 'dumbbell'
  | 'e-z curl bar'
  | 'exercise ball'
  | 'foam roll'
  | 'kettlebells'
  | 'machine'
  | 'medicine ball'
  | 'other'
  | null;

export type ExerciseCategory =
  | 'cardio'
  | 'olympic weightlifting'
  | 'plyometrics'
  | 'powerlifting'
  | 'strength'
  | 'stretching'
  | 'strongman';

export type ExerciseMuscle =
  | 'abdominals' | 'abductors' | 'adductors' | 'biceps' | 'calves' | 'chest'
  | 'forearms' | 'glutes' | 'hamstrings' | 'lats' | 'lower back' | 'middle back'
  | 'neck' | 'quadriceps' | 'shoulders' | 'traps' | 'triceps';

export interface ExerciseDef {
  id: string;
  name: string;
  force: ExerciseForce;
  level: ExerciseLevel;
  mechanic: ExerciseMechanic;
  equipment: ExerciseEquipment;
  primaryMuscles: ExerciseMuscle[];
  secondaryMuscles: ExerciseMuscle[];
  instructions: string[];
  category: ExerciseCategory;
  images: string[]; // chemins relatifs au repo, ex "3_4_Sit-Up/0.jpg"
}

export const EXERCISES: ExerciseDef[] = raw as ExerciseDef[];

const IMAGE_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';

export const exerciseImageUrl = (relativePath: string): string =>
  `${IMAGE_BASE}${relativePath}`;

export const exerciseImageUrls = (ex: ExerciseDef): string[] =>
  ex.images.map(exerciseImageUrl);
