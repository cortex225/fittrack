// Génération d'images via Cloudflare Workers AI (FLUX-1-schnell).
// Gratuit jusqu'à 10 000 neurones/jour (≈170 images 1024x1024 en 4 étapes).
// Doc: https://developers.cloudflare.com/workers-ai/models/flux-1-schnell/

const CF_ACCOUNT_ID = process.env.EXPO_PUBLIC_CLOUDFLARE_ACCOUNT_ID ?? '';
const CF_API_TOKEN = process.env.EXPO_PUBLIC_CLOUDFLARE_API_TOKEN ?? '';
const CF_MODEL = '@cf/black-forest-labs/flux-1-schnell';

export const hasCloudflareCreds = (): boolean =>
  CF_ACCOUNT_ID.length > 0 && CF_API_TOKEN.length > 0;

export async function generateRecipeImage(
  keyword: string,
  recipeName: string
): Promise<string | null> {
  if (!hasCloudflareCreds()) {
    console.warn(
      '[Cloudflare] Identifiants manquants — définis EXPO_PUBLIC_CLOUDFLARE_ACCOUNT_ID et EXPO_PUBLIC_CLOUDFLARE_API_TOKEN dans .env.local'
    );
    return null;
  }

  const prompt = `Top-down food photography of "${recipeName}" (${keyword}). Vibrant, appetizing, restaurant quality, natural light, shallow depth of field, on a clean plate, professional food magazine style.`;
  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/${CF_MODEL}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CF_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt, steps: 4 }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.warn(
        `[Cloudflare] generateRecipeImage HTTP ${res.status} for "${recipeName}":`,
        body.slice(0, 300)
      );
      return null;
    }

    const json = (await res.json()) as {
      success?: boolean;
      result?: { image?: string };
      errors?: { message: string }[];
    };

    if (!json.success || !json.result?.image) {
      console.warn(
        `[Cloudflare] generateRecipeImage no image for "${recipeName}":`,
        json.errors ?? json
      );
      return null;
    }

    // FLUX-1-schnell renvoie du JPEG base64 (pas PNG).
    return `data:image/jpeg;base64,${json.result.image}`;
  } catch (err: any) {
    console.warn(
      `[Cloudflare] generateRecipeImage failed for "${recipeName}":`,
      err?.message ?? err
    );
    return null;
  }
}

// ── Vraies photos de plats (Pexels) ────────────────────────────────────────
// Gratuit : 200 requêtes/heure, 20 000/mois par défaut. Pexels demande un lien
// visible vers Pexels et de créditer le photographe quand c'est possible.
// Doc : https://www.pexels.com/api/documentation/
const PEXELS_API_KEY = process.env.EXPO_PUBLIC_PEXELS_API_KEY ?? '';

export const hasPexelsKey = (): boolean => PEXELS_API_KEY.length > 0;

export interface FoodPhoto {
  uri: string;
  author: string;
  url: string; // page de la photo sur Pexels
}

export async function findFoodPhoto(query: string): Promise<FoodPhoto | null> {
  if (!hasPexelsKey() || !query.trim()) return null;
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`;
  try {
    const res = await fetch(url, { headers: { Authorization: PEXELS_API_KEY } });
    if (!res.ok) {
      console.warn(`[Pexels] HTTP ${res.status} pour "${query}"`);
      return null;
    }
    const json = (await res.json()) as {
      photos?: { url: string; photographer: string; src: { large?: string; medium?: string } }[];
    };
    const p = json.photos?.[0];
    const uri = p?.src.large ?? p?.src.medium;
    if (!p || !uri) return null;
    return { uri, author: p.photographer, url: p.url };
  } catch (err: any) {
    console.warn(`[Pexels] échec pour "${query}":`, err?.message ?? err);
    return null;
  }
}
