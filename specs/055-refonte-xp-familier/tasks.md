# Tasks: Refonte de la page XP Familier

**Input**: Design documents from `/specs/055-refonte-xp-familier/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui-contract.md, quickstart.md

**Tests**: inclus — la constitution (principe II) exige des tests pour tout nouveau chiffre calculé,
et les tests d'intégration existants de la page doivent suivre la nouvelle disposition.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

Aucune tâche : pas de dépendance ni de configuration nouvelles.

## Phase 2: Foundational (classement commun)

- [X] T001 Ajouter `rankPetFoods(xp, foods, prices, maxQuantity, xpMultiplier)` dans src/domain/pet-xp.ts : `planPetFood(xp, foods, prices, Infinity, DEFAULT_PET_FOOD_SORT, xpMultiplier)` puis `capPetFoodQuantity(…, maxQuantity).shown`, chaque ligne enrichie de `rank = index + 1` (type `RankedPetFood`) ; liste vide si `xp ≤ 0` (research.md §1)
- [X] T002 [P] Tests unitaires de `rankPetFoods` dans tests/unit/pet-xp.test.ts : ordre par coût total, rangs 1…n, plafond appliqué (ligne au-delà absente), Almanax ×1,5, ressources sans prix exclues, `xp = 0` → vide

**Checkpoint**: le classement global existe et est testé.

## Phase 3: User Story 1 — bandeau objectif (P1) 🎯 MVP

**Goal**: saisies, barre de progression, XP à donner en grand et Almanax réunis dans un bandeau.

**Independent Test**: niveau 85 → 100 : barre 26,2 %, « Niveau 85 · 47 003 XP », XP à donner 132 589.

- [X] T003 [US1] Ajouter `petXpProgress(totalXp)` dans src/domain/pet-xp.ts → `{ level, totalXp, percent }`, `percent = totalXp ÷ maxTotalXp() × 100` « arrondi à 0,1 » (data-model.md)
- [X] T004 [P] [US1] Tests unitaires de `petXpProgress` dans tests/unit/pet-xp.test.ts : 0 XP → 0 % niveau 0 ; 47 003 → 26,2 % niveau 85 ; 179 592 → 100 % niveau 100
- [X] T005 [US1] Créer src/features/pets/PetObjectiveBanner.tsx : `section` « Objectif du familier » avec les champs actuels (rendus par la page via props), le `progressbar` « Progression du familier » (`aria-valuenow` arrondi, `aria-valuetext` « 26,2 %, niveau 85 »), repère en losange, bornes « Niveau N · X XP » / « Niveau 100 · 179 592 XP », bloc « XP à donner » en grand (`role="status"`, ou « Aucune XP à donner : le niveau visé est déjà atteint. », ou « — »), interrupteur Almanax actuel (contracts/ui-contract.md, bloc 1)
- [X] T006 [US1] Remplacer la section `pet-levels-panel` de src/features/pets/FamilierPage.tsx par `PetObjectiveBanner` (mêmes champs, mêmes erreurs, même mémorisation)
- [X] T007 [P] [US1] Styles du bandeau dans src/styles/global.css (section « specs/022 … Familier page ») : disposition saisies + barre à gauche, encadré « XP à donner » vert à droite (maquette), barre dégradé turquoise → vert, empilement sous 720 px, thème clair via les variables existantes
- [X] T008 [US1] Adapter tests/integration/familier-page.test.tsx aux textes du bandeau (XP à donner, barre de progression, Almanax) ; ajouter un test de la barre (valeur et bornes)

**Checkpoint**: le bandeau fonctionne seul ; le reste de la page est inchangé.

## Phase 4: User Story 2 — podium (P1)

**Goal**: les 3 moins chères en grandes cartes, écart avec la 1re.

**Independent Test**: les 3 cartes suivent l'ordre du coût total ; « +N kamas » = coût − coût de la 1re ; le filtre du tableau ne les change pas.

- [X] T009 [US2] Ajouter `petFoodPodium(ranked)` dans src/domain/pet-xp.ts : 3 premiers (moins s'il y en a moins), chacun avec `gapKamas = totalKamas − ranked[0].totalKamas` (data-model.md, PodiumEntry)
- [X] T010 [P] [US2] Tests unitaires de `petFoodPodium` dans tests/unit/pet-xp.test.ts : 3 entrées et écarts, 2 ressources → 2 entrées, 0 → vide, 1re écart 0
- [X] T011 [US2] Créer src/features/pets/PetFoodPodium.tsx : `section` titrée « Les moins chères pour cet objectif » + « Prix de l'HDV, serveur X » ; `list` de cartes `article` (`ResourceDisplay` pour l'image, `h3` nom, rang « 1re · la moins chère » / « 2e · +N kamas » / « 3e · +N kamas » avec `Kamas`, coût total en grand avec `Kamas`, `dl` Quantité / Prix unitaire / XP / unité, âge du prix avec les classes `market-date--stale` / `market-date--expired` via `classifyPriceAge`)
- [X] T012 [US2] Dans src/features/pets/FamilierPage.tsx, calculer `ranked = rankPetFoods(xp, PET_FOODS, prices, maxQuantity, multiplier)` et afficher `PetFoodPodium` entre le bandeau et le tableau, seulement quand des prix sont chargés et `ranked` non vide ; les messages d'état actuels (aucun serveur, chargement, service indisponible, aucun prix, tout au-dessus du plafond) restent à la place des blocs 2 et 4
- [X] T013 [P] [US2] Styles du podium dans src/styles/global.css : grille `repeat(auto-fit, minmax(min(300px, 100%), 1fr))`, 1re carte bordure verte et fond dégradé, coût en Rowdies or, cartes en colonne sur téléphone
- [X] T014 [US2] Tests d'intégration du podium dans tests/integration/familier-page.test.tsx : 3 cartes dans l'ordre, écarts affichés, podium inchangé quand on tape dans le filtre du tableau, 2 cartes seulement avec 2 prix

**Checkpoint**: US1 + US2 = la réponse principale est lisible sans défiler.

## Phase 5: User Story 3 — ressource précise (P2)

**Goal**: chercher une ressource et voir sa fiche.

**Independent Test**: Kamatrix (24,846 XP, 597 k) pour 132 589 XP : 5 337 unités, 3 186 189 k, « 0,019 % ».

- [X] T015 [US3] Ajouter `petFoodTarget(food, xp, prices, ranked, maxQuantity, xpMultiplier)` dans src/domain/pet-xp.ts, avec `standing` `ranked` (`rank`, `gapPercent` « arrondi à 0,1 »), `capped` (`maxQuantity`) ou `unpriced`, et `sharePercent = min(100, xpPerUnit ÷ xp × 100)` (data-model.md, PetFoodTarget) ; ajouter `formatObjectiveShare(percent)` (2 chiffres significatifs, fr-FR, research.md §4)
- [X] T016 [P] [US3] Tests unitaires dans tests/unit/pet-xp.test.ts : fiche classée (rang, écart %), 1re → écart 0, sans prix → `unpriced`, au-delà du plafond → `capped`, Almanax, part plafonnée à 100 %, `formatObjectiveShare(0.01874)` → « 0,019 »
- [X] T017 [US3] Créer src/features/pets/PetFoodTarget.tsx : `section` « Viser une ressource précise » ; `searchbox` « Rechercher une ressource à viser » ; à partir de 2 caractères, `group` « Suggestions » d'au plus 8 `button` (image + nom, ordre alphabétique, `normalizeSearchText` sur `PET_FOODS`), « Ne correspond à aucune ressource » sinon ; un choix vide les suggestions et met le nom dans le champ ; fiche `region` « Fiche de <nom> » : image, nom, « X XP par unité · Ne la moins chère » ou « Non classée (plus de N unités) », Quantité, Prix unitaire, Coût total, Écart avec la 1re, « 1 unité = » ; « Prix inconnu » sans prix (contracts/ui-contract.md, bloc 3)
- [X] T018 [US3] Brancher `PetFoodTarget` dans src/features/pets/FamilierPage.tsx sous le podium : `itemId` choisi gardé dans l'état de la page (non mémorisé), fiche recalculée à chaque rendu ; bloc affiché dès que l'XP à donner > 0, même sans prix
- [X] T019 [P] [US3] Styles du bloc dans src/styles/global.css : champ pleine largeur, suggestions en grille, fiche en ligne (image + nom / chiffres en `dl` grille auto-fit), écart en corail
- [X] T020 [US3] Tests d'intégration dans tests/integration/familier-page.test.tsx : chercher, choisir, fiche chiffrée ; fiche sans prix ; fiche au-delà du plafond ; fiche recalculée avec l'Almanax

## Phase 6: User Story 4 — tableau des autres ressources (P2)

**Goal**: le tableau commence après le podium, avec un rang.

**Independent Test**: lignes à partir du rang 4 ; tri par XP sans changement de rang.

- [X] T021 [US4] Dans src/features/pets/FamilierPage.tsx : titre « Toutes les ressources », champ renommé « Filtrer les ressources », lignes `capped.shown` privées des `itemId` du podium avant l'affichage par 25, rang lu dans `ranked` ; tableau absent quand il ne reste aucune ligne hors podium et aucun filtre
- [X] T022 [US4] Dans `SortHeader` et `FoodLine` de src/features/pets/FamilierPage.tsx : première colonne « Rang » (en-tête non cliquable, cellule `rank`)
- [X] T023 [P] [US4] Styles dans src/styles/global.css : colonne rang de `.pet-food-row` (grille élargie), rang en gris, lignes plus hautes, tableau défilant horizontalement dans son cadre sous 720 px
- [X] T024 [US4] Adapter les tests existants du tableau dans tests/integration/familier-page.test.tsx (titre, nom du filtre, 25 lignes après le podium, tri, plafond, messages) et ajouter : rang 4 en tête, rangs inchangés après tri et filtre

## Phase 7: Polish

- [X] T025 Adapter tests/e2e/familier-page.spec.ts à la nouvelle page (bandeau, podium, tableau) — adapté ; non exécuté ici (navigateurs Playwright absents du poste)
- [X] T026 Mettre à jour le commentaire d'en-tête de src/features/pets/FamilierPage.tsx (specs/022 + specs/055) et retirer les classes CSS de l'ancien bandeau devenues inutiles dans src/styles/global.css
- [X] T027 Lancer `npx tsc -b --noEmit`, `npx eslint src tests`, `npx vitest run` ; dérouler quickstart.md dans le navigateur (desktop, 375 px, thème clair)

## Dependencies & Execution Order

- Phase 2 (T001-T002) avant US2, US3, US4 (classement commun). US1 n'en dépend pas.
- US1 → US2 → US3 → US4 dans l'ordre de la page, car toutes modifient src/features/pets/FamilierPage.tsx.
- Dans chaque story : fonction de domaine → ses tests [P] → composant → branchement → styles [P] → tests d'intégration.

## Parallel Opportunities

- Tests unitaires (T002, T004, T010, T016) en parallèle de l'écriture des composants.
- Styles (T007, T013, T019, T023) en parallèle des composants de la même story.

## Implementation Strategy

- **MVP** : Phase 2 + US1 + US2 (bandeau et podium) — la question principale a sa réponse en haut de page.
- Puis US3 (fiche) et US4 (tableau avec rang), puis Polish.
