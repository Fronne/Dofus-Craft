# Data Model: Gestion multi-serveurs des prix

## Server

Donnée statique et versionnée avec le code, listant les serveurs officiels Dofus proposés au
joueur.

| Field | Type / rule | Purpose |
|-------|-------------|---------|
| `id` | identifiant stable, non vide | Clé utilisée par toutes les données scoped par serveur. |
| `name` | texte non vide | Nom affiché au joueur (ex. « Mikhal », « Dakal »). |

La liste des serveurs est fermée : aucune saisie libre n'est acceptée (FR-014). Ajouter un
serveur consiste à ajouter une entrée à cette liste, sans toucher aux données déjà enregistrées
pour les autres serveurs (FR-012).

## ActiveServerPreference

Préférence individuelle mémorisée pour le joueur sur son navigateur/appareil.

| Field | Type / rule | Purpose |
|-------|-------------|---------|
| `serverId` | référence à `Server`, absente avant le premier choix | Détermine quelles données scoped par serveur sont affichées. |

**Transitions**:

1. Absente → définie lors du tout premier choix de serveur (FR-001) ; tant qu'elle est absente,
   l'application ne présente que le sélecteur de serveur (FR-015).
2. Définie → remplacée par une nouvelle valeur à chaque changement explicite de serveur (FR-003).
3. Définie → restituée à l'identique après un rechargement de page (FR-002, FR-011).

## ResourcePrice (mise à jour de la fonctionnalité 001)

Donnée personnelle persistée par serveur ; le champ `serverId` devient obligatoire dans la clé de
stockage (il existe déjà dans la persistance IndexedDB, mais n'était pas encore renseigné par
l'interface).

| Field | Type / rule | Purpose |
|-------|-------------|---------|
| `serverId` | référence à `Server`, fait partie de la clé | Isole le prix par serveur (FR-005, FR-006). |
| `resourceId` | référence à `Resource`, fait partie de la clé | Rend le prix réutilisable entre recettes d'un même serveur. |
| `unitPriceKamas` | entier supérieur ou égal à 0 | Prix saisi par le joueur. |
| `updatedAt` | date/heure ISO 8601 | Fraîcheur visible du prix. |

**Transitions**: identiques à la fonctionnalité 001 (absent → enregistré → mis à jour), mais
désormais évaluées indépendamment pour chaque couple `(serverId, resourceId)` (FR-007).

## PinnedItem (mise à jour de la fonctionnalité 001)

Liste unique et commune à tous les serveurs (FR-008). Ne contient plus de prix : le prix de
marché est désormais une donnée séparée scoped par serveur (voir `PinnedItemPrice`).

| Field | Type / rule | Purpose |
|-------|-------------|---------|
| `item` | référence complète à `Item` | Identité de l'item suivi, indépendante du serveur. |

**Transitions**:

1. Absent → épinglé par une action explicite du joueur, quel que soit le serveur actif.
2. Épinglé → désépinglé par une action explicite ; l'effet est visible sur tous les serveurs
   (FR-008).

**Migration**: toute valeur `marketPrice` précédemment associée à une entrée `PinnedItem` (avant
cette fonctionnalité) est abandonnée lors du premier chargement suivant la mise à jour ; le
joueur concerné reçoit une notification l'invitant à ressaisir ce prix par serveur (FR-016).

## PinnedItemPrice (nouvelle entité)

Donnée personnelle persistée par serveur pour un item épinglé, symétrique à `ResourcePrice`.

| Field | Type / rule | Purpose |
|-------|-------------|---------|
| `serverId` | référence à `Server`, fait partie de la clé | Isole le prix par serveur (FR-009). |
| `itemId` | référence à `Item` (doit être épinglé), fait partie de la clé | Identifie l'item concerné. |
| `marketPriceKamas` | entier supérieur ou égal à 0 | Dernier prix HDV observé par le joueur pour cet item sur ce serveur. |
| `updatedAt` | date/heure ISO 8601 | Fraîcheur visible du prix. |

**Transitions**:

1. Absent → enregistré lors d'une saisie valide pendant que l'item est épinglé et un serveur
   actif.
2. Enregistré → mis à jour lors d'une nouvelle saisie valide sur le même serveur ; les valeurs des
   autres serveurs restent inchangées (FR-009, FR-010).
3. Enregistré → supprimé lorsque l'item correspondant est désépinglé (les prix par serveur d'un
   item qui n'est plus suivi n'ont plus de sens à conserver).
4. Absent pour le serveur actif alors qu'il existe pour un autre serveur → le champ de saisie est
   présenté vide, jamais pré-rempli avec la valeur d'un autre serveur (FR-010).

## Relationships

```text
Server 1 ──── * ResourcePrice * ──── 1 Resource
Server 1 ──── * PinnedItemPrice * ──── 1 PinnedItem (via itemId)

ActiveServerPreference ──── 0..1 Server (référence courante)

PinnedItem (liste commune, indépendante du serveur)
   └── 0..* PinnedItemPrice (une valeur possible par serveur)
```
