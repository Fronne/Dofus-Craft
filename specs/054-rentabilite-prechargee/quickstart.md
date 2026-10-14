# Quickstart : vérifier la page Rentabilité déjà prête

## Tests automatiques

```bash
npx vitest run tests/unit/craft-profits-cache.test.ts tests/unit/craft-profits-preload.test.ts tests/integration/prices-page.test.tsx
```

Attendu : tous verts, dont les cas « liste gardée affichée sans Calcul en cours », « remplacée par la
liste à jour », « gardée si la mise à jour échoue », « ignorée si trop ancienne ou d'un autre
format », « départ sans attente d'inactivité », « au plus 4 en fond ».

## Vérification manuelle (`npm run dev`)

1. Choisir un serveur, ouvrir **Rentabilité**, attendre la fin du calcul.
2. Recharger la page (F5) en restant sur Rentabilité : la liste apparaît aussitôt avec « Liste du … —
   mise à jour en cours… », puis la mention disparaît quand la liste à jour arrive.
3. Ouvrir le site sur **Recherche**, taper une recherche tout de suite : la saisie reste fluide ;
   après ~10 s, ouvrir **Rentabilité** : liste à jour, sans mention.
4. Changer de mode de prix : la liste gardée de ce mode (ou le calcul) s'affiche, jamais celle de
   l'autre mode.
5. Couper le réseau (outils de développement → Offline), recharger sur Rentabilité en mode
   communautaire : la liste gardée reste, avec « mise à jour impossible pour le moment ».
