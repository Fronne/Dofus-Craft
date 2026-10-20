# Guide de validation : Prix de l'objet sur la page Brisage

## Prérequis

- Serveur de dev : `npm run dev` (port 5173).
- Un objet avec un prix HDV noté sur Recherche et une recette dont toutes les ressources ont un prix noté.
- Un second objet dont une ressource n'a pas de prix.

## Scénarios

1. **HDV par défaut** : ouvrir `/brisage`, choisir le premier objet → « Prix de l'objet » affiche le prix noté, « Prix HDV » est sélectionné. Identique à avant.
2. **Craft complet** : choisir « Prix de craft » → le montant égale celui de la page Épingles pour le même objet et le même mode de prix ; verdict et cartes se recalculent.
3. **Craft incomplet** : sur le second objet, « Prix de craft » → message « incomplet », aucun total partiel, champ de saisie ; saisir un montant → le verdict l'utilise.
4. **Sans recette** : un objet sans recette, « Prix de craft » → message dédié et saisie.
5. **Mémorisation** : choisir « Prix de craft », recharger le site → choix et session restitués ; une session enregistrée avant la fonctionnalité revient en « Prix HDV ».
6. **Mode de prix** : basculer personnel ↔ communautaire → les deux prix suivent le mode actif.

## Tests automatisés

```bash
npx vitest run tests/unit/item-craft-cost.test.ts tests/unit/brisage-session.test.ts tests/integration/brisage-page.test.tsx
```
