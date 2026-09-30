# Contrat : objets en FM et rattachement des sessions

Worker `dofus-craft-community-price-api`, routes `/fm/*` (specs/025). Toutes 🔒 : jeton de session
dans `Authorization: Bearer …` ; sans jeton valide, `401`.

Forme d'un **objet en FM** :

```json
{ "id": "3f2…", "itemId": "8237", "itemName": "Anneau Rtograf", "imageUrl": "https://api.dofusdb.fr/img/items/9123.png",
  "label": "Rtograf PA", "owner": { "discordUserId": "42", "displayName": "Cyril", "avatarUrl": null, "private": false },
  "totalKamas": 150000, "sessionCount": 2 }
```

## Objets

### `POST /fm/items`

Corps : `{ "itemId": "8237", "itemName": "Anneau Rtograf", "imageUrl": "https://api.dofusdb.fr/…" | null,
"label": "Rtograf PA" | null }`. Crée l'objet du joueur connecté. `201` avec l'objet ; `400` si
`itemId` n'est pas numérique, si `itemName` ne fait pas 1 à 80 caractères, si `imageUrl` n'est ni
`null` ni en `https://api.dofusdb.fr/`, ou si `label` ne fait pas 1 à 40 caractères (après `trim`).

### `PATCH /fm/items/{id}`

Corps : `{ "label": "…" | null }`. Propriétaire seulement : sinon `404`. `200` avec l'objet.

### `DELETE /fm/items/{id}`

Propriétaire seulement (sinon `404`). Détache ses sessions puis supprime l'objet. `204`.

### `GET /fm/items/{id}`

Récap (FR-009 à FR-012) : l'objet, plus

```json
{ "sessions": [ { "id": "s1", "channelName": "fm-anneau", "status": "closed", "openedAt": "…", "totalKamas": 100000 } ],
  "items": [ { "itemName": "Rune Pa Ga", "itemId": "…", "quantity": 12, "totalKamas": 96000, "averageUnitKamas": 8000 } ] }
```

Sessions de la plus récente à la plus ancienne ; `items` trié par total décroissant. `404` si l'objet
n'existe pas, ou si son propriétaire est privé et n'est pas le joueur connecté.

### Dans `GET /fm/players/{discordUserId}` (specs/025)

La réponse gagne `fmItems`: la liste des objets en FM de ce joueur (même forme, sans `sessions` ni
`items`), du plus récent au plus ancien. Même règle de visibilité que le profil.

## Rattachement

### `PUT /fm/sessions/{id}/item`

Corps : `{ "fmItemId": "3f2…" }`.

| Statut | Quand |
|---|---|
| `200` | Rattachée : renvoie le détail de la session (comme `GET /fm/sessions/{id}`) |
| `404` | Session inconnue, ou objet inconnu ou appartenant à un autre joueur |
| `403 { "error": "not-participant" }` | Le joueur connecté n'a aucune capture dans cette session (FR-005) |
| `409 { "error": "already-attached" }` | La session est déjà rattachée (FR-006) |

### `DELETE /fm/sessions/{id}/item`

Propriétaire de l'objet rattaché seulement : `200` avec le détail de la session ; `403` sinon ;
`404` si la session n'existe pas ou n'est pas rattachée.

## Champs ajoutés aux sessions

`GET /fm/sessions` et `GET /fm/sessions/{id}` : chaque session gagne

```json
"fmItem": { "id": "3f2…", "name": "Rtograf PA", "owner": { … } }
```

`name` = `label` ou, à défaut, `itemName`. `fmItem` vaut `null` si la session n'est pas rattachée, et
`{ "private": true }` si le propriétaire est privé et n'est pas le joueur connecté (FR-008).

`GET /fm/sessions/{id}` gagne aussi `canAttach` (la session n'est pas rattachée et le joueur connecté y
a dépensé) et `canDetach` (elle est rattachée à un objet du joueur connecté).
