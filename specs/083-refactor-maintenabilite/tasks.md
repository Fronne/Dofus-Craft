---
description: "Liste des tâches : code du site facilement maintenable"
---

# Tâches : Code du site facilement maintenable

**Entrée** : `specs/083-refactor-maintenabilite/` (plan.md, spec.md, research.md, quickstart.md)

**Tests** : aucun nouveau test demandé. Le filet de sécurité est la suite existante (`npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npm run test:e2e`). Une tâche qui change la structure d'un fichier se termine par ces contrôles (au minimum typecheck + lint + les tests du dossier concerné).

**Règle commune à toutes les tâches de découpage** : déplacer le code sans le réécrire (même logique, mêmes noms exportés, mêmes classes CSS, mêmes textes). Les points d'entrée d'origine continuent d'exporter l'API publique d'avant, pour que les imports et les tests existants restent valables.

## Format : `[ID] [P?] [Histoire] Description`

- **[P]** : parallélisable (fichiers différents, aucune dépendance)
- **[US#]** : histoire de la spec

---

## Phase 1 : Préparation

- [ ] T001 Installer les dépendances (`npm install`) et noter la base de référence : lancer `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` sur la branche avant tout changement et consigner dans `specs/083-refactor-maintenabilite/baseline.md` le nombre de tests passés et les éventuels échecs déjà présents
- [ ] T002 Sauvegarder le CSS compilé de référence : après `npm run build`, copier `dist/assets/*.css` vers `specs/083-refactor-maintenabilite/.baseline-css/` (dossier à ne pas committer : l'ajouter à `.git/info/exclude` du worktree)

---

## Phase 2 : Fondations

Rien de bloquant : les histoires sont indépendantes. Passer à la phase 3 une fois T001 et T002 faits.

---

## Phase 3 : Histoire 5 — Un seul gestionnaire de paquets (P3, fait en premier car trivial)

**Objectif** : npm seul.

**Test indépendant** : `npm ci` puis `npm run build` et `npm run test` réussissent ; plus aucun fichier pnpm.

- [ ] T003 [US5] Supprimer `pnpm-lock.yaml` et `pnpm-workspace.yaml` à la racine
- [ ] T004 [US5] Chercher toute mention de pnpm dans `README.md`, `docs/`, `scripts/`, `package.json`, `.gitignore`, `wrangler.toml` et la corriger pour npm
- [ ] T005 [US5] Vérifier `npm ci && npm run build` (l'installation propre doit réussir avec `package-lock.json` seul)

---

## Phase 4 : Histoire 2 — Style retrouvable par fonctionnalité (P2)

**Objectif** : `src/styles/global.css` ne contient plus que des `@import`, dans l'ordre d'origine.

**Test indépendant** : le CSS compilé est identique à la référence de T002 ; e2e verts.

- [ ] T006 [US2] Écrire un script jetable (dans le dossier scratchpad, pas dans le dépôt) qui découpe `src/styles/global.css` en tranches contiguës par numéros de ligne et vérifie que la concaténation des tranches est identique octet pour octet à l'original
- [ ] T007 [US2] Créer `src/styles/parts/` avec les tranches suivantes (lignes de l'original ; ajuster aux limites exactes de commentaire de section) :
  `base.css` (1–30), `app-shell.css` (31–240), `controls.css` (241–311 : boutons d'icône, boutons, badges, panneaux), `search.css` (312–600 : recherche, résultats, états vides), `pinned-and-item.css` (601–810), `price-list.css` (811–959), `server-onboarding.css` (960–1041), `settings.css` (1042–1199), `home.css` (1200–1268), `prices-page.css` (1269–1473), `responsive.css` (1474–1613), `dungeon-counter.css` (1614–1746), `forgemagie.css` (1747–1930), `states-motion-touch.css` (1931–2020), puis la couche « style du site » : `site-style-base.css` (2021–2278), `site-style-recherche.css` (2279–2428), `site-style-page.css` (2429–fin : illustration et chargeur de page)
- [ ] T008 [US2] Remplacer le contenu de `src/styles/global.css` par les `@import './parts/….css';` dans l'ordre exact ci-dessus, avec un commentaire d'en-tête expliquant que l'ordre est celui de la cascade
- [ ] T009 [US2] Vérifier que les `@import` fonctionnent pour `src/main.tsx` et pour `admin/main.tsx` (les deux importent `global.css`) : `npm run build` et `npm run admin:build`
- [ ] T010 [US2] Construire à nouveau, comparer le CSS compilé à la référence de T002 (même contenu, même ordre des règles) ; en cas de différence, corriger la tranche fautive
- [ ] T011 [US2] Lancer `npm run test` et `npm run test:e2e` ; mettre à jour les commentaires de code qui citent `global.css` (par exemple dans `src/app/AppShell.tsx`, `src/features/catalogue/EpinglesPage.tsx`, `src/features/comparison/*`) pour pointer vers le bon fichier de `src/styles/parts/`
- [ ] T012 [US2] Vérifier qu'aucun fichier de `src/styles/` ne dépasse 600 lignes (CR-002) ; sinon recouper la tranche

**Point de contrôle** : style découpé, rendu identique.

---

## Phase 5 : Histoire 4 — Règles, données, API et Worker par sujet (P3)

**Objectif** : aucun de ces fichiers ne dépasse 300 lignes ; API publique inchangée.

**Test indépendant** : tests unitaires et d'intégration inchangés et verts.

### Domaine

- [ ] T013 [P] [US4] Découper `src/domain/brisage.ts` en dossier `src/domain/brisage/` : `coefficients.ts` (nextCoefficient, displayedCoefficient, wholeRunes, averageRoll, coefficientDescent, minimumProfitableCoefficient, MAX_COEFFICIENT), `stats.ts` (BRISAGE_STATS, BrisageSettings, defaultBrisageSettings, mergeBrisageSettings, brisageStat), `runes.ts` (runeSizeOf, runeForStat, lineWeight, negativeStatId, negativeLineWeight, runesForLine), `weight-limit.ts` (MAX_LINE_WEIGHT, maxValueForWeight, lineValueLimit, isRollAllowed), `analysis.ts` (types d'entrée/sortie, usableLines, buildOption, analyzeBrisage), `focus-advice.ts` (FocusAdvice, analyzeFocusAdvice) et `index.ts` qui réexporte tout ; supprimer l'ancien fichier une fois les imports `…/domain/brisage` toujours résolus par `index.ts`
- [ ] T014 [P] [US4] Découper `src/domain/forgemagie.ts` en dossier `src/domain/forgemagie/` : `purchase-lines.ts` (PurchaseLine, PURCHASE_LINE_PATTERN, parsePurchaseLines, unitPriceKamas, normalizeItemName, summarizeByItem, correctionValues), `api-types.ts` (PriceOrigin, Fm* des joueurs, sessions, séances, profils, PriceStatus), `seances.ts` (SEANCE_STATE_LABELS, fmItemDisplayName, matchesItemQuery, mergeIgnoredLines, groupTabLabel, spendingBySeance, formatFmDate), `runes.ts` (RuneItem, RuneItemsData, runeStatLabels, filterRunes, isRuneName), `login.ts` (LoginError, parseLoginFragment), `capture-import.ts` (PriceableResource, buildResourceNameIndex, ProposedLine, proposeLines) et `index.ts` qui réexporte tout

### Données et client API

- [ ] T015 [P] [US4] Découper `src/data/catalogue-repository.ts` en dossier `src/data/catalogue/` : `indexes.ts` (chargement et préchargement des index : getInitialCatalogueItems, getCatalogueItemIndex, getCatalogueItemsForSearch/Category, getItemSetIndex, preloadCatalogueIndexes, whenCatalogueReady), `search.ts` (searchItems, matchesAllTokens, matchesLevel, itemCategoryMatches, getCategories), `item-detail.ts` (getItemDetail, getResourceRecipe, getResourceDetails), `effects.ts` (chargement groupé des effets, mapItemStats, formatEffectDescription, getDisplayedEffectValues, characteristicIcon, getItemEffectLines, effectRangesOf, negativeRangesOf, getItemEffectRanges, getItemNegativeRanges), et `index.ts` qui réexporte tout, y compris `getManifest`
- [ ] T016 [P] [US4] Découper `src/services/community-price-api.ts` en dossier `src/services/community-price/` : `http.ts` (API_URL, API_KEY, apiHeaders, readParams, readInit, isRecord), `validation.ts` (isCommunityPriceRow, withKnownOrigin, knownAuthor, isLatestItemPriceRow, isSharedPrice, isPriceHistory, isSharedItemPriceEntry), `reads.ts` (getCommunityPrice, getLatestItemPrice, getPriceHistory, getSharedItemPrices, getCommunityPrices, getCommunityLotPrices), `refresh.ts` (refreshExternalPrices, refreshRecipePrices), `submit.ts` (submitCommunityPrice) et `index.ts` qui réexporte tout ; chaque type `*Lookup` reste exporté depuis `index.ts`
- [ ] T017 [US4] Mettre à jour les appels `vi.mock(…)` et les imports qui visent les anciens chemins de fichier (`src/domain/brisage`, `src/domain/forgemagie`, `src/data/catalogue-repository`, `src/services/community-price-api`) uniquement si la résolution ne passe plus par un `index.ts` ; les chemins simples de dossier restent valables
- [ ] T018 [US4] Lancer `npm run typecheck`, `npm run lint`, `npm run test` après T013 à T017

### Worker

- [ ] T019 [P] [US4] Découper `worker/src/index.ts` : sortir les utilitaires de réponse (`json`, `cachedJson`, `isAuthorized`) dans `worker/src/http.ts`, la lecture des prix communautaires (`communityPriceResponse`) dans `worker/src/routes/community-prices.ts`, les contributions dans `worker/src/routes/contributions.ts`, les visites (`VisitPayload`, `isVisitPayload`, `handlePostVisit`) dans `worker/src/routes/visits.ts` ; `index.ts` garde `Env`, l'aiguillage des routes et la tâche planifiée, sans changer les chemins ni les réponses
- [ ] T020 [P] [US4] Découper `worker/src/fm/seances.ts` en dossier `worker/src/fm/seances/` : `types.ts` (lignes et vues), `list.ts` (summarize, seancesOf, listSeances, findSeance), `detail.ts` (seanceDetail, readSeance, ITEM_COLUMNS, summaries, readNames), `commands.ts` (cancelPending, archiveSeance, reopenSeance), `items.ts` (itemStatements, setSeanceItem, removeSeanceItem, itemViews) et `index.ts` qui réexporte les fonctions utilisées par `worker/src/fm/` et `worker/src/index.ts`
- [ ] T021 [US4] Lancer les tests du Worker (`tests/unit` et `tests/integration` liés à `worker/`), `npm run typecheck` et `npm run lint` ; vérifier avec `npx wrangler deploy --dry-run --config worker/wrangler.toml` que le Worker se construit (ne rien déployer)

**Point de contrôle** : aucun fichier de la phase de plus de 300 lignes (CR-004) ; tests verts.

---

## Phase 6 : Histoire 3 — Composants de page lisibles (P2)

**Objectif** : chaque composant ciblé tient sous ~300 lignes et délègue.

**Test indépendant** : tests d'intégration de la page inchangés et verts ; rendu identique.

Pour chaque tâche : lire le fichier, repérer les blocs d'état et d'effets (à extraire dans `use<Nom>.ts` dans le même dossier), puis les blocs d'affichage autonomes (à extraire en sous-composants dans le même dossier, nommés par leur rôle) ; le composant de page garde l'assemblage et son export actuel. Aucune prop, classe CSS, `aria-label` ni texte modifié.

- [ ] T022 [P] [US3] Scinder `src/features/brisage/BrisagePage.tsx` (839 lignes). Filet : `tests/integration/brisage-page.test.tsx`
- [ ] T023 [P] [US3] Scinder `src/features/brisage/RankingTab.tsx` (331 lignes). Filet : tests d'intégration du brisage
- [ ] T024 [P] [US3] Scinder `src/features/search/RecherchePage.tsx` (573 lignes). Filet : les tests d'intégration de la recherche
- [ ] T025 [P] [US3] Scinder `src/features/catalogue/EpinglesPage.tsx` (504 lignes). Filet : tests d'intégration des épinglés
- [ ] T026 [P] [US3] Scinder `src/features/pets/FamilierPage.tsx` (408 lignes). Filet : `tests/integration/familier-page.test.tsx`
- [ ] T027 [P] [US3] Scinder `src/app/AppShell.tsx` (370 lignes) : barre du haut, menu « Plus », mesure des liens, indicateur de page courante. Filet : tests d'intégration de l'application et e2e
- [ ] T028 [US3] Lancer `npm run typecheck`, `npm run lint`, `npm run test` ; vérifier que chaque fichier principal est sous ~300 lignes (CR-003)

**Point de contrôle** : composants découpés, tests inchangés et verts.

---

## Phase 7 : Histoire 1 — Aucune régression (P1) et finitions

- [ ] T029 [US1] Lancer toute la suite : `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run test`, `npm run build`, `npm run test:e2e` ; comparer le nombre de tests passés à `baseline.md` (CR-001)
- [ ] T030 [US1] Ouvrir le site en local (`npm run dev`) et passer les pages Accueil, Recherche, Épinglés, Brisage, Familier, Forgemagie, Prix, Réglages, en clair et en sombre, écran large et étroit ; comparer à `master`
- [ ] T031 Mettre à jour `README.md` : arborescence de `src/styles/parts/`, nouveaux dossiers (`domain/brisage/`, etc.) et mention de npm comme seul gestionnaire ; supprimer `baseline.md` et le dossier `.baseline-css/`
- [ ] T032 Appliquer `npm run format` aux seuls fichiers touchés, puis relancer `npm run lint`
- [ ] T033 Lancer le sous-agent `relecteur` sur les changements et corriger les points graves signalés (règle du projet)

---

## Dépendances et ordre d'exécution

- Phase 1 d'abord ; les phases 3, 4, 5, 6 ne se recouvrent pas (fichiers disjoints) mais sont exécutées dans cet ordre, du moins au plus risqué.
- T004 dépend de T003 ; T007 à T012 se suivent ; T013 à T016 et T019, T020 sont parallélisables ; T017 et T018 viennent après T013 à T016 ; T021 après T019 et T020.
- T022 à T027 sont parallélisables (fichiers différents) ; T028 clôt la phase.
- Phase 7 en dernier.

## Stratégie

Un commit par phase (tests verts avant chaque commit). Si une étape casse un test que le déplacement n'explique pas, revenir au dernier commit et refaire la tranche plus petite. MVP = phase 4 (CSS), qui donne le plus gros gain de lisibilité pour le moins de risque.
