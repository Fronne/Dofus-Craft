# Data model : administration des clés sniffer et du mapping

Aucune table ni colonne nouvelle (FR-013). Les tables sont celles de
`worker/migrations/0018_add_sniffer_tables.sql` (voir `specs/056-sniffer-batch-prices/data-model.md`).

## sniffer_keys — ce que l'admin écrit et lit

| action | écrit | règle |
|---|---|---|
| créer | `id` = UUID, `label` (1-60 caractères, espaces autour retirés), `key_hash` = `sha256Hex(clé)`, `created_at` = maintenant | la clé en clair n'est que dans la réponse 201 |
| révoquer | `revoked_at = COALESCE(revoked_at, maintenant)` | idempotent ; jamais remis à NULL |
| lister | — | jamais `key_hash` ; `last_seen_at` est écrit par l'API (phase 2) |

### Clé (vue admin)

```text
SnifferKey { id, label, createdAt, revokedAt | null, lastSeenAt | null, rowsToday }
```

`rowsToday` = `sniffer_daily_usage.rows_written` pour `(id, jour UTC courant)`, 0 sans ligne.

États : active (`revokedAt` nul) → révoquée (définitif).

## sniffer_mappings — ce que l'admin écrit et lit

| action | écrit | règle |
|---|---|---|
| déposer | désactive l'actif du build, puis insère `build`, `keymap_json`, `schema_json` (textes tels que reçus), `active = 1` | un lot D1 ; refusé sans écriture si la validation échoue |
| réactiver | désactive l'actif du build (autre que la cible), puis `active = 1` sur la cible | un lot D1 ; cible déjà active : rien ne change |
| lister | — | sans les documents ; tailles en octets |

### Mapping (vue admin)

```text
SnifferMapping { id, build, uploadedAt, active, keymapBytes, schemaBytes }
```

Ordre de la liste : par build (le build dont le dernier dépôt est le plus récent d'abord), puis
par `id` décroissant.

### Validation d'un dépôt (`validateMappingUpload`)

Entrée `{ build, keymap, schema }` (deux chaînes : le texte des fichiers). Dans l'ordre, la première
erreur répond `{ error, field }` avec `field` ∈ `build | keymap | schema` :

1. `build` : chaîne, `^\d+\.\d+\.\d+(\.\d+)?$`, ≤ 32 caractères.
2. `keymap`, puis `schema` : chaîne non vide, ≤ 256 Ko (UTF-8), JSON valide, objet JSON.
3. keymap : `price_list` chaîne non vide.
4. schema : `price_list` objet ; chaque `of` (chaîne) des `fields` de `price_list` et des
   définitions qu'il cite, de proche en proche, nomme une définition objet dont le nom ne commence
   pas par `_`.

## sniffer_daily_usage — lue seulement

Écrite par `POST /community-price/batch` (phase 2).
