# Data Model: Salons FM personnels

**Feature**: [spec.md](spec.md) | **Research**: [research.md](research.md)

Migration `worker/migrations/0010_add_fm_channels.sql`, reportée dans `worker/schema.sql`.

## `fm_channels`

| Colonne | Type | Règle |
|---|---|---|
| `channel_id` | TEXT PK | Identifiant du salon Discord |
| `channel_name` | TEXT NOT NULL | Nom donné par le bot (1 à 100 caractères) |
| `owner_discord_user_id` | TEXT | → `fm_players` ; NULL après la suppression du profil |
| `status` | TEXT NOT NULL | `'active'`, `'archived'` ou `'deleted'` |
| `fm_item_id` | TEXT | → `fm_items` ; objet rattaché au salon entier (FR-011) |
| `created_at` | TEXT NOT NULL | |
| `archived_at` | TEXT | |

Index : `fm_channels(owner_discord_user_id, status)`.

## `fm_bot_commands` — colonnes ajoutées

| Colonne | Type | Règle |
|---|---|---|
| `requested_name` | TEXT | Demande `create-channel` : nom saisi, 1 à 30 caractères |
| `requester_discord_user_id` | TEXT | Demande `create-channel` : le joueur |
| `fm_item_id` | TEXT | Demande `create-channel` : objet à rattacher au salon |
| `result_channel_id` | TEXT | Salon créé, donné par le bot dans l'`ack` |

`type` accepte désormais `'create-channel'` (la contrainte CHECK est recréée : la table est reconstruite
dans la migration, en recopiant ses lignes). `session_id` et `channel_id` deviennent facultatifs pour ce
type.

## Règles

- **Salon actif du joueur** : `status = 'active'` et `owner_discord_user_id` = joueur.
- **Limite** (FR-003) : salons actifs du joueur + demandes `create-channel` `pending` du joueur ≤ 5.
- **Objet effectif d'une session** : `COALESCE(fm_sessions.fm_item_id, fm_channels.fm_item_id)`.
- **Total d'un objet** : somme des dépenses des sessions dont l'objet effectif est cet objet.

## Transitions d'un salon

```text
channel-created (bot)  → active (propriétaire = author ; objet = celui de la demande, s'il y en a une)
channel-archived (bot) → archived (archived_at)
channel-deleted (bot)  → deleted
DELETE /fm/me          → propriétaire NULL, objet NULL
```

## Types du site (`src/domain/forgemagie.ts`)

- `FmChannel` : `{ channelId, channelName, busy }` → gagne `status` et `fmItem: { id, name } | null`.
- `FmChannelRequest = { id, status: 'pending' | 'done' | 'failed', error: string | null, channelId: string | null }`.
- `FmProfile.fmChannels: FmChannel[]`.
