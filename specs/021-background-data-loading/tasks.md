---
description: "Tâches : chargement des données en fond et cache persistant"
---

# Tasks: Chargement des données en fond et cache persistant

**Input**: `specs/021-background-data-loading/` (plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md)

**Tests**: inclus — la constitution (principe II) exige des tests pour toute optimisation touchant
les calculs ou les données affichées.

## Phase 1: Setup

Aucune tâche : pas de dépendance ni de configuration nouvelle (`fake-indexeddb` est déjà présent).

## Phase 2: Foundational

Aucune tâche bloquante commune : les trois histoires sont indépendantes. US2 bénéficie de US1 sans
en dépendre.

---

## Phase 3: User Story 1 — Catalogue disponible dès la deuxième visite (P1) 🎯 MVP

**Goal**: les données DofusDB passent par un cache mémoire + IndexedDB, frais 24 h, revalidé en fond.

**Independent Test**: quickstart §1 — rechargement sans requête DofusDB pour les données déjà obtenues.

- [X] T001 [P] [US1] Ajouter `formatVersion` aux entrées de `src/persistence/indexeddb-catalogue-cache-store.ts` : `set(key, value)` écrit `{ key, value, savedAt, formatVersion: CATALOGUE_FORMAT_VERSION }` (constante exportée, valeur 1) ; ajouter `getVersioned(key)` qui renvoie `undefined` si `formatVersion` ≠ `CATALOGUE_FORMAT_VERSION` ; `get` existant inchangé pour `useCatalogue`
- [X] T002 [P] [US1] Tests dans `tests/unit/catalogue-cache-store.test.ts` : entrée d'une autre version ignorée par `getVersioned`, entrée courante lue avec `savedAt`
- [X] T003 [US1] Réécrire `cached()` dans `src/data/catalogue-cache.ts` : mémoire → `getVersioned` IndexedDB → chargeur réseau ; entrée IndexedDB de moins de 24 h (`PERSISTED_FRESH_MS = 24 * 60 * 60 * 1000`) utilisée telle quelle ; plus vieille : renvoyée immédiatement et rechargement réseau lancé en fond (dédoublonné via `pending`) qui met à jour mémoire et IndexedDB ; toute erreur IndexedDB avalée ; ajouter `hydrateFromPersistentStore(keys)` qui recopie en mémoire les entrées IndexedDB valides (même périmées) pour que `peekCached` les voie ; toute erreur IndexedDB avalée (retour au chemin réseau) ; écritures IndexedDB non attendues ; `peekCached` et `clearCache` inchangés ; injecter le store via un paramètre de module (`setPersistentStore`) pour les tests
- [X] T003b [US1] Dans `preloadCatalogueIndexes()` (`src/data/catalogue-repository.ts`), appeler d'abord `hydrateFromPersistentStore(['catalogue-item-index', 'item-set-index'])` puis les chargements actuels, pour que la recherche porte sur le catalogue complet dès l'ouverture (SC-001)
- [X] T004 [US1] Tests dans `tests/unit/catalogue-cache.test.ts` (fake-indexeddb) : 2ᵉ appel après `clearCache()` servi sans chargeur ; entrée périmée servie puis chargeur appelé une fois en fond ; IndexedDB en erreur → chargeur appelé, résultat correct ; version incompatible → chargeur appelé
- [X] T005 [US1] Vérifier que `tests/unit/catalogue-repository.test.ts` passe toujours (isoler le store persistant entre tests si besoin via `setPersistentStore`)

**Checkpoint**: US1 livrable seule.

---

## Phase 4: User Story 2 — Page Prix déjà prête (P2)

**Goal**: calcul Prix partagé en module, lancé en fond quand le site est inactif.

**Independent Test**: quickstart §2.

- [X] T006 [US2] Dans `src/features/prices/useCraftProfits.ts`, extraire le corps de l'effet en `computeCraftProfits(serverId, priceMode)` au niveau module : un calcul par clé `serverId:mode` dans une Map `running` (promesse + ensemble d'abonnés `(state) => void`), résultat `ready` stocké dans le `cache` existant ; `subscribeCraftProfits(serverId, mode, listener)` renvoie une fonction de désabonnement ; règles de calcul inchangées (FR-008) ; un calcul qui perd son dernier abonné page ET n'est pas celui du contexte actif (serveur/mode) est annulé via son drapeau `cancelled`, sans rien écrire dans le cache (FR-009)
- [X] T007 [US2] Réécrire `useCraftProfits` pour s'abonner à `subscribeCraftProfits` : état initial = cache ou calcul en cours ; liste en cache conservée à l'écran jusqu'au `ready` suivant (comportement actuel) ; pas de second calcul si un calcul est déjà en cours pour la clé (FR-007)
- [X] T008 [US2] Concurrence adaptative dans `computeCraftProfits` : 2 tant qu'aucun abonné n'est une page (`preload`), 6 dès qu'une page s'abonne
- [X] T009 [US2] Ajouter `preloadCraftProfits(serverId, priceMode)` dans `src/features/prices/useCraftProfits.ts` : ne fait rien si un résultat `ready` ou un calcul existe pour la clé ; sinon attend `whenCatalogueReady()` (`src/data/catalogue-repository.ts`) puis `requestIdleCallback` (repli `setTimeout` 2000 ms) avant de lancer le calcul
- [X] T010 [US2] Dans `src/app/AppShell.tsx`, appeler `preloadCraftProfits` avec le serveur actif (`useActiveServer`) et le mode de prix actif, dans un `useEffect` dépendant des deux (FR-006, FR-009)
- [X] T011 [US2] Tests dans `tests/unit/craft-profits-preload.test.ts` : préchargement puis abonnement → aucun nouvel appel à `getItemDetail` ; résultat identique à un calcul direct ; changement de serveur → nouvelle clé calculée ; abonnement pendant un calcul en cours → progression reçue, un seul calcul ; changement de serveur → l'ancien calcul sans abonné est annulé et n'écrit rien ; en préchargement, jamais plus de 2 `getItemDetail` simultanés

**Checkpoint**: US2 testable indépendamment.

---

## Phase 5: User Story 3 — Prix communautaires chargés d'un coup (P3)

**Goal**: endpoint groupé, cache 60 s côté worker et navigateur, lecture fraîche après contribution.

**Independent Test**: quickstart §3.

- [X] T012 [P] [US3] Dans `worker/src/contribution.ts`, ajouter `fetchCurrentMedians(db, resourceIds, serverId)` : une requête `SELECT resource_id, amount_kamas, created_at, device_id … WHERE resource_id IN (…) AND server_id = ? AND created_at >= ? AND kind = 'resource'`, regroupement par ressource, `summarizeContributions` par groupe ; ressources sans médiane omises
- [X] T013 [P] [US3] Créer `worker/src/read-cache.ts` : Map `clé → { body, status, expiresAt }`, TTL 60 s, 500 entrées max (suppression des plus anciennes), `getCached`, `setCached`, `clearReadCache`
- [X] T014 [US3] Dans `worker/src/index.ts` : route `GET /community-prices` selon `contracts/community-prices.md` (400 si `serverId` absent, `resourceIds` vide ou > 100 ids ; doublons ignorés ; réponse `{ serverId, prices }`) ; pour les GET `/community-price`, `/community-prices`, `/latest-price`, `/item-prices`, `/price-history` : servir depuis `read-cache` sauf `fresh=1`, en-tête `Cache-Control: public, max-age=60` (ou `no-store` avec `fresh=1`) ; `clearReadCache()` après une contribution acceptée ; `/info-message` et `/player-counters` inchangés
- [X] T015 [US3] Tests worker dans `tests/unit/community-prices-route.test.ts` : valeurs identiques à `fetchCurrentMedian` par ressource, ressource sans médiane absente, 400 sur > 100 ids, en-tête `Cache-Control`, 2ᵉ lecture servie sans requête D1, `fresh=1` relit la base, POST vide le cache
- [X] T016 [US3] Dans `src/services/community-price-api.ts` : `getCommunityPrices(resourceIds, serverId)` (lots de 100, jamais d'exception, `unavailable` en cas d'échec) ; option `{ fresh: true }` sur `getCommunityPrice` qui ajoute `fresh=1`
- [X] T017 [US3] Dans `src/features/comparison/useCommunityPrice.ts` : `lookupCommunityMedians(resourceIds, serverId)` qui appelle `getCommunityPrices`, écrit chaque prix trouvé dans le cache localStorage existant (`writeCache`) et, si indisponible, retombe sur `readCache` par ressource ; `commit` relit avec `{ fresh: true }` après l'envoi (FR-013)
- [X] T017b [US3] FR-013 pour les prix d'objets : option `{ fresh: true }` sur `getLatestItemPrice` (`src/services/community-price-api.ts`) et relecture avec `fresh` dans le `commit` de `src/features/comparison/useSharedItemPrice.ts` ; après toute contribution acceptée (ressource ou objet), appeler `clearCraftProfitsCache()` et marquer la prochaine lecture `/item-prices` de `getSharedItemPrices` comme `fresh=1` (drapeau de module `forceFreshItemPrices`)
- [X] T018 [US3] Dans `src/features/comparison/community-gap-fill.ts` (utilisé par la page Recherche et la page Suivis `src/features/catalogue/EpinglesPage.tsx`), remplacer les appels unitaires par un seul `lookupCommunityMedians` sur les ressources sans prix, puis `saveMedian` pour chacune (même ordre de garde `isCancelled` / prix existant)
- [X] T019 [US3] Dans `src/features/search/RecherchePage.tsx`, avant le montage des lignes en mode communautaire, précharger les médianes de toutes les ressources de la recette via `lookupCommunityMedians` pour que chaque `useCommunityPrice` lise son cache immédiatement
- [X] T020 [US3] Tests : `tests/unit/community-price-api.test.ts` (lots de 100, `fresh=1`, échec → `unavailable`) `tests/unit/use-community-price.test.tsx` (`lookupCommunityMedians` alimente le cache ; `commit` relit avec `fresh`) et `tests/unit/use-shared-item-price.test.tsx` (`commit` relit avec `fresh`, cache Prix vidé)

**Checkpoint**: les trois histoires fonctionnent.

---

## Phase 6: Polish

- [X] T021 Mettre à jour les commentaires des specs touchées : note de révision dans `specs/019-craft-profit-list/research.md` (calcul partagé et préchargé) et `specs/010-search-instant-cache/research.md` (cache catalogue persistant)
- [X] T022 Lancer `npm test`, `npm run typecheck`, `npm run lint` et dérouler `quickstart.md`

---

## Dependencies & Execution Order

- US1, US2, US3 indépendantes ; ordre conseillé P1 → P2 → P3 (US2 profite de US1).
- US1 : T001 → T003 → T003b → T004/T005 ; T002 parallèle à T003.
- US2 : T006 → T007 → T008 → T009 → T010 → T011.
- US3 : T012, T013 en parallèle → T014 → T015 ; T016 → T017 → T017b → T018/T019 → T020.
- Polish après toutes les histoires.

## Parallel Example

```text
US1 : T001 + T002 (store et ses tests)
US3 : T012 (worker/contribution.ts) + T013 (worker/read-cache.ts) + T016 (client)
```

## Implementation Strategy

MVP = US1 (plus gros gain, aucun changement côté worker). Puis US2 (page Prix instantanée), puis US3
(nécessite un `npm run worker:deploy` avant de déployer le site, le client appelant `/community-prices`).

## Notes d'implémentation

- T016/T017/T017b : au lieu d'une option `fresh` par appel, `submitCommunityPrice` ouvre une fenêtre
  de 60 s pendant laquelle **toutes** les lectures de prix de l'appareil passent `fresh=1` et
  `cache: 'no-store'` (ressource, objet, `/item-prices`, historique). Cela couvre FR-013 sur toutes
  les pages sans toucher à chaque hook ; `clearCraftProfitsCache()` n'est pas nécessaire car la page
  Prix recalcule déjà à chaque ouverture, avec ces lectures fraîches.
- T018/T019 : le regroupement est fait une seule fois dans `loadCommunityPrice`
  (`useCommunityPrice.ts`) : toutes les lectures de médiane lancées dans la même micro-tâche (lignes
  d'une recette qui se montent, `fillCommunityGaps` des pages Recherche, Suivis et Prix) partent en
  une requête `/community-prices`. Une ressource seule garde l'ancienne lecture `/community-price`.
- Déploiement : `npm run worker:deploy` avant le site (sinon `/community-prices` répond 404 et les
  lectures groupées retombent sur les derniers prix gardés sur l'appareil).
