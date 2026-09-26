# Contrat : lecture groupée des prix communautaires

## `GET /community-prices`

Lecture anonyme (pas de clé d'API), comme `/community-price`.

**Paramètres**

| Nom | Obligatoire | Règle |
|---|---|---|
| `serverId` | oui | identifiant de serveur |
| `resourceIds` | oui | ids séparés par des virgules, 1 à 100, doublons ignorés |
| `fresh` | non | `1` : contourne le cache (lecture juste après une contribution) |

**200**

```json
{
  "serverId": "draconiros",
  "prices": [
    { "resourceId": "421", "medianAmountKamas": 1200, "sampleSize": 4, "lastContributionAt": "2026-09-25T18:02:11Z" }
  ]
}
```

Chaque valeur est identique à celle de `GET /community-price?resourceId=…` pour la même ressource.
Les ressources sans médiane ne figurent pas dans `prices`.

**400** : `serverId` absent, `resourceIds` vide ou plus de 100 ids.

## En-têtes de cache (tous les GET de lecture de prix)

- Réponse normale : `Cache-Control: public, max-age=60`.
- Avec `fresh=1` : `Cache-Control: no-store`, lecture directe de la base.

Endpoints concernés : `/community-price`, `/community-prices`, `/latest-price`, `/item-prices`,
`/price-history`. `/info-message` et `/player-counters` ne changent pas (modifiés par l'admin, doivent
apparaître tout de suite).
