# Data Model: Collections d'objets épinglés

## PinnedItem (existant, étendu)

Objet du catalogue suivi par le joueur, persisté dans `localStorage` sous la clé
`craftcheck-pinned-items` (`src/persistence/pinned-items.ts`), inchangé dans son principe (commun à
tous les serveurs, cf. 002-server-scoped-prices).

| Field | Type / rule | Purpose |
|-------|-------------|---------|
| `item` | `Item` existant, inchangé | L'objet du catalogue suivi. |
| `collectionName` | texte non vide après suppression des espaces de début/fin, ou absent | Nom de la collection à laquelle cet objet est actuellement assigné. Absent (`undefined`) signifie « Sans collection » — c'est l'état de tout objet épinglé avant cette fonctionnalité (FR-005), aucune migration n'étant nécessaire pour l'obtenir. |

**Validation rules**:

- Un `collectionName` vide ou composé uniquement d'espaces n'est jamais persisté tel quel : il est
  normalisé en `undefined` (Sans collection) plutôt que stocké comme chaîne vide (Edge Cases,
  spec.md).
- Un objet ne porte jamais plus d'un `collectionName` à la fois (FR-008) — assigner en écrit un
  nouveau qui remplace l'ancien, il n'existe pas de tableau de collections sur un même objet.

**Transitions**:

1. Assignation (FR-002/FR-003) : `collectionName` passe de `undefined` (ou d'un autre nom) à un nom
   choisi ou créé par le joueur, normalisé selon la règle d'unicité insensible à la casse ci-dessous.
2. Renommage de la collection qui le contient (FR-006) : `collectionName` passe de l'ancien nom au
   nouveau, pour tous les objets qui portaient l'ancien nom, en une seule opération logique.
3. Suppression de la collection qui le contient (FR-007) : `collectionName` repasse à `undefined`
   pour tous les objets qui la portaient — l'objet reste épinglé, aucune autre donnée n'est modifiée.
4. Désépinglage (FR-012, existant) : l'objet entier (donc son `collectionName`) est retiré de la
   liste ; les autres objets de la même collection ne sont pas affectés.

## Collection (dérivée, non stockée séparément)

Un nom choisi par le joueur qui regroupe visuellement les `PinnedItem` qui le portent. Ce n'est pas
une entité stockée indépendamment : sa liste, à un instant donné, est l'ensemble des `collectionName`
distincts (après normalisation de casse) actuellement portés par au moins un `PinnedItem` — voir
research.md, « Modéliser une collection comme un champ, pas comme une entité séparée ».

| Field (dérivé) | Type / rule | Purpose |
|-----------------|-------------|---------|
| `name` | texte, casse conservée depuis sa première utilisation (FR-009) | Nom affiché comme en-tête de groupe sur la page Épinglés. |
| `items` (dérivé) | tous les `PinnedItem` dont le `collectionName` correspond à `name` (comparaison insensible à la casse) | Contenu du groupe affiché. |

**Règles de dérivation** (appliquées dans cet ordre, à chaque rendu de la page Épinglés) :

1. Regrouper tous les `PinnedItem` par `collectionName` normalisé (insensible à la casse, espaces de
   début/fin ignorés) ; les objets sans `collectionName` (ou avec un nom vide/blanc) forment le groupe
   « Sans collection ».
2. Trier les groupes de collection par ordre alphabétique de leur `name` affiché (FR-011) ; le groupe
   « Sans collection » est toujours affiché en dernier, quel que soit son nom littéral.
3. Une collection sans aucun objet n'apparaît jamais dans cette liste dérivée — elle « disparaît »
   simplement, sans suppression explicite à effectuer (Edge Cases, spec.md).

**Explicitement absent** : aucun identifiant, aucune date de création, aucun ordre manuel personnalisé
— rien qui nécessiterait un état persistant au-delà des `collectionName` déjà portés par les objets.

## Opérations sur les collections (portées par `usePinnedItems`)

Ces opérations complètent `pin(item)`/`unpin(id)`/`isPinned(id)` déjà existants, sans les modifier.

| Operation | Input | Output | Required behavior |
|-----------|-------|--------|--------------------|
| `assignCollection(itemId, name)` | identifiant d'objet épinglé, nom de collection ou `undefined` | liste mise à jour | Normalise `name` (espaces retirés, correspondance insensible à la casse avec une collection existante — auquel cas la casse existante est réutilisée) ; `undefined` ou une chaîne vide/blanche assigne « Sans collection ». N'affecte que l'objet ciblé. |
| `renameCollection(oldName, newName)` | nom de collection existant, nouveau nom | liste mise à jour | Réassigne `collectionName` de tous les objets portant `oldName` (comparaison insensible à la casse) vers `newName`, normalisé par la même règle que `assignCollection` — fusionne silencieusement avec une collection déjà existante portant ce nom (spec.md, User Story 3, scénario 3). |
| `deleteCollection(name)` | nom de collection existant | liste mise à jour | Équivalent à `renameCollection(name, undefined)` : réassigne tous ses objets vers « Sans collection ». Ne désépingle jamais un objet (FR-007). |
| `listCollectionNames()` *(dérivé, lecture seule)* | aucun | noms de collections actuellement non vides, triés par ordre alphabétique | Utilisé par le `CollectionPicker` (research.md) pour proposer les collections existantes ; toujours recalculé depuis `pinnedItems`, jamais mis en cache séparément. |

## Rappel — Objet du catalogue, item épinglé sans collection (001/002, schéma inchangé)

Cette fonctionnalité ne modifie ni le schéma ni le dépôt des prix de marché par item épinglé
(`PinnedItemPrice`, 002-server-scoped-prices) : le regroupement par collection est une couche
d'affichage et d'organisation au-dessus de la liste des objets épinglés, indépendante du prix ou du
serveur actif.

## Relationships

```text
PinnedItem
   └── porte au plus un ──> collectionName (texte ou absent)

Collection (dérivée)
   └── regroupe ──> tous les PinnedItem dont le collectionName correspond, insensible à la casse
   └── n'existe (pour l'affichage) que si ──> au moins un PinnedItem la porte

assignCollection / renameCollection / deleteCollection
   └── seules voies de modification de ──> PinnedItem.collectionName
       (jamais de champ collectionName modifié directement ailleurs)
```
