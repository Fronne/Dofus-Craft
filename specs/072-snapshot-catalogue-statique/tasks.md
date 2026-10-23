# Tasks: Catalogue du jeu servi en snapshot statique

**Input**: `specs/072-snapshot-catalogue-statique/` (plan.md, spec.md, research.md, data-model.md, contracts/snapshot-format.md)

**Tests**: demandés (constitution II, SC-006) ; Vitest dans `tests/unit/`.

## Phase 1: Setup

- [x] T001 Ajouter `public/catalogue-snapshot/` à `.gitignore`
- [x] T002 Ajouter dans `package.json` les scripts `"snapshot:catalogue": "node scripts/build-catalogue-snapshot.mjs"` et `"prebuild": "npm run snapshot:catalogue"`

## Phase 2: Foundational

- [x] T003 Recenser dans `src/services/dofusdb-mappers.ts` et `src/data/catalogue-repository.ts` les champs de `DofusDbItem` / `DofusDbItemSet` réellement lus, et les noter en tête de `scripts/build-catalogue-snapshot.mjs` comme liste blanche de projection (research R2 ; repli : objets complets si un champ est douteux)
- [x] T004 Ajouter `seedCache(key, value, meta)` dans `src/data/catalogue-cache.ts` : met `value` en mémoire (expiration longue), l'écrit dans le magasin persistant avec `origin`, `generatedAt`, `totals` (data-model.md « CatalogueOrigin ») ; écriture atomique, erreurs avalées ; exposer aussi la lecture des métadonnées d'une clé gardée
- [x] T005 [P] Test de `seedCache` : valeur visible via `peekCached`, persistance, erreur de magasin sans exception, dans `tests/unit/catalogue-cache.test.ts`

## Phase 3: User Story 1 — Première visite rapide (P1)

**Goal**: index remplis depuis le snapshot, sans requête paginée DofusDB.
**Independent Test**: cache vide, `fetch` simulé servant le snapshot et refusant DofusDB → recherche complète.

- [x] T006 [P] [US1] Tests dans `tests/unit/catalogue-snapshot.test.ts` : snapshot valide amorce `catalogue-item-index` et `item-set-index` (dont `itemSetIdsByItemId`) sans appel DofusDB ; longueurs ≠ `totals` ⇒ rejet ; 404 / JSON invalide ⇒ repli ; cache plus récent que `generatedAt` ⇒ snapshot non téléchargé (seul `meta.json` lu)
- [x] T007 [US1] Créer `src/data/catalogue-snapshot.ts` : `loadCatalogueSnapshot(): Promise<boolean>` (lit `/catalogue-snapshot/meta.json`, compare au cache gardé, charge `items.json` et `item-sets.json`, valide les longueurs, reconstruit `itemSetIdsByItemId`, appelle `seedCache` avec origine `snapshot`) ; un cache hérité de la spec 021 sans provenance est considéré plus ancien que tout snapshot ; retourne `false` sur tout échec
- [x] T008 [US1] Modifier uniquement le corps de `preloadCatalogueIndexes()` dans `src/data/catalogue-repository.ts` : hydrater le cache, appeler `loadCatalogueSnapshot()` ; si `true` ne pas lancer le crawl (research R5), sinon repli sur `getCatalogueItemIndex()` / `getItemSetIndex()` (comportement actuel)
- [x] T009 [US1] Test d'équivalence dans `tests/unit/catalogue-snapshot.test.ts` : `mapDofusDbItem` sur objet brut = sur objet projeté (jeu de fixtures représentatif) ; `searchItems` renvoie les mêmes résultats avec index issu du snapshot et index brut (SC-006)

**Checkpoint**: la recherche fonctionne depuis le snapshot.

## Phase 4: User Story 2 — Génération à chaque déploiement (P1)

**Goal**: snapshot produit et validé automatiquement par `prebuild`.
**Independent Test**: script avec `fetch` simulé.

- [x] T010 [P] [US2] Tests du script dans `tests/unit/build-catalogue-snapshot.test.ts` : pagination complète, écriture de `meta.json` / `items.json` / `item-sets.json`, échec (code ≠ 0, aucun fichier écrit ni écrasé) si DofusDB injoignable, total 0, longueur ≠ total ou effectif < 50 % du snapshot précédent
- [x] T011 [US2] Créer `scripts/build-catalogue-snapshot.mjs` : récupère `/items?hasRecipe=true` (pages de 100, tri `name.fr`) et `/item-sets` (pages de 50, tri `id`), reprises sur erreur comme `scripts/build-item-types.mjs`, projection T003, contrôles de cohérence (research R8), écriture atomique dans `public/catalogue-snapshot/` (fichier temporaire puis renommage), résumé console (comptes, taille) ; exporter une fonction pour le test
- [x] T012 [US2] Exécuter `npm run snapshot:catalogue`, relever la taille compressée (brotli/gzip) de `items.json` + `item-sets.json` ; si > ~1,5 Mo, réduire la liste blanche

## Phase 5: User Story 3 — Rafraîchissement discret (P2)

**Goal**: retélécharger seulement sur écart de `total`.
**Independent Test**: `fetch` simulé avec totaux identiques puis différents.

- [x] T013 [US3] Tests dans `tests/unit/catalogue-snapshot.test.ts` : totaux identiques ⇒ 2 requêtes `$limit=0` et aucun crawl ; écart ⇒ crawl (`getDofusDbItems` / `getDofusDbItemSets`) puis `seedCache` origine `dofusdb` ; délai de 6 h respecté (horloge simulée) ; erreur réseau silencieuse, cache intact ; stockage indisponible ⇒ un contrôle par session
- [x] T014 [US3] Ajouter `refreshCatalogueIfChanged()` dans `src/data/catalogue-snapshot.ts` : lit les `total` (`/items?hasRecipe=true&$limit=0`, `/item-sets?$limit=0`, repli `$limit=1`) via un helper de `src/services/dofusdb-api.ts`, compare aux `totals` du catalogue utilisé, horodatage dans `localStorage` (try/catch, 6 h), retélécharge en fond et remplace les index sans perturber la page en cours
- [x] T015 [US3] Brancher l'appel différé de `refreshCatalogueIfChanged()` à la fin du chemin réussi de `preloadCatalogueIndexes()` (une ligne dans `src/data/catalogue-repository.ts`)

## Phase 6: Polish

- [x] T016 Mettre à jour `specs/021-background-data-loading` (note de révision : snapshot livré, plus de crawl au lancement) et la documentation de déploiement si elle existe (le build requiert l'accès à DofusDB)
- [x] T017 Lancer `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` ; valider le `quickstart.md` (étapes 1 à 6) avec `preview` ; mesurer le TTI mobile avec Lighthouse (SC-002, cible < 8 s) et noter le résultat dans `quickstart.md`
  - Mesure Lighthouse (SC-002) non faite dans cette session : à relever après déploiement.
- [x] T018 Lancer le sous-agent `relecteur` sur le diff et corriger les points graves

## Dependencies

T001-T002 → T003 → T004 → US1 (T006-T009) ; US2 (T010-T012) indépendante de US1 mais T012 conditionne les mesures ; US3 (T013-T015) dépend de T007 ; Polish en dernier.

## Parallel examples

- T005, T006 et T010 (fichiers de tests distincts) en parallèle.
- US1 et US2 en parallèle après T004.

## Implementation strategy

MVP = US1 + US2 (le snapshot généré et utilisé) ; US3 ensuite. Fusion dans `master` seulement sur demande de l'utilisateur.
