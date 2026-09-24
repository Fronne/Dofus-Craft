# Tasks: Administration des compteurs de joueurs

**Input**: Documents de conception de `specs/014-admin-counters/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: inclus (plan.md) : validation, vérification Access, API d'administration, lecture publique,
bulles, page d'administration.

**Organization**: tâches groupées par user story. La vérification de l'accès (US2) est une brique
bloquante de toutes les routes d'administration : son code est en phase 2, ses scénarios en phase 4.

## Format: `[ID] [P?] [Story] Description`

- **[P]** : parallélisable (fichiers différents, pas de dépendance sur une tâche inachevée)
- **[Story]** : US1 (changer un chiffre), US2 (accès réservé), US3 (ajouter), US4 (supprimer)

---

## Phase 1: Setup

- [X] T001 [P] Installer `jose` (6.x) avec `npm install jose` (met à jour `package.json` et `package-lock.json`) ; il ne sera importé que par `admin-worker/`.
- [X] T002 [P] Extraire les portraits `Head_{id}0` (homme) et `Head_{id}1` (femme) des 19 classes (`1–18`, `20`) de `Content/Picto/UI/class_assets_.bundle` (UnityPy, `FALLBACK_UNITY_VERSION = '6000.3.16f1'`) vers `public/class-heads/Head_{id}{0|1}.png` (38 fichiers) ; noter la source dans `public/class-heads/SOURCES.md`.
- [X] T003 [P] Créer `src/domain/breeds.ts` : liste des 19 classes `{ id, name }` (1 Féca, 2 Osamodas, 3 Enutrof, 4 Sram, 5 Xélor, 6 Ecaflip, 7 Eniripsa, 8 Iop, 9 Crâ, 10 Sadida, 11 Sacrieur, 12 Pandawa, 13 Roublard, 14 Zobal, 15 Steamer, 16 Eliotrope, 17 Huppermage, 18 Ouginak, 20 Forgelance), `isKnownBreedId(id)`, `breedName(id)`, `portraitUrl(breedId, sex)` → `/class-heads/Head_{id}{0|1}.png`.
- [X] T004 Créer la seconde entrée Vite : `vite.admin.config.ts` (root `admin/`, `publicDir` = `public/` du projet, sortie `dist-admin/`), `admin/index.html` (titre « Administration — Dofus Craft »), `admin/main.tsx` (importe `src/styles/global.css`, `theme.css`, `design-modern.css`, applique thème/design mémorisés, rend `AdminPage`) ; scripts `admin:build`, `admin:dev`, `admin:deploy`, `worker:db:migrate-player-counters` dans `package.json` ; `dist-admin/` dans `.gitignore`.
- [X] T005 Créer `admin-worker/wrangler.toml` (`name = "dofus-craft-admin"`, `main = "src/index.ts"`, `workers_dev = true`, `[assets] directory = "../dist-admin"`, `not_found_handling = "single-page-application"`, `run_worker_first = ["/api/*"]`, même `[[d1_databases]]` que `worker/wrangler.toml`, `[vars] TEAM_DOMAIN = ""`, `POLICY_AUD = ""`, commentaire sur le secret `OWNER_EMAIL`) et `admin-worker/tsconfig.json` (comme `worker/tsconfig.json`).

---

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T006 [P] Écrire `tests/unit/player-counter-validation.test.ts` : création valide acceptée ; refus avec le champ fautif pour chaque contrainte de data-model.md — `player` « obligatoire, 1 à 40 caractères », `breedId` « une des 19 classes », `sex` « `m` ou `f` », `count` « entier ≥ 0 », `atLeast` booléen, `unitOne`/`unitMany` « obligatoire, 1 à 40 caractères », `target.itemId` entier > 0, `target.name` non vide, `target.icon` URL `https://api.dofusdb.fr/img/items/` ; mise à jour partielle (`count`, `atLeast`) validée seule ; `formatCount` (« 150+ » si `atLeast`) ; `counterLabel` (« Compteur de tentatives de FM de Nicomoux »).
- [X] T007 Créer `src/domain/player-counter.ts` : type `PlayerCounter` (forme JSON de data-model.md), `PlayerCounterInput`, `validateCounterInput(input, 'create' | 'update')` → `{ ok: true, value } | { ok: false, field, error }` (messages en français), `formatCount`, `counterLabel`, `unitFor(counter)` (singulier si `count` ≤ 1). Aucune dépendance au DOM ni à Workers (importé par le site, la page d'administration et le Worker d'administration).
- [X] T008 Créer `worker/migrations/0004_add_player_counters.sql` (table `player_counters` de data-model.md avec `CHECK (count >= 0)`, `CHECK (at_least IN (0, 1))`, `CHECK (sex IN ('m', 'f'))`, index sur `created_at`, et `INSERT` des deux compteurs actuels : Le-Lanceurdeglyphe 1/m/150/at_least 1/Parangon de puissance 21189 icône 50733 ; Nicomoux 12/m/157/at_least 0/Amulette du Strigide 14094 icône 1235) ; ajouter la table à `worker/schema.sql`.
- [X] T009 [P] Écrire `tests/unit/player-counters-read.test.ts` puis créer `worker/src/player-counters.ts` : `readPlayerCounters(db)` (tri `created_at` croissant, conversion ligne → forme JSON) avec base structurelle comme `worker/src/retention.ts` ; ajouter `GET /player-counters` public dans `worker/src/index.ts` (avant le contrôle de la clé d'app).
- [X] T010 [P] Écrire `tests/unit/player-counters-api.test.ts` puis créer `src/services/player-counters-api.ts` (`getPlayerCounters()` → `{ status: 'ok', counters } | { status: 'unavailable' }`, ne lève jamais, rejette une réponse mal formée) et `src/persistence/player-counters-cache.ts` (clé `craftcheck-player-counters`, `try/catch`).
- [X] T011 Faire lire la liste aux bulles : dans `src/features/dungeon-counter/`, remplacer `dungeon-counter.ts` par un hook `usePlayerCounters()` (cache lu au montage, requête au chargement, cache mis à jour ; sans liste connue → tableau vide) ; `PlayerCounters` rend une bulle par compteur ; `DungeonCounterBubble` utilise `portraitUrl`, `breedName`, `formatCount`, `unitFor`, `counterLabel` et `target.icon`/`target.name`. Supprimer `public/dungeon-counter/` (images remplacées par `public/class-heads/` et les icônes DofusDB). Adapter `tests/integration/dungeon-counter-bubble.test.tsx` (service simulé : liste affichée ; indisponible avec cache → cache ; sans cache → aucune bulle).
- [X] T012 [P] Écrire `tests/unit/admin-access.test.ts` puis créer `admin-worker/src/access.ts` : `verifyOwner(request, env, verify)` qui renvoie l'adresse ou refuse ; refus si `TEAM_DOMAIN`, `POLICY_AUD` ou `OWNER_EMAIL` manquent, si l'en-tête `Cf-Access-Jwt-Assertion` manque, si la vérification `jose` (`jwtVerify` avec `createRemoteJWKSet(TEAM_DOMAIN + '/cdn-cgi/access/certs')`, `issuer: TEAM_DOMAIN`, `audience: POLICY_AUD`) échoue, ou si l'adresse du jeton diffère d'`OWNER_EMAIL` (comparaison insensible à la casse) ; `verify` injectable pour les tests.

**Checkpoint**: le site affiche les compteurs depuis la base ; l'API d'administration sait qui est le propriétaire.

---

## Phase 3: User Story 1 - Changer le chiffre d'un compteur (Priority: P1) 🎯 MVP

**Goal**: depuis la page d'administration, changer le chiffre et « au moins » ; visible par tous.

**Independent Test**: quickstart.md, scénario manuel 2.

- [X] T013 [P] [US1] Écrire `tests/unit/admin-worker-counters.test.ts` (US1) : `GET /api/counters` renvoie la liste ; `PATCH /api/counters/:id` avec `{ count: 162, atLeast: false }` met à jour et renvoie le compteur (`updated_at` changé) ; valeur invalide → `400 { field: 'count' }` ; identifiant inconnu → `404` ; `GET /api/me` → `{ email }` (base simulée, `verifyOwner` simulé).
- [X] T014 [US1] Créer `admin-worker/src/counters.ts` (`listCounters`, `updateCounter`, validation via `src/domain/player-counter.ts`) et `admin-worker/src/index.ts` : toute route `/api/*` passe d'abord par `verifyOwner` (403 sinon) ; `GET /api/me`, `GET /api/counters`, `PATCH /api/counters/:id` ; le reste est servi par `env.ASSETS`.
- [X] T015 [P] [US1] Écrire `tests/integration/admin-page.test.tsx` (US1) : la page liste les compteurs (portrait, pseudo, classe, objet) ; changer le chiffre et décocher « Au moins » puis « Enregistrer » envoie le `PATCH` et affiche « Enregistré. » ; chiffre invalide → message nommant le champ, aucun envoi ; échec réseau → « Enregistrement impossible pour le moment. », valeurs conservées.
- [X] T016 [US1] Créer `admin/admin-api.ts` (appels same-origin `/api/*`, jamais d'exception, `{ status: 'ok' | 'invalid' | 'unavailable' | 'forbidden' }`), `admin/AdminPage.tsx` (en-tête « Administration », adresse connectée, section « Compteurs », sections prévues pour la suite) et `admin/CounterEditor.tsx` (contracts/admin-ui.md) ; styles dans `admin/admin.css`, mise en page utilisable en 375 px.

**Checkpoint**: le propriétaire change un chiffre sans redéployer.

---

## Phase 4: User Story 2 - Accès réservé au propriétaire (Priority: P1)

**Goal**: rien d'administrable sans la connexion du propriétaire ; aucune trace sur le site.

**Independent Test**: quickstart.md, scénarios manuels 1 et 3.

- [X] T017 [US2] Compléter `tests/unit/admin-worker-counters.test.ts` (US2) : chaque route `/api/*` (GET, POST, PATCH, DELETE, `/api/me`) renvoie `403` et ne touche pas la base quand `verifyOwner` refuse ; une route hors `/api/` n'appelle pas `verifyOwner` (page servie, Access la protège en amont).
- [X] T018 [P] [US2] Écrire `tests/unit/no-admin-on-public-site.test.ts` : aucun fichier de `src/` n'importe depuis `admin/` ni ne contient l'adresse `dofus-craft-admin` ; aucun lien d'administration dans la navigation (FR-008).
- [X] T019 [US2] Documenter dans `README.md` (section « Administration ») le Worker `dofus-craft-admin`, la mise en place Access pas à pas (quickstart.md) et le secret `OWNER_EMAIL`.

---

## Phase 5: User Story 3 - Ajouter un compteur (Priority: P2)

**Goal**: créer un compteur complet depuis la page ; nouvelle bulle pour tous.

**Independent Test**: quickstart.md, scénario manuel 4.

- [X] T020 [P] [US3] Compléter `tests/unit/admin-worker-counters.test.ts` (US3) : `POST /api/counters` valide → `201` avec `id`, `createdAt` ; champ manquant ou invalide → `400 { field }`, rien n'est inséré.
- [X] T021 [US3] Ajouter `createCounter` (UUID, `created_at`/`updated_at` serveur) à `admin-worker/src/counters.ts` et la route `POST /api/counters` à `admin-worker/src/index.ts`.
- [X] T022 [P] [US3] Ajouter `searchDofusDbItemsByName(query, signal?)` dans `src/services/dofusdb-api.ts` (tout le catalogue, `name.fr[$regex]` insensible aux accents comme la recherche existante, 10 résultats, id/nom/icône) et son test dans `tests/unit/dofusdb-search-by-name.test.ts`.
- [X] T023 [US3] Créer `admin/NewCounterForm.tsx` : pseudo ; classe (liste de `breeds.ts`) et sexe (Homme/Femme) avec aperçu `portraitUrl` ; libellés singulier/pluriel ; recherche d'objet avec propositions et icônes (choix obligatoire, message si le catalogue est injoignable) ; chiffre de départ ; « Au moins » ; « Ajouter » → message « Compteur ajouté. » et liste rechargée ; erreurs nommant le champ.
- [X] T024 [US3] Compléter `tests/integration/admin-page.test.tsx` (US3) : aperçu du portrait selon classe/sexe ; recherche proposant des objets ; ajout complet → `POST` envoyé, nouveau compteur listé ; champ manquant → refus sans envoi.

---

## Phase 6: User Story 4 - Supprimer un compteur (Priority: P3)

**Goal**: supprimer après confirmation.

**Independent Test**: quickstart.md, scénario manuel 5.

- [X] T025 [P] [US4] Compléter `tests/unit/admin-worker-counters.test.ts` (US4) : `DELETE /api/counters/:id` → `204` et ligne supprimée ; identifiant inconnu → `404`.
- [X] T026 [US4] Ajouter `deleteCounter` à `admin-worker/src/counters.ts` et la route `DELETE /api/counters/:id` à `admin-worker/src/index.ts`.
- [X] T027 [US4] Dans `admin/CounterEditor.tsx`, bouton « Supprimer » avec confirmation `window.confirm('Supprimer le compteur de <pseudo> (<libellé pluriel>) ?')` ; accepté → `DELETE`, « Compteur supprimé. », liste rechargée ; refusé → rien. Compléter `tests/integration/admin-page.test.tsx` (US4, `confirm` simulé).

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T028 Lancer `npm test`, `npm run typecheck`, `npm run lint`, les typecheck des Workers (`npx tsc --noEmit -p worker`, `npx tsc --noEmit -p admin-worker`), `npm run admin:build`, `npm run build` et `npx playwright test --project=desktop`.
- [X] T029 Vérifier en navigateur, API simulée : les bulles du site (ordinateur, 375 px, deux designs) et la page d'administration (`npm run admin:dev`, liste, modification, ajout, suppression, 375 px).

---

## Notes d'implémentation

- Les routes du Worker d'administration (liste, modification, création, suppression, `/api/me`) ont
  été écrites ensemble, puis testées story par story dans `tests/unit/admin-worker-counters.test.ts`
  (16 tests, dont le refus de chaque route sans le propriétaire).
- Libellé d'accessibilité des bulles : « Compteur de <libellé pluriel> de <pseudo> » (par exemple
  « Compteur de donjons sans drop de Le-Lanceurdeglyphe »).
- Les images locales de specs/013 (`public/dungeon-counter/`) sont supprimées : portraits dans
  `public/class-heads/`, icônes d'objets servies par DofusDB.
- Page d'administration vérifiée en navigateur avec l'API simulée (1366 px et 375 px, clair et
  sombre, « Classique » et « Nouveau ») ; corrections : champ « Chiffre » qui élargissait la carte,
  case « Au moins » désalignée, pseudo long coupé au trait d'union sur mobile.
- Vérification du jeton Access : `jose`, testée avec un vérificateur simulé ; le vrai parcours de
  connexion ne peut être vérifié qu'après la mise en place Access par le propriétaire.
- Pas encore déployé : voir l'ordre de mise en ligne ci-dessous.

## Dependencies & Execution Order

- Phase 1 → Phase 2 → stories. T007 avant T009–T011, T013–T016 ; T012 avant T014.
- US1 (P1) puis US2 (P1, tests sur les routes d'US1), puis US3, puis US4 (fichiers partagés
  `admin-worker/src/counters.ts`, `admin-worker/src/index.ts`, `tests/unit/admin-worker-counters.test.ts`).
- Mise en ligne, hors tâches et sur accord (quickstart.md) : migration D1 → API publique → Worker
  d'administration → réglage Access et secret `OWNER_EMAIL` par le propriétaire → site public.

### Parallel Opportunities

- T001, T002, T003 ; T006, T009, T010, T012 ; T013 et T015 ; T020 et T022.

## Parallel Example: Phase 2

```text
Task: "T006 tests/unit/player-counter-validation.test.ts"
Task: "T009 worker/src/player-counters.ts + GET /player-counters"
Task: "T010 src/services/player-counters-api.ts + cache"
Task: "T012 admin-worker/src/access.ts"
```

## Implementation Strategy

### MVP

Phases 1–3 : compteurs en base, bulles lues depuis la base, page d'administration pour changer un
chiffre, protégée. Puis US2 (preuves de refus), US3, US4, finitions.
