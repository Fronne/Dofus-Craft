# Contract: lecture du prix partagé d'une ressource

Amende `GET /community-price` (specs/004) et `GET /community-prices` (specs/021). Paramètres, codes
d'erreur, en-têtes de cache et paramètre `fresh` sont **inchangés**. Seuls deux champs sont ajoutés
à chaque prix.

## Champs ajoutés

| Champ | Type | Règle |
|---|---|---|
| `latestAmountKamas` | entier | montant de la contribution de ressource (`kind = 'resource'`) la plus récente pour cette ressource et ce serveur, parmi celles de moins de 90 jours ; sans filtre des valeurs aberrantes ni regroupement par appareil |
| `latestContributionAt` | date ISO 8601 | date d'enregistrement de cette contribution |

Les champs existants (`medianAmountKamas`, `sampleSize`, `lastContributionAt`) restent présents et
gardent leur sens.

## `GET /community-price?serverId=…&resourceId=…`

**200**

```json
{
  "resourceId": "11929",
  "serverId": "mikhal",
  "medianAmountKamas": 1642,
  "sampleSize": 2,
  "lastContributionAt": "2026-09-28T13:51:28.940Z",
  "latestAmountKamas": 1848,
  "latestContributionAt": "2026-09-28T13:51:28.940Z"
}
```

**404** : aucune contribution de ressource pour cette ressource et ce serveur (inchangé).

## `GET /community-prices?serverId=…&resourceIds=…`

**200**

```json
{
  "serverId": "mikhal",
  "prices": [
    {
      "resourceId": "11929",
      "medianAmountKamas": 1642,
      "sampleSize": 2,
      "lastContributionAt": "2026-09-28T13:51:28.940Z",
      "latestAmountKamas": 1848,
      "latestContributionAt": "2026-09-28T13:51:28.940Z"
    }
  ]
}
```

Chaque entrée reste identique à la réponse de `GET /community-price` pour la même ressource.

## `POST /community-price`

Inchangé : la médiane et l'écart sont toujours calculés et enregistrés avec chaque contribution de
ressource (`median_at_submission_kamas`, `deviation_percent`).

## Compatibilité

Les clients qui ignorent les nouveaux champs continuent de fonctionner. Déployer le Worker avant le
site.
