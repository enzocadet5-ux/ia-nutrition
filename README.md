# IA Nutrition

Appli installable (PWA) : tu prends ton plat en photo et elle te dit
- **HEALTHY / MOYEN / PAS HEALTHY**, avec les raisons (additifs, ultra-transformé, sel, sucres ajoutés, graisses saturées) ;
- **les calories** ;
- **si c'est trop pour ton poids pour ce repas** (part du petit-déjeuner, déjeuner, goûter ou dîner) ;
- **ce que tu as trop mangé dans la journée**.

## Comment ça marche

| Pièce | Rôle |
|---|---|
| `engine.js` | Le cerveau nutrition : 53 additifs classés, NOVA, 34 plats de référence, besoins selon le poids (Mifflin-St Jeor), verdict, portion, bilan du jour. Règles fixes et testées. |
| `test.js` / `test.sh` | Cas d'entraînement généraux (33 tests). |
| `docs/` | L'appli (hébergée par GitHub Pages). Profil et historique restent sur le téléphone. |
| `relais/` | Cloudflare Worker qui cache la clé API Anthropic, appelle Claude (vision) et garde les corrections d'entraînement. |

L'IA (Claude Opus 5.5) reconnaît les aliments et les quantités sur la photo ; le moteur décide du verdict.

## Entraîner l'IA

1. **Cas généraux** : ajouter des plats dans `REFERENCES` (engine.js) et des cas dans `test.js`, puis `./test.sh`.
2. **Entraîneur humain** : dans l'appli, onglet *Entraîner*, entrer le code entraîneur. Sous chaque résultat apparaît « Entraîner l'IA sur ce plat » : écrire la bonne réponse. Les corrections (200 max) sont envoyées à l'IA à chaque scan, pour tout le monde.

## Mettre en ligne

```sh
cd relais
npx wrangler login                                 # une fois
npx wrangler kv namespace create CORRECTIONS       # copier l'id dans wrangler.toml
npx wrangler secret put ANTHROPIC_API_KEY          # coller ta clé (jamais dans un fichier)
npx wrangler secret put ADMIN_TOKEN                # code entraîneur
npx wrangler deploy                                # donne l'adresse https://…workers.dev
```

Mettre cette adresse dans `docs/config.js`, puis `cp engine.js docs/` et pousser sur GitHub.

## Garde-fous de dépense

- Le relais n'accepte que des analyses de plat (prompt fixé côté serveur).
- 8 scans par minute et par IP, `MAX_SCANS_JOUR` (300) par jour pour tous.
- Fixe aussi une limite de dépense mensuelle sur console.anthropic.com → Billing → Limits.
