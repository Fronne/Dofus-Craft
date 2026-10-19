# Quickstart — validation

Prérequis : `npm install`.

1. `npm run test -- brisage` : jets moyens (1–50 → 25, 5–10 → 7), mémoire du coefficient, page.
2. `npm run dev`, ouvrir `/brisage` :
   - choisir un objet épinglé avec un prix → coût affiché, aucun champ de niveau ;
   - objet jamais brisé → champ coefficient demandé, aucun résultat ; saisir 50 → résultat affiché ;
   - recharger, resélectionner l'objet → « Dernier coefficient : 50 % (date) » ;
   - modifier un jet → le résultat change ; vider le champ → retour au jet moyen ;
   - le résultat montre verdict, nombre de brisages, coefficient minimal, meilleure option de focus.
3. `npm run lint && npm run build`.
