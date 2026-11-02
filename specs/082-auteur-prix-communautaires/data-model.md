# Modèle de données : Auteur et date des prix communautaires

## `community_price_contributions` (existante)

| Champ | Type | Nouveau ? | Règle |
|---|---|---|---|
| `id`, `resource_id`, `server_id`, `amount_kamas`, `device_id`, `kind`, `origin`, `created_at`, `item_type`, outlier… | — | non | inchangés |
| **`author_discord_user_id`** | TEXT NULL | **oui** | identifiant Discord de l'auteur ; NULL = sans auteur. Renseigné seulement pour l'origine `manual` d'un utilisateur connecté et pour l'origine `capture`. Jamais renvoyé par une route publique. |

Index : `idx_community_price_contributions_author (author_discord_user_id, created_at)`.

Règles :

- Les lignes existantes gardent `NULL`. Aucune reconstitution.
- Une session absente, inconnue ou expirée à la saisie donne `NULL`, sans erreur.
- Suppression du profil : `author_discord_user_id` passe à `NULL` pour toutes les lignes de la
  personne, dans la même transaction que le reste.
- Purge (90 jours) : la ligne et l'auteur disparaissent ensemble.

## `fm_players` (existante, inchangée)

Fournit à la lecture : `display_name` (le pseudo) et `is_private` (0 = public, 1 = privé). Le pseudo
n'est exposé que si `is_private = 0`.

## Valeurs dérivées (pas de table)

- **Auteur affiché d'un prix** : pseudo de l'auteur de la **dernière** contribution du prix, si elle
  a un auteur et si son profil est public ; sinon absent.
- **Mention de mise à jour** : `par <pseudo> · il y a <durée>` ou `il y a <durée>`, à partir de
  `created_at` et de l'auteur affiché.
- **Mes contributions** : lignes de `community_price_contributions` dont `author_discord_user_id` est
  l'utilisateur, les plus récentes d'abord (20), plus leur nombre total conservé.

## Types côté site

```text
CommunityPrice            + latestAuthor?: string | null     # /community-price, /community-prices
LatestItemPrice           + author?: string | null           # /latest-price
SharedItemPriceEntry      + author?: string | null           # /item-prices
FmContributions           { total: number; recent: FmContribution[] }
FmContribution            { resourceId: string; kind: 'resource' | 'item'; serverId: string;
                            amountKamas: number; createdAt: string }
```
