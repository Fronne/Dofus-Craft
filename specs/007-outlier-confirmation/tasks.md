# Tasks: Confirmation des valeurs de coût de craft aberrantes (révision bis : ne plus écraser la saisie du joueur)

**Input**: Design documents from `/specs/007-outlier-confirmation/`

**Prerequisites**: [plan.md](./plan.md) (§ « Révision 2026-09-21 (bis) »), [spec.md](./spec.md)
(FR-012), [research.md](./research.md), [data-model.md](./data-model.md),
[contracts/outlier-confirmation-api.md](./contracts/outlier-confirmation-api.md),
[quickstart.md](./quickstart.md)

**Context**: Cette liste remplace la précédente (T001-T016 de la première révision sont déjà
implémentées et ne sont pas retouchées ici ; T017-T019, les étapes manuelles de production, restent
en attente comme avant). Cette révision corrige un seul comportement, partagé avec
specs/004-community-price-sharing (FR-018, amendée) : après une transmission réussie d'un prix de
ressource (avec ou sans confirmation d'écart préalable), le champ ne doit plus être réécrit avec la
médiane communautaire recalculée — il doit continuer d'afficher la valeur que le joueur vient
lui-même de saisir. Seule la User Story 1 de spec.md est concernée (c'est elle qui régit le commit
d'un champ de prix) ; la User Story 2 (trace des valeurs aberrantes côté serveur) n'est pas affectée
et n'est pas retestée ici.

**Tests**: Extension du test d'intégration existant (`community-auto-share.test.tsx`) pour affirmer
explicitement ce qui n'était testé qu'implicitement jusqu'ici (aucun test existant n'affirmait la
valeur affichée après un commit réussi).

## Phase 1: User Story 1 - Confirmation avant enregistrement d'une valeur très différente de la médiane (Priority: P1)

**Goal**: Après tout commit réussi d'un prix de ressource en Mode communautaire — via le chemin
direct (écart ≤ 25 % ou aucune médiane connue) ou via le chemin confirmé (écart > 25 %, confirmation
acceptée) — le champ continue d'afficher la valeur saisie par le joueur, jamais la médiane
communautaire recalculée.

**Independent Test**: Sur une ressource ayant déjà une médiane communautaire connue, saisir une
nouvelle valeur puis quitter le champ ; une fois la transmission réussie (avec ou sans confirmation
selon l'écart), le champ affiche toujours la valeur tapée par le joueur, jamais une valeur différente
issue de la médiane recalculée.

### Implementation for User Story 1

- [X] T020 [US1] In `src/features/search/RecherchePage.tsx`, inside `CommunityResourcePriceRow.handleCommit`: remove the line `if (refreshed?.kind === 'found') onChange(String(refreshed.price.medianAmountKamas));` (the call `const refreshed = await commit(amount);` itself is kept — it still submits the contribution and refreshes `communityState`/the displayed contribution count, FR-019 of specs/004). After this change, a successful commit — whether it went through the outlier confirmation gate or not — leaves the carnet holding exactly the value the player just typed (already written there on every keystroke via the existing `onChange`, specs/004), with no further write to it. Update the comment block above `handleCommit` (currently describing "overwrites the carnet with the recalculated median so the field durably reflects it across remounts") to instead state that, since specs/004 FR-018 (amendée) / specs/007 FR-012, a successful commit no longer overwrites the field — it keeps the player's own entered value; `commit(amount)`'s return value is used only to refresh the community metadata (sample size), never to rewrite the input.
- [X] T021 [US1] In `tests/integration/community-auto-share.test.tsx` (inside the existing `describe.skip(...)` block, same convention as the first révision's T007 — do not remove this skip, out of scope here): extend the test named `'sends exactly one POST with only resourceId/serverId/amountKamas once the field is confirmed (blur after a real change), then refreshes via GET (FR-017/FR-018/FR-019)'` with an added assertion, after the existing `await waitFor(() => expect(screen.getByText(/3 contributions/)).toBeInTheDocument());`, that `expect(input).toHaveValue('1 000')` (the value the player typed, not `'1 200'`, the mock's recalculated median) — confirming the field keeps the player's entered value on the direct (non-outlier) commit path. Similarly extend the test named `'sends the value and refreshes the median once the confirmation is accepted'` with `expect(input).toHaveValue('1 300')` after its existing `await waitFor(() => expect(screen.getByText(/3 contributions/)).toBeInTheDocument());`, confirming the same on the outlier-confirmed path (the mock's recalculated median stays `1000`, distinct from the entered `1300`, so this assertion would fail against the pre-révision behavior).

**Checkpoint**: T020 et T021 se vérifient ensemble — sans T020, les nouvelles assertions de T021
échouent contre le comportement précédent (la médiane recalculée écraserait l'entrée du joueur).

---

## Phase 2: Polish & Cross-Cutting Concerns

**Purpose**: Vérification complète de la révision.

- [X] T022 Run `npm run typecheck`, `npx eslint .`, `npm run test`, and `npm run build`. Confirm no new lint error/warning beyond the pre-existing baseline already documented in prior revisions' quickstart.md "Résultat de l'exécution" sections. Record the outcome as a new dated entry in `quickstart.md` under a new "Résultat de l'exécution (révision bis)" heading, following the same format as the existing "Résultat de l'exécution (2026-09-21)" section.
- [X] T023 Run `npm run test:e2e` (Playwright) if the environment allows Chromium to launch (known pre-existing limitation otherwise, documented across specs/004-007 quickstart.md — `libnspr4.so: cannot open shared object file`); record the outcome explicitly either way.

---

## Dependencies & Execution Order

- **T020** has no dependency (a targeted change to already-existing code).
- **T021** depends on T020 conceptually (its new assertions are written to describe the post-T020
  behavior) but is a different file and could be written first as a failing test, then made to pass
  by T020, if a strict test-first order is preferred.
- **Phase 2 (Polish)**: Depends on T020 and T021 both being complete.

---

## Implementation Strategy

### Single Pass (this revision is a small, tightly-scoped fix)

1. Complete T020 — remove the overwrite in `RecherchePage.tsx`.
2. Complete T021 — extend the integration test to lock in the new, correct behavior.
3. Complete T022-T023 — full verification, recorded in `quickstart.md`.

No production migration or redeploy is required beyond what T017-T019 of the first révision already
cover (this change is client-side only, no new data, no new route).
