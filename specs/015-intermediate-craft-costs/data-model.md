# Data Model: Coût de craft des ressources intermédiaires

## Resource (existant, étendu)

| Champ | Type | Notes |
|---|---|---|
| `id` | string | identifiant DofusDB |
| `name` | string | nom français |
| `imageUrl` | string? | |
| `craftable` | boolean? | **nouveau** — issu de `hasRecipe`. `undefined` = inconnu (détail mis en cache avant cette version) : à vérifier |

## RecipeTree (calculé en mémoire, non persisté)

Table `resourceId → Recipe | null | undefined` alimentée par `useRecipeTree` :
- `Recipe` : recette connue (première recette DofusDB) ;
- `null` : vérifié, pas de recette (ou recette introuvable/invalide) → non craftable ;
- `undefined` (absent) : pas encore chargé → traité comme non craftable **pour l'instant**, le
  calcul se met à jour à l'arrivée.

Accompagnée d'une table `resourceId → Resource` (nom, image, `craftable`) pour afficher les
sous-ressources.

## IngredientChoice (persisté, localStorage)

`Record<resourceId, 'buy' | 'craft'>` sous la clé `craftcheck-ingredient-choices`. Absence d'entrée =
automatique. Portée : l'appareil, toutes fiches et tous serveurs.

## RetainedCost (calculé, jamais persisté)

Résultat de `retainedCost()` pour une ressource à un endroit de l'arbre :

| Champ | Type | Règle |
|---|---|---|
| `resourceId` | string | |
| `purchaseKamas` | number? | prix du carnet (mode actif, serveur actif) |
| `recipeKamas` | number? | somme `quantité × unitKamas` des enfants ; **défini seulement si tous les enfants ont un `unitKamas`** |
| `children` | `{ quantity, cost: RetainedCost }[]`? | présents si la ressource est craftable à cet endroit (ni cycle ni recette absente) |
| `option` | `'buy' \| 'craft' \| 'missing'` | voir transitions |
| `forced` | boolean | `true` si un choix forcé s'applique |
| `unitKamas` | number? | `purchaseKamas` si `option = buy`, `recipeKamas` si `craft`, absent si `missing` |

### Règle de choix (FR-003, FR-009, FR-010)

```
si non craftable ici (pas de recette, pas encore chargée, ou cycle) :
    option = buy si purchaseKamas connu, sinon missing        (forced ignoré)
sinon si choix forcé = buy :   option = buy si purchaseKamas connu, sinon missing   (forced = true)
sinon si choix forcé = craft : option = craft si recipeKamas connu, sinon missing   (forced = true)
sinon (automatique) :
    les deux connus  → le plus petit ; égalité → buy
    un seul connu    → celui-là
    aucun            → missing
```

### Cycle (FR-012)

Le parcours transmet l'ensemble des `resourceId` de la branche (ancêtres). Une ressource déjà
présente dans cet ensemble est traitée comme non craftable à cet endroit.

## Prix effectifs (sortie vers `compare()`)

`effectiveIngredientPrices(recipe, tree, prices, choices)` → `Record<resourceId, ResourcePrice>` pour
les ingrédients de premier niveau dont `unitKamas` est défini ; `updatedAt` repris du carnet quand
l'option est `buy`, vide quand elle est `craft` (valeur calculée). Un ingrédient `missing` est absent,
ce que `compare()` traite déjà comme prix manquant (coût partiel).
