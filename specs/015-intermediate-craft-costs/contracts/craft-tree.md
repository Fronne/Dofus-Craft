# Contrat : calcul du coût retenu (`src/domain/craft-tree.ts`)

Fonctions pures, sans accès réseau ni stockage. Types : voir [data-model.md](../data-model.md).

## `retainedCost(resourceId, tree, prices, choices, ancestors?) → RetainedCost`

- `tree` : `{ recipes: Record<string, Recipe | null>; }` — recette connue, `null` (aucune), ou
  absente (pas encore chargée).
- `prices` : `Record<string, ResourcePrice>` — carnet du mode et du serveur actifs.
- `choices` : `Record<string, 'buy' | 'craft'>` — choix forcés.
- `ancestors` : ressources de la branche courante (détection de cycle), vide par défaut.

Garanties :
1. Termine toujours (une ressource présente dans `ancestors` n'est pas développée).
2. Applique exactement la règle de choix du data-model (automatique, égalité → `buy`, forcé sans
   valeur → `missing`).
3. `recipeKamas` n'est défini que si **tous** les enfants ont un `unitKamas` ; la valeur est
   `Σ quantité × unitKamas`.
4. Ne modifie aucune de ses entrées.

## `effectiveIngredientPrices(recipe, tree, prices, choices) → Record<string, ResourcePrice>`

Pour chaque ingrédient de premier niveau de `recipe` (l'objet final est l'ancêtre de tous) :
`retainedCost` puis, si `unitKamas` est défini, une entrée `{ resourceId, unitPriceKamas: unitKamas,
updatedAt }`. Sortie destinée à `compare(recipe, effectivePrices, marketPrice)`, inchangée.

## `treeResourceIds(recipe, tree) → string[]`

Tous les identifiants de ressources atteignables depuis `recipe` via les recettes connues (sans
doublon, cycles ignorés). Sert à charger le carnet et, en Mode communautaire, à compléter les prix
manquants par la médiane.

## Cas de test obligatoires (principe II)

| Cas | Attendu |
|---|---|
| Ingrédient non craftable avec prix | `buy`, `unitKamas` = prix |
| Craftable, recette moins chère | `craft`, `unitKamas` = coût recette |
| Craftable, achat moins cher | `buy` |
| Égalité | `buy` |
| Seul l'achat connu / seule la recette complète | celui-là |
| Aucun des deux | `missing`, absent des prix effectifs |
| Recette incomplète (une sous-ressource sans prix) | `recipeKamas` absent |
| Forcé `buy` sans prix d'achat | `missing`, `forced` |
| Forcé `craft` alors que l'achat est moins cher | `craft`, `forced` |
| Chaîne de 3 niveaux | coûts remontés et quantités multipliées à chaque niveau |
| Cycle A → B → A | B traité comme feuille, calcul terminé |
| Recette pas encore chargée | traité comme non craftable, puis recalcul avec la recette |
