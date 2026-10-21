# Modèle de données : lignes à jet négatif

## Données de l'objet

- `negativeRangesOf(effects)` (catalogue-repository) renvoie les plages `{ effectId, from, to }` des effets dont les deux bornes sont ≤ 0 et au moins une < 0 (hors catégorie 2, comme les positifs). `from` ≤ `to` ≤ 0 (ex. −15 à −10). Un effet fixe écrit `to: 0` par DofusDB est une plage d'une valeur (`from = to`).
- `getItemNegativeRanges(id)` : lit l'objet (cache existant) et applique `negativeRangesOf`.
- DofusDB donne à chaque malus son propre `effectId` (−Force = 157, −PA = 168…). `negativeStatId(effectId)` (domaine) renvoie l'id de la stat retirée (157 → 118) ; `negativeRangesOf` l'applique, et un id sans correspondance reste tel quel.
- Les deux plages (positives et négatives) d'une même stat restent séparées.

## Domaine (`src/domain/brisage.ts`)

| Élément | Définition |
|---|---|
| `NegativeLine` | `{ effectId: number; value: number }` avec `value < 0` |
| `negativeLineWeight(value, statWeight, level, settings)` | `max(0, lineWeight(value, statWeight, level, settings))` |
| `BrisageInput.negatives?` | lignes négatives de l'objet |
| `FocusAdviceInput.negatives?` | idem pour le conseil sans coefficient |

### Règles

- `usableLines` continue d'écarter `value <= 0` des lignes de rune. Les négatives n'y passent pas.
- Une ligne négative est utilisable si sa stat a un poids connu **et** une rune (comme une ligne positive) ; sinon elle est ignorée.
- `buildOption` : le `focusWeight` d'un focus ajoute `negativeLineWeight × focusOtherShare` pour chaque ligne négative utilisable. Sans focus, rien ne change. Aucun `RuneYield` n'est créé.
- Si l'objet n'a aucune ligne positive utilisable : `invalid`, « L'objet n'a aucune ligne exploitable. » (FR-009).
- Pas de plafond de 101 pour les négatives.

### Exemple

Objet niveau 200, Force −10 (poids 1) : `0,015 × 200 × 1 × (−10) + 1 = −29`, ramené à 0 : aucune contribution au focus.
Objet niveau 20, Force −1 : `0,015 × 20 × 1 × (−1) + 1 = 0,7` ; avec `focusOtherShare = 0,5` : +0,35 au poids d'un focus ailleurs.

## Page (`BrisagePage.tsx`)

- `negativeRanges` : état alimenté par `getItemNegativeRanges` en même temps que `ranges`.
- Lignes négatives : listées après les lignes positives, `index = breakable.length + position`, jet par défaut `averageRoll`, saisie bornée à l'étendue côté négatif.
- `lineInputs` ne change pas ; la page passe en plus `negatives: [{ effectId, value }]` à `analyzeBrisage` et `analyzeFocusAdvice`.

## Persistance

Aucun changement. Un ancien `rolls` reste lisible : les index des lignes positives ne bougent pas.
