# Data Model: Récap de forgemagie par objet

**Feature**: [spec.md](spec.md) | **Research**: [research.md](research.md)

Migration `worker/migrations/0008_add_fm_items.sql`, reportée dans `worker/schema.sql`.

## `fm_items` — objet en FM

| Colonne | Type | Règle |
|---|---|---|
| `id` | TEXT PK | UUID généré par le Worker |
| `owner_discord_user_id` | TEXT NOT NULL | → `fm_players` ; seul lui peut modifier (FR-002) |
| `item_id` | TEXT NOT NULL | Identifiant DofusDB de l'équipement (chiffres seulement) |
| `item_name` | TEXT NOT NULL | Nom de l'équipement à la création, 1 à 80 caractères (FR-003) |
| `item_image_url` | TEXT | Icône à la création, `https://api.dofusdb.fr/…` ou NULL |
| `label` | TEXT | Nom libre, 1 à 40 caractères, ou NULL (FR-001) |
| `created_at` | TEXT NOT NULL | |

Index : `fm_items(owner_discord_user_id)`.

## `fm_sessions` — colonne ajoutée

| Colonne | Type | Règle |
|---|---|---|
| `fm_item_id` | TEXT NULL | → `fm_items` ; au plus un objet par session (FR-006) |

Index : `fm_sessions(fm_item_id)`.

## Règles

- **Rattachable par le joueur V** (FR-005) : `fm_item_id IS NULL` **et** au moins une ligne de
  `fm_captures` avec `session_id` = la session et `discord_user_id` = V.
- **Détachable par V** (FR-007) : l'objet rattaché a `owner_discord_user_id` = V.
- **Total d'un objet** (FR-009) : somme des `spent_kamas` de toutes les captures des sessions
  rattachées (même calcul que le total d'une session).
- **Détail par objet acheté** (FR-011) : lignes d'achat des captures des sessions rattachées,
  groupées par nom ; prix moyen = `round(total / quantité)`.
- **Nom affiché d'un objet** : `label` s'il existe, sinon `item_name`.
- **Visible par V** (FR-014) : le propriétaire est public, ou c'est V.

## Transitions

```text
session (fm_item_id NULL) --PUT /fm/sessions/{id}/item par un joueur qui y a dépensé--> rattachée
rattachée --DELETE /fm/sessions/{id}/item par le propriétaire de l'objet--> fm_item_id NULL
rattachée --DELETE /fm/items/{id} ou DELETE /fm/me du propriétaire--> fm_item_id NULL
```

## Types du site (`src/domain/forgemagie.ts`)

- `FmItemSummary` existe déjà (détail par objet acheté) : les nouveaux types s'appellent
  `FmOwnedItem` (objet en FM) et `FmItemRecap`, pour éviter la confusion.
- `FmOwnedItem = { id, itemId, itemName, imageUrl: string | null, label: string | null, owner: FmPlayer,
  totalKamas, sessionCount }`.
- `FmItemRecap = FmOwnedItem & { sessions: { id, channelName, status, openedAt, totalKamas }[];
  items: FmItemSummary[] }`.
- `FmSessionItem = { id, name, owner: FmPlayer } | { private: true }` ; `FmSession` gagne
  `fmItem: FmSessionItem | null`, et `FmSessionDetail` gagne `canAttach: boolean` et
  `canDetach: boolean`.
- `fmItemDisplayName(item)` : `label ?? itemName`.
