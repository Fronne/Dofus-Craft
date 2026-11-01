# Quickstart: Calcul des bons plans selon la valeur de marché

## Tests

```bash
npx vitest run tests/unit/good-deals.test.ts tests/integration/bons-plans-page.test.tsx
```

Attendu : tous les tests passent, y compris les limites (poids 29 et 30, écart exact, maximum de Dommages Critiques à 20 et 21).

## Sur le site

1. Lancer `npm run dev`, ouvrir la page Bons plans sur Mikhal.
2. Chercher Capchalot : les exemplaires exo 1 % Dommages aux sorts à −78 % ou −84 % ne sont plus là.
3. Le nombre de bons plans tourne autour de 109 sur l'instantané du 2026-11-01. Il varie avec les annonces du moment.

## Non-régression

Les résultats de la page Brisage ne changent pas : `src/domain/brisage.ts` n'est pas modifié.
