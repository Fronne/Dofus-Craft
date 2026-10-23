# Contrat : fichiers du snapshot

Servis à `/catalogue-snapshot/{meta,items,item-sets}.json`, `Content-Type: application/json`.

```json
{ "version": 1, "generatedAt": "2026-10-23T10:00:00.000Z", "source": "DofusDB",
  "totals": { "items": 0, "itemSets": 0 } }
```

(exemple de `meta.json`)

- `items.json` / `item-sets.json` : tableaux JSON, éléments au format `DofusDbItem` / `DofusDbItemSet`
  restreints aux champs consommés (voir R2), mêmes types que `src/services/dofusdb-types.ts`.
- Le client rejette tout fichier dont la longueur ne correspond pas à `meta.totals`.
- Contrôle de fraîcheur (client → DofusDB) : `GET {API}/items?hasRecipe=true&$limit=0` et
  `GET {API}/item-sets?$limit=0`, lecture de `total` uniquement.
