# Recherche : Prix de l'objet sur la page Brisage

## D1 – Définition du « prix de craft »

- **Décision** : le coût de la chaîne de craft complète, comme sur la page Épingles (`compare(...)` avec `effectiveIngredientPrices(...)` sur l'arbre de recettes chargé).
- **Justification** : la spec (SC-002) exige le même montant que sur Épingles pour le même objet et le même mode de prix.
- **Alternatives** : ingrédients de premier niveau seulement — rejeté, donne un autre montant qu'Épingles.

## D2 – Où vit le calcul

- **Décision** : nouveau hook `src/features/brisage/useItemCraftCost.ts` qui enchaîne `getItemDetail` → `loadRecipeTree` → carnet de prix (`resourcePricesFor(priceMode)`) → `compare`, avec en mode communautaire la même synchronisation que Épingles (`syncCommunityPrices`). Le résultat est `{ status: 'loading' | 'ready', costKamas?, reason?: 'incomplete' | 'no-recipe' }`.
- **Justification** : le calcul d'Épingles est inline dans un effet de la page ; on ne le réécrit pas ni ne le déplace (principe IV). On réutilise les mêmes fonctions de domaine, donc les mêmes résultats.
- **Alternatives** : extraire une fonction partagée avec Épingles — plus propre mais touche une page hors périmètre ; à reconsidérer seulement si la duplication dépasse une quinzaine de lignes lors de l'implémentation.

## D3 – Prix de craft incomplet ou nul

- **Décision** : `craftCostStatus !== 'complete'` ou objet sans recette → pas de montant (`costKamas` indéfini) avec la raison ; un total ≤ 0 est traité comme indisponible (FR-008).
- **Justification** : constitution I, aucune valeur fabriquée ; même règle que le prix HDV nul aujourd'hui.

## D4 – Mémorisation du choix

- **Décision** : champ `priceSource: 'hdv' | 'craft'` dans `BrisageSession`, lu avec repli sur `'hdv'` (valeur absente ou inconnue).
- **Justification** : une ancienne session se restitue comme avant (FR-007) ; le coefficient et la saisie manuelle sont déjà dans cette session.
- **Alternatives** : mémoriser par objet — rejeté, la spec dit par session.

## D5 – Saisie manuelle

- **Décision** : le champ `manualCost` existant est réutilisé, commun aux deux choix, affiché seulement quand la source choisie n'a pas de montant.
- **Justification** : FR-005 et le cas limite « saisie non perdue en basculant ».

## D6 – Vocabulaire

- **Décision** : « Coût de l'objet » → « Prix de l'objet » dans le champ, l'aide, l'étiquette du champ de saisie et les textes du verdict (« Même le meilleur choix ne couvre pas le prix de l'objet »). Le libellé de tableau « Total de l'objet, coût déduit » devient « … prix déduit ».
- **Justification** : FR-001. Les noms internes (`cost`, `itemCostKamas`) restent, ce sont des noms de code.
