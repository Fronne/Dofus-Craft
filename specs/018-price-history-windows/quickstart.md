# Quickstart : valider l'historique par fenêtre

## Automatique

```bash
npm run typecheck
npx vitest run tests/unit/price-history* tests/integration/price-history-popover.test.tsx
npm run test:e2e -- price-history
```

Attendu : tous verts ; les tests couvrent les cas de contracts/price-history-api.md.

## Manuel (serveur de dev + Worker déployé ou `npm run worker:dev`)

1. Mode communautaire, serveur Mikhal, ouvrir un objet dont la ressource a des prix récents.
2. Ouvrir l'historique d'une ressource : « Semaine » est choisi, chaque prix des 7 derniers jours est
   un point ; l'info-bulle montre prix, date et heure.
3. « Jour » : seuls les prix des dernières 24 h ; avec 0 ou 1 prix, pas de courbe et une invitation
   vers « Semaine » ou « Mois » si elles ont au moins 2 prix.
4. « Mois » : tous les prix des 30 derniers jours.
5. Dans l'onglet réseau, la réponse de `/price-history` ne contient ni `deviceId` ni secondes.
6. Mode personnel : aucun bouton d'historique.
