---

description: "Task list for 017-price-history-chart"
---

# Tasks: Graphe d'historique des prix HDV

**Input**: Design documents from `/specs/017-price-history-chart/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests** : inclus. La constitution (principe II) impose des tests pour toute règle de calcul
(regroupement par période, un appareil par période, valeurs aberrantes, fenêtre de 90 jours), et les
deux contrats listent les cas obligatoires.

**Organization** : tâches groupées par user story (spec.md).

## Format: `[ID] [P?] [Story] Description`

- **[P]** : parallélisable (fichiers différents, pas de dépendance sur une tâche inachevée)
- **[Story]** : US1 à US4 (spec.md)

## Path Conventions

Application `src/`, Worker `worker/src/`, tests communs `tests/` (plan.md, Structure Decision).

---

## Phase 1: Setup

- [ ] T001 Vérifier que la base est verte avant de commencer, sans modifier de fichier. Lancer depuis la racine : `npx tsc -b --noEmit`, `npx vitest run`, `npx eslint src tests worker` et `npx tsc -p worker --noEmit`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose** : calcul des points d'historique dans le Worker, route de lecture, client et types côté application. Toutes les stories en dépendent.

**⚠️ CRITICAL** : aucune story ne peut commencer avant la fin de cette phase.

- [ ] T002 Exporter `percentileCont` et `outlierBounds` depuis worker/src/median.ts, sans changer leur comportement, pour que worker/src/price-history.ts les réutilise (plan.md, principe IV). Vérifier que tests/unit/community-price-median.test.ts et community-price-summary.test.ts passent toujours
- [ ] T003 [P] Écrire tests/unit/price-history-aggregation.test.ts pour `computePriceHistory(rows, now)` de worker/src/price-history.ts. Les lignes sont de la forme `ContributionRow` (`{ amountKamas, createdAt, deviceId }`, worker/src/median.ts). Cas obligatoires de contracts/price-history-api.md :
  - 23:30 et 00:30 heure de Paris tombent sur deux jours ;
  - 22:30 UTC en été compte pour le lendemain ;
  - un dimanche et le lundi suivant tombent dans deux semaines, avec `periodStart` égal à la date du lundi ;
  - le 31 et le 1er tombent dans deux mois, avec `periodStart` égal à `AAAA-MM-01` ;
  - une contribution la nuit du changement d'heure d'octobre 2026 tombe sur la bonne date ;
  - un appareil qui saisit 3 prix le même jour compte une fois, avec son dernier prix ;
  - un appareil sur deux jours compte une fois par jour ;
  - les lignes à `deviceId` vide comptent chacune ;
  - une valeur aberrante (au moins 4 valeurs, écart interquartile non nul) est écartée et n'entre pas dans `sampleSize` ;
  - une période qui ne contenait que cette valeur disparaît ;
  - une ligne plus ancienne que `now` moins 90 jours est ignorée ;
  - 1000 et 1500 donnent une médiane de 1250 ;
  - les points sont triés par `periodStart` croissant ;
  - sans ligne, le résultat est `{ day: [], week: [], month: [] }`.
- [ ] T004 Créer worker/src/price-history.ts, puis faire passer T003 :
  - type `Grouping = 'day' | 'week' | 'month'` ;
  - type `HistoryPoint = { periodStart: string; medianAmountKamas: number; sampleSize: number }` : `periodStart` est une date civile « AAAA-MM-JJ », `medianAmountKamas` un entier ≥ 0 égal à `percentileCont(0.5)` arrondi, `sampleSize` un entier ≥ 1 ;
  - fonction `parisDate(iso)` : `Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' })` pour obtenir `AAAA-MM-JJ` ;
  - fonction `periodStartFor(date, grouping)` : le jour lui-même, le lundi de sa semaine ou le 1er du mois, calculé sur la date civile ;
  - fonction `computePriceHistory(rows, now = new Date())` : applique research.md §3 dans l'ordre (fenêtre `retentionCutoff(now)`, période en heure de Paris, `latestPerDevice` par période, `outlierBounds` sur l'union des lignes gardées pour ce regroupement, puis médiane et nombre par période ; une période vide disparaît) et renvoie `{ day, week, month }` ;
  - commentaires renvoyant à specs/017.
- [ ] T005 [P] Écrire tests/unit/price-history-route.test.ts pour `priceHistoryResponse(db, url, now?)` de worker/src/price-history.ts, avec la base `createTestD1()` de tests/support/sqlite-d1.ts. Cas :
  - statut 400 avec `{ error: "kind (resource or item), id and serverId are required" }` si `kind`, `id` ou `serverId` manque, ou si `kind` n'est ni `resource` ni `item` ;
  - statut 200 avec `{ day: [], week: [], month: [] }` sans données ;
  - `kind=item` ignore les lignes `'resource'` du même identifiant, et inversement ;
  - un autre serveur est ignoré ;
  - la dernière contribution d'un objet de plus de 90 jours, gardée pour `/latest-price`, est exclue ;
  - la réponse ne contient aucune clé `deviceId`, `device_id` ni `createdAt` (FR-006).
- [ ] T006 Ajouter à worker/src/price-history.ts la requête `SELECT amount_kamas, created_at, device_id FROM community_price_contributions WHERE resource_id = ? AND server_id = ? AND kind = ? AND created_at >= ?`, liée à `retentionCutoff(now)`, et `priceHistoryResponse(db, url, now)` qui renvoie `{ status, body }`. Typer la base de façon structurelle, comme worker/src/latest.ts. Faire passer T005
- [ ] T007 Brancher la route `GET /price-history` dans worker/src/index.ts, parmi les lectures anonymes, avant le contrôle `isAuthorized`, sur le modèle de `handleGetLatestPrice`. Mettre à jour worker/README.md (liste des routes)
- [ ] T008 [P] Créer src/domain/price-history.ts :
  - types `Grouping`, `HistoryPoint` et `PriceHistory = { day: HistoryPoint[]; week: HistoryPoint[]; month: HistoryPoint[] }`, identiques au contrat ;
  - `GROUPINGS = ['day', 'week', 'month']` et libellés « Jour », « Semaine », « Mois » ;
  - `historyDisplay(history, grouping)` renvoie `{ kind: 'empty' } | { kind: 'single', point, finerGrouping?: Grouping } | { kind: 'chart', points }` selon data-model.md : 0 point, 1 point (`finerGrouping` est le regroupement plus fin le plus proche qui a au moins 2 points), 2 points ou plus ;
  - `formatPeriod(periodStart, grouping)` renvoie « 21 sept. », « semaine du 14 sept. » ou « sept. 2026 » (`Intl.DateTimeFormat('fr-FR')`, lecture de la date civile sans décalage de fuseau).
- [ ] T009 [P] Écrire tests/unit/price-history-display.test.ts pour `historyDisplay` et `formatPeriod` de src/domain/price-history.ts. Cas :
  - 0, 1 et 3 points ;
  - 1 point au mois, 2 à la semaine : `finerGrouping` vaut `'week'` ;
  - 1 point au mois, 1 à la semaine, 3 au jour : `finerGrouping` vaut `'day'` ;
  - 1 point au jour : pas de `finerGrouping` ;
  - libellés des trois regroupements, y compris un 1er du mois lu sans décalage de fuseau.
- [ ] T010 [P] Écrire tests/unit/price-history-api.test.ts pour `getPriceHistory(kind, id, serverId)` de src/services/community-price-api.ts, avec un `fetch` simulé comme dans tests/unit/community-price-api.test.ts. Cas :
  - l'URL appelée est `/price-history?kind=…&id=…&serverId=…` ;
  - un corps valide donne `{ status: 'found', history }` ;
  - un statut 500, un réseau coupé, un JSON invalide ou un point auquel manque un des trois champs typés donnent `{ status: 'unavailable' }` ;
  - aucun cas ne lève d'exception.
- [ ] T011 Ajouter `getPriceHistory` dans src/services/community-price-api.ts, sur le modèle de `getLatestItemPrice`, avec une validation de la forme de chaque point. Faire passer T010

**Checkpoint** : `curl /price-history` renvoie les trois regroupements, et le client lit la réponse (quickstart.md §2).

---

## Phase 3: User Story 1 - Voir l'évolution du prix d'une ressource (Priority: P1) 🎯 MVP

**Goal** : en Mode communautaire, un bouton sur chaque ligne de ressource ouvre un popover avec la courbe des médianes hebdomadaires sur le serveur actif, avec le détail de chaque point.

**Independent Test** : avec des prix partagés sur plusieurs semaines pour une ressource, ouvrir son popover. On voit un point par semaine, et au survol la période, la médiane et le nombre de prix. Échap, un clic à l'extérieur et « Fermer » ferment le popover.

### Tests for User Story 1

- [ ] T012 [P] [US1] Écrire tests/unit/price-history-chart.test.tsx pour `PriceHistoryChart` (props `points`, `grouping`). Cas :
  - autant de points que de `HistoryPoint` ;
  - un écart de 3 semaines entre deux points est 3 fois plus large que l'écart d'une semaine (FR-010) ;
  - aucun point à zéro ;
  - le focus clavier ou le survol d'un point affiche « <période> », « <médiane> kamas » et « <n> prix » ;
  - un point à 1 prix a la classe du marqueur creux et le texte « 1 prix ».
- [ ] T013 [P] [US1] Écrire tests/integration/price-history-popover.test.tsx (rendu de RecherchePage comme dans tests/integration/community-price-prefill.test.tsx, `getPriceHistory` simulé). Cas :
  - en Mode communautaire, un bouton « Historique du prix » par ligne de ressource ;
  - en Mode personnel, aucun bouton ;
  - le clic ouvre le `role="dialog"` sans donner le focus au champ de prix de la ligne ;
  - Échap, un clic à l'extérieur et « Fermer » ferment le popover, et le focus revient au déclencheur après Échap et « Fermer » ;
  - ouvrir un second popover ferme le premier ;
  - un changement de serveur ferme le popover ;
  - le prix du champ et la comparaison sont inchangés après ouverture et fermeture (FR-014).

### Implementation for User Story 1

- [ ] T014 [P] [US1] Ajouter l'icône `'chart'` (petite courbe montante sur axes, même style de trait que les autres icônes) dans src/components/Icon.tsx
- [ ] T015 [US1] Charger la skill `dataviz` avant d'écrire la courbe, puis créer src/features/comparison/PriceHistoryChart.tsx, un SVG en ligne sans dépendance (research.md §4) :
  - abscisse proportionnelle à `periodStart` ;
  - ordonnée de la médiane minimale à la maximale, avec une marge et 3 graduations `formatKamas` ;
  - repères de période en abscisse ;
  - points focusables, info-bulle au survol, au focus ou au toucher, texte « <période> · <médiane> kamas · <n> prix » ;
  - marqueur creux pour `sampleSize === 1` ;
  - couleurs par variables de thème.

  Faire passer T012.
- [ ] T016 [US1] Créer src/features/comparison/usePriceHistory.ts. Signature : `usePriceHistory(kind, id, serverId, enabled)`, avec les états `loading`, `{ ready, history }` et `unavailable`. Il appelle `getPriceHistory` seulement quand `enabled` passe à vrai, et garde un cache en mémoire (`Map` au niveau du module) par `kind:id:serverId` pour la visite. Pas de `localStorage` (research.md §6)
- [ ] T017 [US1] Créer src/features/comparison/PriceHistoryButton.tsx (props `kind`, `id`, `name`, `serverId`) :
  - bouton-icône `chart` avec `aria-label="Historique du prix"`, `aria-expanded` et `aria-haspopup="dialog"`, dont le clic appelle `preventDefault` et bascule l'ouverture ;
  - une fois ouvert, un panneau `role="dialog"` avec `aria-label="Historique du prix de <nom>"`, rendu par `createPortal` dans `document.body` et positionné sous le déclencheur (ou au-dessus s'il manque de place) d'après `getBoundingClientRect` ;
  - fermeture par Échap, par `pointerdown` hors du déclencheur et du panneau, par « Fermer », par défilement ou redimensionnement, et au démontage, sur le modèle de src/features/dungeon-counter/DungeonCounterBubble.tsx ; le focus revient au déclencheur après Échap et « Fermer » ;
  - en-tête avec le nom, le serveur et « Fermer » ;
  - corps : un squelette pendant le chargement, « Historique indisponible pour le moment » si `unavailable`, sinon `PriceHistoryChart` sur `history.week` quand il y a au moins 2 points, et un message provisoire sinon (US4 l'affine) ;
  - mention « Médiane par période, prix partagés sur 90 jours ».
- [ ] T018 [US1] Ajouter un emplacement facultatif `history?: ReactNode` à src/features/comparison/ResourcePriceInput.tsx, rendu sur la ligne à côté du champ. L'emplacement n'est pas rendu quand il est absent, pour que le Mode personnel reste inchangé
- [ ] T019 [US1] Dans src/features/search/RecherchePage.tsx, branche communautaire seulement (le `ResourcePriceInput` avec `lockWhenFilled`), passer `history={<PriceHistoryButton kind="resource" id={resource.id} name={resource.name} serverId={serverId} />}`, avec une `key` qui inclut `serverId` pour fermer le popover au changement de serveur. Faire passer T013
- [ ] T020 [US1] Ajouter dans src/styles/comparison.css les styles du déclencheur, du panneau, de la courbe et de l'info-bulle. Les couleurs viennent des variables de theme.css, en thème clair et sombre. Sous 480 px, le panneau prend `width: calc(100vw - 32px)`, sans défilement horizontal (FR-015). Vérifier que design-modern.css ne casse pas le rendu (tests/unit/design-modern-css-scope.test.ts)

**Checkpoint** : la User Story 1 fonctionne seule, au regroupement « Semaine ».

---

## Phase 4: User Story 2 - Choisir le regroupement : jour, semaine ou mois (Priority: P1)

**Goal** : un sélecteur Jour / Semaine / Mois redessine la courbe sans nouvelle requête, et le choix est retenu sur l'appareil.

**Independent Test** : passer de « Semaine » à « Jour » puis à « Mois » : le nombre de points change. Rouvrir le popover d'une autre ressource : le dernier choix est conservé.

### Tests for User Story 2

- [ ] T021 [P] [US2] Écrire tests/unit/history-grouping-preference.test.ts pour src/persistence/history-grouping-preference.ts. Cas :
  - valeur par défaut `'week'` ;
  - une valeur écrite est relue ;
  - une valeur inconnue ou illisible donne `'week'` ;
  - un `localStorage` qui lève une exception ne casse ni la lecture ni l'écriture, sur le modèle de tests/unit/design-preference.test.ts.
- [ ] T022 [P] [US2] Compléter tests/integration/price-history-popover.test.tsx. Cas :
  - « Semaine » a `aria-pressed="true"` à la première ouverture ;
  - passer à « Jour » puis à « Mois » change le nombre de points, sans nouvel appel à `getPriceHistory` ;
  - fermer puis rouvrir le popover d'une autre ressource garde « Mois ».

### Implementation for User Story 2

- [ ] T023 [US2] Créer src/persistence/history-grouping-preference.ts : `readHistoryGrouping()` et `saveHistoryGrouping(grouping)`, clé `craftcheck-history-grouping`. Une valeur absente, illisible ou inconnue donne `'week'`, et lecture comme écriture sont protégées par try/catch, comme src/persistence/design-preference.ts. Faire passer T021
- [ ] T024 [US2] Dans src/features/comparison/PriceHistoryButton.tsx, ajouter un groupe de 3 boutons « Jour », « Semaine » et « Mois » (`aria-pressed`, libellés tirés de src/domain/price-history.ts). La valeur initiale vient de `readHistoryGrouping()` à chaque ouverture, et chaque changement appelle `saveHistoryGrouping`. Passer `history[grouping]` et `grouping` à `PriceHistoryChart`, sans nouvelle requête. Styles du groupe dans src/styles/comparison.css. Faire passer T022

**Checkpoint** : US1 et US2 fonctionnent ensemble.

---

## Phase 5: User Story 3 - Voir l'évolution du prix HDV d'un objet (Priority: P2)

**Goal** : le même popover s'ouvre depuis le champ « Prix HDV » et montre les prix HDV partagés de l'objet.

**Independent Test** : avec plusieurs prix HDV partagés pour un objet sur plusieurs semaines, ouvrir le popover depuis « Prix HDV » : on voit la courbe des médianes, et le prix du champ ne change pas.

### Tests for User Story 3

- [ ] T025 [P] [US3] Compléter tests/integration/price-history-popover.test.tsx. Cas :
  - en Mode communautaire, un bouton « Historique du prix » à côté de « Prix HDV », qui appelle `getPriceHistory('item', <id de l'objet>, <serveur>)` ;
  - en Mode personnel, aucun bouton ;
  - le prix affiché dans « Prix HDV » (le dernier prix, specs/016) et le verdict sont identiques avant et après ouverture (FR-014) ;
  - le clic ne déverrouille pas et ne donne pas le focus au champ.

### Implementation for User Story 3

- [ ] T026 [US3] Ajouter un emplacement facultatif `history?: ReactNode` à src/features/comparison/MarketPriceInput.tsx, rendu à côté du champ et du crayon, sans changer le verrouillage ni `onCommit`
- [ ] T027 [US3] Dans src/features/search/RecherchePage.tsx, quand `community` est vrai, passer `history={<PriceHistoryButton kind="item" id={selectedItem.id} name={selectedItem.name} serverId={serverId} />}` à `MarketPriceInput`, avec une `key` qui inclut `serverId`. Faire passer T025

**Checkpoint** : US1, US2 et US3 fonctionnent.

---

## Phase 6: User Story 4 - Historique trop maigre (Priority: P2)

**Goal** : sous 2 périodes, un message clair remplace la courbe.

**Independent Test** : une ressource sans prix affiche « Pas encore d'historique pour ce serveur ». Une ressource avec une seule période affiche « Pas assez d'historique », avec la médiane et le nombre de prix de cette période.

### Tests for User Story 4

- [ ] T028 [P] [US4] Compléter tests/integration/price-history-popover.test.tsx. Cas :
  - 0 point : « Pas encore d'historique pour ce serveur » et aucun SVG de courbe ;
  - 1 point au mois et 3 au jour : « Pas assez d'historique », « <période> : <médiane> kamas (<n> prix) » et « Essayez le regroupement Jour » ; cliquer sur l'invitation passe à « Jour » et affiche la courbe ;
  - 1 point au jour : pas d'invitation ;
  - `unavailable` : « Historique indisponible pour le moment », sans courbe ni valeur (FR-013).

### Implementation for User Story 4

- [ ] T029 [US4] Dans src/features/comparison/PriceHistoryButton.tsx, remplacer le message provisoire par le rendu de `historyDisplay(history, grouping)` de src/domain/price-history.ts :
  - `empty` : « Pas encore d'historique pour ce serveur » ;
  - `single` : « Pas assez d'historique », « <formatPeriod> : <formatKamas> kamas (<n> prix) », et quand `finerGrouping` existe un bouton « Essayez le regroupement <libellé> » qui change et enregistre le regroupement ;
  - `chart` : `PriceHistoryChart`.

  Faire passer T028.

**Checkpoint** : toutes les stories fonctionnent.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T030 [P] Écrire tests/e2e/price-history.spec.ts. Simuler `**/price-history?*` avec `page.route`, comme tests/e2e/community-price-sharing.spec.ts. En Mode communautaire, ouvrir la fiche d'un objet craftable, ouvrir l'historique d'une ressource, vérifier la courbe, passer à « Jour », puis fermer avec Échap. Vérifier aussi qu'à 375 px de large la page n'a pas de défilement horizontal
- [ ] T031 [P] Ajouter une note de révision dans specs/004-community-price-sharing/spec.md et specs/016-shared-item-prices/spec.md : « Révision (2026-09-25) : historique des prix (specs/017) », qui dit que `GET /price-history` n'expose que des agrégats par période (FR-010 de 004 inchangé) et que la rétention ne change pas
- [ ] T032 Lancer toute la vérification : `npx tsc -b --noEmit`, `npx tsc -p worker --noEmit`, `npx vitest run`, `npx eslint src tests worker` et `npx playwright test tests/e2e/price-history.spec.ts`. Puis dérouler le parcours manuel de specs/017-price-history-chart/quickstart.md §3 sur le serveur de développement, en le laissant tourner après la vérification

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** : aucune dépendance.
- **Foundational (Phase 2)** : après le Setup, et bloque toutes les stories.
- **US1 (Phase 3)** : après Foundational. C'est le MVP.
- **US2 (Phase 4)** : après US1, car elle ajoute le sélecteur au popover de T017.
- **US3 (Phase 5)** : après US1 (réutilise `PriceHistoryButton`). Indépendante de US2 et US4.
- **US4 (Phase 6)** : après US1. Son invitation vers un regroupement plus fin utilise la préférence de US2 (T023).
- **Polish (Phase 7)** : après les stories voulues.

### Within Phase 2

- T002 avant T004. T003 avant T004, qui passe ensuite au vert. T004 avant T006, et T005 avant T006. T006 avant T007.
- T008, T009 et T010 sont indépendants du Worker. T010 avant T011.

### Within Each User Story

- Les tests d'abord, qui doivent échouer, puis l'implémentation.
- US1 : T014 et T015 en parallèle, puis T016, T017, T018, T019, T020.
- US3 : T026 puis T027.

### Parallel Opportunities

- Phase 2 : T003, T005, T008, T009 et T010 en parallèle (fichiers distincts).
- US1 : T012, T013 et T014 en parallèle.
- Après US1 : US3 en parallèle de US2 et US4, en coordonnant les modifications de RecherchePage.tsx et PriceHistoryButton.tsx.
- Polish : T030 et T031 en parallèle.

---

## Parallel Example: Phase 2

```text
T003 tests/unit/price-history-aggregation.test.ts
T005 tests/unit/price-history-route.test.ts
T008 src/domain/price-history.ts
T009 tests/unit/price-history-display.test.ts
T010 tests/unit/price-history-api.test.ts
```

## Parallel Example: User Story 1

```text
T012 tests/unit/price-history-chart.test.tsx
T013 tests/integration/price-history-popover.test.tsx
T014 src/components/Icon.tsx
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1, puis Phase 2 : le Worker et le client sont prêts.
2. Phase 3 : popover sur les ressources, au regroupement « Semaine ».
3. **Arrêt et validation** avec quickstart.md §3, étapes 1 à 3, 7 et 9.

### Incremental Delivery

1. MVP (US1).
2. US2 : choix du regroupement.
3. US3 : historique des objets.
4. US4 : états « pas assez d'historique ».
5. Polish : e2e, notes de révision, vérification complète.

Déploiement : le Worker (`npm run worker:deploy`) avant l'application, car l'application appelle
`/price-history`. Aucune migration D1 n'est nécessaire.
