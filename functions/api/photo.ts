// GET /api/photo?query=… — cherche une vraie photo de plat sur Pexels avec la
// clé serveur. Renvoie { uri, author, url } ou { photo: null }.
import { Ctx, json } from '../_shared';

export const onRequestGet = async ({ request, env }: Ctx): Promise<Response> => {
  if (!env.PEXELS_API_KEY) return json({ photo: null });
  const query = new URL(request.url).searchParams.get('query')?.slice(0, 120) ?? '';
  if (!query.trim()) return json({ error: 'query manquante' }, 400);

  const res = await fetch(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`,
    { headers: { Authorization: env.PEXELS_API_KEY } }
  );
  if (!res.ok) return json({ photo: null });
  const data: any = await res.json();
  const p = data?.photos?.[0];
  const uri = p?.src?.large ?? p?.src?.medium;
  return json({ photo: p && uri ? { uri, author: p.photographer, url: p.url } : null });
};
