# Data Model: Dernier prix partagé pour les ressources

Aucune table ni colonne nouvelle. `community_price_contributions` est inchangée : chaque contribution
de ressource garde `median_at_submission_kamas` et `deviation_percent` (FR-008).

## Prix partagé d'une ressource (lu, jamais stocké côté service)

| Champ | Type | Règle |
|---|---|---|
| `resourceId` | string | |
| `serverId` | string | |
| `latestAmountKamas` | entier ≥ 0 | montant de la contribution `kind = 'resource'` la plus récente, moins de 90 jours |
| `latestContributionAt` | date ISO | date de cette contribution |
| `medianAmountKamas` | entier ≥ 0 | inchangé (specs/004) ; **utilisé seulement pour la confirmation, jamais affiché** |
| `sampleSize` | entier | inchangé, non affiché |
| `lastContributionAt` | date ISO | inchangé (date de la dernière contribution gardée dans la médiane), n'est plus affiché |

Côté client : type `CommunityPrice` (`src/domain/types.ts`) complété par `latestAmountKamas` et
`latestContributionAt`.

## Prix gardé sur l'appareil (carnet Mode communautaire)

Inchangé : `{ resourceId, unitPriceKamas, updatedAt }` par serveur. Nouveau : `save` accepte une date
optionnelle ; quand le dernier prix partagé est écrit, `updatedAt` vaut `latestContributionAt`.

## Règle de choix — `pickCommunityPrice(carnetEntry?, latest?)`

| Prix gardé | Dernier prix partagé | Résultat | Écrit dans le carnet |
|---|---|---|---|
| absent | absent | aucun prix | non |
| absent | présent | dernier prix | oui, avec sa date |
| présent | absent | prix gardé | non |
| présent, `updatedAt` < date du dernier prix | présent | dernier prix | oui, avec sa date |
| présent, `updatedAt` ≥ date du dernier prix | présent | prix gardé | non |

Pendant une saisie (valeur tapée pas encore enregistrée), la règle n'est pas appliquée à cette
ressource (FR-006).

## Confirmation d'un prix aberrant (ressource)

Entrée : prix saisi, médiane actuelle (non affichée). Confirmation si
`|saisi − médiane| / médiane × 100 > 25` ; aucune si pas de médiane. Affiche : prix saisi et message.
