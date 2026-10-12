# Quickstart : vérifier la restauration

Prérequis : Node 22 pour wrangler (`export PATH="/c/Users/Cyril/AppData/Roaming/nvm/v22.23.3:$PATH"`),
et la sauvegarde `backups/production-2026-10-12/`.

## 1. Tests

`npm test` : tous les tests passent, y compris ceux ajoutés pour les prix externes, les séances, les
captures et les joueurs.

## 2. Types

`npx tsc -p worker/tsconfig.json` : aucune erreur.

## 3. Identité avec la production

```bash
npx wrangler deploy --config worker/wrangler.toml --dry-run --outdir "$TEMP/dc-restore"
diff "$TEMP/dc-restore/index.js" backups/production-2026-10-12/worker-api-en-ligne.js
```

Attendu : seules différences, la ligne `USER_AGENT` (adresse `handy-apps`) et l'enveloppe multipart en
début et fin de la sauvegarde. Référence avant restauration : 1 253 lignes différentes.

## 4. Structure de la base

Créer une base SQLite neuve avec `worker/schema.sql`, une autre avec le schéma d'origine suivi des
migrations 0001 à 0015, et comparer leurs tables et colonnes à celles de la production
([data-model.md](./data-model.md)).

## 5. Avant tout déploiement (hors de cette fonctionnalité)

Relever la fréquence du passage planifié dans le tableau de bord Cloudflare et la confirmer dans
`worker/wrangler.toml` (research R5).

## Résultats

À remplir à la fin de l'implémentation.
