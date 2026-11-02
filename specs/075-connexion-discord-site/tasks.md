---

description: "Liste des tâches : Connexion Discord pour tout le site"
---

# Tâches : Connexion Discord pour tout le site

**Entrée** : documents de `specs/075-connexion-discord-site/`

**Prérequis** : plan.md, spec.md, research.md, data-model.md, contracts/auth-api.md

**Tests** : inclus — la constitution (principe II) exige des tests pour les règles modifiées (appartenance, validation d'entrées).

**Organisation** : par parcours utilisateur (US1 à US4) ; chaque parcours se teste seul une fois la phase 2 terminée.

## Format : `[ID] [P?] [Story] Description`

- **[P]** : parallélisable (fichiers différents, sans dépendance en cours)
- **[Story]** : US1 à US4, comme dans spec.md

## Conventions de chemins

Projet web existant : site dans `src/`, Worker dans `worker/`, tests dans `tests/unit` et `tests/integration`.

---

## Phase 1 : Préparation

- [X] T001 Lire `worker/src/fm/http.ts`, `worker/src/fm/router.ts`, `src/features/forgemagie/useFmAuth.ts` et chercher tous les appels à `requireSession` (`rg requireSession worker/src`) pour lister les routes à protéger et les appelants à adapter ; noter la liste en commentaire de PR (pas de fichier)

---

## Phase 2 : Fondations (bloque tous les parcours)

**But** : schéma, jeton de session enrichi et protection par appartenance, avant d'ouvrir la connexion à tous.

**⚠️ CRITIQUE** : `requireMember` (T006–T007) doit être en place avant T012, sinon un non-membre connecté lirait les données Forgemagie.

- [X] T002 Créer la migration `worker/migrations/0030_add_site_login.sql` : `ALTER TABLE fm_players ADD COLUMN breed_id INTEGER;` et `ALTER TABLE fm_auth_sessions ADD COLUMN is_member INTEGER NOT NULL DEFAULT 1 CHECK (is_member IN (0, 1));` — mêmes colonnes ajoutées dans `worker/schema.sql` (tables `fm_players` et `fm_auth_sessions`)
- [X] T003 [P] Créer `worker/src/fm/breeds.ts` : `KNOWN_BREED_IDS` (1 à 18 et 20, comme `BREEDS` dans `src/domain/breeds.ts`) et `isKnownBreedId(value: unknown): value is number`
- [X] T004 [P] Test de cohérence `tests/unit/worker-breeds.test.ts` : les ids de `worker/src/fm/breeds.ts` sont exactement ceux de `BREEDS` (`src/domain/breeds.ts`) ; `isKnownBreedId` refuse 0, 19, 21, `'8'`, `1.5`, `null`
- [X] T005 [P] Mettre à jour les types dans `src/domain/forgemagie.ts` : `FmMe` gagne `breedId: number | null` et `isMember: boolean` ; type `FmLoginError = 'login-failed' | 'cancelled'` ; `parseLoginFragment` reconnaît `error=cancelled` (`not-member` n'est plus un fragment)
- [X] T006 Dans `worker/src/fm/http.ts` : `requireSession` renvoie `{ discordUserId, isMember } | undefined` (lit `is_member`) ; ajouter `forbiddenNotMember = () => json({ error: 'not-member' }, 403)` ; adapter tous les appelants listés en T001
- [X] T007 Dans `worker/src/fm/router.ts` : `/fm/me` (GET/PATCH/DELETE) reste ouvert à tout connecté ; toutes les autres routes de session (`/fm/seances*`, `/fm/captures*`, `/fm/channels*`, `/fm/channel-requests*`, `/fm/sessions*`, `/fm/players*`, `/fm/imports`, `/fm/items*`) répondent `forbiddenNotMember()` si `!isMember` ; `/fm/bot/*` inchangé
- [X] T008 [P] Tests Worker `tests/unit/fm-require-member.test.ts` : session membre → route Forgemagie 200 ; session `is_member = 0` → 403 `{"error":"not-member"}` sur `/fm/seances` ; la même session → 200 sur `GET /fm/me` ; pas de jeton → 401 ; jeton expiré → 401 ; session existante avant migration (`is_member` par défaut 1) → accès conservé
- [X] T009 Dans `src/services/fm-api.ts` : `fmLoginUrl(returnPath: string)` ajoute `return_path=<chemin encodé>` (et `return_to` en local comme avant) ; `request()` laisse le jeton en place sur un 403 et renvoie `{ status: 'error', code: 'not-member' }` ; `isMe` accepte `breedId` (nombre ou null) et `isMember` (booléen) ; `updateFmMe` accepte `breedId?: number | null`
- [X] T010 [P] Mettre à jour `tests/unit/fm-api.test.ts` : URL de connexion avec `return_path`, 403 `not-member` sans effacer le jeton, 401 efface le jeton, `FmMe` avec `breedId`/`isMember`
- [X] T011 Créer `src/app/AuthContext.tsx` : `AuthProvider` et `useAuth()` reprennent la logique de `src/features/forgemagie/useFmAuth.ts` (lecture unique du fragment `#session=` / `#error=` puis `history.replaceState`, lecture de `/fm/me`, `logout`, `forget`, `retry`, `updateMe`, synchronisation du serveur de jeu du profil) et ajoutent `login(returnPath)` ; statut `anonymous` sans appel réseau quand il n'y a pas de jeton ; écouteur `storage` qui repasse en `anonymous` quand le jeton est retiré dans un autre onglet ; envelopper `AppShell` dans `AuthProvider` (`src/app/App.tsx`)

**Point de contrôle** : `npm run test` passe ; le contexte existe mais l'interface n'a pas encore changé.

---

## Phase 3 : Parcours 1 — Se connecter depuis n'importe quelle page (P1) 🎯 MVP

**But** : tout compte Discord se connecte depuis n'importe quelle page et revient sur celle-ci.

**Test indépendant** : un non-membre se connecte depuis `/hdv`, revient sur `/hdv`, voit son pseudo et son avatar ; un refus Discord ramène sur la page, visiteur, avec un message.

### Tests du parcours 1

- [X] T012 [P] [US1] Tests Worker `tests/unit/fm-auth-callback.test.ts` : non-membre (Discord 404) → session créée avec `is_member = 0` et redirection `#session=…` sans `not-member` ; membre → `is_member = 1` ; `error=access_denied` → `#error=cancelled` ; erreur Discord ≠ 404 sur la vérification → `#error=login-failed` ; `DISCORD_GUILD_ID` absent → connexion possible avec `is_member = 0` ; `return_path` valide → redirection vers `{site}{return_path}#session=…` ; invalides (`//evil.com`, `https://evil.com`, `/a\b`, `/a\nb`, chemin > 200 caractères) → `/`
- [X] T013 [P] [US1] Tests d'interface `tests/integration/account-menu.test.tsx` : visiteur → bouton « Se connecter avec Discord » dont le lien contient `return_path` de la page courante ; fragment `#session=` lu une seule fois puis effacé de l'adresse ; fragment `#error=cancelled` → message « Connexion annulée » et visiteur ; connecté → pseudo et avatar visibles ; avatar absent → avatar par défaut

### Implémentation du parcours 1

- [X] T014 [US1] `worker/src/fm/auth.ts` : `handleLogin` valide `return_path` (commence par `/`, pas `//`, ni `\`, ni retour à la ligne, ni `:`, longueur ≤ 200, sinon `/`) et l'inscrit dans le `state` ; `handleCallback` : ne renvoie plus `error=not-member` (404 → `is_member = 0`), enregistre `is_member` dans `fm_auth_sessions`, traite `error=access_denied` en `error=cancelled`, n'exige plus `DISCORD_GUILD_ID` pour se connecter (absent → `is_member = 0`), redirige vers `{site}{return_path}#…` ; `backToSite` n'envoie plus toujours vers `/forgemagie`
- [X] T015 [US1] `worker/src/fm/me.ts` : `readMe` renvoie `breedId` (colonne `breed_id`) et `isMember` (de la session courante, passé par le routeur) dans la réponse de `GET /fm/me`
- [X] T016 [US1] Créer `src/app/AccountMenu.tsx` (version connexion) : visiteur → lien « Se connecter avec Discord » vers `fmLoginUrl(chemin courant)` ; `loading` → emplacement neutre de même taille ; connecté → avatar (repli : avatar par défaut) et pseudo ; erreur de connexion (`login-failed` / `cancelled`) → petite bulle dans la barre, fermable
- [X] T017 [US1] Brancher `AccountMenu` dans la zone droite de la barre de `src/app/AppShell.tsx` (après `PriceModeSwitch`, avant le lien Paramètres) et styler dans `src/styles/global.css` (taille d'icône des autres boutons de la barre, version mobile : avatar seul)

**Point de contrôle** : un non-membre se connecte depuis n'importe quelle page et reste connecté de page en page.

---

## Phase 4 : Parcours 2 — Menu profil et déconnexion (P1)

**But** : un menu sous le pseudo avec « Mon profil » et « Se déconnecter ».

**Test indépendant** : se déconnecter fait réapparaître le bouton de connexion, y compris après rechargement.

- [X] T018 [P] [US2] Tests `tests/integration/account-menu.test.tsx` (suite du fichier) : le menu s'ouvre au clic et au clavier (Entrée, Échap ferme, focus rendu au bouton) ; contient « Mon profil » (lien vers `/profil`) et « Se déconnecter » ; la déconnexion appelle `POST /fm/auth/logout`, efface le jeton, la barre repasse en visiteur et un rechargement ne reconnecte pas ; déconnexion dans un autre onglet (événement `storage`) → visiteur
- [X] T019 [US2] Compléter `src/app/AccountMenu.tsx` : bouton pseudo/avatar ouvrant un menu (`aria-haspopup`, `aria-expanded`, fermeture au clic extérieur, Échap, flèches), entrées « Mon profil » (`Link` vers `ROUTES.profile`) et « Se déconnecter » (`useAuth().logout`) ; réutiliser le motif d'accessibilité de `src/app/NavMenu.tsx`
- [X] T020 [US2] Ajouter `profile: '/profil'` dans `src/app/router.tsx`, le titre de l'onglet dans `PAGE_TITLES` de `src/app/AppShell.tsx` (« Profil — Dofus Craft ») et une route `<Route path={ROUTES.profile} element={<ProfilPage />} />` (page créée en T023 ; en attendant, composant `ProfilPage` minimal exporté de `src/features/account/ProfilPage.tsx`)

**Point de contrôle** : parcours 1 et 2 fonctionnent ensemble ; vérifier à 375 px.

---

## Phase 5 : Parcours 3 — Choisir son icône de classe (P2)

**But** : choisir, changer, retirer sa classe ; elle suit le profil sur tous les appareils.

**Test indépendant** : choisir une classe, recharger, se connecter ailleurs : même icône.

- [X] T021 [P] [US3] Tests Worker `tests/unit/fm-me-breed.test.ts` : `PATCH /fm/me {breedId: 8}` → 200 et `breedId: 8` ; `{breedId: null}` → retire la classe ; `{breedId: 19}`, `{breedId: "8"}`, `{breedId: 1.5}` → 400 ; la requête fonctionne pour une session non membre ; `DELETE /fm/me` supprime la classe avec le profil ; corps vide ou sans champ connu → 400
- [X] T022 [P] [US3] Tests d'interface `tests/integration/profil-page.test.tsx` : la page liste les 19 classes (nom + portrait `portraitUrl(id, 'm')`), choisir une classe appelle `updateFmMe({breedId})` et met à jour l'icône de la barre ; « Retirer » envoie `breedId: null` ; portrait en erreur → repli sur l'avatar Discord ; visiteur → invitation à se connecter ; suppression du profil demande confirmation, puis repasse en visiteur
- [X] T023 [US3] `worker/src/fm/me.ts` : `patchMe` accepte `breedId` (entier connu via `isKnownBreedId`, ou `null`), met à jour `fm_players.breed_id` et refuse (400) toute autre valeur ; le message d'erreur 400 cite `breedId`
- [X] T024 [P] [US3] Créer `src/features/account/BreedPicker.tsx` : grille des classes de `BREEDS` (bouton avec portrait `portraitUrl(id, 'm')` et nom, `aria-pressed` pour la classe choisie), bouton « Retirer mon icône », repli sur l'initiale si le portrait ne charge pas
- [X] T025 [US3] Créer `src/features/account/ProfilPage.tsx` : identité Discord (avatar, pseudo, mention « le pseudo vient de Discord »), état d'appartenance au serveur communautaire (membre / non membre), `BreedPicker` relié à `useAuth().updateMe({ breedId })`, suppression du profil avec confirmation via `deleteFmMe` puis `forget()` ; visiteur → `EmptyState` avec bouton de connexion
- [X] T026 [US3] Afficher l'icône de classe à côté du pseudo dans `src/app/AccountMenu.tsx` (portrait de `me.breedId` en petit badge sur l'avatar) et styler dans `src/styles/global.css`

**Point de contrôle** : la classe persiste après rechargement et sur un autre navigateur.

---

## Phase 6 : Parcours 4 — Un seul profil pour tout le site (P2)

**But** : la Forgemagie et la page du bot utilisent le même profil ; les non-membres reçoivent une explication claire.

**Test indépendant** : membre connecté depuis l'accueil ouvre la Forgemagie sans se reconnecter ; non-membre voit l'accès réservé.

- [X] T027 [P] [US4] Tests `tests/integration/forgemagie-page.test.tsx` (mise à jour) : connecté membre → onglets affichés sans nouvelle connexion ; connecté non-membre (`isMember: false`) → message « réservée aux membres du serveur Discord du groupe » (nom du serveur si `guildName`), aucun appel aux routes Forgemagie ; visiteur → bouton de connexion avec `return_path=/forgemagie` ; 403 `not-member` reçu d'une route → même message sans déconnecter ; session héritée d'avant la mise à jour (jeton existant) → connecté
- [X] T028 [US4] Réduire `src/features/forgemagie/useFmAuth.ts` à un adaptateur sur `useAuth()` (même forme de retour qu'avant : `status`, `me`, `loginError`, `logout`, `forget`, `updateMe`, `retry`) ; supprimer la logique dupliquée (lecture du fragment, effet de synchronisation du serveur) maintenant dans `AuthContext`
- [X] T029 [US4] `src/features/forgemagie/ForgemagiePage.tsx` : état « connecté, non membre » (message d'accès réservé, lien vers `/profil`), bouton de connexion passant `return_path` du chemin courant, retrait de `not-member` de `LOGIN_ERRORS` et du texte qui dit que la connexion elle-même est réservée aux membres
- [X] T030 [US4] Mettre à jour les commentaires de tête qui décrivent l'ancien comportement (« members only ») dans `worker/src/fm/auth.ts`, `src/features/forgemagie/ForgemagiePage.tsx` et `worker/README.md` (section connexion : connexion ouverte, appartenance vérifiée pour les routes Forgemagie, migration 0030)

**Point de contrôle** : les quatre parcours fonctionnent ; la Forgemagie existante est inchangée pour les membres.

---

## Phase 7 : Finitions et vérifications transverses

- [X] T031 [P] Parcours visiteur → connexion → retour → menu → déconnexion et mobile 375 px sans défilement horizontal : couverts par `tests/integration/account-menu.test.tsx` et `tests/integration/profil-page.test.tsx` (le Worker et Discord sont simulés) ; vérification mobile faite dans le navigateur (pas de spec Playwright : la connexion réelle passe par Discord et ne peut pas être automatisée)
- [X] T032 [P] Vérifier le navigateur sur grand et petit écran : la barre reste sur une ligne (`nav-layout.ts` tient compte de la zone droite plus large) ; si besoin, ajuster `moreWidth`/réserve dans `src/app/nav-layout.ts` et son test `tests/unit/nav-layout.test.ts`
- [X] T033 Passer en revue la sécurité : le jeton n'apparaît jamais dans l'adresse après lecture, ni dans `console.*` ; `return_path` ne permet pas de redirection ouverte (tests T012) ; aucun secret ajouté au dépôt
- [X] T034 Exécuter `npm run test`, `npm run lint`, `npm run build`, puis les scénarios de `specs/075-connexion-discord-site/quickstart.md` ; noter le résultat dans le message de fin de tâche

---

## Dépendances et ordre d'exécution

- **Phase 1** → **Phase 2** (bloque tout) → phases 3 à 6 → **Phase 7**.
- **US1** (phase 3) d'abord : c'est le MVP et le préalable visuel des autres parcours.
- **US2** (phase 4) dépend de `AccountMenu` (T016) mais pas de US3 ni US4.
- **US3** (phase 5) dépend de T015 (réponse `/fm/me` avec `breedId`) et de la route `/profil` (T020).
- **US4** (phase 6) dépend de T011 (`AuthContext`) et de T007 (protection des routes) ; peut être menée en parallèle de US3.
- À l'intérieur d'un parcours : tests, puis Worker, puis site.

### Tâches parallélisables

- Phase 2 : T003, T004, T005, T008, T010 (fichiers distincts) après T002 ; T006–T007 séquentiels.
- US1 : T012 et T013 ensemble ; T014 et T016 sur des fichiers distincts (T015 avant le test d'interface de la classe).
- US3 : T021, T022, T024 ensemble.
- Phase 7 : T031 et T032 ensemble.

### Exemple parallèle (Phase 2)

```text
Tâche : "Créer worker/src/fm/breeds.ts"                       (T003)
Tâche : "Test de cohérence tests/unit/worker-breeds.test.ts"  (T004)
Tâche : "Types src/domain/forgemagie.ts"                      (T005)
```

## Stratégie d'implémentation

1. **MVP** : phases 1, 2 et 3 (connexion ouverte à tous, bouton et pseudo dans la barre, Forgemagie protégée). Valider le parcours 1 seul.
2. Ajouter US2 (menu, déconnexion), puis US3 (classe) et US4 (Forgemagie sur le contexte commun).
3. Finitions (phase 7), puis relecture par le sous-agent `relecteur` avant de proposer la fusion dans `master`.

**Déploiement** : appliquer la migration `0030` sur D1 **avant** de déployer le Worker, puis le site.

## Notes

- Les noms `fm-*` (routes, tables, clé de stockage) sont conservés volontairement (spec FR-013).
- La page du bot Discord n'est pas dans ce dépôt ; elle utilisera `useAuth()` (voir quickstart.md).
- Valider à chaque point de contrôle avant de passer à la phase suivante.
