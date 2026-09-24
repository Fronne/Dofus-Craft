# Quickstart : valider le nouveau design

## Automatique

```bash
npm test && npm run typecheck && npm run lint
npx playwright test --project=desktop
```

## Manuel (serveur de dev, http://localhost:5173)

1. Paramètres → Design → « Nouveau » : toute l'app change sans rechargement (FR-002).
2. Parcourir Accueil, Recherche (visite guidée avec le bouton ⓘ, saisie de prix, confirmation de
   prix inhabituel), Épinglés (collections), Prix, Paramètres, changement de serveur : tout
   fonctionne comme avant (FR-007, SC-003).
3. Thème clair et sombre, chacune des 5 couleurs d'accent : lisible partout (FR-008).
4. Largeur 375 px : aucun défilement horizontal (SC-004).
5. Recharger la page : le design « Nouveau » s'affiche d'emblée, sans passage par l'ancien
   (FR-003). Vider le `localStorage` : l'écran de choix du serveur est en « Classique » (FR-004).
6. Revenir en « Classique » : comparer à des captures prises avant la fonctionnalité, identiques
   (FR-005, SC-002).
7. Système réglé sur « réduire les animations » : aucune animation (FR-010).
