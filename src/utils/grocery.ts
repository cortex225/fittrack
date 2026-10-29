import { GroceryCategory, ShoppingItem, WeekPlan } from '../types';
import { normalizeFoodText } from './allergens';

// Liste d'épicerie calculée depuis le menu : on additionne la portion de
// chaque personne, multipliée par le nombre de jours où le plat revient,
// puis par le nombre de semaines couvertes par l'épicerie.

export const CATEGORY_LABEL: Record<GroceryCategory, string> = {
  protein: 'Viandes, poissons et oeufs',
  starch: 'Féculents',
  veg: 'Fruits et légumes',
  sauce: 'Huiles et sauces',
  pantry: 'Épices et garde-manger',
  other: 'Autres',
};

export const CATEGORY_ORDER: GroceryCategory[] = ['protein', 'starch', 'veg', 'sauce', 'pantry', 'other'];

export const formatGrams = (g: number): string => {
  if (g >= 1000) return `${(Math.round(g / 100) / 10).toLocaleString('fr-CA')} kg`;
  return `${Math.round(g / 10) * 10} g`;
};

export interface GroceryLine {
  key: string;
  name: string;
  grams: number;
  category: GroceryCategory;
  meals: string[];
}

export const buildGroceryLines = (plan: WeekPlan, weeks: number): { lines: GroceryLine[]; pantry: string[] } => {
  const map = new Map<string, GroceryLine>();
  const pantry = new Map<string, string>();

  for (const meal of plan.meals) {
    const times = meal.days.length * weeks;
    meal.components.forEach((component, idx) => {
      const grams = meal.portions.reduce((sum, p) => sum + (p.lines[idx]?.grams ?? 0), 0) * times;
      const key = normalizeFoodText(component.name).trim();
      if (!key || grams <= 0) return;
      const line = map.get(key) ?? { key, name: component.name, grams: 0, category: component.role, meals: [] };
      line.grams += grams;
      if (!line.meals.includes(meal.name)) line.meals.push(meal.name);
      map.set(key, line);
    });
    for (const extra of meal.extras) {
      const key = normalizeFoodText(extra).trim();
      if (key && !pantry.has(key)) pantry.set(key, extra);
    }
  }

  const lines = [...map.values()].sort(
    (a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) || b.grams - a.grams
  );
  return { lines, pantry: [...pantry.values()] };
};

// Transforme les lignes en articles de la liste de course existante.
export const groceryToShoppingItems = (
  plan: WeekPlan,
  weeks: number,
  makeId: () => string
): ShoppingItem[] => {
  const { lines, pantry } = buildGroceryLines(plan, weeks);
  const now = new Date().toISOString();
  const items: ShoppingItem[] = lines.map((l) => ({
    id: makeId(),
    name: l.name,
    normalized: l.key,
    checked: false,
    recipes: l.meals,
    addedAt: now,
    quantity: formatGrams(l.grams),
    category: l.category,
    fromPlan: true,
    note: l.category === 'veg' && weeks > 1 ? 'Frais pour la 1re semaine, surgelé pour la suite' : undefined,
  }));
  for (const name of pantry) {
    items.push({
      id: makeId(),
      name,
      normalized: normalizeFoodText(name).trim(),
      checked: false,
      recipes: [],
      addedAt: now,
      category: 'pantry',
      fromPlan: true,
      note: 'Vérifie le garde-manger',
    });
  }
  return items;
};
