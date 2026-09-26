---

description: "Task list for 019-craft-profit-list"
---

# Tasks: Page Prix — bénéfice de craft par objet

**Input**: Design documents from `/specs/019-craft-profit-list/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests** : inclus (constitution, principe II : règles de calcul testées ; contrats avec tests
obligatoires).

**Organization** : tâches groupées par user story (spec.md : US1 P1, US2 P1, US3 P2).

## Format: `[ID] [P?] [Story] Description`

## Path Conventions

Application `src/`, Worker `worker/src/`, tests `tests/`.

---

## Phase 1: Setup

Aucune tâche : aucune dépendance, aucune migration.

---

## Phase 2: Foundational (route `/item-prices` et domaine)

- [X] T001 [P] Écrire `tests/unit/item-prices-route.test.ts` (via `createTestD1` de
  `tests/support/sqlite-d1`) : deux contributions `kind = 'item'` d'un objet → seule la plus récente
  (`amountKamas`, `contributedAt`) ; deux objets → deux entrées ; lignes `kind = 'resource'` et autre
  serveur ignorés ; 400 `{ error: 'serverId is required' }` sans `serverId` ; 200 `{ items: [] }` sans
  données ; aucune clé contenant « device » dans le corps.
- [X] T002 [P] Écrire `tests/unit/item-prices-api.test.ts` : `getSharedItemPrices('mikhal')` appelle
  `/item-prices?serverId=mikhal` ; corps valide → `{ status: 'found', items }` ; 500, réseau coupé,
  JSON invalide, élément sans `amountKamas` numérique ou sans `itemId` / `contributedAt` chaîne →
  `{ status: 'unavailable' }` sans exception.
- [X] T003 [P] Écrire `tests/unit/craft-profit.test.ts` pour `src/domain/craft-profit.ts` :
  `profitRow` → `profitKamas = marketPriceKamas − craftCostKamas`, `marginPercent =
  round(profitKamas / craftCostKamas × 100)` et absent si coût = 0 ; `undefined` si le coût est
  partiel ou le prix HDV absent ; `sortProfitRows(rows, 'kamas' | 'percent')` décroissant, égalité
  départagée par nom (fr), marge absente en fin pour `'percent'` ; `filterProfitRows(rows, query)`
  insensible aux accents et à la casse.
- [X] T004 Dans `worker/src/latest.ts`, ajouter `readLatestItemPrices(db, serverId)` (une requête :
  pour chaque `resource_id` avec `kind = 'item'` et `server_id = ?`, la ligne de `created_at` maximal)
  et `itemPricesResponse(db, url)` selon contracts/item-prices-api.md ; brancher `GET /item-prices`
  dans `worker/src/index.ts` à côté de `/latest-price` (lecture anonyme). Étendre le type `LatestDb`
  avec `all<T>()` si besoin.
- [X] T005 [P] Dans `src/services/community-price-api.ts`, ajouter `getSharedItemPrices(serverId)`
  qui renvoie `{ status: 'found'; items: { itemId: string; amountKamas: number; contributedAt: string }[] }
  | { status: 'unavailable' }` et ne lève jamais.
- [X] T006 [P] Créer `src/domain/craft-profit.ts` : type `CraftProfitRow` (data-model.md : `item`,
  `marketPriceKamas`, `marketPriceDate`, `craftCostKamas`, `profitKamas`, `marginPercent?`),
  `profitRow(item, comparison, marketPriceDate)` à partir du `Comparison` de `compare()` (ligne
  seulement si `craftCostStatus === 'complete'` et `marketPriceKamas` défini), `sortProfitRows`,
  `filterProfitRows` (avec `normalizeSearchText`).

**Checkpoint** : T001–T003 passent.

---

## Phase 3: User Story 1 - Voir les objets rentables à crafter (Priority: P1) 🎯 MVP

**Goal** : la page Prix liste les objets calculables avec prix HDV (et date), coût, bénéfice, marge.

**Independent Test** : trois objets calculables (+5 000, −2 000, +12 000) et un non calculable →
trois lignes dans l'ordre +12 000, +5 000, −2 000.

- [X] T007 [US1] Créer `src/features/prices/useCraftProfits.ts` : `useCraftProfits(serverId,
  priceMode)` → `{ rows, pending, total, status: 'loading' | 'ready' | 'unavailable' }`.
  Candidats : Mode personnel `pinnedItemPrices.listAllForServer(serverId)` (`marketPriceKamas`,
  `updatedAt`) ; Mode communautaire `getSharedItemPrices(serverId)` (`unavailable` → état
  `unavailable`). Pour chaque candidat (6 à la fois) : `getItemDetail(id)` ; ignorer sans recette ;
  `loadRecipeTree` ; puis prix des ressources via `resourcePricesFor(priceMode).getMany(serverId, ids)`
  (même lecture que `EpinglesPage.tsx`) et, en Mode communautaire, `fillCommunityGaps` sur
  `treeResourceIds`. Calcul : `compare(recipe, effectiveIngredientPrices(recipe, tree, prices, {}),
  marketPrice)` puis `profitRow`. Mettre à jour `rows` au fil de l'eau ; annuler au changement de
  serveur ou de mode (FR-010).
- [X] T008 [US1] Réécrire `src/features/prices/PricesPage.tsx` selon contracts/prices-page-ui.md :
  en-tête, lignes (visuel, nom, « Prix HDV » + date (`formatRelativeTime` et classes `market-date` de `classifyPriceAge`, comme `MarketPriceInput`), « Coût de craft »,
  bénéfice signé en kamas et marge « +15 % » avec classes positive / négative / neutre), ligne
  cliquable vers `${ROUTES.search}?item=<id>`, états sans serveur, « Calcul en cours… (n / total) »,
  aucun objet calculable (lien vers Recherche), panne des prix partagés. Tri par défaut `'kamas'`.
  Supprimer les anciennes listes objets / ressources.
- [X] T009 [P] [US1] Styles de la page dans `src/styles/` (`src/styles/global.css`) : grille des montants, couleurs bénéfice positif / négatif / neutre, passage des
  montants sous le nom sous 480 px, sans défilement horizontal (FR-011).
- [X] T010 [US1] Créer `tests/integration/prices-page.test.tsx` (mocks comme
  `tests/integration/epingles-community-prices.test.tsx`) : ordre par bénéfice, objet sans prix de
  ressource absent, bénéfice négatif marqué, date du prix HDV affichée, clic → page Recherche sur
  l'objet, état vide, panne `/item-prices`.

**Checkpoint** : US1 utilisable seule.

---

## Phase 4: User Story 2 - Même calcul que la page Recherche (Priority: P1)

**Goal** : coût et bénéfice identiques à Recherche en « Auto », dans les deux modes.

**Independent Test** : objet dont un ingrédient craftable est moins cher à crafter → même coût que
Recherche en « Auto ».

- [X] T011 [US2] Ajouter à `tests/integration/prices-page.test.tsx` : ingrédient craftable moins cher
  à crafter compté à son coût de craft ; plus cher → prix d'achat ; sans prix d'achat mais craft
  calculable → objet listé ; un choix « Acheter » forcé enregistré (`ingredient-choices`) n'a aucun
  effet ; Mode personnel lit le carnet local et les prix HDV saisis, Mode communautaire les prix
  partagés ; changement de mode → recalcul.
- [X] T012 [US2] Corriger `useCraftProfits.ts` si un cas de T011 échoue (aucun autre fichier de
  calcul ne doit être modifié : `craft-tree.ts` et `craft-comparison.ts` restent la seule source).

**Checkpoint** : SC-001 vérifié par les tests.

---

## Phase 5: User Story 3 - Retrouver un objet dans la liste (Priority: P2)

**Goal** : filtre par nom, tri kamas / %, limite de lignes, total visible.

- [X] T013 [US3] Dans `PricesPage.tsx` : champ « Rechercher un objet » (`filterProfitRows`),
  sélecteur « Trier par » « Bénéfice (kamas) » / « Marge (%) » (`sortProfitRows`), limite 10 / 25 /
  50 / 100, « <n> objets » (total après filtre).
- [X] T014 [US3] Ajouter à `tests/integration/prices-page.test.tsx` : filtre « amul » sans accents
  ni casse, tri par marge, limite de lignes et total.

---

## Phase 6: Polish

- [X] T015 [P] Adapter ou créer `tests/e2e/prices-page.spec.ts` (Worker simulé comme
  `tests/e2e/price-history.spec.ts`) : la page liste un objet en moins de 3 s (SC-004), tri par
  marge, pas de défilement horizontal à 375 px.
- [X] T016 [P] Mettre à jour `worker/README.md` (route `/item-prices`) et `README.md` (description de
  la page Prix).
- [X] T017 Lancer `npm run typecheck`, `npm run lint`, `npx vitest run`, l'e2e de la page ; dérouler
  quickstart.md.

---

## Dependencies & Execution Order

- Phase 2 : T001–T003 en parallèle, puis T004 (après T001), T005 (après T002), T006 (après T003).
- US1 : T007 après T005–T006 ; T008 après T007 ; T009 en parallèle de T008 ; T010 après T008.
- US2 : après US1 (même page et même hook).
- US3 : après T008 ; indépendante d'US2.
- Polish en dernier.

## Parallel Example

```text
T001 tests route | T002 tests client | T003 tests domaine
puis T004 (Worker) | T005 (client) | T006 (domaine)
```

## Implementation Strategy

MVP = Phase 2 + US1 (liste triée par bénéfice). US2 verrouille l'égalité avec Recherche, US3 ajoute
filtre et tri. Déployer le Worker avant le site (la page appelle `/item-prices`).
