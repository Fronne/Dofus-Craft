# Data Model: Page Forgemagie — profils Discord, sessions FM et prix des runes

**Feature**: [spec.md](spec.md) | **Research**: [research.md](research.md)

Toutes les tables sont dans la base D1 existante `dofus-craft-community-prices`, ajoutées par la
migration `worker/migrations/0007_add_forgemagie.sql` (et reportées dans `worker/schema.sql`). Les
dates sont des chaînes ISO 8601 en UTC, comme `community_price_contributions.created_at`.

## Schéma D1

### `fm_players` — joueur Discord (profil)

| Colonne | Type | Règle |
|---|---|---|
| `discord_user_id` | TEXT PK | Identifiant Discord (snowflake), fourni par le bot ou par `/users/@me` |
| `display_name` | TEXT NOT NULL | Pseudo Discord ; mis à jour à chaque événement du bot et à chaque connexion |
| `avatar_url` | TEXT | URL de l'avatar Discord, ou NULL |
| `server_id` | TEXT | Serveur Dofus du profil (FR-005) ; NULL tant qu'il n'est pas choisi |
| `is_private` | INTEGER NOT NULL DEFAULT 0 | 0 public (défaut, FR-006), 1 privé |
| `first_login_at` | TEXT | NULL si le joueur ne s'est jamais connecté au site |
| `created_at` | TEXT NOT NULL | Première apparition (bot ou connexion) |

Aucune autre donnée Discord n'est stockée (FR-004).

### `fm_auth_sessions` — connexions au site

| Colonne | Type | Règle |
|---|---|---|
| `token_hash` | TEXT PK | SHA-256 hexadécimal du jeton ; le jeton lui-même n'est jamais stocké |
| `discord_user_id` | TEXT NOT NULL | → `fm_players` |
| `expires_at` | TEXT NOT NULL | Création + 30 jours |
| `created_at` | TEXT NOT NULL | |

### `fm_oauth_states` — protection du callback OAuth

| Colonne | Type | Règle |
|---|---|---|
| `state` | TEXT PK | Valeur aléatoire envoyée à Discord |
| `expires_at` | TEXT NOT NULL | Création + 10 minutes ; supprimée à l'usage |

### `fm_sessions` — session FM d'un salon Discord

| Colonne | Type | Règle |
|---|---|---|
| `id` | TEXT PK | UUID généré par le Worker |
| `channel_id` | TEXT NOT NULL | Salon Discord |
| `channel_name` | TEXT NOT NULL | Nom du salon au moment de l'ouverture |
| `status` | TEXT NOT NULL | `'open'` ou `'closed'` |
| `opened_at` | TEXT NOT NULL | Date de `session-start` (ou de la première capture, R4) |
| `closed_at` | TEXT | Date de `session-stop`, ou de la fermeture par un nouveau `session-start` |

Index unique partiel : un seul `status = 'open'` par `channel_id`.

### `fm_captures` — un message traité par le bot, ou un import sur le site

| Colonne | Type | Règle |
|---|---|---|
| `id` | TEXT PK | UUID |
| `session_id` | TEXT | → `fm_sessions` ; NULL pour un import sur le site |
| `discord_user_id` | TEXT NOT NULL | → `fm_players` ; qui a posté ou importé |
| `origin` | TEXT NOT NULL | `'bot'` ou `'capture'` |
| `spent_kamas` | INTEGER NOT NULL ≥ 0 | Dépense comptée : `added_total` du bot, ou somme des totaux validés pour un import |
| `server_id` | TEXT | Serveur du profil au moment de l'enregistrement (R11) ; NULL si inconnu |
| `created_at` | TEXT NOT NULL | |

### `fm_purchase_lines` — lignes d'achat d'une capture

| Colonne | Type | Règle |
|---|---|---|
| `id` | TEXT PK | UUID |
| `capture_id` | TEXT NOT NULL | → `fm_captures` (suppression en cascade) |
| `position` | INTEGER NOT NULL | Rang de la ligne dans l'envoi (ordre d'affichage et de réponse au bot) |
| `item_name` | TEXT NOT NULL | Nom tel que lu (ou choisi sur le site) |
| `item_id` | TEXT | Ressource reconnue (R5), ou NULL |
| `quantity` | INTEGER NOT NULL > 0 | |
| `total_kamas` | INTEGER NOT NULL > 0 | |
| `unit_price_kamas` | INTEGER NOT NULL | `round(total / quantité)` |
| `contribution_id` | TEXT | Contribution de prix créée, ou NULL |
| `price_status` | TEXT NOT NULL | Pourquoi un prix a été créé ou non (voir ci-dessous) |

`price_status` : `'recorded'`, `'unknown-item'`, `'ambiguous-item'`, `'no-server'`, `'outlier'`,
`'personal-mode'` (import sur le site en Mode personnel).

### `fm_processed_events` — idempotence des envois du bot (FR-020)

| Colonne | Type | Règle |
|---|---|---|
| `event_id` | TEXT PK | Identifiant Discord du message ou de l'interaction |
| `type` | TEXT NOT NULL | Type d'événement |
| `response` | TEXT NOT NULL | Réponse JSON d'origine, renvoyée telle quelle en cas de renvoi |
| `received_at` | TEXT NOT NULL | |

### `community_price_contributions` — colonne ajoutée

| Colonne | Type | Règle |
|---|---|---|
| `origin` | TEXT NOT NULL DEFAULT `'manual'` | `'manual'`, `'capture'` ou `'bot'` ; les lignes existantes valent `'manual'` (FR-011) |

## Règles dérivées (calculées à la lecture, jamais stockées)

- **Total d'une session** = somme des `spent_kamas` de ses captures.
- **Dépense d'un joueur dans une session** = somme des `spent_kamas` de ses captures de la session.
- **Détail par rune d'une session** : pour chaque `item_name`, somme des `quantity` et des
  `total_kamas`, et prix moyen = `round(total / quantité)` (même calcul que les embeds du bot).
- **Dépenses d'un profil** (FR-016) : ses captures du bot **et** ses imports sur le site ; total,
  montant par session, détail par rune.
- **Joueur privé vu par un autre membre** (FR-015) : `displayName`, `avatarUrl` et
  `discordUserId` valent `null`, `private: true` ; ses montants restent dans les totaux.

## Transitions d'état d'une session

```text
(aucune) --session-start--> open
(aucune) --capture sans session ouverte--> open (opened_at = date de la capture)
open --session-start--> closed (closed_at = maintenant), puis nouvelle session open
open --session-reset--> open (captures et lignes de la session supprimées)
open --session-stop--> closed
closed --(tout événement)--> sans effet sur cette session
```

`session-reset` ou `session-stop` sans session ouverte : réponse `ignored`, sans erreur.

## Données du site

### `src/data/rune-items.json` (généré, [contracts/rune-items-data.md](contracts/rune-items-data.md))

`{ source, sourceUrl, retrievedAt, runes: RuneItem[] }` avec
`RuneItem = { id, name, imageUrl, level, effectId, characteristicId | null, statLabel }`.

### Types du domaine (`src/domain/forgemagie.ts`)

- `PurchaseLine = { itemName, quantity, totalKamas }` et `unitPrice(line)` : règle pure (FR-022).
- `parsePurchaseLines(text): PurchaseLine[]` : même expression que le bot ; lignes invalides
  écartées (FR-022).
- `FmSession`, `FmPlayerSpend`, `FmRuneSummary`, `FmProfile` : formes des réponses de
  [contracts/fm-site-api.md](contracts/fm-site-api.md).
- `PriceOrigin = 'manual' | 'capture' | 'bot'`, avec les libellés « Saisie manuelle », « Capture »,
  « Bot Discord ».

### Stockage sur l'appareil

- `localStorage` `dofus-craft:fm-session-token` : jeton de session (R3), supprimé à la déconnexion
  ou à la première réponse 401.
- Aucun autre stockage nouveau ; les prix saisis ou importés en Mode personnel utilisent le carnet
  existant (`resource-price-repository`).
