# UI and Storage Contract

## Scope

Le MVP n'expose aucune API réseau. Ce contrat fixe les frontières observables entre l'interface, le
catalogue livré, la persistance locale et le moteur de calcul. Une future source HDV automatique
implémentera une nouvelle frontière sans modifier ces formes métier.

## Catalogue repository

| Operation | Input | Output | Required behavior |
|-----------|-------|--------|-------------------|
| `searchItems` | texte de recherche, filtre catégorie facultatif | liste triée d'objets | Recherche insensible à la casse ; résultat vide explicite. |
| `getItemDetail` | `itemId` | objet, catégorie et recette éventuelle | Retourne la provenance du catalogue ; absence de recette explicite. |
| `getManifest` | aucun | `CatalogueManifest` | Fournit source, version et date. |

## Resource price repository

| Operation | Input | Output | Required behavior |
|-----------|-------|--------|-------------------|
| `get(resourceId)` | identifiant de ressource | `ResourcePrice` ou absent | Ne fabrique jamais un prix. |
| `getMany(resourceIds)` | identifiants uniques | association par identifiant | Retourne les prix connus avec `updatedAt`. |
| `save(resourceId, unitPriceKamas)` | identifiant et entier >= 0 | `ResourcePrice` | Écrit de façon atomique et fixe `updatedAt` à la confirmation. |
| `remove(resourceId)` | identifiant | succès | Réservé à une future action explicite de réinitialisation. |

Les erreurs de stockage sont affichées au joueur sans effacer les valeurs visibles non enregistrées.

## Comparison service

| Operation | Input | Output | Required behavior |
|-----------|-------|--------|-------------------|
| `compare(recipe, prices, marketPrice)` | recette, prix indexés, prix HDV facultatif | `CraftComparison` | Pure, déterministe, sans lecture/écriture de stockage. |

Le service applique exactement les règles de dérivation de [data-model.md](../data-model.md).

## UI interaction contract

| Surface | Inputs | Outputs / states |
|---------|--------|------------------|
| Recherche catalogue | texte, catégorie | résultats, état sans résultat, objet sélectionné. |
| Détail objet | objet sélectionné | visuel ou repli textuel, recette ou état sans recette, provenance. |
| Ligne ressource | prix unitaire éditable | prix enregistré, date lisible, erreur de validation ou de persistance. |
| Prix HDV | entier éditable | prix de comparaison courant, erreur de validation. |
| Résultat | recette, prix ressources, prix HDV | sous-totaux, coût complet/partiel, ressources manquantes, recommandation, écart, pourcentage et base. |

## Validation visible

- Un prix accepte uniquement un entier en kamas supérieur ou égal à 0.
- Une valeur vide n'est pas enregistrée comme 0 ; elle signifie prix inconnu.
- Une valeur invalide reste identifiable et explique la correction attendue.
- La recommandation définitive n'apparaît que si tous les prix de recette et le prix HDV sont
  valides et présents.
- Les montants sont affichés en kamas et le pourcentage indique explicitement sa base.
