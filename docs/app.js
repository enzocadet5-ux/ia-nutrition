// IA Nutrition : interface (les calculs nutritionnels sont dans engine.js)
{
"use strict";
const N = NutriIA;
const RELAIS = (window.IA_NUTRITION_RELAIS || "").replace(/\/$/, "");
const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (v, d = 0) => (Math.round((+v || 0) * 10 ** d) / 10 ** d).toLocaleString("fr-FR");
const jourCle = (t) => { const d = new Date(t); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const aujourdhui = () => jourCle(Date.now());
const vibre = (ms = 12) => { try { navigator.vibrate?.(ms); } catch {} };
const majuscule = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// ============ STOCKAGE SUR L'APPAREIL ============
function lire(cle, defaut) { try { const v = localStorage.getItem("ian_" + cle); return v ? JSON.parse(v) : defaut; } catch { return defaut; } }
function ecrire(cle, v) { try { localStorage.setItem("ian_" + cle, JSON.stringify(v)); return true; } catch { return false; } }
let profil = lire("profil", null);
let repas = lire("repas", []);
let code = lire("code", "");
let cleSauv = lire("cleSauv", "");
let sauvInfo = lire("sauvInfo", { ts: 0, erreur: "" });
const UI = { vue: profil ? "jour" : "profil", etat: "pret", analyse: null, erreur: "", indice: "", corrections: null, propositions: [], admin: false, msgEnt: "", modeTexte: false };

function sauverRepas() {
  repas = repas.filter((r) => Date.now() - r.ts < 35 * 864e5).sort((a, b) => a.ts - b.ts);
  repas.forEach((r, i) => { if (i < repas.length - 40) r.photo = null; }); // vignettes des 40 derniers repas seulement
  if (!ecrire("repas", repas)) { repas.forEach((r) => (r.photo = null)); ecrire("repas", repas); }
  programmerSauvegarde();
}

// ============ SAUVEGARDE EN LIGNE (avec consentement) ============
const sauvOui = () => profil && profil.sauvegarde === "oui";
function nouvelleCle() { const a = new Uint8Array(16); crypto.getRandomValues(a); return [...a].map((x) => x.toString(16).padStart(2, "0")).join(""); }
let minuteurSauv = null;
function programmerSauvegarde() { if (!sauvOui() || !RELAIS) return; clearTimeout(minuteurSauv); minuteurSauv = setTimeout(sauvegarderEnLigne, 1500); }
async function sauvegarderEnLigne() {
  if (!sauvOui() || !RELAIS) return;
  if (!cleSauv) { cleSauv = nouvelleCle(); ecrire("cleSauv", cleSauv); }
  try {
    const rep = await fetch(RELAIS + "/sauvegarde/" + cleSauv, { method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consentement: true, profil, repas: repas.map(({ photo, ...r }) => r) }) });
    if (!rep.ok) throw new Error((await rep.json().catch(() => ({}))).erreur || "Erreur " + rep.status);
    sauvInfo = { ts: Date.now(), erreur: "" };
  } catch (e) { sauvInfo = { ts: sauvInfo.ts, erreur: e.message === "Failed to fetch" ? "pas de réseau, nouvel essai au prochain changement" : e.message }; }
  ecrire("sauvInfo", sauvInfo); if (UI.vue === "profil") rendre();
}
async function supprimerEnLigne() {
  if (cleSauv && RELAIS) { try { await fetch(RELAIS + "/sauvegarde/" + cleSauv, { method: "DELETE" }); } catch {} }
  cleSauv = ""; ecrire("cleSauv", ""); sauvInfo = { ts: 0, erreur: "" }; ecrire("sauvInfo", sauvInfo);
}

// ============ MASCOTTE : PÉPIN L'AVOCAT ============
function mascotte(humeur = "content", taille = 76) {
  const yeux = {
    content: `<circle cx="47" cy="52" r="4.5" fill="#1d2b22"/><circle cx="73" cy="52" r="4.5" fill="#1d2b22"/><circle cx="48.5" cy="50.5" r="1.4" fill="#fff"/><circle cx="74.5" cy="50.5" r="1.4" fill="#fff"/>`,
    fier: `<path d="M41 53q6-7 12 0M67 53q6-7 12 0" stroke="#1d2b22" stroke-width="3.5" fill="none" stroke-linecap="round"/>`,
    reflechit: `<circle cx="49" cy="49" r="4.5" fill="#1d2b22"/><circle cx="75" cy="49" r="4.5" fill="#1d2b22"/><circle cx="50.5" cy="47.5" r="1.4" fill="#fff"/><circle cx="76.5" cy="47.5" r="1.4" fill="#fff"/>`,
    inquiet: `<circle cx="47" cy="54" r="4.5" fill="#1d2b22"/><circle cx="73" cy="54" r="4.5" fill="#1d2b22"/><path d="M40 44l12 4M80 44l-12 4" stroke="#1d2b22" stroke-width="3" stroke-linecap="round"/>`,
    dort: `<path d="M41 54q6 4 12 0M67 54q6 4 12 0" stroke="#1d2b22" stroke-width="3.5" fill="none" stroke-linecap="round"/>`
  }[humeur] || "";
  const bouche = {
    content: `<path d="M53 63q7 7 14 0" stroke="#1d2b22" stroke-width="3.5" fill="none" stroke-linecap="round"/>`,
    fier: `<path d="M50 61q10 13 20 0z" fill="#1d2b22"/><path d="M54 65q6 4 12 0" fill="#ff8fa3"/>`,
    reflechit: `<path d="M55 65h10" stroke="#1d2b22" stroke-width="3.5" stroke-linecap="round"/>`,
    inquiet: `<path d="M52 67q4-5 8 0t8 0" stroke="#1d2b22" stroke-width="3.2" fill="none" stroke-linecap="round"/>`,
    dort: `<ellipse cx="60" cy="65" rx="3.5" ry="2.5" fill="#1d2b22"/>`
  }[humeur] || "";
  const extra = humeur === "dort" ? `<text x="88" y="30" font-family="Archivo" font-weight="800" font-size="16" fill="#4a7a5a">z</text><text x="98" y="18" font-family="Archivo" font-weight="800" font-size="12" fill="#4a7a5a">z</text>`
    : humeur === "fier" ? `<path d="M100 22l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#f2bd3a"/>`
    : humeur === "reflechit" ? `<circle cx="95" cy="28" r="3" fill="#8fb39a"/><circle cx="103" cy="18" r="4.5" fill="#8fb39a"/>` : "";
  return `<svg width="${taille}" height="${Math.round(taille * 1.08)}" viewBox="0 0 120 130" role="img" aria-label="Pépin, la mascotte">
    <path d="M60 4c8 0 10 6 8 11" stroke="#6b4a2b" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M66 12c8-8 20-6 22-2-6 6-16 8-22 2z" fill="#4caf50"/>
    <path d="M60 12C82 12 94 40 98 62c6 34-12 62-38 62S16 96 22 62C26 40 38 12 60 12z" fill="#2e6b3a"/>
    <path d="M60 20C78 20 88 44 91 63c5 28-10 53-31 53S24 91 29 63C32 44 42 20 60 20z" fill="#bfe08a"/>
    <circle cx="60" cy="92" r="18" fill="#9a6338"/><circle cx="54" cy="86" r="5" fill="#b87d4b"/>
    <ellipse cx="40" cy="64" rx="6" ry="4" fill="#ff9fb0" opacity=".7"/><ellipse cx="80" cy="64" rx="6" ry="4" fill="#ff9fb0" opacity=".7"/>
    ${yeux}${bouche}${extra}</svg>`;
}
const pepin = (humeur, texte, taille) => `<div class="pepin ${humeur === "reflechit" ? "reflechit" : ""}">${mascotte(humeur, taille)}<div class="bulle">${texte}</div></div>`;

// ============ MESSAGES « ANNULER » ============
let minuteurToast = null;
function toast(texte, action) {
  const t = $("#toast"), b = $("#toast-btn");
  $("#toast-txt").textContent = texte; b.hidden = !action; b.onclick = action ? () => { action(); t.classList.remove("vu"); } : null;
  t.classList.add("vu"); clearTimeout(minuteurToast); minuteurToast = setTimeout(() => t.classList.remove("vu"), action ? 5000 : 2600);
}

// ============ EXEMPLE ============
const EXEMPLE = { estUnPlat: true, plat: "Rougail saucisse, riz, grains", confiance: 80, conseil: "Remplace la moitié des saucisses par des grains en plus : autant de protéines, beaucoup moins de sel et de nitrites.",
  ingredientsCaches: ["huile de cuisson", "saindoux possible"],
  aliments: [
    { nom: "Rougail saucisse", grammes: 160, groupe: "viande", nova: 4, additifs: ["E250", "E621"], kcal100: 300, proteines100: 13, glucides100: 2, lipides100: 27, fibres100: 0, sucres100: 1, sucresAjoutes100: 0, ags100: 10, sel100: 2 },
    { nom: "Riz blanc cuit", grammes: 200, groupe: "feculent", nova: 1, additifs: [], kcal100: 130, proteines100: 2.7, glucides100: 28, lipides100: 0.3, fibres100: 0.4, sucres100: 0.1, sucresAjoutes100: 0, ags100: 0.1, sel100: 0 },
    { nom: "Grains (haricots rouges)", grammes: 120, groupe: "legumineuse", nova: 3, additifs: [], kcal100: 110, proteines100: 7.5, glucides100: 14, lipides100: 2, fibres100: 7, sucres100: 1, sucresAjoutes100: 0, ags100: 0.3, sel100: 0.6 } ] };

// ============ ANALYSE (photo ou texte) ============
function chargerImage(fichier) {
  return new Promise((ok, ko) => { const url = URL.createObjectURL(fichier); const img = new Image(); img.onload = () => { URL.revokeObjectURL(url); ok(img); }; img.onerror = () => ko(new Error("image")); img.src = url; });
}
function redimensionner(img, max, q) {
  const r = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth * r); c.height = Math.round(img.naturalHeight * r);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); return c.toDataURL("image/jpeg", q);
}
async function envoyerScan(corps) {
  if (!RELAIS) throw new Error("Le relais n'est pas encore configuré (fichier config.js).");
  let rep;
  try { rep = await fetch(RELAIS + "/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corps) }); }
  catch { throw new Error("Pas de connexion. Vérifie ton réseau et réessaie."); }
  const d = await rep.json().catch(() => ({}));
  if (!rep.ok) throw new Error(d.erreur || "Erreur " + rep.status);
  return N.normaliserScan(d.resultat);
}
const resumeScan = (scan) => scan.aliments.map((a) => a.nom + " " + a.grammes + " g (NOVA " + a.nova + (a.additifs.length ? ", " + a.additifs.join(" ") : "") + ")").join(" ; ");

const ETAPES = ["Je repère les aliments", "J'estime les portions", "Je vérifie additifs et transformation", "Je calcule pour ton profil"];
let minuteurEtapes = null;
function demarrerAttente(vignette, titre) {
  UI.etat = "analyse"; UI.vignette = vignette; UI.titreAttente = titre; UI.etape = 0; aller("scan"); window.scrollTo(0, 0);
  clearInterval(minuteurEtapes);
  minuteurEtapes = setInterval(() => {
    if (UI.etat !== "analyse") return clearInterval(minuteurEtapes);
    UI.etape = Math.min(ETAPES.length - 1, UI.etape + 1);
    document.querySelectorAll(".etapes li").forEach((li, i) => li.classList.toggle("fait", i < UI.etape));
  }, 2200);
}
function echecAnalyse(message) { clearInterval(minuteurEtapes); UI.etat = "erreur"; UI.erreur = message; rendre(); }

async function scannerPhoto(fichier) {
  if (!profil) return aller("profil");
  let img; try { img = await chargerImage(fichier); } catch { return echecAnalyse("Ce fichier n'est pas une image lisible."); }
  const grande = redimensionner(img, 1280, 0.82), vignette = redimensionner(img, 240, 0.7);
  demarrerAttente(vignette, "Pépin regarde ton assiette…");
  try {
    const scan = await envoyerScan({ image: grande.split(",")[1], type: "image/jpeg", indice: UI.indice.slice(0, 200) });
    if (!scan) return echecAnalyse("Je ne vois pas de nourriture sur cette photo. Essaie une photo nette, vue de dessus.");
    ouvrirAnalyse(scan, { photo: vignette, image: grande, indice: UI.indice, source: "photo" });
  } catch (e) { echecAnalyse(e.message); }
}
async function analyserTexte(description) {
  if (!profil) return aller("profil");
  demarrerAttente(null, "Pépin lit ta description…");
  try {
    const scan = await envoyerScan({ description: description.slice(0, 500) });
    if (!scan) return echecAnalyse("Je n'ai pas reconnu de repas dans ta description. Cite les aliments, par exemple « 2 œufs, une baguette, un café sucré ».");
    ouvrirAnalyse(scan, { description, source: "texte" });
  } catch (e) { echecAnalyse(e.message); }
}
function ouvrirAnalyse(scan, o = {}) {
  clearInterval(minuteurEtapes);
  UI.analyse = { id: o.id || String(Date.now()), ts: o.ts || Date.now(), scan, photo: o.photo || null, image: o.image || null, indice: o.indice || "", description: o.description || "",
    source: o.source || "photo", creneau: o.creneau || N.creneauSelonHeure(new Date()), exemple: !!o.exemple, existant: !!o.existant, rectifie: o.rectifie || "" };
  UI.etat = "resultat"; UI.indice = ""; UI.modeTexte = false; vibre(); aller("scan"); window.scrollTo(0, 0);
}
function ouvrirRepas(id) {
  const r = repas.find((x) => x.id === id); if (!r) return;
  const scan = { plat: r.nom, confiance: r.confiance ?? 70, aliments: r.aliments.map((a) => ({ ...a, per100: { ...a.per100 }, additifs: [...a.additifs] })), caches: r.caches || [], conseil: r.conseil || "" };
  ouvrirAnalyse(scan, { id: r.id, ts: r.ts, photo: r.photo, creneau: r.creneau, source: r.source, existant: true });
}
function enregistrerAnalyse() {
  const A = UI.analyse, r = N.analyserRepas(A.scan.aliments, profil, A.creneau);
  const m = { id: A.id, ts: A.ts, nom: A.scan.plat, creneau: A.creneau, aliments: A.scan.aliments, kcal: Math.round(r.totaux.kcal), verdict: r.healthy.verdict,
    photo: A.photo, source: A.source, confiance: A.scan.confiance, caches: A.scan.caches, conseil: A.scan.conseil };
  const i = repas.findIndex((x) => x.id === A.id); if (i >= 0) repas[i] = m; else repas.push(m);
  sauverRepas(); return m;
}
function refaire(id) {
  const r = repas.find((x) => x.id === id); if (!r) return;
  const copie = { ...JSON.parse(JSON.stringify(r)), id: String(Date.now()), ts: Date.now(), creneau: N.creneauSelonHeure(new Date()), source: "refait" };
  repas.push(copie); sauverRepas(); vibre();
  UI.analyse = null; UI.etat = "pret"; aller("jour");
  toast("« " + r.nom + " » ajouté à aujourd'hui", () => { repas = repas.filter((x) => x.id !== copie.id); sauverRepas(); rendre(); });
}

// ============ PETITS COMPOSANTS ============
const repasDuJour = (cle = aujourdhui()) => repas.filter((r) => jourCle(r.ts) === cle);
const chipVerdict = (v) => `<span class="chip ${v === "HEALTHY" ? "c-vert" : v === "MOYEN" ? "c-orange" : "c-rouge"}">${esc(v)}</span>`;
function anneau(valeur, cible) {
  const r = 64, C = 2 * Math.PI * r, p = Math.min(1, valeur / cible), plus = valeur > cible * 1.05;
  return `<div class="anneau"><svg viewBox="0 0 156 156" aria-hidden="true"><circle cx="78" cy="78" r="${r}" fill="none" stroke="var(--surf2)" stroke-width="14"/>
    <circle cx="78" cy="78" r="${r}" fill="none" stroke="${plus ? "var(--tom)" : "var(--leaf)"}" stroke-width="14" stroke-linecap="round" stroke-dasharray="${C * p} ${C}"/></svg>
    <div class="centre"><b class="num">${fmt(valeur)}</b><span class="petit">sur ${fmt(cible)} kcal</span></div></div>`;
}
function ligneMacro(nom, val, obj, couleur) {
  return `<div class="macro"><div class="haut"><b>${nom}</b><span class="num petit">${fmt(val)} / ${fmt(obj)} g</span></div><div class="barre"><i style="width:${Math.min(100, (val / (obj || 1)) * 100)}%;background:${couleur}"></i></div></div>`;
}
const vignetteRepas = (r) => r.photo ? `<img src="${r.photo}" alt="">` : `<span class="ph" aria-hidden="true">${r.source === "texte" ? "✍️" : "🍽"}</span>`;
function ligneRepas(r) {
  return `<button class="repas" data-act="ouvrir" data-id="${esc(r.id)}">${vignetteRepas(r)}<span><b>${esc(r.nom)}</b><span class="petit" style="display:block">${fmt(r.kcal)} kcal · ${new Date(r.ts).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span></span>${chipVerdict(r.verdict)}</button>`;
}
function frequents() {
  const vus = {};
  repas.slice().reverse().forEach((r) => { const k = r.nom.toLowerCase(); if (!vus[k]) vus[k] = { r, n: 0 }; vus[k].n++; });
  return Object.values(vus).sort((a, b) => b.n - a.n).slice(0, 6).map((x) => x.r);
}
function ligneRepere(l) {
  const c = l.etat === "trop" ? "var(--tom)" : l.etat === "proche" ? "var(--yolk)" : "var(--leaf)";
  const val = l.cle === "ultra" ? l.valeur + " %" : fmt(l.valeur, l.unite === "g" && l.valeur < 10 ? 1 : 0) + " " + l.unite;
  const rep = l.cle === "ultra" ? "< 30 %" : (l.cle === "sel" ? "< " : "") + fmt(l.repere) + " " + l.unite;
  return `<div><div class="ligne entre" style="margin-bottom:4px"><span><b>${l.nom}</b>${l.etat === "trop" && l.source ? ` <span class="petit">· surtout ${esc(l.source)}</span>` : ""}</span><span class="num"><b style="color:${c}">${val}</b> <span class="petit">/ ${rep}</span></span></div>
    <div class="barre-rep"><i style="width:${Math.min(100, l.ratio * 80)}%;background:${c}"></i><span class="rep" style="left:80%"></span></div></div>`;
}

// ============ CONSENTEMENT ============
const TEXTE_SAUV = `<p style="margin:0">IA Nutrition peut <b>sauvegarder en ligne</b> ton profil (âge, sexe, taille, poids, activité, objectif) et tes repas (aliments, calories, verdicts). La copie est stockée sur le serveur de l'appli (Cloudflare), protégée par un code secret propre à ton téléphone. Les photos ne sont pas sauvegardées.</p>
  <p class="petit" style="margin:0"><b>Si tu acceptes</b> : ta journée et tes semaines sont gardées et tu peux les récupérer sur un autre téléphone avec ton code.<br><b>Si tu refuses</b> : rien n'est envoyé, mais ta journée et tes semaines ne sont pas sauvegardées. Si tu changes de téléphone, supprimes l'appli ou effaces les données du navigateur, tout est perdu, et ton expérience dans l'appli sera limitée.<br>Tu peux changer d'avis à tout moment dans Profil ; si tu arrêtes, ta copie en ligne est supprimée.</p>`;
function blocChoixSauv(dansFormulaire) {
  return `<div class="carte pile" style="border-color:var(--leaf)"><h3>Sauvegarde de tes données</h3>${TEXTE_SAUV}
    ${dansFormulaire
      ? `<label class="ligne" style="font-weight:600"><input type="radio" name="sauv" value="oui" required style="width:22px;height:22px"> Oui, sauvegarder mes données en ligne</label><label class="ligne" style="font-weight:600"><input type="radio" name="sauv" value="non" style="width:22px;height:22px"> Non, garder seulement sur ce téléphone (sans sauvegarde)</label>`
      : `<div class="grille2"><button data-act="consentir" data-val="oui">Oui, sauvegarder</button><button class="sec" data-act="consentir" data-val="non">Non merci</button></div>`}</div>`;
}

// ============ VUE : AUJOURD'HUI ============
function vueJour() {
  if (!profil) return "";
  const liste = repasDuJour(), b = N.besoins(profil), om = N.objectifsMacros(b);
  const jour = N.bilanJour(liste.map((r) => ({ nom: r.nom, aliments: r.aliments })), profil), t = jour.totaux;
  const reste = Math.round(b.cible - t.kcal), h = new Date().getHours();
  const bonjour = h < 5 ? "Bonne nuit" : h < 12 ? "Bonjour" : h < 18 ? "Bon après-midi" : "Bonsoir";
  const humeur = !liste.length ? (h < 10 ? "content" : "dort") : jour.trop.length ? "inquiet" : "fier";
  const message = !liste.length ? `${bonjour} ! Scanne ton premier repas et je te dis s'il est healthy.`
    : jour.trop.length ? `Attention : ${esc(jour.trop.map((l) => l.nom.toLowerCase()).join(", "))} au-dessus des repères aujourd'hui.`
    : reste > 0 ? `Bien joué ! Il te reste environ <b>${fmt(reste)} kcal</b> pour aujourd'hui.` : `Tu as atteint ton objectif du jour, tout en restant dans les repères.`;
  const parCreneau = Object.keys(N.CRENEAUX).map((k) => ({ k, l: liste.filter((r) => r.creneau === k) })).filter((x) => x.l.length);
  const freq = frequents();
  return `<div class="pile apparait">
    ${!profil.sauvegarde ? blocChoixSauv(false) : ""}
    ${pepin(humeur, message, 72)}
    <div class="carte"><div class="jour-tete">${anneau(t.kcal, b.cible)}
      <div>${ligneMacro("Protéines", t.proteines, om.proteines, "var(--prot)")}${ligneMacro("Glucides", t.glucides, om.glucides, "var(--gluc)")}${ligneMacro("Lipides", t.lipides, om.lipides, "var(--lip)")}${ligneMacro("Fibres", t.fibres, om.fibres, "var(--leaf)")}</div></div>
      <p class="petit" style="margin:10px 0 0">${reste >= 0 ? `Reste <b class="num">${fmt(reste)} kcal</b>` : `<b class="num" style="color:var(--tom)">${fmt(-reste)} kcal</b> au-dessus`} · objectif ${fmt(b.cible)} kcal pour ${fmt(profil.poids, 1)} kg</p></div>
    ${liste.length && jour.lignes.some((l) => l.etat !== "ok") ? `<div class="carte pile"><h3>À surveiller aujourd'hui</h3>${jour.lignes.filter((l) => l.etat !== "ok").map(ligneRepere).join("")}</div>` : ""}
    <div class="carte"><div class="ligne entre"><h3>Mes repas</h3><button class="mini" data-act="allerScan">+ Ajouter</button></div>
      ${liste.length ? parCreneau.map((x) => `<div class="creneau-titre">${esc(majuscule(N.CRENEAUX[x.k].nom))}</div>${x.l.map(ligneRepas).join("")}`).join("")
        : `<p class="petit">Aucun repas aujourd'hui. Prends ton plat en photo ou décris-le.</p>`}</div>
    ${freq.length ? `<div class="carte pile"><h3>Refaire un repas</h3><p class="petit" style="margin:0">Tu remanges la même chose ? Ajoute-le en un geste, sans scanner.</p><div class="frequents">${freq.map((r) => `<button class="sec mini" data-act="refaire" data-id="${esc(r.id)}">${esc(r.nom.length > 28 ? r.nom.slice(0, 27) + "…" : r.nom)} · ${fmt(r.kcal)}</button>`).join("")}</div></div>` : ""}
  </div>`;
}

// ============ VUE : SCANNER ET RÉSULTAT ============
function vueScan() {
  if (UI.etat === "analyse") return `<div class="attente apparait">${UI.vignette ? `<img src="${UI.vignette}" alt="Ta photo">` : ""}${pepin("reflechit", esc(UI.titreAttente), 70)}
    <ol class="etapes">${ETAPES.map((e, i) => `<li class="${i < UI.etape ? "fait" : ""}">${e}</li>`).join("")}</ol><div class="roue" role="status" aria-label="Analyse en cours"></div></div>`;
  if (UI.etat === "resultat" && UI.analyse) return vueResultat();
  return `<div class="pile apparait">
    ${UI.etat === "erreur" ? `<div class="alerte" role="alert"><b>Oups.</b> ${esc(UI.erreur)}</div>` : ""}
    <label class="scan-zone" for="photo">
      <span class="rond-photo"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg></span>
      <h2 style="font-size:24px;color:var(--ink)">Prendre mon plat en photo</h2>
      <span class="petit">Bien éclairé, vu de dessus, toute l'assiette dans le cadre.</span>
      <input id="photo" type="file" accept="image/*" capture="environment" hidden>
    </label>
    <div class="grille2"><label class="bouton sec" for="galerie">Galerie<input id="galerie" type="file" accept="image/*" hidden></label><button class="sec" data-act="modeTexte" aria-expanded="${UI.modeTexte}">Décrire mon repas</button></div>
    ${UI.modeTexte ? `<div class="carte pile apparait"><label for="desc">Qu'est-ce que tu as mangé ?</label><textarea id="desc" maxlength="500" placeholder="ex. 2 œufs au plat, une demi-baguette, un café avec 2 sucres"></textarea><button class="plein" data-act="analyserTexte">Analyser ma description</button></div>`
      : `<div><label for="indice">Précision pour la photo (facultatif)</label><input id="indice" placeholder="ex. cari poulet du RU, sauce à part" maxlength="200" value="${esc(UI.indice)}"></div>`}
    <button class="sec plein" data-act="exemple">Voir un exemple de résultat</button>
    <p class="petit">Estimations, pas un avis médical. La photo ou la description est envoyée à l'IA Claude pour l'analyse et n'est pas conservée sur le serveur.</p>
  </div>`;
}

function vueResultat() {
  const A = UI.analyse, r = N.analyserRepas(A.scan.aliments, profil, A.creneau), h = r.healthy, p = r.portion, t = r.totaux;
  const cls = h.verdict === "PAS HEALTHY" ? "v-PAS" : "v-" + h.verdict;
  const humeur = h.verdict === "HEALTHY" ? "fier" : h.verdict === "MOYEN" ? "content" : "inquiet";
  const phrase = h.verdict === "HEALTHY" ? (p.niveau === "trop" ? "Bon choix, mais la portion est grosse pour ce repas !" : "Super assiette, bravo !") : h.verdict === "MOYEN" ? "Pas mal, avec quelques points à améliorer." : "Ce plat n'est pas idéal. Regarde pourquoi plus bas.";
  const max = Math.max(p.ideal * 1.6, t.kcal), coulP = { leger: "var(--yolk)", adapte: "var(--leaf)", copieux: "var(--yolk)", trop: "var(--tom)" }[p.niveau];
  const E = { p: t.proteines * 4, g: t.glucides * 4, l: t.lipides * 9 }, Et = E.p + E.g + E.l || 1;
  const autres = repasDuJour(jourCle(A.ts)).filter((x) => x.id !== A.id).map((x) => ({ nom: x.nom, aliments: x.aliments }));
  const jour = N.bilanJour(autres.concat([{ nom: A.scan.plat, aliments: A.scan.aliments }]), profil);
  const score = (s) => { const C = 2 * Math.PI * 30; return `<svg width="76" height="76" viewBox="0 0 76 76" aria-hidden="true"><circle cx="38" cy="38" r="30" fill="none" stroke="currentColor" stroke-opacity=".18" stroke-width="8"/><circle cx="38" cy="38" r="30" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-dasharray="${C * s / 100} ${C}" transform="rotate(-90 38 38)"/><text x="38" y="45" text-anchor="middle" font-family="Archivo" font-weight="800" font-size="21" fill="currentColor">${s}</text></svg>`; };
  return `<div class="pile apparait">
    ${A.exemple ? `<div class="note"><b>Exemple</b> : ce plat est fictif, pour te montrer le résultat.</div>` : ""}
    ${A.photo ? `<img class="photo" src="${A.photo}" alt="Photo du plat">` : ""}
    <div><h2>${esc(A.scan.plat)}</h2>${A.existant ? `<p class="petit" style="margin:4px 0 0">${esc(majuscule(new Date(A.ts).toLocaleString("fr-FR", { weekday: "long", hour: "2-digit", minute: "2-digit" })))}</p>` : ""}</div>
    <div class="verdict ${cls}">${score(h.score)}<div><b class="mot">${h.verdict}</b><span class="txt petit">Score santé ${h.score}/100${!A.existant && A.source !== "refait" ? " · confiance de l'IA " + A.scan.confiance + " %" : ""}</span></div></div>
    ${pepin(humeur, phrase, 60)}
    <div class="carte pile">
      <div class="ligne entre" style="align-items:flex-end"><div><div class="kcal num">${fmt(t.kcal)}<span style="font-size:20px"> kcal</span></div><span class="petit">pour ${fmt(t.grammes)} g</span></div>
      <div><label for="creneau" class="petit" style="font-weight:600">Repas</label><select id="creneau" style="width:auto">${Object.keys(N.CRENEAUX).map((k) => `<option value="${k}" ${k === A.creneau ? "selected" : ""}>${N.CRENEAUX[k].nom}</option>`).join("")}</select></div></div>
      <div><div class="pile-macros" role="img" aria-label="Répartition de l'énergie"><i style="width:${E.p / Et * 100}%;background:var(--prot)"></i><i style="width:${E.g / Et * 100}%;background:var(--gluc)"></i><i style="width:${E.l / Et * 100}%;background:var(--lip)"></i></div>
        <div class="legende" style="margin-top:6px"><span style="--c:var(--prot)">Protéines ${fmt(t.proteines)} g</span><span style="--c:var(--gluc)">Glucides ${fmt(t.glucides)} g</span><span style="--c:var(--lip)">Lipides ${fmt(t.lipides)} g</span></div></div>
      <div><div class="barre-rep" role="img" aria-label="${fmt(t.kcal)} kcal sur une part idéale de ${fmt(p.ideal)} kcal"><i style="width:${Math.min(100, t.kcal / max * 100)}%;background:${coulP}"></i><span class="rep" style="left:${p.ideal / max * 100}%"></span></div>
      <div class="ligne entre petit" style="margin-top:6px"><span>Ta part pour un ${esc(p.nomCreneau)} : <b>${fmt(p.ideal)} kcal</b></span><span>${fmt(profil.poids, 1)} kg</span></div></div>
      <p style="margin:0;font-weight:600;color:${coulP}">${esc(p.texte)}</p>
    </div>
    <div class="carte pile"><h3>Pourquoi ${h.verdict === "HEALTHY" ? "c'est healthy" : "ce verdict"}</h3>
      ${h.moins.length ? `<ul class="raisons">${h.moins.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
      ${h.plus.length ? `<ul class="raisons" style="color:var(--leaf)">${h.plus.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
      ${A.scan.conseil ? `<p style="margin:0"><b>Conseil de Pépin :</b> ${esc(A.scan.conseil)}</p>` : ""}
      ${A.scan.caches.length ? `<p class="petit" style="margin:0">Ingrédients possibles non visibles : ${A.scan.caches.map(esc).join(", ")}</p>` : ""}</div>
    ${h.additifs.length ? `<div class="carte pile"><h3>Additifs probables</h3>${h.additifs.map((a) => `<div><span class="chip c-${a.niveau}">${esc(a.code)} · ${a.niveau === "rouge" ? "à éviter" : a.niveau === "orange" ? "à limiter" : "sans souci"}</span> <b>${esc(a.nom)}</b><div class="petit">${esc(a.pourquoi)}</div></div>`).join("")}<p class="petit" style="margin:0">Déduits du type de produit : vérifie l'étiquette si tu l'as.</p></div>` : `<div class="carte"><span class="chip c-vert">Sans additif identifié</span></div>`}
    <div class="carte"><h3 style="margin-bottom:4px">Ce que l'IA a vu</h3><p class="petit" style="margin:0 0 6px">Ajuste les quantités : tout se recalcule.</p>
      ${A.scan.aliments.map((a, i) => `<div class="aliment"><div><b>${esc(a.nom)}</b>${a.certain ? "" : ' <span class="chip c-orange">incertain</span>'}<div class="petit num">${fmt(a.per100.kcal * a.grammes / 100)} kcal · NOVA ${a.nova}${a.nova === 4 ? " (ultra-transformé)" : ""}</div></div>
        <div class="stepper"><button class="rond" data-act="moins" data-i="${i}" aria-label="Moins de ${esc(a.nom)}">−</button><input type="number" inputmode="numeric" min="1" max="2000" value="${a.grammes}" data-g="${i}" aria-label="Grammes de ${esc(a.nom)}"><button class="rond" data-act="plus" data-i="${i}" aria-label="Plus de ${esc(a.nom)}">+</button>${A.scan.aliments.length > 1 ? `<button class="rond" data-act="retirerAliment" data-i="${i}" aria-label="Retirer ${esc(a.nom)}">×</button>` : ""}</div></div>`).join("")}</div>
    <div class="carte pile"><h3>Avec ce repas, aujourd'hui</h3><p style="margin:0;font-weight:600">${esc(jour.resume)}</p>${jour.lignes.filter((l) => l.etat !== "ok" || l.cle === "kcal").map(ligneRepere).join("")}</div>
    ${A.exemple ? "" : A.existant ? `<button class="plein" data-act="enregistrer">Enregistrer les modifications</button><div class="grille2"><button class="sec" data-act="refaire" data-id="${esc(A.id)}">Refaire aujourd'hui</button><button class="dang" data-act="supprimerRepas">Supprimer</button></div>`
      : `<button class="plein" data-act="ajouter">Ajouter à ma journée</button>`}
    ${A.existant ? "" : blocTrompe(A)}
    ${code && !A.exemple ? blocCorriger(A) : ""}
    <button class="sec plein" data-act="nouveau">${A.existant ? "Retour" : "Scanner un autre plat"}</button>
  </div>`;
}
function blocTrompe(A) {
  if (A.rectifie) return `<div class="carte"><b>Analyse corrigée</b> d'après ta réponse : « ${esc(A.rectifie)} ».<div class="petit">${code ? "Ta correction est enregistrée pour entraîner l'IA." : "Merci ! Ta correction a été envoyée à l'entraîneur pour améliorer l'IA."}</div></div>`;
  if (!A.image && !A.description) return "";
  return `<details class="carte" ${UI.ouvrirTrompe ? "open" : ""}><summary style="font-weight:700;cursor:pointer">L'IA s'est trompée ?</summary><div class="pile" style="margin-top:12px">
    <div><label for="r-vrai">Qu'est-ce que c'est vraiment ?</label><textarea id="r-vrai" maxlength="300" placeholder="ex. cari de thon maison avec du riz complet, pas du poulet"></textarea></div>
    <p class="petit" style="margin:0">L'IA va refaire l'analyse avec ta réponse (c'est un nouveau scan).</p>
    <button class="plein" data-act="rectifier">Corriger et réanalyser</button><p class="petit" id="r-msg" style="margin:0"></p></div></details>`;
}
function blocCorriger(A) {
  return `<details class="carte"><summary style="font-weight:700;cursor:pointer">Entraîner l'IA sur ce plat (entraîneur)</summary><div class="pile" style="margin-top:12px">
    <p class="petit" style="margin:0">L'IA avait vu : ${esc(resumeScan(A.scan))}</p>
    <div><label for="c-apres">La bonne réponse</label><textarea id="c-apres" maxlength="300" placeholder="ex. cari poulet du RU, portion de riz 250 g, fait maison donc NOVA 3 sans additif"></textarea></div>
    <div><label for="c-note">Règle à retenir (facultatif)</label><input id="c-note" maxlength="200" placeholder="ex. au RU les portions de riz font 250 g"></div>
    <button class="plein" data-act="corriger">Enregistrer la correction</button><p class="petit" id="c-msg" style="margin:0"></p></div></details>`;
}

// ============ VUE : SEMAINE ============
function vueSemaine() {
  if (!profil) return "";
  const jours = []; for (let i = 6; i >= 0; i--) { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - i); jours.push({ cle: jourCle(d), date: d }); }
  const S = N.bilanSemaine(jours.map((j) => ({ cle: j.cle, repas: repasDuJour(j.cle).map((r) => ({ nom: r.nom, aliments: r.aliments, verdict: r.verdict })) })), profil);
  const haut = Math.max(S.cible * 1.3, ...S.jours.map((j) => j.kcal)), ciblePct = S.cible / haut * 100;
  const humeur = !S.nbRepas ? "dort" : S.partHealthy >= 0.6 && S.exces.length < 2 ? "fier" : S.partHealthy < 0.35 ? "inquiet" : "content";
  const msg = !S.nbRepas ? "Rien cette semaine pour l'instant. Scanne tes repas et je te ferai ton bilan."
    : `${Math.round(S.partHealthy * 100)} % de tes repas sont healthy cette semaine.${S.exces[0] ? ` Ce que tu dépasses le plus : <b>${esc(S.exces[0].nom.toLowerCase())}</b> (${S.exces[0].jours} jour${S.exces[0].jours > 1 ? "s" : ""}).` : " Aucun excès, bravo !"}`;
  const anciens = jours.slice().reverse().filter((j) => repasDuJour(j.cle).length);
  return `<div class="pile apparait"><h2>Ma semaine</h2>${pepin(humeur, msg, 64)}
    <div class="carte"><h3>Calories des 7 derniers jours</h3>
      <p class="cible-leg">Pointillés : ton objectif de ${fmt(S.cible)} kcal</p>
      <div class="graph" role="img" aria-label="Calories par jour sur 7 jours, objectif ${fmt(S.cible)} kcal">
        ${S.jours.map((j, i) => { const hp = j.kcal ? Math.max(2, j.kcal / haut * 100) : 0; return `<div class="col ${i === 6 ? "aujourd" : ""}"><div class="zone"><span class="cible" style="bottom:${ciblePct}%"></span><div class="baton" style="height:${hp}%;background:${j.etat === "trop" ? "var(--tom)" : j.etat === "peu" ? "var(--yolk)" : "var(--leaf)"}"></div>${j.kcal ? `<span class="val num" style="bottom:calc(${hp}% + 4px)">${fmt(j.kcal)}</span>` : ""}</div><span class="jourlab">${i === 6 ? "auj." : jours[i].date.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "")}</span></div>`; }).join("")}
      </div></div>
    <div class="grille4">
      <div class="stat"><b class="num">${fmt(S.moyenneKcal)}</b><span class="petit">kcal par jour en moyenne</span></div>
      <div class="stat"><b class="num">${Math.round(S.partHealthy * 100)} %</b><span class="petit">repas healthy (${S.nbRepas})</span></div>
      <div class="stat"><b class="num">${S.joursObjectif}/7</b><span class="petit">jours dans l'objectif</span></div>
      <div class="stat"><b class="num">${S.serie}</b><span class="petit">jour${S.serie > 1 ? "s" : ""} de suite suivis</span></div>
    </div>
    ${S.exces.length ? `<div class="carte pile"><h3>Ce que tu dépasses souvent</h3>${S.exces.map((e) => `<div class="ligne entre"><b>${esc(e.nom)}</b><span class="chip c-rouge">${e.jours} jour${e.jours > 1 ? "s" : ""} sur 7</span></div>`).join("")}</div>` : ""}
    ${anciens.length ? `<div class="carte"><h3>Historique</h3>${anciens.map((j, i) => { const l = repasDuJour(j.cle); return `<details ${i === 0 ? "open" : ""} style="margin-top:10px"><summary style="cursor:pointer;font-weight:700">${j.cle === aujourdhui() ? "Aujourd'hui" : esc(majuscule(j.date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })))} · <span class="num">${fmt(l.reduce((s, r) => s + r.kcal, 0))} kcal</span></summary>${l.map(ligneRepas).join("")}</details>`; }).join("")}</div>` : ""}
  </div>`;
}

// ============ VUE : PROFIL ============
function vueProfil() {
  const p = profil || { age: "", sexe: "", taille: "", poids: "", activite: "leger", objectif: "maintenir", grossesse: false };
  const b = profil ? N.besoins(profil) : null;
  return `<form class="pile apparait" id="f-profil">
    ${profil ? "<h2>Mon profil</h2>" : pepin("content", "Salut, moi c'est <b>Pépin</b> ! Dis-moi qui tu es et je te dirai si ton assiette est healthy <b>pour toi</b>.", 80)}
    <div class="carte pile">
    <div class="grille2"><div><label for="p-age">Âge</label><input id="p-age" type="number" inputmode="numeric" min="12" max="100" required value="${esc(p.age)}"></div>
      <div><label for="p-sexe">Sexe</label><select id="p-sexe" required><option value="">Choisir</option><option value="f" ${p.sexe === "f" ? "selected" : ""}>Femme</option><option value="h" ${p.sexe === "h" ? "selected" : ""}>Homme</option></select></div>
      <div><label for="p-taille">Taille (cm)</label><input id="p-taille" type="number" inputmode="numeric" min="120" max="230" required value="${esc(p.taille)}"></div>
      <div><label for="p-poids">Poids (kg)</label><input id="p-poids" type="number" inputmode="decimal" step="0.1" min="30" max="250" required value="${esc(p.poids)}"></div></div>
    <div><label for="p-act">Activité</label><select id="p-act">${Object.keys(N.ACTIVITES).map((k) => `<option value="${k}" ${k === p.activite ? "selected" : ""}>${N.ACTIVITES[k][1]}</option>`).join("")}</select></div>
    <div><label for="p-obj">Objectif</label><select id="p-obj"><option value="maintenir" ${p.objectif === "maintenir" ? "selected" : ""}>Garder mon poids</option><option value="perdre" ${p.objectif === "perdre" ? "selected" : ""}>Perdre un peu de poids</option><option value="prendre" ${p.objectif === "prendre" ? "selected" : ""}>Prendre du muscle</option></select></div>
    <label class="ligne" style="font-weight:500"><input type="checkbox" id="p-gros" style="width:22px;height:22px" ${p.grossesse ? "checked" : ""}> Grossesse ou allaitement</label></div>
    ${profil ? "" : blocChoixSauv(true)}
    <button class="plein" type="submit">${profil ? "Enregistrer" : "C'est parti"}</button>
    ${b ? `<div class="carte pile"><h3>Tes repères</h3>
      <div class="grille2"><div class="stat"><span class="petit">Objectif du jour</span><b class="num">${fmt(b.cible)}</b><span class="petit">kcal</span></div><div class="stat"><span class="petit">IMC</span><b class="num">${fmt(b.imc, 1)}</b><span class="petit">${esc(b.imcCategorie)}</span></div></div>
      <p class="petit" style="margin:0">Métabolisme de base ${fmt(b.bmr)} kcal × activité = dépense ${fmt(b.depense)} kcal (formule Mifflin-St Jeor).</p>
      ${Object.keys(N.CRENEAUX).map((k) => `<div class="ligne entre"><span>${esc(majuscule(N.CRENEAUX[k].nom))} <span class="petit">(${Math.round(N.CRENEAUX[k].part * 100)} %)</span></span><b class="num">${fmt(Math.round(b.cible * N.CRENEAUX[k].part / 10) * 10)} kcal</b></div>`).join("")}
      ${b.notes.map((n) => `<p class="petit" style="margin:0">${esc(n)}</p>`).join("")}</div>` : ""}
  </form>
  ${profil ? blocGestionSauv() : `<div class="carte pile" style="margin-top:14px"><h3>Tu avais déjà l'appli ?</h3><p class="petit" style="margin:0">Entre ton code de sauvegarde pour tout récupérer (profil, journée, semaines).</p>${champRestaurer()}</div>`}`;
}
function champRestaurer() {
  return `<div><label for="cle-rest">Code de sauvegarde</label><input id="cle-rest" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="32 caractères (chiffres et lettres a à f)"></div><button class="sec plein" type="button" data-act="restaurer">Restaurer mes données</button><p class="petit" id="rest-msg" style="margin:0"></p>`;
}
function blocGestionSauv() {
  const h = sauvInfo.ts ? new Date(sauvInfo.ts).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "";
  if (sauvOui()) return `<div class="carte pile" style="margin-top:14px"><h3>Sauvegarde en ligne : activée</h3>
    <p class="petit" style="margin:0">${sauvInfo.erreur ? "Dernier essai échoué : " + esc(sauvInfo.erreur) + "." : h ? "Dernière sauvegarde automatique : " + esc(h) + "." : "Première sauvegarde en cours…"}</p>
    ${cleSauv ? `<div><label for="cle-aff">Ton code de sauvegarde (garde-le précieusement, ne le donne à personne)</label><input readonly id="cle-aff" value="${esc(cleSauv)}" style="font-family:ui-monospace,monospace;font-size:15px"></div><button class="sec plein" type="button" data-act="copierCle">Copier le code</button>` : ""}
    <button class="dang plein" type="button" data-act="consentir" data-val="non">Arrêter et supprimer ma sauvegarde en ligne</button>
    <details><summary class="petit" style="cursor:pointer">Récupérer une autre sauvegarde</summary><div class="pile" style="margin-top:10px">${champRestaurer()}</div></details></div>`;
  return `<div class="carte pile" style="margin-top:14px;border-color:var(--yolk)"><h3>Sauvegarde en ligne : désactivée</h3>
    <p class="petit" style="margin:0">Ta journée et tes semaines restent seulement sur ce téléphone, sans sauvegarde : si tu le changes ou supprimes l'appli, elles sont perdues.</p>
    <details><summary class="petit" style="cursor:pointer">Ce qui serait sauvegardé</summary><div style="margin-top:8px">${TEXTE_SAUV}</div></details>
    <button class="plein" type="button" data-act="consentir" data-val="oui">Activer la sauvegarde en ligne</button>
    <details><summary class="petit" style="cursor:pointer">Récupérer une sauvegarde avec un code</summary><div class="pile" style="margin-top:10px">${champRestaurer()}</div></details></div>`;
}

// ============ VUE : ENTRAÎNER ============
function vueEntrainer() {
  const c = UI.corrections;
  return `<div class="pile apparait"><h2>Entraîner l'IA</h2>
    ${pepin("content", `J'apprends grâce à vous ! Quand je me trompe, dites-le-moi sous le résultat. Je connais déjà ${N.REFERENCES.length} plats et ${Object.keys(N.ADDITIFS).length} additifs.`, 64)}
    <div class="carte pile"><p class="petit" style="margin:0">${c ? c.length + " correction(s) validée(s) que l'IA utilise à chaque scan." : "Chargement des corrections…"}</p>
      <label for="code">Code entraîneur</label><input id="code" type="password" autocomplete="off" value="${esc(code)}" placeholder="Seul l'entraîneur l'a">
      <button class="sec plein" data-act="code">${code ? "Mettre à jour le code" : "Activer le mode entraîneur"}</button>
      <p class="petit" style="margin:0">${UI.msgEnt ? esc(UI.msgEnt) : code ? (UI.admin ? "Mode entraîneur actif." : "Code non reconnu par le relais.") : "Sans code, tu utilises l'IA telle que l'entraîneur l'a réglée. Tu peux quand même signaler ses erreurs sous chaque résultat."}</p></div>
    ${UI.admin ? `<div class="carte pile"><h3>Propositions des utilisateurs (${UI.propositions.length})</h3>
      ${UI.propositions.length ? UI.propositions.map((x) => `<div class="pile" style="border-top:1px solid var(--line);padding-top:10px"><div class="petit">L'IA avait vu : ${esc(x.avant)}</div>
        <label for="pr-${esc(x.id)}">Ce que c'est vraiment</label><textarea id="pr-${esc(x.id)}" maxlength="300">${esc(x.apres)}</textarea>
        <div class="grille2"><button data-act="valider" data-id="${esc(x.id)}">Valider</button><button class="sec" data-act="refuser" data-id="${esc(x.id)}">Refuser</button></div></div>`).join("") : `<p class="petit" style="margin:0">Aucune proposition en attente.</p>`}</div>` : ""}
    ${c && c.length ? `<div class="carte"><h3>Corrections validées</h3>${c.map((x) => `<div class="aliment"><div><b>${esc(x.plat)}</b><div class="petit">${esc(x.apres)}${x.note ? " · règle : " + esc(x.note) : ""}</div></div>${UI.admin ? `<button class="dang mini" data-act="supprCorr" data-id="${esc(x.id)}">Retirer</button>` : ""}</div>`).join("")}</div>` : ""}
  </div>`;
}

// ============ RENDU ET NAVIGATION ============
const VUES = { jour: vueJour, semaine: vueSemaine, scan: vueScan, entrainer: vueEntrainer, profil: vueProfil };
function rendre() {
  Object.keys(VUES).forEach((k) => { const s = $("#v-" + k); s.hidden = k !== UI.vue; if (k === UI.vue) s.innerHTML = VUES[k](); });
  document.querySelectorAll("nav button").forEach((b) => b.setAttribute("aria-current", String(b.dataset.vue === UI.vue)));
  $("#date").textContent = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}
function aller(v) { UI.vue = profil ? v : "profil"; if (UI.vue === "entrainer") chargerCorrections(); rendre(); }

async function appelRelais(chemin, options = {}) {
  const rep = await fetch(RELAIS + chemin, { ...options, headers: { "Content-Type": "application/json", ...(code ? { Authorization: "Bearer " + code } : {}) } });
  const d = await rep.json().catch(() => ({})); if (!rep.ok) throw new Error(d.erreur || "Erreur " + rep.status); return d;
}
async function chargerCorrections() {
  if (!RELAIS) { UI.corrections = []; UI.msgEnt = "Relais non configuré."; return; }
  try { const d = await appelRelais("/corrections"); UI.corrections = d.corrections || []; UI.admin = !!d.admin; } catch (e) { UI.corrections = []; UI.msgEnt = e.message; }
  UI.propositions = [];
  if (UI.admin) { try { UI.propositions = (await appelRelais("/propositions")).propositions || []; } catch {} }
  if (UI.vue === "entrainer") rendre();
}

// ============ ACTIONS ============
function changerGrammes(i, delta) { const a = UI.analyse.scan.aliments[i]; a.grammes = Math.max(5, Math.min(2000, a.grammes + delta)); vibre(6); rendre(); }
async function traiterProposition(b, valider) {
  const id = b.dataset.id, apres = $("#pr-" + id)?.value || "";
  try { await appelRelais("/propositions/" + id + (valider ? "/valider" : ""), { method: valider ? "POST" : "DELETE", body: valider ? JSON.stringify({ apres }) : undefined }); toast(valider ? "Validée : l'IA l'utilise dès le prochain scan" : "Proposition refusée"); }
  catch (err) { UI.msgEnt = err.message; }
  await chargerCorrections();
}
const ACTIONS = {
  allerScan: () => { UI.etat = "pret"; UI.analyse = null; aller("scan"); },
  exemple: () => ouvrirAnalyse(N.normaliserScan(EXEMPLE), { exemple: true, source: "photo" }),
  modeTexte: () => { UI.modeTexte = !UI.modeTexte; rendre(); if (UI.modeTexte) $("#desc")?.focus(); },
  analyserTexte: () => { const d = ($("#desc").value || "").trim(); if (d.length < 3) { toast("Décris ce que tu as mangé"); return; } analyserTexte(d); },
  nouveau: () => { const ex = UI.analyse?.existant; UI.analyse = null; UI.etat = "pret"; if (ex) aller("jour"); else rendre(); window.scrollTo(0, 0); },
  ouvrir: (b) => ouvrirRepas(b.dataset.id),
  refaire: (b) => refaire(b.dataset.id),
  ajouter: () => { const m = enregistrerAnalyse(); vibre(20); UI.analyse = null; UI.etat = "pret"; aller("jour"); window.scrollTo(0, 0);
    toast("« " + m.nom + " » ajouté à ta journée", () => { repas = repas.filter((x) => x.id !== m.id); sauverRepas(); rendre(); }); },
  enregistrer: () => { enregistrerAnalyse(); UI.analyse = null; UI.etat = "pret"; aller("jour"); toast("Repas mis à jour"); },
  supprimerRepas: () => { const A = UI.analyse, i = repas.findIndex((x) => x.id === A.id); if (i < 0) return; const [m] = repas.splice(i, 1); sauverRepas(); UI.analyse = null; UI.etat = "pret"; aller("jour");
    toast("Repas supprimé", () => { repas.push(m); sauverRepas(); rendre(); }); },
  moins: (b) => changerGrammes(+b.dataset.i, -10),
  plus: (b) => changerGrammes(+b.dataset.i, 10),
  retirerAliment: (b) => { const l = UI.analyse.scan.aliments, i = +b.dataset.i, [a] = l.splice(i, 1); rendre(); toast(a.nom + " retiré", () => { l.splice(i, 0, a); rendre(); }); },
  consentir: async (b) => { if (!profil) return; profil.sauvegarde = b.dataset.val; profil.sauvegardeDate = new Date().toISOString(); ecrire("profil", profil);
    if (b.dataset.val === "oui") { await sauvegarderEnLigne(); toast("Sauvegarde en ligne activée"); } else { await supprimerEnLigne(); toast("Sauvegarde désactivée, copie en ligne supprimée"); } rendre(); },
  copierCle: async (b) => { try { await navigator.clipboard.writeText(cleSauv); b.textContent = "Code copié"; } catch { $("#cle-aff")?.select(); b.textContent = "Sélectionné : copie-le"; } },
  restaurer: async () => {
    const k = ($("#cle-rest").value || "").trim().toLowerCase(), m = $("#rest-msg");
    if (!/^[0-9a-f]{32}$/.test(k)) { m.textContent = "Ce code n'a pas le bon format (32 caractères)."; return; }
    m.textContent = "Récupération…";
    try {
      const rep = await fetch(RELAIS + "/sauvegarde/" + k); const d = await rep.json().catch(() => ({}));
      if (!rep.ok) throw new Error(d.erreur || "Erreur " + rep.status);
      const ids = new Set(repas.map((r) => r.id));
      repas = repas.concat((d.repas || []).filter((r) => r && r.id && !ids.has(r.id)));
      if (d.profil) profil = { ...d.profil, sauvegarde: "oui", sauvegardeDate: new Date().toISOString() };
      cleSauv = k; ecrire("cleSauv", k); ecrire("profil", profil); sauverRepas(); aller("jour"); window.scrollTo(0, 0); toast("Données restaurées");
    } catch (err) { m.textContent = err.message === "Failed to fetch" ? "Pas de connexion." : err.message; }
  },
  code: async () => { code = ($("#code").value || "").trim(); ecrire("code", code); UI.msgEnt = ""; await chargerCorrections(); rendre(); },
  rectifier: async () => {
    const A = UI.analyse, vrai = ($("#r-vrai").value || "").trim();
    if (vrai.length < 3) { $("#r-msg").textContent = "Écris ce qu'est vraiment le plat."; return; }
    const avant = A.scan.plat + " : " + resumeScan(A.scan), ancien = A;
    demarrerAttente(A.photo, "Pépin refait l'analyse avec ta correction…");
    try {
      const scan = A.image ? await envoyerScan({ image: A.image.split(",")[1], type: "image/jpeg", indice: A.indice, rectif: { vrai, avant } })
        : await envoyerScan({ description: A.description + ". Correction de l'utilisateur : " + vrai });
      if (!scan) throw new Error("L'IA n'a pas réussi à refaire l'analyse.");
      ouvrirAnalyse(scan, { photo: A.photo, image: A.image, indice: A.indice, description: A.description, source: A.source, rectifie: vrai });
      const corps = JSON.stringify({ plat: scan.plat, avant, apres: vrai });
      (code && UI.admin ? appelRelais("/corrections", { method: "POST", body: corps }) : appelRelais("/propositions", { method: "POST", body: corps })).catch(() => {});
    } catch (err) { clearInterval(minuteurEtapes); UI.analyse = ancien; UI.etat = "resultat"; UI.ouvrirTrompe = true; rendre(); const m = $("#r-msg"); if (m) m.textContent = err.message; }
    UI.ouvrirTrompe = false;
  },
  corriger: async (b) => {
    const A = UI.analyse, msg = $("#c-msg"), apres = $("#c-apres").value.trim();
    if (!apres) { msg.textContent = "Écris la bonne réponse."; return; }
    b.disabled = true; msg.textContent = "Envoi…";
    try { const d = await appelRelais("/corrections", { method: "POST", body: JSON.stringify({ plat: A.scan.plat, avant: resumeScan(A.scan), apres, note: $("#c-note").value }) }); msg.textContent = "Correction enregistrée (" + d.total + " au total)."; $("#c-apres").value = ""; }
    catch (err) { msg.textContent = err.message; } finally { b.disabled = false; }
  },
  valider: (b) => traiterProposition(b, true),
  refuser: (b) => traiterProposition(b, false),
  supprCorr: async (b) => { try { await appelRelais("/corrections/" + b.dataset.id, { method: "DELETE" }); await chargerCorrections(); } catch (err) { UI.msgEnt = err.message; rendre(); } },
};

document.addEventListener("click", (e) => {
  const nav = e.target.closest("nav button");
  if (nav) { if (nav.dataset.vue === "scan" && UI.vue === "scan" && UI.etat !== "analyse") { UI.analyse = null; UI.etat = "pret"; } aller(nav.dataset.vue); window.scrollTo(0, 0); return; }
  const b = e.target.closest("[data-act]"); if (b && ACTIONS[b.dataset.act]) ACTIONS[b.dataset.act](b);
});
document.addEventListener("change", (e) => {
  const t = e.target;
  if (t.id === "photo" || t.id === "galerie") { UI.indice = $("#indice")?.value || UI.indice; if (t.files[0]) scannerPhoto(t.files[0]); t.value = ""; }
  if (t.id === "creneau" && UI.analyse) { UI.analyse.creneau = t.value; rendre(); }
  if (t.dataset.g !== undefined && UI.analyse) { const a = UI.analyse.scan.aliments[+t.dataset.g]; a.grammes = Math.max(1, Math.min(2000, Math.round(+t.value || a.grammes))); rendre(); }
});
document.addEventListener("input", (e) => { if (e.target.id === "indice") UI.indice = e.target.value; });
document.addEventListener("submit", (e) => {
  if (e.target.id !== "f-profil") return; e.preventDefault();
  const premier = !profil;
  const choix = document.querySelector('input[name="sauv"]:checked')?.value || profil?.sauvegarde || "";
  profil = { sauvegarde: choix, sauvegardeDate: profil?.sauvegardeDate || new Date().toISOString(), age: +$("#p-age").value, sexe: $("#p-sexe").value, taille: +$("#p-taille").value, poids: +$("#p-poids").value, activite: $("#p-act").value, objectif: $("#p-obj").value, grossesse: $("#p-gros").checked };
  ecrire("profil", profil); programmerSauvegarde();
  if (premier) { aller("jour"); window.scrollTo(0, 0); } else { rendre(); toast("Profil enregistré"); }
});

if (code) chargerCorrections();
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
rendre();
}
