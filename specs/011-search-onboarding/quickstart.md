# Quickstart : valider l'onboarding de la page Recherche

## Prérequis

- `npm install`, puis `npm run dev`.
- Un serveur déjà choisi (sinon l'écran de choix du serveur s'affiche avant la page Recherche).

## Tests automatisés

```bash
npm test          # unitaires + intégration (Vitest)
npm run typecheck
npm run lint
```

## Scénarios manuels

1. **Première visite (US1, FR-001)** : dans les outils du navigateur, supprimer la clé
   `craftcheck-search-tour-seen` du `localStorage`, recharger la page Recherche.
   Attendu : la visite démarre à « 1 / 6 », la zone de recherche est en surbrillance.
2. **Sans objet sélectionné (FR-008)** : cliquer sur « Suivant » jusqu'à l'étape 3.
   Attendu : bulle centrée, pas de surbrillance, mention « apparaît après avoir choisi un objet ».
3. **Avec un objet sélectionné** : fermer, choisir un objet craftable, relancer via le bouton d'aide.
   Attendu : les étapes 2 à 5 mettent en surbrillance la fiche, les prix des ressources, le prix HDV
   et la recommandation ; la page défile jusqu'à chaque zone.
4. **Fermeture (US1, SC-003)** : cliquer sur « Passer » à l'étape 2, recharger.
   Attendu : la visite ne revient pas. Même résultat avec Échap et avec « Terminer ».
5. **Relance (US2, FR-007)** : cliquer sur le bouton d'aide. Attendu : retour à « 1 / 6 ».
6. **Aucune modification (FR-009, SC-004)** : noter les prix affichés, parcourir toute la visite.
   Attendu : prix, prix HDV et recherche identiques ; aucune requête vers l'API communautaire
   pendant la visite (onglet Réseau).
7. **Téléphone (FR-011)** : largeur 375 px. Attendu : bulle en bas de l'écran, lisible, sans
   défilement horizontal, boutons accessibles.
8. **Clavier (FR-011)** : Tab circule dans les boutons de la bulle uniquement ; Entrée active
   « Suivant ».
