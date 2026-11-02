# Tasks: Aide du calibrage et accès réservé aux bons plans

**Format**: `- [ ] T### [P?] [US?] Description avec chemin de fichier`

## Phase 1: User Story 1 - Comprendre le calibrage (P1)

**Independent Test**: ouvrir le panneau et lire colonnes, niveaux et explication.

- [X] T001 [US1] Dans `tests/integration/bons-plans-page.test.tsx`, vérifier l'explication, les cinq niveaux et les titres de colonnes (FR-001 à FR-005).
- [X] T002 [US1] Dans `src/features/good-deals/CalibrationPanel.tsx`, ajouter l'explication et les titres ; niveaux tirés de `IMPORTANCE_LEVELS`.
- [X] T003 [US1] Dans `src/styles/global.css`, passer la liste sur une colonne à largeurs fixes et aligner les titres (FR-005).

## Phase 2: User Story 2 - Réserver la page (P1)

**Independent Test**: page coupée, activer puis retirer l'accès par l'adresse.

- [X] T004 [P] [US2] Créer `tests/unit/bons-plans-access.test.ts` et `src/persistence/bons-plans-access.ts` : `1`, `0`, autre valeur, stockage refusé, adresse nettoyée (FR-006, FR-007, FR-010).
- [X] T005 [US2] Dans `src/app/AppShell.tsx`, surcharger `bonsPlansPage` avec l'accès local (FR-008, FR-009).
- [X] T006 [US2] Dans `tests/integration/site-pages-toggle.test.tsx`, couvrir page coupée sans accès, avec accès, et retrait.

## Phase 3: Polish

- [X] T007 Lancer le typage avec `npx tsc -b`, puis `npm run test`.
- [X] T008 Lancer le sous-agent `relecteur` et corriger les points graves.

## Dependencies

US1 et US2 sont indépendantes. T005 dépend de T004.
