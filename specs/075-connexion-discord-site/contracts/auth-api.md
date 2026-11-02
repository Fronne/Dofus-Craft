# Contrat : API de connexion et de profil

Routes du Worker concernées. Tout le reste de `/fm/*` est inchangé, sauf la protection par
appartenance (ci-dessous).

## `GET /fm/auth/login`

Paramètres de requête (tous facultatifs) :

- `return_path` — chemin du site où revenir, ex. `/hdv`. Valide si : commence par `/`, ne commence
  pas par `//`, ne contient ni `\`, ni retour à la ligne, ni `:`, longueur ≤ 200. Sinon traité comme
  le chemin par défaut. Sans `return_path`, le retour se fait sur `/forgemagie` (comportement d'avant la
  généralisation : un site déjà chargé dans un navigateur continue de fonctionner).
- `return_to` — origine d'un site local (`http://localhost…`), comportement existant.

Réponse : 302 vers `https://discord.com/oauth2/authorize` (scopes inchangés :
`identify guilds guilds.members.read`). Configuration Discord absente : 302 vers le site avec
`#error=login-failed`.

## `GET /fm/auth/callback`

| Cas | Résultat |
|---|---|
| Autorisation refusée (`error=access_denied`) | 302 `{site}{return_path}#error=cancelled` |
| Autre échec (état invalide, Discord indisponible, vérification d'appartenance en erreur ≠ 404) | 302 `…#error=login-failed` |
| Succès, membre | 302 `{site}{return_path}#session=<jeton>`, session `is_member = 1` |
| Succès, **non membre** (Discord 404) | 302 `{site}{return_path}#session=<jeton>`, session `is_member = 0` — **plus d'erreur `not-member`** |

## `POST /fm/auth/logout`

Inchangé : 204, supprime la session du jeton.

## `GET /fm/me` (tout connecté)

200 :

```json
{
  "discordUserId": "123", "displayName": "Pseudo", "avatarUrl": "https://…|null",
  "serverId": "…|null", "isPrivate": false, "firstLoginAt": "…|null", "guildName": "…|null",
  "breedId": 8, "isMember": true
}
```

401 jeton absent/expiré ; 404 profil absent.

## `PATCH /fm/me` (tout connecté)

Corps : au moins un de `serverId` (string non vide ≤ 64), `isPrivate` (boolean), `breedId` (entier
connu de `BREEDS`, ou `null` pour retirer). 200 : le profil à jour. 400 : corps invalide ou
`breedId` inconnu.

## `DELETE /fm/me`

Inchangé (204). Supprime aussi la classe.

## Routes réservées aux membres

`/fm/seances*`, `/fm/captures*`, `/fm/channels*`, `/fm/channel-requests*`, `/fm/sessions*`,
`/fm/players*`, `/fm/imports`, `/fm/items*` : session valide **et** `is_member = 1`.

- Session valide, non membre : **403** `{ "error": "not-member" }`.
- Pas de session : 401 `{ "error": "Unauthorized" }` (inchangé).

Les routes du bot (`/fm/bot/*`) gardent leur clé propre, inchangées.

## Contrat côté site

- `fmLoginUrl(returnPath)` renvoie `${API_URL}/fm/auth/login?return_path=…` (et `return_to` en local).
- `request()` de `fm-api.ts` : une réponse 403 `not-member` donne `{ status: 'error', code: 'not-member' }` ; **le jeton n'est pas effacé**.
- Fragment de retour lu une seule fois par `AuthContext` puis effacé de l'adresse et de l'historique.
