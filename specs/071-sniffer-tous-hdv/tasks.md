# Tasks : prix de tous les HDV envoyés par l'outil des amis

**Input** : `specs/071-sniffer-tous-hdv/` (spec.md, plan.md).

## Phase 1 : Setup

- [x] T001 Créer `scripts/build-item-types.mjs` et générer `worker/src/item-types.json` (typeId → nature, natures de plan.md R1, source et date)
- [x] T002 Créer `worker/migrations/0022_add_contribution_item_type.sql` : `ALTER TABLE community_price_contributions ADD COLUMN item_type TEXT CHECK (item_type IN ('equipment','resource','rune','consumable'))`
- [x] T003 [P] Mettre `worker/schema.sql` à jour, ajouter `worker:db:migrate-item-type` à `package.json`

## Phase 2 : Fondations

- [x] T004 [P] `worker/src/item-types.ts` : `itemTypeOf(category)` → nature ou undefined
- [x] T005 `worker/src/contribution.ts` : `Contribution.itemType?` écrit dans l'INSERT (NULL par défaut)
- [x] T006 `worker/src/latest.ts` : `readLatestItemContributions(db, ids, serverId)` (dernier prix `kind = 'item'` par id)

## Phase 3 : US1 + US2 + US3 — envoi par catégorie (P1)

- [x] T007 [US1] Tests dans `tests/unit/sniffer-routes.test.ts` : équipement (kind item, lot 1, référence, sans prix par lot, hors catalogue accepté, autres lots `invalid`)
- [x] T008 [US2] Tests : rune, consommable hors catalogue, ressource étiquetés ; `unknown_category` ; catégorie mal formée `invalid`
- [x] T009 [US3] Tests : observation sans catégorie inchangée (`item_type` NULL), lot mélangé
- [x] T010 Implémenter dans `worker/src/sniffer.ts` : `parseObservation` par catégorie, insertions équipement / ressource, plafond inchangé
- [x] T011 [P] Tests de `itemTypeOf` dans `tests/unit/sniffer-item-types.test.ts` (exemples de l'outil : 107, 78, 9, 40)

## Phase 4 : Finitions

- [x] T012 Mettre `specs/056-sniffer-batch-prices/contracts/sniffer-api.md` à jour
- [x] T013 `tests/unit/worker-schema.test.ts` : la migration mène à la colonne du schéma
- [ ] T014 Appliquer 0022 sur une base D1 locale (`--local` seulement)
- [ ] T015 `npm test`, typecheck, lint ; relecteur
