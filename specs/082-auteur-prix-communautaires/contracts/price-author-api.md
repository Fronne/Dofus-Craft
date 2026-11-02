# Contrat : auteur des prix communautaires

Changements du Worker. Les champs ajoutés sont **optionnels** : un site plus ancien les ignore.

## En-tête de session à la saisie

`POST /community-price` accepte en plus un en-tête `X-Fm-Session: <jeton de session du site>`.

- L'en-tête `Authorization: Bearer <clé d'application>` reste obligatoire, inchangé.
- Jeton valide et non expiré : la contribution est enregistrée avec son auteur.
- Jeton absent, inconnu ou expiré : la contribution est enregistrée **sans auteur**, la réponse est la
  même (`201 { "id": "…" }`). Aucune erreur ne dépend du jeton.
- CORS : `Access-Control-Allow-Headers` contient désormais `X-Fm-Session`.

## Lectures publiques (avec le cache de 60 s existant)

Le pseudo n'apparaît que si le profil de l'auteur est public. L'identifiant Discord n'apparaît jamais.

### `GET /community-price?resourceId&serverId`

```json
{
  "resourceId": "…", "serverId": "…",
  "medianAmountKamas": 1200, "sampleSize": 3,
  "lastContributionAt": "2026-11-02T10:00:00.000Z",
  "latestAmountKamas": 1250, "latestContributionAt": "2026-11-02T10:05:00.000Z",
  "latestOrigin": "manual",
  "latestAuthor": "Cyril"
}
```

`latestAuthor` est absent (ou `null`) quand la dernière saisie est anonyme, d'un profil privé, d'un
profil supprimé, ancienne, ou remplacée par un prix Huzounet.

### `GET /community-prices?serverId&resourceIds`

Chaque élément de `prices[]` porte le même `latestAuthor` optionnel.

### `GET /latest-price?itemId&serverId`

```json
{ "itemId": "…", "serverId": "…", "amountKamas": 5000, "contributedAt": "…", "author": "Cyril" }
```

### `GET /item-prices?serverId`

Chaque élément de `items[]` : `{ itemId, amountKamas, contributedAt, author? }`.

## `GET /fm/me/contributions`

Session requise (`Authorization: Bearer <jeton>`), ouverte aux non-membres du serveur Discord comme
`GET /fm/me`. `401` sans session valide.

```json
{
  "total": 12,
  "recent": [
    { "resourceId": "…", "kind": "resource", "serverId": "mikhal", "amountKamas": 1250, "createdAt": "…" }
  ]
}
```

- `total` : les prix de l'utilisateur encore conservés (les prix sont purgés après 90 jours).
- `recent` : les 20 plus récents, du plus récent au plus ancien. Toutes les contributions de
  l'utilisateur, quel que soit son réglage de confidentialité.

## `PATCH /fm/me` et `DELETE /fm/me`

- `PATCH { "isPrivate": … }` : inchangé ; en plus, le cache de lecture de l'isolat est vidé pour que
  le nom apparaisse ou disparaisse sans attendre.
- `DELETE` : la transaction met `author_discord_user_id` à `NULL` sur les prix de la personne
  avant de supprimer son profil.
