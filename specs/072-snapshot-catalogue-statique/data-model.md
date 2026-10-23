# Data Model: snapshot du catalogue

## CatalogueSnapshotMeta (`meta.json`)
- `version`: 1 (format)
- `generatedAt`: date ISO de génération
- `source`: `"DofusDB"`
- `totals`: `{ items: number, itemSets: number }` (valeurs de contrôle de la source à la génération)

## Fichiers
- `items.json` : tableau d'objets DofusDB projetés (objets avec recette, ordre `name.fr` comme `getDofusDbItems('')`).
- `item-sets.json` : tableau de panoplies DofusDB projetées (ordre `id`).

## CatalogueOrigin (gardé avec le cache)
- `origin`: `"snapshot" | "dofusdb"`
- `generatedAt`: date du contenu
- `totals`: `{ items, itemSets }` — référence du contrôle de fraîcheur

## Règles
- Intégrité : `items.length === totals.items` et `itemSets.length === totals.itemSets`, sinon snapshot rejeté (repli crawl).
- Remplacement du cache atomique : écriture IndexedDB d'une valeur complète, jamais partielle.
- Transitions : `absent → snapshot → dofusdb (sur écart de total)` ; un nouveau déploiement ramène à `snapshot`.
