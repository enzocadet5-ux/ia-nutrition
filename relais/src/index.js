// Relais IA Nutrition (Cloudflare Worker)
// Cache ta clé API : l'appli envoie la photo ici, le relais appelle Claude avec
// le prompt nutrition et renvoie le JSON. Il n'accepte QUE des analyses de plat
// (on ne peut pas s'en servir comme d'un Claude gratuit), limite les scans par
// minute et par jour, et garde les corrections d'entraînement dans KV.
import Anthropic from "@anthropic-ai/sdk";
import NutriIA from "../../engine.js";

const MODELE = "claude-sonnet-5-5";
const TYPES_IMAGE = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BASE64 = 6_500_000; // ≈ 4,8 Mo d'image (limite API : 5 Mo)

function cors(origine, env) {
  const ok = (env.ORIGINES || "").split(",").map((s) => s.trim()).filter(Boolean);
  const autorise = ok.includes(origine) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origine || "");
  return {
    autorise,
    entetes: {
      "Access-Control-Allow-Origin": autorise ? origine : "null",
      "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    },
  };
}
const json = (corps, statut, entetes) =>
  new Response(JSON.stringify(corps), { status: statut, headers: { "Content-Type": "application/json; charset=utf-8", ...entetes } });

async function lireCorrections(env) {
  try { return JSON.parse((await env.CORRECTIONS.get("liste")) || "[]"); } catch { return []; }
}
function estAdmin(req, env) {
  const t = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  return !!env.ADMIN_TOKEN && t.length >= 16 && t === env.ADMIN_TOKEN;
}

async function quotaJour(env) {
  const cle = "jour:" + new Date().toISOString().slice(0, 10);
  const n = parseInt((await env.CORRECTIONS.get(cle)) || "0", 10);
  const max = parseInt(env.MAX_SCANS_JOUR || "300", 10);
  if (n >= max) return false;
  await env.CORRECTIONS.put(cle, String(n + 1), { expirationTtl: 172800 });
  return true;
}

async function scanner(req, env, H) {
  const ip = req.headers.get("CF-Connecting-IP") || "inconnu";
  if (env.LIMITEUR) {
    const { success } = await env.LIMITEUR.limit({ key: ip });
    if (!success) return json({ erreur: "Trop de scans d'un coup. Attends une minute." }, 429, H);
  }
  let corps;
  try { corps = await req.json(); } catch { return json({ erreur: "Requête illisible." }, 400, H); }
  const { image, type, indice } = corps || {};
  if (typeof image !== "string" || !image.length || image.length > MAX_BASE64) return json({ erreur: "Photo manquante ou trop lourde." }, 400, H);
  if (!TYPES_IMAGE.includes(type)) return json({ erreur: "Format de photo non pris en charge." }, 400, H);
  if (!(await quotaJour(env))) return json({ erreur: "Limite de scans du jour atteinte. Réessaie demain." }, 429, H);

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const corrections = await lireCorrections(env);
  try {
    const rep = await client.beta.messages.create({
      model: MODELE,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      system: [{ type: "text", text: NutriIA.promptSysteme(), cache_control: { type: "ephemeral" } }],
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: type, data: image } },
          { type: "text", text: NutriIA.promptUtilisateur(typeof indice === "string" ? indice : "", corrections) },
        ],
      }],
    });
    if (rep.stop_reason === "refusal") return json({ erreur: "L'IA n'a pas pu analyser cette photo." }, 422, H);
    const texte = rep.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    const brut = NutriIA.lireJSON(texte);
    if (!brut) return json({ erreur: "Réponse de l'IA illisible. Réessaie avec une photo plus nette." }, 502, H);
    return json({ resultat: brut, modele: rep.model }, 200, H);
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ erreur: "L'IA est très demandée. Réessaie dans un instant." }, 429, H);
    if (e instanceof Anthropic.AuthenticationError) return json({ erreur: "Clé API invalide côté relais." }, 500, H);
    if (e instanceof Anthropic.BadRequestError) return json({ erreur: "Photo refusée par l'IA (format ou taille)." }, 400, H);
    if (e instanceof Anthropic.APIConnectionError) return json({ erreur: "Connexion à l'IA impossible." }, 503, H);
    if (e instanceof Anthropic.APIError) return json({ erreur: "Erreur de l'IA (" + e.status + ")." }, 502, H);
    return json({ erreur: "Erreur inattendue du relais." }, 500, H);
  }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const { autorise, entetes: H } = cors(req.headers.get("Origin"), env);
    if (req.method === "OPTIONS") return new Response(null, { status: autorise ? 204 : 403, headers: H });
    if (url.pathname === "/" && req.method === "GET") return json({ ok: true, service: "IA Nutrition", modele: MODELE }, 200, H);
    if (!autorise) return json({ erreur: "Origine non autorisée." }, 403, H);

    if (url.pathname === "/scan" && req.method === "POST") return scanner(req, env, H);

    if (url.pathname === "/corrections" && req.method === "GET") {
      return json({ corrections: await lireCorrections(env), admin: estAdmin(req, env) }, 200, H);
    }
    if (url.pathname === "/corrections" && req.method === "POST") {
      if (!estAdmin(req, env)) return json({ erreur: "Code entraîneur incorrect." }, 401, H);
      let c; try { c = await req.json(); } catch { return json({ erreur: "Requête illisible." }, 400, H); }
      const s = (v, n) => String(v || "").slice(0, n).trim();
      const item = { id: crypto.randomUUID(), ts: Date.now(), plat: s(c.plat, 80), avant: s(c.avant, 300), apres: s(c.apres, 300), note: s(c.note, 200) };
      if (!item.apres) return json({ erreur: "Écris la bonne réponse." }, 400, H);
      const liste = [item, ...(await lireCorrections(env))].slice(0, 200);
      await env.CORRECTIONS.put("liste", JSON.stringify(liste));
      return json({ ok: true, total: liste.length }, 200, H);
    }
    const m = url.pathname.match(/^\/corrections\/([\w-]{8,})$/);
    if (m && req.method === "DELETE") {
      if (!estAdmin(req, env)) return json({ erreur: "Code entraîneur incorrect." }, 401, H);
      const liste = (await lireCorrections(env)).filter((x) => x.id !== m[1]);
      await env.CORRECTIONS.put("liste", JSON.stringify(liste));
      return json({ ok: true, total: liste.length }, 200, H);
    }
    return json({ erreur: "Introuvable." }, 404, H);
  },
};
