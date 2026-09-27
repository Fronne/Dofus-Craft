# Research: Chargement des données en fond et cache persistant

## §1 — Où persister le catalogue

- **Decision**: rendre `cached()` ([src/data/catalogue-cache.ts](../../src/data/catalogue-cache.ts)) à deux niveaux :
  mémoire, puis la base IndexedDB déjà existante `dofus-craft-catalogue-cache`
  ([indexeddb-catalogue-cache-store.ts](../../src/persistence/indexeddb-catalogue-cache-store.ts)).
  Toutes les clés existantes (`catalogue-item-index`, `item-set-index`, `item:<id>`, `recipes:<id>`,
  `item-set:<id>`, types, effets…) passent ainsi par le stockage persistant sans toucher aux appelants.
- **Rationale**: un seul point de passage, aucun changement dans `catalogue-repository.ts` ni dans les
  pages ; la base dédiée au catalogue existe déjà (spec 010) et est séparée des prix.
- **Alternatives considered**: persister clé par clé dans `catalogue-repository.ts` (plus de code,
  oublis possibles) ; fichier JSON statique pré-construit (écarté par le porteur du projet).

## §2 — Fraîcheur et revalidation

- **Decision**: chaque entrée gardée porte `savedAt` et `formatVersion`. Lecture : mémoire → IndexedDB
  → réseau. Entrée IndexedDB de moins de 24 h : utilisée telle quelle. Plus vieille : renvoyée tout de
  suite, et un rechargement réseau est lancé en fond qui met à jour mémoire + IndexedDB (le nouvel
  affichage arrive à la navigation suivante ou via le `revalidateToken` existant de la recherche).
  `formatVersion` différent de la constante courante → entrée ignorée.
- **Rationale**: FR-002/FR-003/FR-004 ; le catalogue change environ toutes les deux semaines.
- **Alternatives considered**: comparer un numéro de version DofusDB (pas d'endpoint fiable et léger) ;
  TTL d'une semaine (moins réactif après une mise à jour du jeu sans gain notable).

## §3 — Stockage indisponible

- **Decision**: toute erreur IndexedDB (ouverture, lecture, écriture) est avalée ; `cached()` retombe
  sur le chemin actuel (mémoire + réseau). Les écritures IndexedDB ne sont jamais attendues par
  l'appelant.
- **Rationale**: FR-005, navigation privée et quotas.

## §4 — Préparation de la page Prix en fond

- **Decision**: extraire le calcul de `useCraftProfits` dans une fonction de module
  `computeCraftProfits(serverId, mode)` qui partage un calcul en cours par clé `serverId:mode`
  (promesse + abonnés à la progression) et le résultat terminé dans le `cache` existant.
  `useCraftProfits` s'abonne à ce calcul. Un nouveau `preloadCraftProfits(serverId, mode)` est appelé
  depuis l'`AppShell` après `whenCatalogueReady()` puis `requestIdleCallback` (repli `setTimeout`
  2 s), et relancé quand le serveur ou le mode change. Concurrence réduite (2 au lieu de 6) tant
  qu'aucune page Prix n'est abonnée, pour ne pas concurrencer les chargements du joueur.
- **Rationale**: FR-006 à FR-009 ; une seule implémentation du calcul garantit un résultat identique
  (FR-008, principe II).
- **Alternatives considered**: Web Worker (le calcul est limité par le réseau, pas par le CPU) ;
  persister la liste (refusé par la spec 019).

## §5 — Lecture groupée des prix communautaires

- **Decision**: nouvel endpoint `GET /community-prices?serverId=…&resourceIds=a,b,c` (100 ids max) :
  une requête D1 avec `resource_id IN (…)`, regroupement par ressource côté worker, puis
  `summarizeContributions` identique à `fetchCurrentMedian`. Côté client,
  `getCommunityPrices(resourceIds, serverId)` découpe en lots de 98 ; `fillCommunityGaps` et le
  préremplissage de la recette (RecherchePage) l'utilisent via une fonction de lot
  `lookupCommunityMedians`, qui alimente aussi le cache localStorage de `useCommunityPrice`. Ainsi
  chaque `useCommunityPrice` monté trouve déjà sa valeur. L'endpoint unitaire est conservé.
- **Rationale**: FR-010/FR-011 ; même fonction de médiane → mêmes valeurs (SC-005).

## §6 — Cache court côté worker

- **Decision**: le worker est servi sur `*.workers.dev`, où l'API Cache de Cloudflare
  (`caches.default`) n'a aucun effet. On utilise donc (a) un cache mémoire par isolat, 60 s, pour
  les GET `/community-price`, `/community-prices`, `/item-prices`, `/latest-price`, `/price-history` ;
  (b) l'en-tête `Cache-Control: public, max-age=60` pour le cache HTTP du navigateur. Un POST de
  contribution vide le cache mémoire de l'isolat. Pour FR-013, les lectures faites juste après
  l'envoi d'une contribution ajoutent `fresh=1`, que le worker sert sans cache et renvoie avec
  `Cache-Control: no-store`.
- **Rationale**: réduit les lectures D1 sans domaine personnalisé ; au pire un autre joueur voit
  une contribution avec 60 s de retard (hypothèse de la spec).
- **Alternatives considered**: KV (écritures limitées, cohérence à terme plus lente) ; route sur
  domaine personnalisé pour activer `caches.default` (pas de domaine configuré).
