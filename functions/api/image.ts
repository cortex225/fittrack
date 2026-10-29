// POST /api/image — génère l'image d'un plat avec Workers AI (FLUX-1-schnell)
// via le binding "AI" : aucun jeton Cloudflare dans l'app.
import { Ctx, json } from '../_shared';

export const onRequestPost = async ({ request, env }: Ctx): Promise<Response> => {
  if (!env.AI) return json({ error: 'Binding Workers AI "AI" manquant' }, 500);
  const { prompt } = (await request.json().catch(() => ({}))) as { prompt?: string };
  if (!prompt || prompt.length > 600) return json({ error: 'prompt invalide' }, 400);

  const result = await env.AI.run('@cf/black-forest-labs/flux-1-schnell', { prompt, steps: 4 });
  if (!result?.image) return json({ error: 'Aucune image renvoyée' }, 502);
  return json({ image: `data:image/jpeg;base64,${result.image}` });
};
