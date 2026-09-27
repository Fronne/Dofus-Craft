---

description: "Task list — Page Familier (calculateur d'XP)"

---

# Tasks: Page Familier — calculateur d'XP et ressources les moins chères

**Input**: Design documents from `/specs/022-pet-xp-calculator/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/pet-xp-data.md, quickstart.md

**Tests**: inclus — la constitution (principe II) exige des tests automatisés pour toute règle de
calcul (cas normaux, bornes, entrées invalides ou incomplètes).

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [X] T001 Écrire le script `scripts/build-pet-xp-data.mjs` (Node, sans dépendance) : télécharger https://www.dofustool.com/tableau-xp-familier-dofus/ (en-tête User-Agent navigateur), extraire le 1er tableau (colonne « Xp Total », 100 niveaux) et le 2e (« Nom de la Ressource / XP Donné / Quantité Nécessaire », virgule décimale → point) ; écarter les lignes « XP donnée ≤ 0 » (`zero-xp`) et « quantité vide, "?" ou ≤ 0 » (`invalid-quantity`) ; pour un nom en double, garder une seule ligne si les valeurs sont identiques, sinon `conflicting-duplicate` (research.md §3) ; rattacher chaque nom via `https://api.dofusdb.fr/items?name.fr[$regex]=^<nom échappé>$&name.fr[$options]=i` en essayant aussi la variante oe ↔ œ, 8 requêtes en parallèle au plus ; exactement un résultat → `{ itemId, name, imageUrl (`https://api.dofusdb.fr/img/items/<iconId>.png`, `img` n’étant pas renvoyé avec `$select`), xpGiven, quantityNeeded, sourceName }`, zéro → `not-found`, plusieurs → `ambiguous` (research.md §2) ; écrire `src/data/pet-xp-data.json` au format de contracts/pet-xp-data.md (`source`, `sourceUrl`, `retrievedAt`, `cumulativeXpByLevel`, `foods` triés par nom, `unmatched`) et afficher un résumé (rattachées / écartées par raison)
- [X] T002 Lancer `node scripts/build-pet-xp-data.mjs`, relire le résumé (attendu ≈ 830 rattachées ; « Carapace Bleue/Jaune/Rouge/Verte » en `ambiguous`) et commiter `src/data/pet-xp-data.json`

---

## Phase 2: Foundational

- [X] T003 [P] Test des invariants du fichier dans `tests/unit/pet-xp-data.test.ts` : `cumulativeXpByLevel` a 100 valeurs strictement croissantes, niveau 1 = 1, niveau 100 = 196159 ; `itemId` uniques ; `xpGiven > 0` ; `quantityNeeded` entier > 0 ; `source`, `sourceUrl`, `retrievedAt` présents
- [X] T004 [P] Créer `src/domain/pet-xp.ts` avec les types `PetFood`, `PetLevelsInput`, `PetFoodRecommendation`, `PetFoodPlan` (data-model.md) et l'import typé de `src/data/pet-xp-data.json` exposant `PET_XP_CURVE`, `PET_FOODS` et la provenance
- [X] T005 Ajouter `ROUTES.pets = '/familier'` dans `src/app/router.tsx`

**Checkpoint** : données et types disponibles.

---

## Phase 3: User Story 1 — XP nécessaire pour atteindre un niveau (P1) 🎯 MVP

**Goal** : saisir niveau actuel, XP déjà gagnée, niveau cible et voir l'XP à donner.

**Independent Test** : 1 → 100 affiche 196 158 XP ; 50 → 60 affiche 3 141 XP, 2 991 avec 150 XP déjà gagnés.

- [X] T006 [P] [US1] Tests unitaires dans `tests/unit/pet-xp.test.ts` pour `xpNeeded` et `validatePetLevels` : 1→100 = 196158 ; 50→60 = 3141 ; 50→60 avec 150 = 2991 ; cible ≤ actuel → aucune XP ; niveau hors 1–100 ou non entier → erreur ; `xpInLevel` ≥ XP entre `currentLevel` et `currentLevel + 1` → erreur indiquant le maximum ; `xpInLevel` négatif → erreur
- [X] T007 [US1] Implémenter dans `src/domain/pet-xp.ts` : `xpBetweenLevels(level)`, `maxXpInLevel(level)` (= XP entre `level` et `level + 1`, − 1), `validatePetLevels(input)` (« `currentLevel` entier 1–99 », « `xpInLevel` entier ≥ 0, < XP entre `currentLevel` et `currentLevel + 1` ; 0 par défaut », « `targetLevel` entier 2–100 ») renvoyant les erreurs par champ, et `xpNeeded(input)` = cumul(cible) − (cumul(actuel) + xpInLevel), 0 si cible ≤ actuel
- [X] T008 [P] [US1] Créer `src/persistence/pet-levels-preference.ts` : `getPetLevels()` / `setPetLevels(input)` sur la clé `craftcheck-pet-levels`, lecture et écriture dans un try/catch, valeurs par défaut 1 / 0 / 100 si absentes ou invalides (FR-011)
- [X] T009 [US1] Créer `src/features/pets/FamilierPage.tsx` : titre « Familier », trois champs numériques (niveau actuel, XP déjà gagnée dans ce niveau, niveau cible), messages d'erreur par champ issus de `validatePetLevels`, résultat « XP nécessaire » formaté comme les autres montants de l'app, message « Aucune XP à donner » si cible ≤ actuel ; mémoriser la saisie via `setPetLevels` et l'initialiser via `getPetLevels`
- [X] T010 [US1] Dans `src/app/AppShell.tsx`, ajouter l'entrée de navigation « Familier » (icône existante la plus proche, sinon ajouter une icône `paw` dans `src/components/Icon.tsx`) et la route `ROUTES.pets` → `<FamilierPage priceMode={priceMode} />`
- [X] T011 [US1] Test d'intégration dans `tests/integration/familier-page.test.tsx` : saisie 50 → 60 affiche 3 141 ; avec 150 XP affiche 2 991 ; cible 40 affiche « Aucune XP à donner » ; XP déjà gagnée trop grande affiche le maximum possible ; les niveaux sont retrouvés après remontage de la page

**Checkpoint** : la page est utile seule, sans aucun prix.

---

## Phase 4: User Story 2 — Ressources les moins chères (P1)

**Goal** : lister les 10 ressources au coût total le plus bas pour l'XP demandée.

**Independent Test** : avec quelques prix connus, la première ligne a le coût total le plus bas, sa quantité et son coût sont justes.

- [X] T012 [P] [US2] Tests unitaires dans `tests/unit/pet-xp.test.ts` pour `planPetFood` : 1 000 XP avec 1 XP / 4 unités à 10 kamas → 4 000 unités, 40 000 kamas ; 1 000 XP à 1,25 XP / unité → 800 unités, 1 001 XP → 801 ; tri par coût croissant puis nom ; 10 lignes au plus ; ressources sans prix exclues et comptées dans `unpricedCount` ; xpNeeded = 0 → aucune ligne
- [X] T013 [US2] Implémenter `planPetFood(xpNeeded, foods, prices)` dans `src/domain/pet-xp.ts` : quantité = `Math.ceil(xpNeeded * quantityNeeded / xpGiven)` en arithmétique robuste aux flottants (xpGiven peut être décimal, ex. 1,25 ; arrondir le produit à 1e-9 près avant `ceil`), coût = quantité × prix unitaire, prix ≤ 0 ignoré, tri coût puis nom (`localeCompare` fr), 10 premières lignes, `unpricedCount` (research.md §5)
- [X] T014 [US2] Créer `src/features/pets/usePetFoodPrices.ts` : `(serverId, priceMode)` → `{ status: 'loading' | 'ready', prices: Record<itemId, { unitPriceKamas, date, origin: 'carnet' | 'community-median' }>, communityUnavailable: boolean }` ; lit `resourcePricesFor(priceMode).getMany(serverId, ids de PET_FOODS)` ; en Mode communautaire complète les manquants avec `getCommunityPrices(ids manquants, serverId)` (médiane `medianAmountKamas`, date `lastContributionAt`) **sans rien écrire dans le carnet** ; `communityUnavailable` si la requête échoue ; recharge quand le serveur ou le mode change (research.md §4)
- [X] T015 [US2] Dans `src/features/pets/FamilierPage.tsx`, afficher sous l'XP nécessaire la liste de `planPetFood` : icône, nom, XP par unité, prix unitaire, quantité, coût total ; état de chargement ; message si aucune ressource n'a de prix (« Aucune recommandation sans prix : saisissez des prix de ressources depuis la page Recherche ») ; recalcul à chaque changement de saisie, de serveur ou de mode (FR-010)
- [X] T016 [US2] Compléter `tests/integration/familier-page.test.tsx` : avec des prix du carnet simulés, les lignes sont triées par coût et la quantité / le coût de la première sont justes ; en Mode communautaire, une ressource sans prix du carnet prend la médiane simulée et rien n'est écrit dans le carnet

**Checkpoint** : la page recommande les ressources les moins chères.

---

## Phase 5: User Story 3 — Comprendre d'où viennent les chiffres (P2)

**Goal** : date de chaque prix, source des données d'XP, nombre de ressources sans prix.

**Independent Test** : chaque ligne montre la date de son prix ; la source et le nombre de ressources écartées sont affichés.

- [X] T017 [US3] Dans `src/features/pets/FamilierPage.tsx`, afficher la date du prix de chaque ligne avec le signalement d'ancienneté existant (`classifyPriceAge` de `src/domain/price-age.ts`, même rendu que la page Prix) et l'origine « médiane communautaire » le cas échéant
- [X] T018 [US3] Dans `src/features/pets/FamilierPage.tsx`, afficher sous la liste : « N ressources sans prix connu ne sont pas proposées », la source (lien vers `sourceUrl`, date `retrievedAt`) avec la mention que ces valeurs communautaires peuvent être incomplètes, et un message si les médianes communautaires sont indisponibles
- [X] T019 [US3] Compléter `tests/integration/familier-page.test.tsx` : date du prix visible sur une ligne ; nombre de ressources sans prix correct ; lien vers la source présent

---

## Phase 6: Polish

- [X] T020 [P] Scénario e2e `tests/e2e/familier-page.spec.ts` (helpers de `tests/e2e/helpers.ts`) : ouvrir « Familier » depuis la navigation, saisir 50 → 60, vérifier 3 141 XP ; avec un prix saisi pour une ressource, vérifier sa ligne
- [X] T021 Vérifier l'affichage mobile (largeur 375 px) de `src/features/pets/FamilierPage.tsx` : pas de défilement horizontal, liste lisible (styles dans le fichier CSS de page existant ou `src/styles/`)
- [X] T022 Lancer `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e` et dérouler quickstart.md

---

## Phase 7: Révision — tri au clic sur les colonnes (FR-007 révisé)

- [X] T023 [US2] Ajouter `PetFoodSort` / `DEFAULT_PET_FOOD_SORT` et un paramètre `sort` à `planPetFood` dans `src/domain/pet-xp.ts` (tri de toutes les ressources avec prix avant la coupe à 10 ; égalités : coût total puis nom), avec tests dans `tests/unit/pet-xp.test.ts`
- [X] T024 [US2] Remplacer l'en-tête statique de `src/features/pets/FamilierPage.tsx` par des boutons de tri (« Trier par … », flèche ↑/↓, premier sens selon la colonne), visibles aussi sur mobile, avec test dans `tests/integration/familier-page.test.tsx`

---

## Dependencies & Execution Order

- Setup (T001 → T002) → Foundational (T003–T005) → US1 → US2 → US3 → Polish.
- US2 dépend de US1 (même page, `xpNeeded`) ; US3 dépend de US2 (lignes de la liste).
- Dans chaque story : tests → domaine → persistance / hook → page → intégration.

## Parallel Opportunities

- T003 et T004 ; T006 et T008 ; T012 pendant T014 (fichiers différents) ; T020 pendant T021.

## Implementation Strategy

1. MVP = Phases 1–3 : la page donne l'XP nécessaire, sans prix.
2. Ajouter US2 (recommandations), puis US3 (traçabilité), puis le polish.
