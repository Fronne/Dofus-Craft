# Quickstart: valider le design « Cosmos »

## Prérequis

`npm ci`, puis `npm run dev`.

## Vérifications automatiques

```bash
npm run typecheck
npm run lint
npm test
```

Attendu : tous les tests passent, dont `design-cosmos-css-scope`, `design-preference` et
`design-setting` (choix Cosmos).

## Parcours manuel

1. Paramètres → Design → **Cosmos** : l'application change d'allure sans rechargement.
2. Recharger : Cosmos reste appliqué dès l'affichage.
3. Recherche sur un écran ≥ 1200 px : résultats, fiche et ressources côte à côte ; chaque liste
   défile seule ; aucun vide au milieu.
4. Mobile (390 px) : fenêtres empilées, barre d'onglets inchangée, aucun défilement horizontal.
5. Thème clair puis sombre, et chaque couleur principale : tout reste lisible.
6. Parcourir Accueil, Suivis, Rentabilité, HDV, XP Familier, Forgemagie, visite guidée, dialogue de
   prix inhabituel, historique des prix, compteur de donjon : tout fonctionne comme avant.
7. Revenir en **Nouveau** puis **Classique** : identiques à avant.
