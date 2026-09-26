# Data Model: Chargement des données en fond et cache persistant

## Entrée de catalogue gardée (IndexedDB `dofus-craft-catalogue-cache`, store `entries`)

| Champ | Type | Règle |
|---|---|---|
| `key` | string | Clé de `cached()` (ex. `catalogue-item-index`, `item:123`, `recipes:123`) |
| `value` | unknown | Réponse DofusDB déjà mappée, telle que renvoyée par le chargeur |
| `savedAt` | ISO string | Date d'obtention depuis le réseau |
| `formatVersion` | number | Doit égaler `CATALOGUE_FORMAT_VERSION`, sinon ignorée (FR-004) |

États : absente → réseau ; fraîche (< 24 h) → utilisée ; périmée (≥ 24 h) → utilisée + rechargement
en fond ; version incompatible → traitée comme absente. Les entrées existantes de la spec 010
(sans `formatVersion`) sont ignorées si elles sont lues par le nouveau chemin et restent lisibles par
`useCatalogue`.

## Calcul Prix partagé (mémoire, par visite)

Clé `serverId:mode`. États : `idle` → `running` (progression `done/total`, lignes partielles) →
`ready` (liste stockée dans le cache existant de `useCraftProfits`). Un changement de serveur/mode
crée une nouvelle clé ; l'ancien calcul continue seulement s'il a des abonnés, sinon il est annulé.

## Lot de prix communautaires (réponse `/community-prices`)

`{ serverId, prices: CommunityPrice[] }` où chaque `CommunityPrice` =
`{ resourceId, medianAmountKamas, sampleSize, lastContributionAt }`. Une ressource sans médiane est
absente de `prices` (équivalent du 404 unitaire).

## Cache mémoire du worker

Map `url normalisée → { body, status, expiresAt }`, TTL 60 s, vidée à chaque contribution acceptée,
taille bornée (500 entrées, les plus anciennes supprimées).
