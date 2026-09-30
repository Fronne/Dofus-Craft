# Contract: captures d'une séance et rattachement par équipement

Complète `specs/025-rune-purchase-import/contracts/fm-site-api.md` et
`specs/027-fm-item-recap/contracts/fm-items-api.md`. Authentification inchangée (jeton Bearer du
site) ; règles d'accès de specs/030 inchangées.

## `GET /fm/sessions/:id` — champ ajouté

```json
{
  "...": "champs existants",
  "captures": [
    {
      "id": "c1",
      "createdAt": "2026-09-30T18:02:11.000Z",
      "origin": "bot",
      "player": { "discordUserId": "42", "displayName": "Cyril", "avatarUrl": null, "private": false },
      "spentKamas": 23868,
      "items": [
        { "itemName": "Rune Do Air", "itemId": "1234", "quantity": 10, "totalKamas": 15868, "averageUnitKamas": 1587 },
        { "itemName": "Rune Pa Ga", "itemId": "5678", "quantity": 1, "totalKamas": 8000, "averageUnitKamas": 8000 }
      ]
    }
  ]
}
```

- Captures triées par `createdAt` croissant, puis `id`.
- `items` trié par `totalKamas` décroissant, puis `itemName`.
- Un site qui reçoit une réponse sans `captures` (ancien Worker) affiche une liste vide.
- Les réponses de `PUT` et `DELETE /fm/sessions/:id/item` (qui renvoient le détail) contiennent aussi
  `captures`.

## `PUT /fm/sessions/:id/item` — corps accepté

Soit (inchangé) :

```json
{ "fmItemId": "<id d'un objet en FM du joueur>" }
```

Soit (nouveau) :

```json
{ "item": { "itemId": "8237", "itemName": "Anneau Rtograf", "imageUrl": "https://api.dofusdb.fr/…" } }
```

`item` suit les règles de `POST /fm/items` (`itemId` en chiffres, `itemName` 1 à 80 caractères,
`imageUrl` DofusDB ou `null`), sans `label`.

| Cas | Réponse |
|---|---|
| Rattachée (objet existant ou créé) | `200` + détail de la séance |
| Corps invalide (ni `fmItemId`, ni `item` valide) | `400` |
| Séance d'un autre joueur, ou objet d'un autre joueur | `404` |
| Séance déjà rattachée (à la main ou par son salon) | `409 { "error": "already-attached" }` — aucun objet créé |
