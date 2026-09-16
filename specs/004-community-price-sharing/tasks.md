# Tasks: Partage communautaire des prix

**Input**: Design documents from `/specs/004-community-price-sharing/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/community-price-api.md](./contracts/community-price-api.md),
[contracts/share-consent.md](./contracts/share-consent.md), [quickstart.md](./quickstart.md)

**Tests**: Tests are required by the project constitution (Principle II) for calculation/
persistence rules, data changes, and user-visible workflows — every prior feature (001-003)
included them, so this one does too. Write each story's test tasks first and ensure they fail
before the matching implementation tasks.

**Organization**: Tasks are grouped by user story so each can be implemented and validated as an
independent increment after the shared foundation is complete. Three stories (US1, US2, US3) share
priority P1 in spec.md — together they deliver the core promise of this feature — but each remains
independently testable and shippable on its own, per its Independent Test in spec.md.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Provision the new backend (Worker + D1 schema) and the client-side configuration
needed to reach it. No frontend code depends on anything beyond this phase's env-var plumbing.

> **Révision (2026-09-16)**: T001/T002 remplacent la conception initiale (schéma Postgres géré par
> Supabase). L'utilisateur a explicitement demandé un backend dont le palier gratuit ne peut jamais
> basculer vers une facturation — voir research.md § "Choix de la plateforme backend" (révisée).
> `db/community-price-sharing/schema.sql` (Postgres/RLS) est remplacé par `worker/` (Worker
> Cloudflare + base D1/SQLite).

- [X] T001 Create `worker/wrangler.toml` (Worker name, D1 binding, compatibility date), `worker/tsconfig.json` (isolated `@cloudflare/workers-types` typing, excluded from the frontend's `tsconfig.app.json`), and `worker/schema.sql` with the `community_price_contributions` table: `id text primary key`, `resource_id text not null`, `server_id text not null`, `amount_kamas integer not null check (amount_kamas >= 0)`, `created_at text not null default (strftime(...))` — matching data-model.md verbatim: "aucun identifiant de joueur, d'appareil, d'adresse IP ou toute autre donnée technique reliant la ligne à son auteur". No Row Level Security exists in D1/SQLite — access control instead comes entirely from which routes the Worker (T002) chooses to expose.
- [X] T002 Create `worker/src/median.ts` (pure function `computeCommunityMedian`, linear-interpolation percentile matching PostgreSQL's `percentile_cont` exactly, interquartile-range outlier exclusion per FR-010, 90-day window applied by the caller per FR-011) and `worker/src/index.ts` (the three routes: `GET /community-price` reads matching rows from D1, filters to the last 90 rolling days, and returns the computed median or 404 — contracts/community-price-api.md: "MUST NOT interpréter cela comme un prix à zéro"; `POST /community-price` inserts a row with a `crypto.randomUUID()` id and returns `{ id }`, requiring the `COMMUNITY_API_KEY` bearer secret; `DELETE /community-price/:id` deletes by id, idempotent by construction, also requiring the secret). Add `tests/unit/community-price-median.test.ts` covering the median/outlier-exclusion rules directly (no Workers runtime needed — it's a pure function).
- [X] T003 [P] Add `.env.example` at the repo root documenting `VITE_COMMUNITY_API_URL` and `VITE_COMMUNITY_API_KEY` as placeholder values, and declare both in the `ImportMetaEnv` interface of `src/vite-env.d.ts`, per plan.md § Technical Context. Also add `wrangler`/`@cloudflare/workers-types` as devDependencies and `worker:dev`/`worker:deploy`/`worker:db:init` scripts to the root `package.json`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared types every user story's client code depends on.

**⚠️ CRITICAL**: Complete this phase before beginning a user-story phase.

- [X] T004 [P] Add the `CommunityPrice` type (`{ resourceId: string; serverId: string; medianAmountKamas: number; sampleSize: number }`) and the `ShareConsent` type (`{ given: boolean }`) to `src/domain/types.ts`, per data-model.md's `CommunityPriceMedian` and `ShareConsent` entities.

**Checkpoint**: Shared types exist. No UI or service code exists yet; `RecherchePage.tsx` and
`ParametresPage.tsx` are unchanged.

---

## Phase 3: User Story 1 - Consulter un prix communautaire réel (Priority: P1) 🎯 MVP

**Goal**: En mode communautaire, afficher un vrai prix communautaire (médiane) pour une
ressource/objet du serveur actif, à la place du message « à venir » actuel.

**Independent Test**: Avec des contributions déjà connues pour une ressource sur un serveur, un
joueur en mode communautaire consulte cette ressource et voit un prix communautaire cohérent avec
ces contributions, distinct de son propre prix personnel s'il en a saisi un.

### Tests for User Story 1

- [X] T005 [P] [US1] Write unit tests first in `tests/unit/community-price-api.test.ts` for `getCommunityPrice` (T007): resolves `{ medianAmountKamas, sampleSize }` from a mocked successful response (`vi.stubGlobal('fetch', ...)`, same pattern as `tests/unit/dofusdb-api.test.ts`); resolves `undefined` when the backend returns no row for that resource/server (FR-002 — never a fabricated price); resolves to an explicit "unavailable" result rather than throwing on a network error (contracts/community-price-api.md: "MUST résoudre vers un état explicite d'indisponibilité côté appelant").
- [X] T006 [P] [US1] Write integration tests first in `tests/integration/community-price-display.test.tsx` for `CommunityPriceDisplay` (T008/T009): shows the median and sample size when available, clearly labeled as distinct from the personal price, and remains available even for a player who has never entered a personal price for that resource (Edge Cases, spec.md); shows an explicit "pas encore de données" message instead of any price when none exists (FR-002); updates to reflect the new server's community price when the active server changes (Edge Cases, spec.md); while the same resource stays displayed, refetches the community price automatically every 5 minutes without further player action (FR-013).

### Implementation for User Story 1

- [X] T007 [US1] Create `src/services/community-price-api.ts` with `getCommunityPrice(resourceId, serverId)`: `fetch` a `GET` against the Worker's `/community-price` route (`VITE_COMMUNITY_API_URL`/`VITE_COMMUNITY_API_KEY` from T003), following the request/response shape and error-to-explicit-unavailable-state behavior defined in contracts/community-price-api.md.
- [X] T008 [US1] Create `src/features/comparison/CommunityPriceDisplay.tsx`: renders the median + sample size when `getCommunityPrice` (T007) resolves a value, an explicit "pas encore de données" state when it resolves `undefined`, and never renders a fabricated or zero price (FR-002); fetches on mount and on resource/server change, and automatically refetches every 5 minutes while the same resource stays displayed, without polling faster than that (FR-013, research.md § Fréquence de rafraîchissement).
- [X] T009 [US1] Integrate `CommunityPriceDisplay` (T008) into `src/features/search/RecherchePage.tsx`: rendered only when `priceMode === 'community'` (existing prop, already threaded from `AppShell.tsx`), next to the existing personal resource price field, visually distinct and never merged with it (FR-008 — fully guaranteed and tested in US3).
- [X] T010 [P] [US1] Write a Playwright e2e scenario in `tests/e2e/community-price-sharing.spec.ts` (consolidated with the other US2-US5 e2e scenarios below into one file, sharing the same mock-backend/navigation helpers rather than duplicating them across five near-identical files — principle IV) covering: a resource with known community contributions shows the median; a resource with none shows the explicit empty state; switching the active server updates the community price shown. Backend responses mocked via Playwright route interception (no call to a real Cloudflare Worker).

**Checkpoint**: A player in community mode can see a real community price (or an explicit "not yet
available" state) for any resource on their active server — fully functional and testable on its
own, without any consent or contribution flow existing yet.

---

## Phase 4: User Story 2 - Contribuer son prix personnel après consentement explicite (Priority: P1)

**Goal**: Permettre au joueur de donner un consentement de partage explicite et distinct du mode
communautaire, puis de contribuer ses prix personnels de façon anonyme.

**Independent Test**: Un joueur active le mode communautaire sans donner son consentement de
partage : aucun de ses prix personnels n'est transmis. Il donne ensuite ce consentement
explicitement : ses prix personnels commencent alors à être transmis en tant que contributions
anonymes.

### Tests for User Story 2

- [X] T011 [P] [US2] Write unit tests first in `tests/unit/community-price-api.test.ts` for `submitCommunityPrice` (T015): sends only `resourceId`, `serverId`, and `amountKamas` in the request payload — never any player/device-identifying data (FR-007) — and resolves `{ id }` from the mocked response.
- [X] T012 [P] [US2] Write unit tests first in `tests/unit/community-consent-preference.test.ts` for `getShareConsent`/`setShareConsent` (T016): defaults to `false` when nothing is stored (contracts/share-consent.md: "comportement sûr par défaut"); persists a value across a simulated reload; never throws when `localStorage` is unavailable.
- [X] T013 [P] [US2] Write unit tests first in `tests/unit/community-contributions.test.ts` for the local contribution record store (T017): adding a contribution `{ id, resourceId, serverId }` makes it listable; the list starts empty; entries persist across a simulated reload.
- [X] T014 [US2] Write an integration test first in `tests/integration/community-consent.test.tsx`: with community mode active and consent `false`, entering/saving a personal price never triggers a `fetch` toward the community API (FR-004, SC-002); giving consent from settings (T019) is confirmed clearly and immediately; contributing a price (T020) after consent sends only resource/server/amount (T011); switching back to personal mode after consent was once given never allows a contribution to be sent (FR-014), even though `ShareConsent.given` remains `true` in storage.

### Implementation for User Story 2

- [X] T015 [US2] Add `submitCommunityPrice(resourceId, serverId, amountKamas)` to `src/services/community-price-api.ts` (T007), per contracts/community-price-api.md: `POST`s to the Worker's `/community-price` route, returns the generated `{ id }`.
- [X] T016 [P] [US2] Create `src/persistence/community-consent-preference.ts` with `getShareConsent`/`setShareConsent`, storage key `craftcheck-community-consent`, following the pattern of `src/persistence/price-mode-preference.ts` (synchronous read, safe `false` default), per contracts/share-consent.md.
- [X] T017 [P] [US2] Create `src/persistence/community-contributions.ts` storing the list of `LocalContributionRecord` (`{ id, resourceId, serverId }`) in `localStorage` under the key `craftcheck-community-contributions`, following the pattern of `src/persistence/pinned-items.ts`, per data-model.md.
- [X] T018 [US2] In `src/app/AppShell.tsx`, add `shareConsent`/`setShareConsent` state (T016) following the exact pattern already used for `priceMode`/`setPriceModeState` (useState initialized from `getShareConsent()`, synced to storage in a `useEffect`), and pass `shareConsent` as a prop to `ParametresPage` and `RecherchePage`.
- [X] T019 [US2] In `src/features/settings/ParametresPage.tsx`, add a new "Partage communautaire" section — inline, following the same pattern as the existing Thème/Accent/Mode sections in that file (no new component file) — with a consent toggle visible only when `priceMode === 'community'`, calling `setShareConsent` (T018) and confirming the active state immediately (contracts/share-consent.md, SC-004: effectif en moins de 10 secondes).
- [X] T020 [US2] In `src/features/search/RecherchePage.tsx`, add a "contribuer ce prix" action next to a resource's personal price, visible only when `priceMode === 'community'`; if `shareConsent` is `false`, it prompts for consent first rather than sending anything silently (FR-004); once consented, it calls `submitCommunityPrice` (T015) and records the returned `id` via `community-contributions` (T017).
- [X] T021 [P] [US2] Write a Playwright e2e scenario in `tests/e2e/community-price-sharing.spec.ts` (see T010's note) covering: no community-bound network request while consent is off; giving consent; contributing a price; verifying (via route interception) the request body contains only resource/server/amount.

**Checkpoint**: A player can give explicit, distinct consent and contribute anonymous prices to
the community; US1 and US2 both work independently and together.

---

## Phase 5: User Story 3 - Le prix personnel reste toujours la référence (Priority: P1)

**Goal**: Garantir que, lorsqu'un prix personnel et un prix communautaire coexistent pour la même
ressource/serveur, le calcul de rentabilité et l'affichage principal utilisent toujours le prix
personnel, sans jamais le fusionner avec le prix communautaire.

**Independent Test**: Pour une ressource avec un prix personnel et un prix communautaire tous deux
connus et différents, le calcul de rentabilité et l'affichage principal utilisent le prix
personnel ; le prix communautaire reste visible mais n'est jamais utilisé dans le calcul ni fondu
avec le prix personnel.

### Tests for User Story 3

- [X] T022 [P] [US3] Write an integration test first in `tests/integration/community-price-priority.test.tsx`: with a personal price and a different community price both present for the same resource/server, the craft-cost comparison (`compare()`, unchanged from 001) uses only the personal price for its result, `CommunityPriceDisplay` (T008) keeps showing the community value separately, and neither value changes when the other is present versus absent (FR-008).

### Implementation for User Story 3

- [X] T023 [US3] In `src/features/search/RecherchePage.tsx`, verify and, if needed, add a short code comment at the point where `compare()`'s inputs are assembled, documenting that they MUST come exclusively from the existing personal-price hooks (`useResourcePrices`, `MarketPriceInput`) and MUST NOT read from `CommunityPriceDisplay`/`getCommunityPrice` — this story adds no new calculation code, only the guarantee (verified by T022) that the integration from US1 never crossed that line.
- [X] T024 [P] [US3] Write a Playwright e2e scenario in `tests/e2e/community-price-sharing.spec.ts` (see T010's note) reproducing the Independent Test above end-to-end.

**Checkpoint**: US1, US2, and US3 together deliver the full P1 scope of this feature —
consultation, contribution, and the personal-price-always-wins guarantee — each independently
testable.

---

## Phase 6: User Story 4 - Retirer son consentement de partage, y compris rétroactivement (Priority: P2)

**Goal**: Permettre au joueur de retirer son consentement à tout moment, avec effet immédiat sur
les futures contributions, et de demander le retrait de ses contributions déjà envoyées.

**Independent Test**: Un joueur ayant donné son consentement le retire depuis les paramètres ;
aucune contribution n'est plus transmise ensuite, même s'il continue à saisir ou modifier des prix
personnels ; il peut en plus demander le retrait de ses contributions déjà envoyées, et celles-ci
cessent d'être prises en compte dans le calcul du prix communautaire.

### Tests for User Story 4

- [X] T025 [P] [US4] Write unit tests first in `tests/unit/community-price-api.test.ts` for `withdrawCommunityContribution(id)` (T027): resolves on success; resolves (not rejects) when called again for an already-removed `id` (idempotent), per contracts/community-price-api.md.
- [X] T026 [US4] Write an integration test first in `tests/integration/community-consent-withdrawal.test.tsx`: retracting consent (T019) blocks any further `submitCommunityPrice` call even after a personal price is later edited; triggering "retirer mes contributions déjà envoyées" (T028) prompts for confirmation and calls `withdrawCommunityContribution` only after that confirmation, once per entry in the local record (T017), then clears it; canceling the confirmation results in zero calls to `withdrawCommunityContribution` and leaves the local record unchanged (constitution Principle V — destructive actions require clear confirmation).

### Implementation for User Story 4

- [X] T027 [US4] Add `withdrawCommunityContribution(id)` to `src/services/community-price-api.ts` (T007/T015), per contracts/community-price-api.md: `DELETE`s the matching row by `id`.
- [X] T028 [US4] In `src/features/settings/ParametresPage.tsx` (T019), add a "retirer mes contributions déjà envoyées" action, visible only when the local contribution record (T017) is non-empty, per contracts/share-consent.md's UI table ("confirmation de l'action") and constitution Principle V (destructive actions MUST require clear user confirmation): prompts the player to confirm before proceeding; only on confirmation does it call `withdrawCommunityContribution` (T027) for each locally recorded `id`, then clear the local record; canceling the confirmation leaves everything unchanged.
- [X] T029 [P] [US4] Write a Playwright e2e scenario in `tests/e2e/community-price-sharing.spec.ts` (see T010's note) covering both the consent-retraction and retroactive-withdrawal paths of the Independent Test above.

**Checkpoint**: A player has full, reversible control over their participation, including past
contributions, without any account or identity ever being introduced.

---

## Phase 7: User Story 5 - Consultation communautaire résiliente en cas d'indisponibilité (Priority: P3)

**Goal**: Garder l'application pleinement utilisable en mode personnel, avec un état clair sur les
prix communautaires, quand le service communautaire est indisponible.

**Independent Test**: Le service communautaire est simulé indisponible ; le joueur consulte une
ressource et voit un état explicite d'indisponibilité pour le prix communautaire, tandis que son
prix personnel et les calculs associés restent pleinement utilisables.

### Tests for User Story 5

- [X] T030 [P] [US5] Write an integration test first in `tests/integration/community-price-offline.test.tsx`: when `getCommunityPrice` (T007) resolves its explicit "unavailable" result, `CommunityPriceDisplay` (T008) shows the last value fetched this session (if any) marked as potentially stale, or an explicit unavailability message if none was ever fetched this session; the personal price and its calculation (T023's guarantee) are unaffected either way.

### Implementation for User Story 5

- [X] T031 [US5] In `CommunityPriceDisplay` (T008), cache the last successfully fetched `CommunityPrice` per `resourceId`/`serverId` in `sessionStorage` (research.md decision: session-scoped, not a persistent IndexedDB cache); on a subsequent "unavailable" result, render the cached value marked as potentially stale instead of an empty/broken state, per FR-009 and User Story 5.
- [X] T032 [P] [US5] Write a Playwright e2e scenario in `tests/e2e/community-price-sharing.spec.ts` (see T010's note) simulating backend unavailability via route interception, reproducing the Independent Test above.

**Checkpoint**: All five user stories are independently functional; the feature degrades safely
when the community backend is unreachable.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final verification across all stories, matching the documentation convention already
established by 003-community-price-mode's quickstart.md.

- [X] T033 [P] Manually run the schema verification steps in quickstart.md § "Vérification manuelle du schéma" (outlier exclusion, no route ever returning a raw contribution, 90-day window exclusion, delete-by-id) against the deployed Worker + D1 database, and record the outcome in quickstart.md.
- [X] T034 Complete quickstart.md § "Revue de non-transmission hors consentement" with the list of files reviewed and confirmation that `submitCommunityPrice` (T015) is never called outside the `shareConsent === true` path (T020), following the same review convention as 003-community-price-mode/quickstart.md § "Revue de non-transmission réseau".
- [X] T035 Run `npm run typecheck`, `npm run test`, `npm run test:e2e`, and `npm run build`; record the results in quickstart.md § "Résultat de l'exécution", following the same format as 003-community-price-mode/quickstart.md.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately. T002 depends on T001 (same file).
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories.
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion.
  - US1 (P1) has no dependency on any other story.
  - US2 (P1) extends `src/services/community-price-api.ts` created in US1 (T007) — start after US1's T007 exists, not necessarily after all of US1 is finished.
  - US3 (P1) depends on `CommunityPriceDisplay` existing (US1, T008) to verify the two prices never merge.
  - US4 (P2) extends `src/services/community-price-api.ts` (US1/US2) and the local contribution record (US2, T017).
  - US5 (P3) extends `CommunityPriceDisplay` (US1, T008).
- **Polish (Phase 8)**: Depends on all desired user stories being complete.

### Cross-story file ownership (serialize these, do not parallelize across stories)

- `src/services/community-price-api.ts`: created in US1 (T007), extended in US2 (T015) and US4 (T027) — one function added per story, same file.
- `tests/unit/community-price-api.test.ts`: added to in US1 (T005), US2 (T011), US4 (T025).
- `src/features/settings/ParametresPage.tsx`: extended in US2 (T019) and US4 (T028).
- `src/features/comparison/CommunityPriceDisplay.tsx`: created in US1 (T008), extended in US5 (T031).

### Parallel Opportunities

- T003 (Setup) can run alongside T001/T002 (different files).
- All Foundational tasks are marked [P] (only one exists here: T004).
- Within each story's Tests block, tasks touching different files are marked [P] (e.g. T005/T006, T011/T012/T013).
- e2e tasks (T010, T021, T024, T029, T032) are marked [P] relative to their story's other tasks — separate spec files, no shared state.
- US1 and, once T007 exists, the non-service parts of US2/US4 preparation (writing tests, building `community-consent-preference.ts`/`community-contributions.ts`) can proceed in parallel by different contributors — see Cross-story file ownership above for what must stay serialized.

---

## Parallel Example: User Story 1

```bash
# Launch both test tasks for User Story 1 together (different files):
Task: "Write unit tests first in tests/unit/community-price-api.test.ts for getCommunityPrice (T005)"
Task: "Write integration tests first in tests/integration/community-price-display.test.tsx for CommunityPriceDisplay (T006)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (schema + env vars)
2. Complete Phase 2: Foundational (types)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: run US1's tests and its quickstart.md § "1. Consulter un prix
   communautaire réel" scenario independently.
5. Demo if ready — a read-only real community price, no contribution flow yet.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. Add US1 → validate independently → demo (read-only MVP).
3. Add US2 → validate independently → demo (consultation + contribution, the feature's full core
   promise alongside US1).
4. Add US3 → validate independently → demo (the priority guarantee made concretely testable).
5. Add US4 → validate independently → demo (reversible consent, including retroactive withdrawal).
6. Add US5 → validate independently → demo (safe degradation offline).
7. Phase 8: full quickstart.md validation and documentation.

### Parallel Team Strategy

With multiple contributors, after Foundational:

- One contributor starts US1 (owns `community-price-api.ts` first).
- Once US1's T007 lands, a second contributor can start US2's non-service tasks (T012, T013, T016,
  T017 — different files) while the first extends `community-price-api.ts` for T015.
- US3 and US5 both depend on US1's `CommunityPriceDisplay` (T008) existing before their own work
  starts.
- US4 depends on US2's local contribution record (T017) existing.
