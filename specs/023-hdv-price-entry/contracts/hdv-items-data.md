# Contract: `src/data/hdv-items.json`

Généré par `node scripts/build-hdv-items.mjs`, relu puis commité. Chargé par la page HDV avec un
`import()` dynamique (hors bundle initial).

```json
{
  "source": "DofusDB (recettes, objets) + tableau d'XP familier + correspondance relevée en jeu",
  "sourceUrl": "https://api.dofusdb.fr",
  "typeMapCheckedAt": "2026-09-28",
  "retrievedAt": "2026-09-28",
  "types": { "15": "Ressource diverse", "209": "Nourriture pour familier" },
  "items": [
    { "id": "20125", "name": "Croquette enrichie", "imageUrl": "https://api.dofusdb.fr/img/items/15528.png", "typeId": 209, "hdv": "animals" }
  ],
  "skipped": { "outOfScope": 186, "excluded": 69, "notExchangeable": 0 }
}
```

Garanties (vérifiées par `tests/unit/hdv-items-data.test.ts`) :

- `items[].id` unique ; chaque `typeId` figure dans `types` et est rattaché à `hdv` dans
  `hdv-type-map.json`.
- Aucun objet d'un type de `excludedTypes` (ex. 97).
- `items` trié par `hdv` puis par nom (comparaison française).
- `skipped` résume ce qui a été écarté, pour vérifier le résultat à la relecture.

Consommateurs : `src/features/hdv/useHdvItems.ts` (lecture seule).
