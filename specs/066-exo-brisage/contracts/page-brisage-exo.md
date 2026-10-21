# Contrat d'interface : page Brisage, exos et over

## Ajout d'un exo

- Sous le tableau « Lignes de l'objet », un bloc « Ajouter un exo » : liste de stats, champ de valeur entière, bouton « Ajouter ».
- La liste ne contient que les stats connues du brisage, avec rune, absentes de l'objet et pas déjà en exo.
- Sous le champ, la valeur maximale de la stat choisie est indiquée (« maximum 101 » pour un poids de 1, « maximum 1 » pour PA).
- Valeur vide, nulle, décimale, négative ou au-dessus du plafond : aucune ligne ajoutée, le champ est marqué invalide (`aria-invalid`) avec un message lisible.
- Sans objet choisi ou sans ligne chargée : le bloc n'est pas affiché.

## Ligne exo dans le tableau

- Les lignes exo sont placées **en tête du tableau**, avant les lignes d'origine, comme en jeu (le dernier exo ajouté en première position), et affichées **en bleu** (nom de stat et jet), lisible en thème clair et sombre.
- Même colonnes que les autres lignes. Le nom de stat porte un badge « exo ».
- Colonne Jet : la valeur de l'exo, sans bornes min/max, sans saisie ; un bouton « Retirer l'exo » (nom accessible « Retirer l'exo <stat> »).
- Colonnes Avec focus : « — » (aucun focus possible sur un exo), jamais badge « Meilleur focus ».
- Colonnes Sans focus : runes et valeur comme une ligne normale.
- Les exos sont comptés dans les totaux, le verdict, le seuil, la descente, les gains suivants et le conseil sans coefficient.

## Over

- Le champ Jet d'une ligne d'origine accepte une valeur au-dessus du maximum de la ligne tant que le poids ne dépasse pas 101 (ou le maximum naturel de la ligne s'il est plus haut).
- Jet au-dessus de la limite : refusé, jet moyen utilisé, texte « jet maximal N » à côté du champ.
- Un jet au-dessus du maximum de la ligne est signalé « over » (au lieu de « modifié »).
- Min / Moyen / Max remettent les jets dans la plage.

## Avertissement

Une note signale que le calcul d'un exo est une estimation reprise de DoFocus, comme le reste du modèle.
