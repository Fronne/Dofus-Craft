# Tasks : envoi des prix HDV par les amis — côté API

**Input** : `specs/056-sniffer-batch-prices/` (plan.md, spec.md, research.md, data-model.md,
contracts/sniffer-api.md, quickstart.md). Tests demandés explicitement (table de `unitPrice`, tests
des routes).

## Phase 1 : Setup

- [ ] T001 Créer `worker/migrations/0018_add_sniffer_tables.sql` : `sniffer_keys` (id TEXT PK, label, key_hash TEXT NOT NULL UNIQUE, created_at, revoked_at NULL, last_seen_at NULL), `sniffer_mappings` (id INTEGER PK AUTOINCREMENT, build, keymap_json, schema_json, uploaded_at, active INTEGER 0/1, index unique partiel `(build) WHERE active = 1`), `sniffer_daily_usage` (key_id, day `YYYY-MM-DD`, rows_written ≥ 0, PK `(key_id, day)`)
- [ ] T002 Créer `worker/migrations/0019_add_sniffer_origin.sql` : reconstruction de `community_price_contributions` avec `CHECK (origin IN ('manual', 'capture', 'bot', 'sniffer'))`, sur le modèle de 0017, index `idx_community_price_contributions_lookup` recréé, rejouable
- [ ] T003 Mettre `worker/schema.sql` à jour (trois tables, CHECK `origin` élargi)
- [ ] T004 [P] Ajouter `worker:db:migrate-sniffer-tables` et `worker:db:migrate-sniffer-origin` à `package.json`
- [ ] T005 [P] Ajouter `SNIFFER_MIN_VERSION` et `SNIFFER_DOWNLOAD_URL` à `[vars]` de `worker/wrangler.toml`

## Phase 2 : Fondations

- [ ] T006 [P] Créer `worker/src/servers.ts` (les 13 serveurs et leurs ids Huzounet, liste `SERVERS`, `isKnownServer`) et faire importer `huzounet.ts` depuis ce module, sans changer son comportement
- [ ] T007 [P] Créer `worker/src/resource-catalogue.ts` (`RESOURCE_IDS` sorti de `huzounet.ts`, `isKnownResource`) et faire importer `huzounet.ts` depuis ce module
- [ ] T008 Ajouter `'sniffer'` à `PriceOrigin` dans `worker/src/median.ts` ; dans `worker/src/contribution.ts`, extraire l'instruction d'insertion (`contributionInsert(db, contribution, reference)`) réutilisée par `insertContribution`

## Phase 3 : US2 — prix unitaire (P1)

- [ ] T009 [US2] Écrire `tests/unit/sniffer-unit-price.test.ts` : table couvrant un lot, aucun lot, deux lots proches, deux lots en désaccord avec / sans médiane, trois-quatre lots avec un aberrant (« x1 aberrant, x10 et x100 proches »), « tous les lots ont doublé », descente sous le seuil de 20 %, tout écarté
- [ ] T010 [US2] Implémenter `unitPrice(lots, communityMedian?)` dans `worker/src/unit-price.ts`, constantes nommées `LADDER_OUTLIER_FACTOR = 3` et `BIGGER_LOT_MAX_PREMIUM = 0.2`

## Phase 4 : US1 — envoi d'un lot (P1)

- [ ] T011 [US1] Écrire `tests/unit/sniffer-routes.test.ts` (D1 simulée sur `worker/schema.sql`) : lot accepté (origine, kind, device_id, médiane et écart remplis), `not_an_ingredient`, `no_price`, `invalid`, écart énorme accepté, 401 clé inconnue / révoquée, 400 serveur inconnu, formulaire manuel inchangé
- [ ] T012 [US1] Implémenter dans `worker/src/sniffer.ts` : authentification (SHA-256 de la clé, `revoked_at IS NULL`, `last_seen_at`), validation du corps et des observations, médianes par `fetchCurrentMedians`, insertions et compteur en un `db.batch`
- [ ] T013 [US1] Router `POST /community-price/batch` dans `worker/src/index.ts` avant le contrôle de la clé publique ; vider le cache de lecture après écriture

## Phase 5 : US3 — configuration (P2)

- [ ] T014 [US3] Tests de `GET /sniffer/config` dans `tests/unit/sniffer-routes.test.ts` : mapping actif, `null`, 401, `build` manquant, valeurs des variables
- [ ] T015 [US3] Implémenter la configuration dans `worker/src/sniffer.ts` et la router dans `worker/src/index.ts`

## Phase 6 : US4 — garde-fous (P2)

- [ ] T016 [US4] Tests 426 (version absente, illisible, inférieure), 409 (mapping inactif, aucun actif), 429 (plafond, rien d'écrit), 400 lot trop gros, dans `tests/unit/sniffer-routes.test.ts`
- [ ] T017 [US4] Implémenter comparaison de versions, contrôle du mapping et plafond journalier dans `worker/src/sniffer.ts`

## Phase 7 : Finitions

- [ ] T018 Appliquer 0018 et 0019 sur une base D1 LOCALE au schéma de `master` (`--local` seulement) et vérifier le CHECK et les lignes copiées
- [ ] T019 `npm test`, `npm run typecheck`, `npm run lint` verts
- [ ] T020 Documenter les routes dans `worker/README.md`

## Dépendances

Phase 1 → Phase 2 → US2 → US1 → US3 / US4. US3 et US4 touchent les mêmes fichiers que US1 : en
séquence. MVP : US2 + US1.
