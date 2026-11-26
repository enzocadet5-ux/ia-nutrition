// IA Nutrition : interface de l'appli (les calculs sont dans engine.js)
{
"use strict";
const N = NutriIA;
const RELAIS = (window.IA_NUTRITION_RELAIS || "").replace(/\/$/, "");
const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (v, d = 0) => (Math.round((+v || 0) * 10 ** d) / 10 ** d).toLocaleString("fr-FR");
const jourCle = (t) => { const d = new Date(t); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };

// ---------- Stockage sur l'appareil ----------
function lire(cle, defaut) { try { const v = localStorage.getItem("ian_" + cle); return v ? JSON.parse(v) : defaut; } catch { return defaut; } }
function ecrire(cle, v) { try { localStorage.setItem("ian_" + cle, JSON.stringify(v)); return true; } catch { return false; } }
let profil = lire("profil", null);
let repas = lire("repas", []);
let code = lire("code", "");
let cleSauv = lire("cleSauv", "");          // code secret de sauvegarde de ce téléphone
let sauvInfo = lire("sauvInfo", { ts: 0, erreur: "" });
const sauvOui = () => profil && profil.sauvegarde === "oui";
function nouvelleCle() { const a = new Uint8Array(16); crypto.getRandomValues(a); return [...a].map((x) => x.toString(16).padStart(2, "0")).join(""); }
let minuteurSauv = null;
function programmerSauvegarde() {
  if (!sauvOui() || !RELAIS) return;
  clearTimeout(minuteurSauv);
  minuteurSauv = setTimeout(sauvegarderEnLigne, 1500);
}
async function sauvegarderEnLigne() {
  if (!sauvOui() || !RELAIS) return;
  if (!cleSauv) { cleSauv = nouvelleCle(); ecrire("cleSauv", cleSauv); }
  const corps = { consentement: true, profil, repas: repas.map(({ photo, ...r }) => r) };
  try {
    const rep = await fetch(RELAIS + "/sauvegarde/" + cleSauv, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corps) });
    if (!rep.ok) throw new Error((await rep.json().catch(() => ({}))).erreur || "Erreur " + rep.status);
    sauvInfo = { ts: Date.now(), erreur: "" };
  } catch (e) { sauvInfo = { ts: sauvInfo.ts, erreur: e.message === "Failed to fetch" ? "pas de réseau, nouvel essai au prochain changement" : e.message }; }
  ecrire("sauvInfo", sauvInfo); if (UI.vue === "profil") rendre();
}
async function supprimerEnLigne() {
  if (!cleSauv || !RELAIS) return;
  try { await fetch(RELAIS + "/sauvegarde/" + cleSauv, { method: "DELETE" }); } catch {}
  cleSauv = ""; ecrire("cleSauv", ""); sauvInfo = { ts: 0, erreur: "" }; ecrire("sauvInfo", sauvInfo);
}
const UI = { vue: profil ? "scan" : "profil", etat: "pret", analyse: null, erreur: "", corrections: null, propositions: [], admin: false, msgEnt: "" };

function sauverRepas() {
  repas = repas.filter((r) => Date.now() - r.ts < 30 * 864e5); // 30 jours
  repas.forEach((r, i) => { if (i < repas.length - 40) r.photo = null; }); // vignettes des 40 derniers seulement
  if (!ecrire("repas", repas)) { repas.forEach((r) => (r.photo = null)); ecrire("repas", repas); }
  programmerSauvegarde();
}

// ---------- Exemple (sans photo, pour essayer) ----------
const EXEMPLE = { estUnPlat: true, plat: "Rougail saucisse, riz, grains", confiance: 80, conseil: "Remplace la moitié des saucisses par des grains en plus : autant de protéines, beaucoup moins de sel et de nitrites.",
  ingredientsCaches: ["huile de cuisson", "saindoux possible"],
  aliments: [
    { nom: "Rougail saucisse", grammes: 160, groupe: "viande", nova: 4, additifs: ["E250", "E621"], kcal100: 300, proteines100: 13, glucides100: 2, lipides100: 27, fibres100: 0, sucres100: 1, sucresAjoutes100: 0, ags100: 10, sel100: 2 },
    { nom: "Riz blanc cuit", grammes: 200, groupe: "feculent", nova: 1, additifs: [], kcal100: 130, proteines100: 2.7, glucides100: 28, lipides100: 0.3, fibres100: 0.4, sucres100: 0.1, sucresAjoutes100: 0, ags100: 0.1, sel100: 0 },
    { nom: "Grains (haricots rouges)", grammes: 120, groupe: "legumineuse", nova: 3, additifs: [], kcal100: 110, proteines100: 7.5, glucides100: 14, lipides100: 2, fibres100: 7, sucres100: 1, sucresAjoutes100: 0, ags100: 0.3, sel100: 0.6 } ] };

// ---------- Photo ----------
function chargerImage(fichier) {
  return new Promise((ok, ko) => { const url = URL.createObjectURL(fichier); const img = new Image(); img.onload = () => { URL.revokeObjectURL(url); ok(img); }; img.onerror = () => ko(new Error("image")); img.src = url; });
}
function redimensionner(img, max, q) {
  const r = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth * r); c.height = Math.round(img.naturalHeight * r);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); return c.toDataURL("image/jpeg", q);
}

async function scanner(fichier) {
  if (!profil) { aller("profil"); return; }
  let img; try { img = await chargerImage(fichier); } catch { UI.etat = "erreur"; UI.erreur = "Ce fichier n'est pas une image lisible."; rendre(); return; }
  const grande = redimensionner(img, 1280, 0.82), vignette = redimensionner(img, 240, 0.7);
  UI.etat = "analyse"; UI.vignette = vignette; UI.msgAttente = "L'IA analyse ton plat…"; rendre();
  const indice = (UI.indice || "").slice(0, 200);
  try {
    const scan = await envoyerScan(grande, indice, null);
    if (!scan) { UI.etat = "erreur"; UI.erreur = "Je ne vois pas de nourriture sur cette photo. Essaie une photo nette, vue de dessus."; rendre(); return; }
    ouvrirAnalyse(scan, vignette, { image: grande, indice });
  } catch (e) { UI.etat = "erreur"; UI.erreur = e.message; rendre(); }
}
async function envoyerScan(image, indice, rectif) {
  if (!RELAIS) throw new Error("Le relais n'est pas encore configuré (fichier config.js).");
  let rep;
  try { rep = await fetch(RELAIS + "/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: image.split(",")[1], type: "image/jpeg", indice, rectif }) }); }
  catch { throw new Error("Pas de connexion au relais. Vérifie ton réseau."); }
  const d = await rep.json().catch(() => ({}));
  if (!rep.ok) throw new Error(d.erreur || "Erreur " + rep.status);
  return N.normaliserScan(d.resultat);
}
const resumeScan = (scan) => scan.aliments.map((a) => a.nom + " " + a.grammes + " g (NOVA " + a.nova + (a.additifs.length ? ", " + a.additifs.join(" ") : "") + ")").join(" ; ");

function ouvrirAnalyse(scan, photo, source, exemple, rectifie) {
  UI.analyse = { id: String(Date.now()), ts: Date.now(), scan, photo, creneau: N.creneauSelonHeure(new Date()), image: source?.image || null, indice: source?.indice || "", exemple: !!exemple, rectifie: rectifie || "" };
  UI.etat = "resultat"; UI.indice = ""; aller("scan"); window.scrollTo(0, 0);
}

// ---------- Consentement à la sauvegarde ----------
const TEXTE_SAUV = `<p style="margin:0">IA Nutrition peut <b>sauvegarder en ligne</b> ton profil (âge, sexe, taille, poids, activité, objectif) et tes repas (aliments, calories, verdicts). La copie est stockée sur le serveur de l'appli (Cloudflare), protégée par un code secret propre à ton téléphone. Les photos ne sont pas sauvegardées.</p>
  <p class="petit" style="margin:0"><b>Si tu acceptes</b> : ta journée et tes semaines sont gardées et tu peux les récupérer sur un autre téléphone avec ton code.<br><b>Si tu refuses</b> : rien n'est envoyé, mais ta journée et tes semaines ne sont pas sauvegardées. Si tu changes de téléphone, supprimes l'appli ou effaces les données du navigateur, tout est perdu, et ton expérience dans l'appli sera limitée.<br>Tu peux changer d'avis à tout moment dans Profil ; si tu arrêtes, ta copie en ligne est supprimée.</p>`;
function blocChoixSauv(dansFormulaire) {
  return `<div class="carte pile" style="border-color:var(--leaf)"><h3 style="font-size:19px">Sauvegarde de tes données</h3>${TEXTE_SAUV}
    ${dansFormulaire
      ? `<label class="ligne" style="font-weight:600"><input type="radio" name="sauv" value="oui" required style="width:22px;height:22px"> Oui, sauvegarder mes données en ligne</label><label class="ligne" style="font-weight:600"><input type="radio" name="sauv" value="non" style="width:22px;height:22px"> Non, garder seulement sur ce téléphone (sans sauvegarde)</label>`
      : `<div class="grille2"><button data-act="consentir" data-val="oui">Oui, sauvegarder</button><button class="sec" data-act="consentir" data-val="non">Non merci</button></div>`}</div>`;
}

// ---------- Vues ----------
function vueScan() {
  if (UI.etat === "analyse") return `<div class="attente">${UI.vignette ? `<img src="${UI.vignette}" alt="Ta photo">` : ""}<div class="roue" role="status" aria-label="Analyse en cours"></div><b>${esc(UI.msgAttente || "L'IA analyse ton plat…")}</b><span class="petit">Aliments, quantités, additifs, transformation</span></div>`;
  if (UI.etat === "resultat" && UI.analyse) return vueResultat();
  return `<div class="pile">
    ${profil && !profil.sauvegarde ? blocChoixSauv(false) : ""}
    ${UI.etat === "erreur" ? `<div class="alerte"><b>Analyse impossible.</b> ${esc(UI.erreur)}</div>` : ""}
    <label class="scan-zone" for="photo">
      <span class="rond"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg></span>
      <h2 style="font-size:24px;color:var(--ink)">Scanner mon plat</h2>
      <span class="petit">Photo bien éclairée, vue de dessus, toute l'assiette dans le cadre.</span>
      <input id="photo" type="file" accept="image/*" capture="environment" hidden>
    </label>
    <label class="bouton sec plein" for="galerie">Choisir une photo de la galerie<input id="galerie" type="file" accept="image/*" hidden></label>
    <div><label for="indice">Précision (facultatif)</label><input id="indice" placeholder="ex. cari poulet du RU, sauce à part" maxlength="200" value="${esc(UI.indice || "")}"></div>
    <button class="sec plein" data-act="exemple">Voir un exemple sans photo</button>
    <p class="petit">Les valeurs sont des estimations à partir d'une photo, pas un avis médical. La photo est envoyée à l'IA Claude pour l'analyse ; rien n'est gardé sur un serveur, ton historique reste sur ton téléphone.</p>
  </div>`;
}

function vueResultat() {
  const A = UI.analyse, r = N.analyserRepas(A.scan.aliments, profil, A.creneau), h = r.healthy, p = r.portion, t = r.totaux;
  const cls = h.verdict === "PAS HEALTHY" ? "v-PAS" : "v-" + h.verdict;
  const couleur = h.verdict === "HEALTHY" ? "var(--leaf)" : h.verdict === "MOYEN" ? "var(--yolk)" : "var(--tom)";
  const max = Math.max(p.ideal * 1.6, t.kcal);
  const coulP = { leger: "var(--yolk)", adapte: "var(--leaf)", copieux: "var(--yolk)", trop: "var(--tom)" }[p.niveau];
  const jour = N.bilanJour(repasDuJour().concat([{ nom: A.scan.plat, aliments: A.scan.aliments }]), profil);
  const anneau = (s) => { const C = 2 * Math.PI * 30; return `<svg width="76" height="76" viewBox="0 0 76 76" aria-hidden="true"><circle cx="38" cy="38" r="30" fill="none" stroke="currentColor" stroke-opacity=".18" stroke-width="8"/><circle cx="38" cy="38" r="30" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-dasharray="${C * s / 100} ${C}" transform="rotate(-90 38 38)"/><text x="38" y="44" text-anchor="middle" font-family="Archivo" font-weight="800" font-size="20" fill="currentColor">${s}</text></svg>`; };
  return `<div class="pile">
    ${A.exemple ? `<div class="note"><b>Exemple</b> : ce plat est fictif, pour te montrer le résultat.</div>` : ""}
    ${A.photo ? `<img class="photo" src="${A.photo}" alt="Photo du plat">` : ""}
    <h2 style="font-size:28px">${esc(A.scan.plat)}</h2>
    <div class="verdict ${cls}">${anneau(h.score)}<div><b class="mot">${h.verdict}</b><span class="txt petit">Score santé ${h.score}/100 · confiance de l'IA ${A.scan.confiance} %</span></div></div>
    <div class="carte pile">
      <div class="ligne entre"><div><div class="kcal">${fmt(t.kcal)}<span style="font-size:20px"> kcal</span></div><span class="petit">pour ${fmt(t.grammes)} g · P ${fmt(t.proteines)} g · G ${fmt(t.glucides)} g · L ${fmt(t.lipides)} g</span></div>
      <div><label for="creneau" class="petit" style="font-weight:600">Repas</label><select id="creneau" style="width:auto">${Object.keys(N.CRENEAUX).map((k) => `<option value="${k}" ${k === A.creneau ? "selected" : ""}>${N.CRENEAUX[k].nom}</option>`).join("")}</select></div></div>
      <div><div class="barre" role="img" aria-label="${fmt(t.kcal)} kcal sur une part idéale de ${fmt(p.ideal)} kcal"><i style="width:${Math.min(100, t.kcal / max * 100)}%;background:${coulP}"></i><span class="rep" style="left:${p.ideal / max * 100}%"></span></div>
      <div class="ligne entre petit" style="margin-top:6px"><span>Ta part pour un ${esc(p.nomCreneau)} : <b>${fmt(p.ideal)} kcal</b></span><span>${fmt(profil.poids, 1)} kg · ${esc(N.ACTIVITES[profil.activite][1].split(" (")[0].toLowerCase())}</span></div></div>
      <p style="margin:0;font-weight:600;color:${coulP}">${esc(p.texte)}</p>
    </div>
    <div class="carte pile"><h3 style="font-size:19px">Pourquoi ${h.verdict === "HEALTHY" ? "c'est healthy" : "ce verdict"}</h3>
      ${h.moins.length ? `<ul class="raisons">${h.moins.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
      ${h.plus.length ? `<ul class="raisons" style="color:var(--leaf)">${h.plus.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
      ${A.scan.conseil ? `<p style="margin:0"><b>Conseil :</b> ${esc(A.scan.conseil)}</p>` : ""}
      ${A.scan.caches.length ? `<p class="petit" style="margin:0">Ingrédients possibles non visibles : ${A.scan.caches.map(esc).join(", ")}</p>` : ""}
    </div>
    ${h.additifs.length ? `<div class="carte pile"><h3 style="font-size:19px">Additifs probables</h3>${h.additifs.map((a) => `<div><span class="chip c-${a.niveau}">${esc(a.code)} · ${a.niveau === "rouge" ? "à éviter" : a.niveau === "orange" ? "à limiter" : "sans souci"}</span> <b>${esc(a.nom)}</b><div class="petit">${esc(a.pourquoi)}</div></div>`).join("")}<p class="petit" style="margin:0">Déduits du type de produit : vérifie l'étiquette si tu l'as.</p></div>` : `<div class="carte"><span class="chip c-vert">Sans additif identifié</span></div>`}
    <div class="carte"><h3 style="font-size:19px;margin-bottom:6px">Ce que l'IA a vu</h3><div class="defile"><table class="tab"><thead><tr><th>Aliment</th><th class="r">Grammes</th><th class="r">kcal</th><th class="r">NOVA</th></tr></thead><tbody>
      ${A.scan.aliments.map((a, i) => `<tr><td>${esc(a.nom)}${a.certain ? "" : ' <span class="chip c-orange">incertain</span>'}</td><td class="r"><input type="number" inputmode="numeric" min="1" max="2000" value="${a.grammes}" data-g="${i}" aria-label="Grammes de ${esc(a.nom)}"></td><td class="r">${fmt(a.per100.kcal * a.grammes / 100)}</td><td class="r">${a.nova}</td></tr>`).join("")}
    </tbody></table></div><p class="petit" style="margin:6px 0 0">Corrige les grammes si besoin : tout se recalcule. NOVA 4 = ultra-transformé.</p></div>
    <div class="carte pile"><h3 style="font-size:19px">Avec ce repas, aujourd'hui</h3><p style="margin:0;font-weight:600">${esc(jour.resume)}</p>${barresJour(jour, true)}</div>
    ${A.exemple ? "" : `<button class="plein" data-act="ajouter">Ajouter à ma journée</button>`}
    ${blocTrompe(A)}
    ${code ? blocCorriger(A) : ""}
    <button class="sec plein" data-act="nouveau">Scanner un autre plat</button>
  </div>`;
}

function blocTrompe(A) {
  if (A.rectifie) return `<div class="carte"><b>Analyse corrigée</b> d'après ta réponse : « ${esc(A.rectifie)} ».<div class="petit">${code ? "Ta correction est enregistrée pour entraîner l'IA." : "Merci ! Ta correction a été envoyée à l'entraîneur pour améliorer l'IA."}</div></div>`;
  if (!A.image) return A.exemple ? "" : "";
  return `<details class="carte" ${UI.ouvrirTrompe ? "open" : ""}><summary style="font-weight:700;cursor:pointer">L'IA s'est trompée ?</summary><div class="pile" style="margin-top:12px">
    <div><label for="r-vrai">Qu'est-ce que c'est vraiment ?</label><textarea id="r-vrai" maxlength="300" placeholder="ex. cari de thon maison avec du riz complet, pas du poulet"></textarea></div>
    <p class="petit" style="margin:0">L'IA va réanalyser ta photo avec ta réponse (c'est un nouveau scan).</p>
    <button class="plein" data-act="rectifier">Corriger et réanalyser</button><p class="petit" id="r-msg" style="margin:0"></p></div></details>`;
}

function blocCorriger(A) {
  const avant = resumeScan(A.scan);
  return `<details class="carte"><summary style="font-weight:700;cursor:pointer">Entraîner l'IA sur ce plat</summary><div class="pile" style="margin-top:12px">
    <p class="petit" style="margin:0">L'IA avait vu : ${esc(avant)}</p>
    <div><label for="c-apres">La bonne réponse</label><textarea id="c-apres" maxlength="300" placeholder="ex. c'est du cari poulet du RU, portion de riz 250 g, fait maison donc NOVA 3 sans additif"></textarea></div>
    <div><label for="c-note">Règle à retenir (facultatif)</label><input id="c-note" maxlength="200" placeholder="ex. au RU les portions de riz font 250 g"></div>
    <button class="plein" data-act="corriger">Enregistrer la correction</button><p class="petit" id="c-msg" style="margin:0"></p></div></details>`;
}

function repasDuJour(cle) { const k = cle || jourCle(Date.now()); return repas.filter((r) => jourCle(r.ts) === k); }

function barresJour(jour, court) {
  return jour.lignes.filter((l) => !court || l.etat !== "ok" || l.cle === "kcal").map((l) => {
    const c = l.etat === "trop" ? "var(--tom)" : l.etat === "proche" ? "var(--yolk)" : "var(--leaf)";
    const val = l.cle === "ultra" ? l.valeur + " %" : fmt(l.valeur, l.unite === "g" && l.valeur < 10 ? 1 : 0) + " " + l.unite;
    const rep = l.cle === "ultra" ? "< 30 %" : (l.cle === "sel" ? "< " : "") + fmt(l.repere) + " " + l.unite;
    return `<div class="jour-l"><span><b style="font-size:14.5px">${l.nom}</b>${l.etat === "trop" && l.source ? `<br><span class="petit">surtout : ${esc(l.source)}</span>` : ""}</span><div class="barre"><i style="width:${Math.min(100, l.ratio * 80)}%;background:${c}"></i><span class="rep" style="left:80%"></span></div><span class="petit" style="white-space:nowrap;text-align:right"><b style="color:${c}">${val}</b><br>${rep}</span></div>`;
  }).join("");
}

function vueJour() {
  if (!profil) return `<div class="carte">Remplis d'abord ton profil pour calculer tes repères.</div>`;
  const liste = repasDuJour(), jour = N.bilanJour(liste.map((r) => ({ nom: r.nom, aliments: r.aliments })), profil);
  return `<div class="pile">
    <h2 style="font-size:28px">Ma journée</h2>
    <div class="carte pile" style="${jour.trop.length ? "border-color:var(--tom)" : ""}"><p style="margin:0;font-size:18px;font-weight:700;color:${jour.trop.length ? "var(--tom)" : "var(--leaf)"}">${esc(jour.resume)}</p>
      ${liste.length ? barresJour(jour) : ""}${jour.manque.map((m) => `<p class="petit" style="margin:0">Un peu juste en ${esc(m)}</p>`).join("")}
      <p class="petit" style="margin:0">Le trait marque ton repère du jour (${fmt(jour.besoins.cible)} kcal pour ${fmt(profil.poids, 1)} kg). Repères OMS et ANSES.</p></div>
    <div class="carte"><h3 style="font-size:19px">Repas d'aujourd'hui</h3>
      ${liste.length ? liste.map((r) => `<div class="repas">${r.photo ? `<img src="${r.photo}" alt="">` : `<span class="ph">🍽</span>`}<div><b>${esc(r.nom)}</b><div class="petit">${esc(N.CRENEAUX[r.creneau]?.nom || "")} · ${fmt(r.kcal)} kcal · <span class="chip ${r.verdict === "HEALTHY" ? "c-vert" : r.verdict === "MOYEN" ? "c-orange" : "c-rouge"}">${esc(r.verdict)}</span></div></div><button class="dang" data-act="suppr" data-id="${esc(r.id)}" aria-label="Supprimer ${esc(r.nom)}">Retirer</button></div>`).join("")
        : `<p class="petit">Aucun repas aujourd'hui. Scanne ton prochain plat pour voir ton bilan.</p><button class="plein" data-act="allerScan">Scanner un plat</button>`}
    </div></div>`;
}

function vueProfil() {
  const p = profil || { age: "", sexe: "", taille: "", poids: "", activite: "leger", objectif: "maintenir", grossesse: false };
  const b = profil ? N.besoins(profil) : null;
  return `<form class="pile" id="f-profil">
    <h2 style="font-size:28px">${profil ? "Mon profil" : "Bienvenue"}</h2>
    ${profil ? "" : `<p style="margin:0">Pour savoir si un plat est trop copieux <b>pour toi</b>, l'IA a besoin de ton gabarit. Tout reste sur ton téléphone.</p>`}
    <div class="grille2"><div><label for="p-age">Âge</label><input id="p-age" type="number" inputmode="numeric" min="12" max="100" required value="${esc(p.age)}"></div>
      <div><label for="p-sexe">Sexe</label><select id="p-sexe" required><option value="">Choisir</option><option value="f" ${p.sexe === "f" ? "selected" : ""}>Femme</option><option value="h" ${p.sexe === "h" ? "selected" : ""}>Homme</option></select></div>
      <div><label for="p-taille">Taille (cm)</label><input id="p-taille" type="number" inputmode="numeric" min="120" max="230" required value="${esc(p.taille)}"></div>
      <div><label for="p-poids">Poids (kg)</label><input id="p-poids" type="number" inputmode="decimal" step="0.1" min="30" max="250" required value="${esc(p.poids)}"></div></div>
    <div><label for="p-act">Activité</label><select id="p-act">${Object.keys(N.ACTIVITES).map((k) => `<option value="${k}" ${k === p.activite ? "selected" : ""}>${N.ACTIVITES[k][1]}</option>`).join("")}</select></div>
    <div><label for="p-obj">Objectif</label><select id="p-obj"><option value="maintenir" ${p.objectif === "maintenir" ? "selected" : ""}>Garder mon poids</option><option value="perdre" ${p.objectif === "perdre" ? "selected" : ""}>Perdre un peu de poids</option><option value="prendre" ${p.objectif === "prendre" ? "selected" : ""}>Prendre du muscle</option></select></div>
    <label class="ligne" style="font-weight:500"><input type="checkbox" id="p-gros" style="width:22px;height:22px" ${p.grossesse ? "checked" : ""}> Grossesse ou allaitement</label>
    ${profil ? "" : blocChoixSauv(true)}
    <button class="plein" type="submit">${profil ? "Enregistrer" : "Commencer"}</button>
    ${b ? `<div class="carte pile"><h3 style="font-size:19px">Tes repères</h3>
      <div class="grille2"><div><span class="petit">Objectif du jour</span><div class="kcal" style="font-size:32px">${fmt(b.cible)}</div><span class="petit">kcal</span></div><div><span class="petit">IMC</span><div class="kcal" style="font-size:32px">${fmt(b.imc, 1)}</div><span class="petit">${esc(b.imcCategorie)}</span></div></div>
      <p class="petit" style="margin:0">Métabolisme de base ${fmt(b.bmr)} kcal × activité = dépense ${fmt(b.depense)} kcal (formule Mifflin-St Jeor).</p>
      <table class="tab"><tbody>${Object.keys(N.CRENEAUX).map((k) => `<tr><td>${N.CRENEAUX[k].nom}</td><td class="r">${Math.round(N.CRENEAUX[k].part * 100)} %</td><td class="r"><b>${fmt(Math.round(b.cible * N.CRENEAUX[k].part / 10) * 10)} kcal</b></td></tr>`).join("")}</tbody></table>
      ${b.notes.map((n) => `<p class="petit" style="margin:0">${esc(n)}</p>`).join("")}</div>` : ""}
  </form>
  ${profil ? blocGestionSauv() : `<div class="carte pile" style="margin-top:14px"><h3 style="font-size:19px">Tu avais déjà l'appli ?</h3><p class="petit" style="margin:0">Entre ton code de sauvegarde pour tout récupérer (profil, journée, semaines).</p>${champRestaurer()}</div>`}`;
}
function champRestaurer() {
  return `<div><label for="cle-rest">Code de sauvegarde</label><input id="cle-rest" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="32 caractères (chiffres et lettres a à f)"></div><button class="sec plein" type="button" data-act="restaurer">Restaurer mes données</button><p class="petit" id="rest-msg" style="margin:0"></p>`;
}
function blocGestionSauv() {
  const h = sauvInfo.ts ? new Date(sauvInfo.ts).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "";
  if (sauvOui()) return `<div class="carte pile" style="margin-top:14px"><h3 style="font-size:19px">Sauvegarde en ligne : activée</h3>
    <p class="petit" style="margin:0">${sauvInfo.erreur ? "Dernier essai échoué : " + esc(sauvInfo.erreur) + "." : h ? "Dernière sauvegarde automatique : " + esc(h) + "." : "Première sauvegarde en cours…"}</p>
    ${cleSauv ? `<div><label>Ton code de sauvegarde (garde-le précieusement, ne le donne à personne)</label><input readonly id="cle-aff" value="${esc(cleSauv)}" style="font-family:ui-monospace,monospace;font-size:15px"></div><button class="sec plein" type="button" data-act="copierCle">Copier le code</button>` : ""}
    <button class="dang plein" type="button" data-act="consentir" data-val="non">Arrêter et supprimer ma sauvegarde en ligne</button>
    <details><summary class="petit" style="cursor:pointer">Récupérer une autre sauvegarde</summary><div class="pile" style="margin-top:10px">${champRestaurer()}</div></details></div>`;
  return `<div class="carte pile" style="margin-top:14px;border-color:var(--yolk)"><h3 style="font-size:19px">Sauvegarde en ligne : désactivée</h3>
    <p class="petit" style="margin:0">Ta journée et tes semaines restent seulement sur ce téléphone, sans sauvegarde : si tu le changes ou supprimes l'appli, elles sont perdues.</p>
    <details><summary class="petit" style="cursor:pointer">Ce qui serait sauvegardé</summary><div style="margin-top:8px">${TEXTE_SAUV}</div></details>
    <button class="plein" type="button" data-act="consentir" data-val="oui">Activer la sauvegarde en ligne</button>
    <details><summary class="petit" style="cursor:pointer">Récupérer une sauvegarde avec un code</summary><div class="pile" style="margin-top:10px">${champRestaurer()}</div></details></div>`;
}

function vueEntrainer() {
  const c = UI.corrections;
  return `<div class="pile">
    <h2 style="font-size:28px">Entraîner l'IA</h2>
    <div class="carte pile"><p style="margin:0">Quand l'IA se trompe sur un plat, l'entraîneur écrit la bonne réponse. Chaque correction est renvoyée à l'IA aux scans suivants, pour tous les utilisateurs. Elle s'appuie aussi sur ${N.REFERENCES.length} plats de référence et ${Object.keys(N.ADDITIFS).length} additifs connus.</p>
      <p class="petit" style="margin:0">${c ? c.length + " correction(s) enregistrée(s)." : "Chargement des corrections…"}</p></div>
    <div class="carte pile"><label for="code">Code entraîneur</label><input id="code" type="password" autocomplete="off" value="${esc(code)}" placeholder="Seul l'entraîneur l'a">
      <button class="sec plein" data-act="code">${code ? "Mettre à jour le code" : "Activer le mode entraîneur"}</button>
      <p class="petit" style="margin:0">${UI.msgEnt ? esc(UI.msgEnt) : code ? (UI.admin ? "Mode entraîneur actif : un bloc « Entraîner l'IA » apparaît sous chaque résultat." : "Code non reconnu par le relais.") : "Sans code, tu utilises l'IA telle que l'entraîneur l'a réglée."}</p></div>
    ${UI.admin ? `<div class="carte pile"><h3 style="font-size:19px">Propositions des utilisateurs (${UI.propositions.length})</h3>
      ${UI.propositions.length ? UI.propositions.map((x) => `<div class="pile" style="border-top:1px solid var(--line);padding-top:10px"><div class="petit">L'IA avait vu : ${esc(x.avant)}</div>
        <label for="pr-${esc(x.id)}">Ce que c'est vraiment</label><textarea id="pr-${esc(x.id)}" maxlength="300">${esc(x.apres)}</textarea>
        <div class="grille2"><button data-act="valider" data-id="${esc(x.id)}">Valider</button><button class="sec" data-act="refuser" data-id="${esc(x.id)}">Refuser</button></div></div>`).join("") : `<p class="petit" style="margin:0">Aucune proposition en attente. Quand quelqu'un signale une erreur, elle apparaît ici : tu peux l'ajuster puis la valider.</p>`}</div>` : ""}
    ${c && c.length ? `<div class="carte"><h3 style="font-size:19px">Corrections</h3>${c.map((x) => `<div class="repas" style="grid-template-columns:minmax(0,1fr) auto"><div><b>${esc(x.plat)}</b><div class="petit">${esc(x.apres)}${x.note ? " · règle : " + esc(x.note) : ""}</div></div>${UI.admin ? `<button class="dang" data-act="supprCorr" data-id="${esc(x.id)}">Retirer</button>` : ""}</div>`).join("")}</div>` : ""}
  </div>`;
}

// ---------- Rendu et navigation ----------
function rendre() {
  const vues = { scan: vueScan, jour: vueJour, profil: vueProfil, entrainer: vueEntrainer };
  Object.keys(vues).forEach((k) => { const s = $("#v-" + k); s.hidden = k !== UI.vue; if (k === UI.vue) s.innerHTML = vues[k](); });
  document.querySelectorAll("nav button").forEach((b) => b.setAttribute("aria-current", String(b.dataset.vue === UI.vue)));
}
function aller(v) { UI.vue = profil ? v : "profil"; if (UI.vue === "entrainer") chargerCorrections(); rendre(); }

async function appelRelais(chemin, options) {
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

document.addEventListener("click", async (e) => {
  const nav = e.target.closest("nav button"); if (nav) { if (nav.dataset.vue === "scan" && UI.etat !== "analyse") UI.etat = UI.analyse ? UI.etat : "pret"; aller(nav.dataset.vue); return; }
  const b = e.target.closest("[data-act]"); if (!b) return; const act = b.dataset.act;
  if (act === "exemple") ouvrirAnalyse(N.normaliserScan(EXEMPLE), null, null, true);
  if (act === "nouveau") { UI.analyse = null; UI.etat = "pret"; rendre(); window.scrollTo(0, 0); }
  if (act === "allerScan") aller("scan");
  if (act === "ajouter") {
    const A = UI.analyse, r = N.analyserRepas(A.scan.aliments, profil, A.creneau);
    repas.push({ id: A.id, ts: A.ts, nom: A.scan.plat, creneau: A.creneau, aliments: A.scan.aliments, kcal: Math.round(r.totaux.kcal), verdict: r.healthy.verdict, photo: A.photo });
    sauverRepas(); UI.analyse = null; UI.etat = "pret"; aller("jour"); window.scrollTo(0, 0);
  }
  if (act === "rectifier") {
    const A = UI.analyse, vrai = ($("#r-vrai").value || "").trim();
    if (vrai.length < 3) { $("#r-msg").textContent = "Écris ce qu'est vraiment le plat."; return; }
    const avant = A.scan.plat + " : " + resumeScan(A.scan), ancien = A;
    UI.etat = "analyse"; UI.vignette = A.photo; UI.msgAttente = "L'IA refait l'analyse avec ta correction…"; rendre(); window.scrollTo(0, 0);
    try {
      const scan = await envoyerScan(A.image, A.indice, { vrai, avant });
      if (!scan) throw new Error("L'IA n'a pas réussi à refaire l'analyse.");
      ouvrirAnalyse(scan, A.photo, { image: A.image, indice: A.indice }, false, vrai);
      const corps = JSON.stringify({ plat: scan.plat, avant, apres: vrai });
      (code && UI.admin ? appelRelais("/corrections", { method: "POST", body: corps }) : appelRelais("/propositions", { method: "POST", body: corps })).catch(() => {});
    } catch (err) { UI.analyse = ancien; UI.etat = "resultat"; UI.ouvrirTrompe = true; rendre(); const m = $("#r-msg"); if (m) m.textContent = err.message; }
    UI.ouvrirTrompe = false; return;
  }
  if (act === "valider" || act === "refuser") {
    const id = b.dataset.id, apres = $("#pr-" + id)?.value || "";
    try { await appelRelais("/propositions/" + id + (act === "valider" ? "/valider" : ""), { method: act === "valider" ? "POST" : "DELETE", body: act === "valider" ? JSON.stringify({ apres }) : undefined }); UI.msgEnt = act === "valider" ? "Proposition validée : l'IA l'utilisera dès le prochain scan." : "Proposition refusée."; }
    catch (err) { UI.msgEnt = err.message; }
    await chargerCorrections(); return;
  }
  if (act === "consentir") {
    if (!profil) return;
    profil.sauvegarde = b.dataset.val; profil.sauvegardeDate = new Date().toISOString(); ecrire("profil", profil);
    if (b.dataset.val === "oui") await sauvegarderEnLigne(); else await supprimerEnLigne();
    rendre(); return;
  }
  if (act === "copierCle") { try { await navigator.clipboard.writeText(cleSauv); b.textContent = "Code copié"; } catch { $("#cle-aff")?.select(); b.textContent = "Sélectionné : copie-le"; } return; }
  if (act === "restaurer") {
    const k = ($("#cle-rest").value || "").trim().toLowerCase(), m = $("#rest-msg");
    if (!/^[0-9a-f]{32}$/.test(k)) { m.textContent = "Ce code n'a pas le bon format (32 caractères)."; return; }
    m.textContent = "Récupération…";
    try {
      const rep = await fetch(RELAIS + "/sauvegarde/" + k); const d = await rep.json().catch(() => ({}));
      if (!rep.ok) throw new Error(d.erreur || "Erreur " + rep.status);
      const ids = new Set(repas.map((r) => r.id));
      repas = repas.concat((d.repas || []).filter((r) => r && r.id && !ids.has(r.id))).sort((a, b) => a.ts - b.ts);
      if (d.profil) profil = { ...d.profil, sauvegarde: "oui", sauvegardeDate: new Date().toISOString() };
      cleSauv = k; ecrire("cleSauv", k); ecrire("profil", profil); ecrire("vu", true); sauverRepas();
      UI.vue = "jour"; rendre(); window.scrollTo(0, 0);
    } catch (err) { m.textContent = err.message === "Failed to fetch" ? "Pas de connexion au relais." : err.message; }
    return;
  }
  if (act === "suppr") { repas = repas.filter((r) => r.id !== b.dataset.id); sauverRepas(); rendre(); }
  if (act === "code") { code = ($("#code").value || "").trim(); ecrire("code", code); UI.msgEnt = ""; await chargerCorrections(); rendre(); }
  if (act === "corriger") {
    const A = UI.analyse, msg = $("#c-msg"), apres = $("#c-apres").value.trim();
    if (!apres) { msg.textContent = "Écris la bonne réponse."; return; }
    b.disabled = true; msg.textContent = "Envoi…";
    const avant = A.scan.aliments.map((a) => a.nom + " " + a.grammes + " g NOVA " + a.nova + (a.additifs.length ? " " + a.additifs.join(" ") : "")).join(" ; ");
    try { const d = await appelRelais("/corrections", { method: "POST", body: JSON.stringify({ plat: A.scan.plat, avant, apres, note: $("#c-note").value }) }); msg.textContent = "Correction enregistrée (" + d.total + " au total). L'IA en tiendra compte dès le prochain scan."; $("#c-apres").value = ""; }
    catch (err) { msg.textContent = err.message; } finally { b.disabled = false; }
  }
  if (act === "supprCorr") { try { await appelRelais("/corrections/" + b.dataset.id, { method: "DELETE" }); await chargerCorrections(); } catch (err) { UI.msgEnt = err.message; rendre(); } }
});
document.addEventListener("change", (e) => {
  const t = e.target;
  if (t.id === "photo" || t.id === "galerie") { UI.indice = $("#indice")?.value || ""; if (t.files[0]) scanner(t.files[0]); t.value = ""; }
  if (t.id === "creneau" && UI.analyse) { UI.analyse.creneau = t.value; rendre(); }
  if (t.dataset.g !== undefined && UI.analyse) { const a = UI.analyse.scan.aliments[+t.dataset.g]; a.grammes = Math.max(1, Math.min(2000, Math.round(+t.value || a.grammes))); rendre(); }
});
document.addEventListener("submit", (e) => {
  if (e.target.id !== "f-profil") return; e.preventDefault();
  const choix = document.querySelector('input[name="sauv"]:checked')?.value || profil?.sauvegarde || "";
  const dateChoix = profil?.sauvegardeDate || new Date().toISOString();
  profil = { sauvegarde: choix, sauvegardeDate: dateChoix, age: +$("#p-age").value, sexe: $("#p-sexe").value, taille: +$("#p-taille").value, poids: +$("#p-poids").value, activite: $("#p-act").value, objectif: $("#p-obj").value, grossesse: $("#p-gros").checked };
  ecrire("profil", profil); programmerSauvegarde(); const premier = UI.vue === "profil" && !lire("vu", false); ecrire("vu", true);
  if (premier) aller("scan"); else rendre();
});

if (code) chargerCorrections(); // sait tout de suite si ce téléphone est celui de l'entraîneur
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
rendre();
}
