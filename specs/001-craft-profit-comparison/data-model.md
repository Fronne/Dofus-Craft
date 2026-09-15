# Data Model: Comparaison rentabilité craft

## CatalogueManifest

Métadonnées du catalogue livré avec l'application.

| Field | Type / rule | Purpose |
|-------|-------------|---------|
| `sourceName` | texte non vide | Origine déclarée des données Dofus. |
| `sourceUrl` | URL valide ou absente | Référence consultable vers l'origine. |
| `sourceVersion` | texte non vide | Version ou identifiant de l'import. |
| `publishedAt` | date/heure ISO 8601 | Date de publication ou d'import de la source. |
| `catalogueVersion` | texte non vide | Version du jeu de données livré. |

## ItemCategory

| Field | Type / rule | Purpose |
|-------|-------------|---------|
| `id` | identifiant stable, non vide | Clé de catégorie. |
| `label` | texte non vide | Libellé présenté au joueur. |
| `sortOrder` | entier positif | Ordre de navigation. |

Les catégories de départ couvrent au minimum amulette, anneau, cape, coiffe, ceinture, bottes,
arme, trophée et bouclier lorsqu'elles sont présentes dans le catalogue.

## DofusItem

| Field | Type / rule | Purpose |
|-------|-------------|---------|
| `id` | identifiant stable, non vide | Référence de l'objet dans recettes, prix HDV et URL. |
| `name` | texte non vide | Recherche et affichage. |
| `categoryId` | référence à `ItemCategory` | Filtrage par catégorie. |
| `imageUrl` | URL valide ou absente | Visuel facultatif. |
| `recipeId` | référence à `Recipe` ou absente | Indique si l'objet est fabriquable dans les données. |

## Resource

| Field | Type / rule | Purpose |
|-------|-------------|---------|
| `id` | identifiant stable, non vide | Clé commune aux recettes et prix personnels. |
| `name` | texte non vide | Identification du joueur. |
| `imageUrl` | URL valide ou absente | Visuel facultatif. |

## Recipe et RecipeIngredient

| Field | Type / rule | Purpose |
|-------|-------------|---------|
| `Recipe.id` | identifiant stable, non vide | Clé de recette. |
| `Recipe.itemId` | référence unique à `DofusItem` | Objet produit. |
| `Recipe.ingredients` | liste non vide | Ressources requises. |
| `RecipeIngredient.resourceId` | référence à `Resource` | Ressource requise. |
| `RecipeIngredient.quantity` | entier strictement positif | Quantité de ressources nécessaire. |

Une recette ne peut référencer qu'une fois une même ressource ; les données invalides sont rejetées
lors de l'import du catalogue.

## ResourcePrice

Donnée personnelle persistée dans IndexedDB ; aucun compte ni identifiant personnel n'est stocké.

| Field | Type / rule | Purpose |
|-------|-------------|---------|
| `resourceId` | clé primaire, référence à `Resource` | Rend le prix réutilisable entre recettes. |
| `unitPriceKamas` | entier supérieur ou égal à 0 | Prix saisi par le joueur. |
| `updatedAt` | date/heure ISO 8601 | Fraîcheur visible du prix. |

**Transitions**:

1. Absent → enregistré lors d'une saisie valide.
2. Enregistré → mis à jour lors d'une nouvelle saisie valide ; `updatedAt` devient l'instant de la
   confirmation.
3. Enregistré → supprimé uniquement par une action explicite de réinitialisation, si elle est
   ajoutée ; l'état devient absent.

## MarketPrice

Donnée de saisie de la comparaison courante, non partagée entre objets dans le MVP.

| Field | Type / rule | Purpose |
|-------|-------------|---------|
| `itemId` | référence à `DofusItem` | Objet concerné. |
| `amountKamas` | entier supérieur ou égal à 0 ou absent | Prix HDV observé. |
| `enteredAt` | date/heure ISO 8601 ou absente | Moment de la saisie. |

## CraftComparison

Résultat dérivé, jamais persistant comme source de vérité.

| Field | Type / rule | Purpose |
|-------|-------------|---------|
| `ingredientLines` | une ligne par ingrédient | Quantité, prix connu éventuel et sous-total. |
| `knownCraftCostKamas` | entier supérieur ou égal à 0 | Somme des sous-totaux connus. |
| `missingResourceIds` | liste d'identifiants uniques | Données empêchant un coût complet. |
| `craftCostStatus` | `complete` ou `partial` | Explicite le niveau de certitude. |
| `marketPriceKamas` | entier ou absent | Prix HDV retenu. |
| `recommendation` | `craft` / `buy` / `equal` / `insufficient-data` | Décision affichable. |
| `differenceKamas` | entier ou absent | Économie absolue positive pour l'option recommandée. |
| `percentage` | nombre non négatif ou absent | Économie relative lorsque la base est strictement positive. |
| `percentageBase` | `craft-cost` / `market-price` / absent | Rend le pourcentage interprétable. |

**Règles de dérivation**:

- Chaque sous-total connu vaut `quantity × unitPriceKamas`.
- Le coût est `complete` seulement si tous les ingrédients ont un prix valide.
- Sans coût complet ou sans prix HDV, `recommendation` vaut `insufficient-data` ; aucun écart ou
  pourcentage définitif n'est affiché.
- Si les deux montants complets sont égaux, `recommendation` vaut `equal` et `differenceKamas`
  vaut 0.
- Si craft < HDV, recommander `craft`; l'économie est `HDV − craft` et le pourcentage est calculé
  par rapport au prix HDV.
- Si HDV < craft, recommander `buy`; l'économie est `craft − HDV` et le pourcentage est calculé
  par rapport au coût de craft.
- Une base égale à 0 supprime le pourcentage plutôt que de produire une division par zéro.

## Relationships

```text
ItemCategory 1 ──── * DofusItem 1 ──── 0..1 Recipe 1 ──── * RecipeIngredient * ──── 1 Resource
                                                                                       │
                                                                                     0..1
                                                                                 ResourcePrice
DofusItem 1 ──── 0..1 MarketPrice
Recipe + ResourcePrice + MarketPrice ──── CraftComparison (derived)
```
