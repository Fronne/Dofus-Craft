# Research: Page Forgemagie en séances de FM

Source : `backups/production-2026-10-12/site-index-original.js` (code minifié du site en ligne), décalages
≈ 722 700 à 771 600, et le Worker du dépôt (`worker/src/fm/`), restauré par specs/045.

## 1. Ce qui est repris tel quel du dépôt

- **Decision**: garder `PlayerBadge`, `useEquipmentSearch`, `StatTile`, `Kamas`, `EmptyState`, le jeton de
  session, la lecture d'une capture (`capture-ocr`) et l'essentiel de `CaptureImport`, `ProfileTab`
  (réglages, suppression) et `useFmAuth`.
- **Rationale**: le code en ligne de ces blocs est celui du dépôt à quelques lignes près ; les réécrire
  apporterait des écarts, pas de la fidélité.

## 2. Ce qui change

| Bloc | Site en ligne | Dépôt (027–031) |
|------|---------------|-----------------|
| Onglets | Séances de FM / nom du groupe / Profil, à icône | Sessions / Profil |
| Liste | séances du joueur, relues toutes les 10 s si l'une est en cours | sessions paginées de tous |
| Création | nom + objet facultatif → le bot crée le salon et ouvre une session | choix d'un salon, d'un objet |
| Détail | séance : chiffres, achats, sessions repliées, captures repliées | une session et ses captures |
| Objet | choisi / changé / renommé / retiré dans la séance | géré dans le profil, récapitulatif à part |
| Capture | correction des lignes, lignes non comptées | lecture seule |
| Import | dans la séance, vers la session ouverte | dans le profil, session au choix |
| Groupe | joueurs publics et leurs séances | — |
| Profil | serveur du site (lecture seule), visibilité expliquée | menu de serveur, visibilité « sans effet » |

## 3. Client de l'API

- **Decision**: réécrire `fm-api.ts` avec les fonctions du site en ligne (voir
  [contracts/fm-seances-client.md](./contracts/fm-seances-client.md)) et retirer celles que l'écran
  n'appelle plus (`getFmSessions`, `getFmSession`, `createFmItem`, `deleteFmItem`, `getFmItem`,
  `attachFmChannel`, `getFmChannels`, `attachFmSession`, `detachFmSession`).
- **Validation**: chaque réponse passe un garde de forme avant usage, comme aujourd'hui ; les champs
  ajoutés après coup par l'API (`corrected`, `lines`, `ignored`, `seances`, `canOpen`, `fmItems`) ont une
  valeur par défaut, pour qu'une API plus ancienne ne casse pas l'écran.
- **Adresse de connexion**: `…/fm/auth/login`, avec `?return_to=<origine>` quand le site tourne sur
  `localhost` ou `127.0.0.1` (le Worker renvoie alors vers le site local).
- **Écart voulu**: la sauvegarde fige l'ancienne adresse de l'API ; le dépôt garde
  `VITE_COMMUNITY_API_URL`.

## 4. Serveur du profil

- **Decision**: `useFmAuth` envoie `PATCH /fm/me { serverId }` dès que le joueur est connecté et que le
  serveur de son profil diffère du serveur actif du site ; le menu de serveur du profil disparaît.
- **Rationale**: comportement en ligne (≈ 769 600) ; un seul endroit pour choisir son serveur.

## 5. Relecture automatique

- Liste : toutes les 10 s et au retour de visibilité, tant qu'une séance est `running`.
- Détail : 10 s après chaque lecture et au retour de visibilité, tant que la séance est `running` ou
  qu'une demande d'archivage / réouverture est `pending`. Une lecture qui échoue après une première
  réussie laisse l'écran tel quel.
- Une réponse d'action (arrêt, reprise, archivage, correction, objet) remplace l'état affiché et annule
  la lecture en cours, plus ancienne.

## 6. Styles

- **Decision**: aligner la section Forgemagie de `global.css` sur la feuille en ligne : ajouter les
  règles présentes seulement en ligne, retirer celles que plus aucun composant n'utilise.
- **Méthode**: comparaison règle à règle des deux feuilles (script du dossier de travail), puis
  vérification à l'écran.

## 7. Tests

- Test de page réécrit (`forgemagie-page.test.tsx`) : `fm-api` simulé, un scénario au moins par récit.
- Test du client (`fm-api.test.ts`) : routes, corps envoyés, valeurs par défaut, erreurs.
- Règles pures ajoutées au test du domaine.
- Les tests du Worker (`tests/unit/fm-*.test.ts`) ne sont pas touchés.
