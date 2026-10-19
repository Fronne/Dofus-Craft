# Research — Page Brisage

1. **Descente du coefficient** : formule de Dorel donnée par le porteur ; la baisse est toujours
   d'au moins 1 point (plancher entier) ; boucle plafonnée (1 000 pas).
2. **Poids de stat** : DofusDB ne publie pas les poids de forgemagie. Table figée dans
   `src/domain/brisage.ts` d'après les valeurs courantes de la communauté, rattachée à
   `src/data/rune-items.json` via `effectId` (même identifiant que les effets d'objet DofusDB). Les
   stats non recoupées par un relevé sont `confirmed: false`.
3. **Taille de rune** : détectée par le préfixe du nom (« Pa », « Ra »), sinon rune simple (Ba) ; les
   runes « Ga » (PA/PM) sont des runes simples.
4. **Focus** : hypothèse H3, indépendante du coefficient. Vérification : cape → 6,05 runes Do.
5. **Prix** : même lecture que `usePetFoodPrices` (carnet + dernier prix communautaire), hook dédié
   `useRunePrices` ; saisie manuelle en mémoire de page.
6. **Stats d'objet** : `getItemDetail` ne renvoie que des libellés ; ajout de `getItemEffectLines`
   (valeurs numériques, `effectId`, valeur max) dans `catalogue-repository.ts`.
