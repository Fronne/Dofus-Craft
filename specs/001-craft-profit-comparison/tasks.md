# Tasks: Comparaison rentabilité craft

**Input**: Design documents from `/specs/001-craft-profit-comparison/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [ui-and-storage.md](./contracts/ui-and-storage.md),
[quickstart.md](./quickstart.md)

**Tests**: Tests are required by the project constitution for calculation rules, data changes, and
user-visible workflows. Write the story test tasks first and ensure they fail before the matching
implementation tasks.

**Organization**: Tasks are grouped by user story so each can be implemented and validated as an
independent increment after the shared foundation is complete.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the single-client web project and its quality tooling.

- [X] T001 Create `package.json` with React, TypeScript, Vite, React Router, Vitest, React Testing Library, Playwright, and scripts `dev`, `build`, `typecheck`, `test`, and `test:e2e`.
- [X] T002 Create the planned source and test directory layout in `src/app/`, `src/components/`, `src/features/catalogue/`, `src/features/comparison/`, `src/domain/`, `src/data/`, `src/persistence/`, `src/styles/`, `tests/unit/`, `tests/integration/`, and `tests/e2e/`.
- [X] T003 [P] Configure TypeScript and Vite browser application settings in `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, and `vite.config.ts`.
- [X] T004 [P] Configure Vitest, Testing Library setup, coverage thresholds, and test commands in `vitest.config.ts` and `src/test/setup.ts`.
- [X] T005 [P] Configure Playwright desktop and 320-pixel mobile projects in `playwright.config.ts`.
- [X] T006 [P] Configure linting, formatting, and ignored build artifacts in `eslint.config.js`, `.prettierrc.json`, and `.gitignore`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish typed, traceable catalogue boundaries and the reusable application shell.

**⚠️ CRITICAL**: Complete this phase before beginning a user-story phase.

- [X] T007 Define shared domain types in `src/domain/types.ts`, enforcing verbatim constraints: item/category/resource/recipe IDs are “identifiant stable, non vide”; names and labels are “texte non vide”; `sortOrder` is an “entier positif”; and `imageUrl` is an “URL valide ou absente”.
- [X] T008 Implement catalogue manifest and catalogue validation in `src/data/catalogue-schema.ts`, enforcing `sourceName`, `sourceVersion`, and `catalogueVersion` as “texte non vide”, `sourceUrl` as “URL valide ou absente”, and `publishedAt` as “date/heure ISO 8601”.
- [X] T009 Create a versioned, traceable demonstration catalogue and manifest in `src/data/catalogue.json` and `src/data/catalogue-manifest.json`, including categories, objects, resources, two recipes sharing one resource, one object without recipe, and at least one missing visual.
- [X] T010 Implement the catalogue repository contract in `src/data/catalogue-repository.ts` with `searchItems`, `getItemDetail`, and `getManifest`, including case-insensitive text search, optional category filtering, explicit empty results, and explicit absent-recipe behavior.
- [X] T011 [P] Write catalogue repository and manifest validation tests in `tests/unit/catalogue-repository.test.ts` for stable references, search/filter behavior, provenance, missing visuals, and objects without recipes.
- [X] T012 Create the application bootstrap, router, global error boundary, and accessible layout in `src/main.tsx`, `src/app/App.tsx`, `src/app/router.tsx`, and `src/styles/global.css`.

**Checkpoint**: Catalogue data is traceable and queryable; application routes and test tooling run.

---

## Phase 3: User Story 1 - Comparer un objet (Priority: P1) 🎯 MVP

**Goal**: Let a player select an object, inspect its recipe, enter prices, and receive an accurate,
explainable craft-versus-HDV comparison.

**Independent Test**: With a seeded recipe, enter every resource price and a market price; verify
manually that all subtotals, total, difference, percentage basis, and craft/buy/equal decision match
the documented equations.

### Tests for User Story 1

- [X] T013 [P] [US1] Write unit tests first in `tests/unit/craft-comparison.test.ts` for complete craft, buy, equal, partial, missing-HDV, and zero-base percentage outcomes from `CraftComparison`.
- [X] T014 [P] [US1] Write integration tests first in `tests/integration/comparison-screen.test.tsx` for search, recipe display, price validation, missing-data states, and the fully explained recommendation.
- [X] T015 [P] [US1] Write the end-to-end primary comparison journey first in `tests/e2e/craft-comparison.spec.ts` using an object with a known recipe and manually verifiable totals.

### Implementation for User Story 1

- [X] T016 [P] [US1] Implement recipe validation and typed recipe lines in `src/domain/recipe.ts`, enforcing verbatim constraints: `Recipe.ingredients` is a “liste non vide”, `RecipeIngredient.resourceId` is a “référence à Resource”, `RecipeIngredient.quantity` is an “entier strictement positif”, and a recipe references each resource only once.
- [X] T017 [P] [US1] Implement pure `compare(recipe, prices, marketPrice)` logic in `src/domain/craft-comparison.ts` with `complete`/`partial`, `craft`/`buy`/`equal`/`insufficient-data`, known subtotals, missing-resource IDs, and no definitive recommendation for incomplete data.
- [X] T018 [P] [US1] Implement integer-kamas parsing, validation, formatting, and percentage-base labels in `src/domain/kamas.ts`, accepting only an integer ≥ 0, treating an empty value as unknown rather than zero, and suppressing percentages with a zero base.
- [X] T019 [US1] Build the catalogue search and selection controls in `src/features/catalogue/ItemSearch.tsx` and `src/features/catalogue/ItemResults.tsx`, using `searchItems` and exposing an explicit no-results state.
- [X] T020 [US1] Build the selected-object detail and recipe view in `src/features/catalogue/ItemDetail.tsx`, showing category, source/version metadata, image or accessible text fallback, recipe ingredients/quantities, and an explicit no-recipe state.
- [X] T021 [US1] Build resource-price and HDV-price input components in `src/features/comparison/ResourcePriceInput.tsx` and `src/features/comparison/MarketPriceInput.tsx`, with labelled fields, inline integer validation, and invalid-value recovery guidance.
- [X] T022 [US1] Build the explainable comparison result panel in `src/features/comparison/ComparisonResult.tsx`, rendering ingredient subtotals, partial cost, missing resources, recommendation, difference in kamas, percentage, and its explicit comparison base.
- [X] T023 [US1] Compose the primary selection-to-comparison flow in `src/features/comparison/ComparisonPage.tsx` and register it in `src/app/router.tsx`.

**Checkpoint**: A player can complete a correct, explainable comparison from a seeded catalogue;
the P1 unit, integration, and browser tests pass.

---

## Phase 4: User Story 2 - Réutiliser les prix de ressources (Priority: P2)

**Goal**: Persist a player’s resource prices and timestamps locally, reuse them in another recipe,
and allow safe updates.

**Independent Test**: Save a price for a resource in one recipe, open a second recipe that contains
it, reload the app, then verify that the price and its update date remain correct; update it and
verify the recalculation and timestamp change.

### Tests for User Story 2

- [X] T024 [P] [US2] Write repository contract tests first in `tests/integration/resource-price-repository.test.ts` for missing, save, overwrite, reload, and storage-failure states.
- [X] T025 [P] [US2] Write the shared-resource price journey first in `tests/e2e/resource-price-persistence.spec.ts` for two recipes using the same resource and a page reload.

### Implementation for User Story 2

- [X] T026 [P] [US2] Define the local price record and persistence contract in `src/persistence/resource-price-repository.ts`, enforcing verbatim constraints: `resourceId` is a “clé primaire, référence à Resource”, `unitPriceKamas` is an “entier supérieur ou égal à 0”, and `updatedAt` is a “date/heure ISO 8601”.
- [X] T027 [US2] Implement the IndexedDB-backed `get`, `getMany`, `save`, and `remove` operations in `src/persistence/indexeddb-resource-price-repository.ts`, using atomic save behavior and setting `updatedAt` only after confirmed persistence.
- [X] T028 [US2] Implement price hydration, save state, and storage-error handling in `src/features/comparison/useResourcePrices.ts`, preserving visible unsaved values when persistence fails.
- [X] T029 [US2] Integrate persistent resource prices and human-readable last-update dates into `src/features/comparison/ResourcePriceInput.tsx` and `src/features/comparison/ComparisonPage.tsx`.
- [X] T030 [US2] Add fixture coverage for the “absent → enregistré → mis à jour” price state transitions in `tests/integration/resource-price-repository.test.ts` and rerun the US1 comparison tests with hydrated prices.

**Checkpoint**: Resource prices are reused by stable resource ID after reload and remain editable,
with a visible, correct modification date.

---

## Phase 5: User Story 3 - Explorer le catalogue sur tout écran (Priority: P3)

**Goal**: Let a player browse by category and use the complete comparison experience on desktop and
mobile without inaccessible controls or horizontal scrolling.

**Independent Test**: Filter a category, select an item, and complete the comparison at desktop and
320-pixel mobile widths using keyboard navigation; no essential action or result is hidden.

### Tests for User Story 3

- [X] T031 [P] [US3] Write component tests first in `tests/integration/category-filter.test.tsx` for the required categories, result filtering, reset behavior, and accessible filter labels.
- [X] T032 [P] [US3] Write desktop and 320-pixel mobile browser scenarios first in `tests/e2e/catalogue-responsive.spec.ts` for category filtering, keyboard flow, and absence of horizontal page overflow.

### Implementation for User Story 3

- [X] T033 [US3] Build accessible category navigation in `src/features/catalogue/CategoryFilter.tsx` and connect it to `ItemSearch.tsx`, including amulette, anneau, cape, coiffe, ceinture, bottes, arme, trophée, and bouclier when supplied by the catalogue.
- [X] T034 [P] [US3] Define the Dofus-inspired but original visual tokens, typography, colour, focus, and state styles in `src/styles/theme.css`.
- [X] T035 [US3] Implement responsive catalogue and comparison layouts in `src/styles/global.css` and `src/styles/comparison.css`, keeping inputs, recipe lines, results, and update actions usable at 320 px without horizontal scrolling.
- [X] T036 [US3] Audit and correct keyboard focus order, visible focus, labels, image alternatives, live validation feedback, and contrast in `src/components/`, `src/features/catalogue/`, and `src/features/comparison/`.

**Checkpoint**: Filtering and the comparison flow are fully usable and test-verified on desktop and
mobile widths.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate all constitution gates, quality expectations, and the documented end-to-end
experience.

- [X] T037 [P] Add boundary and regression coverage in `tests/unit/craft-comparison.test.ts` and `tests/integration/comparison-screen.test.tsx` for invalid values, no recipe, absent visual, incomplete data, equal prices, and zero price bases.
- [X] T038 [P] Add a provenance and data-freshness presentation check in `tests/integration/catalogue-provenance.test.tsx` and `src/features/catalogue/ItemDetail.tsx`.
- [ ] T039 Run type checking, unit/integration tests, browser tests, and production build; record any failures and resolutions in `specs/001-craft-profit-comparison/quickstart.md`.
- [ ] T040 Perform every manual scenario in `specs/001-craft-profit-comparison/quickstart.md`, including desktop/mobile, persistence, incomplete data, and accessibility checks; update the guide only to correct observed instructions.
- [X] T041 Review `src/data/`, `src/domain/`, `src/persistence/`, and `src/features/` against the constitution’s traceability, correctness, explainability, cohesion, and local-data-safety rules; document any approved exception in `specs/001-craft-profit-comparison/plan.md`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; T003–T006 can proceed in parallel after T001.
- **Foundational (Phase 2)**: Depends on T001–T006; T007–T011 can proceed in parallel where their
  data/type dependencies permit; T012 follows the setup.
- **User Story 1 (Phase 3)**: Depends on the foundational phase. T013–T015 are written before
  T016–T023; T016–T018 can run in parallel.
- **User Story 2 (Phase 4)**: Depends on the foundational phase and reuses P1's displayed recipe
  flow for its end-to-end test; T024–T025 precede T026–T030.
- **User Story 3 (Phase 5)**: Depends on the foundational phase and uses P1's selection flow for
  its full browser validation; T031–T032 precede T033–T036.
- **Polish (Phase 6)**: Depends on all delivered user-story phases.

### User Story Dependencies

- **US1 (P1)**: Independent after Phase 2; recommended MVP.
- **US2 (P2)**: Its storage repository is independently testable after Phase 2; its player journey
  integrates with the P1 comparison screen.
- **US3 (P3)**: Its category control is independently testable after Phase 2; its responsive
  journey integrates with the P1 comparison screen.

### Parallel Opportunities

- Phase 1: T003, T004, T005, and T006 after T001.
- Phase 2: T008 and T011 after T007; T012 can proceed independently after setup.
- US1: T013, T014, and T015; then T016, T017, and T018.
- US2: T024 and T025; then T026.
- US3: T031 and T032; then T034.
- Polish: T037 and T038.

## Parallel Example: User Story 1

```text
Task: "Write unit comparison rules in tests/unit/craft-comparison.test.ts"
Task: "Write comparison-screen integration tests in tests/integration/comparison-screen.test.tsx"
Task: "Write primary journey in tests/e2e/craft-comparison.spec.ts"

Task: "Implement recipe validation in src/domain/recipe.ts"
Task: "Implement pure comparison logic in src/domain/craft-comparison.ts"
Task: "Implement kamas validation and formatting in src/domain/kamas.ts"
```

## Implementation Strategy

### MVP First

1. Complete Phases 1 and 2.
2. Complete US1 tasks T013–T023.
3. Validate its independent test and all P1 automated tests.
4. Demonstrate the complete manual price comparison before starting persistence or responsive
   refinement.

### Incremental Delivery

1. Deliver US1: complete, explainable comparison from the versioned catalogue.
2. Deliver US2: persistent, reusable resource prices with timestamps.
3. Deliver US3: category exploration and fully responsive, accessible presentation.
4. Complete Phase 6 before accepting the feature.
