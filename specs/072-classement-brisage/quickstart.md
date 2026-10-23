# Guide de validation : Classement de brisage

## Prérequis

- Dépendances installées (`npm install`), serveur de développement via `npm run dev` (adresse annoncée dans le terminal).
- Un serveur de jeu actif avec quelques prix d'objets notés sur la page Recherche et quelques prix de runes notés.

## Tests automatiques

```bash
npm run test -- brisage-ranking
```

Doit passer : calcul d'une ligne identique à la fiche, tri, filtres, fraîcheur, exo, accès.

## Scénarios manuels

1. **Accès fermé** : dans un navigateur vierge, ouvrir la page Brisage. Aucun onglet Classement ; `/brisage?classement=1` n'est pas encore pris en compte (voir 2).
2. **Activation** : ouvrir `/brisage?classement=1`. L'onglet apparaît, le paramètre disparaît de l'adresse, un rechargement garde l'onglet. `?classement=0` le retire.
3. **Classement** : l'onglet liste les objets au prix connu du plus rentable au moins rentable ; comparer le gain d'un objet sans ligne négative avec le verdict de sa fiche (même chiffre).
4. **Tri** : cliquer sur « Niveau » puis de nouveau : ordre inversé et `aria-sort` mis à jour ; les valeurs inconnues restent à la fin.
5. **Coefficient inconnu** : un objet sans coefficient est dans le groupe « Coefficient inconnu », classé par seuil ; un seuil au-dessus de 100 % affiche « jamais rentable ».
6. **Exo** : pour un objet dont une rune absente est chère, la colonne « Gain avec exo » nomme la stat et l'apport ; sans prix de rune, aucun exo n'est proposé.
7. **Filtres** : gain minimum, niveau, catégorie, masquages ; combinaison sans résultat = message et réinitialisation.
8. **Retour de fiche** : cliquer une ligne ouvre la fiche ; revenir à Classement garde tri et filtres.

## Exemple chiffré de contrôle

Un objet de niveau 100 au prix de 50 000 k, coefficient 80 %, dont le brisage normal rapporte 60 000 k de runes à 100 % :
- À 80 %, les runes valent 48 000 k, soit un gain de −2 000 k ; le classement l'affiche comme une perte, comme la fiche.
- Seuil de rentabilité : 50 000 ÷ 60 000 = 83,3 % ; l'objet exigerait donc un coefficient d'au moins 83,3 %.
- Sans coefficient connu, la ligne montre ce seuil de 83,3 % et aucun gain en kamas ; s'il passait au-dessus de 100 %, elle indiquerait « jamais rentable ».
- Avec un exo dont la rune coûte 3 000 k, le seuil sans coefficient se recalcule sur un prix de 53 000 k : 53 000 ÷ 60 000 = 88,3 % (en supposant, pour l'exemple, que l'exo ne change pas la valeur des runes obtenues).

Ces chiffres sont des valeurs d'exemple ; les comparer au calcul de la fiche objet avec les mêmes entrées.

## Mesure de SC-001

Chronométrer, après l'ouverture de l'onglet, le temps pour lire les 10 premiers objets : il doit rester sous 10 secondes.

## Contrats et modèle

Voir [contracts/classement-ui.md](contracts/classement-ui.md) et [data-model.md](data-model.md).
