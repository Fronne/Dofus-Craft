# Modèle de données : Brisage sans coefficient connu

Aucune donnée stockée en plus. Nouveau résultat de calcul, en mémoire :

**FocusAdvice** (retour de `analyzeFocusAdvice`)
- `status` : `'ok'` | `'invalid'` (+ `reason`) — invalide s'il n'y a aucune ligne exploitable ou si le niveau est < 1.
- `referenceOption` : brisage normal calculé à 100 % (`BrisageOption`, `kind: 'normal'`).
- `focusOptions` : une option focus par ligne (`BrisageOption`).
- `bestFocus?` : option focus de plus grande valeur parmi les complètes ; absente si un prix de rune manque.
- `switchCoefficient?` : `100 × bestFocus.valueKamas / referenceOption.valueKamas` ; absent si l'une des valeurs est incomplète ou si la référence vaut 0.
- `missingRuneIds` : runes sans prix.

Règle : le prix de l'objet n'entre jamais dans `bestFocus` ni `switchCoefficient` ; les gains en kamas ne sont calculés dans l'affichage que si le prix de l'objet est connu.
