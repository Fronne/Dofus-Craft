---

description: "Task list for feature implementation"
---

# Tasks: Affichage instantané du cache local sur la page Recherche

**Input**: Design documents from `/specs/010-search-instant-cache/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Incluses — la Constitution du projet (Principe II) exige des tests automatisés pour toute
règle dont dépend la correction du comportement, et la garde anti-race (FR-009/FR-010) en est le
cœur ici.

**Organization**: Tâches groupées par user story pour une implémentation et une validation
indépendantes de chacune.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Peut s'exécuter en parallèle (fichiers différents, pas de dépendance bloquante)
- **[Story]**: User story concernée (US1, US2, US3, US4)
- Chemins de fichiers exacts inclus dans chaque description

## Path Conventions

Projet unique existant : `src/` (app React sous Vite), `tests/unit/` et `tests/integration/`
(Vitest + Testing Library, `fake-indexeddb/auto` déjà activé globalement dans
`src/test/setup.ts`). Aucun changement côté `worker/`.

---

## Phase 1: Setup

Aucune tâche de setup requise : aucune nouvelle dépendance, aucun nouvel outil de build/lint/test
n'est nécessaire (Vite/Vitest/ESLint/`fake-indexeddb` couvrent déjà les nouveaux fichiers
`.ts`/`.tsx` sans configuration additionnelle — voir research.md).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Le mécanisme générique "cache local immédiat + revalidation réseau + garde anti-race"
et sa persistance, communs au catalogue et aux prix communautaires.

**⚠️ CRITICAL**: Aucune tâche des user stories ne doit démarrer avant la fin de cette phase.

- [X] T001 [P] Créer `src/persistence/indexeddb-catalogue-cache-store.ts` : nouvelle base IndexedDB
  dédiée `dofus-craft-catalogue-cache` (version 1), un seul object store `entries` (keyPath
  `key`). Exporter `catalogueCache` avec `get(key: string): Promise<{ value: unknown; savedAt:
  string } | undefined>` et `set(key: string, value: unknown): Promise<string>` (retourne le
  `savedAt` ISO 8601 écrit). Champs de l'entité `CatalogueCacheEntry` (data-model.md) : `key`
  (string non vide), `value` (JSON sérialisable, stocké tel quel), `savedAt` (string ISO 8601,
  horodatage de l'écriture). Suivre le pattern ouverture/fermeture-par-opération déjà utilisé dans
  `src/persistence/server-scoped-price-store.ts` (research.md §1 : base séparée de `dofus-craft`,
  aucun changement sur les stores de prix existants).
- [X] T002 [P] Créer `tests/unit/catalogue-cache-store.test.ts` : aller-retour `set` puis `get`
  retourne la même `value` et un `savedAt` ISO valide ; `get` sur une clé absente retourne
  `undefined` ; un second `set` sur la même `key` écrase l'entrée précédente et avance `savedAt`.
  Suivre le style de `tests/unit/server-scoped-price-store.test.ts`.
- [X] T003 Créer `src/data/use-stale-while-revalidate.ts` exportant
  `useStaleWhileRevalidate<T>({ key, loadCached, fetchRemote, saveCache, isEqual? })` qui retourne
  `{ data: T | undefined; loading: boolean; isRevalidating: boolean; offline: boolean; error:
  unknown; lastSyncedAt: string | undefined }` (forme exacte dans data-model.md, section "Nouvel
  état dérivé"). Comportement (research.md §3-§5) : si `key` est `undefined`, retourne l'état vide
  immédiatement sans rien appeler. Sinon, à chaque changement de `key`, incrémente un compteur de
  génération et réinitialise un drapeau `networkArrived` (tous deux en `useRef`, par clé) ; lance
  `loadCached(key)` et `fetchRemote(key)` en parallèle. Une résolution de `loadCached` n'est
  appliquée à `data` (avec `loading: false`) que si sa génération est toujours courante ET que
  `networkArrived` est encore faux pour cette génération. Une résolution de `fetchRemote`, si sa
  génération est toujours courante, marque `networkArrived = true`, appelle `saveCache(key,
  value)`, met à jour `lastSyncedAt` à l'heure courante, mais ne déclenche `setData` que si
  `isEqual(current, value)` est faux (par défaut `isEqual` compare via
  `JSON.stringify(a) === JSON.stringify(b)`, research.md §5) — sinon seuls `isRevalidating` et
  `offline` changent d'état, `data` reste la même référence (FR-004). Un rejet de `fetchRemote`
  toujours de génération courante met `offline: true` et `error` sans jamais toucher `data`
  existant (FR-007) ; si aucune donnée n'a jamais été résolue (ni cache ni réseau), l'état reste
  `loading: true` avec `error` renseigné, pour laisser l'appelant reproduire le message
  d'erreur actuel (FR-006).
- [X] T004 [P] Créer `tests/unit/use-stale-while-revalidate.test.tsx` (JSX — voir plus bas)
  couvrant au minimum, avec des
  `loadCached`/`fetchRemote` contrôlés manuellement (promesses résolues dans un ordre choisi par le
  test) : (a) sans cache, l'état démarre `loading: true` jusqu'à la résolution réseau (FR-006) ;
  (b) avec un cache qui résout après le réseau pour la même génération, le cache n'écrase jamais la
  donnée réseau déjà affichée (FR-010) ; (c) un changement de `key` avant la résolution d'un appel
  précédent fait ignorer cette résolution tardive, même si elle arrive après la résolution de la
  nouvelle clé (FR-009) ; (d) une résolution réseau dont le contenu est strictement identique à
  `data` déjà affiché ne déclenche pas de nouvelle référence d'objet en sortie (FR-004) ; (e) un
  échec réseau alors qu'une donnée cache est déjà affichée laisse `data` inchangé et met
  `offline: true` (FR-007).
- [X] T005 [P] Créer `src/components/SyncStatusIndicator.tsx` : composant partagé et discret,
  props `{ isRevalidating: boolean; offline: boolean; lastSyncedAt?: string }`. Si
  `isRevalidating` est vrai, afficher un indicateur "Mise à jour…" (réutiliser le motif
  `loading-spinner` déjà utilisé dans `ItemResults.tsx` pour `results-meta-pending`) — cette
  branche est prioritaire sur `offline` (FR-012). Sinon, si `offline` est vrai, afficher "Données
  hors ligne" suivi, si `lastSyncedAt` est fourni, de la date relative via
  `formatRelativeTime` (`src/domain/time.ts`, déjà existant) (FR-008). Sinon, ne rien rendre
  visuellement, mais si `lastSyncedAt` est fourni, l'exposer via l'attribut `title` d'un élément
  minimal pour rester consultable sans ajouter de bruit visuel (FR-013, cohérent avec l'exigence
  de discrétion de spec.md).
- [X] T006 [P] Créer `tests/unit/sync-status-indicator.test.tsx` : ne rend aucun texte visible
  quand `isRevalidating`/`offline` sont faux (mais `title` présent si `lastSyncedAt` fourni) ;
  affiche "Mise à jour…" quand `isRevalidating` est vrai, y compris si `offline` est aussi vrai ;
  affiche un message "hors ligne" avec l'heure relative quand `offline` est vrai et
  `isRevalidating` faux.

**Checkpoint** : le hook générique, sa persistance et l'indicateur partagé sont disponibles et
testés — les user stories peuvent commencer.

---

## Phase 3: User Story 1 - Retrouver instantanément sa recherche au rechargement (Priority: P1) 🎯 MVP

**Goal**: Au rechargement de la page Recherche, afficher immédiatement les objets/recette/prix déjà
connus localement (catalogue DofusDB + prix perso + prix communautaire), pendant qu'un
rafraîchissement réseau se fait en arrière-plan, sans perdre la recherche/les filtres/le scroll/la
sélection.

**Independent Test**: quickstart.md, scénarios 2, 3 et 6 — visiter une recherche/un objet, la
recharger, vérifier l'affichage immédiat sans skeleton ni écran vide, dans les deux modes de prix.

### Implementation for User Story 1

- [X] T007 [US1] Réécrire `src/features/catalogue/useCatalogue.ts` pour utiliser
  `useStaleWhileRevalidate` (T003) trois fois, chacune branchée sur `catalogueCache` (T001) pour
  `loadCached`/`saveCache` : (1) catégories — clé `'categories'`, `fetchRemote: () =>
  getCategories()` ; (2) résultats de recherche — clé dérivée de `` `search:${query}:${categoryId}:${levelFilter}:${resultLimit}` ``,
  `fetchRemote` appelant `searchItems(query, categoryId, 0, resultLimit, undefined, levelFilter)`
  après le même debounce de 250 ms qu'aujourd'hui ; (3) détail d'objet — clé
  `selectedId ? `detail:${selectedId}` : undefined`, `fetchRemote: () => getItemDetail(selectedId)`.
  Conserver inchangé le comportement `catalogueWarm`/`whenCatalogueReady()` (rafraîchissement
  silencieux une fois le catalogue complet chargé en arrière-plan) en le gardant comme dépendance
  du calcul de la clé de recherche. Le hook continue d'exposer `items, total, loading, error,
  detail, detailLoading, detailError, categories, catalogueWarm`, et expose en plus
  `isRevalidating` (vrai si l'une des trois revalidations est en cours), `offline` (vrai si l'une
  des trois a échoué en réseau) et `lastSyncedAt` (celui des résultats de recherche, ce qui est
  affiché dans `ItemResults`).
- [X] T008 [US1] Modifier `src/features/catalogue/ItemResults.tsx` : remplacer
  `if (loading) return <SkeletonCard ... />` (ligne 24) par une condition qui ne montre le
  skeleton que lorsqu'il n'y a **encore aucune donnée à afficher** (`loading && !items.length`),
  pour qu'une liste déjà affichée ne soit jamais remplacée par le skeleton pendant une
  revalidation en arrière-plan (FR-005). Ne rien changer au comportement de `totalPending`.
- [X] T009 [US1] Modifier `src/features/comparison/useResourcePrices.ts` : ne plus réinitialiser
  `data` à `{}` de façon synchrone à chaque changement de `serverId`/`ids`/`repository` ; suivre la
  requête en cours avec un compteur de génération (par combinaison `serverId` + `ids.join(',')` +
  `repository`), et n'appliquer le résultat de `repository.getMany(...)` via `setData` que s'il
  correspond toujours à la génération courante (garde anti-race, research.md §3, cohérent avec
  FR-009/FR-010 appliqué à une source purement locale). Ne rendre atteignable aucun état "vide"
  visible lors du passage entre deux jeux d'identifiants déjà chargés auparavant dans la même
  session.
- [X] T010 [US1] Modifier `src/features/comparison/useCommunityPrice.ts` : remplacer
  `window.sessionStorage` par `window.localStorage` dans `readCache`/`writeCache` (research.md §2).
  Dans l'effet de montage/changement de `resourceId`/`serverId`, lire le cache **immédiatement et
  de façon synchrone** avant d'attendre `fetchState()` : si une valeur existe, poser
  `{ kind: 'found', price: cached, stale: true }` tout de suite au lieu de `{ kind: 'loading' }`,
  puis laisser l'appel réseau existant dans `fetchState()` la remplacer par `stale: false` en cas
  de succès. Étendre le drapeau `cancelled` déjà présent pour protéger aussi cette application
  immédiate du cache contre un changement de `resourceId`/`serverId` survenant avant que l'effet
  n'ait fini de s'appliquer.
- [X] T011 [US1] Créer `tests/integration/recherche-instant-cache.test.tsx` (suivre le pattern de
  mock de `tests/integration/community-price-offline.test.tsx` : mock de
  `src/data/catalogue-repository`, `src/services/community-price-api`, `src/data/servers-repository`,
  rendu de `App`) : pré-remplir `dofus-craft-catalogue-cache` (via `catalogueCache.set`, T001) et
  les stores de prix IndexedDB existants avec un objet, sa recette et un prix de ressource déjà
  connus, puis monter l'app sur la page Recherche et vérifier que la liste d'objets, la recette et
  le prix de la ressource sont présents dans le tout premier rendu (aucun `SkeletonCard`, aucun
  texte "Chargement…"). Faire ensuite résoudre les mocks réseau avec un contenu différent et
  vérifier que l'affichage se met à jour sans que le champ de recherche perde sa valeur ni que
  l'objet sélectionné change (spec.md US1, scénarios 1, 2 et 4). Répéter la vérification
  d'affichage immédiat en Mode communautaire (scénario 3).
- [X] T012 [P] [US1] Créer `tests/unit/use-resource-prices.test.tsx` : monter `useResourcePrices`
  (via `renderHook` de Testing Library) avec un `repository` factice dont `getMany` peut être
  contrôlé manuellement ; vérifier qu'un appel lancé pour un ancien `ids`/`serverId` qui résout
  après un appel plus récent pour un nouveau `ids`/`serverId` n'écrase pas le résultat déjà affiché
  du second appel (garde anti-race dédiée à ce hook, puisqu'il n'utilise pas directement
  `useStaleWhileRevalidate` — voir T009).

**Checkpoint**: User Story 1 est fonctionnelle et testable indépendamment (MVP).

---

## Phase 4: User Story 2 - Continuer à travailler hors ligne ou en cas de panne réseau (Priority: P2)

**Goal**: Quand un appel réseau échoue alors que des données locales sont déjà affichées, les
conserver et afficher un indicateur discret plutôt qu'un message bloquant.

**Independent Test**: quickstart.md, scénario 4 — couper le réseau après un premier chargement
réussi, recharger, vérifier que rien ne disparaît et qu'un indicateur discret apparaît.

### Implementation for User Story 2

- [X] T013 [US2] Modifier `src/features/search/RecherchePage.tsx` : afficher
  `<SyncStatusIndicator>` (T005) dans le panneau de résultats, alimenté par `catalogue.isRevalidating`,
  `catalogue.offline` et `catalogue.lastSyncedAt` (nouveaux champs exposés par `useCatalogue`,
  T007).
- [X] T014 [US2] Dans `src/features/catalogue/useCatalogue.ts` (T007), vérifier/ajuster que les
  messages d'erreur actuels (`"Impossible de charger les objets."`, `"Impossible de charger la
  recette."`, exposés via `error`/`detailError`) ne sont renseignés par le hook que lorsqu'il n'y a
  réellement aucune donnée à afficher (premier chargement en échec) ; quand une donnée locale est
  déjà affichée et que la revalidation réseau échoue, seul `offline` doit passer à `true`, sans
  jamais renseigner `error`/`detailError` (FR-007 : pas de message bloquant une fois des données
  affichées).
- [X] T015 [US2] Créer `tests/integration/recherche-offline.test.tsx` (même pattern de mock que
  T011) : données déjà affichées depuis le cache local, mocks réseau (`searchItems`,
  `getItemDetail`, `getCommunityPrice`) rejetés/en échec, puis vérifier que (a) les données
  précédemment affichées restent inchangées à l'écran, (b) aucun texte `.warning` ni message
  bloquant n'apparaît, (c) `SyncStatusIndicator` reflète l'état hors ligne (spec.md US2, scénarios
  1 et 2).
- [X] T016 [P] [US2] Créer `tests/unit/use-community-price.test.tsx` (JSX — harnais de montage) couvrant, pour
  `useCommunityPrice` (T010) : une valeur déjà présente dans `localStorage` est appliquée à l'état
  dès le montage, avant toute résolution réseau (`stale: true`) ; un échec de `getCommunityPrice`
  laisse l'état à cette valeur en cache (`stale: true`), sans jamais retourner d'état qui masquerait
  la valeur déjà affichée.

**Checkpoint**: User Stories 1 ET 2 fonctionnent, y compris indépendamment l'une de l'autre.

---

## Phase 5: User Story 3 - Premier accès sans donnée locale (Priority: P2)

**Goal**: Garantir l'absence de régression : sans aucune donnée locale (première visite, nouveau
serveur), le comportement de chargement reste identique à aujourd'hui.

**Independent Test**: quickstart.md, scénario 1 — stockage local vidé, ouvrir la page Recherche,
vérifier l'état de chargement habituel avant l'affichage des résultats.

### Implementation for User Story 3

- [X] T017 [US3] Créer `tests/integration/recherche-first-visit-cache.test.tsx` (même pattern de
  mock que T011, mais base IndexedDB/`localStorage` vidée avant le test) : vérifier que (a) sans
  aucune entrée dans `dofus-craft-catalogue-cache` ni dans les stores de prix, la page affiche bien
  l'état de chargement (skeleton / "Chargement des détails…") jusqu'à la résolution des mocks
  réseau, identique au comportement actuel (FR-006, SC-004) ; (b) après un premier chargement
  réussi sur un serveur, la sélection d'un second serveur jamais utilisé déclenche à nouveau un
  état de chargement pour les prix de ce serveur plutôt que d'afficher les prix de l'ancien serveur
  (edge case de spec.md).

**Checkpoint**: Les trois user stories P1/P2 fonctionnent indépendamment, sans régression sur le
premier accès.

---

## Phase 6: User Story 4 - Voir que la page se resynchronise (Priority: P3, bonus)

**Goal**: Indicateur discret "mise à jour…" pendant la revalidation en arrière-plan, et date de
dernière synchronisation consultable.

**Independent Test**: quickstart.md — observer la page juste après un rechargement avec cache déjà
présent : l'indicateur "mise à jour…" doit apparaître puis disparaître, et la dernière synchro doit
être consultable.

### Implementation for User Story 4

- [X] T018 [US4] Dans `src/components/SyncStatusIndicator.tsx` (T005), vérifier/renforcer que la
  branche "Mise à jour…" (`isRevalidating`) reste prioritaire même quand `offline` est
  simultanément vrai (cas d'une tentative précédente échouée suivie d'une nouvelle revalidation en
  cours) — pas de nouvelle capacité, seulement la garantie explicite de cet ordre de priorité déjà
  posé par T005 (FR-012).
- [X] T019 [P] [US4] Étendre `tests/integration/recherche-instant-cache.test.tsx` (T011) ou
  `tests/unit/sync-status-indicator.test.tsx` (T006) : après l'affichage immédiat des données
  locales, pendant que les mocks réseau ne sont pas encore résolus, l'indicateur "Mise à jour…" est
  visible ; une fois les mocks résolus avec succès, l'indicateur disparaît et l'attribut `title`
  (ou équivalent) reflète l'heure de cette synchronisation réussie (spec.md US4, scénarios 1 et 2).

**Checkpoint**: Les quatre user stories sont fonctionnelles indépendamment.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T020 [P] Exécuter `npm run typecheck`, `npm test` et `npm run lint` sur l'ensemble des
  fichiers créés/modifiés (T001-T019) et corriger toute régression détectée.
- [X] T021 Dérouler manuellement les 6 scénarios de `specs/010-search-instant-cache/quickstart.md`
  contre `npm run dev` (premier chargement, reload avec cache perso, reload avec cache
  communautaire, reload hors ligne, changement de mode Perso ↔ Communautaire, préservation du
  contexte pendant une revalidation) et confirmer chaque résultat attendu.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Aucune tâche — peut être considérée terminée immédiatement.
- **Foundational (Phase 2)**: Bloque toutes les user stories (T001-T006).
- **User Story 1 (Phase 3)**: Dépend de la Phase 2. Aucune dépendance vers US2/US3/US4.
- **User Story 2 (Phase 4)**: Dépend de la Phase 2 ; T013/T014 dépendent aussi de T007 (US1) car ils
  modifient/consomment les champs `isRevalidating`/`offline`/`lastSyncedAt` que T007 ajoute à
  `useCatalogue`. Testable indépendamment une fois T007 posé.
- **User Story 3 (Phase 5)**: Dépend de la Phase 2 et de T007/T009/T010 (US1) pour exister (elle
  teste leur comportement par défaut sans cache) ; n'ajoute aucun nouveau code de production.
- **User Story 4 (Phase 6)**: Dépend de la Phase 2 (T005) et de T013 (US2) pour être observable
  dans l'app.
- **Polish (Phase 7)**: Dépend de toutes les user stories retenues pour le périmètre livré.

### Parallel Opportunities

- T001, T002, T003, T004, T005, T006 (Phase 2) : T001/T002 (store) et T003/T004 (hook générique) et
  T005/T006 (indicateur) touchent des fichiers disjoints et peuvent être menés en parallèle ; T003
  n'a pas de dépendance dure sur T001 pour être écrit (son contrat `loadCached`/`saveCache` est
  injecté par l'appelant), mais T007 (US1) a besoin des deux pour être branché.
- T009 et T010 (US1) : fichiers disjoints, parallélisables entre eux et avec T008.
- T012 (US1, test) : fichier disjoint de T007-T011, parallélisable.
- T016 (US2, test) : fichier disjoint de T013-T015, parallélisable.
- T019 (US4, test) : parallélisable avec T018 selon la répartition retenue (fichiers différents si
  T019 cible `sync-status-indicator.test.tsx` plutôt que le fichier modifié par T018).

---

## Parallel Example: Phase 2 (Foundational)

```bash
# Lancer ensemble les trois paires implémentation/test qui ne se recouvrent pas :
Task: "Créer src/persistence/indexeddb-catalogue-cache-store.ts (T001)"
Task: "Créer tests/unit/catalogue-cache-store.test.ts (T002)"
Task: "Créer src/components/SyncStatusIndicator.tsx (T005)"
Task: "Créer tests/unit/sync-status-indicator.test.tsx (T006)"
```

---

## Implementation Strategy

### MVP First (User Story 1 seule)

1. Compléter la Phase 1 (rien à faire) et la Phase 2 (Foundational — bloquant).
2. Compléter la Phase 3 (User Story 1).
3. **S'ARRÊTER et VALIDER** : dérouler les scénarios 2, 3 et 6 de quickstart.md indépendamment.
4. C'est déjà la valeur centrale de la demande initiale (affichage instantané du cache local).

### Incremental Delivery

1. Setup + Foundational → fondation prête.
2. User Story 1 → validation indépendante → MVP livrable (répond à la demande principale).
3. User Story 2 → validation indépendante → résilience hors ligne ajoutée sans rien casser de US1.
4. User Story 3 → tests de non-régression du premier accès (aucun nouveau code de production
   attendu si US1 a été implémentée correctement).
5. User Story 4 → indicateurs bonus, explicitement facultatifs dans la demande initiale.
6. Polish → vérifications globales + passage manuel de quickstart.md.

---

## Notes

- [P] = fichiers différents, pas de dépendance bloquante entre les tâches concernées.
- Le libellé [Story] relie chaque tâche à sa user story pour la traçabilité avec spec.md.
- Committer après chaque tâche ou groupe logique de tâches.
- S'arrêter à chaque checkpoint pour valider une user story indépendamment avant de passer à la
  suivante.
- Éviter : tâches vagues, conflits sur un même fichier entre tâches marquées [P], dépendances
  croisées entre user stories qui casseraient leur indépendance.
