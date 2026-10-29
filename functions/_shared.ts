// Utilitaires partagés par les fonctions serveur Cloudflare Pages.
// Les clés restent ici, côté serveur : l'app web ne les voit jamais.

export interface Env {
  GEMINI_API_KEY?: string;
  PEXELS_API_KEY?: string;
  // Binding Workers AI (Settings > Bindings > Workers AI, nom "AI").
  AI?: { run: (model: string, input: Record<string, unknown>) => Promise<any> };
}

export interface Ctx {
  request: Request;
  env: Env;
}

export const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
