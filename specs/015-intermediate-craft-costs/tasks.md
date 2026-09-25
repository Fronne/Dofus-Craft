---

description: "Task list for 015-intermediate-craft-costs"
---

# Tasks: Coût de craft des ressources intermédiaires

**Input**: Design documents from `/specs/015-intermediate-craft-costs/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: inclus — la constitution (principe II) impose des tests automatisés pour toute règle de
calcul (cas normaux, limites, entrées manquantes), et `contracts/craft-tree.md` liste les cas
obligatoires.

**Organization**: tâches groupées par user story (spec.md).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallélisable (fichiers différents, pas de dépendance sur une tâche inachevée)
- **[Story]**: US1 à US4 (spec.md)

## Path Conventions

Projet unique : `src/`, `tests/` à la racine (plan.md, Structure Decision).

---

## Phase 1: Setup

**Purpose**: point de départ vérifié

- [X] T001 Vérifier que la base est verte avant de commencer : `npx tsc -b --noEmit`, `npx vitest run` et `npx eslint src tests` depuis la racine du dépôt (aucune modification de fichier)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: données de recettes intermédiaires et calcul pur, requis par toutes les stories

- [X] T002 [P] Ajouter `craftable?: boolean` au type `Resource` dans src/domain/types.ts (« `undefined` = inconnu (détail mis en cache avant cette version) : à vérifier », data-model.md), et les types `IngredientChoice = 'buy' | 'craft'`, `RetainedOption = 'buy' | 'craft' | 'missing'` et `RetainedCost` (`resourceId`, `purchaseKamas?`, `recipeKamas?`, `children?: { quantity: number; cost: RetainedCost }[]`, `option`, `forced`, `unitKamas?`) et `RecipeTree = { recipes: Record<string, Recipe | null>; resources: Record<string, Resource> }`
- [X] T003 [P] Dans src/services/dofusdb-mappers.ts, faire conserver par `mapDofusDbResource` le champ DofusDB `hasRecipe` sous `craftable` (seulement s'il est un booléen, sinon laisser `undefined`), et couvrir ce mapping dans tests/unit/dofusdb-mappers.test.ts (créer le fichier s'il n'existe pas)
- [X] T004 Ajouter `getResourceRecipe(resourceId: string): Promise<{ recipe: Recipe; resources: Resource[] } | null>` dans src/data/catalogue-repository.ts : `cached(\`recipes:${resourceId}\`, () => getDofusDbRecipes(resourceId))`, première recette seulement, `mapDofusDbRecipe` + `mapDofusDbResource` sur ses `ingredients` ; `null` si aucune recette ; `null` aussi si la recette est invalide (erreur de mapping attrapée) ; laisser propager les erreurs réseau (research.md §2, FR-012)
- [X] T005 Écrire tests/unit/craft-tree.test.ts couvrant les 12 cas obligatoires de specs/015-intermediate-craft-costs/contracts/craft-tree.md (non craftable avec prix, recette moins chère, achat moins cher, égalité → `buy`, seul l'achat / seule la recette connue, aucun → `missing` et absent des prix effectifs, recette incomplète → `recipeKamas` absent, forcé `buy` sans prix → `missing` + `forced`, forcé `craft` plus cher → `craft` + `forced`, chaîne de 3 niveaux avec quantités multipliées, cycle A → B → A terminé, recette non chargée puis chargée) plus `treeResourceIds` sans doublon ; les tests échouent tant que T006 n'est pas fait
- [X] T006 Implémenter src/domain/craft-tree.ts selon contracts/craft-tree.md : `retainedCost(resourceId, tree, prices, choices, ancestors = new Set())` appliquant exactement la règle de choix de data-model.md (« si non craftable ici … option = buy si purchaseKamas connu, sinon missing (forced ignoré) ; forcé buy/craft sans valeur → missing ; automatique : le plus petit, égalité → buy, un seul connu → celui-là »), `recipeKamas` défini seulement si tous les enfants ont un `unitKamas` ; `effectiveIngredientPrices(recipe, tree, prices, choices)` (l'objet final `recipe.itemId` est ancêtre de tous ; `updatedAt` du carnet si `buy`, `''` si `craft`) ; `treeResourceIds(recipe, tree)` ; faire passer T005
- [X] T007 Implémenter `loadRecipeTree(recipe, resources, onProgress?)` dans src/features/comparison/recipe-tree-loader.ts : part des ingrédients de `recipe`, demande `getResourceRecipe` pour chaque ressource `craftable !== false` pas encore connue (en parallèle, jamais deux fois la même), enregistre `null` en cas d'absence ou d'erreur réseau, descend dans les ingrédients des recettes reçues, appelle `onProgress(tree)` à chaque recette reçue et résout avec l'arbre complet (research.md §4 et §5)
- [X] T008 Créer le hook `useRecipeTree(recipe, resources)` dans src/features/comparison/useRecipeTree.ts qui appelle `loadRecipeTree` et expose l'arbre au fur et à mesure (`onProgress`), l'arbre initial contenant déjà les ressources de premier niveau ; ignore les réponses d'un ancien objet après changement de sélection
- [X] T009 [P] Couvrir `loadRecipeTree` dans tests/unit/recipe-tree-loader.test.ts (getResourceRecipe simulé) : chaîne de 3 niveaux chargée, ressource partagée demandée une seule fois, `craftable: false` jamais demandé, `craftable` indéfini demandé, erreur réseau → `null` sans rejet, cycle A → B → A terminé
- [X] T010 Extraire de src/features/catalogue/EpinglesPage.tsx la complétion des prix manquants par la médiane communautaire dans `fillCommunityGaps(serverId, resourceIds, repository, prices, isCancelled)` de src/features/comparison/community-gap-fill.ts (même règle : médiane via `lookupCommunityMedian`, enregistrée une fois dans le carnet, jamais par-dessus un prix existant), et faire utiliser cette fonction par EpinglesPage sans changer son comportement (tests/integration/epingles-community-prices.test.tsx doit rester vert)

**Checkpoint**: calcul pur testé, arbre de recettes chargeable ; aucune interface modifiée.

---

## Phase 3: User Story 1 — Un coût de craft qui tient compte des ingrédients craftables (Priority: P1) 🎯 MVP

**Goal**: la fiche compte chaque ingrédient craftable au moins cher entre achat et recette, et l'indique sur sa ligne.

**Independent Test**: Dagues de Fouraille avec Planche 5 000, Peau 100, Bois de Frêne 200 (prix saisis via la page Prix ou une autre fiche) → Planche « Crafté », coût de craft 4 300 ; Bois de Frêne à 600 → « Acheté », 10 300 (quickstart.md, scénario 1).

### Tests for User Story 1

- [X] T011 [US1] Écrire tests/integration/intermediate-craft-costs.test.tsx (catalogue-repository simulé : `getItemDetail` renvoie la recette Dagues de Fouraille avec Planche `craftable: true` et Peau `craftable: false`, `getResourceRecipe` renvoie 10 × Bois de Frêne pour la Planche) : prix du carnet posés dans IndexedDB, puis vérifier le coût de craft 4 300 et l'indication « Crafté » avec « Achat : 5 000 » et « Craft : 2 000 », puis 10 300 et « Acheté » quand le Bois de Frêne vaut 600 ; vérifier qu'un ingrédient non craftable n'affiche aucune indication

### Implementation for User Story 1

- [X] T012 [US1] Dans src/features/search/RecherchePage.tsx : obtenir l'arbre via `useRecipeTree(detail.recipe, detail.resources)`, charger le carnet (`useResourcePrices`) pour `treeResourceIds(recipe, tree)` au lieu des seuls ingrédients de premier niveau, et calculer `result` avec `compare(recipe, effectiveIngredientPrices(recipe, tree, merged, {}), parseKamas(market))` où `merged` inclut les saisies en cours (`inputs`) pour toutes les ressources de l'arbre
- [X] T013 [US1] Dans src/features/search/RecherchePage.tsx, en Mode communautaire, appeler `fillCommunityGaps` pour toutes les ressources de l'arbre sans prix (research.md §7), puis rafraîchir les prix affichés ; ne rien faire en Mode personnel
- [X] T014 [US1] Sur chaque ligne de premier niveau d'un ingrédient craftable (src/features/search/RecherchePage.tsx), afficher l'option retenue (« Acheté », « Crafté » ou « Prix manquant ») et les montants connus « Achat : X · Craft : Y » (contracts/recipe-tree-ui.md), et calculer le sous-total affiché avec `quantité × unitKamas` ; ajouter à `ResourcePriceInput` (src/features/comparison/ResourcePriceInput.tsx) une prop facultative d'emplacement pour cette indication et une prop facultative `subtotalKamas` qui remplace le sous-total calculé depuis la saisie quand elle est fournie
- [X] T015 [P] [US1] Styles de l'indication d'option (badge acheté/crafté/manquant, montants) dans src/styles/global.css, lisibles en thème clair et sombre et dans les deux designs

**Checkpoint**: le coût de craft de la fiche tient compte des recettes intermédiaires dont les prix sont connus ; T011 vert.

---

## Phase 4: User Story 2 — Déplier la recette d'un ingrédient et saisir ses sous-ressources (Priority: P1)

**Goal**: chaque ingrédient craftable se déplie, récursivement, avec des champs de prix identiques à ceux du premier niveau.

**Independent Test**: déplier la Planche → « Bois de Frêne × 20 » ; saisir son prix → coût de recette et coût de craft mis à jour, prix visible dans la page Prix, aucun « coût de recette » dans le carnet (quickstart.md, scénario 2).

### Tests for User Story 2

- [X] T016 [US2] Compléter tests/integration/intermediate-craft-costs.test.tsx : bouton « Afficher la recette de Planche Agglomérée » (`aria-expanded`) absent sur la Peau (non craftable) ; après dépliage, ligne « Bois de Frêne » avec la quantité 20 ; saisie + perte de focus → carnet mis à jour pour le Bois de Frêne et coût de craft recalculé ; aucune entrée de carnet créée pour la Planche avec un coût de recette (FR-008) ; un niveau supplémentaire (sous-ressource craftable) se déplie à son tour

### Implementation for User Story 2

- [X] T017 [US2] Créer src/features/search/IngredientRow.tsx : ligne récursive recevant la ressource, la quantité cumulée, son `RetainedCost`, l'arbre et les rappels de prix ; rend le champ de prix existant (`ResourcePriceInput` en Mode personnel, la ligne communautaire actuelle en Mode communautaire, à déplacer depuis RecherchePage), le bouton de dépliage (libellés « Afficher la recette de {nom} » / « Masquer la recette de {nom} », `aria-expanded`, seulement si craftable ici), l'indication d'option (T014) et, une fois dépliée, les lignes enfants avec `quantité = quantité unitaire × quantité de la ligne parente` ; état replié par défaut, non conservé
- [X] T018 [US2] Remplacer dans src/features/search/RecherchePage.tsx le rendu des lignes de premier niveau par `IngredientRow`, en conservant exactement les règles de persistance actuelles (Mode personnel : enregistrement à la perte de focus si la valeur a changé ; Mode communautaire : `onPersist`/`onPrefill`, verrouillage, confirmation d'écart) pour toutes les profondeurs
- [X] T019 [P] [US2] Styles des lignes imbriquées (retrait par niveau, bouton de dépliage, lisibilité mobile à 390 px) dans src/styles/global.css

**Checkpoint**: la chaîne complète est visible et renseignable depuis la fiche ; T016 vert.

---

## Phase 5: User Story 3 — Forcer « acheter » ou « crafter » (Priority: P2)

**Goal**: le joueur force l'option d'un ingrédient, partout et durablement sur son appareil, et peut revenir en automatique.

**Independent Test**: Planche retenue « Crafté » → forcer « Acheter » : « Acheté (ton choix) », coût 10 300 ; autre fiche utilisant la Planche : même choix ; retour « Auto » : 4 300 (quickstart.md, scénario 3).

### Tests for User Story 3

- [X] T020 [P] [US3] Écrire tests/unit/ingredient-choices.test.ts : lecture vide par défaut, écriture/lecture d'un choix `'buy'`/`'craft'`, retour en automatique (suppression de l'entrée), JSON invalide ou valeur inconnue ignorés, `localStorage` indisponible → aucun choix sans exception
- [X] T021 [US3] Compléter tests/integration/intermediate-craft-costs.test.tsx : commande Auto · Acheter · Crafter (`aria-pressed`) sur la Planche, « Acheté (ton choix) » et coût 10 300 après « Acheter », choix conservé après démontage/remontage de la page, forcé « Acheter » sans prix d'achat → « Prix manquant » (pas de bascule), « Auto » rétablit 4 300

### Implementation for User Story 3

- [X] T022 [P] [US3] Créer src/persistence/ingredient-choices.ts : `getIngredientChoices(): Record<string, 'buy' | 'craft'>` et `setIngredientChoice(resourceId, choice: 'buy' | 'craft' | undefined)` sur la clé `localStorage` `craftcheck-ingredient-choices` (absence d'entrée = automatique ; lecture tolérante, écriture ignorée si le stockage échoue — research.md §8)
- [X] T023 [US3] Créer le hook `useIngredientChoices()` dans src/features/comparison/useIngredientChoices.ts (état initial depuis `getIngredientChoices`, `setChoice` qui persiste et met à jour l'état)
- [X] T024 [US3] Passer les choix forcés à `effectiveIngredientPrices` / `retainedCost` dans src/features/search/RecherchePage.tsx, et ajouter à src/features/search/IngredientRow.tsx la commande Auto · Acheter · Crafter (`aria-pressed`, seulement si craftable ici) et la mention « (ton choix) » dans l'indication d'option ; styles associés dans src/styles/global.css

**Checkpoint**: choix forcés fonctionnels et persistants ; T020 et T021 verts.

---

## Phase 6: User Story 4 — La page Suivis affiche le même coût que la fiche (Priority: P2)

**Goal**: `Craft : …` sur chaque carte = coût de la fiche pour les mêmes données.

**Independent Test**: suivre les Dagues de Fouraille avec les prix du scénario 1 → carte « Craft : 4 300 », identique à la fiche ; avec un choix forcé « Acheter » → 10 300 sur les deux (quickstart.md, scénario 4).

### Tests for User Story 4

- [X] T025 [US4] Écrire tests/integration/epingles-intermediate-costs.test.tsx (mêmes simulations que T011) : carte « Craft : 4 300 » ; après un choix forcé « Acheter » enregistré via `setIngredientChoice`, carte « Craft : 10 300 » ; en Mode communautaire, une sous-ressource sans prix est complétée par la médiane et compte dans le coût

### Implementation for User Story 4

- [X] T026 [US4] Dans src/features/catalogue/EpinglesPage.tsx : pour chaque objet suivi, `loadRecipeTree(detail.recipe, detail.resources)`, carnet chargé pour l'union des `treeResourceIds`, `fillCommunityGaps` sur cette union en Mode communautaire, puis `compare(recipe, effectiveIngredientPrices(recipe, tree, prices, getIngredientChoices()), marketPrice)` ; conserver l'affichage immédiat depuis le carnet puis la mise à jour (comportement actuel)

**Checkpoint**: Suivis et fiche concordent ; T025 vert.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T027 [P] Ajouter un renvoi vers specs/015-intermediate-craft-costs dans specs/001-craft-profit-comparison/spec.md (FR-009 : le coût de craft utilise désormais le coût retenu des ingrédients craftables) et dans specs/005-pinned-item-collections/spec.md (section Terminologie ou Hypothèses : le coût « Craft » des cartes suit la spec 015)
- [X] T028 [P] Mentionner la prise en compte des ressources intermédiaires dans la liste des fonctionnalités de README.md
- [X] T029 Dérouler les 4 scénarios de specs/015-intermediate-craft-costs/quickstart.md sur le serveur de dev (http://localhost:5173) en thème sombre, ordinateur et mobile, avec captures
- [X] T030 Validation finale : `npx tsc -b --noEmit`, `npx vitest run`, `npx eslint src tests`, `npm run build`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001)** → **Foundational (T002–T010)** → user stories.
- **US1 (T011–T015)** : dépend de la phase 2.
- **US2 (T016–T019)** : dépend de US1 (réutilise l'indication d'option et le calcul branché dans RecherchePage).
- **US3 (T020–T024)** : T020 et T022 peuvent démarrer après la phase 2 ; T024 dépend de US2 (commande placée dans `IngredientRow`).
- **US4 (T025–T026)** : dépend de la phase 2 seulement pour le coût automatique ; le cas du choix forcé de T025 dépend de T022.
- **Polish (T027–T030)** : après les stories voulues.

### Within Each Story

Tests écrits d'abord et en échec, puis implémentation jusqu'au vert.

### Parallel Opportunities

- Phase 2 : T002 et T003 en parallèle ; T009 en parallèle de T008 une fois T007 fait.
- T015 et T019 (CSS) en parallèle du code de leur story.
- T020 et T022 (choix forcés) en parallèle de la phase 4.
- US4 (T025–T026) en parallèle de US2/US3 une fois la phase 2 et T022 faites.
- T027 et T028 en parallèle.

---

## Parallel Example: Phase 2

```text
Task: "T002 Ajouter craftable et les types RetainedCost/RecipeTree dans src/domain/types.ts"
Task: "T003 Conserver hasRecipe → craftable dans src/services/dofusdb-mappers.ts"
```

## Parallel Example: User Story 3

```text
Task: "T020 Tests de src/persistence/ingredient-choices.ts dans tests/unit/ingredient-choices.test.ts"
Task: "T022 Créer src/persistence/ingredient-choices.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 puis phase 2 (calcul et chargement testés).
2. Phase 3 : le coût de la fiche intègre les recettes intermédiaires dès que les prix des
   sous-ressources existent dans le carnet.
3. **Valider** avec le scénario 1 du quickstart.

### Incremental Delivery

1. US1 → coût juste quand les prix sont connus.
2. US2 → saisie des sous-ressources depuis la fiche (rend US1 pleinement utilisable ; à livrer avec
   US1 en pratique).
3. US3 → choix forcés.
4. US4 → page Suivis alignée. À livrer **en même temps** que US1 si possible, pour ne jamais exposer
   deux coûts différents entre la fiche et Suivis.

---

## Notes

- Aucune modification de `compare()` (src/domain/craft-comparison.ts) ni du carnet : le coût d'une
  recette n'est jamais enregistré comme prix (FR-008).
- Commits par tâche ou par groupe logique ; déploiement uniquement quand US1, US2 et US4 sont faites
  ensemble.
