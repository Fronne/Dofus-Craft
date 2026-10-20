# Recherche : Brisage sans coefficient connu

## D1 – Le prix de l'objet s'annule dans la comparaison

- **Décision** : le coefficient de bascule vaut `100 × V_focus / V_100`, où `V_focus` est la valeur en runes du meilleur focus et `V_100` celle du brisage normal à 100 %.
- **Raison** : gain normal = `c/100 × V_100 − prix`, gain focus = `V_focus − prix` ; l'égalité donne `c = 100 × V_focus / V_100`, sans le prix. Le conseil reste donc valable même sans prix d'objet.
- **Alternatives** : comparer des gains à un coefficient supposé (rejeté : valeur inventée).

## D2 – Meilleur focus

- **Décision** : le meilleur focus est la ligne dont l'option focus a la plus grande valeur en kamas des runes (seulement les options complètes, tous prix connus) ; égalité → première ligne du tableau.
- **Raison** : le prix de l'objet étant constant, classer par valeur ou par gain est équivalent ; classer par valeur marche aussi sans prix d'objet.

## D3 – Réutilisation

- **Décision** : nouvelle fonction `analyzeFocusAdvice` dans `src/domain/brisage.ts`, qui réutilise `buildOption` (part de 100 % pour le « normal », parts focus habituelles). `analyzeBrisage` n'est pas modifiée.
- **Alternatives** : rendre le coefficient optionnel dans `analyzeBrisage` (rejeté : touche un chemin déjà testé et oblige à gérer des gains indéfinis partout).

## D4 – Colonne « Sans focus »

- **Décision** : affichée, étiquetée « à 100 % (référence) » tant que le coefficient est inconnu.
- **Raison** : montre au joueur ce que le brisage normal donnerait au maximum, sans présenter de valeur devinée comme réelle.
