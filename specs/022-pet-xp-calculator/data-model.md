# Data Model: Page Familier

## PetXpCurve (fichier de données)

| Champ | Type | Règle |
|---|---|---|
| `cumulativeXpByLevel` | `number[]` (101 valeurs) | indice = niveau (0 à 100) ; strictement croissant ; niveau 0 = 0, niveau 100 = 179 592 |

## PetFood (ressource nourrissante, fichier de données)

| Champ | Type | Règle |
|---|---|---|
| `itemId` | `string` | identifiant DofusDB, unique dans le fichier |
| `name` | `string` | nom DofusDB (fr) |
| `imageUrl` | `string?` | icône DofusDB |
| `xpPerUnit` | `number` | > 0, XP donnée par une unité, telle que publiée par la source |
| `sourceName` | `string` | nom dans le tableau source (traçabilité) |

## PetLevelsInput (saisie, mémorisée sur l'appareil)

| Champ | Règle |
|---|---|
| `currentLevel` | entier 0–99 |
| `xpInLevel` | entier ≥ 0, < XP entre `currentLevel` et `currentLevel + 1` ; 0 par défaut |
| `targetLevel` | entier 1–100, > `currentLevel` pour qu'un calcul ait lieu |

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
