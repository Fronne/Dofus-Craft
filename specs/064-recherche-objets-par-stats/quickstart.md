# Validation : Recherche d'objets par stats ciblées

## Prérequis
`npm install` ; index présent (`src/data/brisage-items.json`). Pour le régénérer : `node scripts/build-brisage-items.mjs` (réseau requis, résumé à relire avant de commiter).

## Tests automatisés
```bash
npx vitest run tests/unit/brisage-search.test.ts tests/unit/brisage-items-repository.test.ts tests/integration/brisage-search.test.tsx
```

## Parcours manuel (serveur de dev)
```bash
npm run dev
```
1. Page Brisage, onglet « Par stats » : invitation, aucune liste.
2. Choisir Prospection : chaque objet listé a un jet de Prospection ; la stat « chasse » n'est pas proposée.
3. Ajouter Vitalité : la liste ne garde que les objets qui portent les deux.
4. Changer le tri (runes / kamas / jet max) et la plage de niveaux : la liste se met à jour.
5. Cliquer un objet : la page Brisage s'ouvre sur lui ; revenir garde la sélection.
6. Retirer le prix d'une rune ciblée : le tri « kamas » classe l'objet en dernier avec « — ».
7. Simuler l'échec de chargement de l'index : message d'indisponibilité, pas de liste partielle.
