# Contrat : API de nettoyage des données (Worker d'administration)

Toutes les routes passent par `verifyOwner` (403 `{ "error": "Accès réservé au propriétaire." }` sinon),
répondent en JSON avec `Cache-Control: no-store`. Erreurs de validation : 400 `{ error, field }`.

## GET /api/data

Les tables nettoyables et les dernières suppressions.

```json
{
  "tables": [
    { "id": "brisage-coefficients", "label": "Coefficients de brisage",
      "columns": [{ "id": "server_id", "label": "Serveur" }, "…"], "filters": ["server"] },
    { "id": "prix-communaute", "label": "Prix de la communauté", "columns": ["…"], "filters": ["server", "origin"] },
    { "id": "prix-externes", "label": "Prix externes", "columns": ["…"], "filters": ["server"] }
  ],
  "log": [
    { "id": 3, "deletedAt": "2026-10-23T09:12:00.000Z", "table": "prix-communaute",
      "mode": "duration", "filter": "durée 1h · origine sniffer", "count": 37 }
  ]
}
```

`log` : 20 entrées au plus, la plus récente d'abord.

## GET /api/data/:table?server=&origin=&limit=

Lignes les plus récentes (50 par défaut, 50 au plus), la plus récente d'abord.

```json
{ "rows": [{ "key": "42", "date": "2026-10-23T09:10:00.000Z", "cells": { "server_id": "mikhal", "coefficient": 112.5 } }] }
```

- Table inconnue → 404 `{ "error": "Table inconnue." }`.
- Filtre non applicable ou invalide → 400.
- `device_id` n'est jamais présent.

## GET /api/data/:table/count?since=10m|1h|24h&server=&origin=

Aperçu d'une suppression par durée : `{ "count": 37, "limit": 500 }`. Ne modifie rien.

## DELETE /api/data/:table

Corps, au choix :

```json
{ "keys": ["41", "42"] }
```
ou
```json
{ "since": "1h", "server": "mikhal", "origin": "sniffer", "expectedCount": 37 }
```

Réponse 200 : `{ "deleted": 2, "logged": true }`. `deleted` = lignes réellement supprimées (les clés déjà
disparues ne comptent pas).

| Cas | Code | Effet |
|-----|------|-------|
| Plus de 500 clés, ou plus de 500 lignes pour la durée | 422 `{ error, count }` | rien supprimé |
| `expectedCount` ≠ nombre réel | 409 `{ error, count }` | rien supprimé |
| Corps invalide (ni `keys` ni `since`, durée inconnue…) | 400 | rien supprimé |
| Table inconnue | 404 | rien supprimé |
| Zéro ligne supprimée | 200 `{ "deleted": 0, "logged": false }` | pas de trace |

Une trace (`admin_cleanup_log`) est écrite si `deleted > 0` ; son échec donne `logged: false` sans annuler la
suppression.
