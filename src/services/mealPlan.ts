import { Type } from '@google/genai';
import { HouseholdMember, MealComponent, PlannedMeal, PlanSlot, WeekPlan } from '../types';
import { callWithRetry, getClient, TEXT_MODEL } from './gemini';
import { findFoodPhoto, generateRecipeImage } from './images';
import { findFoodConflicts, strictExclusionLabels } from '../utils/allergens';
import { computePortions } from '../utils/portions';
import { generateId } from '../utils/storage';

export type IvorianShare = 'some' | 'half' | 'most';

export interface WeekPlanParams {
  diners: HouseholdMember[];
  dinnerCount: 5 | 7;
  lunchCount: number;        // plats de meal prep pour les dîners
  ivorianShare: IvorianShare;
  recentDishes: string[];    // pour varier d'une semaine à l'autre
}

// Plats ivoiriens proposés comme pistes. Le filtre d'allergènes s'applique
// quand même au résultat : une piste qui contient un allergène est écartée.
const IVORIAN_IDEAS = [
  'attiéké poisson braisé',
  'kedjenou de poulet',
  'sauce gombo',
  'riz gras',
  'foutou sauce claire',
  'alloco poisson',
  'garba',
  'placali sauce kopè',
  'sauce feuille',
  'sauce graine',
  'poulet braisé et attiéké',
  'soupe de poisson ivoirienne',
];

const IVORIAN_LINE: Record<IvorianShare, string> = {
  some: 'Au moins 2 plats ivoiriens dans la semaine.',
  half: 'Environ la moitié des plats sont ivoiriens.',
  most: 'La majorité des plats sont ivoiriens.',
};

const GOAL_LABEL = { cut: 'perte de poids', maintain: 'maintien', bulk: 'prise de muscle' } as const;

const buildPrompt = (p: WeekPlanParams, dinners: number, lunches: number): string => {
  const people = p.diners
    .map((d) => `- ${d.name || 'Convive'} : ${GOAL_LABEL[d.goal]}, ${d.targetCalories} kcal et ${d.targetProtein} g de protéines par jour.`)
    .join('\n');
  const strict = strictExclusionLabels(p.diners);
  const dislikes = [...new Set(p.diners.flatMap((d) => d.dislikes ?? []))];
  const cuisines = [...new Set(p.diners.flatMap((d) => d.cuisines ?? []))];

  return `
Planifie les repas d'une semaine pour un foyer qui mange LE MÊME PLAT, avec des portions différentes.
${people}

Donne exactement ${dinners} soupers (slot "dinner") et ${lunches} dîners à préparer d'avance le dimanche (slot "lunch", qui se gardent 4 jours au frigo).
${IVORIAN_LINE[p.ivorianShare]} Pistes ivoiriennes : ${IVORIAN_IDEAS.join(', ')}.
${cuisines.length ? `Cuisines appréciées pour le reste : ${cuisines.join(', ')}.` : ''}
${strict.length ? `INTERDIT ABSOLU (allergies) : ${strict.join(', ')}. Aucune trace, aucun dérivé, aucune huile, aucune sauce qui en contient.` : ''}
${dislikes.length ? `À éviter si possible : ${dislikes.join(', ')}.` : ''}
${p.recentDishes.length ? `Déjà mangé récemment, propose autre chose : ${p.recentDishes.slice(0, 20).join(', ')}.` : ''}

Contraintes :
- Budget serré : ingrédients simples d'épicerie au Québec (Maxi, Walmart, Costco) ou d'épicerie africaine.
- Soupers de semaine : 30 minutes de travail actif maximum. Les plats longs vont le week-end.
- Variété : pas deux fois la même protéine deux soirs de suite.

Pour chaque plat, décris UNE portion standard d'environ 600 kcal en composants :
- role "protein" (viande, poisson, oeufs, légumineuses), "starch" (riz, attiéké, foutou, alloco, igname, pâtes, patates), "veg" (légumes), "sauce" (sauce, huile, matières grasses).
- grams : poids cru ou tel qu'acheté pour cette portion. calories, protein, carbs, fats : pour ces grammes.
- extras : épices et petits ingrédients (cube, ail, piment…).
- costLevel : 1 économique, 2 moyen, 3 plus cher.
- imageKeyword : 3 à 5 mots en anglais pour chercher une photo du plat (ex. "attieke grilled fish plate").
Réponds en français.`;
};

const MEAL_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      slot: { type: Type.STRING, enum: ['lunch', 'dinner'] },
      name: { type: Type.STRING },
      desc: { type: Type.STRING },
      cuisine: { type: Type.STRING },
      prepTime: { type: Type.STRING },
      costLevel: { type: Type.NUMBER },
      components: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            role: { type: Type.STRING, enum: ['protein', 'starch', 'veg', 'sauce'] },
            grams: { type: Type.NUMBER },
            calories: { type: Type.NUMBER },
            protein: { type: Type.NUMBER },
            carbs: { type: Type.NUMBER },
            fats: { type: Type.NUMBER },
          },
          required: ['name', 'role', 'grams', 'calories', 'protein', 'carbs', 'fats'],
        },
      },
      extras: { type: Type.ARRAY, items: { type: Type.STRING } },
      instructions: { type: Type.ARRAY, items: { type: Type.STRING } },
      imageKeyword: { type: Type.STRING },
    },
    required: ['slot', 'name', 'desc', 'cuisine', 'prepTime', 'costLevel', 'components', 'extras', 'instructions', 'imageKeyword'],
  },
};

type RawMeal = Omit<PlannedMeal, 'id' | 'days' | 'portions' | 'image' | 'imageCredit'>;

async function requestMeals(p: WeekPlanParams, dinners: number, lunches: number): Promise<RawMeal[]> {
  const ai = await getClient();
  const response = await callWithRetry(
    (model) =>
      ai.models.generateContent({
        model,
        contents: buildPrompt(p, dinners, lunches),
        config: {
          systemInstruction:
            "Tu es une nutritionniste et cheffe qui connaît bien la cuisine ivoirienne et l'épicerie au Québec. Tu planifies des repas de famille simples, variés et économiques.",
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingBudget: 0 },
          maxOutputTokens: 16384,
          responseSchema: MEAL_SCHEMA,
        },
      }),
    TEXT_MODEL
  );
  const raw = JSON.parse(response.text ?? '[]') as RawMeal[];
  return raw.map((m) => ({
    ...m,
    costLevel: Math.min(3, Math.max(1, Math.round(m.costLevel))) as 1 | 2 | 3,
    components: (m.components ?? []).filter((c: MealComponent) => c.grams > 0),
    extras: m.extras ?? [],
  }));
}

export const mealTexts = (m: Pick<RawMeal, 'name' | 'desc' | 'components' | 'extras' | 'instructions'>): string[] => [
  m.name,
  m.desc,
  ...m.components.map((c) => c.name),
  ...m.extras,
  ...m.instructions,
];

// Garde les plats sans conflit avec une exclusion stricte.
const keepSafe = (meals: RawMeal[], diners: HouseholdMember[]) => {
  const safe = meals.filter((m) => findFoodConflicts(mealTexts(m), diners).length === 0);
  return { safe, blocked: meals.length - safe.length };
};

// Vraie photo si Pexels en trouve une, sinon image générée par Cloudflare.
// Sans les deux, l'écran se rabat sur l'image Pollinations existante.
async function attachImage(m: PlannedMeal): Promise<PlannedMeal> {
  const photo = await findFoodPhoto(m.imageKeyword);
  if (photo) return { ...m, image: photo.uri, imageCredit: { author: photo.author, url: photo.url, source: 'Pexels' } };
  const generated = await generateRecipeImage(m.imageKeyword, m.name);
  return generated ? { ...m, image: generated } : m;
}

// Répartit les plats sur la semaine : soupers du lundi au dimanche (ou au
// vendredi), dîners de meal prep par blocs de jours.
const assignDays = (meals: RawMeal[], dinnerCount: number): { meal: RawMeal; days: number[] }[] => {
  const dinners = meals.filter((m) => m.slot === 'dinner').slice(0, dinnerCount);
  const lunches = meals.filter((m) => m.slot === 'lunch');
  const out = dinners.map((meal, i) => ({ meal, days: [i] }));
  if (lunches.length) {
    const size = Math.ceil(7 / lunches.length);
    lunches.forEach((meal, i) => {
      const days = Array.from({ length: 7 }, (_, d) => d).filter((d) => Math.floor(d / size) === i);
      if (days.length) out.push({ meal, days });
    });
  }
  return out;
};

const toPlanned = (meal: RawMeal, days: number[], diners: HouseholdMember[]): PlannedMeal => ({
  ...meal,
  id: generateId(),
  days,
  portions: computePortions(meal.components, diners, meal.slot as PlanSlot),
});

// Dates en heure locale (toISOString passerait au lendemain le soir).
const localKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const mondayOf = (date = new Date()): string => {
  const d = new Date(date);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // lundi = 0
  return localKey(d);
};

export async function generateWeekPlan(p: WeekPlanParams): Promise<WeekPlan> {
  let { safe, blocked } = keepSafe(await requestMeals(p, p.dinnerCount, p.lunchCount), p.diners);

  // Un seul rattrapage pour remplacer les plats écartés.
  const missingDinners = p.dinnerCount - safe.filter((m) => m.slot === 'dinner').length;
  const missingLunches = p.lunchCount - safe.filter((m) => m.slot === 'lunch').length;
  if (missingDinners > 0 || missingLunches > 0) {
    const again = keepSafe(
      await requestMeals(
        { ...p, recentDishes: [...safe.map((m) => m.name), ...p.recentDishes] },
        Math.max(0, missingDinners),
        Math.max(0, missingLunches)
      ),
      p.diners
    );
    safe = [...safe, ...again.safe];
    blocked += again.blocked;
  }

  const planned = assignDays(safe, p.dinnerCount).map(({ meal, days }) => toPlanned(meal, days, p.diners));
  const meals = await Promise.all(planned.map(attachImage));

  return {
    id: generateId(),
    weekStart: mondayOf(),
    createdAt: new Date().toISOString(),
    dinerIds: p.diners.map((d) => d.id),
    meals,
    blockedCount: blocked,
  };
}

// Remplace un seul plat (bouton « Changer »), en gardant ses jours.
export async function regenerateMeal(
  plan: WeekPlan,
  mealId: string,
  p: Omit<WeekPlanParams, 'dinnerCount' | 'lunchCount'>
): Promise<WeekPlan> {
  const target = plan.meals.find((m) => m.id === mealId);
  if (!target) return plan;
  const params: WeekPlanParams = {
    ...p,
    dinnerCount: 7,
    lunchCount: 0,
    recentDishes: [...plan.meals.map((m) => m.name), ...p.recentDishes],
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await requestMeals(
      params,
      target.slot === 'dinner' ? 1 : 0,
      target.slot === 'lunch' ? 1 : 0
    );
    const { safe } = keepSafe(raw, p.diners);
    const next = safe.find((m) => m.slot === target.slot) ?? safe[0];
    if (next) {
      const replaced = await attachImage(toPlanned({ ...next, slot: target.slot }, target.days, p.diners));
      return { ...plan, meals: plan.meals.map((m) => (m.id === mealId ? replaced : m)) };
    }
  }
  throw new Error('Aucun plat sûr trouvé, réessaie.');
}

export const todayIndex = (): number => (new Date().getDay() + 6) % 7;
