import { CheckIn, GoalType, MeasureKey } from '../types';

export const MEASURES: { key: MeasureKey; label: string }[] = [
  { key: 'neck', label: 'Cou' },
  { key: 'shoulders', label: 'Épaules' },
  { key: 'chest', label: 'Poitrine' },
  { key: 'arm', label: 'Bras' },
  { key: 'forearm', label: 'Avant-bras' },
  { key: 'waist', label: 'Taille' },
  { key: 'hips', label: 'Hanches' },
  { key: 'glutes', label: 'Fessiers' },
  { key: 'thigh', label: 'Cuisses' },
  { key: 'calf', label: 'Mollets' },
];

export const CHECK_IN_EVERY_DAYS = 14;
const MIN_DAYS_BETWEEN = 10;

export const daysBetween = (a: string, b: string): number => {
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86400000);
};

export interface CheckInVerdict {
  kgPerWeek: number;
  waistDelta: number | null;
  adjustment: number; // kcal à ajouter (négatif = retirer), 0 = ne rien changer
  title: string;
  detail: string;
}

// Règles de réglage des calories, appliquées toutes les 2 semaines :
// - prise de muscle : poids stable → +200 kcal ; plus de 0,5 kg par mois avec
//   la taille qui grossit → -150 kcal ;
// - perte de poids : moins de 0,25 kg par semaine → -150 kcal ; plus de 1 % du
//   poids par semaine → +150 kcal ;
// - maintien : écart de plus de 0,25 kg par semaine → on corrige de 150 kcal.
export const evaluateCheckIn = (prev: CheckIn, curr: CheckIn, goal: GoalType): CheckInVerdict | null => {
  const days = daysBetween(prev.date, curr.date);
  if (days < MIN_DAYS_BETWEEN) return null;
  const kgPerWeek = Math.round(((curr.weightKg - prev.weightKg) / days) * 7 * 100) / 100;
  const waistDelta =
    prev.measures.waist && curr.measures.waist ? Math.round((curr.measures.waist - prev.measures.waist) * 10) / 10 : null;
  const pace = `${kgPerWeek > 0 ? '+' : ''}${kgPerWeek.toLocaleString('fr-CA')} kg par semaine`;

  if (goal === 'bulk') {
    if (kgPerWeek < 0.05)
      return { kgPerWeek, waistDelta, adjustment: 200, title: 'Poids stable : +200 kcal', detail: `${pace}. Pour construire du muscle, il faut un léger surplus.` };
    if (kgPerWeek > 0.125 && waistDelta !== null && waistDelta >= 1)
      return { kgPerWeek, waistDelta, adjustment: -150, title: 'Ça monte trop vite : -150 kcal', detail: `${pace} et ${waistDelta} cm de taille. On garde la prise sans trop de gras.` };
    return { kgPerWeek, waistDelta, adjustment: 0, title: 'Bon rythme, on garde tout pareil', detail: `${pace}.` };
  }
  if (goal === 'cut') {
    const fastLimit = Math.round(curr.weightKg * 0.01 * 100) / 100;
    if (kgPerWeek > -0.25)
      return { kgPerWeek, waistDelta, adjustment: -150, title: 'La perte ralentit : -150 kcal', detail: `${pace}. On vise 0,25 à ${fastLimit.toLocaleString('fr-CA')} kg par semaine.` };
    if (-kgPerWeek > fastLimit)
      return { kgPerWeek, waistDelta, adjustment: 150, title: 'Trop rapide : +150 kcal', detail: `${pace}. Au-delà de 1 % du poids par semaine, on perd aussi du muscle.` };
    return { kgPerWeek, waistDelta, adjustment: 0, title: 'Bon rythme, on garde tout pareil', detail: `${pace}.` };
  }
  if (Math.abs(kgPerWeek) > 0.25) {
    const adjustment = kgPerWeek > 0 ? -150 : 150;
    return { kgPerWeek, waistDelta, adjustment, title: `${adjustment > 0 ? '+' : ''}${adjustment} kcal pour rester stable`, detail: `${pace}.` };
  }
  return { kgPerWeek, waistDelta, adjustment: 0, title: 'Poids stable, on garde tout pareil', detail: `${pace}.` };
};

export const nextCheckInIn = (last: CheckIn | undefined, today: string): number =>
  last ? Math.max(0, CHECK_IN_EVERY_DAYS - daysBetween(last.date, today)) : 0;
