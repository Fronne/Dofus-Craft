# Contrat : routes de l'API remises dans le dépôt

Forme des réponses : celle de la production (`backups/production-2026-10-12/worker-api-en-ligne.js`).
Toutes les routes hors `/fm/auth/*` et `/fm/bot/*` demandent la clé d'application ; les routes `/fm/*`
des joueurs demandent en plus leur jeton de session.

## Prix externes

| Route | Réponses |
|-------|----------|
| `POST /external-prices/refresh` avec `{ serverId, itemId?, ids }` (1 à 90 identifiants) | `200 { refreshed }` ; `400 invalid` ; `404 unknown-server` ; `429 too-soon` ; `502 unavailable` ; `503 disabled` |

Routes existantes dont la réponse change :

- `GET /community-price` et `GET /community-prices` : le dernier prix peut venir d'Huzounet
  (`latestOrigin: "external"`, et `latestFragile` valant `"stale"` ou `"provisional"` le cas échéant) ;
  un objet sans contribution mais avec un prix externe répond avec `medianAmountKamas: 0` et
  `sampleSize: 0`.
- `GET /latest-price` et `GET /item-prices` : le prix externe remplace la contribution s'il est plus
  récent.

## Séances de FM

| Route | Effet |
|-------|-------|
| `GET /fm/seances` | liste des séances du joueur |
| `GET /fm/seances/:id` | détail : sessions, captures, lignes, lignes ignorées, demande en cours |
| `POST /fm/seances/:id/archive` | `409 not-active` si le salon n'est pas actif |
| `POST /fm/seances/:id/reopen` | `409 not-archived`, `409 channel-limit` |
| `PUT /fm/seances/:id/item` avec `{ fmItemId }` ou `{ item }` | choisit ou crée l'objet |
| `DELETE /fm/seances/:id/item` | retire l'objet |
| `PUT /fm/captures/:id/lines` avec `{ lines: [{ id, quantity, totalKamas }] }` | corrige des lignes ; répond le détail de la séance |

## Routes Forgemagie existantes modifiées

- `POST /fm/sessions` et `POST /fm/channels` acceptent `item` (un nouvel objet créé dans la même
  opération).
- `POST /fm/sessions/:id/item` et `DELETE /fm/sessions/:id/item` ne refusent plus un objet déjà
  rattaché : l'objet se choisit, se change et se retire à tout moment.
- `GET /fm/players` liste les joueurs publics et le joueur lui-même, avec leurs séances.
- `GET /fm/me` ajoute `guildName`.
- `GET /fm/auth/login` accepte `return_to` quand c'est une adresse locale.
- `POST /fm/bot/events` accepte le type `channel-reopened`.
- `GET /fm/bot/commands` sert les demandes `reopen-channel`.
