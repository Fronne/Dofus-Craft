# Recherche : Atelier des prix du craft sur la page Brisage

Aucune inconnue technique ne bloquait la conception. Les décisions ci-dessous fixent comment la fenêtre
s'appuie sur l'existant.

## 1. Réutiliser les composants de Recherche plutôt que refaire un champ de prix

**Décision** : la fenêtre rend chaque ligne avec `IngredientRow` et `PriceEntryField`, comme `RecherchePage`.

**Justification** : `PriceEntryField` porte déjà toutes les règles voulues par la spec (FR-004, FR-008, FR-010) : écriture dans le carnet du mode actif, partage communautaire, confirmation des prix très éloignés, ancienneté du prix, enregistrement seulement si la valeur a changé. `IngredientRow` porte le dépliage des sous-recettes et le choix Auto / Acheter / Crafter (FR-003). Un prix saisi dans l'atelier est ainsi le même que sur Recherche et Épingles (SC-002) sans code de synchronisation.

**Alternatives écartées** :
- Écrire un champ de prix propre à l'atelier : duplique les règles de partage et de confirmation, risque de dérive entre pages.
- Afficher la page Recherche dans une fenêtre intégrée : charge toute la page (recherche, filtres, visite guidée) pour n'en utiliser qu'un panneau.

## 2. Calcul du total : `compare` et `effectiveIngredientPrices`

**Décision** : le total de la fenêtre est calculé comme sur Recherche : `compare(recipe, effectiveIngredientPrices(recipe, tree, prix, choix))`, avec les prix en cours de saisie fusionnés aux prix du carnet.

**Justification** : le même calcul que `useItemCraftCost` et que Recherche garantit que le total de la fenêtre, celui de Recherche et le prix « Craft » de Brisage sont identiques pour les mêmes prix (SC-003). L'état « incomplet » (FR-009) vient du même code.

**Alternatives écartées** : recalculer le total à la main dans la fenêtre — duplique la règle « le moins cher entre acheter et crafter » et ses cas limites (cycles, choix forcés).

## 3. Fenêtre : l'élément `<dialog>` natif

**Décision** : `<dialog>` avec `showModal()`, comme `OutlierConfirmDialog` (aucun composant modal partagé n'existe dans le projet).

**Justification** : le navigateur fournit le piégeage du focus, Échap, l'inertie du reste de la page et le rôle accessible (FR-014). `src/test/setup.ts` gère déjà `showModal` dans jsdom pour les tests. Le focus est rendu au bouton d'ouverture à la fermeture.

**Alternatives écartées** : panneau maison (comme `PriceHistoryButton`) — demande de réécrire piégeage du focus et fermeture ; panneau latéral fixe — moins adapté à la saisie rapide sur petit écran.

## 4. Entrée passe à la ligne suivante, sans modifier les champs partagés

**Décision** : un seul gestionnaire `onKeyDown` sur le conteneur de la liste : sur Entrée dans un champ de prix, le champ perd le focus (ce qui déclenche l'enregistrement habituel de `PriceEntryField`), puis le champ de prix suivant de la liste prend le focus et son contenu est sélectionné. Les champs de prix sont retrouvés dans la fenêtre par leur ordre d'affichage.

**Justification** : `RunePriceInput` fait déjà « Entrée = perdre le focus » ; ce gestionnaire étend ce geste sans toucher `ResourcePriceInput` ni `CommunityResourcePriceRow` (principe IV). Dans la dernière ligne, Entrée enregistre et garde le focus.

**Alternatives écartées** : ajouter une propriété « onEnter » aux champs partagés — touche Recherche et la page HDV pour un besoin propre à l'atelier.

## 5. Recalcul à la fermeture : une clé de rechargement

**Décision** : `useItemCraftCost` reçoit un paramètre `reloadKey` qui entre dans les dépendances de son effet ; `BrisagePage` l'incrémente à la fermeture de la fenêtre.

**Justification** : `useItemCraftCost` lit les carnets une seule fois par objet, serveur et mode ; sans clé, il ne verrait pas les prix modifiés dans la fenêtre. Une clé garde le hook simple, sans abonnement aux carnets. Les prix étant enregistrés au fil de la saisie, la relecture à la fermeture les retrouve tous.

**Alternatives écartées** : faire remonter les prix saisis par une fonction de rappel — duplique l'état des prix ; abonner le hook aux écritures des carnets — nouveau mécanisme pour un seul cas.

## 6. Bouton absent sans recette

**Décision** : le bouton n'est affiché que si `useItemCraftCost` ne répond pas `no-recipe`. Pendant le chargement (`loading`), il est affiché désactivé ; en cas d'échec de chargement, la fenêtre propose de réessayer.

**Justification** : FR-012 interdit une fenêtre vide ; l'état `no-recipe` existe déjà (spec 062).

## 7. Sous-recettes dépliées d'emblée, longues listes

**Décision** : `expandedPaths` contient tous les composants craftables à l'ouverture ; la liste défile dans la fenêtre, l'en-tête et le total restent visibles.

**Justification** : le joueur veut tout saisir d'un coup (US3) ; les lignes restent repliables avec le bouton déjà fourni par `IngredientRow`. Une seule colonne et des champs de 44 px de haut pour le téléphone (FR-013, SC-006).
