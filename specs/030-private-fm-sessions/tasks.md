# Tasks: Forgemagie privée — chacun ne voit que ses séances

**Input**: Design documents from `/specs/030-private-fm-sessions/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/fm-private-reads.md, quickstart.md

**Tests**: inclus — la constitution (principe II) exige des tests automatiques pour chaque règle, et
les tests existants qui décrivent l'ancienne visibilité publique doivent être réécrits.

**Organization**: une phase par user story ; aucune migration, aucune tâche de mise en place.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: peut être fait en parallèle (fichiers différents, pas de dépendance sur une tâche en cours)
- **[Story]**: user story de spec.md (US1, US2, US3)

---

## Phase 1: Setup

Aucune tâche : pas de dépendance, pas de configuration, pas de migration (data-model.md).

---

## Phase 2: Foundational (Blocking Prerequisites)

- [ ] T001 Ajouter aux helpers de test un second joueur (« B ») avec sa séance, son objet en FM et son salon, et une séance sans propriétaire, réutilisables par US1 et US2, dans tests/support/fm-worker.ts (réutiliser les fonctions d'insertion existantes du fichier ; ne rien changer au comportement des tests existants)

**Checkpoint**: les tests existants passent toujours (`npx vitest run tests/unit`).

---

## Phase 3: User Story 1 - Ne voir que ses propres séances (Priority: P1) 🎯 MVP

**Goal**: la liste et le détail des séances ne montrent que les séances du joueur connecté ; tout le reste répond 404.

**Independent Test**: avec deux joueurs A et B ayant chacun une séance, chacun ne liste que la sienne, et le détail, l'arrêt, le renvoi, le rattachement et le détachement de la séance de l'autre répondent `404 {"error":"Not found"}`, comme un identifiant inventé.

### Tests for User Story 1

- [ ] T002 [P] [US1] Dans tests/unit/fm-reads.test.ts : `GET /fm/sessions` ne renvoie que les séances dont `owner = viewer` (pagination inchangée) ; `GET /fm/sessions/{id}` d'une séance de B ou sans propriétaire → 404 avec le même corps qu'un identifiant inventé ; séance de A → même détail et mêmes montants qu'avant (FR-001, FR-002, FR-003, FR-012) ; `canAttach` vrai seulement pour le propriétaire d'une séance non rattachée (ni directement, ni par son salon). Réécrire les tests existants du bloc `private players` qui supposent qu'un membre voit les séances des autres (le masquage « Joueur privé » d'un joueur qui a posté dans la séance de A reste testé : specs/025 FR-015)
- [ ] T003 [P] [US1] Dans tests/unit/fm-site-sessions.test.ts : `POST /fm/sessions/{id}/stop` et `/resend` sur la séance de B → 404 (était 403) ; `POST /fm/sessions` dans le salon d'un autre reste `403 not-your-channel`
- [ ] T004 [P] [US1] Dans tests/unit/fm-items.test.ts : `PUT /fm/sessions/{id}/item` sur la séance de B → 404 (le `403 not-participant` disparaît), sur sa propre séance sans capture → 200 ; `DELETE /fm/sessions/{id}/item` sur la séance de B, ou quand l'objet n'est pas au viewer → 404 (était 403) ; `409 already-attached` inchangé

### Implementation for User Story 1

- [ ] T005 [US1] Dans worker/src/fm/reads.ts : filtrer `sessionsPage` (cas général) par `owner_discord_user_id = ?` ; dans `sessionDetail`, renvoyer `undefined` si `owner_discord_user_id` est NULL ou différent du viewer ; `canAttach` = viewer propriétaire et séance ni rattachée ni dans un salon rattaché (supprimer la requête « a posté une capture »)
- [ ] T006 [P] [US1] Dans worker/src/fm/site-sessions.ts : pour l'arrêt et le renvoi, répondre `notFound()` au lieu de `403 Forbidden` quand la séance n'est pas au viewer (garder `403 not-your-channel` au démarrage)
- [ ] T007 [P] [US1] Dans worker/src/fm/items.ts : `attachSession` exige `fm_sessions.owner_discord_user_id = viewer` (sinon 404) à la place de la vérification `not-participant` ; `detachSession` exige que la séance et l'objet soient au viewer, sinon 404
- [ ] T008 [P] [US1] Dans src/features/forgemagie/SessionsTab.tsx : textes de l'onglet (titre / état vide) formulés pour « tes séances », sans suggérer qu'on voit celles du groupe

**Checkpoint**: T002–T004 passent ; US1 est livrable seule.

---

## Phase 4: User Story 2 - Un profil que personne d'autre ne voit (Priority: P1)

**Goal**: seul son propre profil, ses objets en FM et ses salons sont accessibles ; la liste des autres joueurs disparaît.

**Independent Test**: A ne voit aucun sélecteur de joueur ; `GET /fm/players/{B}` (B public), `GET /fm/items/{objet de B}` et `PUT /fm/channels/{salon de B}/item` répondent 404 ; `GET /fm/players` ne renvoie que A.

### Tests for User Story 2

- [ ] T009 [P] [US2] Dans tests/unit/fm-reads.test.ts : `GET /fm/players` → `{"players":[<viewer>]}` ; `GET /fm/players/{B}` → 404 que B soit public ou privé (FR-005, FR-006) ; son propre profil a `sessions[].canOpen` vrai pour ses séances et faux pour une séance de B où il a posté une capture, et des totaux inchangés (research R5). Réécrire les tests existants « left out of the players list » et « become visible again … as soon as they go public »
- [ ] T010 [P] [US2] Dans tests/unit/fm-items.test.ts : `GET /fm/items/{id}` d'un objet de B → 404 même si B est public (FR-007)
- [ ] T011 [P] [US2] Dans tests/unit/fm-channels.test.ts : `PUT /fm/channels/{id}/item` sur le salon de B → 404 (était 403) (FR-008)
- [ ] T012 [P] [US2] Dans tests/integration/forgemagie-page.test.tsx : l'onglet Profil n'affiche plus le sélecteur « Voir le profil de » et n'appelle plus `getFmPlayers` ; une séance du profil n'est cliquable que si `canOpen` ; « Profil introuvable » et « Objet introuvable » sans mention du profil privé. Réécrire le test existant qui choisit le profil de « Bob »

### Implementation for User Story 2

- [ ] T013 [US2] Dans worker/src/fm/reads.ts : `listPlayers` ne renvoie que la ligne du viewer ; `playerProfile` renvoie `undefined` dès que `discordUserId ≠ viewerId` ; ajouter `canOpen: owner_discord_user_id = viewer` à chaque séance du profil (sélectionner `s.owner_discord_user_id` dans la requête des séances)
- [ ] T014 [P] [US2] Dans worker/src/fm/items.ts : `readItemRecap` ne cherche que `i.id = ? AND i.owner_discord_user_id = ?` (retirer `p.is_private = 0 OR …`)
- [ ] T015 [P] [US2] Dans worker/src/fm/channels.ts : `attachChannelItem` répond `notFound()` au lieu de `403 Forbidden` pour le salon d'un autre
- [ ] T016 [P] [US2] Dans src/domain/forgemagie.ts : ajouter `canOpen: boolean` au type d'une séance du profil
- [ ] T017 [US2] Dans src/features/forgemagie/ProfileTab.tsx : supprimer l'état `players`, l'appel à `getFmPlayers`, `shownId` et le sélecteur « Voir le profil de » (le profil affiché est toujours `me.discordUserId`, `isMine` toujours vrai) ; dans `Spending`, ne rendre cliquable une séance que si `canOpen` ; « Profil introuvable » sans la phrase sur le profil privé
- [ ] T018 [P] [US2] Dans src/features/forgemagie/FmItemRecap.tsx : texte « Objet introuvable » → description « Il a peut-être été supprimé. » (plus de mention du profil privé)
- [ ] T019 [P] [US2] Dans src/services/fm-api.ts : retirer `getFmPlayers` s'il n'est plus utilisé nulle part (vérifier avec une recherche), sinon le laisser

**Checkpoint**: T009–T012 passent ; US1 et US2 fonctionnent ensemble.

---

## Phase 5: User Story 3 - Garder le réglage public / privé pour plus tard (Priority: P3)

**Goal**: le réglage reste enregistré, et son texte n'annonce aucun effet qui n'existe pas.

**Independent Test**: passer en privé, recharger : le réglage est conservé ; le texte est « Pour l'instant, personne d'autre ne voit tes séances ni ton profil. Ce réglage servira quand un affichage public sera ajouté. » quel que soit le choix.

- [ ] T020 [P] [US3] Dans tests/integration/forgemagie-page.test.tsx : le texte du réglage Visibilité est le même en public et en privé (texte exact de research R8) ; le clic sur « Privé » appelle toujours la mise à jour du profil (FR-009, FR-010)
- [ ] T021 [US3] Dans src/features/forgemagie/ProfileTab.tsx (`ProfileSettings`) : remplacer les deux textes de visibilité par « Pour l'instant, personne d'autre ne voit tes séances ni ton profil. Ce réglage servira quand un affichage public sera ajouté. »

**Checkpoint**: toutes les user stories sont fonctionnelles.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T022 [P] Mettre à jour les réponses simulées de tests/e2e/forgemagie.spec.ts (`/fm/players` réduit au joueur, `canOpen` sur les séances du profil) et vérifier que les tests Forgemagie passent : `npx playwright test tests/e2e/forgemagie.spec.ts --project=chromium`
- [ ] T023 [P] Ajouter une note « Amendé par specs/030-private-fm-sessions » à côté de FR-006, FR-014 et de la user story des profils dans specs/025-rune-purchase-import/spec.md, de FR-005 dans specs/027-fm-item-recap/spec.md, et de FR-013 dans specs/029-channel-ownership/spec.md
- [ ] T024 Lancer les vérifications du quickstart : `npx vitest run`, `npx tsc -b --noEmit`, `npx tsc -p worker --noEmit`, `npx eslint src tests`, et parcourir le tableau de specs/030-private-fm-sessions/quickstart.md

---

## Dependencies & Execution Order

- **Phase 2 (T001)** bloque les tests de US1 et US2.
- **US1 (Phase 3)** et **US2 (Phase 4)** sont indépendantes, sauf les fichiers partagés : `worker/src/fm/reads.ts` (T005 puis T013), `worker/src/fm/items.ts` (T007 puis T014), `tests/unit/fm-reads.test.ts` (T002 puis T009), `tests/unit/fm-items.test.ts` (T004 puis T010) — à faire dans cet ordre.
- **US3 (Phase 5)** touche `ProfileTab.tsx` après T017 et `forgemagie-page.test.tsx` après T012.
- **Polish** après toutes les stories.
- Dans chaque story : tests d'abord (ils échouent), puis implémentation.

## Parallel Example: User Story 1

```text
T002 tests/unit/fm-reads.test.ts   |  T003 tests/unit/fm-site-sessions.test.ts  |  T004 tests/unit/fm-items.test.ts
puis T005 reads.ts  |  T006 site-sessions.ts  |  T007 items.ts  |  T008 SessionsTab.tsx
```

## Parallel Example: User Story 2

```text
T010 fm-items.test.ts  |  T011 fm-channels.test.ts  |  T012 forgemagie-page.test.tsx   (T009 après T002)
puis T014 items.ts  |  T015 channels.ts  |  T016 forgemagie.ts  |  T018 FmItemRecap.tsx   (T013 après T005, T017 après T016)
```

## Implementation Strategy

- **MVP** : Phase 2 + US1 — les séances des autres ne sont plus visibles.
- Livrer **US1 et US2 ensemble** : les deux sont P1, et masquer les séances sans masquer les profils
  laisserait voir les dépenses par le profil (spec, US2 « Why this priority »).
- US3 ne change que des textes ; elle peut suivre dans le même déploiement.
- Aucune migration : le déploiement se limite au Worker de l'API et au site (API d'abord, pour que la
  page ne montre jamais de données que l'API ne filtre pas encore).
