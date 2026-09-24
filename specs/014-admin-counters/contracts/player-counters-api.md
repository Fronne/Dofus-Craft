# Contrats API : compteurs de joueurs

## Public — Worker des prix communautaires (`VITE_COMMUNITY_API_URL`)

### GET /player-counters

Sans authentification. `200` : tableau de compteurs (forme de data-model.md), triés par
`createdAt` croissant. Tableau vide s'il n'y en a aucun.

## Administration — Worker `dofus-craft-admin` (même origine que la page)

Toutes les routes `/api/*` exigent un jeton Access valide (`Cf-Access-Jwt-Assertion`) dont
l'adresse est `OWNER_EMAIL` ; sinon `403 { "error" }`.

| Méthode | Chemin | Corps | Réponses |
|---------|--------|-------|----------|
| GET | `/api/counters` | — | `200` tableau |
| POST | `/api/counters` | compteur sans `id`, `createdAt`, `updatedAt` | `201` compteur créé ; `400 { error, field }` |
| PATCH | `/api/counters/:id` | champs à modifier (`count`, `atLeast`, …) | `200` compteur ; `400` ; `404` |
| DELETE | `/api/counters/:id` | — | `204` ; `404` |
| GET | `/api/me` | — | `200 { email }` (affiché dans la page) |

Règles de validation : data-model.md (FR-012). `400` indique le premier champ invalide.
