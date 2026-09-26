# Research: Page Prix — bénéfice de craft par objet

## §1 Objets candidats en Mode communautaire

- **Décision** : nouvelle route `GET /item-prices?serverId=` qui renvoie, pour chaque objet ayant au
  moins une contribution `kind = 'item'` sur le serveur, sa contribution la plus récente
  (`amountKamas`, `contributedAt`), en une requête SQL (`GROUP BY resource_id` avec `MAX(created_at)`).
- **Raison** : aujourd'hui `/latest-price` ne se lit qu'objet par objet, et l'application ne sait pas
  quels objets ont un prix partagé. La règle reste celle de specs/016 (dernier prix, sans limite
  d'âge ; la purge garde la plus récente de chaque objet).
- **Alternatives** : interroger `/latest-price` pour tous les objets craftables du catalogue —
  des milliers de requêtes ; stocker une liste côté application — pas partagée entre joueurs.

## §2 Prix des ressources

- **Décision** : comme les pages Recherche et Suivis — carnet du mode actif
  (`resourcePricesFor(priceMode)`), et en Mode communautaire `fillCommunityGaps` sur toutes les
  ressources des arbres de recettes des candidats (écrit les médianes manquantes dans le carnet
  communautaire).
- **Raison** : SC-001 exige les mêmes chiffres que Recherche ; c'est exactement son chemin.
- **Alternatives** : route groupée de médianes — plus rapide, mais un second chemin de prix à garder
  cohérent ; à reconsidérer si le nombre de requêtes gêne (volume attendu : quelques centaines au
  plus, une fois par ressource puis en carnet).

## §3 Prix HDV en Mode personnel

- **Décision** : `pinnedItemPrices.listAllForServer(serverId)` (prix HDV saisis, avec `updatedAt`),
  comme l'ancienne page.

## §4 Calcul « Auto »

- **Décision** : `effectiveIngredientPrices(recipe, tree, prices, {})` — aucun choix forcé, donc
  « Auto » à chaque niveau — puis `compare(recipe, …, marketPrice)`. Un objet n'est listé que si
  `compare` renvoie un coût de craft complet (aucun ingrédient manquant).
- **Raison** : FR-004, SC-001 ; `getIngredientChoices` (utilisé par Suivis) est volontairement ignoré.

## §5 Chargement progressif

- **Décision** : `useCraftProfits(serverId, priceMode)` : 1) candidats (route ou carnet) ; 2) pour
  chaque candidat, `getItemDetail` + `loadRecipeTree` (en parallèle, limités à 6 à la fois, recettes
  en cache catalogue) ; 3) prix des ressources (lecture carnet puis comblement communautaire) ; 4)
  calcul. La liste se met à jour à chaque étape ; un indicateur « Calcul en cours… (n / total) » reste
  affiché tant que tout n'est pas calculé.
- **Raison** : SC-004 et bonne sensation même avec beaucoup d'objets.

## §6 Marge, tri, égalités

- **Décision** : marge = `round(bénéfice / coût × 100)` ; si le coût vaut 0 (cas théorique), marge
  non affichée et objet trié en fin pour le tri par % ; tri décroissant sur le critère choisi, puis
  par nom (`localeCompare('fr')`). Tri choisi retenu pour la visite seulement (état de page).

## §7 Panne du service communautaire

- **Décision** : si `/item-prices` échoue, la page affiche « Impossible de charger les prix partagés
  pour le moment. » sans liste ; une médiane manquante rend simplement l'objet non calculable.

## Révision — specs/021-background-data-loading

Le calcul de la liste est désormais une fonction de module partagée (`useCraftProfits.ts`) : il est
lancé en fond à l'ouverture du site (quand le catalogue est prêt et le navigateur inactif, au plus 2
requêtes simultanées), et la page Prix s'abonne au calcul en cours ou reprend la liste terminée au
lieu de recommencer. Les règles de calcul sont inchangées.
