# Data Model: Comptage anonyme des visites

## AppVisit (nouvelle entité, côté serveur)

Une ligne par appareil et par jour, dans la même base D1 que
`community_price_contributions` (`dofus-craft-community-prices`), derrière le même Worker
Cloudflare (`worker/src/index.ts`).

| Field | Type / rule | Purpose |
|-------|-------------|---------|
| `device_id` | texte, UUID généré côté client | Identifie l'appareil, sans identifier la personne (FR-002/FR-004). Fait partie de la clé primaire composite. |
| `day` | texte, `YYYY-MM-DD`, calculé côté serveur à la réception de la requête | Le jour de cette présence. Fait partie de la clé primaire composite. |

**Clé primaire composite** : `(device_id, day)`. C'est le seul mécanisme de déduplication
(FR-005) — aucune logique applicative supplémentaire, voir research.md.

**Champs explicitement absents** : aucun prix, aucune ressource, aucun serveur, aucune adresse IP,
aucune information permettant d'identifier personnellement le joueur (FR-004) — même contrainte de
schéma que `community_price_contributions` (specs/004, FR-010), appliquée ici à une table entièrement
distincte et sans aucun lien entre les deux (research.md, « Deux identifiants d'appareil distincts »).

**Transitions**:

1. Insertion (ou no-op si la ligne existe déjà) à chaque montage de `AppShell` côté client — jamais
   sur un événement de prix, de navigation interne, ou de changement de mode (FR-001/FR-003).
2. Aucune mise à jour ni suppression prévue par cette fonctionnalité : une ligne, une fois créée,
   reste telle quelle. Une politique de rétention/purge éventuelle est hors périmètre de cette
   spécification (voir Assumptions, spec.md).

## Identifiant d'appareil (présence, côté client)

Chaîne UUID aléatoire, générée par `crypto.randomUUID()` et conservée dans `localStorage` sous la
clé `craftcheck-visit-device-id`, résolue par `getOrCreateVisitDeviceId()`
(`src/persistence/visit-device-id.ts`, lui-même un fin wrapper autour du helper générique
`src/persistence/device-id.ts` — voir research.md). Une seule valeur par appareil, indépendante de
toute ressource/serveur/collection.

| Field | Type / rule | Purpose |
|-------|-------------|---------|
| (valeur unique) | chaîne UUID | Identifie l'appareil auprès de `app_visits.device_id`, sans jamais identifier le joueur (FR-002/FR-004). |

**Transitions**: identiques à l'identifiant d'appareil des contributions de prix (specs/004,
révision 5) — génération paresseuse au premier appel, réutilisation ensuite, dégradation sans
exception si `localStorage` est indisponible (un identifiant est généré à la volée pour cet appel
sans être persisté).

**Explicitement distinct** de `craftcheck-community-device-id` (specs/004) : aucune table, aucune
requête, aucun code ne relie les deux valeurs entre elles (research.md).

## Relationships

```text
Montage de AppShell (une fois par session/rechargement de page)
   └── lit ──> Identifiant d'appareil (présence, génère au besoin)
          └── envoyé à ──> POST /visit (fire-and-forget, jamais bloquant — FR-007)
                 └── day calculé côté serveur ──> AppVisit (device_id, day)
                        (INSERT OR IGNORE — clé primaire composite déduplique, FR-005)

AppVisit
   └── strictement indépendante de ──> CommunityPriceContribution (specs/004) — même base D1,
       aucune colonne, requête ou identifiant partagé entre les deux tables
```
