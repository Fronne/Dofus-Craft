# Data Model: Bons plans HDV

## Table `hdv_listings` (D1, migration `0028_add_hdv_listings.sql`)

Un exemplaire d'équipement en vente, tel que vu par un client de relevé.

| Colonne | Type | Règle |
|---|---|---|
| `server_id` | TEXT NOT NULL | serveur connu (`servers.ts`) |
| `listing_id` | TEXT NOT NULL | identifiant d'annonce du jeu, chiffres seuls |
| `item_id` | TEXT NOT NULL | identifiant DofusDB de l'objet, chiffres seuls |
| `price_kamas` | INTEGER NOT NULL | `> 0` et `≤ MAX_AMOUNT_KAMAS` |
| `stats_json` | TEXT NOT NULL | tableau JSON de `{effectId, value}`, 1 à 40 lignes |
| `first_seen_at` | TEXT NOT NULL | ISO 8601, première vue |
| `last_seen_at` | TEXT NOT NULL | ISO 8601, dernière vue |
| `key_id` | TEXT NOT NULL | clé de relevé qui l'a vue (traçabilité) |

- **Clé primaire**: `(server_id, listing_id)`.
- **Index**: `(server_id, last_seen_at)` pour la lecture ; `(server_id, item_id)` pour le remplacement par objet.
- **Transitions**: absente → insérée ; revue → `price_kamas`, `stats_json`, `last_seen_at` mis à jour ; absente d'un nouveau lot de son objet → supprimée ; `last_seen_at` de plus de 24 h → ignorée à la lecture, supprimée par la purge.

## Table `sniffer_daily_usage` (modifiée par la même migration)

- Nouvelle colonne `copies_written INTEGER NOT NULL DEFAULT 0 CHECK (copies_written >= 0)` : exemplaires écrits par la clé ce jour-là (plafond 20 000).

## Réglage `site_settings`

- Clé `good_deal_threshold` : entier en pourcentage, 5 à 90, défaut 25.
- Clé de page `bons_plans_page` : `'1'` / `'0'`, comme les autres pages (voir `src/domain/site-settings.ts`).

## Valeurs calculées côté site (non stockées)

- **Ligne de jet** : `{effectId, value, isExo}`.
- **Qualité** : somme de `value × poids(effectId) × (isExo ? EXO_FACTOR : 1)`.
- **Verdict d'exemplaire** : `{listingId, itemId, price, referencePrice, savingKamas, savingPercent, neighbourCount, isGoodDeal, hasExo}`.
