# Tasks: Champs de prix à saisie directe

**Input**: [spec.md](spec.md), [plan.md](plan.md)

## Phase 1 : Fondations

- [ ] T001 Créer le hook `src/features/comparison/usePriceEntry.ts` : valeur de départ prise à la première frappe, sélection au focus, Entrée, Échap, sortie (`onBlur` puis `onCommit` si la valeur a changé, retour à la valeur de départ si `'rejected'`), rattrapage sur `pagehide` (une seule fois).
- [ ] T002 Écrire `tests/unit/price-entry.test.tsx` pour ce hook à travers `ResourcePriceInput` : sélection au focus, pas d'enregistrement sans changement, Échap, rejet, `pagehide` (enregistre une fois, rien si inchangé ou invalide).

## Phase 2 : US1 — Remplacer un prix d'un clic (P1)

- [ ] T003 [US1] `src/features/comparison/ResourcePriceInput.tsx` : utiliser le hook, retirer `lockWhenFilled`, l'état verrouillé et le bouton « Modifier » ; symbole kamas dès qu'il y a un montant.
- [ ] T004 [US1] `src/features/comparison/MarketPriceInput.tsx` : même chose.
- [ ] T005 [US1] `src/features/comparison/CommunityResourcePriceRow.tsx` et `src/features/search/RecherchePage.tsx` : retirer `lockWhenFilled`.
- [ ] T006 [US1] `src/styles/global.css` : retirer les règles `.kamas-input-edit-button` et `input[readonly]` des champs de prix.
- [ ] T007 [US1] Adapter les tests qui cliquaient sur « Modifier ce prix » (`tests/unit/resource-price-input.test.tsx`, `tests/integration/community-auto-share.test.tsx`, `community-price-prefill.test.tsx`, `hdv-huzounet-load.test.tsx`, `hdv-page.test.tsx`, `recherche-refresh-prices.test.tsx`, `shared-item-price.test.tsx`, `tests/e2e/community-price-sharing.spec.ts`).

## Phase 3 : US2 — Ne pas perdre un prix au rechargement (P2)

- [ ] T008 [US2] `src/services/community-price-api.ts` : `keepalive: true` sur l'envoi d'un prix.
- [ ] T009 [US2] `CommunityResourcePriceRow.tsx` : `onUnloadCommit` — enregistre et partage, sauf si le montant demanderait une confirmation de prix inhabituel.
- [ ] T010 [US2] `RecherchePage.tsx` : `onUnloadCommit` du prix HDV en Mode communautaire, même règle.

## Phase 4 : Finitions

- [ ] T011 Notes de remplacement dans `specs/004-community-price-sharing/spec.md` et `specs/016-shared-item-prices/spec.md` ; `DESIGN.md`.
- [ ] T012 `npm run typecheck`, `npm run lint`, `npm run test` ; vérification dans l'aperçu.
