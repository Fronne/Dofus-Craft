# Recherche : Code du site facilement maintenable

## Décision 1 — Gestionnaire de paquets : npm

- **Décision** : garder npm ; supprimer `pnpm-lock.yaml` et `pnpm-workspace.yaml`.
- **Raison** : le README ne documente que `npm install` et `npm run …`, tous les scripts de `package.json` passent par npm, aucun fichier de déploiement ne cite pnpm. `pnpm-workspace.yaml` ne contient que `allowBuilds: esbuild`, propre à pnpm.
- **Alternatives** : garder pnpm (réécrire README et habitudes) ; garder les deux (cause du problème).

## Décision 2 — Découpage du CSS

- **Décision** : `global.css` devient une liste d'`@import` vers des fichiers qui sont des tranches contiguës de l'ancien fichier, dans le même ordre. `theme.css` et `comparison.css` restent inchangés.
- **Raison** : des règles en écrasent d'autres (la section « Site style », à partir de la ligne 2021, reprend des sélecteurs des sections précédentes ; Panels, Search et Dungeon counter existent en version de base puis en surcharge). Garder l'ordre garantit le même rendu ; réordonner par fonctionnalité risquerait de changer la cascade.
- **Alternatives** : modules CSS par composant (change les sélecteurs, trop invasif) ; réordonnance par fonctionnalité (risque de régression visuelle).
- **Contrôle** : comparaison du CSS compilé avant/après, plus tests e2e.

## Décision 3 — Découpage des modules TypeScript

- **Décision** : chaque gros fichier devient un dossier avec un point d'entrée qui réexporte l'API actuelle ; les fonctions sont déplacées par sujet sans être réécrites.
- **Raison** : aucun changement pour les appelants et les tests ; le diff se lit comme un déplacement.
- **Alternatives** : modifier les imports partout (gros diff sans bénéfice).

## Décision 4 — Découpage des composants

- **Décision** : extraire d'abord état et effets dans des hooks `use<Nom>`, puis les blocs d'affichage dans des sous-composants du même dossier ; la page garde l'assemblage. Props visibles, classes CSS et textes inchangés.
- **Raison** : les tests d'intégration interrogent le rendu final (rôles, textes), pas la structure interne.
- **Alternatives** : bibliothèque d'état global (interdit par la constitution IV : pas d'abstraction non demandée).

## Décision 5 — Filet de sécurité

- **Décision** : tests existants + `typecheck` + `lint` après chaque étape ; pas de nouveau test de comportement, sauf pour une fonction extraite qui n'était couverte que via un composant.
- **Raison** : le comportement ne change pas ; les règles sont seulement déplacées.
