# Tasks: Modes personnel et communautaire de gestion des prix

**Input**: Design documents from `/specs/003-community-price-mode/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [price-mode-preference.md](./contracts/price-mode-preference.md),
[quickstart.md](./quickstart.md)

**Tests**: Tests are required by the project constitution for calculation/persistence rules, data
changes, and user-visible workflows. Write the story test tasks first and ensure they fail before
the matching implementation tasks.

**Organization**: Tasks are grouped by user story so each can be implemented and validated as an
independent increment after the shared foundation is complete. Per the plan's decision of scope
(spec.md § Décision de cadrage), this feature ships only the mode-selection framework and its
confidentiality/data-safety guarantees — no community backend, transport, or aggregation code is
written; User Stories 1–4 below cover exactly what is in scope.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the existing tooling covers this feature; no new dependency is introduced.

- [X] T001 Confirm no new dependency is required beyond the existing React 19, Vite, Vitest, React Testing Library, and Playwright tooling (per plan.md § Technical Context); confirm `src/features/comparison/` and `src/persistence/` are the target directories for the new files listed in plan.md § Project Structure.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the `PriceMode` type and its persistence, which every user story depends on.

**⚠️ CRITICAL**: Complete this phase before beginning a user-story phase.

- [X] T002 [P] Define the `PriceMode` type (`'personal' | 'community'`) and the two modes' labels/short explanations in `src/domain/price-modes.ts`, enforcing verbatim the data-model.md constraint: `mode` is `'personal'` \| `'community'`, "jamais une autre valeur"; include, for each mode, the exact explanatory text required by spec.md FR-003 (personal: usage exclusif des prix personnels, jamais partagés; community: consultation/contribution communautaires — à venir dans cette itération).
- [X] T003 [P] Implement `getPriceMode`/`setPriceMode` in `src/persistence/price-mode-preference.ts` under storage key `craftcheck-price-mode`, following the pattern of `src/persistence/accent-color-preference.ts` (try/catch around `localStorage`, validated value); enforce verbatim the contract in contracts/price-mode-preference.md: `getPriceMode` is a synchronous read that "retourne toujours `'personal'` si aucune valeur valide n'est en stockage", and `setPriceMode` "n'effectue et ne déclenche aucune opération sur `ResourcePrice` ou `PinnedItemPrice`".
- [X] T004 [P] Write unit tests first in `tests/unit/price-mode-preference.test.ts` for `getPriceMode`/`setPriceMode` (T003): defaults to `'personal'` when nothing is stored, defaults to `'personal'` when the stored value is invalid/corrupted, persists a valid choice across a simulated reload, and never throws when `localStorage` is unavailable.

**Checkpoint**: The `PriceMode` type and its persistence exist and are proven correct in isolation.
No UI exists yet; `ComparisonPage.tsx` is unchanged.

---

## Phase 3: User Story 1 - Choisir son mode de gestion des prix depuis les paramètres (Priority: P1) 🎯 MVP

**Goal**: Let the player see both modes with their explanation in the settings, and select one,
with the active mode always identifiable.

**Independent Test**: Open settings; verify both modes are presented with their explanation;
select the community mode and verify it is immediately identified as active.

### Tests for User Story 1

- [X] T005 [P] [US1] Write integration tests first in `tests/integration/price-mode-settings.test.tsx` for the settings mode selector: both modes render with their explanatory text (T002); the personal mode is identified as active by default on first visit; selecting the community mode makes it immediately identified as active; the selector never exposes more than the two modes (FR-001, FR-002, FR-003).

### Implementation for User Story 1

- [X] T006 [US1] Add the price-mode selector to the settings area of `src/features/comparison/ComparisonPage.tsx`, next to the existing theme toggle and accent-color picker (reusing the same `<details>`/`<summary>` disclosure pattern already used for the accent picker): render the two modes from `src/domain/price-modes.ts` (T002) with their explanatory text, read the active mode via `getPriceMode()` (T003) on initial state, call `setPriceMode()` on selection, and mark the active mode clearly (e.g. `aria-pressed`/selected styling, mirroring the existing theme-toggle/accent-swatch pattern).
- [X] T007 [P] [US1] Add styles for the price-mode selector (option cards, explanatory text, active-mode indicator) in `src/styles/global.css`, following the existing `.theme-toggle`/`.accent-picker` visual language already defined there.

**Checkpoint**: A player can see and choose their price-management mode from settings, with a
clear indication of which mode is active; US1 automated tests pass.

---

## Phase 4: User Story 2 - Changer de mode sans jamais perdre ses prix personnels (Priority: P1)

**Goal**: Guarantee that switching between modes never alters, clears, or merges personal prices.

**Independent Test**: In personal mode, enter prices for two resources; switch to community mode;
switch back to personal mode; verify both prices are unchanged, including after repeating the
round trip and reloading the page in between.

### Tests for User Story 2

- [X] T008 [P] [US2] Write integration tests first in `tests/integration/price-mode-preserves-personal-prices.test.tsx`: enter personal resource prices, switch the mode selector (T006) to community and back to personal multiple times, and assert the prices and their `updatedAt` values are byte-for-byte unchanged after each round trip (FR-006, FR-007, FR-008; data-model.md § Invariants).
- [X] T009 [P] [US2] Extend `tests/e2e/price-mode.spec.ts` (new file) with the full round-trip journey: enter prices for two resources in personal mode, switch to community mode, reload the page, switch back to personal mode, and verify both prices are restored exactly as entered (quickstart.md § 2).

### Implementation for User Story 2

- [X] T010 [US2] Audit `src/features/comparison/ComparisonPage.tsx` to confirm the price-mode state (T006) is never added as a dependency of the existing `useEffect(() => { setInputs({}); }, [serverId]);` or of any other effect/state that reads or clears `inputs`, `market`, or resource/pinned-item price data — the price-mode selection must trigger no read, write, or reset of `ResourcePrice`/`PinnedItemPrice` state (FR-006, FR-007; contracts/price-mode-preference.md § Validation visible).

**Checkpoint**: Switching modes, including repeatedly and across reloads, never alters personal
prices; US1 and US2 automated tests pass together.

---

## Phase 5: User Story 3 - Aucun prix personnel n'est jamais transmis hors de l'appareil (Priority: P1)

**Goal**: Guarantee that no personal price is ever sent over the network, in either mode, for as
long as the community infrastructure remains deferred.

**Independent Test**: Activate community mode; enter and modify personal prices; inspect network
traffic and verify no price-related request is ever made.

### Tests for User Story 3

- [X] T011 [US3] Extend `tests/e2e/price-mode.spec.ts` (T009) with a network-observation scenario: with community mode active, intercept all network requests (e.g. Playwright `page.on('request', ...)`) while entering and modifying personal prices, and assert none of them relates to price data (FR-009, FR-010, SC-002).

### Implementation for User Story 3

- [X] T012 [US3] Review `src/features/comparison/ComparisonPage.tsx`, `src/persistence/price-mode-preference.ts` (T003), and `src/domain/price-modes.ts` (T002) to confirm no network client (`fetch`, `XMLHttpRequest`, or any HTTP library) is introduced for price data by this feature, per research.md § Garantie de non-transmission réseau; no code change expected beyond this confirmation — record the review outcome in a short note appended to `specs/003-community-price-mode/quickstart.md`.

**Checkpoint**: No price data ever leaves the browser in either mode; US1, US2, and US3 automated
tests pass together.

---

## Phase 6: User Story 4 - Comprendre clairement que la consultation communautaire est à venir (Priority: P2)

**Goal**: Show a clear, persistent notice when community mode is active, explaining that community
consultation/contribution are not yet available, while personal prices keep working normally.

**Independent Test**: Select community mode; verify a clear notice states community prices are not
yet available; verify personal prices remain displayed and editable; verify the notice disappears
immediately on returning to personal mode.

### Tests for User Story 4

- [X] T013 [P] [US4] Write integration tests first in `tests/integration/price-mode-notice.test.tsx` for `src/features/comparison/PriceModeNotice.tsx`: renders the "à venir" message only when the active mode is `'community'`; renders nothing in personal mode; stays visible across a simulated re-render/navigation while community mode remains active (i.e. it is not permanently dismissible, unlike `PinnedPriceMigrationNotice`), per data-model.md § PriceModeNotice.

### Implementation for User Story 4

- [X] T014 [P] [US4] Implement `src/features/comparison/PriceModeNotice.tsx`, modeled on `src/features/server/PinnedPriceMigrationNotice.tsx` (`role="status"`), rendering the notice whenever the active price mode is `'community'` and rendering `null` otherwise; do not persist a "dismissed" state, since the notice must reappear as long as `mode === 'community'` (FR-011; data-model.md § PriceModeNotice, "n'est pas fermable de façon permanente").
- [X] T015 [US4] Mount `PriceModeNotice` (T014) in `src/features/comparison/ComparisonPage.tsx`, passing the active price mode from the state introduced in T006, positioned so it is visible alongside the recipe/resource prices currently displayed (FR-012).
- [X] T016 [P] [US4] Add styles for the notice banner in `src/styles/global.css`, reusing the existing `.pinned-price-migration-notice` visual language where appropriate.

**Checkpoint**: Selecting community mode always shows a clear, honest "coming soon" notice while
personal prices keep working exactly as in personal mode; US1–US4 automated tests pass together.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validate the default-mode edge case, all constitution gates, and the documented
end-to-end experience.

- [X] T017 [P] Add regression coverage for the no-preference default (spec.md § Edge Cases) in `tests/unit/price-mode-preference.test.ts` (T004) and `tests/integration/price-mode-settings.test.tsx` (T005): a cleared/unavailable `localStorage` resolves to personal mode without ever blocking access to the rest of the application, unlike the blocking server selector of 002-server-scoped-prices.
- [X] T018 Run type checking, unit/integration tests, browser tests, and production build; record any failures and resolutions in `specs/003-community-price-mode/quickstart.md`.
- [X] T019 Perform every manual scenario in `specs/003-community-price-mode/quickstart.md`, including the network-inspection scenario (§ 3) and the default-mode scenario (§ 5); update the guide only to correct observed instructions.
- [X] T020 Review `src/domain/price-modes.ts`, `src/persistence/price-mode-preference.ts`, and `src/features/comparison/` against the constitution's traceability, correctness, explainability, cohesion, and local-data-safety rules; confirm the plan's Constitution Check re-affirmation (plan.md § Post-design re-check) still holds and that spec.md § Décisions actées pour une itération future remains unmodified by this implementation.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately.
- **Foundational (Phase 2)**: Depends on Setup; T002 and T003 can proceed in parallel; T004 depends on T003 — the phase BLOCKS all user stories.
- **User Story 1 (Phase 3)**: Depends on the Foundational phase. T005 precedes T006; T007 can run in parallel with T006.
- **User Story 2 (Phase 4)**: Depends on the Foundational phase and on the selector built in US1 (T006) to exercise its own independent test; T008–T009 precede T010.
- **User Story 3 (Phase 5)**: Depends on the Foundational phase and on the selector built in US1 (T006); T011 precedes T012.
- **User Story 4 (Phase 6)**: Depends on the Foundational phase and on the mode state introduced in US1 (T006); T013 precedes T014–T016.
- **Polish (Phase 7)**: Depends on all delivered user-story phases.

### User Story Dependencies

- **US1 (P1)**: Independent after Phase 2; recommended MVP (the player must be able to see and choose a mode before anything else in this feature is meaningful).
- **US2 (P1)**: Independently testable after Phase 2, but its player journey exercises the selector built in US1.
- **US3 (P1)**: Independently testable after Phase 2, but its player journey exercises the selector built in US1.
- **US4 (P2)**: Independently testable after Phase 2, but depends on the mode state exposed by US1 (T006) to know when to render.

### Parallel Opportunities

- Phase 2: T002 and T003 together; then T004.
- US1: T005 alone (precedes implementation); then T006, with T007 in parallel.
- US2: T008 and T009 together; then T010.
- US3: T011 alone; then T012.
- US4: T013 alone; then T014 and T016 together; then T015.
- Polish: T017 alone; then T018; then T019; then T020.

## Parallel Example: User Story 1

```text
Task: "Write settings selector integration tests in tests/integration/price-mode-settings.test.tsx"

Task: "Add the price-mode selector to src/features/comparison/ComparisonPage.tsx"
Task: "Add price-mode selector styles in src/styles/global.css"
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (CRITICAL — provides the `PriceMode` type and its persistence to every story).
3. Complete Phase 3: User Story 1.
4. **STOP and VALIDATE**: A player can see and choose their price-management mode from settings,
   with the active mode clearly identified. Demonstrate before adding the data-safety and
   confidentiality guarantees.

### Incremental Delivery

1. Complete Setup + Foundational → `PriceMode` type and persistence ready, proven in isolation.
2. Add User Story 1 → test independently → demo the mode selector (MVP!).
3. Add User Story 2 → test independently → demo that switching modes never touches personal prices.
4. Add User Story 3 → test independently → demo, via network inspection, that nothing is ever sent.
5. Add User Story 4 → test independently → demo the honest "coming soon" notice in community mode.
6. Complete Phase 7 before accepting the feature.

---

## Notes

- [P] tasks = different files, no dependency on an incomplete task in the same phase.
- [Story] label maps task to specific user story for traceability.
- This feature deliberately ships no community backend, transport, or aggregation code (spec.md §
  Décision de cadrage): US3's "no transmission" guarantee is enforced by *not writing* any network
  code (T012 is a review/confirmation task, not new production code), and US4's notice is the
  user-facing acknowledgment of that same scope decision.
- T010 and T012 are verification/audit tasks rather than net-new feature code: they exist because
  the data-safety and confidentiality guarantees (FR-006/007/009/010) must be actively checked
  against the concrete implementation of T006, not merely assumed from the design.
- Verify tests fail before implementing.
- Commit after each task or logical group.
- Stop at any checkpoint to validate a story independently.
- Avoid: vague tasks, same-file conflicts, cross-story dependencies that break independence.
