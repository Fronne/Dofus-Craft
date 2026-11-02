# Modèle de données : Connexion Discord pour tout le site

Migration `worker/migrations/0030_add_site_login.sql` (additive, répétée dans `worker/schema.sql`).

## Profil utilisateur — `fm_players` (existant)

| Champ | Type | Règle |
|---|---|---|
| `discord_user_id` | TEXT, clé | Identité unique, inchangée |
| `display_name` | TEXT | Pseudo Discord (`global_name` sinon `username`), mis à jour à chaque connexion |
| `avatar_url` | TEXT NULL | Avatar Discord ; NULL = avatar par défaut côté site |
| `server_id` | TEXT NULL | Serveur de jeu du profil (existant) |
| `is_private` | 0/1 | Confidentialité Forgemagie (existant) |
| `first_login_at` | TEXT NULL | Existant |
| **`breed_id`** | INTEGER NULL | **Nouveau.** Classe choisie (id de `BREEDS`) ; NULL = aucune |

Règles : `breed_id` doit être un id connu (1–18 ou 20, voir `src/domain/breeds.ts`) ou NULL. Une
valeur inconnue est refusée (400). La suppression du profil (`DELETE /fm/me`) supprime la ligne, donc
la classe avec elle.

## Session — `fm_auth_sessions` (existant)

| Champ | Type | Règle |
|---|---|---|
| `token_hash` | TEXT, clé | SHA-256 du jeton (jamais le jeton) |
| `discord_user_id` | TEXT | → `fm_players` |
| `expires_at` | TEXT | 30 jours (inchangé) |
| `created_at` | TEXT | Existant |
| **`is_member`** | INTEGER NOT NULL DEFAULT 1 | **Nouveau.** 1 = membre du serveur communautaire au moment de la connexion |

Transitions : créée au callback ; supprimée par déconnexion, expiration ou suppression du profil.
Les sessions antérieures à la migration valent `is_member = 1`.

## Classe Dofus — `BREEDS` (code, pas de table)

`{ id, name }` ; portrait `public/class-heads/Head_{id}0.png`. Liste fermée de 19 classes.

## Forme renvoyée par `GET /fm/me` (côté site : `FmMe`)

```text
discordUserId, displayName, avatarUrl, serverId, isPrivate, firstLoginAt, guildName,
breedId: number | null,        # nouveau
isMember: boolean              # nouveau (de la session courante)
```

## Contexte d'authentification côté site (`AuthContext`)

```text
status: 'loading' | 'anonymous' | 'connected' | 'unavailable'
me?: FmMe
loginError?: 'login-failed' | 'cancelled'
login(returnPath), logout(), forget(), retry(), updateMe({ serverId?, isPrivate?, breedId? })
```
