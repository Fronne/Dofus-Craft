# Data Model: Prix HDV des objets partagé en Mode communautaire

## Contribution (existant — table `community_price_contributions`)

| Colonne | Pour un objet |
|---|---|
| `id` | UUID |
| `resource_id` | identifiant DofusDB de l'objet |
| `server_id` | serveur |
| `amount_kamas` | prix saisi, entier ≥ 0 et ≤ 2 000 000 000 |
| `device_id` | identifiant anonyme d'appareil (existant) |
| `created_at` | date d'enregistrement (serveur) |
| `median_at_submission_kamas` | pour `kind: 'item'` : **dernier prix** connu juste avant l'insertion (nom de colonne historique), sinon `null` |
| `deviation_percent` | écart en % par rapport à ce dernier prix, sinon `null` |
| `kind` | **nouveau** (migration `0005`) : `'item'` pour un prix HDV d'objet ; `'resource'` par défaut (lignes existantes et prix de ressources) — `CHECK (kind IN ('resource', 'item'))` |

### Règle de conservation (révision de specs/004 FR-013)

Supprimer les lignes `created_at < now − 90 jours` **sauf** la ligne la plus récente de chaque
couple `(resource_id, server_id)` **parmi les lignes `kind = 'item'`**. Les lignes `'resource'`
suivent la règle des 90 jours sans exception.

## Dernier prix partagé (lu)

`{ itemId, serverId, amountKamas, contributedAt }` = la ligne `kind = 'item'` la plus récente de
l'objet sur le serveur, sans limite d'ancienneté. Absent si aucune ligne.

## Cache local du dernier prix (application)

`localStorage['craftcheck-latest-item-price:<serverId>:<itemId>']` = `{ amountKamas, contributedAt }`
— écrit à chaque lecture réussie ; lu au montage (affichage immédiat) et en cas d'échec réseau.

## État du champ « Prix HDV » (Mode communautaire)

| État | Affichage |
|---|---|
| chargement, pas de cache | champ vide |
| dernier prix connu | valeur verrouillée + crayon, « Dernière mise à jour : <date> » (surlignée si ancienne, specs/008) |
| aucun prix partagé | champ vide, saisissable |
| édition en cours | déverrouillé |
| validation, écart ≤ 50 % ou pas de dernier prix | partagé, date → « maintenant » |
| validation, écart > 50 % | confirmation ; annuler → valeur précédente, rien partagé |

## Règle de confirmation

`écart = |saisi − dernier| / dernier × 100` ; confirmation si `dernier` existe, `dernier > 0` et
`écart > 50`. Si `dernier = 0`, tout prix différent de 0 demande confirmation.
