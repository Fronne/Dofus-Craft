# Tasks: Collections d'objets épinglés

**Input**: Design documents from `/specs/005-pinned-item-collections/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/pinned-item-collections.md](./contracts/pinned-item-collections.md),
[quickstart.md](./quickstart.md)

**Tests**: Ce projet teste les hooks à travers les pages qui les consomment plutôt que via
`renderHook` (aucun précédent de ce pattern dans le projet) — la logique de collection est donc
couverte par des tests d'intégration qui rendent `EpinglesPage`/`ItemDetail` réels, cohérent avec le
reste de la suite existante.

**Organization**: Une phase Setup qui étend le stockage existant, une phase Foundational qui ajoute
les opérations de collection au hook partagé et le composant de sélection partagé dont dépendent
toutes les User Stories, puis une phase par User Story dans l'ordre de priorité de spec.md.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Étendre le stockage existant pour porter une collection, sans rien changer d'observable
pour un joueur qui n'en utilise aucune.

- [X] T001 In `src/persistence/pinned-items.ts`: add optional `collectionName?: string` to the `PinnedItem` type. In `loadPinnedItems()`'s parsing (`isRawPinnedEntry`/the mapping in `loadPinnedItems`), read `collectionName` when present as a string, trim it, and normalize it to `undefined` when absent, not a string, or blank after trimming (data-model.md: "Un `collectionName` vide ou composé uniquement d'espaces n'est jamais persisté tel quel"). An entry stored before this change (no `collectionName` field at all) MUST continue to load exactly as today, with `collectionName` simply absent (FR-005) — extend the existing "ignores malformed stored entries" test coverage style in `tests/unit/pinned-items.test.ts` with cases for: a stored entry with a valid `collectionName`, one with a blank/whitespace-only `collectionName` (normalized away), and one with no `collectionName` field at all (today's exact stored shape).

**Checkpoint**: `PinnedItem` carries an optional, normalized `collectionName`; existing stored data keeps loading unchanged.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the collection-management operations and the shared picker UI that every user
story below depends on.

**⚠️ CRITICAL**: Complete this phase before starting any user story phase — none of them can be implemented without these.

- [X] T002 In `src/features/catalogue/usePinnedItems.ts`, add: `listCollectionNames()` — derives, from the current `pinnedItems` state, the sorted (alphabetical, locale-aware) list of distinct non-blank `collectionName` values, never a separately stored list (data-model.md, "Collection (dérivée, non stockée séparément)"). `assignCollection(itemId, name)` — normalizes `name` (trim; blank/`undefined` means "Sans collection"), then, if a case-insensitive match exists in `listCollectionNames()`, reassigns using *that* collection's existing casing rather than the newly given one (research.md, "Unicité de nom... conservation de la première casse"); updates only the targeted item's `collectionName`, no-op if `itemId` isn't currently pinned. `renameCollection(oldName, newName)` — reassigns `collectionName` for every item currently matching `oldName` (case-insensitive) to the same normalized `newName` that `assignCollection` would produce (so renaming onto an existing collection's name merges into it, spec.md US3 scenario 3); no-op if no item currently matches `oldName`. `deleteCollection(name)` — implemented as `renameCollection(name, undefined)` (research.md): reassigns every matching item to "Sans collection", and MUST NOT remove any item from the pinned list (contract: `deleteCollection` and `unpin` stay strictly distinct, FR-007).
- [X] T003 [P] Create `src/features/catalogue/CollectionPicker.tsx`: a shared component taking the current collection name (or none), a list of existing collection names (from `listCollectionNames()`), and an `onChange(name: string | undefined)` callback; renders the existing names to pick from plus a free-text field to type/create a new one (submitting an existing name, case-insensitively, must behave the same as picking it from the list — contracts/pinned-item-collections.md). No page-specific logic (assignment vs. pin-time choice) lives in this component — callers decide what `onChange` does.
- [X] T004 Add unit tests for `usePinnedItems`'s new collection operations by rendering a minimal consumer (following this project's existing pattern of testing hooks through the pages that use them — no `renderHook`) in a new `tests/integration/pinned-item-collections.test.tsx`: case-insensitive `assignCollection` reuse of existing casing; `renameCollection` reassigning every matching item; `renameCollection` onto an existing name merging both groups; `deleteCollection` moving items to "Sans collection" without unpinning them; a blank/whitespace name normalizing to "Sans collection" in all three operations.

**Checkpoint**: `npm run typecheck` passes; the collection operations and `CollectionPicker` exist and are unit-verified, but nothing in the UI uses them yet.

---

## Phase 3: User Story 1 - Organiser ses objets épinglés en collections nommées (Priority: P1) 🎯 MVP

**Goal**: Depuis la page Épinglés, un joueur peut créer une collection, y assigner des objets déjà
épinglés, et voit ses objets regroupés par collection (plus « Sans collection »).

**Independent Test**: Avec plusieurs objets déjà épinglés, créer une collection depuis la page
Épinglés, y assigner deux d'entre eux, et constater que la page affiche désormais deux groupes
distincts sans qu'aucun objet ne disparaisse (spec.md, US1 Independent Test).

### Tests for User Story 1

- [X] T005 [P] [US1] Extend `tests/integration/pinned-item-collections.test.tsx` (created in T004): with several items already pinned and no collection, render `EpinglesPage` and assert everything shows under a single "Sans collection" group (spec.md US1 scenario 1); assign one item to a newly created collection via its `CollectionPicker` and assert it now renders under that group's heading, no longer under "Sans collection" (scenario 2); assign a second item to the same collection and assert both render together (scenario 3); reassign an already-classified item to a different collection and assert it appears only under the new group, never both (scenario 4, FR-008).

### Implementation for User Story 1

- [X] T006 [US1] In `src/features/catalogue/EpinglesPage.tsx`, group `pinnedItems` by normalized `collectionName` (case-insensitive) into an alphabetically-sorted list of `{ name, items }` groups plus a final "Sans collection" group for items with no (or blank) `collectionName` (data-model.md, "Règles de dérivation"; FR-004, FR-011) — render a heading per group above its existing `pinned-grid` cards, keeping every existing card's content (image, name, level, craft/HDV summary, unpin button) unchanged.
- [X] T007 [US1] In `src/features/catalogue/EpinglesPage.tsx`, add a `CollectionPicker` (T003) to each pinned card, wired to call `assignCollection(entry.item.id, name)` (T002) on change — this is the "assign a posteriori" entry point for FR-002.
- [X] T008 [P] [US1] Add CSS for the new group headings and the per-card `CollectionPicker` control in `src/styles/global.css`, consistent with the existing `.pinned-grid`/`.pinned-card` styles.

**Checkpoint**: User Story 1 is fully functional and independently testable — a player can create collections, assign items to them from the Épinglés page, and see them grouped, entirely without touching User Story 2 or 3.

---

## Phase 4: User Story 2 - Choisir une collection dès l'épinglage (Priority: P2)

**Goal**: Depuis la recherche, au moment d'épingler un nouvel objet, un joueur peut choisir ou créer
une collection sans repasser ensuite par la page Épinglés.

**Independent Test**: Depuis la recherche, épingler un nouvel objet en choisissant une collection
existante au moment de l'épingler, puis constater sur la page Épinglés qu'il apparaît directement
dans le bon groupe, sans étape supplémentaire (spec.md, US2 Independent Test).

### Tests for User Story 2

- [X] T009 [P] [US2] Add integration tests (new `tests/integration/pin-with-collection.test.tsx`, or extend an existing search/pin integration test if one already covers the pin button — check `RecherchePage`'s existing tests first): pinning an item from the search/detail screen while choosing an existing collection via the secondary control results in that item showing in that collection on `EpinglesPage` with no further action (scenario 1); choosing to create a new collection at pin time results in that collection existing afterward with the item in it (scenario 2); pinning via the plain "Épingler" click (not touching the secondary control) still results in the item under "Sans collection", unchanged from today's behavior (scenario 3, FR-003). (Added to `tests/integration/pinned-item-collections.test.tsx` instead of a new file — it already had the exact catalogue/servers mocks and `pinItemByName` helper needed, avoiding duplicating them.)

### Implementation for User Story 2

- [X] T010 [US2] In `src/features/catalogue/ItemDetail.tsx`, add a secondary control next to the existing "Épingler"/"Désépingler" button that opens the `CollectionPicker` (T003) — using it calls `pin(item)` (if not already pinned) followed by `assignCollection(item.id, name)` (T002); the existing single-click "Épingler" button keeps pinning with no collection, exactly as today (research.md, "Choix au moment d'épingler sans alourdir le geste actuel").
- [X] T011 [P] [US2] Add CSS for the new secondary pin-time control in `src/styles/global.css`, consistent with the existing `.pin-item-button` styling.

**Checkpoint**: User Stories 1 AND 2 both work independently — pinning with or without a collection choice, from either entry point, produces consistent results on the Épinglés page.

---

## Phase 5: User Story 3 - Renommer ou supprimer une collection (Priority: P3)

**Goal**: Depuis la page Épinglés, un joueur peut renommer une collection (ses objets suivent) ou la
supprimer (ses objets repassent en « Sans collection », jamais désépinglés).

**Independent Test**: Renommer une collection contenant des objets et vérifier qu'ils restent groupés
sous le nouveau nom ; supprimer une collection et vérifier que ses objets réapparaissent dans « Sans
collection » plutôt que de disparaître de la page (spec.md, US3 Independent Test).

### Tests for User Story 3

- [X] T012 [P] [US3] Extend `tests/integration/pinned-item-collections.test.tsx`: renaming a collection containing items keeps them grouped together, now under the new name (scenario 1); renaming a collection to an existing other collection's exact name merges both groups' items under that one name (scenario 3, FR-009); deleting a collection containing items moves them to "Sans collection", keeps them pinned with all their existing data, and removes the old group heading entirely (scenario 2, FR-007).

### Implementation for User Story 3

- [X] T013 [US3] In `src/features/catalogue/EpinglesPage.tsx`, add a rename action (inline text edit) and a delete action on each collection group's heading (not on "Sans collection", which cannot be renamed or deleted) — calling `renameCollection`/`deleteCollection` (T002) respectively. No confirmation dialog is required for delete, since it never unpins an item (plan.md Constitution Check, principle V). (Mid-implementation design revision, per direct player feedback on the running app: per-card inline "+ Nouvelle collection" felt repetitive across every card. Collections are now created through a single page-level "+ Nouvelle collection" button and can exist with zero items until one is assigned to them from a card — see the new `src/persistence/pinned-collections.ts` and the corresponding rewrite of `usePinnedItems.ts`'s `renameCollection`/`deleteCollection` to also update the registered name list, not just reassign items. Spec/plan/data-model/research to be updated to document this revision.)
- [X] T014 [P] [US3] Add CSS for the group heading's rename/delete controls in `src/styles/global.css`.

**Checkpoint**: All three user stories are independently functional — collections can be created, assigned at either entry point, grouped, renamed, and deleted, all without ever losing or unpinning an item.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: End-to-end validation and final verification across all three stories.

- [ ] T015 [P] Add/extend a Playwright spec `tests/e2e/pinned-item-collections.spec.ts` covering, in one continuous flow: pin two items, create a collection and assign both from the Épinglés page (US1), pin a third item choosing a collection at pin time (US2), rename one collection and delete the other, verifying its items land in "Sans collection" still pinned (US3), and a backward-compatibility check that an item pinned with no `collectionName` (simulate via `localStorage` seeding before navigation, matching the existing style of e2e tests in this project) shows under "Sans collection" without any error.
- [ ] T016 Run `npm run typecheck`, `npx eslint .`, `npm run test`, and `npm run build`; attempt `npm run test:e2e` (expected to hit this sandbox's pre-existing `libnspr4.so` limitation, as in every prior feature this session — confirm rather than assume). Record the outcome as a new "Résultat de l'exécution" section in `quickstart.md`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — T001 touches only `pinned-items.ts`.
- **Foundational (Phase 2)**: Depends on Phase 1 (T002 reads/writes the `collectionName` field T001 adds). T003 (the picker component) has no dependency on T002 and can run in parallel with it; T004 depends on T002 (it tests the operations T002 adds).
- **User Story 1 (Phase 3)**, **User Story 2 (Phase 4)**, **User Story 3 (Phase 5)**: All depend on Phase 2 being complete (they all consume `usePinnedItems`'s new operations and/or `CollectionPicker`). They are mutually independent — US2 and US3 do not require US1's `EpinglesPage` changes to be present to be individually testable, though in practice US3's rename/delete actions live on the same group headings US1 introduces, so implementing US3 after US1 (rather than fully in parallel) avoids a merge conflict on the same file/region — see the Implementation Strategy below.
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### Parallel Opportunities

- T002 and T003 (Foundational) touch different files and can run in parallel.
- T005 (US1 tests), T009 (US2 tests), and T012 (US3 tests) each touch different test files/sections and only depend on Phase 2 — they can be written in parallel once Phase 2 lands, even if the corresponding implementation tasks are done sequentially afterward.
- T008, T011, and T014 (CSS additions per story) touch the same file (`global.css`) but disjoint rule blocks — safe to do in any order, not truly parallel-safe for simultaneous editing but low-conflict-risk.

---

## Parallel Example: Foundational

```bash
# Launch the two independent Foundational building blocks together:
Task: "Add collection operations to src/features/catalogue/usePinnedItems.ts (T002)"
Task: "Create the shared CollectionPicker component in src/features/catalogue/CollectionPicker.tsx (T003)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (T001) and Phase 2 (T002-T004) — the collection data model and operations exist
   and are tested, but no UI uses them yet.
2. Complete Phase 3 (T005-T008) — **STOP and VALIDATE**: a player can already create collections,
   assign already-pinned items to them, and see them grouped on the Épinglés page. This alone
   delivers the core value described in spec.md's Why this priority for User Story 1.

### Incremental Delivery

1. Setup + Foundational → collection operations ready, nothing visible yet.
2. Add User Story 1 → test independently → the core grouping/assignment experience is live (MVP).
3. Add User Story 2 → test independently → pinning from search can skip the extra trip to Épinglés.
4. Add User Story 3 → test independently → collections can be tidied up (renamed/merged/deleted)
   without ever risking a pinned item.
5. Polish (Phase 6) → full automated verification, end-to-end coverage of all three stories together.
