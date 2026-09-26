# Contrat : `GET /item-prices` (Worker)

Lecture anonyme, comme `/latest-price`.

`GET /item-prices?serverId=<id>`

| Cas | Statut | Corps |
|---|---|---|
| `serverId` manquant | 400 | `{ "error": "serverId is required" }` |
| aucun prix d'objet | 200 | `{ "items": [] }` |
| prix trouvés | 200 | `{ "items": [{ "itemId": "44", "amountKamas": 2720000, "contributedAt": "2026-09-24T08:14:03.000Z" }] }` |

- Une entrée par objet : sa contribution `kind = 'item'` la plus récente sur ce serveur (specs/016).
- Jamais de `device_id` ni de contribution de ressource.

## Client : `getSharedItemPrices(serverId)`

`{ status: 'found', items } | { status: 'unavailable' }`, ne lève jamais (réseau, non 2xx, corps
invalide → `unavailable`).

## Tests obligatoires

- deux contributions d'un objet → seule la plus récente ; deux objets → deux entrées ;
- lignes `kind = 'resource'` ignorées ; autre serveur ignoré ;
- 400 sans `serverId` ; 200 `{ items: [] }` sans données ; aucune clé `device`.
- client : `found` / `unavailable` sans exception.
