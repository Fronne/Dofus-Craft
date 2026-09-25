# Research: Coût de craft des ressources intermédiaires

## 1. Savoir si un ingrédient se crafte

- **Decision**: utiliser le champ `hasRecipe` que DofusDB renvoie sur chaque objet, y compris sur
  les objets `ingredients` embarqués dans une réponse `/recipes`. Le mapper `mapDofusDbResource`
  le conserve dans un nouveau champ facultatif `Resource.craftable`.
- **Rationale**: vérifié sur l'API réelle le 2026-09-25 : la recette 208 (Dagues de Fouraille)
  renvoie `Planche Agglomérée` avec `hasRecipe: true` et `Peau de Larve Bleue` avec
  `hasRecipe: false`. Aucune requête supplémentaire n'est donc nécessaire pour savoir quels
  ingrédients déplier.
- **Alternatives considered**: interroger `/recipes?resultId=` pour chaque ingrédient (une requête
  inutile par ressource non craftable) ; rejeté sauf en repli (§4).

## 2. Obtenir la recette d'une ressource intermédiaire

- **Decision**: `getResourceRecipe(resourceId)` dans `catalogue-repository`, qui appelle
  `getDofusDbRecipes(resourceId)` (déjà utilisé pour les objets) via `cached('recipes:<id>')` et
  réutilise `mapDofusDbRecipe` / `mapDofusDbResource`. Première recette si plusieurs (même règle
  que `getItemDetail`). Aucune recette ou réponse invalide → `undefined` (ingrédient non craftable
  pour ce calcul, FR-012).
- **Rationale**: même adaptateur, même cache (clé `recipes:<id>` partagée avec `getItemDetail`),
  même traçabilité (principe I). Une réponse `/recipes` contient déjà les objets ingrédients avec
  nom, image et `hasRecipe` : une seule requête par nœud craftable.
- **Alternatives considered**: précharger toutes les recettes du catalogue (milliers d'entrées,
  inutile pour quelques chaînes) ; rejeté.

## 3. Quantité produite par une recette

- **Decision**: une recette produit une unité.
- **Rationale**: les réponses `/recipes` de DofusDB n'exposent aucun champ de quantité produite
  (champs observés : `id, ingredientIds, ingredients, job, jobId, quantities, result, resultId,
  resultLevel, resultName, resultType, resultTypeId, skillId`). Conforme à l'hypothèse de la spec.

## 4. Détails déjà en cache sans `craftable`

- **Decision**: un `Resource` sans `craftable` (détail mis en cache avant cette version par le
  cache « stale-while-revalidate ») est traité comme « à vérifier » : sa recette est demandée ;
  une réponse vide le rend non craftable. `craftable === false` ne déclenche aucune requête.
- **Rationale**: évite d'attendre l'expiration du cache persistant pour que la fonctionnalité
  s'applique, sans jamais supposer à tort qu'une ressource se crafte.

## 5. Chargement progressif et cycles

- **Decision**: hook `useRecipeTree(recipe, resources)` qui maintient une table
  `resourceId → Recipe | null` : à chaque recette reçue, il lance en parallèle les recettes de ses
  ingrédients craftables encore inconnus. Le calcul (`craft-tree.ts`) parcourt l'arbre avec
  l'ensemble des ressources de la branche courante et traite une ressource déjà présente dans la
  branche comme non craftable.
- **Rationale**: FR-013 (le premier niveau n'attend rien) et SC-004 ; la table étant partagée, une
  ressource présente dans plusieurs branches n'est demandée qu'une fois. La détection de cycle est
  dans la fonction pure, donc testée (principe II) ; le chargeur, lui, ne redemande jamais une
  ressource déjà connue, ce qui suffit à le faire terminer.
- **Alternatives considered**: limite de profondeur fixe ; rejetée (la spec demande toute la
  chaîne).

## 6. Où brancher le calcul pour que fiche et Suivis concordent

- **Decision**: `effectiveIngredientPrices(recipe, tree, prices, choices)` renvoie, pour chaque
  ingrédient de premier niveau, un `ResourcePrice` égal à son coût retenu (absent si manquant).
  `compare()` est appelé avec ces prix effectifs. RecherchePage et EpinglesPage appellent la même
  fonction avec les mêmes entrées (carnet du mode actif, arbre, choix forcés).
- **Rationale**: `compare()` et sa recommandation restent tels quels (spec : Hypothèses) ; un seul
  point de calcul évite le décalage déjà corrigé entre les deux pages.
- **Alternatives considered**: rendre `compare()` récursive ; rejeté (élargit une fonction stable et
  très testée pour un besoin qu'un pré-calcul couvre).

## 7. Mode communautaire : sous-ressources non affichées

- **Decision**: extraire la logique déjà présente dans EpinglesPage (médiane communautaire copiée
  dans le carnet pour chaque ressource sans prix) dans `community-gap-fill.ts`, et l'appliquer sur
  la fiche à **toutes** les ressources de l'arbre, pas seulement aux lignes affichées.
- **Rationale**: aujourd'hui la fiche ne pré-remplit une ressource qu'à l'affichage de sa ligne. Des
  sous-ressources repliées resteraient sans prix sur la fiche alors que la page Suivis les
  compléterait : les deux coûts divergeraient (FR-011). Même comportement qu'aujourd'hui (médiane
  enregistrée une fois, jamais par-dessus un prix existant).

## 8. Choix forcés

- **Decision**: `localStorage['craftcheck-ingredient-choices']` = objet `{ [resourceId]: 'buy' |
  'craft' }` ; absence = automatique. Lecture tolérante (JSON invalide ou stockage indisponible →
  aucun choix forcé), écriture silencieusement ignorée si le stockage échoue.
- **Rationale**: réglage personnel par ressource et par appareil (Hypothèses de la spec), même
  approche que les autres préférences (`price-mode-preference`, `design-preference`).
