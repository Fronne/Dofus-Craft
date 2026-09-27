# Quickstart: Page Familier

## Générer les données (une fois, puis à chaque mise à jour de la source)

```bash
node scripts/build-pet-xp-data.mjs   # écrit src/data/pet-xp-data.json et résume foods/unmatched
```

Sources : `scripts/data/pet-xp-resources.csv` (onglet « XP COMPLET » de l'Excel) et
`scripts/data/pet-xp-curve.json` (courbe du client). Attendu : 2 100 ressources rattachées sur
2 118 ; les ambiguës (« Carapace … ») et introuvables dans `unmatched`.

## Tests

```bash
pnpm test -- pet-xp familier-page
pnpm test:e2e -- familier-page
```

## Vérification manuelle (`pnpm dev`, page `/familier`)

1. Niveau 0 → 100 : **179 592 XP**.
2. Niveau 50 → 60 : **2 859 XP** ; avec 150 XP déjà gagnés : **2 709 XP**.
3. Cible ≤ actuel : message « aucune XP à donner », pas de liste.
4. Saisir un prix pour « Peau de Rat » (2,646 XP / unité) à 10 kamas, niveau 50 → 60 : ligne avec
   1 081 unités et 10 810 kamas, triée selon son coût parmi les autres.
5. Mode communautaire : les ressources sans prix personnel prennent la médiane communautaire, avec sa
   date ; le nombre de ressources sans prix est affiché.
6. Recharger la page : les niveaux saisis sont retrouvés.
