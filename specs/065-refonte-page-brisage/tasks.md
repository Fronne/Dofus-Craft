# Tâches : Refonte de la page Brisage, la recherche d'objet en premier

**Entrée** : documents de conception dans `specs/065-refonte-page-brisage/`

**Prérequis** : plan.md, spec.md, research.md, data-model.md, contracts/page-brisage.md, quickstart.md

**Tests** : demandés par la constitution (principe II) pour toute règle nouvelle ; ils sont écrits avant le code de la règle qu'ils couvrent.

## Format : `[ID] [P?] [Story] Description`

- **[P]** : parallélisable (fichiers différents, aucune dépendance sur une tâche non terminée)
- **[Story]** : récit utilisateur concerné (US1 à US5 de la spec)

---

## Phase 1 : Mise en place

- [ ] T001 Régénérer l'index des équipements avec la catégorie : dans `scripts/build-brisage-items.mjs`, conserver le lien type → `superTypeId` lu avec les types, ajouter `categoryId` à chaque objet (`equipment-type-<superTypeId>`, trophées et prysmaradites `equipment-type-151`, même règle que `equipmentCategoryId` dans `src/services/dofusdb-mappers.ts`), puis lancer `node scripts/build-brisage-items.mjs` et vérifier le résumé ; si DofusDB est injoignable, s'arrêter et le signaler (ne rien écrire à la main)
- [ ] T002 Lire `categoryId` dans `src/data/brisage-items-repository.ts` (type `IndexedItem` dans `src/domain/brisage-search.ts` : `categoryId?: string`) ; un objet sans catégorie valide est conservé sans catégorie

**Point de contrôle** : `npm run test` passe encore (aucune régression de lecture de l'index).

---

## Phase 2 : Fondations (bloque tous les récits)

- [ ] T003 [P] Écrire les tests de `statGroup` et `browseItems` dans `tests/unit/brisage-search.test.ts` : chaque stat ciblable dans un seul groupe ; tacle, fuite, esquive PA/PM, retrait PA/PM dans `caracteristiques` ; nom sans accents ni casse, tous les mots ; moins de 2 caractères ignorés ; catégorie ; plage de niveaux (et plage inversée → `[]`) ; plusieurs stats = toutes présentes ; sans stat, tri niveau décroissant puis nom ; mêmes résultats que `searchResults` quand `query` est vide et `categoryId` absent ; entrées non modifiées
- [ ] T004 Implémenter `StatGroup`, `statGroup(effectId)` et `browseItems(items, filters, runes, settings, prices)` dans `src/domain/brisage-search.ts` (groupes de `research.md` D3, filtre de `research.md` D4, normalisation locale par `String.normalize('NFD')`)
- [ ] T005 [P] Écrire les tests de `resolveItemPrice` dans `tests/unit/brisage-price.test.ts` : Achat seul, Craft seul, Auto = plus bas des deux, Auto avec un seul prix connu, égalité → `'hdv'`, prix ≤ 0 / `NaN` / absent = inconnu, aucun prix → `undefined` (jamais 0)
- [ ] T006 Créer `src/domain/brisage-price.ts` avec `ResolvedPrice` et `resolveItemPrice(hdvKamas, craftKamas, source)` (`data-model.md`, « Prix de l'objet »)
- [ ] T007 [P] Écrire les tests des préférences dans `tests/unit/brisage-search-prefs.test.ts` : `categoryId` et `panelOpen` relus, valeur absente ou de mauvais type → défaut (`undefined` / `false`), anciennes valeurs sans ces champs relues sans erreur
- [ ] T008 Ajouter `categoryId?: string` et `panelOpen: boolean` (défaut `false`) à `SearchPrefs` dans `src/persistence/brisage-search-prefs.ts`
- [ ] T009 [P] Écrire les tests de session dans `tests/unit/brisage-session.test.ts` : `priceSource: 'auto'` relu, `'hdv'` et `'craft'` enregistrés avant cette version relus à l'identique
- [ ] T010 Autoriser `'auto'` dans `PriceSource` de `src/persistence/brisage-session.ts` (lecture et écriture), sans migration
- [ ] T011 [P] Ajouter un test dans `tests/unit/brisage-items-repository.test.ts` : `categoryId` lu, objet sans catégorie conservé ; et un test qui lit `src/data/brisage-items.json` et vérifie que chaque objet a une catégorie

**Point de contrôle** : `npm run test` passe ; les fonctions pures de la page sont prêtes.

---

## Phase 3 : Récit 1 — Trouver un objet par son nom, en premier sur la page (P1) 🎯 MVP

**But** : la page s'ouvre sur le champ de recherche, suivi de cartes d'objets filtrées par nom, avec le nombre total et « Afficher plus ».

**Test indépendant** : ouvrir la page, taper « abra », voir des cartes avec nom, niveau, icône et coefficient (ou « à saisir »).

- [ ] T012 [P] [US1] Créer `src/features/brisage/ItemCard.tsx` : bouton `aria-pressed`, icône (ou visuel de remplacement), nom, niveau, coefficient enregistré via `getStoredCoefficient` ou « à saisir »
- [ ] T013 [US1] Créer `src/features/brisage/ItemFinder.tsx` : charge l'index (`loadBrisageItemsIndex`), champ de recherche, prise en compte de `browseItems` avec `query`, environ 6 cartes (`PAGE_SIZE = 6`), « N objets » et « Afficher plus », messages « aucun objet » et « liste indisponible » (`role="alert"`), source et date de l'index ; pas encore de panneau de filtres
- [ ] T014 [US1] Dans `src/features/brisage/BrisagePage.tsx`, remplacer le bloc de choix d'objet (modes « Par nom / Par stats », `useEquipmentSearch`, `ItemSearchByStats`) par `ItemFinder`, retirer l'en-tête `page-header` (pas de titre `h1` redondant), garder `openItem` / session / restauration
- [ ] T015 [US1] Ajouter les styles du champ et des cartes (rangée en grille, carte active, états) dans `src/styles/global.css`, avec le thème et les variables existants
- [ ] T016 [US1] Adapter `tests/integration/brisage-page.test.tsx` à la nouvelle entrée (taper un nom, cliquer une carte) et ajouter les cas : champ premier contenu, absence de `h1` « Brisage », message sans résultat, carte avec coefficient enregistré et carte « à saisir »

**Point de contrôle** : récit 1 utilisable seul (le reste de la page fonctionne comme avant après le choix d'une carte).

---

## Phase 4 : Récit 2 — Choisir un objet et voir son brisage (P1)

**But** : la carte choisie est mise en évidence ; en-tête compact puis tableau existant, sans curseur ; changer de carte met tout à jour.

**Test indépendant** : cliquer deux cartes de suite et vérifier que l'en-tête et le tableau suivent la carte active.

- [ ] T017 [US2] Créer `src/features/brisage/ItemHeader.tsx` (version sans les réglages de prix et de coefficient, ajoutés au récit 3) : icône, nom, niveau, bouton « Changer d'objet » remplacé par le simple choix d'une autre carte
- [ ] T018 [US2] Dans `BrisagePage.tsx`, afficher `ItemHeader` puis le tableau sous les cartes, l'objet choisi restant affiché même si les filtres l'excluent ; passer `selectedId` à `ItemFinder` pour la carte active ; invitation « choisissez un objet » quand aucun objet n'est choisi
- [ ] T019 [P] [US2] Ajouter dans `tests/integration/brisage-page.test.tsx` : changer de carte met à jour l'en-tête et les lignes du tableau ; aucun `input[type="range"]` dans la page ; ligne à jet fixe sans saisie de min/max ; l'objet choisi reste affiché quand le nom saisi ne le trouve plus
- [ ] T020 [US2] Resserrer l'espacement du verdict / conseil et du tableau dans `src/styles/global.css` (version compacte, mêmes données)

**Point de contrôle** : récits 1 et 2 ensemble donnent le parcours complet nom → carte → tableau.

---

## Phase 5 : Récit 3 — Prix de l'objet et coefficient d'un coup d'œil (P1)

**But** : Achat / Craft / Auto dans l'en-tête, prix retenu avec provenance, coefficient pré-rempli ou « à saisir ».

**Test indépendant** : sur un objet à deux prix connus, Auto retient le plus bas et l'indique ; saisir un coefficient met le tableau à jour.

- [ ] T021 [US3] Dans `BrisagePage.tsx`, lire les deux prix dès qu'un objet est choisi (`useItemCost` et `useItemCraftCost` sans condition sur la source), calculer le prix retenu avec `resolveItemPrice`, garder le prix saisi comme repli, et utiliser `'auto'` comme source par défaut d'un nouvel objet (une session restaurée garde la sienne)
- [ ] T022 [US3] Compléter `ItemHeader.tsx` : groupe Achat / Craft / Auto (`radiogroup`), prix retenu avec provenance (« Craft » / « Achat »), les deux prix d'origine en petit (« inconnu » si manquant, jamais 0), champ de prix saisi quand aucun prix n'est connu, champ de coefficient (valeur enregistrée pré-remplie et signalée, sinon vide et marqué « à saisir », `rememberCoefficient` au retrait du focus)
- [ ] T023 [P] [US3] Ajouter dans `tests/integration/brisage-page.test.tsx` : Auto retient le plus bas des deux ; Auto avec un seul prix ; Achat et Craft forcés ; aucun prix → champ de saisie ; coefficient enregistré pré-rempli ; coefficient absent « à saisir » ; la saisie d'un coefficient recalcule le tableau ; le choix du mode survit au rechargement
- [ ] T024 [US3] Styler l'en-tête (groupe de choix, prix, coefficient « à saisir » en pointillés orange) dans `src/styles/global.css`

**Point de contrôle** : les trois récits P1 sont complets (MVP livrable).

---

## Phase 6 : Récit 4 — Filtrer par catégorie, niveau et stats (P2)

**But** : bouton Filtres, panneau replié par défaut, catégories, niveau, stats en 3 colonnes avec emplacement d'icône, pastilles retirables.

**Test indépendant** : cocher « Cape » et « Sagesse », niveau 150-200 : toutes les cartes sont des capes de ce niveau avec un jet positif en Sagesse.

- [ ] T025 [P] [US4] Créer `src/features/brisage/ItemFilters.tsx` : catégories en pastilles compactes (catégories d'équipement du catalogue, icônes de `CATEGORY_ICON_PATHS` comme `CategoryFilter`, seules celles présentes dans les données), niveau min/max avec message de plage invalide (`levelRangeError`), stats ciblables en 3 colonnes (`statGroup`, libellés Caractéristiques / Dommages / Résistances) avec un composant d'icône de stat (icône connue du catalogue sinon emplacement neutre), liste de tri affichée seulement si des stats sont choisies
- [ ] T026 [US4] Étendre `ItemFinder.tsx` : bouton « Filtres » à droite du champ (`aria-expanded`, nombre de filtres actifs), panneau replié par défaut (`panelOpen` des préférences), pastilles « Retirer … » des filtres actifs visibles panneau replié, « Réinitialiser les filtres », nombre d'objets trouvés, préférences (`getSearchPrefs` / `setSearchPrefs`) incluant `categoryId`
- [ ] T027 [US4] Supprimer `src/features/brisage/ItemSearchByStats.tsx` (logique reprise par `ItemFinder` et `ItemFilters`) et ses styles devenus inutiles `.brisage-search-*` dans `src/styles/global.css` ; remplacer les tests d'`tests/integration/brisage-search.test.tsx` par des tests du nouveau panneau (stat choisie, plusieurs stats = toutes présentes, aucun résultat avec message, retrait d'une pastille, filtres conservés au retour sur la page)
- [ ] T028 [P] [US4] Ajouter dans `tests/integration/brisage-search.test.tsx` : stats rangées dans les trois colonnes avec tacle / fuite / esquive / retrait dans Caractéristiques ; catégorie + niveau + stat combinés ; plage de niveaux inversée = message sans plantage ; panneau replié mais pastilles visibles
- [ ] T029 [US4] Styler le panneau (catégories compactes, niveau, 3 colonnes de stats repliées en une colonne sous ~700 px, pastilles) dans `src/styles/global.css`

**Point de contrôle** : la recherche par stats de `specs/064` est entièrement retrouvée dans le panneau.

---

## Phase 7 : Récit 5 — Informations secondaires en bas de page (P3)

**But** : une ligne compacte sous le tableau avec le coefficient actuel et les trois suivants.

**Test indépendant** : un objet avec un coefficient affiche quatre valeurs sur une ligne, identiques à celles d'avant la refonte.

- [ ] T030 [US5] Dans `BrisagePage.tsx`, remplacer le bloc « Gain selon le coefficient » et le bloc « Valeur estimée des runes » par une ligne compacte sous le tableau : coefficient actuel puis après 1, 2 et 3 brisages (`nextCoefficients`, gain estimé quand il est connu), valeur estimée des runes ; ligne absente ou explicative sans coefficient, sans valeur inventée
- [ ] T031 [P] [US5] Ajouter dans `tests/integration/brisage-page.test.tsx` : quatre coefficients affichés dans l'ordre, mêmes valeurs qu'avant la refonte ; ligne absente sans coefficient ; valeur estimée présente
- [ ] T032 [US5] Styler la ligne du bas dans `src/styles/global.css`

**Point de contrôle** : tous les récits sont livrés.

---

## Phase 8 : Finitions et vérifications transversales

- [ ] T033 [P] Vérifier le clavier et les libellés (boutons d'icône, cartes, pastilles, `aria-expanded`, `aria-pressed`) et l'affichage à 390 px sans défilement horizontal de la page, selon `quickstart.md` §2
- [ ] T034 Comparer avec l'ancienne page sur 3 objets (coefficient enregistré, sans coefficient, sans prix) : totaux, gains et coefficients suivants identiques à entrées égales (SC-003, `quickstart.md` §3)
- [ ] T035 Lancer `npm run test`, `npm run lint` et `npm run build`, corriger les écarts
- [ ] T036 Mettre à jour les commentaires d'en-tête qui citent la recherche par stats (`src/domain/brisage-search.ts`, `src/persistence/brisage-search-prefs.ts`, `scripts/build-brisage-items.mjs`) pour renvoyer aussi à `specs/065-refonte-page-brisage`
- [ ] T037 Lancer le sous-agent `relecteur` sur les changements et corriger les points graves signalés (règle du projet avant d'annoncer la fin)

---

## Dépendances et ordre d'exécution

- **Phase 1** : T001 → T002 (T002 lit le champ produit par T001).
- **Phase 2** dépend de la phase 1 ; chaque test précède son implémentation (T003→T004, T005→T006, T007→T008, T009→T010) ; T011 dépend de T001 et T002. **Bloque tous les récits.**
- **US1 (P1)** : après la phase 2. T012 en parallèle de T013 ; T013 → T014 → T015 → T016.
- **US2 (P1)** : dépend de US1 (cartes et page). T017 → T018 ; T019 et T020 ensuite.
- **US3 (P1)** : dépend de US2 (en-tête) et de T006, T010. T021 → T022 → T023, T024.
- **US4 (P2)** : dépend de T004, T008 et de US1 (`ItemFinder`). T025 → T026 → T027 ; T028 et T029 ensuite. Indépendant de US2 et US3.
- **US5 (P3)** : dépend de US2 (tableau en place). Indépendant de US3 et US4.
- **Finitions** : après tous les récits retenus.

## Exemples d'exécution en parallèle

- **Phase 2** : T003, T005, T007, T009 et T011 touchent des fichiers de test différents et peuvent être écrits ensemble.
- **US1** : T012 (carte) en même temps que T013 (recherche), puis l'assemblage T014.
- **Après le MVP** : US4 (panneau de filtres) et US5 (ligne du bas) touchent des zones différentes de la page.

## Stratégie de mise en œuvre

1. **MVP** : phases 1 à 5 (récits 1 à 3) — la page s'ouvre sur la recherche, affiche des cartes, l'en-tête avec prix Achat / Craft / Auto et coefficient, puis le tableau. Valider avec `quickstart.md`.
2. **Livraison incrémentale** : ajouter le panneau de filtres (récit 4), puis la ligne du bas (récit 5), en validant à chaque point de contrôle.
3. **Fin de tâche** : T035 (tests, lint, build), puis T037 (relecteur).
4. **Fusion** : seulement proposée après l'implémentation (`/speckit-git-merge`), jamais automatique.
