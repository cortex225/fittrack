// POST /api/gemini — relaie un appel generateContent vers Gemini avec la clé
// serveur. Le corps a la même forme que l'appel du SDK : { model, contents, config }.
import { Ctx, json } from '../_shared';

const ALLOWED_MODELS = new Set(['gemini-2.5-flash', 'gemini-2.5-flash-lite']);

type Part = { text?: string; inlineData?: { mimeType: string; data: string } };
type Content = { role?: string; parts: Part[] };

const toContents = (contents: unknown): Content[] =>
  typeof contents === 'string' ? [{ role: 'user', parts: [{ text: contents }] }] : (contents as Content[]);

export const onRequestPost = async ({ request, env }: Ctx): Promise<Response> => {
  if (!env.GEMINI_API_KEY) return json({ error: 'GEMINI_API_KEY manquante côté serveur' }, 500);

  let body: { model?: string; contents?: unknown; config?: Record<string, any> };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'JSON invalide' }, 400);
  }
  const model = body.model ?? '';
  if (!ALLOWED_MODELS.has(model)) return json({ error: `Modèle non autorisé : ${model}` }, 400);
  if (!body.contents) return json({ error: 'contents manquant' }, 400);

  const { systemInstruction, ...generationConfig } = body.config ?? {};
  const payload: Record<string, unknown> = {
    contents: toContents(body.contents),
    generationConfig,
  };
  if (systemInstruction) payload.systemInstruction = { parts: [{ text: String(systemInstruction) }] };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify(payload),
    }
  );
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Le statut est repris tel quel pour que l'app réessaie sur 429 et 503.
    return json({ error: data?.error?.message ?? `Gemini HTTP ${res.status}` }, res.status);
  }
  const parts: (Part & { thought?: boolean })[] = data?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.filter((p) => p.text && !p.thought).map((p) => p.text).join('');
  return json({ text });
};
