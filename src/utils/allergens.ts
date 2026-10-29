import { AllergenKey, FoodConflict, HouseholdMember, Recipe } from '../types';

// ── Catalogue d'allergènes ─────────────────────────────────────────────────
// Filet de sécurité côté code : le prompt demande déjà à l'IA d'éviter ces
// aliments, mais on ne lui fait pas confiance. Toute recette qui contient un
// de ces termes pour un membre du foyer est écartée.
//
// `terms`      : mots ou expressions (normalisés : minuscules, sans accents).
// `exceptions` : expressions retirées du texte avant la recherche, pour éviter
//                les faux positifs ("noix de coco" n'est pas une noix).
export interface AllergenDef {
  key: AllergenKey;
  label: string;
  icon: string; // Ionicons
  terms: string[];
  exceptions?: string[];
}

export const ALLERGENS: AllergenDef[] = [
  {
    key: 'peanut',
    label: 'Arachides',
    icon: 'warning-outline',
    terms: [
      'arachide', 'arachides', 'cacahuete', 'cacahuetes', 'cacahouete', 'cacahouetes',
      'peanut', 'peanuts', 'groundnut', 'groundnuts',
      // Plats et produits qui en contiennent presque toujours.
      'mafe', 'maafe', 'kuli kuli', 'kouli kouli', 'dakatine', 'satay', 'sate', 'pad thai',
    ],
  },
  {
    key: 'tree_nut',
    label: 'Fruits à coque',
    icon: 'leaf-outline',
    terms: [
      'noix', 'amande', 'amandes', 'noisette', 'noisettes', 'cajou', 'pistache', 'pistaches',
      'pecan', 'pecans', 'macadamia', 'praline', 'nutella', 'frangipane',
      'almond', 'almonds', 'walnut', 'walnuts', 'hazelnut', 'hazelnuts', 'cashew', 'cashews',
      'pistachio', 'pistachios',
    ],
    exceptions: ['noix de coco', 'noix de muscade', 'noix de saint jacques'],
  },
  {
    key: 'milk',
    label: 'Lait',
    icon: 'water-outline',
    terms: [
      'lait', 'beurre', 'fromage', 'creme', 'yogourt', 'yogourts', 'yaourt', 'yaourts', 'yogurt',
      'ghee', 'lactose', 'mozzarella', 'parmesan', 'feta', 'ricotta', 'mascarpone', 'cottage',
      'whey', 'lactoserum', 'kefir', 'gruyere', 'cheddar', 'paneer',
      'milk', 'butter', 'cheese', 'cream',
    ],
    exceptions: [
      'lait de coco', 'creme de coco', 'lait d amande', 'lait de soja', 'lait d avoine',
      'lait de riz', 'beurre d arachide', 'beurre de cacahuete', 'beurre d amande',
      'beurre de karite', 'coconut milk', 'coconut cream', 'peanut butter',
    ],
  },
  {
    key: 'egg',
    label: 'Oeufs',
    icon: 'egg-outline',
    terms: ['oeuf', 'oeufs', 'egg', 'eggs', 'mayonnaise', 'mayo', 'meringue', 'omelette'],
  },
  {
    key: 'gluten',
    label: 'Gluten',
    icon: 'nutrition-outline',
    terms: [
      'ble', 'farine', 'pain', 'pains', 'pates', 'spaghetti', 'penne', 'fusilli', 'lasagne',
      'semoule', 'couscous', 'boulgour', 'orge', 'seigle', 'epeautre', 'seitan', 'chapelure',
      'panko', 'biscuit', 'biscuits', 'tortilla', 'wrap', 'ramen', 'udon', 'nouilles',
      'sauce soja', 'wheat', 'barley', 'rye', 'bread', 'pasta', 'noodles',
    ],
    exceptions: [
      'farine de manioc', 'farine de riz', 'farine de mais', 'semoule de mais',
      'nouilles de riz', 'pain de manioc', 'tortilla de mais', 'pates de lentilles',
      'pates de pois chiches', 'sauce soja sans gluten', 'tamari',
    ],
  },
  {
    key: 'fish',
    label: 'Poisson',
    icon: 'fish-outline',
    terms: [
      'poisson', 'poissons', 'saumon', 'thon', 'sardine', 'sardines', 'maquereau', 'tilapia',
      'morue', 'cabillaud', 'anchois', 'hareng', 'truite', 'dorade', 'capitaine', 'carpe',
      'nuoc mam', 'fish', 'salmon', 'tuna', 'cod', 'anchovy', 'anchovies', 'mackerel',
    ],
  },
  {
    key: 'shellfish',
    label: 'Crustacés et fruits de mer',
    icon: 'alert-circle-outline',
    terms: [
      'crevette', 'crevettes', 'crabe', 'crabes', 'homard', 'langouste', 'langoustine',
      'moule', 'moules', 'huitre', 'huitres', 'calamar', 'calamars', 'poulpe', 'pieuvre',
      'saint jacques', 'shrimp', 'shrimps', 'prawn', 'prawns', 'crab', 'lobster', 'mussel',
      'mussels', 'oyster', 'oysters', 'scallop', 'scallops', 'squid',
    ],
  },
  {
    key: 'soy',
    label: 'Soja',
    icon: 'ellipse-outline',
    terms: ['soja', 'soya', 'tofu', 'edamame', 'miso', 'tempeh', 'tamari', 'soy'],
  },
  {
    key: 'sesame',
    label: 'Sésame',
    icon: 'ellipse-outline',
    terms: ['sesame', 'tahini', 'tahin', 'gomasio', 'halva'],
  },
];

export const ALLERGEN_BY_KEY: Record<AllergenKey, AllergenDef> = ALLERGENS.reduce(
  (acc, a) => ({ ...acc, [a.key]: a }),
  {} as Record<AllergenKey, AllergenDef>
);

// ── Normalisation ──────────────────────────────────────────────────────────
// "Beurre d'Arachide !" → " beurre d arachide " (espaces aux bords pour
// pouvoir chercher des mots entiers avec un simple includes).
export const normalizeFoodText = (text: string): string =>
  ' ' +
  text
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim() +
  ' ';

// Mot entier, au singulier ou au pluriel ("kiwi" trouve aussi "kiwis").
const containsTerm = (normalized: string, term: string): boolean => {
  const t = normalizeFoodText(term).trim();
  if (!t) return false;
  return [t, `${t}s`, `${t}x`].some((v) => normalized.includes(` ${v} `));
};

const stripExceptions = (normalized: string, exceptions: string[] = []): string =>
  exceptions.reduce((acc, ex) => acc.split(normalizeFoodText(ex)).join(' '), normalized);

// ── Recherche de conflits ──────────────────────────────────────────────────
// Renvoie un conflit par (membre, allergène ou exclusion) trouvé dans les textes.
export const findFoodConflicts = (
  texts: string[],
  members: HouseholdMember[]
): FoodConflict[] => {
  const normalized = normalizeFoodText(texts.join(' | '));
  const conflicts: FoodConflict[] = [];

  for (const m of members) {
    for (const key of m.allergens ?? []) {
      const def = ALLERGEN_BY_KEY[key];
      if (!def) continue;
      const haystack = stripExceptions(normalized, def.exceptions);
      const hit = def.terms.find((t) => containsTerm(haystack, t));
      if (hit) conflicts.push({ memberId: m.id, memberName: m.name, label: def.label, matched: hit });
    }
    for (const custom of m.strictExclusions ?? []) {
      if (containsTerm(normalized, custom)) {
        conflicts.push({ memberId: m.id, memberName: m.name, label: custom, matched: custom });
      }
    }
  }
  return conflicts;
};

export const recipeTexts = (r: Pick<Recipe, 'name' | 'desc' | 'ingredients' | 'instructions'>): string[] => [
  r.name,
  r.desc,
  ...(r.ingredients ?? []),
  ...(r.instructions ?? []),
];

export const findRecipeConflicts = (recipe: Recipe, members: HouseholdMember[]): FoodConflict[] =>
  findFoodConflicts(recipeTexts(recipe), members);

export interface BlockedRecipe {
  recipe: Recipe;
  conflicts: FoodConflict[];
}

// Sépare les recettes sûres de celles qui touchent une exclusion stricte.
export const partitionSafeRecipes = (
  recipes: Recipe[],
  members: HouseholdMember[]
): { safe: Recipe[]; blocked: BlockedRecipe[] } => {
  const safe: Recipe[] = [];
  const blocked: BlockedRecipe[] = [];
  for (const r of recipes) {
    const conflicts = findRecipeConflicts(r, members);
    if (conflicts.length) blocked.push({ recipe: r, conflicts });
    else safe.push(r);
  }
  return { safe, blocked };
};

// Liste lisible des exclusions strictes, pour le prompt et l'interface.
export const strictExclusionLabels = (members: HouseholdMember[]): string[] => {
  const labels = new Set<string>();
  for (const m of members) {
    (m.allergens ?? []).forEach((k) => ALLERGEN_BY_KEY[k] && labels.add(ALLERGEN_BY_KEY[k].label));
    (m.strictExclusions ?? []).forEach((e) => labels.add(e));
  }
  return [...labels];
};

export const summarizeConflicts = (conflicts: FoodConflict[]): string =>
  [...new Set(conflicts.map((c) => `${c.label} (${c.memberName})`))].join(', ');

// "Arachides (Awa) · Lait, kiwi (Yao)" : rappel affiché avant de générer.
export const describeStrictExclusions = (members: HouseholdMember[]): string =>
  members
    .map((m) => ({ name: m.name, labels: strictExclusionLabels([m]) }))
    .filter((x) => x.labels.length)
    .map((x) => `${x.labels.join(', ')} (${x.name})`)
    .join(' · ');
