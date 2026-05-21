import { GoogleGenAI, Type } from '@google/genai';
import {
  GoalType,
  Meal,
  NutritionLog,
  Recipe,
  UserProfile,
  WorkoutSession,
} from '../types';
import { getApiKey, getRecentTrainingContext } from '../utils/storage';
import { generateRecipeImage } from './images';
import {
  ACTIVITY_CONFIG,
  bmiCategory,
  computeBMI,
  computeBMR,
  computeTDEE,
  idealWeightRange,
} from '../utils/health';
import { ExerciseMuscle } from '../data/exercises';
import {
  Location,
  findExerciseById,
  findExerciseByName,
  searchExercises,
} from './exercises';

// Contexte santé partagé entre tous les prompts pour rendre l'IA plus pertinente.
function buildProfileContext(profile: UserProfile, goal: GoalType): string {
  const bmi = computeBMI(profile.weightKg, profile.heightCm);
  const bmr = computeBMR(profile);
  const tdee = computeTDEE(bmr, profile.activityLevel);
  const cat = bmiCategory(bmi);
  const ideal = idealWeightRange(profile.heightCm);
  const act = ACTIVITY_CONFIG[profile.activityLevel];
  return `Athlète: ${profile.name}, ${profile.age} ans, ${profile.sex === 'female' ? 'femme' : 'homme'}.
Mensurations: ${profile.weightKg} kg / ${profile.heightCm} cm.
IMC: ${bmi.toFixed(1)} (${cat.label}). Poids sain: ${ideal.min}–${ideal.max} kg.
BMR: ${bmr} kcal. TDEE: ${tdee} kcal (activité ${act.label.toLowerCase()}).
Objectif: ${goal === 'cut' ? 'sèche' : goal === 'bulk' ? 'prise de masse' : 'maintien'}.
Cibles quotidiennes: ${profile.targetCalories} kcal · ${profile.targetProtein}g protéines · ${profile.targetCarbs}g glucides · ${profile.targetFats}g lipides.`;
}

// Models — primary + fallback (used on 503 UNAVAILABLE)
const TEXT_MODEL = 'gemini-2.5-flash';
const VISION_MODEL = 'gemini-2.5-flash';
const FALLBACK_MODEL = 'gemini-2.5-flash-lite';

// Clé embarquée (fournie par le dev via .env.local → EXPO_PUBLIC_GEMINI_API_KEY).
// ⚠️ Visible dans le bundle : ne pas utiliser pour un usage public à grande échelle.
const EMBEDDED_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';

export class MissingApiKeyError extends Error {
  constructor() {
    super('Aucune clé API Gemini configurée.');
    this.name = 'MissingApiKeyError';
  }
}

export const hasEmbeddedApiKey = (): boolean => EMBEDDED_API_KEY.length > 0;

async function getClient(): Promise<GoogleGenAI> {
  const key = EMBEDDED_API_KEY || (await getApiKey());
  if (!key) throw new MissingApiKeyError();
  return new GoogleGenAI({ apiKey: key });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Retry on 503/429 with exponential backoff; on final failure try the fallback model once.
async function callWithRetry<T>(
  fn: (model: string) => Promise<T>,
  primaryModel: string
): Promise<T> {
  const delays = [600, 1500, 3000];
  let lastErr: any;
  for (const model of [primaryModel, FALLBACK_MODEL]) {
    for (let i = 0; i <= delays.length; i++) {
      try {
        return await fn(model);
      } catch (err: any) {
        lastErr = err;
        const msg = String(err?.message ?? '');
        const transient = msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('429');
        if (!transient || i === delays.length) break;
        await sleep(delays[i]);
      }
    }
  }
  throw lastErr;
}

// ── Coach insight ──────────────────────────────────────────────────────────
export async function getCoachAdvice(
  profile: UserProfile,
  goal: GoalType,
  nutrition: NutritionLog,
  todayWorkout: string
): Promise<string> {
  const ai = await getClient();
  const trainingCtx = await getRecentTrainingContext(7);
  const prompt = `
${buildProfileContext(profile, goal)}

${trainingCtx}

Données du jour:
- Calories consommées: ${nutrition.meals.reduce((a, m) => a + m.calories, 0)} / ${profile.targetCalories} kcal
- Eau: ${nutrition.water} / ${profile.targetWater} ml
- Séance prévue: ${todayWorkout}

Donne UN conseil ultra-court (max 200 caractères), motivant, ciblé et concret.
Utilise l'IMC, l'écart au TDEE et l'historique d'entraînement pour donner un conseil vraiment adapté.
`;
  const response = await callWithRetry(
    (model) =>
      ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction:
            "Tu es Coach JL-AI, un expert fitness français énergique. Réponses brèves, motivantes, concrètes. Tutoie l'athlète.",
          temperature: 0.8,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    TEXT_MODEL
  );
  return (response.text ?? '').trim();
}

// ── Food photo analysis────────────────────────────────────────────────────
export interface AnalyzedFood {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

export async function analyzeFoodImage(
  base64: string,
  mimeType: string
): Promise<AnalyzedFood> {
  const ai = await getClient();
  const response = await callWithRetry(
    (model) =>
      ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: 'Identifie ce plat (français) et estime les macros pour une portion réaliste. Réponds en JSON.',
              },
              { inlineData: { mimeType, data: base64 } },
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingBudget: 0 },
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              calories: { type: Type.NUMBER },
              protein: { type: Type.NUMBER },
              carbs: { type: Type.NUMBER },
              fats: { type: Type.NUMBER },
            },
            required: ['name', 'calories', 'protein', 'carbs', 'fats'],
          },
        },
      }),
    VISION_MODEL
  );
  return JSON.parse(response.text ?? '{}') as AnalyzedFood;
}

// ── AI Chef — recipes ──────────────────────────────────────────────────────
export interface ChefParams {
  category: Meal['category'];
  goal: GoalType;
  remainingCals: number;
  fridge: string;
  complexity: string;
}

export async function generateChefRecipes(params: ChefParams): Promise<Recipe[]> {
  const ai = await getClient();
  const targetCals = params.remainingCals > 0 ? params.remainingCals : 600;
  const prompt = `
Génère 5 recettes créatives, équilibrées, savoureuses pour un repas de type "${params.category}".
Objectif athlète: ${params.goal}.
Calories cibles par recette: ~${targetCals} kcal.
Complexité: ${params.complexity}.
Ingrédients disponibles: ${params.fridge || 'libre, sois créatif'}.

Pour chaque recette, fournis un 'imageKeyword' descriptif en anglais pour la photo (ex: "grilled chicken bowl with quinoa").
`;
  const response = await callWithRetry(
    (model) =>
      ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction:
            'Tu es un chef gastronomique spécialisé en nutrition sportive. Tu crées des repas équilibrés et savoureux en français.',
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingBudget: 0 },
          maxOutputTokens: 8192,
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                desc: { type: Type.STRING },
                calories: { type: Type.NUMBER },
                protein: { type: Type.NUMBER },
                carbs: { type: Type.NUMBER },
                fats: { type: Type.NUMBER },
                prepTime: { type: Type.STRING },
                difficulty: { type: Type.STRING },
                ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
                instructions: { type: Type.ARRAY, items: { type: Type.STRING } },
                imageKeyword: { type: Type.STRING },
              },
              required: [
                'name',
                'desc',
                'calories',
                'protein',
                'carbs',
                'fats',
                'prepTime',
                'difficulty',
                'ingredients',
                'instructions',
                'imageKeyword',
              ],
            },
          },
        },
      }),
    TEXT_MODEL
  );
  const recipes = JSON.parse(response.text ?? '[]') as Recipe[];
  // Génération d'images en parallèle via Cloudflare Workers AI (FLUX).
  // Si une image échoue, la recette reste utilisable (fallback Pollinations dans le composant).
  const withImages = await Promise.all(
    recipes.map(async (r) => {
      const image = await generateRecipeImage(r.imageKeyword, r.name);
      return image ? { ...r, image } : r;
    })
  );
  return withImages;
}

// ── Smart Workout Generator ────────────────────────────────────────────────
export interface SmartWorkoutParams {
  duration: string;
  equipment: string;
  type: string;
  goal: GoalType;
  profile?: UserProfile;
  location?: Location;            // 'home' | 'gym' | 'any' (défaut: gym)
  targetMuscles?: ExerciseMuscle[]; // si vide, Gemini choisit l'équilibrage
  userIntent?: string;            // description libre de l'objectif/contexte
}

// Construit une short-list d'exos compatibles location/muscles pour le prompt.
// On limite à ~60 entrées pour rester sous le contexte raisonnable de Gemini.
function buildExerciseShortlist(params: SmartWorkoutParams): { id: string; name: string; muscles: string; equipment: string; level: string }[] {
  const location = params.location ?? 'gym';
  let pool;
  if (params.targetMuscles?.length) {
    pool = searchExercises({ location, muscles: params.targetMuscles, limit: 80 });
  } else {
    // Équilibre par grands groupes pour laisser Gemini composer la séance.
    const focusGroups: ExerciseMuscle[] = [
      'chest', 'lats', 'middle back', 'shoulders', 'quadriceps', 'hamstrings', 'glutes', 'biceps', 'triceps', 'abdominals',
    ];
    pool = focusGroups.flatMap((m) =>
      searchExercises({ location, muscles: [m], limit: 6 })
    );
    // dédoublonne
    const seen = new Set<string>();
    pool = pool.filter((e) => (seen.has(e.id) ? false : seen.add(e.id)));
  }
  return pool.slice(0, 60).map((e) => ({
    id: e.id,
    name: e.name,
    muscles: [...e.primaryMuscles, ...e.secondaryMuscles].join(', '),
    equipment: e.equipment ?? 'none',
    level: e.level,
  }));
}

export async function generateSmartWorkout(
  params: SmartWorkoutParams
): Promise<WorkoutSession> {
  const ai = await getClient();
  const ctx = params.profile ? `\n${buildProfileContext(params.profile, params.goal)}\n` : '';
  const trainingCtx = await getRecentTrainingContext(7);
  const location = params.location ?? 'gym';
  const shortlist = buildExerciseShortlist(params);
  const catalog = shortlist
    .map((e) => `- ${e.id} | ${e.name} | muscles: ${e.muscles} | equip: ${e.equipment} | niveau: ${e.level}`)
    .join('\n');

  const intent = params.userIntent?.trim();
  const prompt = `${ctx}
${trainingCtx}

Génère une séance d'environ ${params.duration} min.
Lieu: ${location === 'home' ? 'à la maison' : location === 'gym' ? 'salle de musculation' : 'tout équipement'}.
Objectif: ${params.goal}.
Style: ${params.type}.
${params.targetMuscles?.length ? `Muscles cibles prioritaires: ${params.targetMuscles.join(', ')}.\n` : ''}${intent ? `\nDemande explicite de l'athlète : "${intent}"\nPrends cette demande comme prioritaire pour composer la séance (intensité, focus, contraintes éventuelles type "j'ai mal au dos", "je veux brûler", etc.).\n` : ''}
Adapte l'intensité (charge, reps, RPE) au niveau d'activité et à l'IMC indiqués ci-dessus.
Utilise l'historique pour équilibrer : évite de surcharger les muscles déjà travaillés en volume cette semaine, comble les manques.

CATALOGUE D'EXERCICES DISPONIBLES (utilise UNIQUEMENT ces IDs) :
${catalog}

Pour chaque exercice de la séance :
- exerciseId : l'ID exact pris dans la liste ci-dessus (obligatoire)
- name : le nom de l'exercice (peut reprendre celui du catalogue)
- sets (nombre), reps (string), rest (secondes en nombre)
- setup (1 phrase, FR), execution (2 phrases, FR)
- mistakes (2 erreurs courantes, FR)
- goalSpecificTip (conseil ciblé pour l'objectif "${params.goal}", FR)

Réponds en français, format JSON.
`;
  const response = await callWithRetry(
    (model) =>
      ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction:
            'Tu es un préparateur physique expert. Tu composes des séances cohérentes, équilibrées (échauffement, principal, finisher) et adaptées au profil de l\'athlète. Tu choisis EXCLUSIVEMENT des exercices dont l\'ID figure dans le catalogue fourni.',
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingBudget: 0 },
          maxOutputTokens: 8192,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              focus: { type: Type.STRING },
              type: { type: Type.STRING },
              exercises: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    exerciseId: { type: Type.STRING },
                    name: { type: Type.STRING },
                    sets: { type: Type.NUMBER },
                    reps: { type: Type.STRING },
                    rest: { type: Type.NUMBER },
                    setup: { type: Type.STRING },
                    execution: { type: Type.STRING },
                    mistakes: { type: Type.ARRAY, items: { type: Type.STRING } },
                    goalSpecificTip: { type: Type.STRING },
                  },
                  required: [
                    'exerciseId',
                    'name',
                    'sets',
                    'reps',
                    'rest',
                    'setup',
                    'execution',
                    'mistakes',
                    'goalSpecificTip',
                  ],
                },
              },
            },
            required: ['title', 'focus', 'type', 'exercises'],
          },
        },
      }),
    TEXT_MODEL
  );
  const session = JSON.parse(response.text ?? '{}') as WorkoutSession;
  // Sécurise les exerciseId : si Gemini a inventé un id, on fait un fuzzy match par nom.
  session.exercises = (session.exercises ?? []).map((ex) => {
    const valid = ex.exerciseId && findExerciseById(ex.exerciseId);
    if (valid) return ex;
    const fallback = findExerciseByName(ex.name);
    return { ...ex, exerciseId: fallback?.id };
  });
  return session;
}

// ── Chat (Coach JL-AI) ─────────────────────────────────────────────────────
export interface ChatTurn {
  role: 'user' | 'model';
  text: string;
}

export async function coachChat(
  history: ChatTurn[],
  userMessage: string,
  profile: UserProfile,
  goal: GoalType
): Promise<string> {
  const ai = await getClient();
  const contents = [
    ...history.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
    { role: 'user' as const, parts: [{ text: userMessage }] },
  ];
  const trainingCtx = await getRecentTrainingContext(7);
  const response = await callWithRetry(
    (model) =>
      ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: `Tu es Coach JL-AI, coach fitness et nutrition d'élite.

${buildProfileContext(profile, goal)}

${trainingCtx}

Adapte tes recommandations au profil ET à l'historique récent : exploite l'IMC pour calibrer la difficulté, le BMR/TDEE pour quantifier l'effort, le niveau d'activité pour choisir l'intensité, le volume par muscle pour détecter les déséquilibres ("ton volume jambes est faible cette semaine"), l'écart au poids idéal pour rester réaliste. Réponses concises, motivantes, en français, structurées en markdown (listes, **gras**) quand c'est utile. Tutoie l'athlète. Quelques emojis avec parcimonie.`,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    TEXT_MODEL
  );
  return (response.text ?? '').trim();
}
