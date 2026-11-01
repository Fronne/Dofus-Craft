# Data Model: Calcul des bons plans selon la valeur de marché

Aucune donnée stockée ne change. Les notions ci-dessous sont calculées à la volée pour chaque annonce.

## Note d'un jet (`JetQuality`, étendu)

| Champ | Sens |
|---|---|
| `quality` | Somme de `valeur × poids × facteur exo × importance` |
| `unknownLines` | Lignes de stat sans poids connu, inchangé |
| `exoEffectIds` | Stats en exo, inchangé (la page s'en sert) |
| `exoTiers` | Pour chaque exo trié, la stat et son côté du palier |
| `defectEffectIds` | Stats dont la valeur dépasse l'écart accepté, triées |

## Règles

- Importance : tableau FR-004, 1 pour une stat connue absente du tableau.
- Écart accepté : tableau FR-009, indéfini pour une stat qui ne fait jamais de défaut.
- Défaut : `valeur < maximum − écart accepté`, une ligne absente valant 0.
- Comparables : mêmes `exoTiers`, mêmes `defectEffectIds`, qualité à ±25 %.

`DealVerdict` ne change pas de forme : `exoEffectIds` et `hasExo` restent ce que la page lit.
