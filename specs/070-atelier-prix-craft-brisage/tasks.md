---

description: "Liste de tâches : Atelier des prix du craft sur la page Brisage"
---

# Tâches : Atelier des prix du craft sur la page Brisage

**Entrée** : documents de conception dans `specs/070-atelier-prix-craft-brisage/`

**Prérequis** : plan.md, spec.md, research.md, data-model.md, contracts/atelier-prix-ui.md, quickstart.md

**Tests** : demandés par la constitution (principe II) : un calcul de prix change de point d'entrée, il est testé (cas normal, incomplet, prix invalide).

## Format : `[ID] [P?] [Story] Description`

- **[P]** : parallélisable (fichiers différents, pas de dépendance sur une tâche inachevée)
- **[Story]** : histoire concernée (US1 à US4)

## Phase 1 : Fondations (bloque toutes les histoires)

**But** : le recalcul du prix « Craft » à la demande, le bouton dans l'en-tête et la coquille de la fenêtre.

- [ ] T001 Dans `src/features/brisage/useItemCraftCost.ts`, ajouter un paramètre `reloadKey: number` (défaut `0`) à `useItemCraftCost` et l'inclure dans les dépendances de l'effet et dans la clé de l'état chargé, pour relire les carnets quand il change (research.md §5). Sans changement de clé, le comportement actuel est strictement conservé
- [ ] T002 Test `tests/unit/item-craft-cost.test.ts` : le hook relit les carnets quand `reloadKey` augmente (un prix modifié entre les deux lectures change `costKamas`) et ne relit pas quand il reste identique
- [ ] T003 [P] Dans `src/features/brisage/ItemHeader.tsx`, ajouter les props `canEditCraftPrices: boolean` et `onOpenCraftPrices: () => void` et un bouton « Prix du craft » (`type="button"`) dans le bloc « Prix de l'objet », à côté de la ligne Achat / Craft ; absent quand `canEditCraftPrices` est faux, désactivé pendant le calcul (`loading`) (FR-001, FR-012)
- [ ] T004 [P] Créer `src/features/brisage/CraftPricesDialog.tsx` : coquille `<dialog>` ouverte avec `showModal()` (même mécanisme que `src/features/comparison/OutlierConfirmDialog.tsx`), nom accessible « Prix du craft de <objet> », bouton « Fermer », Échap et clic hors de la fenêtre ; props `{ itemId, itemName, serverId, priceMode, onClose }` ; le focus revient au bouton d'ouverture à la fermeture (FR-014, contracts/atelier-prix-ui.md)
- [ ] T005 Dans `src/features/brisage/BrisagePage.tsx`, ajouter l'état `craftPricesOpen` et le compteur `craftReloadKey`, passer `craftReloadKey` à `useItemCraftCost`, brancher `canEditCraftPrices` (faux si `reason === 'no-recipe'`) et `onOpenCraftPrices` sur `ItemHeader`, afficher `CraftPricesDialog` quand ouverte, et incrémenter `craftReloadKey` à sa fermeture (FR-006, FR-015 : ne rien changer d'autre dans la session Brisage)

**Point de contrôle** : `npx vitest run tests/unit/item-craft-cost.test.ts` passe, la page s'affiche et le bouton ouvre puis ferme une fenêtre vide.

## Phase 2 : Histoire 1 — Mettre à jour les prix du craft sans quitter Brisage (P1) 🎯 MVP

**But** : la liste des ressources de premier niveau avec champs de prix, total en direct, recalcul de Brisage à la fermeture.

**Test indépendant** : un objet dont la recette a au moins trois ressources ; modifier un prix dans la fenêtre, fermer, vérifier que le prix « Craft » et le verdict ont changé et que Recherche affiche le même prix.

- [ ] T006 [US1] Dans `src/features/brisage/CraftPricesDialog.tsx`, charger `getItemDetail(itemId)` (recette et ressources) avec un état de chargement et un message d'échec avec bouton « Réessayer », puis `useRecipeTree`, `treeResourceIds` et `useResourcePrices(serverId, ids, resourcePricesFor(priceMode))` (le carnet du mode actif, jamais l'autre) (FR-002, FR-004)
- [ ] T007 [US1] Dans `src/features/brisage/CraftPricesDialog.tsx`, afficher une ligne par ingrédient avec `IngredientRow` et `PriceEntryField` (nom, « × quantité », champ de prix, sous-total, ancienneté), l'état `inputs` fusionné au carnet comme dans `src/features/search/RecherchePage.tsx` (`merged`), et le champ nommé « Prix de <ressource> » (FR-002, FR-010)
- [ ] T008 [US1] Dans `src/features/brisage/CraftPricesDialog.tsx`, calculer le total avec `compare(recipe, effectiveIngredientPrices(recipe, tree, merged, choices))` et l'afficher dans un pied fixe, « Total du craft » ou « Total du craft incomplet » avec la mention des prix manquants, mis à jour pendant la frappe (FR-005, FR-009, FR-011)
- [ ] T009 [US1] Dans `src/features/brisage/CraftPricesDialog.tsx`, à la fermeture (bouton, Échap, clic hors de la fenêtre), enregistrer d'abord le champ en cours (le faire quitter le focus) puis appeler `onClose` ; un prix vide, nul, négatif ou non numérique n'écrit rien et laisse l'ancien prix (contrat « Prix invalide ») (FR-008)
- [ ] T010 [P] [US1] Style de la fenêtre dans `src/styles/global.css` : largeur bornée, liste qui défile, en-tête et pied fixes, champs de 44 px de haut, pleine largeur sous 600 px avec 16 px de marge (FR-013)
- [ ] T011 [US1] Tests d'intégration dans le nouveau `tests/integration/brisage-craft-prices.test.tsx` (mêmes mocks que `tests/integration/brisage-page.test.tsx`) : bouton présent avec recette et absent sans recette ; la fenêtre liste les ressources avec leurs quantités ; modifier un prix change le sous-total et le total pendant la frappe ; à la fermeture le prix « Craft » de l'en-tête est recalculé ; le même prix se retrouve dans le carnet de Recherche ; un prix invalide laisse l'ancien ; prix manquant → total incomplet, sans montant partiel (scénarios 1 à 6 de l'histoire 1, SC-002, SC-005)

**Point de contrôle** : `npx vitest run tests/integration/brisage-craft-prices.test.tsx` passe.

## Phase 3 : Histoire 3 — Ressources des sous-recettes (P1)

**But** : les composants craftables sont dépliés d'emblée, leurs ressources saisissables, le choix acheter ou crafter respecté.

**Test indépendant** : un objet dont un ingrédient est craftable ; modifier le prix d'une ressource de ce composant et vérifier que le total suit, comme sur Recherche pour le même choix.

- [ ] T012 [US3] Dans `src/features/brisage/CraftPricesDialog.tsx`, initialiser `expandedPaths` avec tous les composants craftables de l'arbre (au fil de l'arrivée des recettes de `useRecipeTree`, sans replier ce que le joueur a déjà replié) et passer `expandedPaths`, `onToggle`, `choices` et `onChoose` (`useIngredientChoices`) à `IngredientRow` ; les quantités cumulées viennent d'`IngredientRow` (FR-003)
- [ ] T013 [US3] Vérifier dans `src/features/brisage/CraftPricesDialog.tsx` qu'une ressource présente à plusieurs endroits de la chaîne partage une seule entrée de `inputs` et un seul prix de carnet (les occurrences se mettent à jour ensemble), et que l'état d'un composant « acheté » n'ajoute pas ses sous-ressources au total, avec l'indication du coût retenu fournie par `IngredientRow` (FR-003, FR-011)
- [ ] T014 [US3] Tests d'intégration dans `tests/integration/brisage-craft-prices.test.tsx` : composant craftable déplié avec ses ressources et leurs quantités cumulées ; modifier le prix d'une sous-ressource change le total ; choisir « Acheter » puis « Crafter » change le total comme sur Recherche ; une ressource présente deux fois se met à jour partout ; une sous-ressource sans prix rend le total incomplet (scénarios 1 à 5 de l'histoire 3, SC-003)

**Point de contrôle** : le total de la fenêtre, celui de Recherche et le prix « Craft » de Brisage sont identiques pour les mêmes prix et les mêmes choix.

## Phase 4 : Histoire 2 — Saisie rapide au clavier (P2)

**But** : enchaîner les prix sans souris.

**Test indépendant** : saisir huit prix à la suite uniquement au clavier et vérifier qu'ils sont tous pris en compte.

- [ ] T015 [US2] Dans `src/features/brisage/CraftPricesDialog.tsx`, à l'ouverture, donner le focus au premier champ de prix et sélectionner son contenu ; chaque champ qui prend le focus au clavier sélectionne aussi son contenu (FR-007)
- [ ] T016 [US2] Dans `src/features/brisage/CraftPricesDialog.tsx`, ajouter un `onKeyDown` sur le conteneur de la liste : sur Entrée dans un champ de prix, `preventDefault`, faire quitter le focus au champ (ce qui déclenche l'enregistrement de `PriceEntryField`) puis donner le focus au champ de prix suivant dans l'ordre d'affichage et sélectionner son contenu ; à la dernière ligne, enregistrer et garder le focus (research.md §4). Ne pas modifier `ResourcePriceInput` ni `CommunityResourcePriceRow`
- [ ] T017 [US2] Tests d'intégration dans `tests/integration/brisage-craft-prices.test.tsx` : premier champ actif à l'ouverture ; Entrée enregistre et passe au champ suivant ; Entrée à la dernière ligne garde le focus ; Tab enregistre ; Échap ferme et recalcule ; le focus est piégé dans la fenêtre et revient au bouton à la fermeture (scénarios 1 à 5 de l'histoire 2, SC-004)

**Point de contrôle** : la saisie de toute une recette se fait sans souris.

## Phase 5 : Histoire 4 — Comprendre l'état des prix (P3)

**But** : repérer en un coup d'œil les prix anciens ou absents.

**Test indépendant** : un objet avec des prix anciens et d'autres absents ; vérifier la mention de chaque ligne.

- [ ] T018 [US4] Dans `src/features/brisage/CraftPricesDialog.tsx`, vérifier que chaque ligne montre « Dernière mise à jour : il y a N jours » (fournie par `ResourcePriceInput`) ou « Prix manquant », et mettre en évidence les lignes sans prix (classe de style dans `src/styles/global.css`) ; en mode communautaire, le comportement de `CommunityResourcePriceRow` est conservé tel quel (FR-010)
- [ ] T019 [US4] Tests d'intégration dans `tests/integration/brisage-craft-prices.test.tsx` : ancienneté affichée sur un prix daté ; « Prix manquant » et champ vide sur une ressource sans prix ; la ligne indique une mise à jour récente juste après une saisie ; enregistrer la même valeur ne change pas la date (scénarios 1 à 3 de l'histoire 4)

**Point de contrôle** : `npx vitest run tests/integration/brisage-craft-prices.test.tsx` passe en entier.

## Phase 6 : Finition et vérifications transverses

- [ ] T020 [P] Vérifier sur téléphone (375 px) et en mode communautaire les étapes 9 et 10 de `specs/070-atelier-prix-craft-brisage/quickstart.md` dans le navigateur de dev ; corriger le style dans `src/styles/global.css` si la liste, le total ou « Fermer » sont masqués
- [ ] T021 Lancer `npx vitest run`, `npx tsc -p tsconfig.app.json --noEmit` et `npx eslint src tests` ; seul le test « prix personnalisé… » de `tests/integration/brisage-page.test.tsx`, déjà en échec sur `master`, peut échouer
- [ ] T022 [P] Ajouter une courte mention de l'atelier des prix du craft dans la section Brisage de `README.md`

## Dépendances et ordre d'exécution

- **Phase 1** d'abord : elle bloque tout. T001 puis T002 ; T003 et T004 en parallèle ; T005 après T001, T003 et T004.
- **Phase 2 (US1)** après la phase 1 : T006 → T007 → T008 → T009 dans le même fichier ; T010 en parallèle ; T011 en dernier.
- **Phase 3 (US3)** après T008 (elle étend la même fenêtre) ; **Phase 4 (US2)** après T007 ; ces deux phases touchent `CraftPricesDialog.tsx` et se font l'une après l'autre.
- **Phase 5 (US4)** après T007.
- **Phase 6** en dernier.

## Stratégie d'implémentation

1. **MVP** : phases 1 et 2 — le joueur modifie les prix de premier niveau sans quitter Brisage.
2. Phase 3 : les sous-recettes (aussi P1, à livrer avec le MVP pour que l'atelier couvre le coût réel).
3. Phases 4 et 5 : confort de saisie et lisibilité.
4. Phase 6 : vérification finale, relecture avec le sous-agent `relecteur`, puis proposition de fusion.
