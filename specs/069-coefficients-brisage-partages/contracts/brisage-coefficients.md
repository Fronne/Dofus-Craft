# Contrat : /brisage-coefficients (Worker public)

## GET /brisage-coefficients?serverId=mikhal&itemIds=777,888

Public, lecture en cache 60 s. 1 à 98 `itemIds`, sinon 400.

```json
{ "serverId": "mikhal", "coefficients": [ { "itemId": "777", "coefficient": 44, "notedAt": "2026-10-20T10:00:00.000Z" } ] }
```

Pour chaque objet : le coefficient le plus récent de moins de 90 jours. Un objet sans coefficient est absent.
L'identifiant d'appareil n'est jamais renvoyé.

## POST /brisage-coefficients

Clé d'application (`Authorization: Bearer`) + limiteur par IP, comme `POST /community-price`.

```json
{ "deviceId": "…", "entries": [ { "serverId": "mikhal", "itemId": "777", "coefficient": 38, "notedAt": "2026-10-21T16:00:00.000Z" } ] }
```

- 1 à 100 entrées. `coefficient` dans ]0 ; 4000]. `notedAt` facultatif (date du serveur par défaut) ; refusé s'il est
  futur (au-delà de 5 min) ou de plus de 90 jours. Une entrée invalide : 400, rien n'est enregistré.
- Réponse 201 `{ "stored": n }`. Idempotent : même (serveur, objet, date, appareil) = ignoré.

## Rétention

Cron hebdomadaire existant (lundi 03:00 UTC) : suppression des entrées de plus de 90 jours.
