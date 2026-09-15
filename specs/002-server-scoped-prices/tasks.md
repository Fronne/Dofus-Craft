# Tasks: Gestion multi-serveurs des prix

**Input**: Design documents from `/specs/002-server-scoped-prices/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [server-scoped-storage.md](./contracts/server-scoped-storage.md),
[quickstart.md](./quickstart.md)

**Tests**: Tests are required by the project constitution for calculation/persistence rules, data
changes, and user-visible workflows. Write the story test tasks first and ensure they fail before
the matching implementation tasks.

**Organization**: Tasks are grouped by user story so each can be implemented and validated as an
independent increment after the shared foundation is complete.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the existing tooling covers this feature and prepare the new module location.

- [X] T001 Create the `src/features/server/` directory for the new server-selection UI; confirm no new dependency is required beyond the existing React 19, Vite, Vitest, React Testing Library, and Playwright tooling (per plan.md § Technical Context).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the server catalogue, the active-server preference, the shared
server-scoped storage, and the application-wide context every user story depends on.

**⚠️ CRITICAL**: Complete this phase before beginning a user-story phase.

- [X] T002 [P] Define the `Server` type and the closed, predefined list of official Dofus servers in `src/domain/servers.ts`, enforcing verbatim constraints from data-model.md: `id` is an "identifiant stable, non vide" and `name` is un "texte non vide"; include at least two servers (e.g. Mikhal, Dakal) so server isolation is testable.
- [X] T003 [P] Extend shared domain types in `src/domain/types.ts` with `ServerId` and `PinnedItemPrice` per data-model.md, enforcing verbatim constraints: `serverId` and `itemId` "font partie de la clé", `marketPriceKamas` est un "entier supérieur ou égal à 0", et `updatedAt` est une "date/heure ISO 8601".
- [X] T004 [P] Implement the active-server preference persistence in `src/persistence/server-preference.ts` (`getActiveServerId`, `setActiveServerId`), enforcing verbatim behavior from contracts/server-scoped-storage.md: `getActiveServerId` is a synchronous read available on the first render, and `setActiveServerId` only accepts a `serverId` present in `listServers`.
- [X] T005 [P] Implement the shared server-scoped IndexedDB repository factory `createServerScopedPriceStore(storeName)` in `src/persistence/server-scoped-price-store.ts`, exposing `get`/`getMany`/`save`/`remove` keyed by the composite `[serverId, entryId]`, per research.md § Extension du stockage par serveur.
- [X] T006 Implement the active-server React context and hook in `src/app/ServerContext.tsx` (`ServerProvider`, `useActiveServer`), exposing `serverId`, `hasSelectedServer`, `servers`, and `selectServer`, backed by `src/domain/servers.ts` (T002) and `src/persistence/server-preference.ts` (T004).
- [X] T007 Wire `ServerProvider` into the application shell in `src/app/App.tsx`, and update `src/features/comparison/useResourcePrices.ts` and `src/features/comparison/ComparisonPage.tsx` to source `serverId` from `useActiveServer()` instead of the current single-argument call, restoring a successful `npm run typecheck`.
- [X] T008 [P] Write unit tests for server-scoped storage isolation in `tests/unit/server-scoped-price-store.test.ts` for `createServerScopedPriceStore` (T005): entries saved under two distinct `serverId` values never interfere with each other, and introducing a brand-new `serverId` with no prior data leaves every previously stored entry for other `serverId` values completely unchanged (FR-012, SC-005).

**Checkpoint**: The project compiles again; a server context is available application-wide; the
shared storage factory is proven to isolate servers from each other, including newly added ones.
No selection UI or scoped pinned-item pricing exists yet.

---

## Phase 3: User Story 1 - Choisir son serveur à la première visite (Priority: P1) 🎯 MVP

**Goal**: Let a first-time player choose their Dofus server through a blocking selector, have that
choice remembered across visits, and be able to change server afterwards.

**Independent Test**: Open the application with no server memorized; verify a server selector is
presented and that, after selection, the chosen server is memorized and displayed; reload and
verify the same server stays active without the selector reappearing.

### Tests for User Story 1

- [X] T009 [P] [US1] Write unit tests first in `tests/unit/servers.test.ts` for the closed server list in `src/domain/servers.ts`: non-empty, at least two entries, and every `id` unique and stable.
- [X] T010 [P] [US1] Write unit tests first in `tests/unit/server-preference.test.ts` for `getActiveServerId`/`setActiveServerId` in `src/persistence/server-preference.ts`: absent before any selection, synchronous read, rejection of a `serverId` not present in `listServers`, and persistence across a simulated reload.
- [X] T011 [P] [US1] Write integration tests first in `tests/integration/server-onboarding.test.tsx` for the blocking first-visit selector: no server memorized → selector shown and the rest of the application (search, comparison) inaccessible; selection made → selector hidden, server memorized and visible.
- [X] T012 [P] [US1] Write the first-visit and later-change end-to-end journey first in `tests/e2e/server-selection.spec.ts`, covering blocking selection on first load, persistence after a page reload, and changing to a different server later via the switcher.

### Implementation for User Story 1

- [X] T013 [P] [US1] Build the blocking first-visit selector in `src/features/server/ServerOnboarding.tsx`, rendering the closed list from `useActiveServer().servers`, calling `selectServer` on choice, and exposing no action to bypass selection while `hasSelectedServer` is false.
- [X] T014 [P] [US1] Build the persistent server indicator and change-server control in `src/features/server/ServerSwitcher.tsx`, always showing the active server's name and allowing selection of any other server from the closed list at any time.
- [X] T015 [US1] Compose `ServerOnboarding` (T013) and `ServerSwitcher` (T014) into `src/app/App.tsx`: render only `ServerOnboarding` while `hasSelectedServer` is false, and render `ServerSwitcher` alongside `ComparisonPage` once a server is active.

**Checkpoint**: A first-time player must choose a server before anything else is usable; the choice
persists across reloads and can be changed later; US1 automated tests pass.

---

## Phase 4: User Story 2 - Changer de serveur et retrouver les prix de recette associés (Priority: P1)

**Goal**: Isolate resource prices per server so switching servers never shows another server's
prices, and prices are restored intact on return.

**Independent Test**: Enter a resource price on server A, switch to server B, enter a different
price for the same resource, switch back to A and verify A's original price is shown unchanged;
reload and verify both servers' prices are restored.

### Tests for User Story 2

- [X] T016 [P] [US2] Replace the pending stub in `tests/integration/resource-price-repository.test.ts` with real tests for `get`/`getMany`/`save`/`remove` in `src/persistence/indexeddb-resource-price-repository.ts`: missing, save, overwrite, reload, and isolation between two distinct `serverId` values for the same `resourceId`.
- [X] T017 [P] [US2] Extend `tests/e2e/resource-price-persistence.spec.ts` to switch between two servers: a price entered on server A never appears on server B, a different price entered on B never overwrites A, and both remain correct after a reload.

### Implementation for User Story 2

- [X] T018 [US2] Refactor `src/persistence/indexeddb-resource-price-repository.ts` to delegate to `createServerScopedPriceStore('resource-prices-by-server')` (T005), keeping its existing `ResourcePriceRepository` contract (`get`/`getMany`/`save`/`remove` keyed by `(serverId, resourceId)`).
- [X] T019 [US2] Confirm `src/features/comparison/useResourcePrices.ts` re-fetches and clears displayed prices whenever `serverId` changes, and surfaces a clear error when persistence fails without discarding the unsaved visible input.
- [X] T020 [US2] Verify `src/features/comparison/ComparisonPage.tsx` passes the active `serverId` from `useActiveServer()` into `useResourcePrices`, and re-run the feature-001 comparison tests (`tests/integration/comparison-screen.test.tsx`) with an active server selected.

**Checkpoint**: Resource prices are fully isolated per server, restored correctly on server switch
and page reload; US1 and US2 automated tests pass together.

---

## Phase 5: User Story 3 - Suivre un item épinglé avec un prix par serveur (Priority: P2)

**Goal**: Keep the pinned-items list identical across all servers while each pinned item's market
price stays isolated per server, and abandon any pre-feature unscoped price with a visible,
tested warning.

**Independent Test**: Pin an item and set a market price of 500 000 kamas on server Mikhal, switch
to Dakal, set 750 000 kamas, switch back to Mikhal and verify 500 000 kamas is shown again while
the item stays pinned on both servers throughout.

### Tests for User Story 3

- [X] T021 [P] [US3] Update `tests/unit/pinned-items.test.ts` to remove `marketPrice` from the persisted `PinnedItem` shape (only `item` remains), and add a case where a legacy stored `marketPrice` field is present but ignored on load.
- [X] T022 [P] [US3] Write unit tests first in `tests/unit/pinned-item-price-repository.test.ts` for `get`/`getMany`/`save`/`removeAllForItem` in `src/persistence/indexeddb-pinned-item-price-repository.ts`: missing, save, overwrite, reload, and isolation between two distinct `serverId` values for the same `itemId`.
- [X] T023 [P] [US3] Write integration tests first in `tests/integration/pinned-item-price.test.tsx`: an item stays pinned across a server switch, its market-price field is empty on a server with no saved value, and a value saved on one server never appears on another.
- [X] T024 [P] [US3] Write the Épée-X end-to-end journey first in `tests/e2e/pinned-item-server-prices.spec.ts`: pin an item, set 500 000 kamas on Mikhal, switch to Dakal, set 750 000 kamas, switch back to Mikhal, verify 500 000 kamas is shown with the item still pinned on both servers, then reload the page and verify the pinned list and both servers' market prices are restored identically.
- [X] T025 [P] [US3] Write integration tests first in `tests/integration/pinned-price-migration-notice.test.tsx` for `src/features/server/PinnedPriceMigrationNotice.tsx`: renders a dismissible warning when a legacy unscoped `marketPrice` is detected among stored pinned items, renders nothing when none is detected, and stays dismissed after being closed once.

### Implementation for User Story 3

- [X] T026 [P] [US3] Remove the `marketPrice` field from `PinnedItem` and its persistence in `src/persistence/pinned-items.ts`, keeping only the shared, server-independent list of pinned `item`s.
- [X] T027 [P] [US3] Implement `src/persistence/indexeddb-pinned-item-price-repository.ts` delegating to `createServerScopedPriceStore('pinned-item-prices-by-server')` (T005), exposing `get`/`getMany`/`save`/`removeAllForItem` per contracts/server-scoped-storage.md.
- [X] T028 [US3] Update `src/features/catalogue/usePinnedItems.ts` to drop its dependency on `PinnedItem.marketPrice` (T026), call `removeAllForItem` on `unpin`, and stop reading/writing market price through `pinned-items.ts`.
- [X] T029 [P] [US3] Implement the one-time migration notice in `src/features/server/PinnedPriceMigrationNotice.tsx` that detects a legacy `marketPrice` value among stored pinned items (T026), discards it without copying it to any server, and shows the player a dismissible warning that market prices must be re-entered per server.
- [X] T030 [US3] Wire the per-server pinned-item market price into `src/features/comparison/ComparisonPage.tsx` and `src/features/comparison/MarketPriceInput.tsx`: read/write via `indexeddb-pinned-item-price-repository.ts` (T027) keyed by the active `serverId`, showing an empty field when no value exists for that server.
- [X] T031 [US3] Mount `PinnedPriceMigrationNotice` (T029) in `src/app/App.tsx`, alongside `ServerSwitcher`/`ComparisonPage` once a server is active, so the migration warning required by FR-016 is actually visible to affected players.

**Checkpoint**: The pinned-items list is identical on every server; each pinned item's market price
is isolated per server and restored after reload; legacy unscoped prices are discarded with a
visible, tested warning that is actually mounted in the application shell; US1, US2, and US3
automated tests pass together.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate all constitution gates, quality expectations, and the documented end-to-end
experience.

- [ ] T032 [P] Add regression coverage for storage-unavailable behavior (FR-017) in `tests/integration/server-onboarding.test.tsx` and `tests/unit/server-preference.test.ts`: cleared/unavailable `localStorage` or private browsing is treated exactly like a true first visit — the blocking selector reappears, and no server preference is fabricated or silently restored.
- [ ] T033 [P] Add regression coverage for mid-input server switching (FR-018) in `tests/integration/comparison-screen.test.tsx`: an unvalidated (not-yet-parsed-to-a-valid-value) price input is discarded rather than carried over when the player switches server before it resolves to a saved value.
- [ ] T034 Run type checking, unit/integration tests, browser tests, and production build; record any failures and resolutions in `specs/002-server-scoped-prices/quickstart.md`.
- [ ] T035 Perform every manual scenario in `specs/002-server-scoped-prices/quickstart.md`, including the Épée-X example, adding a new server without impact on existing data, the legacy-data migration notice, and the storage-unavailable / mid-input-switch edge cases; update the guide only to correct observed instructions.
- [ ] T036 Review `src/domain/servers.ts`, `src/persistence/`, `src/app/ServerContext.tsx`, and `src/features/server/` against the constitution's traceability, correctness, explainability, cohesion, and local-data-safety rules; confirm the justified exception recorded in `specs/002-server-scoped-prices/plan.md` § Complexity Tracking (scope and removal condition) remains accurate.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately.
- **Foundational (Phase 2)**: Depends on Setup; T002, T003, T004, T005 can proceed in parallel; T006 depends on T002 and T004; T007 depends on T006; T008 depends only on T005 and can run in parallel with T006/T007 — the phase BLOCKS all user stories.
- **User Story 1 (Phase 3)**: Depends on the Foundational phase. T009–T012 are written before T013–T015; T013 and T014 can run in parallel.
- **User Story 2 (Phase 4)**: Depends on the Foundational phase and reuses the switcher built in US1 to exercise its own independent test; T016–T017 precede T018–T020.
- **User Story 3 (Phase 5)**: Depends on the Foundational phase and reuses the switcher built in US1; T021–T025 precede T026–T031.
- **Polish (Phase 6)**: Depends on all delivered user-story phases.

### User Story Dependencies

- **US1 (P1)**: Independent after Phase 2; recommended MVP (a server must be chosen before the app is usable at all).
- **US2 (P1)**: Its repository and hook changes are independently testable after Phase 2; its player journey integrates with the US1 switcher to change servers.
- **US3 (P2)**: Its repository is independently testable after Phase 2; its player journey integrates with the US1 switcher and reuses the pinning UI from feature 001.

### Parallel Opportunities

- Phase 2: T002, T003, T004, and T005 together; then T006 and T008 together (T008 only depends on T005); then T007.
- US1: T009, T010, T011, and T012 together; then T013 and T014 together; then T015.
- US2: T016 and T017 together; then T018, T019, T020 in sequence.
- US3: T021, T022, T023, T024, and T025 together; then T026 and T027 together; then T028 and T029 together; then T030; then T031.
- Polish: T032 and T033 together; then T034; then T035; then T036.

## Parallel Example: User Story 1

```text
Task: "Write unit tests for the server list in tests/unit/servers.test.ts"
Task: "Write unit tests for the active-server preference in tests/unit/server-preference.test.ts"
Task: "Write blocking-onboarding integration tests in tests/integration/server-onboarding.test.tsx"
Task: "Write the first-visit and later-change journey in tests/e2e/server-selection.spec.ts"

Task: "Build the blocking selector in src/features/server/ServerOnboarding.tsx"
Task: "Build the server indicator and switcher in src/features/server/ServerSwitcher.tsx"
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (CRITICAL — restores a working build, provides the server
   context to every story, and proves server-isolation at the storage layer).
3. Complete Phase 3: User Story 1.
4. **STOP and VALIDATE**: A first-time player must choose a server before using the app; the choice
   persists and can be changed. Demonstrate before adding price isolation.

### Incremental Delivery

1. Complete Setup + Foundational → build restored, server context ready, storage isolation proven.
2. Add User Story 1 → test independently → demo the blocking selector and switcher (MVP!).
3. Add User Story 2 → test independently → demo isolated, persistent resource prices per server.
4. Add User Story 3 → test independently → demo the shared pinned list with per-server market
   prices and the legacy-data migration warning actually visible in the app.
5. Complete Phase 6 before accepting the feature.

---

## Notes

- [P] tasks = different files, no dependency on an incomplete task in the same phase.
- [Story] label maps task to specific user story for traceability.
- `tests/integration/resource-price-repository.test.ts` currently contains only an `it.todo(...)`
  placeholder from feature 001 — T016 turns it into real, server-scoped coverage rather than
  duplicating a second file.
- T008, T021–T025/T029/T031, and T032/T033 close gaps found during `/speckit-analyze`:
  - T008 gives FR-012/SC-005 (adding a server without disturbing existing data) automated
    coverage, previously only validated manually.
  - T025/T029/T031 ensure the FR-016 migration warning has its own test (T025) and is explicitly
    mounted in the application shell (T031), not just implemented as a standalone component.
  - T024 also verifies persistence across a page reload for pinned-item prices, mirroring T017's
    reload coverage for resource prices.
  - T032/T033 give the two previously-open edge cases (storage unavailable, mid-input server
    switch) explicit expected behavior (FR-017, FR-018) and automated regression coverage.
- Verify tests fail before implementing.
- Commit after each task or logical group.
- Stop at any checkpoint to validate a story independently.
- Avoid: vague tasks, same-file conflicts, cross-story dependencies that break independence.
