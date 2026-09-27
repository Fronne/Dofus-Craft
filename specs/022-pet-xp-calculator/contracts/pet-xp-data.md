# Contract: `src/data/pet-xp-data.json`

Produit par `node scripts/build-pet-xp-data.mjs` à partir de `scripts/data/pet-xp-resources.csv`
(onglet « XP COMPLET » de l'Excel, colonnes `name,xpPerUnit`) et `scripts/data/pet-xp-curve.json`
(courbe du client), relu puis commité. Jamais téléchargé à l'exécution.

```json
{
  "source": "Dafous — Calculateur Pet XP",
  "sourceUrl": "https://dafous.app/pet-xp",
  "curveSource": "Client Dofus — EvolutiveItemTypes.d2o, type 1 (familier), experienceByLevel",
  "retrievedAt": "2026-09-27",
  "cumulativeXpByLevel": [0, 1, 2, 3, 4, 6, "…", 179592],
  "foods": [
    { "itemId": "8482", "name": "Peau de Rat", "imageUrl": "https://api.dofusdb.fr/img/items/….png",
      "xpPerUnit": 2.646, "sourceName": "Peau de Rat" }
  ],
  "unmatched": [
    { "sourceName": "Carapace Bleue", "reason": "ambiguous" },
    { "sourceName": "Ambre gris", "reason": "not-found" }
  ]
}
```

Invariants vérifiés par un test unitaire : 101 niveaux (0 à 100) strictement croissants, 0 au
niveau 0 et 179 592 au niveau 100, `itemId` uniques, `xpPerUnit > 0`.

`reason` ∈ `not-found` | `ambiguous` | `zero-xp` | `conflicting-duplicate`.
