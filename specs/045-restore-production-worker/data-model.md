# Data Model: structure de production à retrouver

Source : `sqlite_master` de la base D1 de production, lu le 12 octobre 2026. Seuls les écarts avec le
dépôt sont décrits ; le reste de `worker/schema.sql` est déjà conforme.

## external_prices (nouvelle)

| Colonne | Type | Règle |
|---------|------|-------|
| source | TEXT NOT NULL | `'huzounet'` |
| resource_id | TEXT NOT NULL | identifiant d'objet du jeu |
| server_id | TEXT NOT NULL | identifiant de serveur du site (`mikhal`) |
| unit_price_kamas | INTEGER NOT NULL | `>= 1` |
| observed_at | TEXT NOT NULL | date d'observation donnée par la source |
| support | INTEGER NOT NULL DEFAULT 0 | nombre de relevés à l'appui |
| provisional | INTEGER NOT NULL DEFAULT 0 | 1 si la source le dit provisoire |
| stale | INTEGER NOT NULL DEFAULT 0 | 1 si la source le dit ancien |
| fetched_at | TEXT NOT NULL | dernière lecture ; sert à la purge (90 jours) et au délai de 2 minutes |
| is_item | INTEGER NOT NULL DEFAULT 0 | 1 si c'est le prix HDV d'un objet que les joueurs consultent |

Clé primaire `(source, resource_id, server_id)`. Index `idx_external_prices_lookup (server_id, resource_id)`.

## external_price_sync (nouvelle)

| Colonne | Type | Règle |
|---------|------|-------|
| source | TEXT NOT NULL | `'huzounet'` (passage planifié) ou `'huzounet-refresh'` (à la demande) |
| server_id | TEXT NOT NULL | |
| run_date | TEXT NOT NULL | jour du passage ; pour `huzounet-refresh`, date et heure de la dernière lecture |
| cursor | INTEGER NOT NULL DEFAULT 0 | dernier identifiant lu, pour reprendre |
| completed_at | TEXT | fin du passage du jour |
| last_error, last_error_at | TEXT | dernière erreur de lecture |

Clé primaire `(source, server_id)`.

## fm_guild (nouvelle)

Une seule ligne : `id TEXT PRIMARY KEY CHECK (id = 'current')`, `name TEXT NOT NULL`,
`updated_at TEXT NOT NULL`. Le nom est relevé à chaque connexion Discord réussie.

## fm_purchase_lines (colonnes ajoutées)

| Colonne | Type | Rôle |
|---------|------|------|
| original_quantity | INTEGER | quantité avant la première correction |
| original_total_kamas | INTEGER | total avant la première correction |
| corrected_at | TEXT | renseigné tant que la ligne diffère de ses valeurs d'origine |
| original_item_name | TEXT | nom lu, quand il a été rattrapé |
| counted | INTEGER NOT NULL DEFAULT 1 | 0 pour une ligne qui n'est pas une rune |

## fm_bot_commands (contrainte élargie)

`type IN ('open', 'close', 'create-channel', 'archive-channel', 'reopen-channel')`. SQLite ne modifie pas
une contrainte en place : la migration recrée la table et ses deux index
(`idx_fm_bot_commands_status`, `idx_fm_bot_commands_channel`).

## Séance de FM (vue calculée, pas de table)

Regroupe par `channel_id` les sessions d'un joueur et, s'il existe, son salon (`fm_channels`).

- **État** : `archived` si le salon n'est pas actif ; sinon `running` si une session est ouverte ;
  sinon `paused`. Un salon inconnu (`ordinary`) est traité comme non actif.
- **Objet** : celui du salon ; à défaut, celui de la session la plus récente qui en a un.
- **Transitions** : archiver (salon actif vers archivé, sessions ouvertes fermées) ; rouvrir (archivé
  vers actif, nouvelle session ouverte, sous réserve de la limite de salons actifs).
