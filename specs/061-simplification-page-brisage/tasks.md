# Tasks: Simplification de la page Brisage

**Spec** : [spec.md](spec.md) · **Plan** : [plan.md](plan.md)

## Phase 1 — Fondations (bloquant pour toutes les histoires)

- [x] T001 [P] Ajouter `averageRoll(from, to)` (`Math.floor((from + to) / 2)`, `from === to` → la valeur) dans `src/domain/brisage.ts`, avec test dans `tests/unit/brisage.test.ts` (1–50 → 25, 5–10 → 7, 8–8 → 8).
- [x] T002 [P] Ajouter `getItemEffectRanges(id)` dans `src/data/catalogue-repository.ts` : même filtrage que `getItemEffectLines` (effectId numérique, `category !== 2`, `from >= 0`, `to >= 0`, max > 0), retourne `{ effectId, from, to }[]` avec `from <= to` ; test dans `tests/unit/catalogue-item-effect-lines.test.ts`.
- [x] T003 [P] Créer `src/persistence/brisage-coefficients.ts` : `getStoredCoefficient(serverId, itemId)` → `{ coefficient, savedAt } | undefined` et `saveCoefficient(serverId, itemId, coefficient)` ; clé `craftcheck-brisage-coefficients`, JSON `{ "<serverId>:<itemId>": { coefficient, savedAt } }`, `coefficient` > 0 et ≤ 100 (sinon entrée ignorée), `savedAt` ISO 8601, `try/catch` sur tout accès `localStorage`. Test dans `tests/unit/brisage-coefficients.test.ts` (aller-retour, stockage corrompu, valeur hors bornes).
- [x] T004 [P] Créer `src/features/brisage/useItemCost.ts` : hook lisant `pinnedItemPrices.get(serverId, itemId)` (`src/persistence/indexeddb-pinned-item-price-repository.ts`) → `{ status: 'loading' | 'ready', costKamas?: number }`.

## Phase 2 — US1 : objet, coût, verdict (P1)

**Test indépendant** : sélectionner un objet épinglé, saisir un coefficient, lire le verdict.

- [x] T005 [US1] Réécrire `src/features/brisage/BrisagePage.tsx` : recherche (`useEquipmentSearch`), sélection d'un objet, niveau lu de l'objet (aucun champ de niveau), coût via `useItemCost` (champ de saisie seulement si absent), réglages = `defaultBrisageSettings()`, prix de runes via `useRunePrices` sans saisie ; appel à `analyzeBrisage`.
- [x] T006 [US1] Bloc **Résultat** dans `BrisagePage.tsx` : 4 tuiles `StatTile` — verdict (« Rentable » si le gain de la meilleure option ≥ 0, sinon « Pas rentable »), nombre de brisages avant seuil (0 si sous le seuil), coefficient minimal de rentabilité, meilleure option de focus ; runes sans prix listées par nom (« prix manquant »), jamais de valeur inventée.
- [x] T007 [US1] Bandeau d'estimation raccourci (H1–H4, formule niveau 40, focus non officiel) dans `BrisagePage.tsx`.

## Phase 3 — US2 : coefficient mémorisé (P1)

**Test indépendant** : saisir un coefficient, recharger, resélectionner l'objet → valeur et date réaffichées.

- [x] T008 [US2] Dans `BrisagePage.tsx` : à la sélection, lire `getStoredCoefficient` ; si présent afficher « Dernier coefficient : X % (jj/mm) » et l'utiliser ; sinon afficher le champ « Coefficient relevé en jeu après un brisage », vide, sans résultat tant qu'il est vide ; toute saisie valide appelle `saveCoefficient` (date du jour).

## Phase 4 — US3 : jet moyen modifiable (P2)

**Test indépendant** : jets moyens affichés, en modifier un, le résultat change.

- [x] T009 [US3] Dans `BrisagePage.tsx` : lignes issues de `getItemEffectRanges`, chaque ligne affiche son jet moyen (`averageRoll`) en placeholder d'un champ modifiable (`override`), étiquette « moyen » / « modifié », champ vidé = retour au jet moyen ; les lignes alimentent `analyzeBrisage`.

## Phase 5 — US4 : meilleure rune à focus (P2)

- [x] T010 [US4] Dans `BrisagePage.tsx` : phrase « Pas de focus » ou « Focus sur la rune X » avec le gain par objet, option sans prix écartée et signalée « prix manquant », mention « estimation non officielle ».

## Phase 6 — Nettoyage et vérifications

- [x] T011 Supprimer `src/persistence/brisage-settings.ts` et `tests/unit/brisage-settings-persistence.test.ts` (réglages retirés de l'interface) ; retirer de `src/styles/global.css` les styles `.brisage-*` devenus inutilisés ; adapter la note de `specs/060-page-brisage/spec.md` (FR-002, FR-007 et US3 remplacés par la spec 061).
- [x] T012 Réécrire `tests/integration/brisage-page.test.tsx` : choix d'objet avec prix épinglé, aucun champ de niveau, coefficient demandé puis mémorisé avec sa date, jet moyen modifiable, 4 infos du résultat, runes sans prix signalées.
- [x] T013 Lancer `npm run test`, `npm run lint`, `npm run build` et le parcours de `quickstart.md`.

## Phase 7 — Mise en page de la planche validée (FR-011 à FR-014)

- [x] T014 Réécrire le rendu de `src/features/brisage/BrisagePage.tsx` : bloc objet (image, nom, niveau, coût avec `Kamas`, coefficient), verdict (trois cas : focus plus rentable / pas de focus à faire / pas rentable), tableau des lignes (rune via `ResourceDisplay`, prix via `Kamas`, colonnes sans focus et focus, pied de tableau), rangée « gain sans focus selon le coefficient », note d'estimation.
- [x] T015 Styles `.brisage-*` dans `src/styles/global.css` (verdict, tableau, surbrillance, rangée de gains) et carte par ligne sous 640 px.
- [x] T016 Adapter `tests/integration/brisage-page.test.tsx` : « Rentable sans focus » sans surbrillance quand le focus ne rapporte pas plus, surbrillance du meilleur focus sinon, icônes kamas et runes présentes.
- [x] T017 Relancer `npm run test`, `tsc`, `eslint`, build ; vérifier la page dans le navigateur (bureau et mobile) ; relecteur.

## Dépendances

T001–T004 indépendants → T005 → T006/T007 → T008 → T009 → T010 → T011 → T012 → T013.
Les tâches T005–T010 modifient le même fichier : à enchaîner, non parallèles.

## Stratégie

MVP = Phase 1 + US1 + US2 (verdict avec coefficient mémorisé) ; puis US3, US4, nettoyage.
