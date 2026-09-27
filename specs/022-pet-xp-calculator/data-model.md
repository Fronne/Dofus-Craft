# Data Model: Page Familier

## PetXpCurve (fichier de données)

| Champ | Type | Règle |
|---|---|---|
| `cumulativeXpByLevel` | `number[]` (100 valeurs) | indice 0 = niveau 1 ; strictement croissant ; niveau 1 = 1, niveau 100 = 196 159 |

## PetFood (ressource nourrissante, fichier de données)

| Champ | Type | Règle |
|---|---|---|
| `itemId` | `string` | identifiant DofusDB, unique dans le fichier |
| `name` | `string` | nom DofusDB (fr) |
| `imageUrl` | `string?` | icône DofusDB |
| `xpGiven` | `number` | > 0, tel que publié par la source |
| `quantityNeeded` | `number` | entier > 0 |
| `sourceName` | `string` | nom dans le tableau source (traçabilité) |

Dérivé : `xpPerUnit = xpGiven / quantityNeeded`.

## PetLevelsInput (saisie, mémorisée sur l'appareil)

| Champ | Règle |
|---|---|
| `currentLevel` | entier 1–99 |
| `xpInLevel` | entier ≥ 0, < XP entre `currentLevel` et `currentLevel + 1` ; 0 par défaut |
| `targetLevel` | entier 2–100, > `currentLevel` pour qu'un calcul ait lieu |

## PetFoodRecommendation (calculé)

| Champ | Règle |
|---|---|
| `food` | PetFood |
| `unitPriceKamas` | prix connu, > 0 |
| `priceDate` | date du prix utilisé |
| `priceOrigin` | `carnet` \| `community-median` |
| `quantity` | `ceil(xpNeeded / xpPerUnit)` |
| `totalKamas` | `quantity × unitPriceKamas` |

## PetFoodPlan (résultat de la page)

`xpNeeded`, `recommendations` (10 max, coût croissant puis nom), `unpricedCount` (ressources
rattachées sans prix).
