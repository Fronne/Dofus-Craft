# Contrat : API communautaire (Worker)

## `GET /latest-price?itemId=<id>&serverId=<id>` — nouveau

Lecture anonyme (pas de clé requise), comme `GET /community-price`.

| Cas | Statut | Corps |
|---|---|---|
| paramètre manquant | 400 | `{ "error": "itemId and serverId are required" }` |
| aucune contribution | 404 | `null` |
| contribution trouvée | 200 | `{ "itemId": "208", "serverId": "mikhal", "amountKamas": 6000, "contributedAt": "2026-09-25T10:00:00.000Z" }` |

- Renvoie la contribution `kind = 'item'` la plus récente (`created_at` le plus grand), **sans filtre d'ancienneté**.

## `POST /community-price` — existant, étendu

Corps : `{ resourceId, serverId, amountKamas, deviceId, kind? }` ; `kind` facultatif, `'item'` ou
absent (= ressource, comportement actuel).

- `kind: 'item'` : `resourceId` porte l'identifiant de l'objet, la ligne est enregistrée avec
  `kind = 'item'` (sans `kind` : `'resource'`) ; la trace d'écart
  (`median_at_submission_kamas`, `deviation_percent`) est calculée par rapport à la contribution la
  plus récente de cet objet/serveur (avant insertion), `null` s'il n'y en a pas.
- Toute autre valeur de `kind` → 400. Authentification, limiteur de débit et bornes de montant
  inchangés. Réponse inchangée : `201 { id }`.

## Purge hebdomadaire (cron) — existant, modifié

Supprime les contributions de plus de 90 jours **sauf** la plus récente de chaque couple
`(resource_id, server_id)` parmi les lignes `kind = 'item'`. Nécessite la migration
`0005_add_contribution_kind.sql`, appliquée en production **avant** le déploiement du Worker.

## Tests obligatoires

- dernier prix = ligne la plus récente parmi plusieurs ; 404 sans ligne ; 400 sans paramètre ;
  une contribution de plus de 90 jours reste lisible par `/latest-price` ;
- POST `kind: 'item'` : écart calculé par rapport à la dernière contribution ; `null` si première ;
  `kind` invalide → 400 ; POST sans `kind` inchangé (écart par rapport à la médiane) ;
- purge : garde la plus récente ancienne d'un couple `'item'`, supprime les autres anciennes et
  toute ancienne ligne `'resource'` (même la plus récente de sa ressource), ne touche pas aux récentes ;
- `/latest-price` ignore les lignes `'resource'` du même identifiant.
