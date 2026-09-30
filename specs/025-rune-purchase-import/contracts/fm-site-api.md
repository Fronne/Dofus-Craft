# Contrat : routes Forgemagie du Worker utilisées par le site

Worker `dofus-craft-community-price-api`. Toutes les réponses sont en JSON avec les en-têtes CORS
existants. Ces routes sont traitées **avant** le contrôle de `COMMUNITY_API_KEY` (research R3).

**Authentification** : `Authorization: Bearer <jeton de session>` pour toutes les routes marquées
🔒. Un jeton absent, inconnu ou expiré donne `401 { "error": "Unauthorized" }` ; le site supprime
alors son jeton et redemande une connexion.

## Connexion

### `GET /fm/auth/login`

Redirige (302) vers la page d'autorisation Discord, avec `scope=identify guilds.members.read` et un
`state` aléatoire gardé 10 minutes.

### `GET /fm/auth/callback?code=…&state=…`

Appelée par Discord. Vérifie le `state`, échange le `code`, lit `/users/@me` puis
`/users/@me/guilds/{DISCORD_GUILD_ID}/member`. Redirige (302) vers :

| Cas | Redirection |
|---|---|
| Membre du serveur du groupe | `{SITE_URL}/forgemagie#session=<jeton>` |
| Pas membre | `{SITE_URL}/forgemagie#error=not-member` |
| Connexion annulée sur Discord, `state` invalide ou expiré, erreur Discord | `{SITE_URL}/forgemagie#error=login-failed` |

Le joueur (`fm_players`) est créé ou mis à jour (pseudo, avatar, `first_login_at`) seulement en cas
de succès. Le jeton d'accès Discord n'est jamais stocké.

### `POST /fm/auth/logout` 🔒

Supprime la session. `204`.

## Profil

### `GET /fm/me` 🔒

```json
{ "discordUserId": "2345…", "displayName": "Cyril", "avatarUrl": "https://…",
  "serverId": "11" , "isPrivate": false, "firstLoginAt": "2026-09-30T18:00:00.000Z" }
```

`serverId` vaut `null` tant qu'il n'est pas choisi.

### `PATCH /fm/me` 🔒

Corps : `{ "serverId"?: string, "isPrivate"?: boolean }`. Répond avec le profil mis à jour (`200`)
ou `400` pour une valeur invalide. À la première connexion, le site envoie le serveur actif de son
sélecteur (FR-005).

### `DELETE /fm/me` 🔒

Supprime le profil, ses sessions de connexion, ses captures et ses lignes d'achat (research R10).
`204`. Le site demande une confirmation explicite avant l'appel (FR-007).

## Sessions et dépenses

Forme d'un joueur dans une réponse (FR-015) :

```json
{ "discordUserId": "2345…", "displayName": "Cyril", "avatarUrl": "https://…", "private": false }
```

Joueur privé vu par un autre membre : `{ "discordUserId": null, "displayName": null,
"avatarUrl": null, "private": true }`.

### `GET /fm/sessions?limit=20&before=<openedAt>` 🔒

Sessions de la plus récente à la plus ancienne, pages de 20.

```json
{ "sessions": [
  { "id": "5b7e…", "channelName": "fm-coiffe", "status": "closed",
    "openedAt": "…", "closedAt": "…", "totalKamas": 63472,
    "players": [ { "player": { … }, "spentKamas": 63472 } ] } ],
  "nextBefore": "2026-09-12T…" }
```

`nextBefore` vaut `null` quand il n'y a plus de sessions.

### `GET /fm/sessions/{id}` 🔒

La session, avec en plus le détail par objet (FR-010), trié par total décroissant :

```json
{ "items": [ { "itemName": "Rune Do Air", "itemId": "1557", "quantity": 40,
               "totalKamas": 63472, "averageUnitKamas": 1587 } ] }
```

`404` si la session n'existe pas.

### `GET /fm/players` 🔒

Joueurs **publics** qui ont au moins une capture ou une connexion, avec leur total dépensé. Le
joueur connecté y figure toujours, même privé.

### `GET /fm/players/{discordUserId}` 🔒

Dépenses d'un joueur (FR-016) : total, montant par session (avec `sessionId`, `channelName`,
`openedAt`), montant des imports hors session, détail par objet. `404` si le joueur n'existe pas,
ou s'il est privé et n'est pas le joueur connecté (FR-014).

## Import d'une capture depuis le site

### `POST /fm/imports` 🔒

Appelée **après** validation par le joueur. L'image n'est jamais envoyée (FR-025).

```json
{ "sharePrices": true,
  "lines": [ { "itemName": "Rune Do Air", "itemId": "1557", "quantity": 10, "totalKamas": 15868 } ] }
```

- `itemId` est obligatoire : c'est la ressource reconnue ou choisie par le joueur (FR-024). Il doit
  faire partie des ressources connues, sinon `400`.
- `sharePrices` vaut `true` en Mode communautaire. Les prix sont alors enregistrés avec
  `origin = 'capture'` sur le serveur du profil. Le site a déjà demandé la confirmation d'un prix
  aberrant (specs/007) : le Worker n'écarte **pas** ces prix. En Mode personnel, `false` : aucune
  contribution (`priceStatus: "personal-mode"`), et le site enregistre les prix sur l'appareil.
- Le profil doit avoir un serveur, sinon `409 { "error": "no-server" }`.

Réponse `201` : `{ "captureId": "…", "lines": [ { "index": 0, "unitPriceKamas": 1587,
"priceStatus": "recorded" } ] }`.

## Prix : champ ajouté aux lectures existantes

`GET /community-price` et chaque élément de `GET /community-prices` gagnent `latestOrigin`
(`"manual"`, `"capture"` ou `"bot"`), l'origine de la contribution la plus récente. Le champ est
optionnel pour le site : absent, il vaut `"manual"`. Rien d'autre ne change dans ces réponses.
