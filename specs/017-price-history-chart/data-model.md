# Data Model : Graphe d'historique des prix HDV

Aucune table ni colonne n'est ajoutée. La fonctionnalité lit la table existante et calcule des
valeurs à la demande.

## CommunityPriceContribution (existante, lue seulement)

Table D1 `community_price_contributions` (specs/004, specs/016). Colonnes lues : `resource_id`,
`server_id`, `kind`, `amount_kamas`, `device_id`, `created_at`. Aucune ligne n'est jamais renvoyée
telle quelle (FR-006). La requête utilise l'index existant `(resource_id, server_id, created_at)` et
filtre sur `kind`.

## Grouping (valeur)

`'day' | 'week' | 'month'`.

| Valeur | Période | `periodStart` |
|---|---|---|
| `day` | un jour civil, heure de Paris | la date du jour |
| `week` | du lundi au dimanche, heure de Paris | la date du lundi |
| `month` | un mois civil, heure de Paris | le 1er du mois |

## HistoryPoint (calculé par le Worker)

| Champ | Type / règle | Rôle |
|---|---|---|
| `periodStart` | date civile `AAAA-MM-JJ` (voir Grouping) | Position sur l'axe du temps et libellé de la période |
| `medianAmountKamas` | entier ≥ 0, `percentileCont(0.5)` arrondi | Valeur du point (FR-004) |
| `sampleSize` | entier ≥ 1 | Nombre de prix retenus dans la période (FR-005) |

**Règles** : voir research.md §3 (fenêtre de 90 jours, un appareil par période, filtre des valeurs
aberrantes sur tout le regroupement, médiane par période). Une période sans prix retenu n'a pas de
point (FR-010). Les points sont triés par `periodStart` croissant.

## PriceHistory (réponse)

Pour un `kind`, un identifiant et un serveur : `{ day: HistoryPoint[], week: HistoryPoint[], month:
HistoryPoint[] }`. Chaque liste peut être vide.

## Affichage d'un regroupement (règle côté application, `src/domain/price-history.ts`)

| Points du regroupement choisi | État affiché |
|---|---|
| 0 | « Pas encore d'historique pour ce serveur » (FR-009) |
| 1 | « Pas assez d'historique », avec la médiane et le nombre de prix de cette période, et une invitation à passer à un regroupement plus fin si celui-ci a au moins 2 points (FR-009, US4) |
| ≥ 2 | Courbe |

État de chargement : `loading` → `ready(PriceHistory)` | `unavailable` (FR-013).

## HistoryGroupingPreference (appareil)

Clé `localStorage` `craftcheck-history-grouping`, valeur `Grouping`. Si la valeur est absente,
illisible ou inconnue, on prend `'week'` (FR-007). Lecture et écriture sont protégées par try/catch :
sans `localStorage`, le choix vaut seulement pour la visite.
