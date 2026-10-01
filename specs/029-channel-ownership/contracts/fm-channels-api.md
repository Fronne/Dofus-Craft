# Contrat : salons FM personnels

## Pour le bot (clé `FM_BOT_API_KEY`)

### Nouveaux événements — `POST /fm/bot/events`

Mêmes champs communs que specs/025 (`type`, `eventId`, `channelId`, `channelName`, `occurredAt`).

| `type` | Champs en plus | Effet |
|---|---|---|
| `channel-created` | `author` (propriétaire, comme dans `capture`), `commandId` facultatif | Le salon devient un salon FM personnel actif ; s'il répond à une demande du site, l'objet choisi lui est rattaché |
| `channel-archived` | — | Le salon passe archivé |
| `channel-deleted` | — | Le salon passe supprimé |

Ordre attendu à la création d'un salon : `channel-created`, puis `session-start` (avec `author`).
À l'archivage : `session-stop` (s'il y avait une session), puis `channel-archived`.

### Nouvelle demande — `GET /fm/bot/commands`

```json
{ "id": "c3…", "type": "create-channel", "guildId": "8899…", "name": "mon rtograf",
  "player": { "id": "42", "displayName": "Cyril" }, "item": { "name": "Rtograf PA" } | null }
```

`guildId` (ajouté le 2026-10-01) : le serveur Discord du site, celui dont ses joueurs sont membres. Le
bot peut être sur plusieurs serveurs ; il crée le salon sur celui-là.

Le bot crée le salon comme depuis le bouton (nom nettoyé, préfixé par le pseudo, permissions,
catégorie), envoie `channel-created` avec `commandId`, puis `session-start`, et confirme :

```json
POST /fm/bot/commands/{id}/ack  { "status": "done", "channelId": "1200…" }
POST /fm/bot/commands/{id}/ack  { "status": "failed", "error": "Limite de 5 salons atteinte" }
```

## Pour le site (jeton de session)

| Route | Effet |
|---|---|
| `GET /fm/channels` | Salons **actifs du joueur** : `{ channelId, channelName, status, busy, fmItem }` |
| `POST /fm/channels` `{ name, fmItemId? }` | Demande la création d'un salon : `202 { "requestId": "…" }` ; `409 channel-limit` ; `400` nom vide ou de plus de 30 caractères ; `404` objet inconnu ou d'un autre joueur |
| `GET /fm/channel-requests/{id}` | `{ id, status: "pending" \| "done" \| "failed", error, channelId, sessionId }` (demande du joueur seulement) |
| `PUT /fm/channels/{id}/item` `{ fmItemId \| null }` | Rattache le salon à un de ses objets ou l'en détache (propriétaire seulement : `403` sinon) |
| `POST /fm/sessions` (specs/028) | Le salon doit être un salon actif du joueur : `403 not-your-channel` sinon |
| `GET /fm/players/{id}` | Gagne `fmChannels` (actifs et archivés), même visibilité que le profil |
