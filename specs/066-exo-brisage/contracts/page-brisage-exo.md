# Contrat d'interface : page Brisage, exos et over

## Ajout d'un exo

- Un bouton « + Exo » à droite du titre « Lignes de l'objet » ajoute une ligne **en tête du tableau**, sans rune. Un seul exo vide à la fois : le bouton est désactivé tant qu'il reste un exo sans rune ou qu'aucune rune n'est disponible. Le bouton n'est affiché que si l'objet est chargé et a des lignes.
- La ligne vide affiche « Choisir une rune » ; un clic ouvre une liste de runes **avec l'icône de chaque rune** (nom de la rune, stat à droite). Échap ou un clic à côté la ferme.
- La liste ne contient que les runes des stats connues du brisage, absentes de l'objet et pas déjà prises par un autre exo (la rune de la ligne ouverte reste choisissable).
- Une fois la rune choisie, la ligne compte tout de suite avec la valeur 1 ; le joueur peut changer la valeur dans la ligne (entier de 1 au plafond de la stat), ou changer de rune.
- Valeur vide, nulle, décimale, négative ou au-dessus du plafond : marquée invalide (`aria-invalid`), la dernière valeur valide reste utilisée, et le plafond (« max N », poids max 101) est écrit à côté du champ.
- Une note sous le tableau rappelle que le calcul d'un exo est une estimation reprise de DoFocus.

## Ligne exo dans le tableau

- Les lignes exo sont placées **en tête du tableau**, avant les lignes d'origine, comme en jeu (le dernier exo ajouté en première position), et affichées **en bleu**, lisible en thème clair et sombre.
- Même colonnes que les autres lignes. La rune porte un badge « Exo ».
- Colonne Jet : le champ de valeur de l'exo (sans bornes min/max) et un bouton « Retirer » (nom accessible « Retirer l'exo <stat> »).
- Colonnes Avec focus : « — » (aucun focus possible sur un exo), jamais badge « Meilleur focus ».
- Colonnes Sans focus : runes et valeur comme une ligne normale.
- Les exos sont comptés dans les totaux, le verdict, le seuil, la descente, les gains suivants et le conseil sans coefficient. Un exo sans rune choisie n'est pas compté.

## Over

- Le champ Jet d'une ligne d'origine accepte une valeur au-dessus du maximum de la ligne tant que le poids ne dépasse pas 101 (ou le maximum naturel de la ligne s'il est plus haut).
- Jet au-dessus de la limite : refusé, jet moyen utilisé, texte « jet maximal N » à côté du champ.
- Un jet au-dessus du maximum de la ligne est signalé « over » (au lieu de « modifié »).
- Min / Moyen / Max remettent les jets dans la plage.

