# Recherche : Connexion Discord pour tout le site

## R1 — Généraliser plutôt que réécrire

- **Décision** : garder les routes `/fm/auth/login|callback|logout`, les tables `fm_players` /
  `fm_auth_sessions`, la clé `dofus-craft:fm-session-token` et le format de jeton. On ajoute des
  champs ; on ne renomme rien.
- **Raison** : FR-013 (sessions Forgemagie intactes) et constitution IV. Renommer les routes
  casserait les sessions en cours et le bot, pour un gain purement cosmétique.
- **Alternatives** : nouvelles routes `/auth/*` + migration des sessions (rejeté : risque, aucun gain
  utilisateur) ; alias `/auth/*` (rejeté : surface en double).

## R2 — Où vit l'appartenance au serveur

- **Décision** : mesurée à chaque connexion (appel `/users/@me/guilds/{id}/member`), stockée dans
  `fm_auth_sessions.is_member`. Un 404 Discord donne `is_member = 0` au lieu de refuser la
  connexion. Les routes Forgemagie (`/fm/seances`, `/fm/players`, `/fm/sessions`, `/fm/items`,
  `/fm/channels`, `/fm/captures`, `/fm/imports`) exigent `is_member = 1` et répondent 403
  `{ "error": "not-member" }` sinon. `/fm/me` (GET/PATCH/DELETE) et `/fm/auth/logout` restent
  ouverts à tout connecté.
- **Raison** : la valeur est connue seulement pendant le callback (le jeton d'accès Discord n'est pas
  conservé). Par session plutôt que par joueur : une nouvelle connexion remet la valeur à jour, un
  départ du serveur se voit à la prochaine connexion (cas limite de la spec).
- **Migration** : `is_member INTEGER NOT NULL DEFAULT 1` — toutes les sessions existantes ont été
  créées par des membres (l'ancien login l'exigeait).
- **Si `DISCORD_GUILD_ID` n'est pas défini** : la connexion reste possible, `is_member = 0`.
- **Si Discord répond une erreur autre que 404 sur la vérification** : échec de connexion
  (`login-failed`), comme aujourd'hui, pour ne pas classer à tort un membre en non-membre.
- **Alternatives** : champ sur `fm_players` (rejeté : mélange identité durable et état de session) ;
  vérification à chaque requête (rejeté : jeton Discord non stocké, appels coûteux).

## R3 — Retour sur la page d'origine

- **Décision** : le site passe `return_path` (chemin relatif, ex. `/hdv`) à `/fm/auth/login`. Il est
  validé (commence par `/`, pas `//`, pas de `\`, longueur ≤ 200, sans retour à la ligne) puis
  inscrit dans le `state` OAuth (comme `return_to` pour le local aujourd'hui). Le callback
  redirige vers `{site}{return_path}#session=…`. Chemin invalide ou absent : `/forgemagie` (le retour
  d'avant la généralisation, pour qu'un site resté chargé dans un navigateur continue de fonctionner).
- **Raison** : FR-003 ; la validation interdit les redirections ouvertes.
- **Alternative** : stocker le chemin dans `sessionStorage` côté site (rejeté : perdu si le
  navigateur change d'onglet pendant l'autorisation Discord).

## R4 — État global côté site

- **Décision** : `AuthContext` (fournisseur placé dans `App`, au-dessus de `AppShell`) reprend la
  logique de `useFmAuth` : lecture unique du fragment `#session=` / `#error=`, lecture de
  `/fm/me`, `logout`, `forget`, `updateMe`, `retry`. `useFmAuth()` devient un adaptateur qui renvoie
  la même forme qu'avant pour `ForgemagiePage` et ses onglets.
- **Raison** : FR-009 (une connexion pour tout le site). La synchronisation du serveur de jeu du
  profil (effet existant) passe dans le contexte pour ne plus dépendre de la page Forgemagie.
- **Sans jeton** : aucun appel réseau, statut `anonymous` immédiat.
- **Plusieurs onglets** : un écouteur de l'évènement `storage` remet le statut à jour quand le jeton
  est retiré dans un autre onglet.

## R5 — Menu du compte et page profil

- **Décision** : `AccountMenu` dans la zone droite de la barre (après le sélecteur de prix, avant
  Paramètres). Visiteur : bouton « Se connecter ». Connecté : avatar + icône de classe + pseudo ;
  menu « Mon profil » (`/profil`) et « Se déconnecter ». Sur mobile (barre du bas), le menu reste
  dans la barre du haut, en icône seule.
- **Page `/profil`** (`ProfilPage`) : identité Discord, sélecteur de classe, état d'appartenance,
  suppression du profil (confirmation). Elle n'est pas dans la liste des pages activables de
  `site-settings` : elle n'est pas un onglet de navigation.
- **Visiteur sur `/profil`** : invitation à se connecter.

## R6 — Icônes de classe

- **Décision** : réutiliser `BREEDS` et `portraitUrl` de `src/domain/breeds.ts`
  (`public/class-heads/Head_{id}0.png`). Le profil stocke seulement `breed_id` (entier ou NULL). Le
  Worker valide `breedId` contre sa propre liste d'ids (`worker/src/fm/breeds.ts`, 19 ids, avec un
  test qui la compare à `BREEDS` pour éviter la dérive). Un portrait manquant : repli sur
  l'avatar Discord, sans erreur.
- **Alternative** : importer `src/domain/breeds.ts` depuis le Worker (rejeté : les deux builds sont
  séparés ; un test de cohérence suffit).

## R7 — Erreurs de connexion

- **Décision** : le fragment de retour peut valoir `error=login-failed`, `error=cancelled`
  (Discord renvoie `error=access_denied`) ou, pour une action réservée, la réponse 403
  `not-member` des routes. Le site affiche un message court dans la barre (bulle) pour
  `login-failed` / `cancelled`, puis efface le fragment. `not-member` n'est plus un fragment : il
  est affiché par la page Forgemagie.

## R8 — Page du bot Discord

- La page du bot de l'utilisateur n'est pas dans ce dépôt (aucune occurrence dans `src/`). Cette
  fonctionnalité fournit `useAuth()` et le profil partagé ; son branchement est hors périmètre et
  reste documenté dans `quickstart.md`.
