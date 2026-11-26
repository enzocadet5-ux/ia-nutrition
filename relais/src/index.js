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
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
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
async function lirePropositions(env) {
  try { return JSON.parse((await env.CORRECTIONS.get("propositions")) || "[]"); } catch { return []; }
}
const texte = (v, n) => String(v || "").replace(/[\u0000-\u001f]/g, " ").slice(0, n).trim();
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
  const { image, type, indice, rectif } = corps || {};
  const rect = rectif && typeof rectif === "object" ? { vrai: texte(rectif.vrai, 300), avant: texte(rectif.avant, 300) } : null;
  const description = texte(corps && corps.description, 500);
  const avecPhoto = typeof image === "string" && image.length > 0;
  if (!avecPhoto && description.length < 3) return json({ erreur: "Envoie une photo ou décris ton repas." }, 400, H);
  if (avecPhoto && image.length > MAX_BASE64) return json({ erreur: "Photo trop lourde." }, 400, H);
  if (avecPhoto && !TYPES_IMAGE.includes(type)) return json({ erreur: "Format de photo non pris en charge." }, 400, H);
  if (!(await quotaJour(env))) return json({ erreur: "Limite de scans du jour atteinte. Réessaie demain." }, 429, H);

  const cle = String(env.ANTHROPIC_API_KEY || "").trim();
  if (!cle.startsWith("sk-ant-")) return json({ erreur: "Clé API absente ou mal collée côté relais." }, 500, H);
  const client = new Anthropic({ apiKey: cle });
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
        content: avecPhoto
          ? [
              { type: "image", source: { type: "base64", media_type: type, data: image } },
              { type: "text", text: NutriIA.promptUtilisateur(texte(indice, 200), corrections, rect && rect.vrai ? rect : null) },
            ]
          : [{ type: "text", text: NutriIA.promptTexte(description, corrections) }],
      }],
    });
    if (rep.stop_reason === "refusal") return json({ erreur: "L'IA n'a pas pu analyser cette photo." }, 422, H);
    const reponse = rep.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    const brut = NutriIA.lireJSON(reponse);
    if (!brut) return json({ erreur: "Réponse de l'IA illisible. Réessaie avec une photo plus nette." }, 502, H);
    return json({ resultat: brut, modele: rep.model }, 200, H);
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ erreur: "L'IA est très demandée. Réessaie dans un instant." }, 429, H);
    if (e instanceof Anthropic.AuthenticationError) return json({ erreur: "Clé API invalide côté relais." }, 500, H);
    if (e instanceof Anthropic.BadRequestError) return json({ erreur: "Photo refusée par l'IA (format ou taille)." }, 400, H);
    if (e instanceof Anthropic.APIConnectionError) return json({ erreur: "Connexion à l'IA impossible." }, 503, H);
    if (e instanceof Anthropic.APIError) return json({ erreur: "Erreur de l'IA (" + e.status + ")." }, 502, H);
    console.error("scan", e && e.stack || e);
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
    // Sauvegarde en ligne (seulement si l'utilisateur a accepté dans l'appli) :
    // une copie par téléphone, protégée par un code secret de 32 caractères, supprimable à tout moment.
    const ms = url.pathname.match(/^\/sauvegarde\/([0-9a-f]{32})$/);
    if (ms && req.method === "GET") {
      const v = await env.CORRECTIONS.get("s:" + ms[1]);
      return v ? new Response(v, { status: 200, headers: { "Content-Type": "application/json; charset=utf-8", ...H } }) : json({ erreur: "Aucune sauvegarde pour ce code." }, 404, H);
    }
    if (ms && req.method === "DELETE") {
      await env.CORRECTIONS.delete("s:" + ms[1]);
      return json({ ok: true }, 200, H);
    }
    if (ms && req.method === "PUT") {
      const ip = req.headers.get("CF-Connecting-IP") || "inconnu";
      if (env.LIMITEUR) { const { success } = await env.LIMITEUR.limit({ key: "s:" + ip }); if (!success) return json({ erreur: "Trop de sauvegardes d'un coup." }, 429, H); }
      const brut = await req.text();
      if (brut.length > 400000) return json({ erreur: "Sauvegarde trop lourde." }, 413, H);
      let d; try { d = JSON.parse(brut); } catch { return json({ erreur: "Sauvegarde illisible." }, 400, H); }
      if (!d || typeof d !== "object" || !Array.isArray(d.repas) || d.consentement !== true) return json({ erreur: "Sauvegarde invalide." }, 400, H);
      await env.CORRECTIONS.put("s:" + ms[1], JSON.stringify({ v: 1, ts: Date.now(), profil: d.profil || null, repas: d.repas.slice(-400) }), { expirationTtl: 31536000 });
      return json({ ok: true, ts: Date.now() }, 200, H);
    }
    // Propositions : n'importe quel utilisateur signale une erreur ; l'entraîneur valide.
    if (url.pathname === "/propositions" && req.method === "POST") {
      const ip = req.headers.get("CF-Connecting-IP") || "inconnu";
      if (env.LIMITEUR) { const { success } = await env.LIMITEUR.limit({ key: "p:" + ip }); if (!success) return json({ erreur: "Trop d'envois d'un coup." }, 429, H); }
      let c; try { c = await req.json(); } catch { return json({ erreur: "Requête illisible." }, 400, H); }
      const item = { id: crypto.randomUUID(), ts: Date.now(), plat: texte(c.plat, 80), avant: texte(c.avant, 300), apres: texte(c.apres, 300) };
      if (item.apres.length < 3) return json({ erreur: "Écris ce qu'est vraiment le plat." }, 400, H);
      const liste = [item, ...(await lirePropositions(env))].slice(0, 300);
      await env.CORRECTIONS.put("propositions", JSON.stringify(liste));
      return json({ ok: true }, 200, H);
    }
    if (url.pathname === "/propositions" && req.method === "GET") {
      if (!estAdmin(req, env)) return json({ erreur: "Code entraîneur incorrect." }, 401, H);
      return json({ propositions: await lirePropositions(env) }, 200, H);
    }
    const mp = url.pathname.match(/^\/propositions\/([\w-]{8,})(\/valider)?$/);
    if (mp && (req.method === "DELETE" || (req.method === "POST" && mp[2]))) {
      if (!estAdmin(req, env)) return json({ erreur: "Code entraîneur incorrect." }, 401, H);
      const props = await lirePropositions(env), p = props.find((x) => x.id === mp[1]);
      await env.CORRECTIONS.put("propositions", JSON.stringify(props.filter((x) => x.id !== mp[1])));
      if (p && mp[2]) {
        let c = {}; try { c = await req.json(); } catch {}
        const corr = { ...p, apres: texte(c.apres, 300) || p.apres, note: texte(c.note, 200), ts: Date.now() };
        const liste = [corr, ...(await lireCorrections(env))].slice(0, 200);
        await env.CORRECTIONS.put("liste", JSON.stringify(liste));
      }
      return json({ ok: true }, 200, H);
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
