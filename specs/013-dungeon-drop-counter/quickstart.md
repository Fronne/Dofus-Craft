# Quickstart : valider la bulle « donjons sans drop »

## Automatique

```bash
npm test && npm run typecheck && npm run lint
npx playwright test --project=desktop
```

## Manuel

1. Sur chaque page, le portrait du Féca et son badge sont en bas à droite ; sur 375 px, au-dessus
   de la barre d'onglets, sans la chevaucher (FR-001, FR-012).
2. Clic : pseudo, nombre, « Parangon de puissance » et son icône (FR-003). Échap, clic extérieur et
   « Fermer » referment (FR-004). Aucune commande de modification (FR-006).
3. Changer `DUNGEONS_WITHOUT_DROP`, recharger : le nouveau chiffre s'affiche (US2).
4. Designs « Classique » et « Nouveau », thèmes clair et sombre (FR-013).
