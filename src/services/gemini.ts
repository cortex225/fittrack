import { GoogleGenAI, Type } from '@google/genai';
import {
  GoalType,
  Meal,
  NutritionLog,
  Recipe,
  UserProfile,
  WorkoutSession,
} from '../types';
import { getApiKey } from '../utils/storage';

// Models — using broadly-available 2.x flash (multimodal + JSON output)
const TEXT_MODEL = 'gemini-2.0-flash';
const VISION_MODEL = 'gemini-2.0-flash';

export class MissingApiKeyError extends Error {
  constructor() {
    super('Aucune clé API Gemini configurée. Va dans Réglages pour en ajouter une.');
    this.name = 'MissingApiKeyError';
  }
}

async function getClient(): Promise<GoogleGenAI> {
  const key = await getApiKey();
  if (!key) throw new MissingApiKeyError();
  return new GoogleGenAI({ apiKey: key });
}

// ── Coach insight ──────────────────────────────────────────────────────────
export async function getCoachAdvice(
  profile: UserProfile,
  goal: GoalType,
  nutrition: NutritionLog,
  todayWorkout: string
): Promise<string> {
  const ai = await getClient();
  const prompt = `
Athlète: ${profile.name}
Objectif: ${goal}
Poids: ${profile.weightKg} kg
Données du jour:
- Calories: ${nutrition.meals.reduce((a, m) => a + m.calories, 0)} / ${profile.targetCalories} kcal
- Eau: ${nutrition.water} / ${profile.targetWater} ml
- Séance prévue: ${todayWorkout}

Donne UN conseil ultra-court (max 200 caractères), motivant, ciblé et concret.
`;
  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: prompt,
    config: {
      systemInstruction:
        "Tu es Coach JL-AI, un expert fitness français énergique. Réponses brèves, motivantes, concrètes. Tutoie l'athlète.",
      temperature: 0.8,
    },
  });
  return (response.text ?? '').trim();
}

// ── Food photo analysis ────────────────────────────────────────────────────
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
  const response = await ai.models.generateContent({
    model: VISION_MODEL,
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
  });
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
Génère 3 recettes créatives, équilibrées, savoureuses pour un repas de type "${params.category}".
Objectif athlète: ${params.goal}.
Calories cibles par recette: ~${targetCals} kcal.
Complexité: ${params.complexity}.
Ingrédients disponibles: ${params.fridge || 'libre, sois créatif'}.

Pour chaque recette, fournis un 'imageKeyword' descriptif en anglais pour la photo (ex: "grilled chicken bowl with quinoa").
`;
  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: prompt,
    config: {
      systemInstruction:
        'Tu es un chef gastronomique spécialisé en nutrition sportive. Tu crées des repas équilibrés et savoureux en français.',
      responseMimeType: 'application/json',
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
  });
  return JSON.parse(response.text ?? '[]') as Recipe[];
}

// ── Smart Workout Generator ────────────────────────────────────────────────
export interface SmartWorkoutParams {
  duration: string;
  equipment: string;
  type: string;
  goal: GoalType;
}

export async function generateSmartWorkout(
  params: SmartWorkoutParams
): Promise<WorkoutSession> {
  const ai = await getClient();
  const prompt = `
Génère une séance de musculation d'environ ${params.duration} min.
Matériel: ${params.equipment}.
Objectif: ${params.goal}.
Style: ${params.type}.

Pour chaque exercice, donne: nom, sets (nombre), reps (string), rest (secondes), setup (1 phrase), execution (2 phrases),
mistakes (2 erreurs courantes), goalSpecificTip (conseil ciblé pour l'objectif "${params.goal}").
Réponds en français, format JSON.
`;
  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: prompt,
    config: {
      systemInstruction:
        'Tu es un préparateur physique expert. Tu structures des séances efficaces, claires et adaptées.',
      responseMimeType: 'application/json',
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
  });
  return JSON.parse(response.text ?? '{}') as WorkoutSession;
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
  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents,
    config: {
      systemInstruction: `Tu es Coach JL-AI, coach fitness et nutrition d'élite. Athlète: ${profile.name}, ${profile.weightKg} kg, objectif ${goal}. Réponses concises, motivantes, en français. Tutoie l'athlète. Utilise quelques emojis avec parcimonie.`,
    },
  });
  return (response.text ?? '').trim();
}
