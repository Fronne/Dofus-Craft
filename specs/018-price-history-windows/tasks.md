---

description: "Task list for 018-price-history-windows"
---

# Tasks: Historique des prix par fenêtre de temps

**Input**: Design documents from `/specs/018-price-history-windows/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests** : inclus. La constitution (principe II) impose des tests pour les règles de calcul (bornes
de fenêtre, aberrants par fenêtre), et contracts/price-history-api.md liste les cas obligatoires.

**Organization** : tâches groupées par user story (spec.md).

## Format: `[ID] [P?] [Story] Description`

- **[P]** : parallélisable (fichiers différents, pas de dépendance sur une tâche inachevée)
- **[Story]** : US1, US2 (spec.md)

## Path Conventions

Application `src/`, Worker `worker/src/`, tests `tests/` (plan.md).

---

## Phase 1: Setup

Aucune tâche : aucune dépendance, aucune migration, structure existante.

---

## Phase 2: Foundational (types partagés)

- [ ] T001 Dans `src/domain/price-history.ts`, remplacer `Grouping` / `HistoryPoint` par
  `HistoryWindow = 'day' | 'week' | 'month'` (garder l'export `GROUPINGS` renommé `HISTORY_WINDOWS`,
  ordre du plus court au plus long) et `SharedPrice = { amountKamas: number; sharedAt: string }`
  (« `sharedAt` : chaîne ISO 8601 UTC, arrondie à la minute inférieure ») ;
  `PriceHistory = Record<HistoryWindow, SharedPrice[]>` ; libellés « Jour », « Semaine », « Mois »
  inchangés. Mettre à jour les imports dans `src/persistence/history-grouping-preference.ts`
  (valeurs et clé `craftcheck-history-grouping` inchangées, défaut `week`, commentaire renvoyant à la
  spec 018) et `tests/unit/history-grouping-preference.test.ts`.

**Checkpoint** : `npm run typecheck` signale uniquement les usages à adapter dans les phases suivantes.

---

## Phase 3: User Story 1 - Voir les prix de la période choisie (Priority: P1) 🎯 MVP

**Goal** : chaque prix partagé dans les dernières 24 h / 7 j / 30 j est un point de la courbe.

**Independent Test** : prix à −2 h, −3 j, −20 j → « Jour » 1 point, « Semaine » 2, « Mois » 3.

### Tests (écrits d'abord, en échec)

- [ ] T002 [P] [US1] Réécrire `tests/unit/price-history-aggregation.test.ts` pour
  `computePriceHistory(rows, now)` : borne incluse à `now − 24 h` (dans `day`), `now − 24 h − 1 min`
  seulement dans `week` et `month`, mêmes bornes à 7 j et 30 j, absent au-delà de 30 j ; trois prix
  du même appareil dans l'heure → trois éléments ; aberrant (≥ 4 valeurs) écarté seulement de la
  fenêtre où il l'est ; tri par `sharedAt` croissant ; `sharedAt` arrondi à la minute ; éléments
  sans autre clé que `amountKamas` / `sharedAt`. Retirer les tests de regroupement par période
  (`parisDate`, `periodStartFor`).
- [ ] T003 [P] [US1] Adapter `tests/unit/price-history-route.test.ts` : 400 inchangé, 200
  `{ day: [], week: [], month: [] }` sans données, requête SQL limitée à `kind`, serveur et 30 jours,
  aucune occurrence de `device_id` / `deviceId` dans le corps.
- [ ] T004 [P] [US1] Adapter `tests/unit/price-history-api.test.ts` : nouveau format → `found` ;
  ancien format (`periodStart` / `medianAmountKamas`), 500, réseau coupé → `unavailable`, sans
  exception.
- [ ] T005 [P] [US1] Adapter `tests/unit/price-history-chart.test.tsx` : un cercle par prix, deux
  prix à la même minute restent deux cercles, abscisses proportionnelles au temps sur toute la
  fenêtre (début de fenêtre → `now`), info-bulle « 2 720 000 kamas » + « 24 sept. à 14:05 » (heure
  de Paris), étiquettes d'axe en heures pour `day` et en jours sinon, table cachée « Date » / « Prix ».

### Implementation

- [ ] T006 [US1] Réécrire `worker/src/price-history.ts` : `computePriceHistory(rows, now)` avec
  `rows: { amountKamas, createdAt }[]` ; pour chaque fenêtre (24 h, 7 × 24 h, 30 × 24 h, bornes
  incluses) filtrer, appliquer `outlierBounds` sur les montants triés de la fenêtre, trier par
  `createdAt`, renvoyer `{ amountKamas, sharedAt }` avec `sharedAt` = `createdAt` arrondi à la minute
  inférieure en ISO UTC. Supprimer `parisDate`, `periodStartFor`, `groupHistory` et l'import
  `percentileCont`. `priceHistoryResponse` : `SELECT amount_kamas, created_at` (plus de
  `device_id`) avec `created_at >= now − 30 j`. Commentaire d'en-tête renvoyant à la spec 018.
- [ ] T007 [US1] Dans `src/services/community-price-api.ts`, remplacer `isHistoryPoint` par
  `isSharedPrice` (`amountKamas` nombre, `sharedAt` chaîne) et valider les trois fenêtres de
  `HISTORY_WINDOWS` ; mettre à jour le commentaire de `getPriceHistory`.
- [ ] T008 [US1] Dans `src/domain/price-history.ts`, remplacer `formatPeriod` par
  `formatSharedAt(iso)` (« 24 sept. à 14:05 », `timeZone: 'Europe/Paris'`) et `formatAxisTick(iso,
  window)` (« 14 h » pour `day`, « 22 sept. » sinon) ; ajouter `windowStart(window, now)`.
- [ ] T009 [US1] Adapter `src/features/comparison/PriceHistoryChart.tsx` : props `{ prices,
  window, now }`, abscisse de `windowStart(window, now)` à `now`, un cercle par prix (clé = index),
  `aria-label` « 24 sept. à 14:05 : 2 720 000 kamas », info-bulle prix puis date et heure, retrait
  de `price-history-point--single`, table cachée « Date » / « Prix », `aria-label` du SVG « Courbe de
  N prix ».
- [ ] T010 [US1] Dans `src/features/comparison/PriceHistoryButton.tsx` et `usePriceHistory.ts` :
  renommer grouping → window, `aria-label` du groupe « Période », retenir l'instant du chargement
  (`loadedAt`) avec l'historique en cache et le passer comme `now` à la courbe.
- [ ] T011 [US1] Adapter `tests/integration/price-history-popover.test.tsx` (mocks au nouveau
  format, un point par prix, changement de fenêtre sans nouvelle requête) et
  `tests/e2e/price-history.spec.ts` (réponse simulée au nouveau format).

**Checkpoint** : US1 utilisable ; « Semaine » affiche la courbe dès 2 prix sur 7 jours (SC-002).

---

## Phase 4: User Story 2 - Période sans assez de prix (Priority: P2)

**Goal** : 0 ou 1 prix dans la fenêtre → pas de courbe, message clair, invitation vers une fenêtre
plus longue.

**Independent Test** : un seul prix dans les 30 derniers jours, vérifier les trois fenêtres.

- [ ] T012 [P] [US2] Réécrire `tests/unit/price-history-display.test.ts` : `month` vide → `empty` ;
  fenêtre vide avec `month` non vide → `none-in-window` ; 1 prix → `single` ; ≥ 2 → `chart` ;
  `longerWindow` = plus petite fenêtre plus longue avec au moins 2 prix, absente sinon et jamais
  pour `month`.
- [ ] T013 [US2] Dans `src/domain/price-history.ts`, réécrire `historyDisplay(history, window)`
  selon data-model.md « Affichage » : cas `empty`, `none-in-window` (+ `longerWindow?`), `single`
  (+ `longerWindow?`), `chart`.
- [ ] T014 [US2] Dans `PriceHistoryBody` de `src/features/comparison/PriceHistoryButton.tsx` :
  « Pas encore d'historique pour ce serveur. », « Aucun prix partagé sur cette période. », prix
  unique « <prix> » puis « le 24 sept. à 14:05 », bouton « Voir <Semaine|Mois> » qui change de
  fenêtre (remplace « Essayez le regroupement … »).
- [ ] T015 [US2] Ajouter à `tests/integration/price-history-popover.test.tsx` les cas « aucun prix
  sur cette période » avec invitation, prix unique, et « Pas encore d'historique » ; retirer ceux de
  l'invitation vers un regroupement plus fin.

**Checkpoint** : US1 et US2 complètes.

---

## Phase 5: Polish

- [ ] T016 [P] Retirer de `src/styles/comparison.css` les règles devenues inutiles
  (`.price-history-point--single`) et renommer `.price-history-grouping` si le composant change de
  classe.
- [ ] T017 [P] Mettre à jour `worker/README.md` (description de `/price-history`) et la note de
  révision de `specs/004-community-price-sharing/spec.md` qui décrit l'historique, si elle mentionne
  les médianes par période.
- [ ] T018 Lancer `npm run typecheck`, `npx vitest run` et le scénario e2e d'historique ; dérouler
  quickstart.md (manuel) sur le serveur de dev.

---

## Dependencies & Execution Order

- T001 bloque tout le reste.
- US1 : T002–T005 en parallèle, puis T006 (Worker) et T007–T010 (application) ; T011 après T010.
- US2 : dépend de T001 et T008–T010 (même popover) ; T012 en parallèle de la fin d'US1.
- Polish après US2.

## Parallel Example: User Story 1

```text
T002 tests Worker  |  T003 tests route  |  T004 tests client  |  T005 tests courbe
puis : T006 (worker/src/price-history.ts)  en parallèle de  T007 → T008 → T009 → T010
```

## Implementation Strategy

MVP = Phase 2 + US1 : la courbe par fenêtre fonctionne dès qu'il y a 2 prix. US2 affine les cas
clairsemés. Déployer le Worker puis le site dans la foulée (research.md §6).
