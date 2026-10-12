# Tasks: Remettre dans le dépôt le Worker de l'API tel qu'il tourne en production

**Input**: Design documents from `/specs/045-restore-production-worker/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: demandés (FR-013). Le code existe déjà en production : les tests sont réécrits à partir de
lui, après le report de chaque module.

**Référence** : `backups/production-2026-10-12/worker-api-en-ligne.js` (noté « la sauvegarde ») et
`backups/production-2026-10-12/worker-ecart-avec-depot.diff` (noté « l'écart »). Dans la sauvegarde,
chaque module commence par `// src/<chemin>`. Les identifiants suffixés par esbuild (`isRecord2`,
`latest2`, `notFound4`, `MAX_KAMAS2`) reprennent leur nom d'origine dans le source.

## Format: `[ID] [P?] [Story] Description`

- **[P]** : peut se faire en parallèle (fichiers différents, sans dépendance)
- **[Story]** : histoire utilisateur concernée (US1 à US5)

---

## Phase 1: Setup

**Purpose** : outils de comparaison et données.

- [ ] T001 Vérifier que `npm test` et `npx tsc -p worker/tsconfig.json` passent sur la branche avant toute modification, et noter le nombre de tests dans specs/045-restore-production-worker/quickstart.md (section Résultats).
- [ ] T002 [P] Extraire de la sauvegarde les trois fichiers de données tels quels : worker/src/equipment-items.json, worker/src/priced-extras.json, et worker/src/fm/priceable-items.json (remplacé : il gagne la clé `names`). Vérifier que chaque fichier est un JSON valide et que `generatedAt` vaut respectivement 2026-10-01, 2026-10-01 et 2026-09-30.
- [ ] T003 [P] Ajouter le script `scripts/compare-worker-bundle.sh` : construit le Worker avec `wrangler deploy --config worker/wrangler.toml --dry-run --outdir` (Node 22, research R3), retire de la sauvegarde l'enveloppe multipart, et affiche le nombre de lignes différentes puis l'écart.

---

## Phase 2: Foundational (structure de la base)

**Purpose** : la structure de production, nécessaire à tous les modules et à tous les tests.

- [ ] T004 [P] Écrire worker/migrations/0011_add_external_prices.sql : tables `external_prices` (clé primaire `(source, resource_id, server_id)`, `unit_price_kamas INTEGER NOT NULL CHECK (unit_price_kamas >= 1)`, `support`, `provisional`, `stale` et `is_item` en `INTEGER NOT NULL DEFAULT 0`, `observed_at` et `fetched_at` en `TEXT NOT NULL`), index `idx_external_prices_lookup (server_id, resource_id)`, et `external_price_sync` (clé primaire `(source, server_id)`, `run_date TEXT NOT NULL`, `cursor INTEGER NOT NULL DEFAULT 0`, `completed_at`, `last_error`, `last_error_at`), texte repris de data-model.md.
- [ ] T005 [P] Écrire worker/migrations/0012_add_fm_guild.sql : table `fm_guild` (`id TEXT PRIMARY KEY CHECK (id = 'current')`, `name TEXT NOT NULL`, `updated_at TEXT NOT NULL`).
- [ ] T006 [P] Écrire worker/migrations/0013_add_line_corrections.sql : colonnes `original_quantity INTEGER`, `original_total_kamas INTEGER`, `corrected_at TEXT` sur `fm_purchase_lines`.
- [ ] T007 [P] Écrire worker/migrations/0014_add_line_read_name_and_counted.sql : colonnes `original_item_name TEXT` et `counted INTEGER NOT NULL DEFAULT 1` sur `fm_purchase_lines`.
- [ ] T008 [P] Écrire worker/migrations/0015_add_channel_commands.sql : recrée `fm_bot_commands` avec `type IN ('open', 'close', 'create-channel', 'archive-channel', 'reopen-channel')`, en copiant les lignes, puis recrée `idx_fm_bot_commands_status` et `idx_fm_bot_commands_channel`.
- [ ] T009 Mettre worker/schema.sql à la structure de production (tables, colonnes, contraintes et index de data-model.md), puis aligner le schéma de test de tests/support/fm-worker.ts et tests/support/sqlite-d1.ts s'ils ne lisent pas worker/schema.sql.
- [ ] T010 Ajouter dans package.json les scripts `worker:db:migrate-external-prices`, `worker:db:migrate-fm-guild`, `worker:db:migrate-line-corrections`, `worker:db:migrate-line-read-name` et `worker:db:migrate-channel-commands`, sur le modèle de `worker:db:migrate-fm-channels`.
- [ ] T011 Ajouter tests/unit/worker-schema.test.ts : une base neuve créée avec worker/schema.sql a, table par table, les colonnes relevées en production (data-model.md), et le schéma d'origine suivi des migrations donne les mêmes colonnes pour les tables touchées par 0011 à 0015.

**Checkpoint** : structure de base conforme à la production.

---

## Phase 3: User Story 2 - Prix lus sur Huzounet (Priority: P1)

**Goal** : lecture planifiée, actualisation à la demande, fusion avec les prix partagés.

**Independent Test** : source Huzounet simulée ; lecture planifiée, actualisation, lecture des prix.

- [ ] T012 [P] [US2] Créer worker/src/external-price.ts depuis la sauvegarde (`// src/external-price.ts`) : `HUZOUNET_SOURCE`, `readExternalPrices`, `withExternalPrice`, typés.
- [ ] T013 [US2] Créer worker/src/huzounet.ts depuis la sauvegarde (`// src/huzounet.ts`) : constantes (`BATCH_SIZE = 50`, `REQUEST_SPACING_MS = 1000`, `DEFAULT_MAX_REQUESTS = 12`, `DISCOVERY_DAY = 1`, `MAX_KAMAS = 2e9`, `REFRESH_MAX_IDS = 90`, `REFRESH_COOLDOWN_MS` de 2 minutes, `REFRESH_MIN_INTERVAL_MS` de 5 secondes), `SERVER_IDS`, `READ_SERVERS = ['mikhal']`, `syncHuzounetPrices`, `purgeStaleExternalPrices`, `refreshHuzounetPrices`. Seul écart voulu : `USER_AGENT` cite `https://dofus-craft.handy-apps.workers.dev` (FR-004).
- [ ] T014 [P] [US2] Reporter l'écart dans worker/src/retention.ts (export de `retentionCutoff` si nécessaire) et worker/src/median.ts.
- [ ] T015 [US2] Reporter l'écart dans worker/src/latest.ts : `/latest-price` et `/item-prices` tiennent compte des prix externes (`is_item = 1` pour la liste).
- [ ] T016 [US2] Reporter l'écart dans worker/src/index.ts : fusion des prix externes dans `/community-price` et `/community-prices` (`latestFragile`), route `POST /external-prices/refresh`, et `scheduled` qui distingue `RETENTION_CRON` du passage Huzounet.
- [ ] T017 [US2] Mettre à jour worker/wrangler.toml : `HUZOUNET_SYNC = "1"` dans `[vars]` et second cron pour le passage Huzounet, commenté « fréquence à confirmer dans le tableau de bord Cloudflare avant tout déploiement » (research R5).
- [ ] T018 [P] [US2] Écrire tests/unit/external-price.test.ts : `withExternalPrice` sans prix externe, sans contribution, externe plus récent, contribution plus récente, mentions `stale` et `provisional`.
- [ ] T019 [P] [US2] Écrire tests/unit/huzounet-sync.test.ts : paquets de 50, attente entre requêtes, plafond de 12 requêtes, reprise par curseur, passage du jour déjà terminé, serveur non utilisé ignoré, découverte du lundi, prix contesté ou trop élevé retiré, prix inconnu ignoré, erreur de la source consignée.
- [ ] T020 [P] [US2] Écrire tests/unit/huzounet-refresh.test.ts : identifiants invalides, plus de 90, serveur non relu, tout déjà frais (zéro lecture), « trop tôt » sous 5 secondes, source en erreur, et la route `/external-prices/refresh` (503 désactivé, 400, 404, 429, 502, 200).
- [ ] T021 [US2] Adapter les tests existants touchés par la fusion (tests/unit/community-prices-route.test.ts, community-latest-price.test.ts, item-prices-route.test.ts, community-price-retention.test.ts) et y ajouter un cas avec prix externe.

**Checkpoint** : prix Huzounet lus, fusionnés et testés.

---

## Phase 4: User Story 3 - Séances de Forgemagie (Priority: P2)

**Goal** : séances par salon, archivage, réouverture, objet.

**Independent Test** : base de test avec salons, sessions et captures ; liste, détail, actions.

- [ ] T022 [P] [US3] Reporter l'écart dans worker/src/fm/items.ts : `parseNewItem`, `insertItemStatement`, `itemTarget`, `sessionItemStatements`, `attachSession` et `detachSession` sans refus « déjà rattaché ».
- [ ] T023 [US3] Reporter l'écart dans worker/src/fm/site-sessions.ts (nouvel objet au démarrage, objet porté par le salon) et worker/src/fm/channels.ts (nouvel objet à la demande de salon, `imageUrl` dans la vue).
- [ ] T024 [US3] Reporter l'écart dans worker/src/fm/reads.ts : `canAttach` et `canDetach`, `channelId` des sessions, filtres `counted = 1`, retrait de `listPlayers`.
- [ ] T025 [US3] Reporter l'écart dans worker/src/fm/bot-commands.ts (demandes `reopen-channel`, nom et objet du salon) et worker/src/fm/bot-events.ts (événement `channel-reopened`).
- [ ] T026 [US3] Créer worker/src/fm/seances.ts depuis la sauvegarde (`// src/fm/seances.ts`) : `MAX_SEANCES = 200`, `seancesOf`, `listSeances`, `seanceDetail`, `readSeance`, `archiveSeance`, `reopenSeance`, `setSeanceItem`, `removeSeanceItem`.
- [ ] T027 [US3] Brancher dans worker/src/fm/router.ts les routes `/fm/seances`, `/fm/seances/:id`, `/archive`, `/reopen`, `/item` (ordre et forme de la sauvegarde).
- [ ] T028 [P] [US3] Écrire tests/unit/fm-seances.test.ts : liste triée par état puis activité, détail, archivage (sessions fermées, demande au bot), réouverture (ordre des demandes, `not-archived`, `channel-limit`), choix, création, changement et retrait de l'objet, séance d'un autre joueur introuvable, demande restée sans réponse marquée `stale`.
- [ ] T029 [US3] Adapter tests/unit/fm-items.test.ts, fm-site-sessions.test.ts, fm-channels.test.ts et fm-reads.test.ts aux comportements modifiés (objet changeable, nouvel objet au démarrage).

**Checkpoint** : séances complètes et testées.

---

## Phase 5: User Story 4 - Captures : runes seules, noms rattrapés, lignes corrigées (Priority: P2)

**Goal** : comptage des runes, rattrapage des noms, correction de lignes.

**Independent Test** : capture mixte avec un nom mal lu, puis correction d'une ligne.

- [ ] T030 [P] [US4] Reporter l'écart dans worker/src/fm/item-names.ts : index sans accents, crochets parasites (`OPENING_BRACKET`, `CLOSING_BRACKET`), `recoverItem`, nom officiel renvoyé avec l'objet.
- [ ] T031 [US4] Reporter l'écart dans worker/src/fm/purchases.ts : `isRuneName`, `BOT_COUNTS_ABOVE_KAMAS = 1000`, `botUncountedKamas`, `resolveBotLine` (nom lu conservé, `counted`), insertion des colonnes `original_item_name` et `counted`.
- [ ] T032 [US4] Reporter l'écart dans worker/src/fm/bot-events.ts (dépense retenue, moins les lignes non comptées) et worker/src/fm/imports.ts (somme des seules lignes de runes, `readName: null`).
- [ ] T033 [US4] Créer worker/src/fm/captures.ts depuis la sauvegarde (`// src/fm/captures.ts`) : `parseCorrections`, `sharedPrice`, `correctCaptureLines` ; brancher `PUT /fm/captures/:id/lines` dans worker/src/fm/router.ts.
- [ ] T034 [P] [US4] Écrire tests/unit/fm-captures.test.ts : correction (valeurs d'origine gardées, dépense ajustée, prix partagé mis à jour ou retiré s'il devient aberrant), retour aux valeurs d'origine, ligne d'une autre capture refusée, quantité ou total inférieur à 1 refusé, ligne en double refusée.
- [ ] T035 [US4] Compléter tests/unit/fm-purchases.test.ts, fm-bot-events.test.ts et fm-imports.test.ts : runes seules comptées, seuil de 1 000 kamas, nom sans accent, crochet parasite, rattrapage ambigu laissé inconnu.

**Checkpoint** : montants des captures conformes à la production.

---

## Phase 6: User Story 5 - Joueurs, serveur Discord et connexion en local (Priority: P3)

**Goal** : liste des joueurs, nom du serveur Discord, retour local.

**Independent Test** : liste avec un joueur public et un privé ; profil ; connexion avec `return_to`.

- [ ] T036 [P] [US5] Créer worker/src/fm/players.ts depuis la sauvegarde (`// src/fm/players.ts`) et pointer worker/src/fm/router.ts dessus.
- [ ] T037 [P] [US5] Reporter l'écart dans worker/src/fm/auth.ts (portée `guilds`, `localSiteOrigin`, `return_to` porté par l'état, `readGuildName`, écriture de `fm_guild`) et worker/src/fm/me.ts (`guildName`).
- [ ] T038 [P] [US5] Écrire tests/unit/fm-players.test.ts : joueurs publics et soi-même, seuls ceux ayant une activité, tri par total puis par nom, séances résumées.
- [ ] T039 [US5] Compléter tests/unit/fm-auth.test.ts et fm-me.test.ts : retour vers `http://localhost` et `http://127.0.0.1`, adresse non locale ignorée, nom du serveur Discord enregistré puis lu, échec de lecture du nom sans effet sur la connexion.

**Checkpoint** : toutes les routes de la production existent dans le dépôt.

---

## Phase 7: User Story 1 - Déployer l'API depuis le dépôt sans rien retirer (Priority: P1)

**Goal** : prouver l'identité avec la production. Dernière phase, car elle exige que tout soit reporté.

**Independent Test** : comparaison ligne à ligne du Worker construit et de la sauvegarde.

- [ ] T040 [US1] Lancer scripts/compare-worker-bundle.sh et corriger worker/src jusqu'à ce que les seules lignes différentes soient `USER_AGENT` (FR-002, FR-004) ; relire chaque écart restant un par un.
- [ ] T041 [US1] Vérifier que chaque route appelée par le site en ligne (`backups/production-2026-10-12/site-index-original.js` : chemins sous l'adresse de l'API) existe dans le Worker construit (SC-002), et consigner la liste dans specs/045-restore-production-worker/quickstart.md.
- [ ] T042 [US1] Lancer `npm test`, `npx tsc -p worker/tsconfig.json` et `npm run lint` ; corriger jusqu'au vert.

---

## Phase 8: Polish

- [ ] T043 [P] Mettre à jour worker/README.md : lecture Huzounet, variable `HUZOUNET_SYNC`, nouvelles migrations, script de comparaison.
- [ ] T044 Remplir la section Résultats de specs/045-restore-production-worker/quickstart.md : nombre de tests, résultat de la comparaison, structure de base, et rappel de la fréquence du passage planifié à confirmer avant déploiement.

---

## Dependencies & Execution Order

- Phase 1 puis Phase 2, qui bloque toutes les histoires.
- US2 (Phase 3) est indépendante des histoires Forgemagie.
- US3 (Phase 4) avant US4 (Phase 5) : `captures.ts` répond par le détail de la séance, et `seances.ts` lit les colonnes de correction.
- US5 (Phase 6) dépend de US3 : `players.ts` utilise `seancesOf`.
- US1 (Phase 7) vient en dernier : la comparaison n'est concluante que tout reporté.
- T025 et T032 touchent tous deux worker/src/fm/bot-events.ts : à faire l'un après l'autre.
- T027, T033 et T036 touchent tous trois worker/src/fm/router.ts : à faire l'un après l'autre.

## Parallel Example

Après la Phase 2 : T012, T014 et les tests T018 à T020 n'ont pas de fichier en commun ; de même T022,
T030 et T037.

## Implementation Strategy

Pas de livraison partielle : le Worker n'est déployable qu'une fois la Phase 7 validée (voir
Complexity Tracking du plan). L'ordre suit les dépendances du code, et la comparaison de bundles
(T003) sert de mesure d'avancement à chaque phase : 1 253 lignes différentes au départ, une seule visée.
