# Guide de validation : Exos sur la page Brisage

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

Fichiers visés : `tests/unit/brisage-exo.test.ts`, `tests/unit/brisage-exos-persistence.test.ts`, `tests/integration/brisage-page.test.tsx`.

## Parcours manuel

Lancer `npm run dev`, ouvrir la page Brisage.

1. Choisir un objet, saisir un coefficient, noter le gain affiché.
2. « Ajouter un exo » : Force, valeur 5. Une ligne « exo » apparaît ; le gain augmente de la valeur des runes de Force (voir [data-model.md](data-model.md)).
3. Ajouter un second exo (Dommages aux sorts %, 1) : les deux lignes coexistent.
4. Saisir 150 pour une stat de poids 1 : refusé avec « maximum 101 ». Choisir PA : maximum 1.
5. Vérifier que la ligne exo n'a pas de focus et n'est jamais « Meilleur focus ».
6. Une stat que l'objet a déjà n'est pas dans la liste des exos ; saisir un jet au-dessus du maximum de la ligne : accepté, signalé « over ».
7. Recharger la page, rouvrir le même objet : les exos sont restaurés. Changer d'objet : exos différents.
8. Retirer un exo : les totaux reviennent à leur valeur d'avant.
9. Vider le coefficient : le conseil de focus tient compte des exos.
