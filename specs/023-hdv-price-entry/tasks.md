---

description: "Liste des tâches — Page Saisie HDV"
---

# Tasks: Page Saisie HDV — relever les prix par hôtel des ventes

**Input**: Design documents from `specs/023-hdv-price-entry/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: inclus — la constitution (II) exige des tests automatisés pour les règles (filtres,
décompte, âge des prix, règle « objet utile ») et le plan liste les fichiers de test.

**Organization**: tâches groupées par user story (US1 à US4 de spec.md).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallélisable (fichiers différents, pas de dépendance sur une tâche non terminée)
- **[Story]**: user story concernée (US1, US2, US3, US4)

---

## Phase 1: Setup (données HDV)

**Purpose**: produire la liste figée des objets de chaque HDV (research.md §1-§3).

- [ ] T001 Écrire `scripts/data/hdv-type-map.json` selon contracts/hdv-type-map.md et le tableau validé de research.md §2 : `"source": "Relevé en jeu par le porteur du projet"`, `"checkedAt": "2026-09-28"` ; `types` = chaque type utile de catégorie DofusDB 2 → `"resources"` (dont Fragment de carte 175, Ressource de quête 312, Caution 197, Haïku 232), chaque type de catégorie 1 (74, 37, 49, 42, 12, 79, 310, 33, 69, 43, 94, 89) → `"consumables"`, Nourriture pour familier 209 et Familier 18 → `"animals"`, et `null` pour Rune de forgemagie 78, Rune de transcendance 211, Rune astrale 233, Potion de forgemagie 26, Orbe de forgemagie 189, Gravure de forgemagie 258, Pierre d'âme spéciale non transformée 309 et les types d'équipement 151, 6, 1, 16, 11, 7, 82, 17 ; `"excludedTypes": [97]` ; `"listAllExchangeable": [209]`
- [ ] T002 Écrire `scripts/build-hdv-items.mjs` sur le modèle de `scripts/build-pet-xp-data.mjs` : lire toutes les recettes DofusDB (`/recipes`, paginé) pour obtenir les ids d'ingrédients, y ajouter les `foods[].itemId` de `src/data/pet-xp-data.json`, lire les objets par lots de 50 ids (`/items?id[$in][]=…`, champs id, name, img, typeId, exchangeable), y ajouter tous les objets échangeables des types de `listAllExchangeable` (`/items?typeId=209&exchangeable=true`) ; garder les objets échangeables dont le type est rattaché à un HDV non nul et absent de `excludedTypes` ; **échouer** avec la liste des types manquants si un type utile n'est pas dans `types` ; écrire `src/data/hdv-items.json` au format de contracts/hdv-items-data.md (`items` triés par `hdv` puis par nom avec `localeCompare('fr')`, `types` id → nom français, `skipped` { outOfScope, excluded, notExchangeable }) et afficher un résumé par HDV
- [ ] T003 Lancer `node scripts/build-hdv-items.mjs`, vérifier le résumé (Ressources ≈ 2 750, Consommables ≈ 130, Animaux ≈ 36, aucun type 97) et garder `src/data/hdv-items.json`

---

## Phase 2: Foundational (bloquant pour toutes les stories)

**Purpose**: domaine pur, chargement des données, champ de prix partagé, navigation.

- [ ] T004 [P] Créer `src/domain/hdv.ts` : type `HdvId = 'resources' | 'consumables' | 'animals'`, `HDV_TABS` ordonné avec les libellés « Ressources », « Consommables », « Animaux », types `HdvItem` { id, name, imageUrl?, typeId, hdv } et `HdvItemsData` (contrat hdv-items-data.md), et `itemsForHdv(data, hdv)` qui renvoie les objets de l'onglet triés par nom
- [ ] T005 [P] Créer `src/features/hdv/useHdvItems.ts` : charge `src/data/hdv-items.json` par `import()` dynamique (hors bundle initial), renvoie `{ status: 'loading' | 'ready' | 'unavailable', data }` ; en cas d'échec de chargement, `unavailable` sans liste partielle (FR-011)
- [ ] T006 Extraire `CommunityResourcePriceRow` de `src/features/search/RecherchePage.tsx` vers `src/features/comparison/CommunityResourcePriceRow.tsx` sans aucun changement de comportement (props, préremplissage, confirmation d'un prix inhabituel, historique), et l'importer depuis `RecherchePage.tsx`
- [ ] T007 Créer `src/features/comparison/PriceEntryField.tsx` reprenant le corps de `renderPriceField` de `RecherchePage.tsx` (valeur saisie locale, écriture au blur seulement si la valeur change, suppression si vide, `CommunityResourcePriceRow` en mode communautaire avec serveur, `ResourcePriceInput` sinon) ; il reçoit `resource`, `quantity`, `priceMode`, `serverId`, l'état du carnet (`data`, `save`, `remove`, `loaded`) et optionnellement `retained` / `subtotalKamas` ; faire utiliser ce composant par `renderPriceField` dans `RecherchePage.tsx` (dépend de T006)
- [ ] T008 Vérifier que la page Recherche est inchangée après T006-T007 : `npx vitest run` sur les tests existants de la Recherche et de `ResourcePriceInput` (dont `tests/unit/resource-price-input.test.tsx` et `tests/integration/community-price-offline.test.tsx`) doivent passer sans modification
- [ ] T009 [P] Extraire `useEndOfList` et la logique d'affichage par tranches (`PAGE_SIZE = 25`, `MORE_DELAY_MS = 800`, `shown`, `loadingMore`) de `src/features/prices/PricesPage.tsx` vers `src/hooks/useLoadMoreOnScroll.ts`, et les faire utiliser par `PricesPage.tsx` sans changement de comportement
- [ ] T010 [P] Ajouter une icône d'étal / de marché à `src/components/Icon.tsx` (nom `store`, trait comme les autres icônes)
- [ ] T011 Ajouter `hdv: '/hdv'` à `ROUTES` dans `src/app/router.tsx` ; dans `src/app/AppShell.tsx`, retirer l'entrée Accueil de la liste de navigation, ajouter `{ to: ROUTES.hdv, label: 'HDV', icon: 'store', end: false }` entre Prix et Familier, remplacer la route `ROUTES.home` par `<Navigate to={ROUTES.search} replace />` (comme `legacyPinned`), et garder `src/features/home/AccueilPage.tsx` dans le code sans route (FR-001b) ; route `ROUTES.hdv` vers la page de T014

**Checkpoint**: données disponibles, champ de prix partagé, Recherche et Prix inchangées.

---

## Phase 3: User Story 1 — Relever les prix d'un HDV d'un seul passage (P1) 🎯 MVP

**Goal**: onglets Ressources / Consommables / Animaux avec un champ de prix par objet.

**Independent Test**: onglet Animaux, saisir le prix de « Croquette enrichie », vérifier la date
« à l'instant » et la présence du prix après rechargement.

### Tests

- [ ] T012 [P] [US1] Écrire `tests/unit/hdv-items-data.test.ts` : dans `src/data/hdv-items.json`, ids uniques, chaque `typeId` présent dans `types` et rattaché au même `hdv` dans `scripts/data/hdv-type-map.json`, aucun objet de type 97 ni 309 ni d'un type de rune, au moins 30 objets de type 209 dans `animals`, « Croquette enrichie » (20125) présente dans `animals`
- [ ] T013 [P] [US1] Écrire `tests/integration/hdv-page.test.tsx` (US1) : rendu de la page avec un serveur choisi, onglets visibles, onglet Animaux liste « Croquette enrichie » avec son champ de prix ; saisir 1500 puis quitter le champ enregistre le prix dans le carnet du mode personnel et affiche « Dernière mise à jour » ; l'onglet choisi est rouvert après remontage (clé localStorage `craftcheck-hdv-tab`) ; sans serveur, invitation à en choisir un ; données indisponibles → message, pas de liste

### Implementation

- [ ] T014 [US1] Créer `src/features/hdv/HdvPage.tsx` : titre, onglets `HDV_TABS` (mémorisés dans localStorage `craftcheck-hdv-tab`, lecture et écriture dans try/catch, défaut `resources`), liste de l'onglet via `useHdvItems` + `itemsForHdv`, carnet `useResourcePrices(serverId, idsAffichés, resourcePricesFor(priceMode))` sur les ids **affichés** seulement, une ligne par objet avec `PriceEntryField` (quantity 1) affichant nom, icône et nom du type ; affichage progressif par `useLoadMoreOnScroll` ; états sans serveur, chargement et indisponible (FR-011) ; sur l'onglet Animaux, une courte note : seules les nourritures du tableau d'XP familier servent à la page Familier (FR-004b)
- [ ] T015 [US1] Styles de la page dans `src/styles/global.css` : onglets, ligne objet (icône avec le fond des cases du jeu comme les autres icônes d'objets, nom, type en texte discret, champ de prix), mise en page mobile sur une colonne sans défilement horizontal

**Checkpoint**: MVP utilisable — on peut relever les prix d'un HDV.

---

## Phase 4: User Story 2 — Retrouver vite un objet dans un HDV (P1)

**Goal**: recherche par nom et filtre par type dans chaque onglet.

**Independent Test**: Consommables, type « Potion », taper « pot » : seuls les objets de ce type dont
le nom contient « pot » restent.

- [ ] T016 [P] [US2] Ajouter à `src/domain/hdv.ts` : `typesInTab(items, typeNames)` (types présents dans l'onglet, triés par nom) et `filterHdvItems(items, { query, typeId })` (nom comparé avec `normalizeSearchText` de `src/services/dofusdb-api.ts`, sans accents ni casse)
- [ ] T017 [P] [US2] Tests dans `tests/unit/hdv-domain.test.ts` : « pot » trouve « Potion » et « Pôt » quel que soit l'accent ou la casse, le filtre de type ne garde que ce type, `typesInTab` ne propose que les types de l'onglet
- [ ] T018 [US2] Dans `src/features/hdv/HdvPage.tsx`, ajouter le champ de recherche (même composant visuel que la page Prix : `search-input-wrap`) et un sélecteur de type limité à `typesInTab` ; changement d'onglet ou de filtre → retour à la première tranche ; aucun résultat → `EmptyState` « Aucun objet ne correspond à votre recherche »
- [ ] T019 [US2] Compléter `tests/integration/hdv-page.test.tsx` avec la recherche et le filtre de type

---

## Phase 5: User Story 3 — Les prix relevés servent partout (P1)

**Goal**: un prix saisi sur HDV est le même que sur Recherche, Prix et Familier.

**Independent Test**: prix saisi sur HDV pour un ingrédient → même prix et même date sur la Recherche ;
prix de « Croquette enrichie » → proposée par la page Familier.

- [ ] T020 [US3] Test d'intégration dans `tests/integration/hdv-page.test.tsx` : prix saisi sur la page HDV lu par `resourcePricesFor(priceMode).getMany` avec la même valeur et la même date (mode personnel et communautaire) ; prix enregistré par ailleurs dans le carnet affiché par la page HDV ; changement de serveur ou de mode → prix du nouveau serveur ou mode
- [ ] T021 [US3] Test d'intégration dans `tests/integration/hdv-page.test.tsx` (ou fichier existant de la page Familier) : avec le prix de 20125 saisi via la page HDV, la page Familier liste « Croquette enrichie »
- [ ] T022 [US3] Vérifier en mode communautaire, dans `tests/integration/hdv-page.test.tsx`, que la ligne HDV a le même verrou, la même confirmation d'un prix inhabituel et le même bouton d'historique que la Recherche (mêmes rôles et libellés)

---

## Phase 6: User Story 4 — Voir où il reste des prix à relever (P3)

**Goal**: décompte « N objets sur M ont un prix » et filtres « Sans prix » / « Prix ancien ».

**Independent Test**: filtre « Sans prix » → seuls les objets sans entrée dans le carnet, décompte
juste et indépendant des filtres.

- [ ] T023 [P] [US4] Ajouter à `src/domain/hdv.ts` : `countPriced(items, prices)` → `{ priced, total }` sur tous les objets de l'onglet, et `filterByPrice(items, prices, 'all' | 'missing' | 'old', now)` où `missing` = pas d'entrée dans le carnet et `old` = `classifyPriceAge(updatedAt, now)` de `src/domain/price-age.ts` vaut `stale` ou `expired`
- [ ] T024 [P] [US4] Tests dans `tests/unit/hdv-domain.test.ts` : décompte, filtre `missing`, filtre `old` aux limites 3 et 7 jours (`PRICE_AGE_STALE_DAYS`, `PRICE_AGE_EXPIRED_DAYS`), prix sans date
- [ ] T025 [US4] Créer `src/features/hdv/useHdvPriceSummary.ts` : lecture groupée `resourcePricesFor(priceMode).getMany(serverId, idsDeLOnglet)` pour tous les objets de l'onglet, relue au changement d'onglet, de serveur, de mode et après chaque enregistrement fait sur la page
- [ ] T026 [US4] Dans `src/features/hdv/HdvPage.tsx`, afficher « N objets sur M ont un prix » (indépendant des filtres) et un choix « Tous / Sans prix / Prix ancien » appliqué avant l'affichage progressif ; compléter `tests/integration/hdv-page.test.tsx`

---

## Phase 7: Polish & Cross-Cutting

- [ ] T027 [P] Écrire `tests/e2e/hdv-price-entry.spec.ts` : navigation (entrée HDV entre Prix et Familier, pas d'Accueil, `/accueil` → Recherche), saisie d'un prix dans Animaux conservée après rechargement, même prix visible sur la Recherche
- [ ] T028 [P] Mettre à jour les tests existants qui cliquent sur le lien « Accueil » ou visitent `/accueil` (chercher `Accueil` et `ROUTES.home` dans `tests/`) pour qu'ils suivent la nouvelle navigation
- [ ] T029 Lancer `npm run typecheck`, `npm run lint`, `npx vitest run` et `npx playwright test tests/e2e/hdv-price-entry.spec.ts` ; tout doit passer (hors erreurs `getLatestItemPrice` déjà présentes avant cette fonctionnalité)
- [ ] T030 Dérouler `specs/023-hdv-price-entry/quickstart.md` sur le serveur de dev (http://localhost:5173/hdv), ordinateur et largeur mobile

---

## Dependencies & Execution Order

- **Phase 1** (T001 → T002 → T003) : séquentielle, bloque tout.
- **Phase 2** : T004, T005, T009, T010 en parallèle ; T006 → T007 → T008 ; T011 après T010.
- **US1** (T012-T015) après la phase 2 ; c'est le MVP.
- **US2** (T016-T019) et **US3** (T020-T022) après US1, indépendantes l'une de l'autre.
- **US4** (T023-T026) après US1.
- **Polish** après les stories voulues.

## Parallel Example

```text
Phase 2 : T004 (domain/hdv.ts) | T005 (useHdvItems.ts) | T009 (useLoadMoreOnScroll) | T010 (Icon)
US1     : T012 (hdv-items-data.test) | T013 (hdv-page.test)
US2+US4 : T016 + T017 (filtres) | T023 + T024 (décompte) — même fichier domain/hdv.ts : à faire l'un après l'autre si une seule personne
```

## Implementation Strategy

1. Phases 1 et 2, puis US1 → vérifier le MVP (saisie par onglet) sur le serveur de dev.
2. US2 (recherche et type), indispensable pour l'onglet Ressources (≈ 2 750 objets).
3. US3 (tests de cohérence avec Recherche, Prix, Familier).
4. US4 (décompte et filtres), puis polish et quickstart.
