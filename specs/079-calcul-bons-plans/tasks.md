# Tasks: Calcul des bons plans selon la valeur de marché

**Input**: documents de `specs/079-calcul-bons-plans/`

**Format**: `- [ ] T### [P?] [US?] Description avec chemin de fichier`

Les tests sont demandés par la constitution (principe II) : normaux, limites, entrées incomplètes. Tout se joue dans deux fichiers, donc aucune tâche n'est parallélisable.

## Phase 1: User Story 1 - Palier d'exo (P1)

**Goal**: ne plus comparer des exos de part et d'autre du palier de 30.

**Independent Test**: deux groupes d'exemplaires avec le même exo à 15 et à 30 de poids ne se servent pas de référence.

- [ ] T001 [US1] Dans `tests/unit/good-deals.test.ts`, ajouter les tests d'échec d'abord : `Dommages aux sorts (%)` à 1 et 2 non comparables, à 2 et 3 comparables, `Critique (%)` à 2 et 3 non comparables, exo Sagesse à 9 et 10 non comparables.
- [ ] T002 [US1] Dans `src/domain/good-deals.ts`, ajouter `EXO_WEIGHT_TIER = 30`, le champ `exoTiers` de `JetQuality` (FR-001, FR-002) et comparer `exoTiers` au lieu de `exoEffectIds` dans `evaluateListings` (FR-003). `exoEffectIds` reste exposé tel quel.

## Phase 2: User Story 2 - Écart au maximum (P2)

**Goal**: ne comparer que des exemplaires avec les mêmes défauts.

**Independent Test**: un exemplaire sans défaut parmi des exemplaires qui en ont tous un n'est pas jugé.

- [ ] T003 [US2] Dans `tests/unit/good-deals.test.ts`, ajouter les tests d'échec d'abord : Force à 5 et 6 sous le max, Dommages Neutre à 5 et 6, Dommages Terre à 1 et 2, Critique et PA à 0 et 1, Dommages Critiques avec max 20 et 21, Vitalité sur max 100 (12) et 400 (30), ligne absente, valeur au-dessus du max, Dommages Poussée jamais en défaut, bornes inconnues sans défaut, deux défauts différents non comparables.
- [ ] T004 [US2] Dans `src/domain/good-deals.ts`, ajouter `acceptedGap(effectId, max)` selon FR-009 (indéfini pour FR-010), le champ `defectEffectIds` de `JetQuality` (FR-008) et l'égalité des défauts dans `evaluateListings` (FR-011).
- [ ] T005 [US2] Dans `tests/unit/good-deals.test.ts`, revoir les jeux d'essai existants pour que leurs jets restent comparables entre eux et gardent le sens de chaque test (research R6).

## Phase 3: User Story 3 - Importance des stats (P3)

**Goal**: noter un jet selon ce que paient les joueurs.

**Independent Test**: deux jets qui ne diffèrent que par la Sagesse ont des qualités proches.

- [ ] T006 [US3] Dans `tests/unit/good-deals.test.ts`, ajouter les tests d'échec d'abord : un coefficient de chaque groupe de FR-004, une stat connue hors tableau à 1 (FR-005), une ligne à 0 absente de la qualité, un exo cumulant le facteur 1,5 et son coefficient.
- [ ] T007 [US3] Dans `src/domain/good-deals.ts`, ajouter le tableau `STAT_IMPORTANCE` (FR-004, FR-006), signalé comme point de départ à ajuster, et l'appliquer à `quality` dans `jetQuality`. `src/domain/brisage.ts` ne change pas (FR-007).

## Phase 4: Polish

- [ ] T008 Mettre à jour le commentaire d'en-tête de `src/domain/good-deals.ts` et lancer `npx vitest run tests/unit/good-deals.test.ts tests/integration/bons-plans-page.test.tsx`, puis `npm run test`.
- [ ] T009 Rejouer la mesure sur l'instantané de 2935 annonces avec le vrai code et comparer aux chiffres de SC-002 et SC-003 (`specs/079-calcul-bons-plans/spec.md`).
- [ ] T010 Lancer le sous-agent `relecteur`, corriger les points graves, donner l'URL du serveur de développement.

## Dependencies

US1, puis US2, puis US3 : même fichier, et T005 dépend de T004. Le MVP est US1, qui retire les faux bons plans les plus visibles.
