# Contrat : démarrer et arrêter une session depuis le site

Routes 🔒 du Worker (jeton de session du site, specs/025).

## `GET /fm/channels`

Salons que le bot a déjà utilisés : `{ "channels": [ { "channelId": "1100…", "channelName": "fm-anneau",
"busy": false } ] }`, triés par nom. `busy` : une session y est ouverte.

## `POST /fm/sessions`

Corps : `{ "channelId": "1100…", "fmItemId": "3f2…" | null }`.

| Statut | Quand |
|---|---|
| `201` | Session créée ouverte, `origin: "site"`, `sync.status: "pending"` ; renvoie le détail de la session |
| `404` | Salon inconnu, ou objet inconnu ou d'un autre joueur |
| `409 { "error": "channel-busy" }` | Le salon a déjà une session ouverte (FR-002) |

## `POST /fm/sessions/{id}/stop`

Propriétaire seulement (`403` sinon), session ouverte seulement (`409 { "error": "not-open" }`).
`200` avec le détail : la session est `closed` ; une commande `close` est créée, ou l'`open` en attente
est annulée (FR-010).

## `POST /fm/sessions/{id}/resend`

Propriétaire seulement, session du site ouverte avec `sync.status` `pending`, `stale` ou `failed`.
Annule la commande `open` en cours et en crée une nouvelle. `200` avec le détail.

## Champs ajoutés aux sessions

`GET /fm/sessions` et `GET /fm/sessions/{id}` : chaque session gagne

```json
"owner": { "discordUserId": "42", "displayName": "Cyril", "avatarUrl": null, "private": false } | null,
"origin": "site" | "discord",
"sync": { "status": "pending" | "opened" | "failed" | "cancelled" | "stale", "error": null } | null,
"canStop": true
```

`sync` vaut `null` pour une session démarrée dans Discord. `stale` : en attente depuis plus de
10 minutes. `GET /fm/sessions?mine=open` ne renvoie que les sessions ouvertes du joueur connecté.

## `POST /fm/imports` (specs/025) — champ ajouté

`sessionId` facultatif : une session **ouverte** dont le joueur connecté est propriétaire. Les achats
y sont ajoutés au lieu d'être hors session. `409 { "error": "session-not-open" }` si elle n'est plus
ouverte ; `403` si elle appartient à un autre joueur.
