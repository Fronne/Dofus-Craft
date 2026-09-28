# Contract: `scripts/data/hdv-type-map.json`

Entrée écrite à la main du script `scripts/build-hdv-items.mjs`. Seule source de vérité de l'HDV
d'un type d'objet (research.md §1).

```json
{
  "source": "Relevé en jeu par le porteur du projet",
  "checkedAt": "2026-09-28",
  "types": {
    "15": "resources",
    "74": "consumables",
    "209": "animals",
    "78": null
  },
  "excludedTypes": [97],
  "listAllExchangeable": [209]
}
```

Règles :

- Clés de `types` = id de type DofusDB (chaîne). Valeur : `"resources"`, `"consumables"`,
  `"animals"` ou `null` (se vend dans un HDV hors périmètre).
- Un type utile absent de `types` fait **échouer** le script avec la liste des types manquants : il
  faut le trancher dans ce fichier, jamais le deviner.
- `excludedTypes` : jamais listés, même utiles (certificats de dragodinde, décision du porteur du
  projet).
- `listAllExchangeable` : tous les objets échangeables de ces types sont listés, utiles ou non
  (FR-004b) ; leur valeur dans `types` doit être non nulle.
- Contenu : le tableau validé de research.md §2.
