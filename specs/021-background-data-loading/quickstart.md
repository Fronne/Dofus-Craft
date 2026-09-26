# Quickstart : validation

Prérequis : `npm run dev` (site) et `npm run worker:dev` (worker local), `.env.local` pointant vers
le worker local.

## 1. Catalogue gardé (US1)

1. Ouvrir le site, attendre que la recherche porte sur tout le catalogue, ouvrir 2 fiches d'objets.
2. DevTools → Application → IndexedDB → `dofus-craft-catalogue-cache` : entrées
   `catalogue-item-index`, `item:<id>`, `recipes:<id>` avec `formatVersion`.
3. DevTools → Network, filtre `dofusdb`, recharger : aucune requête vers DofusDB pour ces données ;
   la recherche répond immédiatement (SC-001, SC-002).
4. Modifier `savedAt` d'une entrée à J-2, recharger : affichage immédiat, puis une requête en fond.
5. Navigation privée : le site fonctionne comme avant (FR-005).

## 2. Page Prix prête (US2)

1. Ouvrir le site sur l'Accueil, attendre 10 s sans rien faire.
2. Ouvrir Prix : la liste est affichée sans « Calcul en cours » (SC-003), identique à un calcul
   direct (comparer après rechargement en ouvrant Prix directement).
3. Changer de serveur puis rouvrir Prix : liste du nouveau serveur.

## 3. Prix communautaires groupés (US3)

1. Mode communautaire, ouvrir un objet à plusieurs ressources : une seule requête
   `/community-prices` (SC-004), valeurs identiques à l'ancien affichage.
2. Envoyer un prix pour une ressource : la valeur mise à jour s'affiche (requête avec `fresh=1`).
3. `curl -i "<worker>/community-prices?serverId=…&resourceIds=1,2"` deux fois : `Cache-Control:
   public, max-age=60`.

## Tests automatisés

`npm test` (unitaires : catalogue-cache, computeCraftProfits partagé, getCommunityPrices,
endpoint `/community-prices`, cache worker), `npm run typecheck`, `npm run lint`.
