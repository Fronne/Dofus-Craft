# Modèle de données : Graphiques sur le tableau de bord de l'administration

Aucune table nouvelle, aucune colonne nouvelle. Deux index (research R4). Tout est en lecture seule.

## Journée Cloudflare (`src/domain/cloudflare-usage.ts`)

| Type | Champs | Règles |
|---|---|---|
| `UsageHour` | `hour` (0 à 23), `workersRequests`, `d1RowsRead`, `d1RowsWritten` | incréments de l'heure (pas des cumuls), entiers ≥ 0 |
| `TodayUsageResponse` | `{ state: 'ok', date, readAt, hours: UsageHour[] }` ou `not-configured` / `denied` / `unavailable` | mêmes états que `UsageResponse` ; `date` = jour UTC en cours |
| `CumulativeHour` | `hour`, `partial`, pour chaque métrique : `used`, `percent` | cumul depuis 00:00 UTC ; `partial` vrai pour l'heure en cours |
| `ThresholdCrossing` | `metric`, `level` (`warning` à 80 %, `over` à 100 %), `hour` | première heure où le cumul atteint le seuil ; absent si jamais atteint |

Fonctions pures :
- `fillTodayHours(now, rows)` : une entrée par heure de 0 à l'heure en cours, les lignes de même heure
  s'additionnent, une heure absente vaut 0, les heures hors jour ignorées.
- `cumulativeHours(hours)` : cumul par métrique ; pourcentage via `usagePercent` (non plafonné).
- `thresholdCrossings(cumulative)` : utilise `usageLevel` (seuils 80 % / 100 % déjà définis).

## Lignes ajoutées par clé (`admin-worker/src/sniffer-contributions.ts`)

Source : `sniffer_daily_usage (key_id, day, rows_written)` ⋈ `sniffer_keys (id, label, revoked_at)`.

| Type | Champs | Règles |
|---|---|---|
| `KeyMonthRow` | `keyId`, `label`, `revoked` (booléen), `rows` | somme de `rows_written` sur le mois ; jamais `key_hash` |
| `KeyContributions` | `month` (`AAAA-MM`), `months` (mois ayant des données, du plus récent), `total`, `keys: KeyMonthRow[]`, `days: { date, rows }[]` | `total` = somme des `rows` ; `days` : un point par jour du mois jusqu'à aujourd'hui (mois en cours) ou jusqu'à la fin (mois passé), jours sans ajout à 0 |

Règles : toutes les clés actives créées avant la fin du mois sont présentes (à 0 si rien) ; une clé
révoquée seulement si elle a des lignes ce mois-là ; tri par `rows` décroissant puis libellé ; mois invalide ou postérieur à
aujourd'hui : refusé (400).

## Activité (`admin-worker/src/activity.ts`)

| Type | Champs | Règles |
|---|---|---|
| `PriceOrigin` | `'manual' \| 'capture' \| 'bot' \| 'sniffer'` | valeurs de la colonne `origin` |
| `ActivityDay` | `date`, `prices: Record<PriceOrigin, number>`, `visitors` | un point par jour UTC des 30 derniers jours, aujourd'hui compris ; jours sans ligne à 0 |
| `Activity` | `days: ActivityDay[]`, `pricesTotal`, `visitorsToday` | `pricesTotal` = somme des prix de la période |

Anonymat : ni `device_id`, ni `resource_id`, ni identifiant de clé ne sortent.

## Visuels côté navigateur (`admin/dashboard-insights.ts`)

| Fonction | Entrée | Sortie |
|---|---|---|
| `mappingAge(mappings, now)` | liste des correspondances | `{ build, uploadedAt, days, stale }` de l'active (`stale` si > 30 jours), ou `none` |
| `keyActivity(keys, now)` | liste des clés | par clé : `recent` / `dormant` / `never` ; clés révoquées ignorées |
| `counterBars(counters)` | compteurs | `{ label, count }[]` triés par `count` décroissant |
| `bannerRemaining(message, now)` | bandeau ou `null` | `none` / `open-ended` / `{ ms, text }` ; déjà expiré : `expired` |

## Index (migration `0022_add_dashboard_indexes.sql`)

| Index | Pourquoi |
|---|---|
| `community_price_contributions (created_at, origin)` | compter les prix par jour et par origine sans lire les lignes complètes |
| `app_visits (day)` | compter les visiteurs par jour sans balayer toute la table |

## Cartes (`admin/dashboard-summary.ts`)

`SECTIONS` garde ses six entrées (sections ouvrables). On ajoute `READ_ONLY_CARDS = ['prix', 'visites']` :
cartes sans section, donc sans ancre (`parseSection` continue d'ignorer toute autre ancre).
Un `CardSummary` reste `{ state, text, tone }` ; le visuel est chargé séparément par carte et peut être
`loading`, `ok`, `empty` ou `unavailable` sans changer le résumé texte.
