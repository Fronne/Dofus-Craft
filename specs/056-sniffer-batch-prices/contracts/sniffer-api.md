# Contrat : API sniffer (dofus-craft-community-price-api)

Toutes les routes : `Authorization: Bearer <clé sniffer>`. Réponses JSON. Clé inconnue, révoquée ou
absente → `401 {"error":"unauthorized"}` (avant tout autre contrôle).

## GET /sniffer/config?build=<build>&tool=<version>[&provisional=1]

- `build` obligatoire (`400 {"error":"build_required"}` sinon) ; `tool` informatif.
- Jamais de 426 ici : l'outil compare sa version à `minVersion`.
- `provisional=1` (valeur exacte `1`, specs/070) : l'outil accepte un mapping provisoire, qu'il ne
  suit qu'après avoir vérifié sur le fil les prix décodés avec lui.

```json
200 {
  "minVersion": "0.1.0",
  "downloadUrl": "https://github.com/Fronne/dofus-craft-prices/releases/latest",
  "servers": ["brial", "dakal", "draconiros", "hell-mina", "imagiro", "kourial", "mikhal",
              "ombre", "orukam", "rafal", "salar", "tal-kasha", "tylezia"],
  "mapping": { "id": 7, "build": "3.7.10.10", "keymap": {}, "schema": {}, "provisional": false }
}
```

`keymap` / `schema` sont les documents JSON déposés, renvoyés parsés. `mapping` vaut :

- le mapping actif du build demandé, avec `"provisional": false`, s'il existe (avec ou sans
  `provisional=1`) ;
- sinon, avec `provisional=1` seulement, le mapping actif le plus récemment déposé, tous builds
  confondus (`uploaded_at` puis `id` décroissants), avec `"provisional": true`. Son `build` reste son
  build d'origine, pas celui demandé :
  `{ "id": 7, "build": "3.7.10.10", "keymap": {}, "schema": {}, "provisional": true }` pour
  `?build=3.7.12.12&provisional=1` ;
- sinon `null` : aucun mapping actif nulle part, ou pas de `provisional=1`. Sans ce paramètre la
  réponse est celle d'avant specs/070, car un ancien outil ignore `provisional` et enverrait sans vérifier.

Un document stocké illisible est servi comme `null`. Ces routes ne modifient jamais `sniffer_mappings` :
seul l'admin publie un mapping.

## POST /community-price/batch

```json
{
  "tool": "0.1.0",
  "build": "3.7.10.10",
  "mappingId": 7,
  "serverId": "mikhal",
  "observations": [
    { "itemId": "12738", "seenAt": "2026-10-15T20:01:02Z",
      "lots": { "1": 24000, "10": 231000, "100": 2290000, "1000": 0 } },
    { "itemId": "746", "seenAt": "2026-10-22T20:01:02Z", "category": 40,
      "lots": { "1": 5257, "10": 52991, "100": 529995, "1000": 0 } },
    { "itemId": "8872", "seenAt": "2026-10-22T20:01:02Z", "category": 9, "lots": { "1": 30000 } }
  ],
  "provisional": false
}
```

`provisional` est facultatif (specs/070). Le mapping attendu est le mapping actif du build ; s'il n'y
en a aucun et que `provisional` vaut exactement `true`, c'est le mapping provisoire que
`GET /sniffer/config?provisional=1` sert à ce moment. Toute autre valeur compte comme absente. Dès
qu'un mapping propre est publié pour le build, un lot provisoire reçoit donc 409 avec l'id du nouveau
mapping, et l'outil recharge sa configuration.

Contrôles, dans cet ordre (le premier qui échoue répond, rien n'est écrit) :

| code | corps | cas |
|---|---|---|
| 401 | `{"error":"unauthorized"}` | clé |
| 400 | `{"error":"invalid_body"}` | JSON illisible ; `build`, `serverId` non chaîne ; `mappingId` non entier ; `observations` non tableau |
| 426 | `{"error":"tool_outdated","minVersion":"…","downloadUrl":"…"}` | `tool` absent, illisible ou < `minVersion` |
| 400 | `{"error":"unknown_server"}` | `serverId` hors des 13 serveurs |
| 400 | `{"error":"too_many_observations","max":200}` | plus de 200 observations |
| 409 | `{"error":"mapping_not_active","activeMappingId":7\|null}` | `mappingId` ≠ mapping attendu (ci-dessus), ou aucun mapping attendu ; `activeMappingId` = l'id attendu ou `null` |
| 429 | `{"error":"daily_limit","limit":5000,"used":4990}` | lignes déjà écrites aujourd'hui (UTC) + lignes acceptables du lot > 5000 |
| 200 | `{"accepted":41,"rejected":[{"index":3,"reason":"not_an_ingredient"}]}` | sinon |

### `category` (specs/071-sniffer-tous-hdv, outil ≥ 0.4.0)

`category` est facultatif : c'est le typeId DofusDB que l'HDV donne pour l'objet. Sa nature vient de
`worker/src/item-types.json` (généré par `scripts/build-item-types.mjs`) :

| nature | types | enregistré comme |
|---|---|---|
| `equipment` | super-types 1, 2, 3, 4, 5, 7, 10, 11, 12, 13, 22, 23, 25, 69 | `kind = 'item'`, prix = `lots["1"]` (l'exemplaire le moins cher), référence = dernier prix d'objet, pas de prix par lot |
| `resource` | super-type 9 sauf le type 78 | `kind = 'resource'`, `unitPrice` + prix par lot, comme sans catégorie |
| `rune` | type 78 | idem |
| `consumable` | super-types 6, 16, 70 | idem |

L'étiquette va dans la colonne `item_type`. Avec une catégorie, le catalogue de ressources du site
ne s'applique pas. Un équipement n'a que la clé `"1"`. Sans `category` (outil < 0.4.0) : ressources
du catalogue seulement, `item_type` NULL, comme avant. Chaque observation acceptée, équipement
compris, compte pour une ligne du plafond journalier.

Raisons de refus par observation (`index` = rang dans `observations`, à partir de 0) :

- `invalid` — observation mal formée (voir data-model.md), `category` qui n'est pas un entier
  positif, ou équipement portant une autre clé que `"1"` ;
- `not_an_ingredient` — sans `category`, `itemId` hors du catalogue de ressources du site ;
- `unknown_category` — `category` sans nature (type inconnu, objet de quête, mutation…) ;
- `no_price` — aucun lot en vente.

Chaque observation acceptée devient une contribution `origin = 'sniffer'`, `device_id` = id de la
clé ; une ressource (sans catégorie, ou ressource / rune / consommable) a `kind = 'resource'` et le
prix `unitPrice(lots, médiane communautaire)` arrondi. Un écart à la référence n'est jamais un motif
de refus. Un lot de 0 observation répond `200 {"accepted":0,"rejected":[]}`.
