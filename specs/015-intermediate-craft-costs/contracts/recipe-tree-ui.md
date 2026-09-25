# Contrat d'interface : fiche d'objet et page Suivis

## Fiche d'objet — section « Prix des ressources »

Pour chaque ligne de ressource (tous niveaux) :

| Élément | Condition | Contenu |
|---|---|---|
| Champ de prix | toujours | comportement actuel inchangé (personnel : saisie libre ; communautaire : pré-rempli, verrouillé, partage) — c'est le **prix d'achat** |
| Bouton de dépliage | ressource craftable ici (recette connue, pas de cycle) | `aria-expanded`, libellé accessible « Afficher la recette de {nom} » / « Masquer la recette de {nom} » |
| Indication d'option | ressource craftable ici | « Acheté » ou « Crafté » (ou « Prix manquant ») + les montants connus, à l'unité : « Achat : X/u » · « Craft : Y/u », et « (ton choix) » si un choix forcé s'applique |
| Commande de forçage | ressource craftable ici | trois états : Auto · Acheter · Crafter (`aria-pressed`) ; s'applique à la ressource partout |
| Sous-total | option ≠ `missing` | `quantité × unitKamas` (et non plus `quantité × prix du carnet`) |
| Recette dépliée | ligne dépliée | lignes enfants indentées, quantités = quantité unitaire × quantité de la ligne parente ; même contrat, récursivement |

- État replié par défaut ; l'état de dépliage n'est pas conservé entre deux visites.
- Les lignes de premier niveau s'affichent sans attendre les recettes ; une ligne dont la recette
  est en cours de chargement n'a pas encore de bouton de dépliage.

## Coût de craft et comparaison

- Le panneau de comparaison (coût de craft, écart, recommandation) utilise les prix effectifs
  (`effectiveIngredientPrices`) : un ingrédient « Crafté » y compte pour son coût de recette.

## Page Suivis

- `Craft : …` de chaque carte = coût de craft calculé par `effectiveIngredientPrices` + `compare()`
  avec l'arbre de recettes complet de l'objet, le carnet du mode actif et les choix forcés : valeur
  identique à la fiche pour les mêmes données (FR-011, SC-002).
- Aucun nouvel élément visuel sur la carte.

## Page Prix (carnet)

- Inchangée : n'affiche que des prix saisis ou pré-remplis, jamais un coût de recette (FR-008,
  SC-005).
