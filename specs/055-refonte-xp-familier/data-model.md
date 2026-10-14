# Data Model: Refonte de la page XP Familier

Aucune donnée stockée nouvelle. Les types ci-dessous sont des valeurs calculées, dans
`src/domain/pet-xp.ts`, à partir des types existants (`PetFood`, `PetFoodPrice`,
`PetFoodRecommendation`).

## PetXpProgress

| Champ | Type | Règle |
|-------|------|-------|
| `level` | entier 0–100 | `levelForTotalXp(totalXp).level` |
| `totalXp` | entier | XP totale saisie |
| `percent` | nombre | `totalXp ÷ maxTotalXp() × 100`, arrondi à 0,1 |

## RankedPetFood

`PetFoodRecommendation` + `rank` (entier ≥ 1). Liste produite par
`rankPetFoods(xp, foods, prices, maxQuantity, xpMultiplier)` : ressources avec prix, triées par
coût total croissant (égalités : règles 022), plafond appliqué ; `rank = index + 1`. Vide si
`xp ≤ 0`.

## PodiumEntry

`RankedPetFood` + `gapKamas` (entier ≥ 0) = `totalKamas − ranked[0].totalKamas`. Produit par
`petFoodPodium(ranked)` : les 3 premiers (moins s'il y en a moins).

## PetFoodTarget (fiche)

Produit par `petFoodTarget(food, xp, prices, ranked, maxQuantity, xpMultiplier)` :

| Champ | Type | Règle |
|-------|------|-------|
| `food` | `PetFood` | ressource choisie |
| `xpPerUnit` | nombre | `food.xpPerUnit × xpMultiplier` |
| `quantity` | entier | `quantityFor(xp, food, xpMultiplier)` |
| `sharePercent` | nombre | `min(100, xpPerUnit ÷ xp × 100)` |
| `price` | `{ unitPriceKamas, date?, totalKamas }` ou absent | absent sans prix connu |
| `standing` | `{ kind: 'ranked', rank, gapPercent }` · `{ kind: 'capped', maxQuantity }` · `{ kind: 'unpriced' }` | `ranked` si présente dans `ranked` ; `capped` si prix connu mais `quantity > maxQuantity` ; `unpriced` sans prix |

`gapPercent = (totalKamas − ranked[0].totalKamas) ÷ ranked[0].totalKamas × 100`, arrondi à 0,1.

## Validation / bornes

- `xp ≤ 0` : pas de podium, de fiche ni de tableau (le bandeau dit qu'il n'y a plus rien à donner).
- Moins de 3 ressources classées : podium partiel, tableau absent.
- Choix de ressource conservé tant que la page est ouverte ; recalculé à chaque changement
  d'objectif, d'Almanax, de serveur ou de mode de prix.
