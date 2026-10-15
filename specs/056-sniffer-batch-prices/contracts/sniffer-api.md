# Contrat : API sniffer (dofus-craft-community-price-api)

Toutes les routes : `Authorization: Bearer <clé sniffer>`. Réponses JSON. Clé inconnue, révoquée ou
absente → `401 {"error":"unauthorized"}` (avant tout autre contrôle).

## GET /sniffer/config?build=<build>&tool=<version>

- `build` obligatoire (`400 {"error":"build_required"}` sinon) ; `tool` informatif.
- Jamais de 426 ici : l'outil compare sa version à `minVersion`.

```json
200 {
  "minVersion": "0.1.0",
  "downloadUrl": "https://github.com/Fronne/dofus-craft-prices/releases/latest",
  "servers": ["brial", "dakal", "draconiros", "hell-mina", "imagiro", "kourial", "mikhal",
              "ombre", "orukam", "rafal", "salar", "tal-kasha", "tylezia"],
  "mapping": { "id": 7, "build": "3.7.10.10", "keymap": {}, "schema": {} }
}
```

`mapping` vaut `null` sans mapping actif pour ce build. `keymap` / `schema` sont les documents JSON
déposés, renvoyés parsés.

## POST /community-price/batch

```json
{
  "tool": "0.1.0",
  "build": "3.7.10.10",
  "mappingId": 7,
  "serverId": "mikhal",
  "observations": [
    { "itemId": "12738", "seenAt": "2026-10-15T20:01:02Z",
      "lots": { "1": 24000, "10": 231000, "100": 2290000, "1000": 0 } }
  ]
}
```

Contrôles, dans cet ordre (le premier qui échoue répond, rien n'est écrit) :

| code | corps | cas |
|---|---|---|
| 401 | `{"error":"unauthorized"}` | clé |
| 400 | `{"error":"invalid_body"}` | JSON illisible ; `build`, `serverId` non chaîne ; `mappingId` non entier ; `observations` non tableau |
| 426 | `{"error":"tool_outdated","minVersion":"…","downloadUrl":"…"}` | `tool` absent, illisible ou < `minVersion` |
| 400 | `{"error":"unknown_server"}` | `serverId` hors des 13 serveurs |
| 400 | `{"error":"too_many_observations","max":200}` | plus de 200 observations |
| 409 | `{"error":"mapping_not_active","activeMappingId":7\|null}` | `mappingId` ≠ mapping actif du build (ou aucun actif) |
| 429 | `{"error":"daily_limit","limit":5000,"used":4990}` | lignes déjà écrites aujourd'hui (UTC) + lignes acceptables du lot > 5000 |
| 200 | `{"accepted":41,"rejected":[{"index":3,"reason":"not_an_ingredient"}]}` | sinon |

Raisons de refus par observation (`index` = rang dans `observations`, à partir de 0) :

- `invalid` — observation mal formée (voir data-model.md) ;
- `not_an_ingredient` — `itemId` hors du catalogue de ressources du site ;
- `no_price` — aucun lot en vente.

Chaque observation acceptée devient une contribution `kind = 'resource'`, `origin = 'sniffer'`,
`device_id` = id de la clé, prix = `unitPrice(lots, médiane communautaire)` arrondi. Un écart à la
médiane n'est jamais un motif de refus. Un lot de 0 observation répond `200 {"accepted":0,"rejected":[]}`.
