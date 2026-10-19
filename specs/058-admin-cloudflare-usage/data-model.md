# Modèle de données : utilisation Cloudflare

Aucune table ni colonne : tout vient de l'API d'analyse de Cloudflare à chaque lecture.

## Types (`src/domain/cloudflare-usage.ts`)

- `UsageMetric` = `'workersRequests' | 'd1RowsRead' | 'd1RowsWritten'`
- `USAGE_LIMITS: Record<UsageMetric, number>` = 100 000 / 5 000 000 / 100 000
- `USAGE_LABELS: Record<UsageMetric, string>` = « Requêtes Workers », « Lectures de lignes D1 »,
  « Écritures de lignes D1 »
- `UsageDay` = `{ date: 'YYYY-MM-DD' } & Record<UsageMetric, number>` (entiers ≥ 0)
- `UsageLevel` = `'ok' | 'warning' | 'over'`

## Fonctions pures

| Fonction | Règle |
|---|---|
| `usagePercent(used, limit)` | `Math.round(used / limit * 100)` ; non plafonné ; 0 si `used` ≤ 0 |
| `usageLevel(used, limit)` | `over` si used ≥ limit ; `warning` si used / limit ≥ 0,8 ; sinon `ok` |
| `usageDates(days, now)` | `days` dates UTC, plus ancienne d'abord, la dernière = jour UTC de `now` |
| `fillUsageDays(days, now, rows)` | une `UsageDay` par date ; somme des lignes de même date ; 0 si absent ; ignore les dates hors fenêtre |

## Réponse de l'API (voir contrat)

`UsageResponse` =
- `{ state: 'ok'; days: 7 | 30; readAt: ISO; history: UsageDay[] }` (le dernier élément = aujourd'hui)
- `{ state: 'not-configured'; missing: ('CLOUDFLARE_API_TOKEN' | 'CLOUDFLARE_ACCOUNT_ID')[] }`
- `{ state: 'denied' }`
- `{ state: 'unavailable' }`

## États de la source

```
secrets absents ──► not-configured
secrets présents ─► appel Cloudflare ─► 401/403 ──► denied
                                     ─► autre échec / forme inattendue ──► unavailable
                                     ─► données ──► ok
```
