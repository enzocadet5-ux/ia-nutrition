// ============================================================
// IA NUTRITION : moteur indépendant (aucune dépendance)
// Base de connaissances + règles de calcul + prompt de l'IA.
// L'IA (Claude) reconnaît les aliments sur la photo ; ce moteur
// décide du verdict HEALTHY, de la portion et des excès du jour,
// avec des règles fixes et vérifiables (mêmes données → même verdict).
// Utilisable tel quel dans une autre appli : NutriIA.analyserRepas(...)
// ============================================================
var NutriIA = (function(){
"use strict";

// ---------- 1. BASE DE CONNAISSANCES ----------

// Additifs : niveau rouge = à éviter, orange = à limiter, vert = sans souci connu.
// Sources : EFSA, CIRC (OMS), règlement UE 1333/2008, étude NutriNet-Santé.
var ADDITIFS = {
  E249:['Nitrite de potassium','rouge','Charcuterie. Forme des nitrosamines ; viande transformée classée cancérogène (CIRC).'],
  E250:['Nitrite de sodium','rouge','Charcuterie. Forme des nitrosamines ; viande transformée classée cancérogène (CIRC).'],
  E251:['Nitrate de sodium','rouge','Charcuterie. Se transforme en nitrite.'],
  E252:['Nitrate de potassium','rouge','Charcuterie. Se transforme en nitrite.'],
  E171:['Dioxyde de titane','rouge','Interdit dans l\'UE depuis 2022 (doute sur la génotoxicité).'],
  E102:['Tartrazine','rouge','Colorant azoïque ; mention obligatoire « peut avoir des effets sur l\'activité et l\'attention des enfants ».'],
  E104:['Jaune de quinoléine','rouge','Colorant ; même mention obligatoire sur l\'attention des enfants.'],
  E110:['Jaune orangé S','rouge','Colorant azoïque ; même mention obligatoire.'],
  E122:['Azorubine','rouge','Colorant azoïque ; même mention obligatoire.'],
  E124:['Ponceau 4R','rouge','Colorant azoïque ; même mention obligatoire.'],
  E129:['Rouge allura AC','rouge','Colorant azoïque ; même mention obligatoire.'],
  E320:['BHA','rouge','Antioxydant classé cancérogène possible (CIRC 2B).'],
  E321:['BHT','orange','Antioxydant de synthèse, perturbateur endocrinien suspecté.'],
  E951:['Aspartame','orange','Édulcorant classé cancérogène possible (CIRC 2B, 2023).'],
  E950:['Acésulfame K','orange','Édulcorant associé à un risque cardiovasculaire (NutriNet-Santé).'],
  E955:['Sucralose','orange','Édulcorant ; effets sur le microbiote étudiés.'],
  E954:['Saccharine','orange','Édulcorant de synthèse.'],
  E150d:['Caramel au sulfite d\'ammonium','orange','Colorant des sodas ; peut contenir du 4-MEI.'],
  E338:['Acide phosphorique','orange','Sodas ; phosphates ajoutés à limiter (reins, os).'],
  E339:['Phosphates de sodium','orange','Phosphates ajoutés à limiter.'],
  E340:['Phosphates de potassium','orange','Phosphates ajoutés à limiter.'],
  E341:['Phosphates de calcium','orange','Phosphates ajoutés à limiter.'],
  E450:['Diphosphates','orange','Charcuterie, viennoiseries industrielles ; phosphates ajoutés.'],
  E451:['Triphosphates','orange','Phosphates ajoutés.'],
  E452:['Polyphosphates','orange','Phosphates ajoutés.'],
  E407:['Carraghénanes','orange','Épaississant ; inflammation intestinale suspectée.'],
  E433:['Polysorbate 80','orange','Émulsifiant ; altère le microbiote chez l\'animal.'],
  E466:['Carboxyméthylcellulose','orange','Émulsifiant ; altère le microbiote, lié à l\'inflammation.'],
  E471:['Mono- et diglycérides d\'acides gras','orange','Émulsifiant associé à un risque cardiovasculaire (NutriNet-Santé, 2023).'],
  E472e:['Esters diacétyltartriques','orange','Émulsifiant du pain industriel.'],
  E621:['Glutamate monosodique','orange','Exhausteur de goût ; pousse à manger plus, riche en sodium.'],
  E211:['Benzoate de sodium','orange','Conservateur des sodas ; peut former du benzène avec la vitamine C.'],
  E220:['Dioxyde de soufre','orange','Sulfite, allergène à déclaration obligatoire.'],
  E223:['Métabisulfite de sodium','orange','Sulfite, allergène.'],
  E224:['Métabisulfite de potassium','orange','Sulfite, allergène.'],
  E202:['Sorbate de potassium','vert','Conservateur bien toléré.'],
  E270:['Acide lactique','vert','Issu de la fermentation.'],
  E290:['Dioxyde de carbone','vert','Bulles des boissons gazeuses.'],
  E300:['Acide ascorbique (vitamine C)','vert','Antioxydant sans souci.'],
  E306:['Tocophérols (vitamine E)','vert','Antioxydant naturel.'],
  E322:['Lécithines','vert','Émulsifiant naturel (soja, tournesol).'],
  E330:['Acide citrique','vert','Présent naturellement dans le citron.'],
  E100:['Curcumine','vert','Colorant naturel (curcuma).'],
  E160a:['Bêta-carotène','vert','Colorant naturel (carotte).'],
  E162:['Rouge de betterave','vert','Colorant naturel.'],
  E170:['Carbonate de calcium','vert','Minéral.'],
  E412:['Gomme de guar','vert','Fibre épaississante.'],
  E415:['Gomme xanthane','vert','Épaississant bien toléré.'],
  E440:['Pectines','vert','Fibre des fruits.'],
  E500:['Bicarbonate de sodium','vert','Poudre levante.'],
  E301:['Ascorbate de sodium','vert','Forme de vitamine C (souvent avec les nitrites).'],
  E282:['Propionate de calcium','orange','Conservateur du pain industriel.'],
  E385:['EDTA calcique disodique','orange','Séquestrant de synthèse (mayonnaises, conserves).']
};

// Classification NOVA (degré de transformation).
var NOVA = {
  1:'Brut ou peu transformé (fruits, légumes, riz, œufs, viande fraîche)',
  2:'Ingrédient culinaire (huile, beurre, sucre, sel)',
  3:'Transformé (pain, fromage, conserves, plat maison avec sel/sucre/gras)',
  4:'Ultra-transformé (charcuterie, nuggets, sodas, biscuits, plats industriels)'
};

// Part de l'énergie de la journée conseillée pour chaque repas.
var CRENEAUX = {
  'petit-dejeuner':{nom:'petit-déjeuner',part:0.25},
  'dejeuner':{nom:'déjeuner',part:0.35},
  'gouter':{nom:'goûter',part:0.10},
  'diner':{nom:'dîner',part:0.30}
};

var ACTIVITES = {
  sedentaire:[1.2,'Sédentaire (assis, peu de marche)'],
  leger:[1.375,'Léger (marche, 1 à 3 séances par semaine)'],
  modere:[1.55,'Modéré (3 à 5 séances par semaine)'],
  actif:[1.725,'Actif (sport 6 à 7 fois par semaine)'],
  tres_actif:[1.9,'Très actif (travail physique + sport)']
};

// Repères journaliers adultes (OMS, ANSES). Exprimés en fonction de l'énergie.
function reperes(kcal){
  return {
    kcal:kcal,
    sucresAjoutes:Math.round(kcal*0.10/4),   // OMS : sucres libres < 10 % de l'énergie
    ags:Math.round(kcal*0.12/9),             // ANSES : acides gras saturés ≤ 12 %
    lipides:Math.round(kcal*0.40/9),         // ANSES : lipides 35 à 40 %
    sel:5,                                   // OMS : moins de 5 g de sel
    fibres:30,                               // ANSES : au moins 30 g
    ultraTransfoPart:0.30                    // repère indicatif : < 30 % des calories en NOVA 4
  };
}

// ---------- 2. OUTILS ----------
function num(v){ v=+v; return isFinite(v)&&v>=0 ? v : 0; }
function arrondi(v,d){ var p=Math.pow(10,d||0); return Math.round(v*p)/p; }
function fr(v,d){ return String(arrondi(v,d)).replace('.',','); }
function borne(v,a,b){ return Math.max(a,Math.min(b,v)); }
var CLES = ['kcal','proteines','glucides','lipides','fibres','sucres','sucresAjoutes','ags','sel'];

function codeAdditif(c){
  c=String(c||'').toUpperCase().replace(/\s|-/g,'');
  var m=c.match(/^E?(\d{3,4})([A-Z]?)$/); if(!m) return null;
  return 'E'+m[1]+m[2].toLowerCase();
}
function infoAdditif(code){
  var k=codeAdditif(code); if(!k) return null;
  var a=ADDITIFS[k]||ADDITIFS[k.replace(/[a-z]$/,'')];
  return a ? {code:k,nom:a[0],niveau:a[1],pourquoi:a[2]} : {code:k,nom:'Additif '+k,niveau:'orange',pourquoi:'Additif absent de la base : à vérifier sur l\'étiquette.'};
}

// Repli si l'IA ne donne pas la classe NOVA (saisie manuelle).
function novaParNom(nom){
  var t=String(nom||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
  if(/saucisse|saucisson|jambon|lardon|bacon|chorizo|nugget|cordon|knack|surimi|soda|cola|chips|biscuit|bonbon|ketchup|mayonnaise|plat cuisine|pizza surgelee|hamburger|burger|barre|cereales du petit|pate a tartiner|creme dessert|pain de mie|boisson energisante|sirop|viennoiserie industrielle|croque|kebab|cordon bleu/.test(t)) return 4;
  if(/pain|fromage|frite|conserve|thon|beurre|croissant|quiche|pizza|lasagne|sauce|gateau|tarte/.test(t)) return 3;
  if(/huile|sucre|sel|miel/.test(t)) return 2;
  return 1;
}

// ---------- 3. BESOINS SELON LE POIDS ----------
// Mifflin-St Jeor ; objectif perte : -15 % maximum, jamais sous le métabolisme de base.
function besoins(p){
  var poids=num(p.poids), taille=num(p.taille), age=num(p.age);
  var bmr = 10*poids + 6.25*taille - 5*age + (p.sexe==='h'?5:-161);
  var act = (ACTIVITES[p.activite]||ACTIVITES.leger)[0];
  var tdee = bmr*act;
  var imc = taille ? poids/Math.pow(taille/100,2) : 0;
  var notes=[], cible=tdee;
  var protege = age<18 || p.grossesse || (imc && imc<18.5);
  if(p.objectif==='perdre'){
    if(protege) notes.push(age<18?'Moins de 18 ans : pas d\'objectif de perte de poids, ton corps grandit encore.':p.grossesse?'Grossesse ou allaitement : pas d\'objectif de perte de poids.':'Ton IMC est déjà bas : l\'objectif reste le maintien.');
    else { cible=Math.max(tdee*0.85, bmr*1.1); notes.push('Objectif perte : environ 15 % sous ta dépense, sans descendre sous ton métabolisme de base.'); }
  } else if(p.objectif==='prendre'){ cible=tdee*1.10; notes.push('Objectif prise de masse : environ 10 % au-dessus de ta dépense.'); }
  cible=Math.round(cible/10)*10;
  var cat = !imc?'' : imc<18.5?'insuffisance pondérale' : imc<25?'corpulence normale' : imc<30?'surpoids' : 'obésité';
  return { bmr:Math.round(bmr), depense:Math.round(tdee), cible:cible, imc:arrondi(imc,1), imcCategorie:cat,
    proteines:Math.round(poids*(p.objectif==='prendre'?1.6:1)), reperes:reperes(cible), notes:notes, protege:!!protege };
}

function creneauSelonHeure(date){
  var d=date instanceof Date?date:new Date(date||Date.now()); var h=d.getHours()+d.getMinutes()/60;
  return h<10.5?'petit-dejeuner' : h<15?'dejeuner' : h<18?'gouter' : 'diner';
}

// ---------- 4. NORMALISER LA RÉPONSE DE L'IA ----------
function normaliserAliment(x){
  x=x||{}; var g=borne(Math.round(num(x.grammes)||100),1,2000);
  var per={}; CLES.forEach(function(k){ per[k]=num(x[k+'100']); });
  if(per.sucresAjoutes>per.sucres) per.sucresAjoutes=per.sucres;
  var nova=+x.nova; if(!(nova>=1&&nova<=4)) nova=novaParNom(x.nom);
  var add=[]; (Array.isArray(x.additifs)?x.additifs:[]).forEach(function(c){ var k=codeAdditif(c); if(k&&add.indexOf(k)<0) add.push(k); });
  return { nom:String(x.nom||'Aliment').slice(0,60), grammes:g, per100:per, nova:nova, additifs:add,
    groupe:String(x.groupe||'autre'), certain:x.certain!==false };
}
function normaliserScan(res){
  if(!res||res.estUnPlat===false||!Array.isArray(res.aliments)||!res.aliments.length) return null;
  return { plat:String(res.plat||'Mon repas').slice(0,60), confiance:borne(Math.round(num(res.confiance)||50),0,100),
    aliments:res.aliments.slice(0,15).map(normaliserAliment),
    caches:(Array.isArray(res.ingredientsCaches)?res.ingredientsCaches:[]).slice(0,5).map(String),
    conseil:String(res.conseil||'').slice(0,300) };
}

// ---------- 5. CALCULS ----------
function totaux(aliments){
  var t={grammes:0,kcalNova4:0,kcalNova3:0,legumesFruitsG:0}; CLES.forEach(function(k){ t[k]=0; });
  aliments.forEach(function(a){
    var f=a.grammes/100; CLES.forEach(function(k){ t[k]+=a.per100[k]*f; });
    t.grammes+=a.grammes; var k=a.per100.kcal*f;
    if(a.nova===4) t.kcalNova4+=k; else if(a.nova===3) t.kcalNova3+=k;
    if(a.groupe==='legume'||a.groupe==='fruit') t.legumesFruitsG+=a.grammes;
  });
  return t;
}

// Verdict HEALTHY : score sur 100 + raisons lisibles.
function scoreHealthy(aliments, t, part){
  var R=reperes(2000); // densité jugée sur une base de référence fixe : le verdict ne dépend pas du poids
  var s=100, plus=[], moins=[];
  var kcal=t.kcal||1;
  var p4=t.kcalNova4/kcal, p3=t.kcalNova3/kcal;
  if(p4>0.05){ s-=40*p4; moins.push(Math.round(p4*100)+' % des calories viennent de produits ultra-transformés.'); }
  if(p3>0.2) s-=10*p3;
  var adds={}; aliments.forEach(function(a){ a.additifs.forEach(function(c){ adds[c]=infoAdditif(c); }); });
  var liste=Object.keys(adds).map(function(c){ return adds[c]; });
  var rouges=liste.filter(function(a){return a.niveau==='rouge';}), oranges=liste.filter(function(a){return a.niveau==='orange';});
  if(rouges.length){ s-=Math.min(40,15*rouges.length); moins.push('Additif à éviter : '+rouges.map(function(a){return a.code+' ('+a.nom+')';}).join(', ')+'.'); }
  if(oranges.length){ s-=Math.min(20,6*oranges.length); moins.push('Additif à limiter : '+oranges.map(function(a){return a.code;}).join(', ')+'.'); }
  function exces(val,ref,pts,txt){ var r=val/(ref*part); if(r>1){ s-=Math.min(pts,pts*(r-1)); moins.push(txt); } }
  exces(t.sucresAjoutes,R.sucresAjoutes,20,'Beaucoup de sucres ajoutés pour un seul repas ('+fr(t.sucresAjoutes)+' g).');
  exces(t.sel,R.sel,15,'Repas très salé ('+fr(t.sel,1)+' g de sel).');
  exces(t.ags,R.ags,15,'Riche en graisses saturées ('+fr(t.ags)+' g).');
  if(t.fibres>=R.fibres*part){ s+=5; plus.push('Bonne dose de fibres ('+fr(t.fibres)+' g).'); }
  if(t.legumesFruitsG>=100){ s+=5; plus.push('Contient des légumes ou des fruits ('+fr(t.legumesFruitsG)+' g).'); }
  if(t.proteines>=15){ plus.push('Apport correct en protéines ('+fr(t.proteines)+' g).'); }
  if(p4<=0.05&&!rouges.length&&!oranges.length) plus.push('Aliments bruts ou peu transformés, sans additif identifié.');
  s=Math.round(borne(s,0,100));
  var verdict = (s>=70 && !rouges.length && p4<0.5) ? 'HEALTHY' : s>=45 ? 'MOYEN' : 'PAS HEALTHY';
  return { score:s, verdict:verdict, plus:plus, moins:moins, additifs:liste, partUltra:arrondi(p4,2) };
}

// Le repas est-il trop copieux pour ton poids, à ce moment de la journée ?
function portion(t, b, creneau){
  var c=CRENEAUX[creneau]||CRENEAUX.dejeuner;
  var ideal=Math.round(b.cible*c.part/10)*10, r=t.kcal/ideal;
  var niveau = r<0.6?'leger' : r<=1.15?'adapte' : r<=1.4?'copieux' : 'trop';
  if(b.protege && niveau==='trop') niveau='copieux';
  var txt = { leger:'Repas léger pour un '+c.nom+'. Pense à compléter si tu as encore faim.',
    adapte:'Portion adaptée à ton poids et à ton activité pour un '+c.nom+'.',
    copieux:'Un peu copieux pour un '+c.nom+' : environ '+Math.round(t.kcal-ideal)+' kcal au-dessus de ta part.',
    trop:'Trop pour un '+c.nom+' : '+Math.round(t.kcal-ideal)+' kcal au-dessus de ta part, soit '+Math.round(r*100)+' %.' }[niveau];
  return { creneau:creneau, nomCreneau:c.nom, ideal:ideal, ratio:arrondi(r,2), niveau:niveau, texte:txt };
}

function analyserRepas(aliments, profil, creneau){
  var b=besoins(profil), t=totaux(aliments);
  var part=(CRENEAUX[creneau]||CRENEAUX.dejeuner).part;
  return { totaux:t, healthy:scoreHealthy(aliments,t,part), portion:portion(t,b,creneau), besoins:b };
}

// Ce que tu as trop mangé aujourd'hui (repas = [{nom, aliments}]).
function bilanJour(repas, profil){
  var b=besoins(profil), R=b.reperes, tous=[], parRepas=[];
  repas.forEach(function(m){ tous=tous.concat(m.aliments); parRepas.push({nom:m.nom,t:totaux(m.aliments)}); });
  var t=totaux(tous);
  function principal(k){ var best=null; parRepas.forEach(function(x){ if(!best||x.t[k]>best.t[k]) best=x; }); return best&&best.t[k]>0?best.nom:''; }
  var lignes=[
    ['kcal','Calories','kcal',t.kcal,R.kcal,1.05],
    ['sucresAjoutes','Sucres ajoutés','g',t.sucresAjoutes,R.sucresAjoutes,1],
    ['sel','Sel','g',t.sel,R.sel,1],
    ['ags','Graisses saturées','g',t.ags,R.ags,1],
    ['lipides','Lipides','g',t.lipides,R.lipides,1]
  ].map(function(l){ var r=l[3]/l[4]; return { cle:l[0], nom:l[1], unite:l[2], valeur:arrondi(l[3],l[2]==='g'&&l[3]<10?1:0), repere:l[4], ratio:arrondi(r,2),
      etat: r>l[5]?'trop' : r>0.85?'proche' : 'ok', source:principal(l[0]) }; });
  var pu=t.kcal?t.kcalNova4/t.kcal:0;
  lignes.push({cle:'ultra',nom:'Ultra-transformé',unite:'%',valeur:Math.round(pu*100),repere:30,ratio:arrondi(pu/R.ultraTransfoPart,2),etat:pu>R.ultraTransfoPart?'trop':pu>0.25?'proche':'ok',source:''});
  var trop=lignes.filter(function(l){return l.etat==='trop';});
  var manque = t.fibres<R.fibres*0.6 && t.kcal>R.kcal*0.6 ? ['Fibres : '+arrondi(t.fibres)+' g sur 30 g conseillés.'] : [];
  return { totaux:t, lignes:lignes, trop:trop, manque:manque, besoins:b,
    resume: !repas.length ? 'Aucun repas enregistré aujourd\'hui.' : trop.length ? 'Aujourd\'hui, tu as dépassé : '+trop.map(function(l){return l.nom.toLowerCase();}).join(', ')+'.' : 'Rien de trop aujourd\'hui, tu restes dans les repères.' };
}

// ---------- 6. ENTRAÎNEMENT ----------
// a) Cas généraux écrits par Claude : plats de référence (portion type, valeurs Ciqual moyennes).
//    [nom, grammes, kcal100, prot100, gluc100, lip100, fibres100, sucresAjoutes100, ags100, sel100, nova, additifs]
var REFERENCES = [
  ['Riz blanc cuit',180,130,2.7,28,0.3,0.4,0,0.1,0,1,[]],
  ['Pâtes cuites',200,150,5.3,29,0.9,1.8,0,0.2,0,1,[]],
  ['Frites',150,290,3.4,37,14,3.5,0,1.5,0.5,3,[]],
  ['Frites surgelées de fast-food',150,310,3.4,39,15,3.5,0,1.6,0.6,4,['E450']],
  ['Blanc de poulet grillé',120,165,31,0,3.6,0,0,1,0.2,1,[]],
  ['Nuggets de poulet',150,270,15,18,15,1,0.5,2,1.2,4,['E450','E471']],
  ['Steak haché 5 % cuit',100,160,26,0,6,0,0,2.5,0.2,1,[]],
  ['Jambon blanc industriel',50,115,21,0.5,3,0,0.5,1.1,1.9,4,['E250','E301','E451']],
  ['Saucisse fumée (rougail)',150,300,13,2,27,0,0,10,2,4,['E250','E621']],
  ['Saumon cuit',110,200,25,0,11,0,0,2,0.2,1,[]],
  ['Œuf dur',60,145,12.5,0.6,10,0,0,3,0.3,1,[]],
  ['Lentilles cuites',180,116,9,20,0.4,7.9,0,0.1,0,1,[]],
  ['Grains (haricots rouges) maison',150,110,7.5,14,2,7,0,0.3,0.6,3,[]],
  ['Salade verte',60,15,1.3,1.7,0.2,1.3,0,0,0,1,[]],
  ['Haricots verts',150,30,1.8,4,0.2,3.2,0,0,0,1,[]],
  ['Brocoli cuit',150,35,2.8,4,0.4,3,0,0.1,0,1,[]],
  ['Pomme',150,53,0.3,12,0.2,2.4,0,0,0,1,[]],
  ['Banane',120,90,1.1,20,0.3,2.6,0,0.1,0,1,[]],
  ['Yaourt nature',125,60,4,4.5,3,0,0,2,0.1,1,[]],
  ['Yaourt aux fruits sucré',125,95,3.5,14,2.5,0.2,9,1.6,0.1,4,['E407','E129']],
  ['Pain baguette',60,270,9,55,1.3,2.7,1,0.3,1.3,3,[]],
  ['Pain de mie industriel',50,265,8,48,4,3,5,0.5,1.2,4,['E471','E282','E472e']],
  ['Pizza margherita',300,240,10,30,9,2,1,4,1.3,3,[]],
  ['Burger fast-food',220,250,13,25,11,1.5,4,4.5,1.2,4,['E471','E282','E621']],
  ['Soda cola',330,42,0,10.6,0,0,10.6,0,0,4,['E150d','E338']],
  ['Soda light',330,1,0,0,0,0,0,0,0,4,['E150d','E338','E951','E950']],
  ['Jus d\'orange pur jus',250,45,0.7,10,0.1,0.3,0,0,0,1,[]],
  ['Biscuits au chocolat',40,480,6,65,21,3,30,10,0.5,4,['E322','E500']],
  ['Pâte à tartiner chocolat-noisette',20,540,6,57,31,3,56,10,0.1,4,['E322']],
  ['Croissant',60,410,8,45,21,2,8,13,1,3,[]],
  ['Mayonnaise industrielle',15,700,1,1,77,0,0.5,6,1.3,4,['E412','E415','E385']],
  ['Huile d\'olive (cuisson)',10,900,0,0,100,0,0,14,0,2,[]],
  ['Cari poulet maison',250,150,18,3,7,0.6,0,1.8,0.9,3,[]],
  ['Lasagnes surgelées',300,140,7.5,13,6.5,1.2,1,3,0.8,4,['E471','E407']]
];
function refsTexte(){
  return REFERENCES.map(function(r){ return r[0]+' : '+r[1]+' g, '+r[2]+' kcal/100 g, NOVA '+r[10]+(r[11].length?', additifs '+r[11].join(' '):''); }).join(' ; ');
}

// b) Corrections humaines : chaque correction faite dans l'appli devient un exemple.
//    { plat, avant:"ce que l'IA avait dit", apres:"la bonne réponse", note }
function exemplesTexte(corrections){
  if(!corrections||!corrections.length) return '';
  return 'Corrections faites par l\'entraîneur humain sur des analyses précédentes (elles priment sur tes habitudes ; applique la même logique aux plats semblables) :\n'+
    corrections.slice(0,12).map(function(c,i){ return (i+1)+'. '+String(c.plat||'').slice(0,60)+' : l\'IA avait dit « '+String(c.avant||'').slice(0,200)+' » → correct : « '+String(c.apres||'').slice(0,200)+' »'+(c.note?' ('+String(c.note).slice(0,150)+')':''); }).join('\n')+'\n';
}
// Garde les corrections les plus proches du plat (mots en commun), puis les plus récentes.
function choisirExemples(corrections, indice){
  var mots=String(indice||'').toLowerCase().split(/[^a-zàâçéèêëîïôûùüÿœ]+/).filter(function(w){return w.length>3;});
  return (corrections||[]).map(function(c){ var t=String(c.plat+' '+c.apres).toLowerCase(); var s=mots.filter(function(w){return t.indexOf(w)>=0;}).length; return {c:c,s:s}; })
    .sort(function(a,b){ return b.s-a.s || (b.c.ts||0)-(a.c.ts||0); }).slice(0,12).map(function(x){return x.c;});
}

// ---------- 7. PROMPT DE L'IA SPÉCIALISÉE ----------
function promptSysteme(){
  var codes=Object.keys(ADDITIFS).join(', ');
  return 'Tu es IA Nutrition, un expert en nutrition et en technologie alimentaire (niveau diététicien, tables Ciqual de l\'ANSES). On te donne la photo d\'un repas.\n'+
  'Réponds UNIQUEMENT par un objet JSON, sans texte autour :\n'+
  '{"estUnPlat":true,"plat":"nom court","confiance":70,"aliments":[{"nom":"Riz blanc cuit","grammes":150,"certain":true,"groupe":"feculent","nova":1,"additifs":[],"kcal100":130,"proteines100":2.7,"glucides100":28,"lipides100":0.3,"fibres100":0.4,"sucres100":0.1,"sucresAjoutes100":0,"ags100":0.1,"sel100":0}],"ingredientsCaches":["huile de cuisson"],"conseil":"une phrase"}\n'+
  'Règles d\'expert :\n'+
  '- Un élément par aliment visible, en français. "grammes" = portion visible. Repères : assiette plate 26 cm ; une portion de riz cuit ≈ 150 à 200 g ; un steak ≈ 100 à 120 g ; une canette = 330 g ; une cuillère à soupe d\'huile = 10 g.\n'+
  '- Valeurs "…100" pour 100 g de l\'aliment tel que mangé (cuit), d\'après les tables Ciqual. sel en g. "sucresAjoutes100" : seulement les sucres ajoutés (0 pour un fruit, un légume, du lait nature).\n'+
  '- "groupe" parmi : legume, fruit, feculent, legumineuse, viande, poisson, oeuf, laitier, gras, sucre, boisson, plat.\n'+
  '- "nova" de 1 à 4 : 1 brut ou peu transformé, 2 ingrédient culinaire, 3 transformé (pain, fromage, conserve, plat maison), 4 ultra-transformé (charcuterie industrielle, nuggets, sodas, biscuits, sauces et plats industriels, pain de mie).\n'+
  '- "additifs" : codes E probables UNIQUEMENT pour un produit industriel reconnaissable (ex. jambon industriel → E250, E301 ; soda cola → E150d, E338 ; soda light → E951, E950). Jamais pour un aliment brut ou fait maison. Codes connus : '+codes+'.\n'+
  '- Compte les graisses de cuisson et sauces probables dans les valeurs et liste-les dans "ingredientsCaches".\n'+
  '- "confiance" de 0 à 100. "certain": false si l\'identité d\'un aliment est douteuse.\n'+
  '- "conseil" : une phrase concrète et bienveillante pour rendre ce repas plus sain, en tutoyant, sans culpabiliser.\n'+
  '- Si la photo ne montre pas de nourriture : {"estUnPlat":false}.\n'+
  'Plats de référence (portions et valeurs types, à utiliser comme repères) : '+refsTexte()+'.';
}
function promptUtilisateur(indice, corrections){
  return exemplesTexte(choisirExemples(corrections, indice))+
    (indice?'Précision de l\'utilisateur : « '+String(indice).slice(0,200)+' ».\n':'')+
    'Analyse ce repas.';
}
// Lit le JSON renvoyé par l'IA, même entouré de texte.
function lireJSON(texte){
  var t=String(texte||''); var a=t.indexOf('{'), b=t.lastIndexOf('}');
  if(a<0||b<=a) return null; try{ return JSON.parse(t.slice(a,b+1)); }catch(e){ return null; }
}

return { ADDITIFS:ADDITIFS, NOVA:NOVA, CRENEAUX:CRENEAUX, ACTIVITES:ACTIVITES, reperes:reperes,
  besoins:besoins, creneauSelonHeure:creneauSelonHeure, normaliserScan:normaliserScan, normaliserAliment:normaliserAliment,
  totaux:totaux, scoreHealthy:scoreHealthy, portion:portion, analyserRepas:analyserRepas, bilanJour:bilanJour,
  infoAdditif:infoAdditif, promptSysteme:promptSysteme, promptUtilisateur:promptUtilisateur, lireJSON:lireJSON, novaParNom:novaParNom,
  REFERENCES:REFERENCES, choisirExemples:choisirExemples,
  alimentDeReference:function(r){ return normaliserAliment({nom:r[0],grammes:r[1],kcal100:r[2],proteines100:r[3],glucides100:r[4],lipides100:r[5],fibres100:r[6],sucres100:r[7],sucresAjoutes100:r[7],ags100:r[8],sel100:r[9],nova:r[10],additifs:r[11],
    groupe:/salade|haricots verts|brocoli/i.test(r[0])?'legume':/pomme|banane/i.test(r[0])?'fruit':'plat'}); } };
})();
if(typeof module!=='undefined') module.exports=NutriIA;
