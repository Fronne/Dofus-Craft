# Contrat d'interface : lignes négatives, page Brisage

## Affichage

- Les lignes négatives sont listées dans le tableau après les lignes positives, en rouge (`--error` ou équivalent du projet).
- Colonnes : nom de la stat avec l'icône de sa rune ; Jet (champ numérique signé) ; les colonnes de prix, de runes et de focus affichent « — ».
- Le badge « Malus » repère la ligne ; aucune mention supplémentaire sous le jet.
- Pas de badge « Meilleur focus », pas de focus calculé pour la ligne.

## Saisie

- Le champ de jet accepte un nombre négatif dans l'étendue de la ligne.
- Une saisie hors étendue ou positive est signalée (`aria-invalid`) et le jet par défaut est utilisé.

## Calcul

- Les totaux ne dépendent des lignes négatives que par le poids borné ajouté au focus.
- Un objet qui n'a que des lignes négatives affiche le message « L'objet n'a aucune ligne exploitable. ».

## Compatibilité

- Objet sans ligne négative : rendu et résultats identiques à aujourd'hui.
- Session mémorisée avant la fonction : s'ouvre sans erreur.
