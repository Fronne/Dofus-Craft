# Contrat : client de l'API Forgemagie (`src/services/fm-api.ts`)

Toutes les fonctions renvoient `FmResult<T>` et ne lèvent jamais :
`ok` · `unauthorized` (401, le jeton est effacé) · `not-found` (404) · `error` avec `code` (autre 4xx) ·
`unavailable` (réseau, 5xx, réponse de forme inattendue).

| Fonction | Route | Corps | Données |
|----------|-------|-------|---------|
| `getFmMe()` | `GET /fm/me` | — | `FmMe` (+ `guildName`) |
| `updateFmMe(changes)` | `PATCH /fm/me` | `{ serverId? , isPrivate? }` | `FmMe` |
| `deleteFmMe()` | `DELETE /fm/me` | — | — |
| `logoutFm()` | `POST /fm/auth/logout` | — | — |
| `getFmSeances()` | `GET /fm/seances` | — | `FmSeance[]` (champ `seances`) |
| `getFmSeance(id)` | `GET /fm/seances/:id` | — | `FmSeanceDetail` |
| `archiveFmSeance(id)` | `POST /fm/seances/:id/archive` | — | `FmSeanceDetail` |
| `reopenFmSeance(id)` | `POST /fm/seances/:id/reopen` | — | `FmSeanceDetail` — erreur `channel-limit` |
| `setFmSeanceItem(id, target)` | `PUT /fm/seances/:id/item` | `{ fmItemId }` ou `{ item: { itemId, itemName, imageUrl } }` | `FmSeanceDetail` |
| `removeFmSeanceItem(id)` | `DELETE /fm/seances/:id/item` | — | `FmSeanceDetail` |
| `correctFmCapture(captureId, lines)` | `PUT /fm/captures/:id/lines` | `{ lines: [{ id, quantity, totalKamas }] }` | `FmSeanceDetail` |
| `renameFmItem(id, label)` | `PATCH /fm/items/:id` | `{ label }` | `FmOwnedItem` |
| `importFmCapture(lines, sharePrices, sessionId)` | `POST /fm/imports` | `{ sharePrices, lines, sessionId }` | `{ captureId, lines }` — erreurs `no-server`, `session-not-open` |
| `createFmSeance(name, target?)` | `POST /fm/channels` | `{ name, fmItemId }` ou `{ name, item }` ; sans objet `{ name, fmItemId: null }` | `{ requestId }` — erreur `channel-limit` |
| `getFmChannelRequest(id)` | `GET /fm/channel-requests/:id` | — | `{ id, status, error?, channelId?, sessionId? }` |
| `startFmSession(seanceId)` | `POST /fm/sessions` | `{ channelId }` | `{ id }` — erreur `channel-busy` |
| `stopFmSession(sessionId)` | `POST /fm/sessions/:id/stop` | — | `{ id }` — erreur `not-open` |
| `resendFmSession(sessionId)` | `POST /fm/sessions/:id/resend` | — | `{ id }` |
| `getFmPlayers()` | `GET /fm/players` | — | `FmGroupPlayer[]` (champ `players`) |
| `getFmPlayer(discordUserId)` | `GET /fm/players/:id` | — | `FmProfile` |

`fmLoginUrl()` : `…/fm/auth/login`, suivi de `?return_to=<origine>` sur `localhost` / `127.0.0.1`.

## Formes

```ts
FmSeance = { id, name, state: 'running' | 'paused' | 'archived', discord: string,
             fmItem: { id, name, itemName, label, imageUrl } | null,
             totalKamas, sessionCount, captureCount, createdAt, lastActivityAt }

FmSeanceDetail = FmSeance & {
  quantity, items: FmItemSummary[],                     // + corrected?, readNames?
  sessions: { id, status: 'open' | 'closed', openedAt, closedAt?, totalKamas, canStop,
              sync?: { status, error } | null,
              captures: { id, createdAt, origin: 'bot' | 'capture', spentKamas, items,
                          corrected, lines, ignored }[] }[],
  request: { type: 'archive' | 'reopen', status: 'pending' | 'failed' | 'stale', error } | null,
  canResume, canArchive, canReopen }

ligne  = { id, itemName, quantity, totalKamas, unitPriceKamas, originalQuantity, originalTotalKamas,
           corrected, priceStatus }
ignorée = { itemName, quantity, totalKamas }

FmGroupPlayer = { displayName, avatarUrl, isMe, private, totalKamas, seanceCount, lastActivityAt,
                  seances: { name, state, fmItem: { name, imageUrl } | null, totalKamas, sessionCount,
                             lastActivityAt }[] }
```

Valeurs par défaut à la lecture : `capture.corrected = false`, `capture.lines = []`,
`capture.ignored = []`, `player.seances = []`, `profile.fmItems = []`, `session.canOpen = false`.

## Libellés d'état

| Donnée | Libellé |
|--------|---------|
| `running` / `paused` / `archived` | En cours / En pause / Archivée |
| `sync.status` `pending` / `opened` / `stale` / `failed` / `cancelled` | En attente de Discord… / Ouverte dans Discord / Non transmise à Discord / Échec dans Discord (: erreur) / Jamais ouverte dans Discord |
| origine d'une capture `bot` / `capture` | Discord / Site |
| `request` | « L'archivage du salon » ou « La réouverture du salon » + « est demandé à Discord… » / « n'est pas encore fait dans Discord : le bot ne répond pas. » / « a échoué dans Discord (: erreur). » |
| erreur `channel-limit` | Tu as déjà 5 séances de FM non archivées : archives-en une avant … |
| erreur `channel-busy` | Une session est déjà ouverte dans cette séance. |
| erreur `not-open` | Cette session est déjà arrêtée. |
