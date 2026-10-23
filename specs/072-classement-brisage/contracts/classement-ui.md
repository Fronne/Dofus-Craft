# Contrat d'interface : onglet Classement

## Accès

- Sans l'indicateur d'accès (`craftcheck-brisage-ranking = '1'`), la page Brisage ne montre ni l'onglet ni le contenu, et aucun calcul du classement n'est lancé.
- Ouvrir `/brisage?classement=1` active l'indicateur, puis retire le paramètre de l'adresse ; `?classement=0` le retire.
- Avec l'indicateur, la page affiche un sélecteur à deux onglets : **Fiche** (comportement actuel, par défaut) et **Classement**.

## Tableau

| Colonne | Contenu | Triable |
|---------|---------|---------|
| Objet | image, nom | oui |
| Niveau | nombre | oui |
| Prix | prix HDV retenu, source (personnel ou communautaire selon le mode), ancienneté | oui |
| Meilleur choix | « Sans focus » ou « Focus <rune> » | non |
| Gain | gain par objet (groupe connu) ou « — » | oui |
| Coefficient | valeur et ancienneté, ou « coefficient inconnu » | non |
| Seuil | coefficient de rentabilité du meilleur choix, ou « jamais rentable » | oui |
| Gain avec exo | gain avec le meilleur exo, stat de l'exo, apport ; note « une rune déduite » ; groupe sans coefficient : seuil recalculé avec le prix de la rune ajouté au prix de l'objet | oui |
| Runes | ancienneté de la rune la plus ancienne | non |

- En-tête triable : bouton avec `aria-sort` (`ascending`, `descending`, `none`) ; un clic bascule le sens.
- Deux groupes dans la liste : « Coefficient connu » (gain en kamas) puis « Coefficient inconnu » (par seuil croissant), chacun avec son titre.
- Valeurs inconnues toujours en fin de groupe.
- Une donnée au-delà du seuil de péremption est mise en évidence (texte et icône, pas seulement la couleur).
- Avertissement d'estimation en tête, identique à celui de la fiche.

## Filtres

Niveau min / max, catégorie, gain minimum, cases « Masquer les objets sans prix » (cochée par défaut) et « Masquer les objets sans coefficient », bouton « Réinitialiser les filtres ». Un niveau min supérieur au max affiche un message et ne filtre pas.

## Interactions

- Clic ou Entrée sur une ligne : ouvre l'objet dans l'onglet Fiche (`openItem`), le tri et les filtres restent en mémoire.
- Aucun résultat : message et bouton de réinitialisation.
- Chargement : état « Calcul du classement… » ; échec partiel (prix communautaires, coefficients partagés indisponibles) : bandeau « Classement incomplet : … » et le reste s'affiche.

## Accessibilité

Tableau sémantique (`caption` masquée, `th scope`), lignes cliquables atteignables au clavier, états annoncés par `role="status"`.
