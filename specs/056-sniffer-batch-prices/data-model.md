# Data model : envoi des prix HDV par les amis

## sniffer_keys (nouvelle)

| colonne | type | règle |
|---|---|---|
| id | TEXT PK | UUID créé par l'admin ; devient le `device_id` des contributions |
| label | TEXT NOT NULL | nom de l'ami, saisi par le propriétaire |
| key_hash | TEXT NOT NULL UNIQUE | SHA-256 hexadécimal minuscule de la clé ; la clé n'est jamais stockée |
| created_at | TEXT NOT NULL | ISO 8601 UTC, défaut maintenant |
| revoked_at | TEXT NULL | non nul = clé refusée (401) |
| last_seen_at | TEXT NULL | dernier appel authentifié |

## sniffer_mappings (nouvelle)

| colonne | type | règle |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | `mappingId` du contrat |
| build | TEXT NOT NULL | version du client, ex. `3.7.10.10` |
| keymap_json | TEXT NOT NULL | document JSON |
| schema_json | TEXT NOT NULL | document JSON |
| uploaded_at | TEXT NOT NULL | ISO 8601 UTC |
| active | INTEGER NOT NULL 0/1 | index unique partiel `(build) WHERE active = 1` : un seul actif par build |

Retour arrière (phase 3) : passer l'actif à 0 puis l'ancien à 1, dans un même lot.

## sniffer_daily_usage (nouvelle)

| colonne | type | règle |
|---|---|---|
| key_id | TEXT NOT NULL | id de `sniffer_keys` |
| day | TEXT NOT NULL | `YYYY-MM-DD` UTC |
| rows_written | INTEGER NOT NULL ≥ 0 | contributions enregistrées ce jour-là |

Clé primaire `(key_id, day)`. Plafond : 5000.

## community_price_contributions (existante)

Aucune nouvelle colonne. `origin` accepte `'sniffer'` en plus. Une ligne sniffer :
`kind = 'resource'`, `origin = 'sniffer'`, `device_id = sniffer_keys.id`,
`amount_kamas = round(unitPrice)`, `median_at_submission_kamas` / `deviation_percent` comme une
saisie manuelle.

## Observation (entrée, non stockée)

`{ itemId: string (chiffres), seenAt: date ISO, lots: { "1"?, "10"?, "100"?, "1000"? } }` — chaque
lot est un entier 0 ≤ prix ≤ 2 000 000 000, 0 ou absent = pas en vente. Clé de lot inconnue,
valeur non entière ou négative, `seenAt` illisible → `invalid`.
