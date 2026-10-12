# Data Model: Charger les prix d'un onglet HDV depuis Huzounet

Aucune donnée nouvelle n'est stockée. Le carnet du Mode communautaire (IndexedDB, `communityModePrices`)
garde son format : `{ resourceId, unitPriceKamas, updatedAt }`.

## Types modifiés

### `PriceOrigin` (`src/domain/forgemagie.ts`)

`'manual' | 'capture' | 'bot' | 'external'` — libellé de `'external'` : « Huzounet ».

### `CommunityPrice` (`src/domain/types.ts`)

| Champ | Type | Règle |
|-------|------|-------|
| `latestOrigin` | `PriceOrigin` optionnel | valeur inconnue → champ retiré (comportement actuel) |
| `latestFragile` | `'stale' \| 'provisional'` optionnel | gardé seulement si `latestOrigin === 'external'` et valeur connue |
| `medianAmountKamas`, `sampleSize` | nombres | valent `0` et `0` pour un prix que seul Huzounet connaît : aucune comparaison d'écart ne s'y appuie |

## Types nouveaux (`src/domain/huzounet-load.ts`)

### Constantes

| Nom | Valeur | Origine |
|-----|--------|---------|
| `HUZOUNET_SERVERS` | `['mikhal']` | `READ_SERVERS` du Worker |
| `SLICE_SIZE` | `90` | `REFRESH_MAX_IDS` du Worker |
| `SLICE_SPACING_MS` | `5500` | `REFRESH_MIN_INTERVAL_MS` (5000) + marge |
| `TOO_SOON_RETRIES` | `3` | FR-008 |

### `LoadAvailability`

Pourquoi le bouton est actif ou non, sans appel à l'API :

`'ready' | 'personal-mode' | 'server-not-read'`

- `personal-mode` : Mode personnel ;
- `server-not-read` : Mode communautaire, serveur hors `HUZOUNET_SERVERS` ;
- `ready` : sinon. Le bouton n'est pas rendu du tout quand la liste de l'onglet est vide ou indisponible.

### `RefreshOutcome` (renvoyé par le service)

`{ status: 'ok'; refreshed: number } | { status: 'too-soon' | 'unavailable' | 'disabled' | 'unknown-server' | 'unreachable' }`

### `LoadFailure`

`'too-soon' | 'unavailable' | 'disabled' | 'unknown-server' | 'unreachable'`

### `LoadState`

| État | Champs | Sens |
|------|--------|------|
| `idle` | — | rien n'a été lancé pour cet onglet |
| `running` | `done`, `total`, `loaded` | `done` objets traités sur `total` ; `loaded` prix lus chez Huzounet |
| `finished` | `total`, `loaded` | toutes les tranches ont réussi |
| `stopped` | `done`, `total`, `loaded` | arrêt demandé par le joueur |
| `failed` | `done`, `total`, `loaded`, `cause: LoadFailure` | arrêt sur échec |

Transitions : `idle → running → finished | stopped | failed`, et de `finished | stopped | failed` vers
`running` par un nouveau clic. Un changement d'onglet, de serveur ou de mode ramène à `idle`.

Invariants : `0 ≤ done ≤ total` ; `done` n'avance qu'à la fin d'une tranche réussie, de la taille de
cette tranche ; `loaded` est la somme des `refreshed` des tranches réussies ; `total` est figé au clic.

### Fonctions pures

| Fonction | Rôle |
|----------|------|
| `loadAvailability(priceMode, serverId)` | → `LoadAvailability` |
| `sliceIds(ids)` | dédoublonne, écarte les identifiants non numériques, découpe en tranches de 90 |
| `estimatedSeconds(count)` | durée annoncée : `(tranches − 1) × 5,5 + 3`, arrondie ; `0` pour une seule tranche |
| `loadMessage(state)` | la phrase montrée au joueur (voir contracts/hdv-huzounet-ui.md) |
| `shownOrigin(carnetEntry, latest)` | la mention à afficher, ou rien si le prix montré n'est pas le dernier connu de l'API |

### `LatestMention` (`useLatestOrigins`)

`{ origin: PriceOrigin; fragile?: 'stale' | 'provisional'; contributedAt: string }` par identifiant.

## Écritures

| Quoi | Où | Quand | Règle |
|------|----|-------|-------|
| Prix d'une tranche | carnet du Mode communautaire | après chaque tranche réussie | seulement si `pickCommunityPrice(...).replacesCarnet` ; daté de `latestContributionAt` |
| — | carnet du Mode personnel | jamais | FR-014 |
| — | prix partagés (API) | jamais | FR-014 : le chargement ne partage rien au nom du joueur |
