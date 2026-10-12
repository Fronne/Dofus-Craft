# Tasks: Actualiser les prix d'une recette sur la page Recherche

**Input**: Design documents from `/specs/047-recherche-refresh-prices/`

**Prerequisites**: plan.md, spec.md, research.md, contracts/recherche-refresh-ui.md, quickstart.md

**Tests**: demandés (constitution, principe II ; SC-005).

**Rappels** : Node 22 (`export PATH="/c/Users/Cyril/AppData/Roaming/nvm/v22.23.3:$PATH"`) ; le Worker
(`worker/`) n'est pas modifié ; aucun déploiement.

## Format: `[ID] [P?] [Story] Description`

- **[P]** : peut se faire en parallèle (fichiers différents, sans dépendance)
- **[Story]** : récit utilisateur concerné (US1 à US3)

---

## Phase 1: Setup

- [x] T001 Noter dans specs/047-recherche-refresh-prices/quickstart.md (section « Résultats ») le nombre de tests qui passent sur `master` avant modification (1 030).

---

## Phase 2: Foundational (règles pures et appel à l'API)

- [x] T002 [P] Créer src/domain/recipe-refresh.ts : constante `RECIPE_REFRESH_MAX_IDS = 90` (commentaire renvoyant à `REFRESH_MAX_IDS` de worker/src/huzounet.ts) ; type `RecipeRefreshOutcome = { status: 'ok'; refreshed: number } | { status: 'too-soon' | 'not-read' | 'unavailable' }` ; `recipeRefreshIds(itemId, resourceIds)` (objet en premier, sans doublon, identifiants `^\d+$` seulement, 90 au plus) ; `recipeRefreshMessage(outcome)` avec les cinq messages de contracts/recherche-refresh-ui.md.
- [x] T003 [P] Écrire tests/unit/recipe-refresh.test.ts : `recipeRefreshIds` pour 0, 89, 90 et 91 ressources (1, 90, 90, 90 identifiants, l'objet toujours premier), doublons (dont l'objet répété parmi les ressources), identifiants non numériques écartés (objet compris) ; `recipeRefreshMessage` pour chacun des cinq cas.
- [x] T004 Dans src/services/community-price-api.ts, ajouter `refreshRecipePrices(serverId, itemId, ids): Promise<RecipeRefreshOutcome>` : `POST /external-prices/refresh`, corps `{ serverId, itemId, ids }` sans `tab` ni `last`, en-têtes `apiHeaders` ; 429 → `too-soon`, 404 → `not-read`, autre échec / corps illisible / `refreshed` non numérique / panne réseau → `unavailable` ; après un `ok`, armer `freshReadsUntil`. Ne lève jamais.
- [x] T005 Compléter tests/unit/community-price-api.test.ts : `refreshRecipePrices` — corps et méthode envoyés, puis chacune des réponses du tableau du contrat (200 avec et sans prix relus, 429, 404, 502, corps non JSON, `refreshed` absent, `fetch` qui rejette).

**Checkpoint** : `npx vitest run tests/unit/recipe-refresh.test.ts tests/unit/community-price-api.test.ts` passe.

---

## Phase 3: User Story 1 - Actualiser les prix de la recette affichée (P1)

**Goal** : le bouton existe, envoie la demande et fait relire les prix.

**Independent Test** : tests/integration/recherche-refresh-prices.test.tsx, scénarios « demande » et « prix relus ».

- [x] T006 [P] [US1] Dans src/components/Icon.tsx, ajouter l'icône `refresh` (même tracé que le site en ligne : deux arcs et deux flèches).
- [x] T007 [P] [US1] Dans src/features/comparison/useSharedItemPrice.ts, ajouter un troisième paramètre `reloadKey = 0` à `useSharedItemPrice`, dépendance de l'effet de lecture (le prix HDV partagé est relu quand il change).
- [x] T008 [US1] Dans src/features/search/RecherchePage.tsx : état `reload` (compteur) et état `refresh` `{ key, busy, message? }` affiché seulement si `key === \`${serverId}:${selected}\`` ; fonction `refreshPrices` (appelle `refreshRecipePrices` avec `recipeRefreshIds(selectedItem.id, ids)`, incrémente `reload` sur `ok`, range le message de `recipeRefreshMessage`) ; passer `reload` à `useSharedItemPrice` ; remettre à zéro `gapFillRequested` et relancer l'effet de remplissage quand `reload` change ; `key={\`${path}:${reload}\`}` sur `IngredientRow` ; remplacer le `<h2>Prix des ressources</h2>` par l'en-tête `prices-head` du contrat, le bloc `prices-refresh` n'étant rendu qu'en Mode communautaire avec serveur et objet choisis.
- [x] T009 [P] [US1] Dans src/styles/global.css, ajouter `.prices-head`, `.card .prices-head h2`, `.prices-refresh`, `.prices-refresh p`, `.prices-refresh-icon--busy` (et son arrêt sous `prefers-reduced-motion`), avec les valeurs du site en ligne.
- [x] T010 [US1] Écrire tests/integration/recherche-refresh-prices.test.tsx (catalogue et API simulés, identifiants numériques) : bouton absent en Mode personnel et présent en Mode communautaire ; un clic envoie une seule demande `('mikhal', objet, [objet, ressource…])` ; pendant la demande le bouton est inactif et lit « Actualisation… » ; après `ok` avec prix relus, « Prix actualisés. » et le nouveau prix de la ressource est affiché ; après `ok` sans prix relu, « Les prix sont déjà à jour. ».

**Checkpoint** : US1 fonctionne seule.

---

## Phase 4: User Story 2 - Comprendre un refus ou un échec (P1)

**Independent Test** : même fichier d'intégration, scénarios « refus ».

- [x] T011 [US2] Compléter tests/integration/recherche-refresh-prices.test.tsx : `too-soon` → « Réessaie dans quelques secondes. » ; `not-read` → « Les prix de ce serveur ne sont pas relus. » ; `unavailable` → « Actualisation impossible pour le moment. » ; dans les trois cas le prix affiché de la ressource n'a pas changé et le bouton est de nouveau actif.

---

## Phase 5: User Story 3 - Reconnaître un prix fragile (P2)

**Independent Test** : même fichier d'intégration, scénarios « mention ».

- [x] T012 [P] [US3] Dans src/features/comparison/ResourcePriceInput.tsx, ajouter la propriété optionnelle `priceNote?: string`, rendue après la date dans `<span className="price-note"> · {priceNote}</span>` ; ajouter `.price-note { color: var(--text-muted); }` dans src/styles/global.css.
- [x] T013 [US3] Dans src/features/comparison/CommunityResourcePriceRow.tsx, calculer la mention (origine `external`, `latestFragile` connu, pas de saisie en cours, carnet vide ou daté de `latestContributionAt`) avec `FRAGILE_LABELS` de src/domain/huzounet-load.ts, et la passer en `priceNote`.
- [x] T014 [P] [US3] Dans src/features/comparison/useCommunityPrice.ts, faire relire par `readCache` les champs `latestOrigin` (seulement si `isPriceOrigin`) et `latestFragile` (seulement `'stale'` ou `'provisional'`, et seulement pour l'origine `external`).
- [x] T015 [US3] Compléter tests/integration/recherche-refresh-prices.test.tsx : prix Huzounet provisoire → « peu de relevés » ; ancien → « relevé ancien » ; prix partagé (origine `manual`) → aucune mention ; prix gardé sur l'appareil puis API indisponible → la mention est toujours là.

---

## Phase 6: Polish

- [x] T016 Lancer `npx tsc -b --noEmit`, `npx eslint src tests --quiet` et `npx vitest run` ; corriger ce qui échoue ; noter le total dans specs/047-recherche-refresh-prices/quickstart.md.
- [x] T017 Vérifier à l'écran sur le site local (quickstart, étapes 1 à 3, sans cliquer sur le bouton) : place du bouton, absence en Mode personnel, largeur étroite.
- [x] T018 Mettre à jour README.md si la page Recherche y est décrite (bouton « Actualiser les prix »).

---

## Dependencies & Execution Order

- Phase 2 avant tout le reste ; T004 après T002 ; T005 après T004.
- US1 (T006–T010) avant US2 (T011, même fichier de tests).
- US3 (T012–T015) indépendante de US1/US2 côté code ; T015 après T010 (même fichier).
- Polish en dernier.

## Implementation Strategy

MVP = Phases 1 à 3 (le bouton fonctionne). US2 n'ajoute que des tests (les messages viennent de T002),
US3 ajoute la mention. Une livraison unique, fusionnée dans `master` en local, sans déploiement.
