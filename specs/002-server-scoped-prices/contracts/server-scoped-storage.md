# Server Selection and Scoped Storage Contract

## Scope

Ce contrat fixe les frontières observables introduites par la gestion multi-serveurs : sélection
du serveur actif, et accès aux données scoped par serveur (prix de ressources, prix de marché des
items épinglés). Il **supersède** les opérations du « Resource price repository » du contrat
existant
[`../../001-craft-profit-comparison/contracts/ui-and-storage.md`](../../001-craft-profit-comparison/contracts/ui-and-storage.md)
(leur signature change pour inclure `serverId`) et **complète** ce même contrat pour tout le
reste (catalogue, service de comparaison, contrat d'interaction UI hors sélection de serveur),
sans le modifier.

## Server catalogue

| Operation | Input | Output | Required behavior |
|-----------|-------|--------|--------------------|
| `listServers` | aucun | liste fermée de `Server` | Retourne toujours la même liste prédéfinie ; jamais vide. |

## Active server preference

| Operation | Input | Output | Required behavior |
|-----------|-------|--------|--------------------|
| `getActiveServerId` | aucun | `serverId` ou absent | Lecture synchrone disponible dès le premier rendu. |
| `setActiveServerId` | `serverId` valide (présent dans `listServers`) | succès | Écrit immédiatement ; la valeur est relue à l'identique après rechargement de page. |

## Resource price repository (scoped par serveur)

| Operation | Input | Output | Required behavior |
|-----------|-------|--------|--------------------|
| `get(serverId, resourceId)` | serveur et ressource | `ResourcePrice` ou absent | Ne renvoie jamais le prix d'un autre serveur. |
| `getMany(serverId, resourceIds)` | serveur et identifiants uniques | association par identifiant | N'inclut que les prix enregistrés pour ce serveur. |
| `save(serverId, resourceId, unitPriceKamas)` | serveur, ressource, entier >= 0 | `ResourcePrice` | Écrit sous la clé `(serverId, resourceId)` sans modifier les autres serveurs. |
| `remove(serverId, resourceId)` | serveur, ressource | succès | Supprime uniquement l'entrée de ce serveur. |

## Pinned item price repository (scoped par serveur, nouveau)

| Operation | Input | Output | Required behavior |
|-----------|-------|--------|--------------------|
| `get(serverId, itemId)` | serveur et item épinglé | `PinnedItemPrice` ou absent | Ne renvoie jamais le prix d'un autre serveur. |
| `getMany(serverId, itemIds)` | serveur et identifiants uniques | association par identifiant | N'inclut que les prix enregistrés pour ce serveur. |
| `save(serverId, itemId, marketPriceKamas)` | serveur, item, entier >= 0 | `PinnedItemPrice` | Écrit sous la clé `(serverId, itemId)` sans modifier les autres serveurs. |
| `removeAllForItem(itemId)` | item désépinglé | succès | Supprime les prix de cet item pour tous les serveurs (l'item n'étant plus suivi). |

## Pinned item list (commune à tous les serveurs, inchangée dans son principe)

| Operation | Input | Output | Required behavior |
|-----------|-------|--------|--------------------|
| `pin(item)` | item | liste mise à jour | Effet visible identique quel que soit le serveur actif. |
| `unpin(itemId)` | identifiant | liste mise à jour | Effet visible identique quel que soit le serveur actif ; déclenche `removeAllForItem`. |

## UI interaction contract

| Surface | Inputs | Outputs / states |
|---------|--------|-------------------|
| Sélecteur de première visite | choix parmi `listServers` | bloque tout autre écran tant qu'aucun choix n'est fait (FR-015) ; définit `ActiveServerPreference` puis débloque l'application. |
| Sélecteur de changement de serveur | choix parmi `listServers` | remplace `ActiveServerPreference` ; toutes les données affichées (prix de ressources, prix des items épinglés) se rechargent pour le nouveau serveur. |
| Indicateur de serveur actif | aucun | affiche en permanence le nom du serveur actif pendant l'utilisation (FR-004). |
| Ligne ressource (recette) | prix unitaire éditable | lit/écrit via le dépôt de prix de ressources scoped par `ActiveServerPreference`. |
| Prix de marché d'un item épinglé | prix éditable | lit/écrit via le dépôt de prix d'items épinglés scoped par `ActiveServerPreference` ; vide si aucune valeur pour ce serveur. |
| Notification de migration | aucun | affichée une seule fois si d'anciennes valeurs `marketPrice` non scopées ont été détectées et abandonnées (FR-016). |

## Validation visible

- Un changement de serveur n'affiche jamais, même brièvement, un prix appartenant à un autre
  serveur (FR-006, FR-010).
- Le sélecteur de première visite ne propose aucune action de contournement (FR-015).
- La liste des items épinglés reste strictement identique après un changement de serveur ; seul
  le prix affiché à côté de chaque item peut varier (FR-008, FR-010).
- Ajouter un serveur à `listServers` n'affecte aucune donnée déjà enregistrée pour les serveurs
  existants (FR-012, FR-013).
