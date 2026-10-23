# Recherche : Classement des objets les plus rentables à briser

Chaque décision s'appuie sur le code existant (lu pendant la planification).

## R1 - D'où viennent les objets et leurs lignes

- **Décision** : utiliser l'index local `src/data/brisage-items.json` via `loadBrisageItemsIndex()` (`src/data/brisage-items-repository.ts`).
- **Raison** : il contient déjà id, nom, niveau, catégorie, image et lignes avec bornes pour tous les équipements brisables ; la fiche lit un objet à la fois via `getItemEffectRanges`, ce qui serait trop lent pour des milliers d'objets.
- **Alternatives** : lire chaque objet par `getItemEffectRanges` (trop de lectures) ; reconstruire un index (inutile, il existe).
- **Conséquence** : cet index ne contient que les lignes positives. Les malus (`getItemNegativeRanges`) ne sont pas pris en compte, d'où un écart minime avec la fiche pour un focus.

## R2 - Prix d'objet

- **Décision** : mode personnel = `pinnedItemPrices.listAllForServer(serverId)` (contient `updatedAt`) ; mode communautaire = `getSharedItemPrices(serverId)` (une requête, contient `contributedAt`).
- **Raison** : la fiche (`useItemCost`) lit les mêmes sources, objet par objet ; les deux fonctions de liste existent déjà et renvoient la date.
- **Alternatives** : y ajouter le coût de craft (`useItemCraftCost`) — rejeté, il faut charger la recette de chaque objet ; prévu pour une évolution séparée.

## R3 - Prix de runes et leur date

- **Décision** : réutiliser la logique de `useRunePrices` (carnet du mode actif + prix partagés plus récents en mode communautaire), en renvoyant en plus la date de chaque prix (`updatedAt` du carnet, `latestContributionAt` du partage).
- **Raison** : mêmes prix que la fiche, donc mêmes résultats ; la date sert l'indicateur de fraîcheur.
- **Alternatives** : dupliquer la lecture — rejeté ; si `useRunePrices` ne peut pas exposer les dates sans changer son contrat, extraire la fonction `loadPrices` en la partageant.

## R4 - Coefficients

- **Décision** : coefficients locaux du serveur (nouvelle fonction `listStoredCoefficients(serverId)` dans `brisage-coefficients.ts`) fusionnés avec les coefficients partagés lus par paquets de 96 (`getSharedCoefficients`), le plus récent gagnant (`latestCoefficient`).
- **Raison** : même règle que la fiche (`useSharedCoefficients`) ; aucune route Worker nouvelle.
- **Alternatives** : une route Worker de lecture groupée par serveur — plus rapide mais demande un déploiement ; à garder en réserve si le nombre de requêtes gêne.

## R5 - Calcul d'une ligne

- **Décision** : appeler `analyzeBrisage` (coefficient connu) ou `analyzeFocusAdvice` (inconnu) avec les jets moyens (`averageRoll`) des lignes fusionnées par stat, exactement comme `BrisagePage` (`mergeRanges`).
- **Raison** : principe II du projet — aucune formule dupliquée ; test de comparaison avec la fiche (SC-002).
- **Seuil sans coefficient** : `min(normalBreakEven, focusBreakEven)` quand les deux existent, sinon celui qui existe ; au-dessus de 100 % → « jamais rentable ». Ce seuil est le coefficient sous lequel le brisage cesse de couvrir le prix de l'objet (`analyzeFocusAdvice`).

## R6 - Exo

- **Décision** : pour chaque stat de `BRISAGE_STATS` absente de l'objet et dont la rune a un prix (`runeForStat`), ajouter une ligne `{ effectId, value: 1, exo: true }`, recalculer, puis retrancher le prix d'une rune de cette stat du gain. Garder le meilleur ; ne le recommander que s'il dépasse le gain sans exo.
- **Raison** : `analyzeBrisage` gère déjà les lignes `exo` (jamais cibles de focus) ; la déduction d'une rune est le minimum voulu par le propriétaire.
- **Limite documentée** : échecs et runes supplémentaires de la forgemagie non comptés.
- **Alternatives** : valeur d'exo maximale — rejeté pour la première version (réglage ultérieur).

## R7 - Performance

- **Décision** : calculer les lignes une fois (mémoïsé par serveur, mode, prix, coefficients), puis trier et filtrer des tableaux déjà calculés ; calcul de l'exo à mesurer, avec repli différé.
- **Raison** : le tri et le filtre doivent rester sous la seconde (SC-003) ; le calcul est cher une fois, pas à chaque clic.

## R8 - Accès réservé

- **Décision** : indicateur `localStorage` (`craftcheck-brisage-ranking`) ; activé en ouvrant la page avec `?classement=1`, retiré avec `?classement=0`. L'onglet et ses calculs ne sont montés que si l'indicateur est présent.
- **Raison** : choix du propriétaire (réglage simple dans son navigateur, pas d'authentification) ; l'activation par l'adresse évite d'afficher un bouton visible de tous.
- **Limite** : contournable par quiconque connaît l'adresse ; acceptée, le classement ne contient aucune donnée privée.
- **Ouverture à tous** : réglage booléen partagé via `site_settings` (déjà lu par tout le site et modifiable depuis l'administration protégée par Cloudflare Access) ; phase optionnelle car elle touche le Worker public, le Worker d'administration et l'éditeur de réglages.
