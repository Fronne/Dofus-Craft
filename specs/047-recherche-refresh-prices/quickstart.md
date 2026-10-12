# Quickstart: vérifier le bouton « Actualiser les prix »

Prérequis : Node 22.

```bash
export PATH="/c/Users/Cyril/AppData/Roaming/nvm/v22.23.3:$PATH"
```

## Tests automatiques

```bash
npx vitest run tests/unit/recipe-refresh.test.ts tests/unit/community-price-api.test.ts tests/integration/recherche-refresh-prices.test.tsx
npx tsc -b --noEmit
npx eslint src tests --quiet
npx vitest run
```

Attendu : tout passe ; le nombre total de tests augmente par rapport à la référence ci-dessous.

## Vérification à l'écran (site local)

1. Lancer le site local (configuration `dofus-craft`, port 5173), choisir Mikhal, Mode communautaire.
2. Page Recherche, choisir un objet avec recette : le bouton « Actualiser les prix » est à droite du titre
   « Prix des ressources ».
3. Passer en Mode personnel (Paramètres) : le bouton a disparu.
4. Le clic lui-même déclenche une vraie lecture chez Huzounet par l'API de production : ne le faire
   qu'une fois, sur un objet, pour voir le message ; un second clic dans les deux minutes doit répondre
   « Les prix sont déjà à jour. ».

Les contrats détaillés sont dans [contracts/recherche-refresh-ui.md](./contracts/recherche-refresh-ui.md).

## Résultats

- Référence avant modification (branche `master`, 12 octobre 2026) : 1 030 tests passent.
- Après la fonctionnalité : 1 062 tests passent (32 de plus : règles, client de l'API et 13 tests de la
  page). Dans une exécution complète, deux tests de page (Familier « 25 premières lignes », HDV « dernier
  prix partagé ») échouent parfois sous la charge ; ils passent seuls, et ne touchent pas cette page.
- `npx tsc -b --noEmit` et `npx eslint src tests --quiet` : sans erreur.
- À l'écran (site local, Mikhal, Mode communautaire) : bouton à droite du titre, mention « · relevé
  ancien » après la date d'un prix Huzounet ancien. Le bouton n'a pas été cliqué (lecture réelle chez
  Huzounet).
