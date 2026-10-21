# Recherche : lignes à jet négatif au brisage

## Décision 1 — Règle de poids : celle de Kama Master

- **Décision** : poids d'une ligne négative = `max(0, 0,015 × niveau × poids de la stat × jet + 1)`, avec un jet négatif ; aucune rune ; jamais cible de focus ; compte à 50 % dans le poids d'un focus.
- **Source** : le code de kamamaster.fr (`getRuneQuantity`) calcule `3 × poids × jet × niveau / 200 + 1` quelle que soit la valeur du jet, et le résultat négatif est ramené à 0 (`i<0&&(i=0)`). Le focus additionne ensuite la quantité de runes des autres lignes divisée par 2.
- **Raison** : réutilise la formule existante (`lineWeight`), aucune constante incertaine, l'utilisateur a demandé cette logique.
- **Alternatives écartées** :
  - DoFocus : `3 × jet / (200 × valeur) + 1`, sans niveau ni poids de stat. La constante `valeur` vient d'une API non lisible, et le poids obtenu est positif pour un malus, ce qui augmente le focus.
  - Règle de forgemagie « poids d'un malus divisé par 2 » : confirmée par l'utilisateur pour la forgemagie, mais absente du brisage chez Kama Master.

## Décision 2 — Lecture des lignes négatives : fonction séparée

- **Décision** : ajouter `negativeRangesOf` dans `src/data/catalogue-repository.ts`, sans modifier `effectRangesOf`.
- **Raison** : `effectRangesOf` est dupliquée dans `scripts/build-brisage-items.mjs` pour l'index de recherche par stats (spec 064). Y ajouter les négatifs ferait trouver un objet pour une stat qu'il n'a qu'en malus et obligerait à régénérer `brisage-items.json`.
- **Alternative écartée** : étendre `effectRangesOf` avec un filtre ; plus de risques pour la recherche.

## Décision 3 — Lignes négatives hors des rendements

- **Décision** : l'analyse reçoit `negatives` à part ; elles ne créent ni `RuneYield` ni option de focus.
- **Raison** : la page retrouve les rendements par `effectId`. Une ligne négative et une positive de la même stat se confondraient. Une ligne sans rune n'a de toute façon rien à rendre.

## Décision 4 — Jet par défaut et saisie

- **Décision** : le jet par défaut est `Math.floor((min + max) / 2)` (comme `averageRoll`), la saisie accepte un nombre négatif dans l'étendue. Pour un malus fixe (une seule valeur), le champ reste modifiable comme pour les lignes positives.
- **Raison** : cohérence avec les lignes positives ; l'effet réel est minime puisque le poids est souvent 0.

## Point ouvert (non bloquant)

Aucun relevé en jeu ne confirme la règle. Un relevé futur (focus sur un objet avec un malus, à coefficient connu) pourra la corriger ; la règle est isolée dans `negativeLineWeight`.
