import { GoalType, HouseholdMember, MealComponent, MemberPortion, PlanSlot } from '../types';

// Part de la journée que représente un repas principal. JL mange 4 fois
// (déjeuner, dîner, collation, souper) : dîner et souper pèsent chacun ~30 %.
export const SLOT_SHARE: Record<PlanSlot, number> = {
  lunch: 0.3,
  dinner: 0.3,
};

// Légumes et sauce ne suivent pas les calories : en perte de poids on charge
// les légumes et on allège la sauce, en prise de muscle l'inverse.
const VEG_FACTOR: Record<GoalType, number> = { cut: 1.5, maintain: 1.2, bulk: 1 };
const SAUCE_FACTOR: Record<GoalType, number> = { cut: 0.8, maintain: 1, bulk: 1.2 };

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const round5 = (g: number) => Math.max(5, Math.round(g / 5) * 5);

interface Sum {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

const sumRole = (components: MealComponent[], role: MealComponent['role']): Sum =>
  components
    .filter((c) => c.role === role)
    .reduce(
      (acc, c) => ({
        calories: acc.calories + c.calories,
        protein: acc.protein + c.protein,
        carbs: acc.carbs + c.carbs,
        fats: acc.fats + c.fats,
      }),
      { calories: 0, protein: 0, carbs: 0, fats: 0 }
    );

// Calcule la portion d'une personne pour un plat commun :
// 1. légumes et sauce selon l'objectif,
// 2. protéine ajustée pour atteindre la cible de protéines du repas,
// 3. féculent (riz, attiéké, foutou, alloco…) ajusté pour compléter les calories.
export const computePortion = (
  components: MealComponent[],
  member: HouseholdMember,
  slot: PlanSlot
): MemberPortion => {
  const share = SLOT_SHARE[slot];
  const targetKcal = member.targetCalories * share;
  const targetProt = member.targetProtein * share;

  const veg = sumRole(components, 'veg');
  const sauce = sumRole(components, 'sauce');
  const prot = sumRole(components, 'protein');
  const starch = sumRole(components, 'starch');

  const fVeg = VEG_FACTOR[member.goal];
  const fSauce = SAUCE_FACTOR[member.goal];

  const protFromOthers = fVeg * veg.protein + fSauce * sauce.protein + starch.protein;
  const fProt = prot.protein > 0 ? clamp((targetProt - protFromOthers) / prot.protein, 0.6, 2.5) : 1;

  const kcalFixed = fVeg * veg.calories + fSauce * sauce.calories + fProt * prot.calories;
  const fStarch = starch.calories > 0 ? clamp((targetKcal - kcalFixed) / starch.calories, 0.3, 2.5) : 1;

  const factorFor = (role: MealComponent['role']) =>
    role === 'veg' ? fVeg : role === 'sauce' ? fSauce : role === 'protein' ? fProt : fStarch;

  const lines = components.map((c) => {
    const grams = round5(c.grams * factorFor(c.role));
    return { component: c, grams, ratio: c.grams > 0 ? grams / c.grams : factorFor(c.role) };
  });

  const total = lines.reduce(
    (acc, l) => ({
      calories: acc.calories + l.component.calories * l.ratio,
      protein: acc.protein + l.component.protein * l.ratio,
      carbs: acc.carbs + l.component.carbs * l.ratio,
      fats: acc.fats + l.component.fats * l.ratio,
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0 }
  );

  return {
    memberId: member.id,
    memberName: member.name,
    lines: lines.map((l) => ({ name: l.component.name, grams: l.grams })),
    calories: Math.round(total.calories),
    protein: Math.round(total.protein),
    carbs: Math.round(total.carbs),
    fats: Math.round(total.fats),
  };
};

export const computePortions = (
  components: MealComponent[],
  members: HouseholdMember[],
  slot: PlanSlot
): MemberPortion[] => members.map((m) => computePortion(components, m, slot));
