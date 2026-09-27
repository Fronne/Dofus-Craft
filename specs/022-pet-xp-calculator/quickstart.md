# Quickstart: Page Familier

## Générer les données (une fois, puis à chaque mise à jour de la source)

```bash
node scripts/build-pet-xp-data.mjs   # écrit src/data/pet-xp-data.json et résume foods/unmatched
```

Attendu : ~830 ressources rattachées ; les ambiguës (« Carapace … ») et introuvables dans `unmatched`.

## Tests

```bash
pnpm test -- pet-xp familier-page
pnpm test:e2e -- familier-page
```

## Vérification manuelle (`pnpm dev`, page `/familier`)

1. Niveau 1 → 100 : **196 158 XP**.
2. Niveau 50 → 60 : **3 141 XP** ; avec 200 XP déjà gagnés : **2 941 XP**.
3. Cible ≤ actuel : message « aucune XP à donner », pas de liste.
4. Saisir un prix pour « Peau de Rat » (1 XP / unité) à 10 kamas, niveau 50 → 60 : ligne avec
   3 141 unités et 31 410 kamas, triée selon son coût parmi les autres.
5. Mode communautaire : les ressources sans prix personnel prennent la médiane communautaire, avec sa
   date ; le nombre de ressources sans prix est affiché.
6. Recharger la page : les niveaux saisis sont retrouvés.
