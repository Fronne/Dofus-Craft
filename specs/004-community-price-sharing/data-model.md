# Data Model: Partage communautaire des prix

## CommunityPriceContribution (nouvelle entité, côté serveur)

Une valeur en kamas soumise anonymement par un joueur pour une ressource sur un serveur donné.
Stockée dans la table D1 (SQLite) `community_price_contributions`, derrière le Worker
Cloudflare qui l'expose (`worker/src/index.ts`).

| Field | Type / rule | Purpose |
|-------|-------------|---------|
| `id` | UUID généré à l'insertion, retourné à l'appelant | Clé primaire de ligne ordinaire ; depuis la révision 2, le client ne la conserve plus (le retrait rétroactif a été retiré du produit) — jamais utilisé pour relier deux contributions entre elles côté serveur. |
| `resource_id` | texte, identifiant de ressource existant (001) | Associe la contribution à la ressource concernée. |
| `server_id` | texte, identifiant de serveur existant (002) | Associe la contribution au serveur concerné ; jamais mélangée entre serveurs (Edge Cases, spec.md). |
| `amount_kamas` | entier positif ou nul | Montant contribué, mêmes règles de validité que `ResourcePrice.unitPriceKamas` (001). |
| `created_at` | horodatage, généré par la base à l'insertion | Détermine l'inclusion dans la fenêtre glissante de 90 jours (FR-013) et l'ordre pour le filtrage des valeurs aberrantes (FR-012). |
| `device_id` *(révision 5)* | texte, UUID généré côté client, `NOT NULL DEFAULT ''` | Identifiant d'appareil anonyme (FR-010/FR-021 à FR-023) — permet de reconnaître que plusieurs lignes proviennent du même appareil, sans jamais identifier le joueur. Les lignes créées avant la révision 5 ont une valeur vide (migration `worker/migrations/0001_add_device_id.sql`), qu'aucune ligne postérieure ne réutilisera jamais (un `deviceId` généré par `crypto.randomUUID()` n'est jamais une chaîne vide). |

**Champs explicitement absents** : aucun identifiant de joueur (nom, pseudo, compte), adresse IP, ou
toute autre donnée personnelle reliant la ligne à son auteur (FR-010) — c'est une contrainte de
schéma, pas seulement une convention applicative. Depuis la révision 5, `device_id` est une exception
volontaire et bornée à cette seule contrainte : il identifie un appareil, jamais une personne.

**Transitions**:

1. *(Depuis la révision 4)* Insertion par un client à la perte de focus d'un champ de prix de
   ressource en Mode communautaire, uniquement lorsque sa valeur a réellement changé depuis le
   déverrouillage du champ (FR-017/FR-020) — jamais par un minuteur, un chargement de page, ni par
   un blur sans changement. Remplace l'ancienne action explicite de partage groupé (révisions 1-3,
   retirée) ; ni l'une ni l'autre n'a jamais été automatique « en continu ». *(Depuis la révision 5)*
   Cette insertion inclut désormais le `deviceId` résolu localement (généré s'il n'existait pas
   encore sur cet appareil, réutilisé sinon — FR-021).
2. Exclusion silencieuse du calcul de médiane après 90 jours glissants, sans suppression
   immédiate de la ligne (FR-013) — simplifie l'implémentation (pas de tâche de purge nécessaire
   pour respecter la fenêtre ; une purge périodique reste possible plus tard sans changer ce
   contrat). Depuis la révision 2, c'est le seul mécanisme par lequel une contribution cesse de
   compter — il n'existe plus de suppression sur demande individuelle (retrait rétroactif retiré,
   voir research.md).

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
   `created_at` dans les 90 derniers jours glissants (FR-013).
2. Écarter les valeurs statistiquement aberrantes par la méthode de l'écart interquartile avant de
   calculer la médiane (FR-012).
3. Si aucune contribution ne reste après filtrage, aucun résultat n'est renvoyé pour ce
   `resourceId`/`serverId` — le client interprète cette absence comme « pas encore de données »
   (FR-002), jamais comme un prix à zéro.

Aucune route du Worker n'expose jamais une `CommunityPriceContribution` individuelle : seule cette
valeur agrégée est lisible par le client (garantit FR-010 au niveau du backend, pas seulement côté
application).

## Carnet de prix Mode communautaire (côté client)

Second carnet de prix local, par ressource et serveur, strictement indépendant du carnet Mode
personnel (`ResourcePrice`/001) — voir FR-005/FR-006 et research.md (« Isolation des deux carnets
de prix »). Même forme que `ResourcePrice`, porté par un store IndexedDB physiquement distinct
(`community-mode-prices-by-server`, via `createServerScopedPriceStore`), pas par un filtre sur le
store existant.

| Field | Type / rule | Purpose |
|-------|-------------|---------|
| `resourceId` / `serverId` | identifiants | Clé de lecture, jamais mélangée entre serveurs (comme le carnet Mode personnel, 002). |
| `unitPriceKamas` | entier positif ou nul | Valeur affichée et utilisée pour le calcul de rentabilité tant que le Mode communautaire est actif. |
| `updatedAt` | horodatage de la dernière écriture locale | Date de la dernière modification par le joueur **ou** du dernier pré-remplissage automatique (voir Transitions). |

**Transitions**:

1. Pré-remplissage automatique : quand une ressource n'a encore aucune entrée dans ce carnet et
   qu'un `CommunityPriceMedian` est disponible pour elle, sa valeur est écrite ici immédiatement
   (FR-001, FR-004) — ce n'est pas un état visuel temporaire, c'est une écriture normale dans le
   carnet.
2. Modification par le joueur : à tout moment, remplace la valeur existante (pré-remplie ou déjà
   modifiée) exactement comme une saisie dans le carnet Mode personnel.
3. Garde anti-écrasement : une fois qu'une entrée existe pour une ressource (issue de 1 ou 2), un
   rafraîchissement *automatique et non sollicité* (chargement de page, minuteur de 5 minutes) ne
   déclenche jamais une réécriture de cette entrée (FR-006).
4. *(Depuis la révision 4)* Réécriture volontaire après un envoi réussi : quand la transmission
   d'une modification (transition 2 de `CommunityPriceContribution` ci-dessus) réussit, la médiane
   recalculée renvoyée par le serveur remplace la valeur brute tout juste saisie par le joueur
   (FR-018) — cette réécriture n'est pas soumise à la garde de la transition 3, puisqu'elle découle
   directement de l'action que le joueur vient lui-même de terminer sur ce champ, pas d'un
   rafraîchissement en arrière-plan (voir research.md, révision 4, « Écrire la médiane recalculée
   dans le carnet, au-delà de la garde anti-écrasement »).

**Explicitement absent** : aucune référence vers le carnet Mode personnel ni inversement — les deux
structures ne partagent ni store, ni clé, ni logique de fusion.

## Identifiant d'appareil (côté client, révision 5)

Chaîne UUID aléatoire, générée par `crypto.randomUUID()` et conservée dans `localStorage` sous la
clé `craftcheck-community-device-id`, résolue par `getOrCreateDeviceId()`
(`src/persistence/community-device-id.ts`). Contrairement aux deux carnets de prix (`ResourcePrice`/
carnet Mode communautaire), ce n'est pas un carnet par ressource/serveur : une seule valeur par
appareil, partagée par toutes les contributions envoyées depuis cet appareil, quel que soit le
serveur ou la ressource concernée.

| Field | Type / rule | Purpose |
|-------|-------------|---------|
| (valeur unique, pas d'enregistrement structuré) | chaîne UUID | Identifie l'appareil auprès du backend (`device_id`), sans jamais identifier le joueur qui l'utilise (FR-010, FR-021 à FR-023). |

**Transitions**:

1. Génération paresseuse : au premier appel de `getOrCreateDeviceId()` (donc à la première
   contribution envoyée depuis cet appareil), aucune valeur n'existe encore sous cette clé
   `localStorage` — une nouvelle est générée et écrite immédiatement (FR-021).
2. Réutilisation : tout appel suivant lit la valeur déjà stockée et la retourne telle quelle, sans
   jamais la régénérer (FR-021) — jusqu'à ce que les données locales du navigateur soient effacées.
3. Dégradation sans `localStorage` : si la lecture ou l'écriture échoue (navigation privée,
   quota dépassé, stockage désactivé — même risque que documenté pour
   `src/persistence/server-preference.ts`), un identifiant est généré à la volée pour cet appel sans
   pouvoir être persisté ; la contribution en cours reste envoyée normalement, seule la
   reconnaissance entre contributions successives du même appareil est perdue tant que le stockage
   reste indisponible. Aucune exception ne doit jamais interrompre une contribution pour cette
   raison.

**Explicitement absent** : aucun lien vers une identité de joueur, un compte, ou une donnée
personnelle quelconque — cet identifiant ne distingue que des appareils entre eux, jamais des
personnes.

## Rappel — Prix personnel, mode communautaire (001/002/003, schéma inchangé)

Cette fonctionnalité ne modifie ni le schéma ni le dépôt de `ResourcePrice`, `PinnedItemPrice`
(001/002) ni de `PriceModePreference` (003). Le carnet Mode personnel (`ResourcePrice`) et le
nouveau carnet Mode communautaire (ci-dessus) sont strictement indépendants (FR-005) : l'affichage
et le calcul de rentabilité utilisent exclusivement le carnet du mode actif, jamais une combinaison
des deux — ceci remplace la règle de précédence de la première itération (« le prix personnel
prévaut toujours »).

## Relationships

```text
Commit d'un champ de prix de ressource en Mode communautaire (perte de focus après changement réel)
   ├── seule voie d'insertion de ──> CommunityPriceContribution (serveur)
   │      (jamais par un minuteur, un chargement de page, un changement de mode, ou un blur sans
   │      changement — FR-017/FR-020 ; remplace l'ancienne action de partage groupé, révisions 1-3)
   └── (depuis la révision 5) lit ──> Identifiant d'appareil (client, génère au besoin)
          └── inclus dans ──> CommunityPriceContribution.device_id (FR-021/FR-022)

CommunityPriceContribution (serveur, ressource + serveur, sans identité)
   └── agrégée en ──> CommunityPriceMedian (calculé par le Worker à la lecture)

CommunityPriceMedian
   ├── pré-remplit (une seule fois par ressource, si aucune entrée n'existe déjà) ──> Carnet de prix Mode communautaire
   └── (depuis la révision 4) réaffichée et réécrite dans le carnet immédiatement après un commit
       réussi pour cette même ressource ──> Carnet de prix Mode communautaire (FR-018/FR-019)

ResourcePrice (carnet Mode personnel, 001/002, scoped par serveur)
   └── strictement indépendant de ──> Carnet de prix Mode communautaire (FR-005 ; aucune lecture,
       écriture ni fusion croisée, dans un sens comme dans l'autre)

PriceModePreference (003)
   └── détermine ──> quel carnet (Mode personnel ou Mode communautaire) est affiché et utilisé pour
       le calcul de rentabilité, et si un commit sur un champ de prix peut déclencher une transmission
```
