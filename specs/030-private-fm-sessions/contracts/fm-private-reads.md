# Contract: lectures FM privées

Amende `specs/025-rune-purchase-import/contracts/`, `specs/027-fm-item-recap/contracts/fm-items-api.md`,
`specs/028-site-started-sessions/contracts/` et `specs/029-channel-ownership/contracts/fm-channels-api.md`.
Authentification inchangée (jeton de session du site). « viewer » = joueur connecté.

Réponse « introuvable » commune : **`404 {"error":"Not found"}`**, identique pour une ressource
inexistante et pour celle d'un autre joueur.

## GET /fm/sessions

- Ne renvoie que les séances dont `owner = viewer`. Pagination (`before`, `nextBefore`) et forme des
  éléments inchangées. `?mine=open` inchangé.

## GET /fm/sessions/{id}

- `200` avec le détail actuel si `owner = viewer` ; sinon **404**.
- `canAttach` = `owner = viewer` et séance non rattachée (ni directement, ni par son salon).

## POST /fm/sessions/{id}/stop · POST /fm/sessions/{id}/resend

- Séance d'un autre ou inexistante : **404** (était 403 pour une séance d'un autre).

## PUT /fm/sessions/{id}/item

- Séance d'un autre, inexistante, ou objet qui n'est pas au viewer : **404** (le `403 not-participant`
  disparaît). `409 already-attached` inchangé.

## DELETE /fm/sessions/{id}/item

- Séance ou objet qui n'est pas au viewer : **404** (était 403).

## GET /fm/players

- `200 {"players":[<viewer>]}` : ne contient plus que le viewer. La page ne l'appelle plus.

## GET /fm/players/{id}

- `id = viewer` : `200`, forme actuelle, avec en plus `sessions[].canOpen: boolean`.
- Sinon : **404**, que le joueur soit public ou privé.

## GET /fm/items/{id}

- `200` si l'objet appartient au viewer ; sinon **404** (même si son propriétaire est public).

## PUT /fm/channels/{id}/item

- Salon d'un autre : **404** (était 403).

## Inchangé

- `POST /fm/sessions` (dont `403 not-your-channel`), `GET /fm/channels`, `POST /fm/channels`,
  `GET /fm/channel-requests/{id}`, `GET|PATCH|DELETE /fm/me`, `POST /fm/imports`, routes du bot, prix
  des runes.
