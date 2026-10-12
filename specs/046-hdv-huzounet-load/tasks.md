# Tasks: Charger les prix d'un onglet HDV depuis Huzounet

**Input**: Design documents from `/specs/046-hdv-huzounet-load/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/external-prices-refresh.md,
contracts/hdv-huzounet-ui.md, quickstart.md

**Tests**: demandés (constitution, principe II : les règles de découpage, de cadence et de choix du prix
ont des tests automatiques).

**Rappels** : Node 22 (`export PATH="/c/Users/Cyril/AppData/Roaming/nvm/v22.23.3:$PATH"`) ; le Worker
(`worker/`) n'est pas modifié ; aucun déploiement.

## Format: `[ID] [P?] [Story] Description`

- **[P]** : peut se faire en parallèle (fichiers différents, sans dépendance)
- **[Story]** : récit utilisateur concerné (US1 à US4)

---

## Phase 1: Setup

- [x] T001 Lancer `npx vitest run` et `npx tsc -b --noEmit` sur la branche avant toute modification et noter le nombre de tests dans specs/046-hdv-huzounet-load/quickstart.md (section « Résultats », à créer).

---

## Phase 2: Foundational (lecture des prix externes et règles pures)

**Purpose** : ce dont tous les récits dépendent — le client de l'API sait lire un prix Huzounet et
demander une relecture ; les règles du chargement existent et sont testées.

- [x] T002 [P] Dans src/domain/forgemagie.ts, ajouter `'external'` à `PriceOrigin`, le libellé `external: 'Huzounet'` à `PRICE_ORIGIN_LABELS`, et l'accepter dans `isPriceOrigin` ; dans src/domain/types.ts, typer `CommunityPrice.latestOrigin` avec `PriceOrigin` et ajouter `latestFragile?: 'stale' | 'provisional'`. Vérifier par `npx tsc -b --noEmit` qu'aucun `Record<PriceOrigin, …>` existant ne reste incomplet.
- [x] T003 [P] Créer src/domain/huzounet-load.ts (règles pures, sans React ni réseau) : constantes `HUZOUNET_SERVERS = ['mikhal']` (commentaire renvoyant à `READ_SERVERS` de worker/src/huzounet.ts), `SLICE_SIZE = 90`, `SLICE_SPACING_MS = 5500`, `TOO_SOON_RETRIES = 3` ; types `LoadAvailability`, `RefreshOutcome`, `LoadFailure`, `LoadState` de data-model.md ; fonctions `loadAvailability(priceMode, serverId)`, `sliceIds(ids)` (dédoublonne, écarte tout identifiant qui ne vérifie pas `^\d{1,9}$`, tranches de 90), `estimatedSeconds(count)` (`0` pour une tranche, sinon `(tranches − 1) × 5,5 + 3`), `durationLabel(seconds)` (« environ D s » arrondi à 5 s sous 60 s, sinon « environ D min » arrondi à la minute supérieure), `loadMessage(state)` (textes exacts de contracts/hdv-huzounet-ui.md, singulier/pluriel compris), `fragileLabel` (`provisional: 'peu de relevés'`, `stale: 'relevé ancien'`) et `shownOrigin(carnetEntry, latest)` (la mention seulement si `carnetEntry.updatedAt === latest.contributedAt`).
- [x] T004 [P] Écrire tests/unit/huzounet-load.test.ts : `sliceIds` pour 0, 1, 90, 91, 128 et 2 537 identifiants (0, 1, 1, 2, 2, 29 tranches), doublons et identifiant non numérique écartés ; `loadAvailability` (personnel, serveur non relu, prêt, serveur absent) ; `estimatedSeconds` et `durationLabel` (35 → pas de durée, 128 → « environ 10 s », 2 537 → « environ 3 min ») ; `loadMessage` pour chaque état et chacune des cinq causes, avec 0, 1 et plusieurs prix ; `shownOrigin` (dates égales, carnet plus récent, pas de carnet, fragile).
- [x] T005 Dans src/services/community-price-api.ts : remplacer `withKnownOrigin` pour garder `latestOrigin: 'external'` et ne garder `latestFragile` que s'il vaut `'stale'` ou `'provisional'` et que l'origine est `'external'` ; ajouter `refreshExternalPrices(serverId, ids): Promise<RefreshOutcome>` selon contracts/external-prices-refresh.md (POST JSON `{ serverId, ids }`, sans `itemId` ; ne lève jamais ; 200 → `ok` et, si `refreshed > 0`, arme `freshReadsUntil` comme après un partage ; 429 → `too-soon` ; 404 → `unknown-server` ; 503 → `disabled` ; `fetch` rejeté → `unreachable` ; tout le reste → `unavailable`). Dépend de T002 et T003.
- [x] T006 Compléter tests/unit/community-price-api.test.ts : `getCommunityPrices` garde `latestOrigin: 'external'` et `latestFragile`, retire un `latestFragile` inconnu ou porté par une autre origine, accepte `medianAmountKamas: 0` / `sampleSize: 0` ; `refreshExternalPrices` : corps et en-têtes envoyés, une ligne par cas du tableau du contrat (200, 429, 404, 503, 502, 400, corps illisible, `refreshed` absent, rejet réseau), et lecture suivante en `fresh=1` après un `refreshed > 0`.

**Checkpoint** : `npx vitest run tests/unit/huzounet-load.test.ts tests/unit/community-price-api.test.ts` passe.

---

## Phase 3: User Story 1 - Charger les prix de l'onglet affiché (Priority: P1) 🎯 MVP

**Goal** : un clic charge tout l'onglet par tranches, montre la progression et fait apparaître les prix.

**Independent Test** : onglet Consommables, API simulée : 2 demandes (90 + 38), l'une après l'autre,
progression puis prix visibles et compteur à jour.

- [x] T007 [US1] Ajouter `reload()` à src/features/comparison/useResourcePrices.ts : un compteur de version dans les dépendances de l'effet de lecture, qui relit le carnet sans vider `data` ; le renvoyer avec `data, save, remove, error, loaded`. Les appelants existants ne changent pas.
- [x] T008 [US1] Créer src/features/hdv/useHuzounetLoad.ts : `useHuzounetLoad({ serverId, priceMode, tab, ids, onSliceLoaded, wait? })` → `{ state: LoadState, start(), stop() }`. `start()` fige `sliceIds(ids)` et refuse de démarrer si un chargement tourne (FR-010) ou si `loadAvailability` n'est pas `ready` ; pour chaque tranche : attendre que `SLICE_SPACING_MS` soient écoulées depuis le départ de la demande précédente, appeler `refreshExternalPrices`, sur `too-soon` attendre `SLICE_SPACING_MS` et redemander la même tranche (`TOO_SOON_RETRIES` fois au plus), sur un autre échec passer à `failed` avec sa cause ; sur `ok` relire `getCommunityPrices(tranche, serverId)`, écrire dans `resourcePricesFor('community')` chaque prix dont `pickCommunityPrice(carnet[id], …).replacesCarnet` est vrai (daté de `latestContributionAt`, erreurs d'écriture ignorées comme dans usePetFoodPrices), avancer `done` et `loaded`, puis appeler `onSliceLoaded()` ; une relecture `unavailable` → `failed` cause `unreachable`. `wait` est injectable (défaut : `setTimeout`).
- [x] T009 [US1] Créer src/features/hdv/HuzounetLoadButton.tsx : rend, selon `availability`, `count` et `state`, le bouton « Charger depuis Huzounet (N objets) » avec la durée annoncée au-delà d'une tranche, ou pendant un chargement « Arrêter » + `role="status"` « Chargement : X sur N objets » + `<progress>`, et le message de fin (`loadMessage`). Libellés exacts de contracts/hdv-huzounet-ui.md. Styles dans src/styles/global.css (classes `hdv-huzounet…`, à côté de `.results-meta`).
- [x] T010 [US1] Dans src/features/hdv/HdvPage.tsx : brancher `useHuzounetLoad` avec les identifiants de `tabLines` (tout l'onglet, jamais `filtered`) et rendre `HuzounetLoadButton` dans `results-meta` ; `onSliceLoaded` appelle `summary.refresh()`, le `reload()` du carnet des lignes affichées et incrémente `originsVersion`. Le bouton n'est rendu que dans la branche où la liste de l'onglet est disponible.
- [x] T011 [US1] Écrire tests/integration/hdv-huzounet-load.test.tsx (même montage que tests/integration/hdv-page.test.tsx, `refreshExternalPrices` ajouté au module simulé, minuteurs simulés pour l'attente) — récit 1 : Consommables → 2 appels (90 puis 38 identifiants), le second seulement après la réponse du premier et 5,5 s ; « Chargement : 90 sur 128 objets » entre les deux ; après la 1re tranche un prix renvoyé par `getCommunityPrices` est visible dans sa ligne et le compteur augmente ; fin « N prix chargés depuis Huzounet. » ; `refreshed: 0` partout → « Les prix sont déjà à jour. » ; avec une recherche active les mêmes 128 identifiants sont demandés ; Créatures → 1 seul appel de 35 identifiants ; Runes → identifiants des runes.

**Checkpoint** : le récit 1 passe seul.

---

## Phase 4: User Story 2 - Savoir d'où vient un prix (Priority: P1)

**Goal** : une ligne dont le prix affiché vient de Huzounet le dit.

**Independent Test** : trois objets (Huzounet seul, Huzounet plus récent, partagé plus récent) : montant
et mention de chaque ligne.

- [x] T012 [US2] Réécrire src/features/hdv/useLatestOrigins.ts pour renvoyer `Record<string, LatestMention>` (`{ origin, fragile?, contributedAt }`) : ne demander à `getCommunityPrices` que les identifiants pas encore connus pour le serveur courant, tout redemander quand `version` change, tout vider au changement de serveur ou de mode ; rien en Mode personnel.
- [x] T013 [US2] Dans src/features/hdv/HdvPage.tsx : appeler `useLatestOrigins` avec les identifiants des lignes **affichées** (`visible`) pour tous les onglets ; calculer la mention de chaque ligne avec `shownOrigin(carnet[id], mention)` et seulement si `inputs[id] === undefined` ; l'afficher dans `span.fm-origin` — onglet Runes : libellé d'origine existant, avec « Huzounet · peu de relevés » / « Huzounet · relevé ancien » pour un prix fragile ; autres onglets : seulement pour l'origine `external`, à la suite du type.
- [x] T014 [US2] Dans src/features/comparison/CommunityResourcePriceRow.tsx : ne demander la confirmation d'écart que si `communityState.price.sampleSize > 0` (un prix que seul Huzounet connaît n'a pas de médiane : `medianAmountKamas` vaut 0).
- [x] T015 [US2] Ajouter à tests/integration/hdv-huzounet-load.test.tsx le récit 2 : prix `external` seul (médiane 0, échantillon 0) → montant dans le champ, mention « Huzounet », objet compté ; `latestFragile: 'provisional'` → « peu de relevés » ; `'stale'` → « relevé ancien » ; origine `manual` plus récente → pas de mention « Huzounet » ; carnet plus récent que le prix Huzounet → pas de mention ; saisie d'un prix sur une ligne Huzounet seule → `submitCommunityPrice` appelé, aucune boîte de confirmation. Vérifier que les tests Runes existants de tests/integration/hdv-page.test.tsx passent toujours.

**Checkpoint** : récits 1 et 2 passent.

---

## Phase 5: User Story 3 - Arrêter, et comprendre un chargement qui n'aboutit pas (Priority: P2)

**Goal** : arrêt immédiat, reprise automatique sur refus « trop récent », un message par cause.

**Independent Test** : arrêt après la 1re tranche → la 2e n'est jamais demandée ; chaque réponse d'échec
donne son message.

- [x] T016 [US3] Dans src/features/hdv/useHuzounetLoad.ts : jeton d'arrêt par chargement, vérifié avant chaque demande, après chaque attente et après chaque réponse ; `stop()` l'active et passe à `stopped` ; l'effet de nettoyage (dépendances : `tab`, `serverId`, `priceMode`, et démontage) l'active et ramène l'état à `idle` ; aucune mise à jour d'état après un arrêt ou un démontage.
- [x] T017 [US3] Ajouter à tests/integration/hdv-huzounet-load.test.tsx le récit 3 : « Arrêter » après la 1re tranche → un seul appel même après 30 s simulées, prix de la 1re tranche toujours affichés, « Chargement arrêté : P prix chargés. » ; changement d'onglet en cours → plus d'appel, pas de message dans le nouvel onglet ; 429 puis 200 → même tranche redemandée après 5,5 s et chargement mené au bout ; quatre 429 de suite → 4 appels pour la tranche puis « Réessaie dans quelques secondes. » ; 502 → « Huzounet ne répond pas pour le moment. » avec le nombre déjà chargé ; 503 → « Le chargement depuis Huzounet est indisponible. » ; rejet réseau → « Chargement impossible : l'API ne répond pas. » ; nouveau clic après un échec → un nouveau chargement repart de la 1re tranche ; pendant un chargement une valeur tapée et non enregistrée dans une ligne est toujours là après l'arrivée d'une tranche.

**Checkpoint** : récits 1 à 3 passent.

---

## Phase 6: User Story 4 - Ne proposer le bouton que là où il sert (Priority: P2)

**Goal** : bouton inactif et expliqué en Mode personnel et sur un serveur non relu.

**Independent Test** : Mode personnel, puis autre serveur : bouton désactivé, explication, aucun appel.

- [x] T018 [US4] Dans src/features/hdv/HuzounetLoadButton.tsx et src/features/hdv/HdvPage.tsx : passer `loadAvailability(priceMode, serverId)` au bouton ; états désactivés et textes « Les prix Huzounet se chargent en Mode communautaire. » / « Les prix de ce serveur ne sont pas relus. » ; vérifier que `useLatestOrigins` et `useHuzounetLoad` ne font aucun appel hors Mode communautaire.
- [x] T019 [US4] Ajouter à tests/integration/hdv-huzounet-load.test.tsx le récit 4 : Mode personnel → bouton désactivé, explication visible, `refreshExternalPrices` et `getCommunityPrices` jamais appelés, carnet personnel inchangé ; serveur simulé autre que Mikhal en Mode communautaire → bouton désactivé et explication ; 404 de l'API sur Mikhal → « Les prix de ce serveur ne sont pas relus. » après un seul appel ; filtre ne retenant aucun objet → bouton toujours actif avec le nombre d'objets de l'onglet.

**Checkpoint** : les quatre récits passent.

---

## Phase 7: Polish & Cross-Cutting

- [x] T020 [P] Ajouter l'en-tête de commentaire `specs/046-hdv-huzounet-load` aux fichiers nouveaux et aux endroits retouchés (convention du dépôt), et une ligne sur le bouton dans la description de la page HDV de README.md si elle y est décrite.
- [x] T021 Lancer `npx tsc -b --noEmit`, `npx eslint src tests` et `npx vitest run` ; corriger ; reporter les résultats (nombre de tests avant/après) dans specs/046-hdv-huzounet-load/quickstart.md, section « Résultats ».
- [x] T022 Démarrer le site local, ouvrir la page HDV et vérifier à l'écran, sans cliquer sur le bouton en Mode communautaire (un clic lirait vraiment Huzounet) : présence et libellé du bouton dans les quatre onglets, état désactivé et explication en Mode personnel, mise en page en largeur étroite et en thème sombre.

---

## Dependencies & Execution Order

- Phase 2 bloque tout : T002 et T003 d'abord (en parallèle, avec T004), puis T005, puis T006.
- US1 (T007 → T008 → T009 → T010 → T011) est le MVP.
- US2 (T012 → T013, T014 en parallèle, puis T015) dépend de T002/T005 et de la page telle que T010 la laisse.
- US3 (T016, T017) et US4 (T018, T019) complètent `useHuzounetLoad` et le bouton créés en US1.
- T010, T013 et T018 touchent tous src/features/hdv/HdvPage.tsx : jamais en parallèle.
- Tous les récits écrivent dans tests/integration/hdv-huzounet-load.test.tsx : jamais en parallèle.

## Parallel Example

```text
T002 (types et origines)  |  T003 (règles pures)  |  T004 (tests des règles)
```

## Implementation Strategy

MVP = phases 1 à 3 (le bouton charge un onglet). US2 rend les prix chargés explicables et doit suivre
avant toute mise en ligne (principe III). US3 et US4 rendent le bouton sûr à laisser aux joueurs.
