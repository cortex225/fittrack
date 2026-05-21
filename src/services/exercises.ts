import {
  EXERCISES,
  ExerciseDef,
  ExerciseEquipment,
  ExerciseLevel,
  ExerciseMuscle,
} from '../data/exercises';

export type Location = 'home' | 'gym' | 'any';

// Mapping équipement → lieu accessible.
// Maison : tout ce qu'on peut raisonnablement avoir chez soi.
// Salle : barres, machines, câbles, EZ curl.
const HOME_EQUIPMENT: ExerciseEquipment[] = [
  'body only', 'bands', 'dumbbell', 'kettlebells',
  'medicine ball', 'exercise ball', 'foam roll',
];
const GYM_EQUIPMENT: ExerciseEquipment[] = [
  'barbell', 'cable', 'machine', 'e-z curl bar',
];
// 'other' et null sont disponibles partout.

export const equipmentMatchesLocation = (
  equipment: ExerciseEquipment,
  location: Location
): boolean => {
  if (location === 'any') return true;
  if (equipment === 'other' || equipment === null) return true;
  if (location === 'home') return HOME_EQUIPMENT.includes(equipment);
  if (location === 'gym') return GYM_EQUIPMENT.includes(equipment) || HOME_EQUIPMENT.includes(equipment);
  return true;
};

export interface SearchFilters {
  query?: string;
  muscles?: ExerciseMuscle[];     // OR : match si au moins un muscle est ciblé (primaire OU secondaire)
  equipment?: ExerciseEquipment[]; // OR
  level?: ExerciseLevel[];        // OR
  location?: Location;
  limit?: number;
}

export function searchExercises(filters: SearchFilters = {}): ExerciseDef[] {
  const q = (filters.query ?? '').trim().toLowerCase();
  const result = EXERCISES.filter((ex) => {
    if (filters.location && filters.location !== 'any') {
      if (!equipmentMatchesLocation(ex.equipment, filters.location)) return false;
    }
    if (filters.muscles?.length) {
      const all = [...ex.primaryMuscles, ...ex.secondaryMuscles];
      if (!filters.muscles.some((m) => all.includes(m))) return false;
    }
    if (filters.equipment?.length) {
      if (!filters.equipment.includes(ex.equipment)) return false;
    }
    if (filters.level?.length) {
      if (!filters.level.includes(ex.level)) return false;
    }
    if (q) {
      if (!ex.name.toLowerCase().includes(q)) return false;
    }
    return true;
  });
  return filters.limit ? result.slice(0, filters.limit) : result;
}

export const findExerciseById = (id: string): ExerciseDef | undefined =>
  EXERCISES.find((e) => e.id === id);

// Fuzzy match d'un nom (utile pour mapper une séance générée par l'IA aux entrées du catalogue)
export function findExerciseByName(name: string): ExerciseDef | undefined {
  const target = name.toLowerCase().trim();
  // 1. Match exact
  let hit = EXERCISES.find((e) => e.name.toLowerCase() === target);
  if (hit) return hit;
  // 2. Match par inclusion
  hit = EXERCISES.find((e) => e.name.toLowerCase().includes(target) || target.includes(e.name.toLowerCase()));
  if (hit) return hit;
  // 3. Match par tokens (au moins 60% des mots du nom recherché présents dans un nom du catalogue)
  const tokens = target.split(/\s+/).filter((t) => t.length > 2);
  if (tokens.length === 0) return undefined;
  let bestScore = 0;
  let best: ExerciseDef | undefined;
  for (const ex of EXERCISES) {
    const exName = ex.name.toLowerCase();
    const score = tokens.filter((t) => exName.includes(t)).length / tokens.length;
    if (score > bestScore && score >= 0.6) {
      bestScore = score;
      best = ex;
    }
  }
  return best;
}

// ── Traductions FR ─────────────────────────────────────────────────────────
export const MUSCLE_FR: Record<ExerciseMuscle, string> = {
  abdominals: 'Abdos',
  abductors: 'Abducteurs',
  adductors: 'Adducteurs',
  biceps: 'Biceps',
  calves: 'Mollets',
  chest: 'Pectoraux',
  forearms: 'Avant-bras',
  glutes: 'Fessiers',
  hamstrings: 'Ischios',
  lats: 'Grand dorsal',
  'lower back': 'Lombaires',
  'middle back': 'Dos (milieu)',
  neck: 'Cou',
  quadriceps: 'Quadriceps',
  shoulders: 'Épaules',
  traps: 'Trapèzes',
  triceps: 'Triceps',
};

export const muscleFR = (m: ExerciseMuscle): string => MUSCLE_FR[m] ?? m;

export const EQUIPMENT_FR: Record<NonNullable<ExerciseEquipment>, string> = {
  bands: 'Élastiques',
  barbell: 'Barre',
  'body only': 'Poids du corps',
  cable: 'Poulie',
  dumbbell: 'Haltères',
  'e-z curl bar': 'Barre EZ',
  'exercise ball': 'Swiss ball',
  'foam roll': 'Foam roller',
  kettlebells: 'Kettlebells',
  machine: 'Machine',
  'medicine ball': 'Medicine ball',
  other: 'Autre',
};

export const equipmentFR = (e: ExerciseEquipment): string =>
  e ? (EQUIPMENT_FR[e] ?? e) : 'Aucun';

export const LEVEL_FR: Record<ExerciseLevel, string> = {
  beginner: 'Débutant',
  intermediate: 'Intermédiaire',
  expert: 'Avancé',
};

export const levelFR = (l: ExerciseLevel): string => LEVEL_FR[l] ?? l;

export const LEVEL_COLOR: Record<ExerciseLevel, string> = {
  beginner: '#10B981',
  intermediate: '#F59E0B',
  expert: '#EF4444',
};

// Listes pour les UI de filtres
export const ALL_MUSCLES: ExerciseMuscle[] = Object.keys(MUSCLE_FR) as ExerciseMuscle[];
export const ALL_EQUIPMENT: NonNullable<ExerciseEquipment>[] =
  Object.keys(EQUIPMENT_FR) as NonNullable<ExerciseEquipment>[];
export const ALL_LEVELS: ExerciseLevel[] = ['beginner', 'intermediate', 'expert'];
