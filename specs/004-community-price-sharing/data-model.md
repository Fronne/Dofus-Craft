# Data Model: Partage communautaire des prix

## CommunityPriceContribution (nouvelle entité, côté serveur)

Une valeur en kamas soumise anonymement par un joueur pour une ressource sur un serveur donné.
Stockée dans la table D1 (SQLite) `community_price_contributions`, derrière le Worker
Cloudflare qui l'expose (`worker/src/index.ts`).

| Field | Type / rule | Purpose |
|-------|-------------|---------|
| `id` | UUID généré à l'insertion, retourné à l'appelant | Preuve de propriété permettant un retrait rétroactif (FR-012) ; jamais utilisé pour relier deux contributions entre elles côté serveur. |
| `resource_id` | texte, identifiant de ressource existant (001) | Associe la contribution à la ressource concernée. |
| `server_id` | texte, identifiant de serveur existant (002) | Associe la contribution au serveur concerné ; jamais mélangée entre serveurs (Edge Cases, spec.md). |
| `amount_kamas` | entier positif ou nul | Montant contribué, mêmes règles de validité que `ResourcePrice.unitPriceKamas` (001). |
| `created_at` | horodatage, généré par la base à l'insertion | Détermine l'inclusion dans la fenêtre glissante de 90 jours (FR-011) et l'ordre pour le filtrage des valeurs aberrantes (FR-010). |

**Champs explicitement absents** : aucun identifiant de joueur, d'appareil, d'adresse IP ou toute
autre donnée technique reliant la ligne à son auteur (FR-007) — c'est une contrainte de schéma,
pas seulement une convention applicative.

**Transitions**:

1. Insertion par un client ayant donné son consentement de partage (`ShareConsent.given = true`) —
   jamais possible autrement (FR-004).
2. Exclusion silencieuse du calcul de médiane après 90 jours glissants, sans suppression
   immédiate de la ligne (FR-011) — simplifie l'implémentation (pas de tâche de purge nécessaire
   pour respecter la fenêtre ; une purge périodique reste possible plus tard sans changer ce
   contrat).
3. Suppression définitive sur demande explicite du joueur qui en connaît l'`id` (retrait
   rétroactif, FR-012, User Story 4 scénario 3).

## CommunityPriceMedian (résultat calculé, côté serveur)

Résultat calculé à la volée par le Worker (`worker/src/median.ts`), jamais stocké : pour une
ressource et un serveur donnés, la médiane des `CommunityPriceContribution` valides.

| Field | Type / rule | Purpose |
|-------|-------------|---------|
| `resourceId` / `serverId` | identifiants | Clé de lecture. |
| `medianAmountKamas` | entier, interpolation linéaire (formule identique à PostgreSQL `percentile_cont(0.5)`) | Le prix communautaire affiché au joueur (FR-001, FR-003). |
| `sampleSize` | entier, nombre de contributions retenues après filtrage | Permet de distinguer une médiane issue d'une seule contribution (Edge Cases, spec.md) d'une médiane représentative de plusieurs joueurs. |

**Règles de calcul** (appliquées dans cet ordre) :

1. Ne considérer que les `CommunityPriceContribution` du `resourceId`/`serverId` demandé, avec
   `created_at` dans les 90 derniers jours glissants (FR-011).
2. Écarter les valeurs statistiquement aberrantes par la méthode de l'écart interquartile avant de
   calculer la médiane (FR-010).
3. Si aucune contribution ne reste après filtrage, aucun résultat n'est renvoyé pour ce
   `resourceId`/`serverId` — le client interprète cette absence comme « pas encore de données »
   (FR-002), jamais comme un prix à zéro.

Aucune route du Worker n'expose jamais une `CommunityPriceContribution` individuelle : seule cette
valeur agrégée est lisible par le client (garantit FR-007 au niveau du backend, pas seulement côté
application).

## ShareConsent (nouvelle entité, côté client)

Préférence individuelle mémorisée localement, distincte du `PriceModePreference` existant
(003-community-price-mode) — voir contrat détaillé dans
[`contracts/share-consent.md`](./contracts/share-consent.md).

| Field | Type / rule | Purpose |
|-------|-------------|---------|
| `given` | booléen, `false` par défaut | Détermine si les prix personnels du joueur sont éligibles à devenir des `CommunityPriceContribution` (FR-004, FR-005, FR-006). |

## LocalContributionRecord (nouvelle entité, côté client)

Trace locale des contributions envoyées par ce joueur depuis cet appareil, jamais transmise au
serveur telle quelle — seul l'`id` individuel est envoyé lors d'une demande de retrait.

| Field | Type / rule | Purpose |
|-------|-------------|---------|
| `id` | UUID reçu du serveur à l'insertion | Permet une demande de retrait rétroactif (FR-012). |
| `resourceId` / `serverId` | identifiants | Permet d'afficher au joueur, s'il le souhaite, quelles contributions il a envoyées, sans lien vers son identité côté serveur. |

## Rappel — Prix personnel et mode communautaire (001/002/003, schéma inchangé)

Cette fonctionnalité ne modifie ni le schéma ni le dépôt de `ResourcePrice`, `PinnedItemPrice`
(001/002) ni de `PriceModePreference` (003). Le prix personnel prévaut toujours à l'affichage et
dans les calculs quand un `CommunityPriceMedian` coexiste pour la même ressource/serveur (FR-008) —
c'est une règle d'affichage/calcul côté client, jamais une fusion de données.

## Relationships

```text
ShareConsent.given (client)
   └── autorise ──> insertion de CommunityPriceContribution (serveur)

CommunityPriceContribution (serveur, ressource + serveur, sans identité)
   └── agrégée en ──> CommunityPriceMedian (calculé par le Worker à la lecture)
   └── référencée par id dans ──> LocalContributionRecord (client, pour retrait rétroactif)

ResourcePrice / PinnedItemPrice (001/002, scoped par serveur)
   └── prévaut toujours sur ──> CommunityPriceMedian à l'affichage et dans les calculs (FR-008)
   (aucune fusion : les deux valeurs restent consultables séparément)

PriceModePreference (003)
   └── détermine si ──> le joueur voit l'option de consentement de partage et les prix communautaires
   (ShareConsent reste une préférence distincte, jamais activée automatiquement par le mode, FR-004)
```
