import { ActivityLevel, GoalType, UserProfile } from '../types';

// ── BMI ────────────────────────────────────────────────────────────────────
export const computeBMI = (weightKg: number, heightCm: number): number => {
  if (!weightKg || !heightCm) return 0;
  const m = heightCm / 100;
  return weightKg / (m * m);
};

export interface BMICategory {
  key: 'underweight' | 'normal' | 'overweight' | 'obese';
  label: string;
  color: string;
  range: string;
}

export const bmiCategory = (bmi: number): BMICategory => {
  if (bmi < 18.5) return { key: 'underweight', label: 'Sous-poids', color: '#3B82F6', range: '< 18.5' };
  if (bmi < 25)   return { key: 'normal',      label: 'Normal',     color: '#10B981', range: '18.5 – 24.9' };
  if (bmi < 30)   return { key: 'overweight',  label: 'Surpoids',   color: '#F59E0B', range: '25 – 29.9' };
  return            { key: 'obese',       label: 'Obésité',    color: '#EF4444', range: '≥ 30' };
};

// ── BMR (Mifflin-St Jeor) ──────────────────────────────────────────────────
export const computeBMR = (profile: Pick<UserProfile, 'weightKg' | 'heightCm' | 'age' | 'sex'>): number => {
  const base = 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age;
  if (profile.sex === 'female') return Math.round(base - 161);
  // homme par défaut, "other" → moyenne homme/femme
  if (profile.sex === 'other') return Math.round(base - 78);
  return Math.round(base + 5);
};

// ── TDEE (BMR × activity factor) ───────────────────────────────────────────
export const ACTIVITY_CONFIG: Record<ActivityLevel, { factor: number; label: string; description: string }> = {
  sedentary:   { factor: 1.2,   label: 'Sédentaire',     description: 'Peu ou pas d\'exercice' },
  light:       { factor: 1.375, label: 'Léger',          description: '1-3 séances / semaine' },
  moderate:    { factor: 1.55,  label: 'Modéré',         description: '3-5 séances / semaine' },
  active:      { factor: 1.725, label: 'Actif',          description: '6-7 séances / semaine' },
  very_active: { factor: 1.9,   label: 'Très actif',     description: 'Athlète, 2× / jour' },
};

export const computeTDEE = (bmr: number, level: ActivityLevel): number =>
  Math.round(bmr * ACTIVITY_CONFIG[level].factor);

// ── Poids idéal (cible IMC = 22) ──────────────────────────────────────────
export const idealWeightRange = (heightCm: number): { min: number; max: number; target: number } => {
  const m = heightCm / 100;
  return {
    min: Math.round(18.5 * m * m),
    max: Math.round(24.9 * m * m),
    target: Math.round(22 * m * m),
  };
};

// ── Suggestion d'objectif ──────────────────────────────────────────────────
export interface GoalSuggestion {
  goal: GoalType;
  reason: string;
  kgDelta: number; // signed : négatif = perdre, positif = prendre
}

export const suggestGoal = (profile: Pick<UserProfile, 'weightKg' | 'heightCm'>): GoalSuggestion => {
  const bmi = computeBMI(profile.weightKg, profile.heightCm);
  const ideal = idealWeightRange(profile.heightCm);
  const cat = bmiCategory(bmi);

  if (cat.key === 'underweight') {
    return {
      goal: 'bulk',
      reason: `IMC ${bmi.toFixed(1)} en sous-poids. Une prise de masse douce te ramènera dans la zone saine (${ideal.min}–${ideal.max} kg).`,
      kgDelta: ideal.min - profile.weightKg,
    };
  }
  if (cat.key === 'normal') {
    return {
      goal: 'maintain',
      reason: `IMC ${bmi.toFixed(1)} dans la zone saine. Cap sur la maintenance et la qualité de la séance.`,
      kgDelta: 0,
    };
  }
  if (cat.key === 'overweight') {
    return {
      goal: 'cut',
      reason: `IMC ${bmi.toFixed(1)} en surpoids. Une sèche progressive te ramènera vers ${ideal.max} kg (haut de la zone saine).`,
      kgDelta: ideal.max - profile.weightKg,
    };
  }
  return {
    goal: 'cut',
    reason: `IMC ${bmi.toFixed(1)} en obésité. Sèche progressive recommandée (visée : ${ideal.target} kg, IMC 22).`,
    kgDelta: ideal.target - profile.weightKg,
  };
};

// ── Garde-fous & ramp-down hebdomadaire ────────────────────────────────────
// On limite les écarts à des valeurs sûres et durables.
// Sèche max : -500 kcal/jour ou -25% TDEE (le plus faible des deux).
// Bulk max : +400 kcal/jour ou +20% TDEE.
export const GOAL_CONFIGS: Record<GoalType, { label: string; baseOffset: number; pctMax: number; color: string }> = {
  cut:      { label: 'Sèche',    baseOffset: -500, pctMax: 0.25, color: '#EF4444' },
  maintain: { label: 'Maintien', baseOffset:  0,   pctMax: 0,    color: '#10B981' },
  bulk:     { label: 'Masse',    baseOffset:  300, pctMax: 0.20, color: '#3B82F6' },
};

export const computeSafeCalorieOffset = (tdee: number, goal: GoalType): number => {
  const cfg = GOAL_CONFIGS[goal];
  if (goal === 'maintain') return 0;
  const limit = Math.round(tdee * cfg.pctMax);
  // baseOffset est signé ; on prend la valeur la plus douce des deux (en magnitude).
  return goal === 'cut'
    ? Math.max(cfg.baseOffset, -limit) // ex : -500 vs -25% TDEE → on prend le moins agressif
    : Math.min(cfg.baseOffset, +limit);
};

export const weeklyDeficitTarget = (
  goal: GoalType,
  tdee: number
): { kcalDelta: number; kgPerWeek: number } => {
  const kcalDelta = computeSafeCalorieOffset(tdee, goal);
  // 1 kg de graisse ≈ 7700 kcal
  const kgPerWeek = (kcalDelta * 7) / 7700;
  return { kcalDelta, kgPerWeek: Math.round(kgPerWeek * 100) / 100 };
};
