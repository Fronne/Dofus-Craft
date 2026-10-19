# Tasks : prix par taille de lot

## Phase 1 — Données
- [x] T001 `worker/migrations/0020_add_lot_prices.sql` + `worker/schema.sql` + script `worker:db:migrate-lot-prices` (package.json)

## Phase 2 — Worker (H1)
- [x] T002 `worker/src/lot-prices.ts` : écriture (upsert/suppression) et lecture
- [x] T003 Brancher dans `sniffer.ts` (batch, rows_written, plafond) et `index.ts` (route GET)
- [x] T004 [P] Tests : `sniffer-routes.test.ts` (étendu), `community-lot-prices.test.ts`

## Phase 3 — Domaine (H2)
- [x] T005 `src/domain/lot-price.ts` : `pickLotPrice` + `lot-price.test.ts`
- [x] T006 `pet-xp.ts` : prix par lot dans `planPetFood` / `petFoodTarget` + `pet-xp.test.ts`

## Phase 4 — Front
- [x] T007 `getCommunityLotPrices` (service) + `usePetFoodPrices`
- [x] T008 Affichage « lot ×N » (FamilierPage, PetFoodPodium, PetFoodTarget)

## Phase 5 — Fin
- [x] T009 `npm test`, typecheck, lint ; sous-agent `relecteur` ; corrections
