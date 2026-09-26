# Data Model: Page Prix — bénéfice de craft par objet

## Prix HDV d'objet (`SharedItemPrice`, route `/item-prices`)

| Champ | Type | Règle |
|---|---|---|
| `itemId` | chaîne | identifiant DofusDB de l'objet |
| `amountKamas` | entier > 0 | contribution `kind = 'item'` la plus récente sur le serveur |
| `contributedAt` | ISO 8601 | date de cette contribution |

En Mode personnel, l'équivalent vient de `pinnedItemPrices` (`marketPriceKamas`, `updatedAt`).

## Ligne de bénéfice (`CraftProfitRow`, calculée)

| Champ | Type | Règle |
|---|---|---|
| `item` | `{ id, name, imageUrl? }` | catalogue |
| `marketPriceKamas` | entier | prix HDV du mode actif |
| `marketPriceDate` | ISO 8601 | date de ce prix |
| `craftCostKamas` | entier | `compare()` avec coûts « Auto », complet uniquement |
| `profitKamas` | entier | `marketPriceKamas − craftCostKamas` |
| `marginPercent` | entier ou absent | `round(profitKamas / craftCostKamas × 100)`, absent si coût = 0 |

Un objet sans recette, sans prix HDV ou au coût incomplet ne produit **aucune** ligne.

## Tri et filtre

- `sort: 'kamas' | 'percent'`, défaut `'kamas'` ; décroissant, égalité → nom (fr).
- filtre : nom normalisé (`normalizeSearchText`) contient la saisie normalisée.
- limite : 10 / 25 / 50 / 100 premières lignes ; total = nombre de lignes après filtre.
