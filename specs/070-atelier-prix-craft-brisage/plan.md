# Plan d'implémentation : Atelier des prix du craft sur la page Brisage

**Branche** : `070-atelier-prix-craft-brisage` | **Date** : 2026-10-22 | **Spec** : [spec.md](spec.md)

**Constitution** : I (aucun prix inventé, ressource sans prix signalée), II (total du craft testé : normal,
incomplet, sous-recette, prix invalide), III (prix saisis distingués des totaux calculés, choix « acheter ou
crafter » visible), IV (changement cohésif : une fenêtre qui réutilise les briques de Recherche, aucune
refonte), V (aucune donnée nouvelle conservée : les prix vont dans les carnets existants).

## Résumé

Sur `BrisagePage`, l'en-tête de l'objet (`ItemHeader`) reçoit un bouton **« Prix du craft »**. Il ouvre une
fenêtre `<dialog>` (`CraftPricesDialog`) qui montre la chaîne de craft de l'objet **entièrement dépliée** :
une ligne par ressource, sous-recettes comprises, avec la quantité cumulée et le champ de prix.

La fenêtre **réutilise** ce que la page Recherche utilise déjà, sans le dupliquer : `useRecipeTree`
(arbre de recettes), `useResourcePrices` + `resourcePricesFor(priceMode)` (carnet du mode actif),
`IngredientRow` (lignes dépliées, choix Auto/Acheter/Crafter), `PriceEntryField` (champ de prix,
enregistrement, partage communautaire, confirmation des prix aberrants) et `compare` /
`effectiveIngredientPrices` (total). Un prix saisi ici est donc le même que sur Recherche et Épingles.

À la fermeture, `useItemCraftCost` relit les carnets (nouveau paramètre `reloadKey`) : le prix « Craft »,
le verdict, les gains et les cartes de Brisage se recalculent. Les formules de `src/domain/brisage.ts` et
`src/domain/craft-tree.ts` ne changent pas.

## Technical Context

**Langage** : TypeScript, React/Vite · **Tests** : vitest (unit + integration), Playwright existant non
concerné · **Stockage** : carnets de prix existants (IndexedDB, mode personnel et mode communautaire) et
partage communautaire existant ; aucune nouvelle table, aucun nouveau champ · **Plateforme** : site web,
ordinateur et téléphone · **Dépendances** : aucune nouvelle · **Contraintes** : jamais de prix inventé ;
fenêtre utilisable sur petit écran et au clavier · **Échelle** : une recette compte en général moins de
vingt lignes, sous-recettes comprises.

## Contrôle de la constitution

| Principe | Verdict | Note |
|---|---|---|
| I. Données traçables | OK | Les prix viennent des carnets existants ; la date de mise à jour de chaque ligne est affichée comme sur Recherche. |
| II. Calcul testé | OK | Total et incomplet viennent de `compare` / `effectiveIngredientPrices` déjà testés ; tests ajoutés pour le recalcul à la fermeture, la sous-recette et le prix invalide. |
| III. Explicable | OK | Chaque ligne montre quantité, prix saisi, sous-total ; le choix acheter/crafter d'un composant reste visible. |
| IV. Petit changement | OK | Une fenêtre et un bouton ; réutilisation des composants de Recherche ; `useItemCraftCost` gagne un paramètre. |
| V. Données utilisateur | OK | Aucune donnée nouvelle ; rien n'est écrit sans saisie de l'utilisateur. |

Re-contrôle après conception : inchangé, aucune violation à justifier.

## Structure du projet

### Documentation

```text
specs/070-atelier-prix-craft-brisage/
├── plan.md           # ce fichier
├── research.md       # décisions et alternatives écartées
├── data-model.md     # entités de la fenêtre et état local
├── quickstart.md     # parcours de validation
├── contracts/
│   └── atelier-prix-ui.md   # contrat d'interface de la fenêtre
└── tasks.md          # produit par /speckit-tasks
```

### Code source

```text
src/features/brisage/CraftPricesDialog.tsx   NEW  fenêtre <dialog> : chaîne dépliée, champs de prix, total en direct, clavier
src/features/brisage/ItemHeader.tsx          + bouton « Prix du craft » (absent sans recette)
src/features/brisage/BrisagePage.tsx         état d'ouverture, rendu de la fenêtre, bascule du recalcul à la fermeture
src/features/brisage/useItemCraftCost.ts     + paramètre reloadKey : relit les carnets quand il change
src/styles/global.css                        style de la fenêtre (liste défilante, total fixe, petit écran)
tests/unit/item-craft-cost.test.ts           + recalcul quand reloadKey change
tests/integration/brisage-craft-prices.test.tsx  NEW  ouverture, saisie, sous-recette, clavier, fermeture, recalcul
```

**Structure Decision** : projet web unique existant ; aucune nouvelle dépendance. La fenêtre vit dans
`src/features/brisage/` ; les composants partagés de `src/features/comparison/` et `src/features/search/`
sont importés tels quels, sans être modifiés.

## Parcours de la page

1. Objet choisi, recette connue → le bouton « Prix du craft » apparaît dans l'en-tête, à côté du prix « Craft ». Sans recette, il est absent.
2. Clic → la fenêtre s'ouvre ; le premier champ de prix est actif, son contenu sélectionné.
3. Chaque ligne : nom, × quantité cumulée, prix unitaire, sous-total ; les composants craftables sont dépliés avec leur choix Auto / Acheter / Crafter.
4. Saisie : Entrée enregistre et passe au champ suivant ; Tab et clic ailleurs enregistrent aussi ; le total se met à jour pendant la frappe.
5. Fermeture (bouton, Échap ou clic hors de la fenêtre) → `reloadKey` change, le prix « Craft » et tout ce qui en dépend se recalculent ; le focus revient au bouton.
