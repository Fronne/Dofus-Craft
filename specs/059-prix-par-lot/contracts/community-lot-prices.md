# GET /community-lot-prices

Requête : `?serverId=<id>&resourceIds=<id,id,…>` (1 à 98 ids ; sinon 400 `{ error }`). Même
authentification Bearer que `/community-prices`.

Réponse 200 :

```json
{ "serverId": "s", "prices": [
  { "resourceId": "421", "lots": { "10": { "lotPriceKamas": 900, "observedAt": "2026-10-19T10:00:00.000Z" } } }
] }
```

Seules les ressources ayant au moins un prix de lot sont listées. Clés de `lots` : "1", "10", "100",
"1000". `lotPriceKamas` = prix du lot entier ; prix unitaire = `lotPriceKamas / taille`.
