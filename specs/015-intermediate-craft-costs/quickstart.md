# Quickstart : valider le coût des ressources intermédiaires

## Prérequis

- `npm install`, serveur de dev `npm run dev` (http://localhost:5173), serveur « Mikhal ».
- Objet de référence : **Dagues de Fouraille** (recette 208 : 2 × Planche Agglomérée, 3 × Peau de
  Larve Bleue ; la Planche Agglomérée se crafte avec 10 × Bois de Frêne).

## Scénario 1 — le moins cher est retenu (US1)

1. Mode personnel. Ouvrir les Dagues de Fouraille dans Recherche.
2. Prix : Planche Agglomérée 5 000, Peau de Larve Bleue 100, Bois de Frêne 200.
3. Attendu : la Planche est « Crafté » (Achat : 5 000 · Craft : 2 000) ; coût de craft = 2 × 2 000 +
   3 × 100 = **4 300**.
4. Mettre le Bois de Frêne à 600 → Planche « Acheté » (Craft : 6 000) ; coût = 2 × 5 000 + 300 =
   **10 300**.

## Scénario 2 — dépliage et saisie (US2)

1. Déplier la Planche Agglomérée : une ligne « Bois de Frêne × 20 » apparaît (10 × 2).
2. Modifier son prix : le coût de la recette et le coût de craft se mettent à jour ; la page Prix
   montre le nouveau prix du Bois de Frêne, mais aucun prix pour un « coût de recette ».

## Scénario 3 — forcer (US3)

1. Revenir au Bois de Frêne à 200 (Planche « Crafté »). Forcer « Acheter » sur la Planche.
2. Attendu : « Acheté (ton choix) », coût = **10 300** ; ouvrir un autre objet contenant la Planche : le
   choix forcé s'y applique. Revenir en « Auto » : coût = 4 300.

## Scénario 4 — Suivis = fiche (US4)

1. Suivre les Dagues de Fouraille, ouvrir la page Suivis.
2. Attendu : « Craft : 4 300 », identique à la fiche.

## Tests automatisés

```bash
npx vitest run tests/unit/craft-tree.test.ts tests/unit/ingredient-choices.test.ts \
  tests/integration/intermediate-craft-costs.test.tsx tests/integration/epingles-intermediate-costs.test.tsx
npx vitest run   # non-régression complète
```
