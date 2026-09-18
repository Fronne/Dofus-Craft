# Tasks: Comptage anonyme des visites

**Input**: Design documents from `/specs/006-anonymous-visit-count/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/visit-api.md](./contracts/visit-api.md)

**Context**: Nouvelle fonctionnalité, une seule User Story (P1). Amende aussi FR-015 de
specs/004-community-price-sharing (déjà fait dans spec.md de cette feature-là — voir T001).

**Tests**: Nouveau module générique testable en isolation (`device-id.ts`) + son wrapper
(`visit-device-id.ts`) + le nouveau service (`visit-api.ts`), même style que les tests équivalents de
la révision 5 de specs/004.

**Organization**: Foundational (l'extraction du helper générique + le nouveau service + la route
Worker + la migration) d'abord, puis les tests de la User Story unique, puis vérification finale
incluant la migration/redéploiement en production.

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: Construire le mécanisme d'identifiant d'appareil partagé, le service d'envoi, et la
route/table backend — tout le reste de cette feature en dépend.

**⚠️ CRITICAL**: Complete this phase before beginning the User Story test phase.

- [X] T001 [Already done] Mark as reference only: FR-015 of `specs/004-community-price-sharing/spec.md` has already been amended (revision note added) to document the exception this feature introduces — no further action needed here, this task exists only so tasks.md's checkpoint below can reference it as satisfied.
- [X] T002 Create `src/persistence/device-id.ts` exporting a generic `createDeviceId(storageKey: string): string`: read `localStorage.getItem(storageKey)`; if it is a non-empty string, return it as-is; otherwise generate `crypto.randomUUID()`, attempt `localStorage.setItem(storageKey, id)` (swallow any failure), and return the generated `id` regardless of whether the write succeeded. Never throw — same behavior as the current `getOrCreateDeviceId` in `src/persistence/community-device-id.ts`, just parameterized by storage key.
- [X] T003 Refactor `src/persistence/community-device-id.ts` so `getOrCreateDeviceId()` delegates to `createDeviceId('craftcheck-community-device-id')` from the new `device-id.ts`. Its public signature and behavior MUST NOT change — this is a pure internal refactor. Run `tests/unit/community-device-id.test.ts` afterward to confirm it still passes unchanged.
- [X] T004 [P] Create `src/persistence/visit-device-id.ts` exporting `getOrCreateVisitDeviceId(): string`, delegating to `createDeviceId('craftcheck-visit-device-id')` — same pattern as T003, distinct storage key (FR-002).
- [X] T005 [P] Create `src/services/visit-api.ts` exporting `async function recordVisit(): Promise<void>`: calls `getOrCreateVisitDeviceId()`, then `fetch(`${API_URL}/visit`, { method: 'POST', headers: apiHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ deviceId }) })` reusing the same `API_URL`/`apiHeaders` pattern as `community-price-api.ts` (either import a shared helper if one exists, or duplicate the two-line header construction — check `community-price-api.ts` first to decide, keep whichever avoids a needless new shared module for two lines). Wrap the whole call in try/catch; never throw, never return a value callers need to check (fire-and-forget, FR-007).
- [X] T006 [P] In `worker/src/index.ts`, add `async function handlePostVisit(request: Request, env: Env): Promise<Response>`: parse the JSON body, validate it has a non-empty string `deviceId` (400 otherwise, same style as `isContributionPayload`), compute `const day = new Date().toISOString().slice(0, 10);`, then `await env.DB.prepare('INSERT OR IGNORE INTO app_visits (device_id, day) VALUES (?, ?)').bind(deviceId, day).run();` and return `new Response(null, { status: 204, headers: CORS_HEADERS })`. Wire it into the `fetch` handler: `if (request.method === 'POST' && url.pathname === '/visit') { if (!isAuthorized(request, env)) return json({ error: 'Unauthorized' }, 401); return handlePostVisit(request, env); }` — placed alongside the existing `/community-price` routes, same authorization check reused (contracts/visit-api.md).
- [X] T007 [P] In `worker/schema.sql`, add `CREATE TABLE IF NOT EXISTS app_visits (device_id TEXT NOT NULL, day TEXT NOT NULL, PRIMARY KEY (device_id, day));` for any freshly created database. This does not affect the already-existing production database — see T008.
- [X] T008 [P] Create `worker/migrations/0002_add_app_visits.sql` containing the same `CREATE TABLE IF NOT EXISTS app_visits (...)` statement as T007 (this one, unlike the `device_id` column migration, IS idempotent/rerunnable since `CREATE TABLE IF NOT EXISTS` is safe against a database that already has schema.sql applied — no separate ALTER needed, this is a brand-new table). Add a `worker:db:migrate-visits` script to `package.json`, next to `worker:db:migrate-device-id`, running `wrangler d1 execute dofus-craft-community-prices --config worker/wrangler.toml --file worker/migrations/0002_add_app_visits.sql --remote`.
- [X] T009 In `src/app/AppShell.tsx`, import `recordVisit` from `../services/visit-api` and add `useEffect(() => { void recordVisit(); }, []);` near the component's other top-level effects (theme/accent/price-mode) — an empty dependency array so it fires exactly once per mount, independently of `priceMode`/`theme`/any other state (FR-003).

**Checkpoint**: `npm run typecheck` and `npx tsc --noEmit -p worker/tsconfig.json` both pass. A manual `POST /visit` with a `deviceId` returns 204; a second identical call the same day changes nothing (verify via `wrangler d1 execute ... --command "SELECT COUNT(*) FROM app_visits;"` before/after — count increases by at most 1 across both calls).

---

## Phase 2: User Story 1 - Connaître le nombre réel de joueurs actifs (Priority: P1)

**Goal**: Chaque chargement de l'application envoie un signal de présence anonyme, déduplique par
jour et par appareil côté serveur, indépendamment du mode de prix actif.

**Independent Test**: Charger l'application depuis un appareil : une ligne apparaît dans `app_visits`
pour cet appareil et la date du jour. La recharger plusieurs fois le même jour : aucune ligne
supplémentaire. La charger depuis un autre appareil : une ligne distincte apparaît.

### Tests for User Story 1

- [X] T010 [P] [US1] Create `tests/unit/device-id.test.ts` covering the generic `createDeviceId(storageKey)` helper (same 4 cases as the existing `tests/unit/community-device-id.test.ts`: generates+persists on first call, reuses on later calls, generates a different id after the stored one is cleared, degrades to a non-empty id without throwing when `localStorage` is unavailable) — parameterize by storage key to confirm two different keys never collide (call `createDeviceId('a')` and `createDeviceId('b')` and assert they differ).
- [X] T011 [P] [US1] Create `tests/unit/visit-device-id.test.ts`: `getOrCreateVisitDeviceId()` generates+persists under `craftcheck-visit-device-id` specifically, and that this value is independent of whatever is stored under `craftcheck-community-device-id` (set the latter first, confirm the former is still freshly generated and different).
- [X] T012 [P] [US1] Create `tests/unit/visit-api.test.ts` (mock `fetch` like `community-price-api.test.ts`): `recordVisit()` sends `POST /visit` with a JSON body containing exactly `{ deviceId }` (a non-empty string, no `day`/`resourceId`/`amountKamas` or any other key — FR-004); `recordVisit()` resolves without throwing when `fetch` rejects (network error) or resolves with a non-ok status.

**Checkpoint**: User Story 1 is covered at the unit level for every new client module (T010-T012), independently of any other feature area.

---

## Phase 3: Polish & Cross-Cutting Concerns

**Purpose**: Final verification, including the manual production steps this feature requires.

- [X] T013 Run `npm run typecheck`, `npx tsc --noEmit -p worker/tsconfig.json`, `npx eslint .`, `npm run test`, and `npm run build`. `grep -rn "app_visits\|/visit" src/features/` MUST return no result — this signal stays confined to `services/`/`persistence/`/`app/AppShell.tsx`, never surfaced by a page or component (FR-006).
- [X] T014 Apply the production migration: `npm run worker:db:migrate-visits` (requires the user's own Cloudflare credentials — same manual, credentialed category as prior migrations). Verify with `wrangler d1 execute dofus-craft-community-prices --config worker/wrangler.toml --command "SELECT name FROM sqlite_master WHERE type='table' AND name='app_visits';" --remote` that the table now exists.
- [X] T015 Redeploy the Worker (`npm run worker:deploy`) so it serves the new `/visit` route. Confirm with a manual test request (contracts/visit-api.md) that a `POST /visit` without `deviceId` is rejected (400), one with a valid `deviceId` returns 204 and is stored, and a second identical call the same day does not add a second row — then delete the test row(s) via `wrangler d1 execute ... --command "DELETE FROM app_visits WHERE device_id = '...';"`.
- [X] T016 Rebuild and redeploy the frontend (`npm run build` then `npx wrangler deploy`, root `wrangler.toml`) so the deployed app actually calls the new `/visit` route on load.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: T001 is a no-op reference. T002 has no dependency; T003 and T004 both depend on T002 (the generic helper) and can run in parallel with each other afterward; T005 is independent of T002-T004 (a different file) but functionally depends on T004 existing before it's meaningful to call end-to-end — implementation order T002→T004→T005 is simplest even though T005's own file has no import-time dependency on T004 until wired together. T006, T007, and T008 (Worker/schema/migration) touch different files and can run in parallel with everything else in this phase. T009 depends on T005 (imports `recordVisit`).
- **User Story 1 (Phase 2)**: Depends on Phase 1 being complete — its tests assert against the behavior T002-T008 produce.
- **Polish (Phase 3)**: Depends on Phase 2. T014 and T015 additionally require the user's own Cloudflare credentials and should happen in that order (table migration before redeploying code that assumes it exists); T016 (frontend deploy) can happen anytime after T013, independently of T014/T015's backend timing, but logically follows them so the deployed frontend and backend are consistent together.

### Parallel Opportunities

- T004 and T005 can run in parallel once T002/T003 land; T006, T007, T008 touch different files and can all run in parallel with each other and with T002-T005.
- T010, T011, and T012 (US1 tests) touch different files and can all run in parallel.

---

## Implementation Strategy

### Single Pass (this feature is small and tightly coupled)

1. Complete Phase 1 (T002-T009) — the client generates/persists a dedicated visit device id, sends
   it on every app mount, and the Worker deduplicates and stores it server-side.
2. Complete Phase 2 (T010-T012) — every new client module has unit coverage.
3. Complete Phase 3 (T013-T016) — full automated verification, then the credentialed production
   steps (table migration, Worker redeploy, frontend redeploy) that only the user can authorize.
