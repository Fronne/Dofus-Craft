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

Relevés le 2026-10-12, sous Node 22.

- **Tests** (`npm test`) : 956 réussis, 1 échec. L'échec (`tests/integration/hdv-page.test.tsx`, « shows the
  latest shared price over an older kept one ») existait avant la fonctionnalité et concerne le site, hors
  périmètre (FR-016). Avant : 893 réussis, le même échec. 63 tests ajoutés, dans 7 nouveaux fichiers
  (`worker-schema`, `external-price`, `huzounet-sync`, `huzounet-refresh-route`, `fm-seances`,
  `fm-captures`, `fm-players`) et dans les fichiers existants adaptés.
- **Types** (`npx tsc -p worker/tsconfig.json`) : aucune erreur.
- **Lint** (`npm run lint`) : aucune erreur dans `worker/` ni dans `tests/` ; les 3 erreurs restantes sont
  dans `scripts/seed-carnet-mikhal.js`, antérieures. Le dossier `backups/` est désormais ignoré.
- **Identité avec la production** (`bash scripts/compare-worker-bundle.sh`) : 1 253 lignes différentes au
  départ, 4 à la fin — la ligne `USER_AGENT` (adresse `handy-apps`, voulue) et le commentaire de carte
  des sources ajouté par l'outil de construction.
- **Routes appelées par le site en ligne** (SC-002), toutes présentes dans le Worker : `/community-price`,
  `/community-prices`, `/latest-price`, `/item-prices`, `/price-history`, `/info-message`,
  `/player-counters`, `/visit`, `/external-prices/refresh`, `/fm/auth/login`, `/fm/auth/logout`, `/fm/me`,
  `/fm/players`, `/fm/players/:id`, `/fm/seances`, `/fm/seances/:id` (et `/archive`, `/reopen`, `/item`),
  `/fm/captures/:id/lines`, `/fm/channels`, `/fm/channel-requests/:id`, `/fm/sessions`,
  `/fm/sessions/:id`, `/fm/items/:id`, `/fm/imports`.
- **Structure de la base** : `tests/unit/worker-schema.test.ts` vérifie les tables et colonnes de
  `worker/schema.sql` et que les migrations 0007 à 0015 mènent aux mêmes tables Forgemagie et de prix
  externes.
- **Reste à faire avant tout déploiement du Worker** : la fréquence du passage planifié. Relevé partiel
  dans le tableau de bord : « toutes les 5 minutes, entre 02:00 et … » (UTC) ; l'heure de fin manque, et
  `worker/wrangler.toml` porte encore une valeur provisoire (`*/30 * * * *`).
