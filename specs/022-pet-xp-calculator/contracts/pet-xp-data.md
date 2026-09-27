# Contract: `src/data/pet-xp-data.json`

Produit par `node scripts/build-pet-xp-data.mjs`, relu puis commité. Jamais téléchargé à l'exécution.

```json
{
  "source": "Dofus Tool — Tableau d'XP familier",
  "sourceUrl": "https://www.dofustool.com/tableau-xp-familier-dofus/",
  "retrievedAt": "2026-09-27",
  "cumulativeXpByLevel": [1, 2, 3, 5, "…", 196159],
  "foods": [
    { "itemId": "8482", "name": "Peau de Rat", "imageUrl": "https://api.dofusdb.fr/img/items/….png",
      "xpGiven": 1, "quantityNeeded": 1, "sourceName": "Peau de Rat" }
  ],
  "unmatched": [
    { "sourceName": "Carapace Bleue", "reason": "ambiguous" },
    { "sourceName": "Croquette", "reason": "not-found" },
    { "sourceName": "Graine de Sésame", "reason": "invalid-quantity" }
  ]
}
```

Invariants vérifiés par un test unitaire : 100 niveaux strictement croissants, `itemId` uniques,
`xpGiven > 0`, `quantityNeeded` entier > 0.

`reason` ∈ `not-found` | `ambiguous` | `invalid-quantity` | `zero-xp` | `conflicting-duplicate`.
