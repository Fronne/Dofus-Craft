# Tasks: Filtre par exo et calibrage des bons plans

**Format**: `- [ ] T### [P?] [US?] Description avec chemin de fichier`

## Phase 1: User Story 1 - Filtre par exo (P1)

**Independent Test**: choisir un exo, puis une valeur, et vérifier les cartes restantes.

- [ ] T001 [US1] Dans `tests/unit/good-deals.test.ts`, remplacer les tests `exoOnly` et `effectId` de `selectGoodDeals` par ceux du filtre `exo` : avec et sans valeur, tri conservé (FR-004, FR-005).
- [ ] T002 [US1] Dans `src/domain/good-deals.ts`, remplacer `exoOnly` et `effectId` de `DealFilter` par `exo?: ExoFilter`, et ajouter `exoChoices(deals)` (FR-003).
- [ ] T003 [US1] Exporter `RunePicker` de `src/features/brisage/ExoRow.tsx` avec des libellés réglables, sans changer son rendu sur Brisage.
- [ ] T004 [US1] Dans `src/features/good-deals/BonsPlansPage.tsx`, retirer « Jet » et « Exo uniquement », ajouter le sélecteur, la valeur et le retrait (FR-001, FR-002, FR-006), et le style dans `src/styles/global.css`.
- [ ] T005 [US1] Dans `tests/integration/bons-plans-page.test.tsx`, adapter les tests de filtre et couvrir recherche, valeur, retrait.

## Phase 2: User Story 2 - Calibrage (P2)

**Independent Test**: changer une importance et voir la liste changer sans rechargement.

- [ ] T006 [US2] Dans `tests/unit/good-deals.test.ts`, tester le calibrage : importance, écart remplacé, `null` sans défaut, seuil, résultats identiques sans calibrage (FR-016).
- [ ] T007 [US2] Dans `src/domain/good-deals.ts`, ajouter `DealCalibration` et l'accepter dans `acceptedGap`, `jetQuality`, `evaluateListings`.
- [ ] T008 [US2] Créer `tests/unit/deal-calibration.test.ts` et `src/features/good-deals/deal-calibration.ts` : lecture tolérante, écriture, stockage indisponible (FR-013).
- [ ] T009 [US2] Dans `src/features/good-deals/useGoodDeals.ts`, garder les annonces lues et rejuger selon le calibrage (FR-012, FR-011).
- [ ] T010 [US2] Créer `src/features/good-deals/CalibrationPanel.tsx` (FR-007 à FR-011, FR-014) et son style dans `src/styles/global.css`.
- [ ] T011 [US2] Brancher le panneau dans `src/features/good-deals/BonsPlansPage.tsx` et couvrir dans `tests/integration/bons-plans-page.test.tsx` recalcul, rechargement et réinitialisation.

## Phase 3: Polish

- [ ] T012 Lancer les tests de la page, le typage, puis `npm run test`.
- [ ] T013 Lancer le sous-agent `relecteur`, corriger les points graves, donner l'URL du serveur de développement.

## Dependencies

US1 puis US2 : même page. T009 dépend de T007, T010 de T008.
