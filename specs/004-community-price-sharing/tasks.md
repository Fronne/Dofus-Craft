# Tasks: Partage communautaire des prix (révision 5 : identifiant d'appareil anonyme)

**Input**: Design documents from `/specs/004-community-price-sharing/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/community-price-api.md](./contracts/community-price-api.md),
[quickstart.md](./quickstart.md)

**Context**: Cette liste remplace la précédente (T001-T014 de la révision 4 sont `[X]`, déjà
implémentées). Cette révision ajoute un identifiant d'appareil anonyme (`deviceId`), transmis avec
chaque contribution et stocké aux côtés de `resource_id`/`server_id`/`amount_kamas`. Seule la nouvelle
User Story 5 de spec.md est concernée ; US1 à US4 ne sont pas modifiées et ne sont pas retestées ici.

**Tests**: Nouveau module testable en isolation (`getOrCreateDeviceId`) + extension d'un test
existant (`community-price-api.test.ts`) pour vérifier que le corps du `POST` inclut désormais
`deviceId`. Aucun test worker dédié n'existe dans ce dépôt (seul `median.ts`, non touché, en a un) —
cohérent avec l'état actuel.

**Organization**: Foundational (le nouveau module + la migration D1 + le contrat Worker) d'abord,
puisque tout le reste en dépend, puis les tests de la User Story unique, puis une vérification finale
incluant l'application de la migration sur la base de production (action manuelle créditée).

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: Construire le mécanisme de génération/persistance de l'identifiant d'appareil et le
faire accepter par le backend — tout le reste de cette révision en dépend.

**⚠️ CRITICAL**: Complete this phase before beginning the User Story test phase.

- [X] T001 Create `src/persistence/community-device-id.ts` exporting `getOrCreateDeviceId(): string`, following the same try/catch-around-every-`localStorage`-access pattern as `src/persistence/server-preference.ts`: read `localStorage.getItem('craftcheck-community-device-id')`; if it is a non-empty string, return it as-is; otherwise generate `crypto.randomUUID()`, attempt `localStorage.setItem('craftcheck-community-device-id', id)` (swallow any failure — quota, disabled storage, private browsing), and return the generated `id` regardless of whether the write succeeded. Never throw.
- [X] T002 In `src/services/community-price-api.ts`, import `getOrCreateDeviceId` from `../persistence/community-device-id`. In `submitCommunityPrice`, call `const deviceId = getOrCreateDeviceId();` and add `deviceId` to the JSON body sent to `POST /community-price` (alongside the existing `resourceId`/`serverId`/`amountKamas`). Do not change the function's parameter list or return type. Update the doc comment above `submitCommunityPrice` (currently `// Sends only resourceId/serverId/amountKamas — never any player- or device-identifying data (FR-007)`) to reflect that a `deviceId` is now included and that FR-007 is not the right reference (the no-personal-identification guarantee is FR-010, revised in révision 5).
- [X] T003 [P] In `worker/src/index.ts`, extend `ContributionPayload` to include `deviceId: string`, and extend `isContributionPayload` to require `typeof record.deviceId === 'string' && record.deviceId.length > 0` (same 400 rejection path as the other required fields). Update the `INSERT INTO community_price_contributions` statement in `handlePostContribution` to include `device_id` as a fifth bound column, using the validated `deviceId` from the payload.
- [X] T004 [P] In `worker/schema.sql`, add `device_id TEXT NOT NULL DEFAULT ''` as a column in the `CREATE TABLE IF NOT EXISTS community_price_contributions` statement (after `amount_kamas`, before `created_at`, to match the column order used by T003's `INSERT`). This only affects freshly created databases — the already-existing production database needs the separate migration in T005.
- [X] T005 [P] Create `worker/migrations/0001_add_device_id.sql` containing `ALTER TABLE community_price_contributions ADD COLUMN device_id TEXT NOT NULL DEFAULT '';` with a one-line comment noting this is a one-time, non-idempotent migration for the already-existing production database (unlike `schema.sql`'s `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ADD COLUMN` fails if the column already exists — do not rerun it). Add a new `worker:db:migrate-device-id` script to `package.json`, next to the existing `worker:db:init`, running `wrangler d1 execute dofus-craft-community-prices --config worker/wrangler.toml --file worker/migrations/0001_add_device_id.sql --remote`.

**Checkpoint**: `npm run typecheck` and `npx tsc --noEmit -p worker/tsconfig.json` both pass. A manual `POST /community-price` request without a `deviceId` field is rejected with 400 (verify against a local `wrangler dev` instance, per quickstart.md's existing pattern of manual `wrangler d1 execute` checks — no CI environment runs the full Workers runtime for this backend).

---

## Phase 2: User Story 5 - Distinguer les contributions par appareil, sans identifier le joueur (Priority: P2)

**Goal**: Chaque contribution envoyée inclut un identifiant d'appareil anonyme, généré une fois par
appareil et réutilisé ensuite, sans jamais être affiché à un joueur ni influencer le calcul ou
l'affichage du prix communautaire.

**Independent Test**: Envoyer deux contributions depuis le même appareil (deux ressources
différentes) puis inspecter les données stockées : elles partagent le même `device_id`, une chaîne
UUID non vide, absente de toute réponse ou affichage visible par un joueur.

### Tests for User Story 5

- [X] T006 [P] [US5] Create `tests/unit/community-device-id.test.ts` (same style as `tests/unit/server-preference.test.ts`): (a) calling `getOrCreateDeviceId()` when nothing is stored yet generates and persists a new UUID, returned from the call; (b) calling it again afterward returns the exact same value (no regeneration); (c) clearing `localStorage` between two calls yields a different id on the next call; (d) when `localStorage.getItem`/`setItem` throw (mock `Storage.prototype` like `price-mode-preference.test.ts` does), the function still returns a non-empty string id without throwing.
- [X] T007 [P] [US5] Extend `tests/unit/community-price-api.test.ts`: for the existing `submitCommunityPrice` test(s), assert that the JSON body of the `fetch` call sent to `POST /community-price` includes a `deviceId` key whose value is a non-empty string, in addition to the existing `resourceId`/`serverId`/`amountKamas` assertions. If `community-device-id.ts` reads real `localStorage`, either let jsdom's default `localStorage` back it (no mock needed, consistent with how this test file already runs under jsdom) or stub it explicitly if the existing test setup isolates storage between tests — match whatever pattern this file already uses for other stateful dependencies.

**Checkpoint**: User Story 5 is covered at the unit level (T006) and the service-contract level (T007), independently of any other feature area.

---

## Phase 3: Polish & Cross-Cutting Concerns

**Purpose**: Final verification, including the one manual production step this revision requires.

- [X] T008 Run `npm run typecheck`, `npx tsc --noEmit -p worker/tsconfig.json`, `npx eslint .`, `npm run test`, and `npm run build`. `grep -rn "deviceId" src/features/` MUST return no result (the identifier stays confined to `services/`/`persistence/`, never touched by a page or component — quickstart.md, "Revue des sites d'appel"). Record the outcome as a new dated entry in `quickstart.md` § "Résultat de l'exécution de la révision 5" (placeholder already added).
- [X] T009 Apply the production migration: `npm run worker:db:migrate-device-id` (requires the user's own Cloudflare credentials — a manual, credentialed step, same category as T012 of révision 2). Verify with `wrangler d1 execute dofus-craft-community-prices --config worker/wrangler.toml --command "PRAGMA table_info(community_price_contributions);" --remote` that `device_id` exists with `NOT NULL DEFAULT ''`, and that pre-existing rows read back with `device_id = ''`.
- [X] T010 Redeploy the Worker (`npm run worker:deploy`) so the running instance validates/stores `deviceId` per T003 — the community backend is otherwise unaffected by client-side-only changes, but this revision does touch `worker/src/index.ts`, unlike révision 4. Confirm with a manual test contribution (quickstart.md § "5. Distinguer les contributions par appareil") that a request missing `deviceId` is now rejected (400) and one including it is stored correctly.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No external dependency. T001 has no dependency; T002 depends on T001 (imports `getOrCreateDeviceId`); T003 and T004 touch different files and can run in parallel with each other and with T001/T002; T005 is independent (a new file plus a `package.json` script addition) but should follow T004 for column-order consistency review.
- **User Story 5 (Phase 2)**: Depends on Phase 1 being complete — its tests assert against the behavior T001-T003 produce.
- **Polish (Phase 3)**: Depends on Phase 2 being complete. T009 and T010 additionally require the user's own Cloudflare credentials (cannot be executed unattended in this session) and should happen in that order (schema migration before redeploying code that assumes the column exists).

### Parallel Opportunities

- T003, T004, and T005 (Foundational) touch different files and can run in parallel; T002 depends on T001 only.
- T006 and T007 (US5 tests) touch different files and can run in parallel.

---

## Implementation Strategy

### Single Pass (this revision is small and tightly coupled)

1. Complete Phase 1 (T001-T005) — the client generates/persists a device id and sends it; the Worker
   validates and stores it; a migration exists for the already-populated production database.
2. Complete Phase 2 (T006-T007) — both new/extended test files pass.
3. Complete Phase 3 (T008-T010) — full automated verification, then the two manual, credentialed
   production steps (migration, redeploy) that only the user can authorize/perform.
