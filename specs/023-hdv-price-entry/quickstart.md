# Quickstart: Page Saisie HDV

## Prérequis

- `scripts/data/hdv-type-map.json` conforme au tableau validé de [research.md §2](./research.md).
- Données générées : `node scripts/build-hdv-items.mjs`, puis relire le résumé affiché (objets par
  HDV, types écartés) avant de commiter `src/data/hdv-items.json`.
- Serveur de dev : `npm run dev`, puis http://localhost:5173/hdv.

## Scénarios de validation

1. **Navigation** : l'entrée « HDV » apparaît entre Prix et Familier (ordinateur et barre du bas sur
   mobile) ; l'entrée Accueil a disparu ; http://localhost:5173/accueil ouvre la Recherche.
2. **Onglets** : Ressources ≈ 2 750 objets, Consommables ≈ 130, Animaux ≈ 36 (dont les 35
   nourritures pour familier). Aucun certificat de dragodinde nulle part. Recharger la page rouvre
   le dernier onglet.
3. **Saisie (mode personnel)** : onglet Animaux, saisir 1 500 pour « Croquette enrichie », quitter le
   champ → « Dernière mise à jour : à l'instant ». Recharger → le prix est toujours là.
4. **Même prix partout** : saisir un prix pour un consommable ingrédient d'une recette, ouvrir cette
   recette sur la Recherche → même prix et même date. Modifier le prix sur la Recherche, revenir sur
   HDV → prix modifié.
5. **Familier** : avec le prix de « Croquette enrichie » saisi, la page Familier la propose dans ses
   ressources.
6. **Mode communautaire** : même verrou, même confirmation d'un prix inhabituel, même bouton
   d'historique que sur la Recherche.
7. **Filtres** : taper « pot » dans Consommables, choisir un type, activer « Sans prix » puis
   « Prix ancien » ; le décompte « N objets sur M ont un prix » ne change pas avec les filtres.
8. **Changement de serveur ou de mode** : les prix affichés et le décompte suivent immédiatement.

## Tests automatisés

```bash
npx vitest run tests/unit/hdv-domain.test.ts tests/unit/hdv-items-data.test.ts tests/integration/hdv-page.test.tsx
npx playwright test tests/e2e/hdv-price-entry.spec.ts
npm run typecheck && npm run lint
```
