// Génération d'images via Cloudflare Workers AI (FLUX-1-schnell).
// 10 000 requêtes/jour gratuites par compte Cloudflare.
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
