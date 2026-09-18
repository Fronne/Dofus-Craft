# Visit API Contract

## Scope

Ce contrat fixe une nouvelle route sur le Worker Cloudflare déjà existant
(`worker/src/index.ts`, même base D1 que specs/004-community-price-sharing) et le service client
`src/services/visit-api.ts`, suivant le même pattern d'adaptateur `fetch` que
`community-price-api.ts`. Aucune route existante (`GET`/`POST /community-price`) n'est modifiée.

## Enregistrer une présence

| Operation | Input | Output | Required behavior |
|-----------|-------|--------|--------------------|
| `recordVisit()` (`src/services/visit-api.ts`) | aucun (résout `deviceId` en interne via `getOrCreateVisitDeviceId()`) | `void` — ne renvoie jamais rien d'exploitable, même en cas de succès | Envoie `POST /visit` avec `{ deviceId }`. Ne lève jamais d'exception : une erreur réseau ou une réponse non `ok` est capturée silencieusement (même pattern que `submitCommunityPrice`/`getCommunityPrice`), FR-007. Appelée une seule fois, au montage de `AppShell.tsx`. |
| `POST /visit` (Worker) | `{ deviceId: string }` | `204 No Content` sur succès | Valide que `deviceId` est une chaîne non vide (sinon `400`, même style que `POST /community-price`). Calcule `day` côté serveur (`YYYY-MM-DD`, research.md) — jamais fourni par le client. Exécute `INSERT OR IGNORE INTO app_visits (device_id, day) VALUES (?, ?)` : un second appel le même jour pour le même appareil ne produit ni erreur ni ligne supplémentaire (FR-005). N'écrit jamais dans `community_price_contributions` ni ne la lit. |

## Authentification

Réutilise le même en-tête `Authorization: Bearer <COMMUNITY_API_KEY>` que `POST /community-price` —
même secret déjà configuré, aucun nouveau secret à provisionner. Comme pour l'écriture des prix,
c'est un déterrent léger contre les requêtes venant d'ailleurs que cette application, pas une
identité de joueur (le même commentaire déjà présent dans `worker/src/index.ts` pour
`POST /community-price` s'applique ici à l'identique).

## Ce que ce contrat garantit

- `POST /visit` MUST NOT jamais accepter ni stocker de donnée de prix, de ressource ou de serveur —
  son schéma d'entrée (`{ deviceId }`) ne permet structurellement pas d'en inclure (FR-004).
- Aucune route ne permet de lire le contenu de `app_visits` — ni `GET /visit`, ni aucun champ
  additionnel sur `GET /community-price` (FR-006). La seule façon de consulter ces données reste une
  requête manuelle contre D1 (`wrangler d1 execute`), réservée au mainteneur.
- Un échec de `recordVisit()` (réseau, Worker indisponible, réponse d'erreur) MUST NOT jamais
  interrompre le rendu de `AppShell` ni afficher une erreur au joueur (FR-007) — l'appel est fire-and-forget,
  son résultat n'est jamais attendu par un rendu conditionnel.

## Ce que ce contrat ne couvre pas

Le format exact des en-têtes ou le détail de la route (`worker/src/index.ts`) reste un détail
d'implémentation, pas une exigence produit — voir `worker/src/index.ts` pour la réalisation actuelle,
sans que cela ne modifie les garanties ci-dessus.
