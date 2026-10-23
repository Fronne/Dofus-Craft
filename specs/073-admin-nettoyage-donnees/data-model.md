# Modèle de données : Nettoyage des données

## Table nettoyable (registre en code, pas en base)

| Champ | Sens |
|-------|------|
| `id` | nom de la table dans l'URL : `brisage-coefficients`, `prix-communaute`, `prix-externes` |
| `label` | nom lisible affiché |
| `table` | nom SQL réel |
| `keyColumn` | colonne identifiante (`id` ou `rowid`) |
| `dateColumn` | colonne de date (ordre, durées) |
| `columns` | colonnes renvoyées et leur libellé ; jamais `device_id` |
| `filters` | sous-ensemble de `server`, `origin` |

Le registre est la seule source des noms SQL : aucune valeur venant de la requête n'est insérée dans le SQL
(uniquement liée en paramètre).

## Ligne (renvoyée à la page)

`{ key: string, date: string, cells: Record<string, string | number | null> }`
— `key` est la valeur de `keyColumn` en texte ; `cells` suit `columns`.

## Durées

`10m` = 10 minutes, `1h` = 1 heure, `24h` = 24 heures. Limite inférieure = `maintenant − durée`, en ISO UTC ;
est supprimée toute ligne dont `dateColumn >= limite`.

## Trace de suppression — `admin_cleanup_log` (nouvelle table, migration 0025)

| Colonne | Type | Règle |
|---------|------|-------|
| `id` | INTEGER PK AUTOINCREMENT | |
| `deleted_at` | TEXT NOT NULL | ISO UTC, défaut `strftime('%Y-%m-%dT%H:%M:%fZ','now')` |
| `table_id` | TEXT NOT NULL | un des trois `id` du registre |
| `mode` | TEXT NOT NULL | `CHECK (mode IN ('selection','duration'))` |
| `filter_text` | TEXT NOT NULL DEFAULT '' | ex. `durée 1h · serveur mikhal · origine sniffer` |
| `row_count` | INTEGER NOT NULL | `CHECK (row_count > 0)` : pas de trace d'une suppression vide |

Index : `idx_admin_cleanup_log_deleted_at (deleted_at)`.

## Règles de validation

- `limit` de liste : 1–50 (défaut 50).
- Sélection : 1 à 500 clés, chacune une chaîne de 1 à 64 caractères, sans doublon.
- Durée : l'une des trois valeurs ; `expectedCount` entier ≥ 1 ; réel ≤ 500.
- `server` : `[a-z0-9_-]{1,40}` ; `origin` ∈ `manual | capture | bot | sniffer` (prix de la communauté seulement).
- Un filtre non applicable à la table (origine sur les coefficients) est refusé (400).

## Transitions

Une ligne n'a pas d'état : elle existe ou elle est supprimée (définitif). La trace n'est jamais modifiée.
