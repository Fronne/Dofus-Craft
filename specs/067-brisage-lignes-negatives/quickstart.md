# Validation rapide : lignes négatives

## Prérequis

```bash
npm install
```

## Tests automatiques

```bash
npm run test
npm run lint
npm run build
```

Résultat attendu : tout passe ; `tests/unit/brisage-negative.test.ts` couvre la règle (voir [data-model.md](data-model.md)).

## Vérification à la main

1. Lancer `npm run dev`, ouvrir la page Brisage.
2. Choisir un objet qui a un malus (ex. un équipement avec une ligne négative de PO ou de Force).
3. Vérifier : la ligne négative apparaît en rouge, avec son jet signé, sans bouton de focus ni rune attendue.
4. Vérifier qu'un objet sans malus donne les mêmes chiffres qu'avant (comparer avec la branche `master`).
5. Régler le jet de la ligne négative dans son étendue : le tableau suit, et aucun total ne baisse à cause du malus.

## Exemple de contrôle

Objet niveau 20, Force −1 : poids de la ligne `0,7`, qui ajoute `0,35` au poids d'un focus sur une autre ligne. Objet niveau 200, Force −10 : poids `0`, aucun effet.
