# Research: Remettre dans le dépôt le Worker de l'API en production

## R1 — Référence de la restauration

- **Decision**: la référence est `backups/production-2026-10-12/worker-api-en-ligne.js`, téléchargé le
  12 octobre 2026 depuis Cloudflare (Worker `dofus-craft-community-price-api`, déployé le 2 octobre).
- **Rationale**: c'est le code qui s'exécute. Il n'est pas minifié, garde les commentaires d'origine et
  marque chaque fichier source par `// src/<chemin>`.
- **Alternatives considered**: la session distante d'origine (supprimée) ; l'historique GitHub (aucun
  envoi après le 1er octobre, aucune branche supprimée ni écrasée) ; le poste local (dépôt cloné le
  7 octobre, rien dans la corbeille ni sur les disques).

## R2 — Méthode de report

- **Decision**: pour chaque module, partir du fichier TypeScript du dépôt quand il existe et y reporter
  l'écart (`backups/production-2026-10-12/worker-ecart-avec-depot.diff`) ; pour les cinq modules
  nouveaux, réécrire le TypeScript à partir du JavaScript en ajoutant types, imports et exports selon
  les conventions du dépôt.
- **Rationale**: on garde les types et commentaires existants, et l'écart reste relisible.
- **Alternatives considered**: remplacer `worker/src` par le bundle tel quel (perd les types, les tests
  et la séparation en fichiers) ; conversion automatique (les identifiants renommés par esbuild,
  comme `isRecord2`, `latest2` ou `notFound4`, et les enveloppes `__name` demandent de toute façon une
  relecture).

## R3 — Preuve d'identité

- **Decision**: construire avec `wrangler deploy --config worker/wrangler.toml --dry-run --outdir <dossier>`
  (Node 22) et comparer `index.js` à la sauvegarde. Écarts admis : l'adresse du site dans `USER_AGENT`
  (FR-004) et l'enveloppe multipart en début et fin de sauvegarde. Le résultat est consigné dans
  `quickstart.md`.
- **Rationale**: même outil et même version que le déploiement d'origine (wrangler 4.132) ; avant
  restauration, la comparaison donne 1 253 lignes différentes, ce qui mesure l'avancement.
- **Alternatives considered**: comparer seulement par tests (ne prouve pas l'absence d'oubli).

## R4 — Structure de la base

- **Decision**: structure lue en lecture seule dans `sqlite_master` de la base de production. Écarts avec
  le dépôt : tables `external_prices` (avec l'index `idx_external_prices_lookup`), `external_price_sync`
  et `fm_guild` ; colonnes `original_quantity`, `original_total_kamas`, `corrected_at`,
  `original_item_name` et `counted` sur `fm_purchase_lines` ; types `archive-channel` et
  `reopen-channel` admis par `fm_bot_commands.type`. Cinq migrations (0011 à 0015) regroupées par
  sujet, et `worker/schema.sql` mis à jour pour donner la même structure sur une base neuve.
- **Rationale**: les migrations d'origine sont perdues ; seul leur résultat est connu.
- **Alternatives considered**: une migration unique (moins lisible ; le découpage par sujet suit celui
  des migrations existantes). La production étant déjà migrée, ces fichiers ne sont jamais à exécuter
  sur elle : ils servent aux bases neuves et aux tests.

## R5 — Configuration absente du code

- **Decision**: `HUZOUNET_SYNC = "1"` dans `[vars]`. Vérifié le 12 octobre : la route
  `/external-prices/refresh` en production répond 400 à un corps invalide, et non 503.
  La fréquence du passage planifié n'est pas lisible dans le code : il distingue le cron de purge
  (`0 3 * * MON`) de tout autre déclenchement. La valeur exacte est à relever dans le tableau de bord
  Cloudflare (Worker, Settings, Trigger Events) avant tout déploiement.
  Relevé le 12 octobre : le tableau de bord affiche « Every 5 minutes, between 02:00 AM and … » (texte
  coupé), et la base de production le confirme — les prix y sont écrits à 02:00, 02:05, 02:10… UTC, la
  lecture du lundi 12 (jour de découverte, la plus longue) s'étant terminée à 02:50. `wrangler.toml`
  porte donc `*/5 2-4 * * *` : le début et le pas sont vérifiés, l'heure de fin (4) ne l'est pas. Elle
  est sans effet sur Huzounet : une lecture du jour terminée n'est pas recommencée.
- **Rationale**: déployer avec une fréquence différente changerait le nombre de lectures faites chez
  Huzounet, ce que l'autorisation de son auteur encadre.
- **Alternatives considered**: déduire la fréquence de `external_price_sync` (une ligne par serveur et
  par jour : ne donne pas l'intervalle) ; c'est `external_prices.fetched_at` qui la donne. La fenêtre
  de modification du tableau de bord, elle, affiche une valeur par défaut (`*/30 * * * *`) et non le
  déclencheur en place.

## R6 — Fichiers de données

- **Decision**: `equipment-items.json`, `priced-extras.json` et `fm/priceable-items.json` (qui gagne une
  clé `names`) sont extraits tels quels de la sauvegarde. Leurs scripts de génération sont perdus et ne
  sont pas réécrits ici.
- **Rationale**: ce sont des données, identiques à ce qui tourne.
- **Alternatives considered**: réécrire les générateurs (hors périmètre ; à faire quand une liste devra
  être rafraîchie).

## R7 — Tests

- **Decision**: tests réécrits à partir du comportement lu dans le code, dans le style des tests
  existants (`worker.fetch`, base simulée, source Huzounet simulée par les options `fetch`, `now` et
  `wait` que le code accepte déjà).
- **Rationale**: FR-013 ; les tests d'origine sont perdus.
- **Alternatives considered**: s'en tenir à la comparaison de bundles (ne protège pas les évolutions
  futures).
