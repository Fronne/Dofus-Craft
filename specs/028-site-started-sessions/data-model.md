# Data Model: Démarrer une session FM depuis le site

**Feature**: [spec.md](spec.md) | **Research**: [research.md](research.md)

Migration `worker/migrations/0009_add_site_sessions.sql`, reportée dans `worker/schema.sql`.

## `fm_sessions` — colonnes ajoutées

| Colonne | Type | Règle |
|---|---|---|
| `owner_discord_user_id` | TEXT NULL | → `fm_players` ; le joueur qui a démarré (site) ou tapé `/fmstart` (FR-005) ; NULL pour les anciennes sessions |
| `origin` | TEXT NOT NULL DEFAULT `'discord'` | `'discord'` ou `'site'` |
| `sync_status` | TEXT NULL | Session du site : `'pending'`, `'opened'`, `'failed'`, `'cancelled'` ; NULL pour une session Discord |
| `sync_error` | TEXT NULL | Raison donnée par le bot pour `'failed'`, 200 caractères au plus |

## `fm_bot_commands` — demandes au bot

| Colonne | Type | Règle |
|---|---|---|
| `id` | TEXT PK | UUID |
| `type` | TEXT NOT NULL | `'open'` ou `'close'` |
| `session_id` | TEXT NOT NULL | → `fm_sessions` |
| `channel_id` | TEXT NOT NULL | Salon de la session |
| `status` | TEXT NOT NULL | `'pending'`, `'done'`, `'failed'`, `'cancelled'` |
| `error` | TEXT NULL | Raison d'un `'failed'`, 200 caractères au plus |
| `created_at` | TEXT NOT NULL | |
| `acknowledged_at` | TEXT NULL | Date de la confirmation du bot |

Index : `fm_bot_commands(status, created_at)`, `fm_bot_commands(channel_id, status)`.

## Transitions

```text
Démarrer (site) : session open, origin=site, sync_status=pending ; commande open pending
ack open done   : commande done ; sync_status=opened
ack open failed : commande failed ; sync_status=failed, sync_error=raison (session restent ouverte sur le site)
Arrêter (site)  : session closed ;
                  si open encore pending → open cancelled, sync_status=cancelled, pas de close
                  sinon → commande close pending
ack close       : commande done / failed
session-stop    : (événement du bot) commandes close pending du salon → cancelled
Relancer        : open pending (ou failed) → cancelled ; nouvelle commande open pending ; sync_status=pending
```

« Non transmise » : `sync_status = 'pending'` et commande `open` créée il y a plus de 10 minutes
(calculé à la lecture).

## Règles

- **Salon occupé** : une session `status = 'open'` existe pour ce salon (index unique existant).
- **Peut arrêter** (`canStop`) : la session est ouverte et le lecteur en est propriétaire.
- **Capture ignorée** (R3) : aucun salon ouvert, et une commande `close` `pending` existe pour ce
  salon.

## Types du site (`src/domain/forgemagie.ts`)

- `FmSession` gagne `owner: FmPlayer | null`, `origin: 'discord' | 'site'`,
  `sync: null | { status: 'pending' | 'opened' | 'failed' | 'cancelled' | 'stale'; error: string | null }`,
  `canStop: boolean`.
- `FmChannel = { channelId: string; channelName: string; busy: boolean }`.
