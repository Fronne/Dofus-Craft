# Contrat : `POST /external-prices/refresh` vu du site

La route existe déjà (fonctionnalité 045, `worker/src/index.ts`) ; ce document fixe ce que le site envoie
et comment il lit chaque réponse. Le Worker reçoit un seul ajout : la limite horaire par onglet (FR-017).
Une demande sans `tab` (page Recherche du site en ligne) se comporte exactement comme avant.

## Demande

```http
POST {VITE_COMMUNITY_API_URL}/external-prices/refresh
Authorization: Bearer {VITE_COMMUNITY_API_KEY}
Content-Type: application/json

{ "serverId": "mikhal", "ids": ["1524", "1549"], "tab": "runes", "last": false }
```

- `ids` : 1 à 90 identifiants, chaînes de 1 à 9 chiffres, sans doublon ;
- `tab` : `resources`, `consumables`, `animals` ou `runes` — l'onglet chargé ; toute autre valeur : 400 ;
- `last` : `true` sur la dernière demande du chargement ;
- `itemId` n'est pas envoyé (il sert à la page Recherche pour marquer l'objet fabriqué).

## Limite horaire (côté API, `worker/src/huzounet.ts`)

- Avec `tab`, un objet lu depuis moins d'**une heure** (au lieu de deux minutes) n'est pas redemandé.
- Quand la demande `last: true` réussit, l'API note l'heure pour (onglet, serveur) dans
  `external_price_sync` (`source = 'huzounet-hdv-<onglet>'`) — une ligne écrite, aucune migration.
- Toute demande avec ce `tab` dans l'heure qui suit : 429 `{ "error": "hourly-limit", "retryAt": "<date ISO>" }`,
  sans rien lire chez Huzounet. Un chargement arrêté ou en échec n'écrit pas cette ligne.
- La réponse 200 d'une demande avec `tab` porte aussi `requests` (nombre de lectures chez Huzounet) :
  à 0, le site n'attend pas avant la demande suivante.

## Fonction du site

`refreshExternalPrices(serverId, ids, { tab, last }): Promise<RefreshOutcome>` dans
`src/services/community-price-api.ts`. Ne lève jamais d'exception.

| Réponse de l'API | `RefreshOutcome` | Suite côté chargement |
|------------------|------------------|------------------------|
| 200 `{ "refreshed": n }` (n nombre) | `{ status: 'ok', refreshed: n }` | tranche réussie ; si n > 0 les lectures suivantes sont fraîches pendant 60 s |
| 429 `hourly-limit` | `{ status: 'hourly-limit', retryAt }` | plus aucune demande de relecture ; les prix déjà connus de l'API sont lus (`GET /community-prices`) et écrits dans le carnet pour tout l'onglet, puis arrêt avec l'heure du prochain chargement possible |
| 429 autre (`too-soon`, intervalle de 5 s ou limiteur) | `{ status: 'too-soon' }` | attendre 5,5 s, redemander la même tranche, 3 fois au plus |
| 404 (`unknown-server`) | `{ status: 'unknown-server' }` | arrêt |
| 503 (`disabled`) | `{ status: 'disabled' }` | arrêt |
| 502 (`unavailable`) | `{ status: 'unavailable' }` | arrêt |
| autre statut (400, 401, 5xx), corps illisible, `refreshed` absent | `{ status: 'unavailable' }` | arrêt |
| `fetch` rejeté (hors ligne, API injoignable) | `{ status: 'unreachable' }` | arrêt |

## Lecture qui suit une tranche réussie

`getCommunityPrices(ids, serverId)` — route `GET /community-prices`, inchangée. Le site y lit
désormais, par prix :

| Champ | Lecture |
|-------|---------|
| `latestOrigin: 'external'` | accepté (jusqu'ici retiré comme valeur inconnue) |
| `latestFragile: 'stale' \| 'provisional'` | gardé si l'origine est `external` ; toute autre valeur est retirée |
| `medianAmountKamas: 0`, `sampleSize: 0` | prix que seul Huzounet connaît : prix valide, sans médiane |

Si cette lecture échoue (`unavailable`), la tranche reste comptée comme traitée (l'API a bien lu les
prix) mais rien n'est écrit dans le carnet pour elle ; le chargement s'arrête avec le message d'API
injoignable, et un nouveau clic reprendra ces prix sans rien redemander à Huzounet avant une heure.
