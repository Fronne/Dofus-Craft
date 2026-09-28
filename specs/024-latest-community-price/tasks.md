---

description: "Task list for 024-latest-community-price"
---

# Tasks: Dernier prix partagé pour les ressources

**Input**: Design documents from `specs/024-latest-community-price/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/community-price-api.md](contracts/community-price-api.md)

**Tests**: inclus. La constitution (principe II) impose des tests automatisés pour tout changement
d'une règle de calcul ; la règle de choix du prix et le dernier prix du Worker en sont.

**Organization**: une phase par user story de la spec (US1 à US4), après une base commune.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallélisable (fichiers différents, pas de dépendance sur une tâche non terminée)
- **[Story]**: user story de la spec (US1, US2, US3, US4)

## Path Conventions

Site dans `src/`, Worker dans `worker/src/`, tests dans `tests/unit/` et `tests/integration/`
(Vitest) et `tests/e2e/` (Playwright), à la racine du dépôt.

---

## Phase 1: Setup

Aucune tâche : ni dépendance, ni configuration, ni table nouvelle (plan.md, data-model.md).

---

## Phase 2: Foundational (bloquant pour toutes les stories)

**Purpose**: le Worker renvoie le dernier prix, le site le lit, et la règle de choix existe.

- [ ] T001 [P] Ajouter à `summarizeContributions` (worker/src/median.ts) le dernier prix : `latestAmountKamas` et `latestContributionAt` = montant et `createdAt` de la ligne au `createdAt` le plus grand parmi **toutes** les lignes reçues (avant `latestPerDevice` et sans filtre des valeurs aberrantes) ; en cas d'égalité de `createdAt`, la dernière ligne du tableau l'emporte, et les requêtes de `fetchCurrentMedian` et `fetchCurrentMedians` (worker/src/contribution.ts) ajoutent `ORDER BY created_at, rowid` pour que cette dernière ligne soit la dernière enregistrée (spec, cas limite « deux relevés à la même seconde »). `medianAmountKamas`, `sampleSize` et `lastContributionAt` gardent exactement leur calcul actuel. Mettre à jour le type de retour de `fetchCurrentMedian` et `fetchCurrentMedians` (worker/src/contribution.ts) en conséquence.
- [ ] T002 [P] Tests du dernier prix dans tests/unit/community-price-summary.test.ts : 100, 200 puis 150 (du plus ancien au plus récent) → `latestAmountKamas` 150 et sa date ; dernier prix aberrant (exclu de la médiane) → reste le dernier prix ; deux lignes du même appareil → la plus récente ; égalité de date → la dernière du tableau ; médiane inchangée par rapport aux tests existants.
- [ ] T003 Ajouter `latestAmountKamas` et `latestContributionAt` à la réponse de `GET /community-price` construite dans `communityPriceResponse` (worker/src/index.ts) et à chaque entrée de `communityPricesResponse` (worker/src/contribution.ts), conformément à [contracts/community-price-api.md](contracts/community-price-api.md) ; `insertContribution` continue d'enregistrer `median_at_submission_kamas` et `deviation_percent` à partir de la médiane (FR-008, aucune modification de ce calcul).
- [ ] T004 [P] Tests de route dans tests/unit/community-prices-route.test.ts : chaque entrée de `/community-prices` contient `latestAmountKamas` et `latestContributionAt`, identiques à ceux de `/community-price` pour la même ressource ; une contribution de ressource enregistrée a toujours `median_at_submission_kamas` / `deviation_percent` (tests/unit/community-latest-price.test.ts, où `insertContribution` est testée).
- [ ] T005 [P] Compléter le type `CommunityPrice` dans src/domain/types.ts avec `latestAmountKamas: number` et `latestContributionAt: string` (obligatoires), et exiger ces deux champs dans `isCommunityPriceRow` (src/services/community-price-api.ts) ; une réponse sans eux est traitée comme `unavailable`, jamais convertie depuis la médiane.
- [ ] T006 [P] Tests du parsing dans tests/unit/community-price-api.test.ts : réponse avec les champs → `found` avec ces valeurs ; réponse sans eux → `unavailable`, pour `getCommunityPrice` et `getCommunityPrices`.
- [ ] T007 [P] Créer la règle pure `pickCommunityPrice(carnetEntry?: ResourcePrice, latest?: { amountKamas: number; contributedAt: string })` dans src/domain/community-price-choice.ts, qui renvoie `{ price: { unitPriceKamas, updatedAt } | undefined; replacesCarnet: boolean }` selon le tableau de data-model.md : pas de dernier prix → prix gardé (ou rien), `replacesCarnet: false` ; pas de prix gardé, ou `carnetEntry.updatedAt < latest.contributedAt` → dernier prix avec `updatedAt = latest.contributedAt`, `replacesCarnet: true` ; sinon → prix gardé, `replacesCarnet: false`.
- [ ] T008 [P] Tests de la règle dans tests/unit/community-price-choice.test.ts : les cinq lignes du tableau de data-model.md, plus l'égalité exacte de dates (le prix gardé l'emporte).
- [ ] T009 Accepter une date optionnelle à l'enregistrement : `save(serverId, id, price, updatedAt?)` dans src/persistence/resource-price-repository.ts, src/persistence/server-scoped-price-store.ts (`updatedAt: updatedAt ?? new Date().toISOString()`), src/persistence/indexeddb-community-mode-price-repository.ts et src/persistence/indexeddb-resource-price-repository.ts ; et `save(id, value, updatedAt?)` dans src/features/comparison/useResourcePrices.ts.
- [ ] T010 [P] Test dans tests/unit/community-mode-price-repository.test.ts : un prix enregistré avec une date la garde telle quelle ; sans date, l'heure actuelle.
- [ ] T011 Stocker `latestAmountKamas` / `latestContributionAt` dans le cache localStorage de src/features/comparison/useCommunityPrice.ts (`readCache` / `writeCache`) ; une entrée sans ces champs est ignorée (renvoie `undefined`). Remplacer `lookupCommunityMedian` par `lookupCommunityPrice(resourceId, serverId)` qui renvoie `{ latestAmountKamas, latestContributionAt, medianAmountKamas } | undefined` (lecture fraîche, sinon cache).
- [ ] T012 [P] Tests dans tests/unit/use-community-price.test.tsx : le cache garde et relit les nouveaux champs ; une ancienne entrée (médiane seule) est ignorée.

**Checkpoint**: le Worker renvoie le dernier prix, le site le lit, la règle de choix est testée.

---

## Phase 3: User Story 1 - Voir le dernier prix relevé par le groupe (Priority: P1) 🎯 MVP

**Goal**: sur la fiche Recherche (et la page HDV, même composant), une ressource sans prix gardé
affiche le dernier prix partagé et sa date ; aucune médiane n'est affichée.

**Independent Test**: prix partagés 100, 200 puis 150 → la ligne affiche 150 et la date du relevé à
150 dans un navigateur sans prix gardé.

- [ ] T013 [US1] Dans src/features/comparison/CommunityResourcePriceRow.tsx, pré-remplir avec `communityState.price.latestAmountKamas` au lieu de `medianAmountKamas`, via `onPrefill(latestAmountKamas, latestContributionAt)` ; afficher sous la ligne (`updatedAt` de `ResourcePriceInput`) la date du prix gardé quand il existe, sinon `latestContributionAt` — plus jamais `lastContributionAt` (date liée à la médiane).
- [ ] T014 [US1] Dans src/features/comparison/PriceEntryField.tsx, faire passer `onPrefill` à `carnet.save(resourceId, price, updatedAt)` pour que le prix pré-rempli garde la date du relevé (research.md §3).
- [ ] T015 [P] [US1] Test d'intégration dans tests/integration/community-price-prefill.test.tsx : dernier prix 150 (médiane 200) → le champ affiche 150, la date affichée est celle du dernier relevé, et le carnet contient 150 avec cette date ; aucune ressource sans prix partagé n'est pré-remplie (champ vide et saisissable).

**Checkpoint**: US1 fonctionne seule (MVP).

---

## Phase 4: User Story 2 - Un prix plus récent du groupe remplace celui gardé sur l'appareil (Priority: P1)

**Goal**: un prix partagé plus récent que le prix gardé le remplace, sans écraser une saisie en
cours ; un prix gardé plus récent est conservé.

**Independent Test**: prix gardé 1 437 (22/09), dernier prix 1 848 (28/09) → la ligne et le calcul
utilisent 1 848.

- [ ] T016 [US2] Dans src/features/comparison/CommunityResourcePriceRow.tsx, remplacer le garde `prefilled` (une seule fois) par l'application de `pickCommunityPrice(carnetEntry, latest)` à chaque nouvel état `found` du prix partagé, une fois `pricesLoaded` vrai : si `replacesCarnet`, appeler `onPrefill(latestAmountKamas, latestContributionAt)` ; ne rien faire tant que `isEditing` est vrai (FR-006). La prop `hasCarnetEntry` devient `carnetEntry?: ResourcePrice` et une prop `isEditing: boolean` est ajoutée.
- [ ] T017 [US2] Dans src/features/comparison/PriceEntryField.tsx, passer `carnetEntry={data[resourceId]}` et `isEditing={input !== undefined}` (au lieu de `hasCarnetEntry={data[resourceId] !== undefined || input !== undefined}`).
- [ ] T018 [US2] Renommer `fillCommunityGaps` en `syncCommunityPrices` dans src/features/comparison/community-gap-fill.ts : pour **chaque** ressource de `resourceIds` (plus seulement celles sans prix gardé), lire `lookupCommunityPrice`, appliquer `pickCommunityPrice(prices[resourceId], latest)` et, si `replacesCarnet`, appeler `save(resourceId, latestAmountKamas, latestContributionAt)` puis mettre à jour `prices[resourceId]` ; toutes les lectures partent dans le même instant (lecture groupée existante).
- [ ] T019 [US2] Adapter l'appel dans src/features/search/RecherchePage.tsx (lignes non affichées) : `syncCommunityPrices`, `save(resourceId, amount, updatedAt)` ; ne plus exclure les ressources ayant déjà un prix gardé, mais continuer d'exclure celles dont la ligne est affichée (elles se synchronisent elles-mêmes, T016) et ne lancer la synchronisation qu'une fois par ressource et par affichage (garde `gapFillRequested` conservé).
- [ ] T020 [P] [US2] Tests d'intégration dans tests/integration/community-price-prefill.test.tsx : prix gardé 1 437 daté du 22/09 et dernier prix 1 848 daté du 28/09 → affichage et coût de craft à 1 848 ; prix gardé daté après le dernier prix → conservé ; saisie en cours pendant l'arrivée d'un nouveau prix partagé → la valeur tapée reste ; test existant « jamais écrasé » (specs/004 FR-006) remplacé par ces cas. Hors ligne (FR-010), dans tests/integration/community-price-offline.test.tsx : service injoignable → la ligne affiche le dernier prix partagé déjà en cache (avec sa date) ou, sans cache, le prix gardé, et la saisie reste possible sans message bloquant ; adapter ce test s'il suppose encore la médiane.
- [ ] T021 [P] [US2] Tests unitaires de `syncCommunityPrices` dans tests/unit/community-gap-fill.test.ts : remplace un prix gardé plus ancien, conserve un plus récent, remplit un prix absent, ne fait rien sans prix partagé, respecte `isCancelled`.

**Checkpoint**: US1 et US2 fonctionnent ; le cas de la Queue de Blérom est corrigé sur Recherche et HDV.

---

## Phase 5: User Story 3 - Le même dernier prix partout (Priority: P2)

**Goal**: Suivis, Rentabilité et XP Familier appliquent la même règle que Recherche.

**Independent Test**: ressource à médiane 200 et dernier prix 150 → même coût de craft sur
Recherche, Rentabilité et Suivis ; XP Familier affiche 150 sans « Médiane ».

- [ ] T022 [P] [US3] Dans src/features/catalogue/EpinglesPage.tsx, remplacer `fillCommunityGaps` par `syncCommunityPrices` avec `(resourceId, amount, updatedAt) => repository.save(serverId, resourceId, amount, updatedAt)`.
- [ ] T023 [P] [US3] Dans src/features/prices/useCraftProfits.ts, même remplacement que T022, dans `compute` : comme `useCraftProfits` relance déjà `startRun` à chaque ouverture de la page (la liste gardée reste affichée jusqu'au nouveau résultat), la synchronisation s'y exécute à chaque ouverture, ce qui satisfait FR-013 ; ne pas court-circuiter ce recalcul quand un résultat est en cache.
- [ ] T024 [US3] Dans src/features/pets/usePetFoodPrices.ts, pour chaque nourriture : lire le prix gardé et le prix partagé (toutes les nourritures, plus seulement celles sans prix gardé), appliquer `pickCommunityPrice`, écrire le dernier prix dans le carnet avec sa date quand `replacesCarnet` (amende specs/022 research §4) ; `origin` vaut `'carnet'` ou `'community-latest'`. Remplacer `'community-median'` par `'community-latest'` dans le type `PetFoodPrice` de src/domain/pet-xp.ts.
- [ ] T025 [US3] Dans src/features/pets/FamilierPage.tsx, supprimer la mention « Médiane · » : la ligne affiche seulement la date (ou « date inconnue »).
- [ ] T026 [P] [US3] Tests d'intégration : tests/integration/epingles-community-prices.test.tsx et tests/integration/prices-page.test.tsx (le coût de craft utilise le dernier prix, y compris quand un prix gardé plus ancien existe ; FR-013 : la page Rentabilité ouverte, quittée, puis rouverte après l'arrivée d'un prix partagé plus récent affiche le nouveau coût sans rechargement, l'ancienne liste restant affichée pendant le recalcul) ; tests/integration/familier-page.test.tsx (dernier prix affiché, aucun texte « Médiane », prix gardé plus récent conservé) ; tests/integration/hdv-page.test.tsx (US3 scénario 3 : le champ d'une ressource de la page HDV affiche le dernier prix partagé et remplace un prix gardé plus ancien).

**Checkpoint**: toutes les pages utilisent le dernier prix.

---

## Phase 6: User Story 4 - Confirmation d'un prix très différent (Priority: P3)

**Goal**: la confirmation compare toujours à la médiane mais ne la montre plus.

**Independent Test**: médiane 100, dernier prix 110 : saisir 200 → confirmation avec 200 kamas et
le message, sans 100 ni pourcentage ; saisir 120 → pas de confirmation.

- [ ] T027 [US4] Dans src/features/comparison/OutlierConfirmDialog.tsx, quand `referenceLabel` est absent (ressource) : ne plus afficher la ligne de référence (« Prix habituel ») ni l'écart ; afficher « Votre prix : … » puis « Ce prix semble très différent des relevés du groupe. L'enregistrer quand même ? ». Affichage des objets (`referenceLabel` présent) inchangé.
- [ ] T028 [US4] Vérifier dans src/features/comparison/CommunityResourcePriceRow.tsx que `handleCommit` calcule toujours l'écart avec `communityState.price.medianAmountKamas` et le seuil `OUTLIER_THRESHOLD_PERCENT` (25 %), et ne demande rien sans prix partagé (specs/007 FR-008).
- [ ] T029 [P] [US4] Tests dans tests/integration/community-price-prefill.test.tsx (ou le test d'intégration existant de la confirmation) : médiane 100 / dernier prix 110, saisie 200 → dialogue sans « 100 » ni « % » ; saisie 120 → aucun dialogue ; annulation → rien partagé, date inchangée.

**Checkpoint**: les quatre stories fonctionnent.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T030 [P] Vérifier qu'aucun texte « Médiane » / « médiane » n'est affiché : `grep -rn "édiane" src --include=*.tsx` ne doit trouver que des commentaires ; adapter tout test e2e de tests/e2e/ qui l'attendrait.
- [ ] T031 [P] Ajouter une note d'amendement datée du 2026-09-28 renvoyant à specs/024 à la fin de specs/004-community-price-sharing/spec.md (FR-001, FR-003, FR-006), specs/007-outlier-confirmation/spec.md (FR-005), specs/021-background-data-loading/contracts/ (champs ajoutés à `/community-prices`) et specs/022-pet-xp-calculator/research.md (§4).
- [ ] T032 [P] Mettre à jour README.md (section « Deux modes de prix » : dernier prix du groupe au lieu du prix médian ; confirmation sans médiane affichée).
- [ ] T033 Lancer `npm run typecheck`, `npm run lint`, `npm run test` et `npm run test:e2e` ; corriger les tests existants qui supposaient la médiane affichée ou le pré-remplissage unique.
- [ ] T034 Dérouler les scénarios manuels de [quickstart.md](quickstart.md) contre un Worker local (`npm run worker:dev`), jamais contre l'API de production.

---

## Dependencies & Execution Order

- **Phase 2** bloque tout : T001 → T003 (même réponse) ; T005 → T011 ; T007 et T009 indépendants.
- **US1 (Phase 3)** dépend de T005, T009, T011.
- **US2 (Phase 4)** dépend de US1 (même composant `CommunityResourcePriceRow`) et de T007.
- **US3 (Phase 5)** dépend de T018 (`syncCommunityPrices`) pour T022/T023, et de T007/T009 pour T024 ;
  indépendante de l'interface de US1/US2.
- **US4 (Phase 6)** ne dépend que de la Phase 2 ; peut se faire en parallèle de US1–US3.
- **Polish** après les stories voulues.
- **Déploiement** (hors tâches, après fusion) : Worker d'abord (`npm run worker:deploy`), puis le site.

## Parallel Example

```text
# Phase 2, en parallèle :
T001 (worker/src/median.ts)   T005 (types + parsing)   T007 (community-price-choice.ts)   T009 (persistence)
# puis leurs tests en parallèle :
T002   T004   T006   T008   T010   T012

# Phase 5, en parallèle :
T022 (EpinglesPage.tsx)   T023 (useCraftProfits.ts)   puis T024 → T025 (Familier)
```

## Implementation Strategy

1. **MVP** : Phase 2 + US1 → une ressource sans prix gardé affiche le dernier prix partagé.
2. **Correction du bug signalé** : + US2 → la Queue de Blérom affiche 1 848 sur l'appareil qui
   gardait 1 437.
3. **Cohérence** : + US3 → mêmes coûts sur toutes les pages.
4. **Finition** : + US4 et Phase 7.
