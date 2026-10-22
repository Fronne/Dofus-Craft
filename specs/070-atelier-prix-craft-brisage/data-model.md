# Modèle de données : Atelier des prix du craft sur la page Brisage

Aucune donnée nouvelle n'est conservée : la fenêtre lit et écrit les carnets de prix existants. Ce document
décrit ce que la fenêtre manipule et son état local, qui disparaît à la fermeture.

## Données existantes réutilisées (inchangées)

| Donnée | Rôle dans la fenêtre | Source |
|---|---|---|
| `Recipe` / `RecipeTree` | recette de l'objet et recettes de ses composants craftables | `getItemDetail`, `useRecipeTree` |
| `ResourcePrice` (`resourceId`, `unitPriceKamas`, `updatedAt`) | prix d'une ressource, dans le carnet du mode actif | `resourcePricesFor(priceMode)` |
| `IngredientChoice` (`buy` / `craft`) | choix forcé pour un composant craftable, gardé sur l'appareil | `useIngredientChoices` |
| `RetainedCost` | coût retenu d'une ligne (acheté, crafté, manquant) et ses lignes enfants | `retainedCost` |

## État local de la fenêtre

| Champ | Type | Règle |
|---|---|---|
| `open` | booléen | vrai entre le clic sur « Prix du craft » et la fermeture |
| `inputs` | `Record<resourceId, string>` | texte en cours de frappe, non encore enregistré ; une ressource présente à plusieurs endroits partage une seule entrée |
| `expandedPaths` | `Set<string>` | tous les composants craftables au départ ; le joueur peut en replier |
| `reloadKey` | entier, dans `BrisagePage` | augmente à chaque fermeture ; relance la lecture de `useItemCraftCost` |

## Règles de validation

- Le texte saisi est converti par `parseKamas` : entier de kamas positif. Vide, nul, négatif ou non numérique → aucune écriture, l'ancien prix reste (FR-008). Un champ vidé retire le prix, comme sur Recherche.
- Une valeur identique au prix du carnet n'écrit rien et ne change pas `updatedAt`.
- Mode communautaire : la saisie suit les règles de partage et de confirmation de `CommunityResourcePriceRow`.

## Calculs affichés (jamais conservés)

| Valeur | Définition |
|---|---|
| Quantité d'une ligne | quantité de la recette × quantités des lignes parentes (comme `IngredientRow`) |
| Sous-total d'une ligne | prix retenu × quantité ; absent si le prix manque |
| Total du craft | `compare(...)` sur les prix retenus ; marqué incomplet tant qu'un prix nécessaire manque |

## Transitions

1. **Fermée → ouverte** : lecture de la recette, de l'arbre et des carnets ; focus sur le premier champ.
2. **Saisie** : `inputs` change à la frappe (total recalculé), puis le prix est écrit dans le carnet au départ du champ.
3. **Ouverte → fermée** : `inputs` est vidé, `reloadKey` augmente, `useItemCraftCost` relit les carnets, le focus revient au bouton.
