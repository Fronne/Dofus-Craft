# Contrat d'interface : page Rentabilité avec liste gardée

## Mention de la liste gardée

Affichée au-dessus de la liste, à la place de « Calcul en cours… », tant que `keptAt` est présent :

- mise à jour en cours : `Liste du JJ/MM à HH:MM — mise à jour en cours…` (`role="status"`)
- mise à jour échouée : `Liste du JJ/MM à HH:MM — mise à jour impossible pour le moment.`
  (`role="status"`)

Date et heure au format local français (`fr-FR`, jour/mois, heures:minutes).

## Ce qui ne change pas

- « Calcul en cours… (n / total) » quand aucune liste n'est affichable.
- « Rentabilité indisponible » + « Réessayer » quand aucune liste n'est affichable et que le calcul
  échoue.
- Lignes, colonnes, tri, recherche, défilement infini, clic sur une ligne.
