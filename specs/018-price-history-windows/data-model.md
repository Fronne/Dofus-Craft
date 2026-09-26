# Data Model: Historique des prix par fenêtre de temps

## Contribution de prix (existante, D1 `community_price_contributions`, inchangée)

Lue uniquement : `amount_kamas`, `created_at`, filtrée par `resource_id`, `server_id`, `kind` et
`created_at >= now − 30 j`. `device_id` n'est plus lu par cette route.

## Prix partagé (`SharedPrice`, réponse et application)

| Champ | Type | Règle |
|---|---|---|
| `amountKamas` | entier > 0 | montant de la contribution |
| `sharedAt` | chaîne ISO 8601 UTC | `created_at` arrondi à la minute inférieure (research.md §2) |

## Historique (`PriceHistory`)

`Record<HistoryWindow, SharedPrice[]>` avec `HistoryWindow = 'day' | 'week' | 'month'`.

Règles (research.md §1, §3), pour chaque fenêtre :
1. garder les contributions dont `created_at >= now − durée` (24 h, 7 j, 30 j) ;
2. calculer `outlierBounds` sur leurs montants triés et écarter ceux hors bornes (sans effet sous
   4 valeurs) ;
3. trier par `sharedAt` croissant (à égalité, ordre d'origine).

Aucun dédoublonnage par appareil, aucune agrégation.

## Préférence de fenêtre (existante)

Clé `localStorage` `craftcheck-history-grouping`, valeurs `day` / `week` / `month`, défaut `week`.
Inchangée : une valeur retenue par la spec 017 est reprise telle quelle comme fenêtre.

## Affichage (`HistoryDisplay`, application)

| Cas | Résultat |
|---|---|
| `month` vide | `empty` (« Pas encore d'historique pour ce serveur ») |
| fenêtre choisie vide, `month` non vide | `none-in-window` + `longerWindow?` |
| 1 prix dans la fenêtre | `single` (le prix) + `longerWindow?` |
| ≥ 2 prix | `chart` |

`longerWindow` : la plus petite fenêtre plus longue que celle choisie ayant au moins 2 prix.
