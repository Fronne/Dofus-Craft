# Guide de validation : Connexion Discord pour tout le site

## Prérequis

- Dépendances installées (`npm install`), base D1 locale du Worker à jour : appliquer
  `worker/migrations/0030_add_site_login.sql`.
- Variables du Worker : `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_GUILD_ID`,
  `SITE_URL` (voir `worker/README.md`). La redirection OAuth de l'application Discord doit rester
  `{worker}/fm/auth/callback`.
- Deux comptes Discord de test : un membre du serveur communautaire, un non-membre.

## Tests automatiques

```bash
npm run test
npm run lint
npm run build
```

Couverture attendue : validation de `return_path`, validation de `breedId`, cohérence des ids du
Worker avec `BREEDS`, `requireMember` (membre / non-membre / sans session), `AuthContext`
(fragment lu une fois, jeton effacé sur 401, jeton conservé sur 403), `AccountMenu`, `ProfilPage`,
Forgemagie non-membre.

## Scénarios manuels (voir [spec.md](spec.md))

1. **US1** — Visiteur sur `/hdv` : clic « Se connecter avec Discord », autoriser avec le compte
   non-membre. Retour sur `/hdv`, pseudo et avatar dans la barre, aucun message d'erreur.
   Annuler l'autorisation : retour sur la page, toujours visiteur, message « connexion annulée ».
2. **US2** — Ouvrir le menu du pseudo : « Mon profil » et « Se déconnecter » ; se déconnecter puis
   recharger : visiteur. Vérifier en largeur mobile (375 px).
3. **US3** — Sur `/profil`, choisir une classe : l'icône apparaît dans la barre ; recharger ;
   se connecter depuis un autre navigateur : même icône. La retirer : avatar seul.
4. **US4** — Compte membre : ouvrir `/forgemagie` sans nouvelle connexion. Compte non-membre :
   message « réservée aux membres du serveur ». Session Forgemagie d'avant la mise à jour
   (jeton déjà en `localStorage`) : toujours connecté, séances intactes.
5. **Cas limites** — jeton supprimé à la main dans `localStorage` : visiteur sans erreur ;
   déconnexion dans un onglet : l'autre onglet passe visiteur ; `GET /fm/seances` avec la session
   du non-membre : 403 `not-member`.

## Brancher la page du bot

La page du bot de l'utilisateur utilise `useAuth()` (`src/app/AuthContext.tsx`) : `status`, `me`,
`login(returnPath)`. Pas de connexion propre à la page.
