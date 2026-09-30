# Research: Salons FM personnels créés par le bot

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-09-30

Sources lues : `worker/src/fm/` (bot-events, bot-commands, site-sessions, items, reads), specs/027 et
specs/028, le bot Botomoux (`main.py`).

## R1. Une table des salons personnels

**Decision** : table `fm_channels` (migration `0010`) : identifiant du salon Discord, nom, propriétaire,
état (`active`, `archived`, `deleted`), objet en FM rattaché, dates de création et d'archivage. Elle est
remplie **uniquement par le bot** (événement `channel-created`), jamais déduite de l'historique : les
anciens salons ordinaires n'y sont pas et ne sont plus proposés au démarrage depuis le site (FR-010).

**Rationale** : le bot crée le salon et en connaît le propriétaire avec certitude ; la table évite toute
heuristique (la première version de la spec, « premier joueur à l'utiliser », est abandonnée).

## R2. Ce que le bot envoie au site

**Decision** : trois nouveaux types d'événement sur `POST /fm/bot/events` (même clé, même idempotence
par `eventId`) :
- `channel-created` : `author` (propriétaire), `channelId`, `channelName`, et `commandId` facultatif
  quand la création répond à une demande du site ;
- `channel-archived` et `channel-deleted` : `channelId`.

La session ouverte à la création du salon passe par l'événement existant `session-start` (avec
`author`), envoyé **après** `channel-created`.

## R3. Créer un salon depuis le site

**Decision** : nouvelle demande au bot `create-channel` (file de specs/028), avec le nom demandé, le
joueur et l'objet facultatif. Le site la crée par `POST /fm/channels` et répond aussitôt avec
l'identifiant de la demande ; il suit son état par `GET /fm/channel-requests/{id}` (`pending`, `done`
avec le salon créé, `failed` avec la raison). Le bot confirme par l'`ack` habituel, en ajoutant
`channelId` ; l'événement `channel-created` porte `commandId`, ce qui rattache l'objet choisi au salon.

**Rationale** : le salon Discord n'existe pas encore quand le joueur clique ; il n'y a donc pas de
session à montrer tout de suite, seulement une demande « salon en cours de création ». Le formulaire
du site interroge la demande toutes les 3 secondes, puis ouvre la session créée.

## R4. Limite de 5 salons actifs

**Decision** : vérifiée **par le bot** au clic sur le bouton (source de vérité : il crée les salons) et
**par le site** avant de mettre en file une demande `create-channel` : salons `active` du joueur
+ demandes `create-channel` encore en attente ≥ 5 → `409 channel-limit`.

## R5. Démarrer une session dans un de ses salons

**Decision** : `POST /fm/sessions` (specs/028) exige désormais un salon de `fm_channels`, `active`, dont
le joueur est propriétaire (`403 not-your-channel` sinon) ; `GET /fm/channels` ne renvoie plus que les
salons actifs du joueur (avec `busy`). Les anciens salons ordinaires ne sont plus proposés.

## R6. Rattacher un salon entier à un objet

**Decision** : `fm_channels.fm_item_id`. L'objet **effectif** d'une session devient
`COALESCE(session.fm_item_id, salon.fm_item_id)` : une session rattachée à la main garde son objet
(FR-012), les autres suivent le salon (FR-011). Toutes les lectures qui calculent un objet (récap,
totaux des objets, `fmItem` des sessions, rattachement manuel) utilisent cet objet effectif.
`PUT /fm/channels/{id}/item` (propriétaire seulement) fixe ou retire l'objet du salon.

**Conséquence sur specs/027** : une session sans rattachement manuel mais dans un salon rattaché a un
objet effectif ; « Rattacher » n'est proposé que pour une session sans objet effectif ; « Détacher »
retire seulement un rattachement manuel.

## R7. Visibilité

**Decision** : les salons d'un joueur apparaissent dans son profil (`fmChannels`), avec la même règle
que le profil (privé → invisible pour les autres, specs/025). Ils ne sont jamais proposés à un autre
joueur au démarrage.

## R8. Suppression du profil

**Decision** : `DELETE /fm/me` laisse les salons en base mais retire leur propriétaire et leur objet
(les objets sont supprimés, specs/027) ; les sessions restent. Le salon Discord lui-même n'est pas
touché par le site.
