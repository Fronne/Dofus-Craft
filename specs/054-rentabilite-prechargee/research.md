# Research: Page Rentabilité déjà prête à l'arrivée

## §1 Où garder la liste

- **Decision**: `localStorage`, une clé par couple serveur + mode :
  `craftcheck-craft-profits:<serverId>:<mode>`.
- **Rationale**: lecture **synchrone** → la liste gardée est l'état initial du hook
  `useCraftProfits` dès le premier rendu, sans passage par « Calcul en cours » ni clignotement
  (SC-001). Le volume est faible (quelques centaines de lignes × ~200 octets, bien sous les ~5 Mo). Le
  projet utilise déjà ce modèle (`site-settings-cache.ts`, `player-counters-cache.ts`).
- **Alternatives considered**: IndexedDB (`catalogueCache`) — asynchrone, il faudrait un état
  intermédiaire avant l'affichage et il mélangerait des données dérivées des prix du joueur avec le
  catalogue public ; Cache Storage — même défaut asynchrone, pensé pour des réponses HTTP.

## §2 Validité d'une liste gardée

- **Decision**: entrée `{ formatVersion: 1, computedAt, rows }` ; rejetée si format différent, date
  invalide ou de plus de 7 jours, ou lignes mal formées (contrôle léger des champs utilisés par la
  page). Toute erreur de lecture ou d'écriture (stockage plein, refusé) est ignorée.
- **Rationale**: FR-006, FR-007 ; même principe que `CATALOGUE_FORMAT_VERSION` (spec 021 FR-004).

## §3 Ce qui est gardé, et quand

- **Decision**: seulement au `publish` d'un état `ready` (liste complète), y compris une liste vide ;
  jamais un état `loading` ni `unavailable`.
- **Rationale**: spec, cas limites « rien de partiel » et « plus aucun objet calculable ».

## §4 Affichage de la liste gardée dans le hook

- **Decision**: `CraftProfitsState` gagne deux champs optionnels : `keptAt` (date de calcul d'une liste
  d'une visite précédente actuellement affichée) et `refreshFailed` (la mise à jour a échoué). Ordre
  de priorité à l'initialisation : liste de la visite (mémoire) › liste gardée (`status: 'ready'`,
  `keptAt`) › calcul en cours › état initial. La liste gardée est traitée comme la liste de la visite
  aujourd'hui : les états `loading` intermédiaires ne la remplacent pas, seul l'état `ready` final la
  remplace (et efface `keptAt`) ; un `unavailable` la garde et pose `refreshFailed`.
- **Rationale**: réutilise le mécanisme « garder la liste pendant le rafraîchissement » de la spec 019
  (commit 6e16f76) ; tris, filtres et défilement vivent dans `PricesPage` et ne sont pas réinitialisés
  par un changement de lignes (FR-005).

## §5 Départ plus tôt (A)

- **Decision**: `preloadCraftProfits` lance le calcul dès que `whenCatalogueReady()` est résolu, sans
  `requestIdleCallback` ni `setTimeout` de 2 s. Le calcul démarre aussi quand une liste gardée existe
  (seule la liste de la **visite** empêche un nouveau départ, comme aujourd'hui).
- **Rationale**: FR-008 ; l'attente d'inactivité pouvait coûter jusqu'à 5 s.

## §6 Plus vite sans gêner le joueur (A)

- **Decision**: `BACKGROUND_CONCURRENCY` passe de 2 à 4 ; en fond (aucune page abonnée), chaque
  chargement d'objet commence par céder la main au navigateur (`requestIdleCallback` avec
  `timeout: 200`, repli `setTimeout(0)`). Sur la page, pleine vitesse (6) sans attente, comme
  aujourd'hui.
- **Rationale**: FR-009 / SC-003 : les actions du joueur (frappe, rendu) passent entre deux
  chargements ; le délai maximal de 200 ms par lot reste négligeable devant le temps réseau.
- **Alternatives considered**: une file de priorité partagée avec les demandes de la Recherche —
  plus complexe, non justifiée pour le volume actuel (principe IV).

## §7 Révision des specs existantes

- **Decision**: ajouter une section « Révision (2026-10-14) » à la spec 021 pointant vers la spec 054
  (liste gardée d'une visite à l'autre, départ sans attente d'inactivité, 4 simultanés).
