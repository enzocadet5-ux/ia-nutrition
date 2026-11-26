// Cas d'entraînement généraux : vérifie que le moteur juge comme un diététicien.
// Lancer : ./test.sh
var N = (typeof NutriIA!=='undefined') ? NutriIA : require('./engine.js');
var ok=0, ko=0;
function verifie(nom, cond, detail){ if(cond){ ok++; } else { ko++; print('ÉCHEC : '+nom+(detail?' → '+detail:'')); } }
function ref(nom, g){ var r=N.REFERENCES.filter(function(x){return x[0]===nom;})[0]; if(!r) throw new Error('réf. inconnue '+nom); var a=N.alimentDeReference(r); if(g) a.grammes=g; return a; }
var lea={age:20,sexe:'f',taille:166,poids:60,activite:'leger',objectif:'maintenir'};
var tom={age:22,sexe:'h',taille:180,poids:80,activite:'actif',objectif:'maintenir'};

// Besoins
var b=N.besoins(lea);
verifie('BMR Léa (Mifflin)', b.bmr===1377, b.bmr);
verifie('Cible Léa ≈ 1890', b.cible===1890, b.cible);
verifie('IMC Léa', b.imc===21.8 && b.imcCategorie==='corpulence normale', b.imc);
verifie('Perte de poids refusée < 18 ans', N.besoins({age:16,sexe:'f',taille:160,poids:55,activite:'leger',objectif:'perdre'}).protege===true);
var bp=N.besoins({age:30,sexe:'f',taille:165,poids:80,activite:'sedentaire',objectif:'perdre'});
verifie('Perte : jamais sous le BMR ×1,1', bp.cible>=bp.bmr*1.1-10, bp.cible+' / '+bp.bmr);

// Verdicts HEALTHY
function v(items,cr){ return N.analyserRepas(items, lea, cr||'dejeuner'); }
var sain=v([ref('Blanc de poulet grillé'),ref('Riz blanc cuit',150),ref('Haricots verts'),ref('Huile d\'olive (cuisson)')]);
verifie('Poulet riz haricots = HEALTHY', sain.healthy.verdict==='HEALTHY', sain.healthy.score);
var lentilles=v([ref('Lentilles cuites'),ref('Riz blanc cuit',120),ref('Salade verte')]);
verifie('Lentilles riz salade = HEALTHY', lentilles.healthy.verdict==='HEALTHY', lentilles.healthy.score);
var fast=v([ref('Burger fast-food'),ref('Frites surgelées de fast-food'),ref('Soda cola')]);
verifie('Menu fast-food = PAS HEALTHY', fast.healthy.verdict==='PAS HEALTHY', fast.healthy.score);
verifie('Menu fast-food = trop pour un déjeuner', fast.portion.niveau==='trop', fast.portion.ratio);
var jambon=v([ref('Pâtes cuites'),ref('Jambon blanc industriel')]);
verifie('Pâtes jambon : nitrite repéré, pas HEALTHY', jambon.healthy.verdict!=='HEALTHY' && jambon.healthy.additifs.some(function(a){return a.code==='E250';}), jambon.healthy.score);
var rougail=v([ref('Saucisse fumée (rougail)'),ref('Riz blanc cuit'),ref('Grains (haricots rouges) maison')]);
verifie('Rougail saucisse = pas HEALTHY', rougail.healthy.verdict!=='HEALTHY', rougail.healthy.score);
var cari=v([ref('Cari poulet maison'),ref('Riz blanc cuit',150),ref('Grains (haricots rouges) maison')]);
verifie('Cari poulet maison = HEALTHY', cari.healthy.verdict==='HEALTHY', cari.healthy.score);
var pdj=v([ref('Pain de mie industriel'),ref('Pâte à tartiner chocolat-noisette',30),ref('Jus d\'orange pur jus')],'petit-dejeuner');
verifie('Pain de mie + pâte à tartiner ≠ HEALTHY', pdj.healthy.verdict!=='HEALTHY', pdj.healthy.score);
var fruit=v([ref('Pomme'),ref('Yaourt nature')],'gouter');
verifie('Pomme + yaourt nature = HEALTHY et adapté', fruit.healthy.verdict==='HEALTHY' && fruit.portion.niveau==='adapte', fruit.healthy.score+' '+fruit.portion.niveau);
var light=v([ref('Soda light')],'gouter');
verifie('Soda light : édulcorants repérés', light.healthy.additifs.filter(function(a){return a.niveau==='orange';}).length>=3);
verifie('Verdict indépendant du poids', N.analyserRepas(fast.totaux?[ref('Burger fast-food')]:[],tom,'dejeuner').healthy.score===v([ref('Burger fast-food')]).healthy.score);

// Portion selon le poids
var salade=v([ref('Salade verte'),ref('Œuf dur')]);
verifie('Salade + œuf = léger', salade.portion.niveau==='leger', salade.portion.ratio);
var pizza=N.analyserRepas([ref('Pizza margherita')], tom, 'dejeuner');
verifie('Pizza entière adaptée pour un sportif de 80 kg', pizza.portion.niveau==='adapte', pizza.portion.ratio);
var pizzaL=N.analyserRepas([ref('Pizza margherita',450)], lea, 'diner');
verifie('Grande pizza trop pour Léa au dîner', pizzaL.portion.niveau==='trop', pizzaL.portion.ratio);

// Bilan du jour
var jour=N.bilanJour([
  {nom:'Petit-déj',aliments:[ref('Pain de mie industriel'),ref('Pâte à tartiner chocolat-noisette',30)]},
  {nom:'Midi fast-food',aliments:[ref('Burger fast-food'),ref('Frites surgelées de fast-food'),ref('Soda cola')]},
  {nom:'Goûter',aliments:[ref('Biscuits au chocolat',80)]},
  {nom:'Soir',aliments:[ref('Pizza margherita')]}], lea);
var trop=jour.trop.map(function(l){return l.cle;});
verifie('Journée chargée : calories en trop', trop.indexOf('kcal')>=0, JSON.stringify(trop));
verifie('Journée chargée : sucres ajoutés en trop', trop.indexOf('sucresAjoutes')>=0);
verifie('Journée chargée : ultra-transformé en trop', trop.indexOf('ultra')>=0);
verifie('Source des sucres = midi fast-food ou goûter', /fast|Goûter|Petit/.test(jour.lignes[1].source), jour.lignes[1].source);
var jourSain=N.bilanJour([{nom:'Midi',aliments:sain.totaux?[ref('Blanc de poulet grillé'),ref('Riz blanc cuit'),ref('Haricots verts')]:[]},{nom:'Soir',aliments:[ref('Lentilles cuites'),ref('Salade verte'),ref('Pomme')]}], lea);
verifie('Journée équilibrée : rien de trop', jourSain.trop.length===0, JSON.stringify(jourSain.trop.map(function(l){return l.cle;})));

// Normalisation de la réponse IA
var n=N.normaliserScan({estUnPlat:true,plat:'Test',aliments:[{nom:'Saucisson',grammes:'40',kcal100:400,additifs:['e250',' E 471','bidon'],sucres100:1,sucresAjoutes100:5}]});
verifie('Codes E normalisés', n.aliments[0].additifs.join()==='E250,E471', n.aliments[0].additifs.join());
verifie('NOVA déduit du nom', n.aliments[0].nova===4);
verifie('Sucres ajoutés ≤ sucres', n.aliments[0].per100.sucresAjoutes===1);
verifie('Pas de plat → null', N.normaliserScan({estUnPlat:false})===null);

// Exemples d'entraînement humain
var corr=[{plat:'Cari poulet',avant:'200 g',apres:'cari poulet du RU : 250 g',ts:1},{plat:'Soda',avant:'a',apres:'b',ts:5}];
verifie('Correction la plus proche choisie en premier', N.choisirExemples(corr,'cari poulet')[0].plat==='Cari poulet');
verifie('Prompt contient les corrections', N.promptUtilisateur('cari',corr).indexOf('entraîneur humain')>0);
var pr=N.promptUtilisateur('',[],{vrai:'cari de thon maison avec riz',avant:'cari poulet'});
verifie('Rectification de l\'utilisateur dans le prompt', pr.indexOf('cari de thon maison')>0 && pr.indexOf('prime')>0);
verifie('Sans rectification : prompt simple', N.promptUtilisateur('',[]).indexOf('fausse')<0);
verifie('Prompt système stable (cache)', N.promptSysteme()===N.promptSysteme() && N.promptSysteme().indexOf('Nuggets')>0);
verifie('JSON lu même entouré de texte', N.lireJSON('Voici : {"estUnPlat":false} fin').estUnPlat===false);
verifie('JSON cassé → null', N.lireJSON('{oups')===null);

print(ok+' réussis, '+ko+' échoués');
