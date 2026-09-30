---

description: "Task list for 027-fm-item-recap"
---

# Tasks: Récap de forgemagie par objet

**Input**: Design documents from `specs/027-fm-item-recap/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/fm-items-api.md](contracts/fm-items-api.md), [quickstart.md](quickstart.md)

**Tests**: inclus. La constitution (principe II) impose des tests pour les calculs (total d'un objet =
somme des sessions) et les règles d'accès (participant, propriétaire, profil privé). Les tests du
Worker utilisent `tests/support/fm-worker.ts` (base SQLite en mémoire chargée depuis
`worker/schema.sql`).

**Organization**: une phase par user story de la spec (US1 à US3), après un socle commun.

## Format: `[ID] [P?] [Story] Description`

- **[P]** : parallélisable (fichiers différents, pas de dépendance sur une tâche non terminée)
- **[Story]** : user story de la spec (US1, US2, US3)

## Path Conventions

Site dans `src/`, Worker dans `worker/src/fm/`, tests dans `tests/unit/`, `tests/integration/`,
`tests/e2e/`.

---

## Phase 1: Setup

- [ ] T001 Créer worker/migrations/0008_add_fm_items.sql (en-tête comme 0007, renvoyant à specs/027) et reporter les mêmes ajouts dans worker/schema.sql, selon [data-model.md](data-model.md) : table `fm_items` (`id TEXT PRIMARY KEY`, `owner_discord_user_id TEXT NOT NULL REFERENCES fm_players (discord_user_id)`, `item_id TEXT NOT NULL`, `item_name TEXT NOT NULL`, `item_image_url TEXT`, `label TEXT`, `created_at TEXT NOT NULL`), index `fm_items(owner_discord_user_id)` ; `ALTER TABLE fm_sessions ADD COLUMN fm_item_id TEXT REFERENCES fm_items (id)` (dans schema.sql, la colonne est dans le `CREATE TABLE fm_sessions`), index `fm_sessions(fm_item_id)`. Vérifier que la migration s'applique sur le schéma de `master` (comme pour 0007).
- [ ] T002 [P] Ajouter le script `"worker:db:migrate-fm-items"` dans package.json, sur le modèle de `worker:db:migrate-forgemagie`, pour `worker/migrations/0008_add_fm_items.sql`.

---

## Phase 2: Foundational

**Purpose** : types partagés et client du site.

- [ ] T003 [P] Dans src/domain/forgemagie.ts, ajouter les types de [data-model.md](data-model.md) : `FmOwnedItem`, `FmItemRecap`, `FmSessionItem` (`{ id: string; name: string; owner: FmPlayer } | { private: true }`), le champ `fmItem: FmSessionItem | null` de `FmSession`, `canAttach` et `canDetach` (booléens) de `FmSessionDetail`, le champ `fmItems: FmOwnedItem[]` de `FmProfile` ; et `fmItemDisplayName(item: { label: string | null; itemName: string }) = label ?? itemName`.
- [ ] T004 Dans src/services/fm-api.ts, ajouter les fonctions de [contracts/fm-items-api.md](contracts/fm-items-api.md) avec validation des réponses comme les autres : `createFmItem({ itemId, itemName, imageUrl, label })`, `renameFmItem(id, label)`, `deleteFmItem(id)`, `getFmItem(id)` (récap), `attachFmSession(sessionId, fmItemId)`, `detachFmSession(sessionId)` ; les codes d'erreur `not-participant`, `already-attached` remontent en `{ status: 'error', code }` (403 et 409 inclus). Les validateurs de session acceptent `fmItem` absent (Worker plus ancien) comme `null`.
- [ ] T005 [P] Tests dans tests/unit/fm-api.test.ts : `attachFmSession` renvoie `{ status: 'error', code: 'already-attached' }` sur un 409 et `code: 'not-participant'` sur un 403 ; une session sans `fmItem` est acceptée.

---

## Phase 3: User Story 1 - Déclarer un objet en FM et y rattacher des sessions (Priority: P1) 🎯 MVP

**Goal** : créer, renommer et supprimer ses objets en FM ; rattacher et détacher une session où l'on a
dépensé.

**Independent Test** : créer « Anneau Rtograf », rattacher une session terminée où l'on a posté une
capture : le détail indique « Objet : Anneau Rtograf (Cyril) » ; la détacher : la mention disparaît.

### Tests for User Story 1

- [ ] T006 [P] [US1] Tests Worker dans tests/unit/fm-items.test.ts (avec `createFmWorker`) : `POST /fm/items` crée l'objet du joueur connecté (`201`) ; refuse (`400`) un `itemId` non numérique, un `itemName` vide ou de plus de 80 caractères, une `imageUrl` hors `https://api.dofusdb.fr/`, un `label` vide après `trim` ou de plus de 40 caractères ; `PATCH` et `DELETE /fm/items/{id}` par un autre joueur → `404` ; `DELETE` détache ses sessions (`fm_item_id` NULL) sans les supprimer. `PUT /fm/sessions/{id}/item` : rattache une session où le joueur a une capture (`200`, `fmItem` renseigné, `canDetach` vrai) ; `403 not-participant` sans capture du joueur (y compris une session sans aucun achat) ; `404` pour l'objet d'un autre joueur ou une session inconnue ; `409 already-attached` sur une session déjà rattachée ; deux rattachements successifs par deux participants : le premier l'emporte. `DELETE /fm/sessions/{id}/item` : par le propriétaire → `200` et `fmItem: null` ; par un autre → `403`. `GET /fm/sessions` : chaque session porte `fmItem` (`null`, ou `{ id, name, owner }` avec `name` = label ou nom de l'équipement).

### Implementation for User Story 1

- [ ] T007 [US1] Créer worker/src/fm/items.ts : `createItem`, `renameItem`, `deleteItem` (dans un `batch` : `UPDATE fm_sessions SET fm_item_id = NULL WHERE fm_item_id = ?` puis `DELETE FROM fm_items WHERE id = ? AND owner_discord_user_id = ?`), `attachSession` (vérifie session, objet du joueur, capture du joueur dans la session, puis `UPDATE fm_sessions SET fm_item_id = ? WHERE id = ? AND fm_item_id IS NULL` ; aucune ligne modifiée → `409 already-attached`) et `detachSession` (seulement si l'objet rattaché appartient au joueur), selon [contracts/fm-items-api.md](contracts/fm-items-api.md) et les règles de validation de research R3. Brancher les routes dans worker/src/fm/router.ts (`/fm/items`, `/fm/items/{id}`, `/fm/sessions/{id}/item`).
- [ ] T008 [US1] Dans worker/src/fm/reads.ts, ajouter `fmItem` à chaque session de `sessionsPage` et `sessionDetail` (jointure `fm_sessions.fm_item_id` → `fm_items` → `fm_players` du propriétaire ; `{ private: true }` quand le propriétaire est privé et n'est pas le lecteur), et `canAttach` / `canDetach` au détail (research R2, data-model « Règles »). `attachSession` et `detachSession` renvoient ce même détail.
- [ ] T009 [P] [US1] Créer src/features/forgemagie/EquipmentPicker.tsx : champ de recherche (au moins 2 caractères, délai de 300 ms) qui appelle `searchItems(query)` de src/data/catalogue-repository.ts, ne garde que `kind === 'Equipment'`, affiche jusqu'à 10 résultats (icône, nom, niveau) et renvoie l'équipement choisi ; états « recherche… », « aucun équipement » et catalogue indisponible.
- [ ] T010 [US1] Créer src/features/forgemagie/FmItemsSection.tsx : liste des objets en FM d'un profil (`FmProfile.fmItems` : icône, nom affiché, nom de l'équipement si un label existe, total, nombre de sessions) ; sur son propre profil, bouton « Ajouter un objet » (EquipmentPicker + nom libre facultatif, 40 caractères max), « Renommer » et « Supprimer » (boîte de confirmation `<dialog>` comme la suppression du profil, qui dit que les sessions resteront, non rattachées) ; chaque objet ouvre son récap via une prop `onOpenItem(id)`. L'afficher dans src/features/forgemagie/ProfileTab.tsx, après les réglages et l'import, et relire le profil après chaque changement.
- [ ] T011 [US1] Dans src/features/forgemagie/SessionDetail.tsx, sous les dates : « Objet : {nom} ({propriétaire}) » ou « Rattachée à l'objet d'un joueur privé » ; si `canAttach`, une liste de ses objets en FM (lus avec `getFmPlayer(me)`) et un bouton « Rattacher », ou, s'il n'en a aucun, un lien « Créer un objet en FM » vers l'onglet Profil ; si `canDetach`, un bouton « Détacher ». Messages pour `already-attached` (« Cette session vient d'être rattachée à un autre objet. ») et `not-participant`. Passer `me` et une prop `onGoToProfile` depuis src/features/forgemagie/ForgemagiePage.tsx.
- [ ] T012 [P] [US1] Dans src/features/forgemagie/SessionsTab.tsx, afficher sur chaque carte le nom de l'objet rattaché (ou « objet d'un joueur privé »).

**Checkpoint** : US1 fonctionne : objets et rattachements.

---

## Phase 4: User Story 2 - Voir le récap de coût d'un objet (Priority: P1)

**Goal** : pour un objet, le total, les sessions rattachées et le détail par rune.

**Independent Test** : deux sessions rattachées de 100 000 et 50 000 kamas → récap à 150 000 kamas, les
deux sessions, et chaque rune avec la somme des deux sessions.

### Tests for User Story 2

- [ ] T013 [P] [US2] Tests Worker dans tests/unit/fm-items.test.ts : `GET /fm/items/{id}` renvoie `totalKamas` = somme des totaux des sessions rattachées tels que renvoyés par `GET /fm/sessions/{id}` (SC-002) ; `sessions` de la plus récente à la plus ancienne avec leur total ; `items` groupés par nom sur toutes les sessions (Rune Do Air 20 / 31 736 + 10 / 16 000 → 30 / 47 736 / 1 591) ; aucune part par joueur dans la réponse ; objet sans session → total 0, listes vides ; un achat ajouté par le bot dans une session rattachée apparaît à la lecture suivante ; après un `session-reset`, la session compte 0.

### Implementation for User Story 2

- [ ] T014 [US2] Dans worker/src/fm/items.ts, `readItemRecap(db, viewerId, id)` : l'objet (avec `owner` au format `playerView`, `totalKamas`, `sessionCount`), `sessions` (id, salon, état, date d'ouverture, total calculé comme `withPlayers`), `items` (même requête que `ITEMS_SELECT`, filtrée sur `c.session_id IN (sessions de l'objet)`, groupée par nom, triée par total) ; `404` si l'objet n'existe pas ou si son propriétaire est privé et n'est pas le lecteur. Route `GET /fm/items/{id}` dans worker/src/fm/router.ts. Réutiliser `ITEMS_SELECT`, `itemSummaries` et `playerView` (les exporter de worker/src/fm/reads.ts).
- [ ] T015 [US2] Créer src/features/forgemagie/FmItemRecap.tsx : bouton de retour, icône et nom de l'objet (et de l'équipement si label), propriétaire, « Total dépensé », liste des sessions (salon, date, état, montant ; chacune ouvre son détail), puis `ItemSummaryTable` (déjà dans SessionDetail.tsx, avec la mention de l'arrondi) ; objet sans session : « 0 kamas » et une invitation à rattacher une session depuis son détail. Dans src/features/forgemagie/ForgemagiePage.tsx, un état `openItemId` affiche ce récap (depuis le Profil) et un clic sur une session du récap ouvre son détail dans l'onglet Sessions.

**Checkpoint** : US1 et US2 : le récap par objet fonctionne.

---

## Phase 5: User Story 3 - Consulter les objets en FM d'un membre (Priority: P2)

**Goal** : les objets en FM d'un profil public sont visibles par les autres membres ; ceux d'un profil
privé ne le sont pas.

**Independent Test** : sur le profil public de Bob, voir ses objets et leur total ; Bob privé → ses
objets ne sont plus visibles, et ses sessions rattachées affichent « objet d'un joueur privé ».

### Tests for User Story 3

- [ ] T016 [P] [US3] Tests Worker : dans tests/unit/fm-reads.test.ts, `GET /fm/players/{id}` renvoie `fmItems` (du plus récent au plus ancien, avec `totalKamas` et `sessionCount`) ; dans tests/unit/fm-items.test.ts, pour un propriétaire privé vu par un autre membre : `GET /fm/items/{id}` → `404`, `fmItem` d'une session = `{ private: true }` sans id ni nom (SC-003), et le propriétaire voit tout normalement ; dans tests/unit/fm-me.test.ts, `DELETE /fm/me` supprime les objets du joueur et laisse leurs sessions, non rattachées (FR-015).

### Implementation for User Story 3

- [ ] T017 [US3] Dans worker/src/fm/reads.ts, ajouter `fmItems` à `playerProfile` (mêmes totaux que le récap, sans `sessions` ni `items`). Dans worker/src/fm/me.ts, `deleteMe` ajoute au `batch`, avant la suppression du joueur : `UPDATE fm_sessions SET fm_item_id = NULL WHERE fm_item_id IN (SELECT id FROM fm_items WHERE owner_discord_user_id = ?)` puis `DELETE FROM fm_items WHERE owner_discord_user_id = ?`.
- [ ] T018 [US3] Dans src/features/forgemagie/FmItemsSection.tsx, sur le profil d'un autre membre : liste en lecture seule (pas d'ajout, de renommage ni de suppression), récap consultable ; dans src/features/forgemagie/FmItemRecap.tsx, aucun bouton de modification quand le lecteur n'est pas le propriétaire.

**Checkpoint** : toutes les stories fonctionnent.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T019 [P] Tests d'intégration dans tests/integration/forgemagie-page.test.tsx (API simulée) : ajout d'un objet via la recherche d'équipement (`searchItems` simulé) ; rattachement depuis le détail d'une session (bouton « Rattacher » visible si `canAttach`, « Détacher » si `canDetach`, message sur `already-attached`) ; récap affichant total, sessions et runes ; suppression d'un objet seulement après confirmation ; profil d'un autre membre en lecture seule.
- [ ] T020 [P] Test e2e dans tests/e2e/forgemagie.spec.ts : ouvrir le récap d'un objet depuis le Profil (routes simulées) et vérifier le total et la ligne d'une rune ; largeur téléphone sans défilement horizontal.
- [ ] T021 [P] Styles de la section « Objets en FM », du sélecteur d'équipement et du récap dans src/styles/global.css (classes `fm-*` existantes réutilisées ; icône de l'équipement de 32 px).
- [ ] T022 [P] Mettre à jour README.md (récap de forgemagie par objet) et worker/README.md (routes `/fm/items`, migration 0008) ; ajouter en fin de specs/025-rune-purchase-import/spec.md la note d'amendement du plan (champs `fmItem`, `canAttach`, `canDetach`, `fmItems` ; FR-007 supprime aussi les objets en FM).
- [ ] T023 Lancer `npm run typecheck`, `npx tsc -p worker --noEmit`, `npm run lint`, `npm test` et `npx playwright test forgemagie --project=desktop`, puis dérouler [quickstart.md](quickstart.md) (Worker local sur une base temporaire pour les routes ; serveur de développement laissé en marche).

---

## Dependencies & Execution Order

- **Setup (T001, T002)** avant tout test Worker.
- **Foundational (T003–T005)** avant les tâches du site.
- **US1** : T006 → T007 → T008 (Worker) ; T009 à T012 (site) après T004 et T008.
- **US2** : dépend d'US1 (des sessions rattachées) ; T013 → T014 → T015.
- **US3** : dépend d'US1 et US2 (liste et récap) ; T016 → T017 → T018.
- **Polish** : après les stories.

## Parallel Example: User Story 1

```bash
# Worker et composant sans dépendance mutuelle :
Task: "Tests des objets et du rattachement dans tests/unit/fm-items.test.ts"
Task: "Sélecteur d'équipement dans src/features/forgemagie/EquipmentPicker.tsx"
Task: "Nom de l'objet sur les cartes dans src/features/forgemagie/SessionsTab.tsx"
```

## Implementation Strategy

1. Setup + Foundational.
2. US1 puis US2 : ensemble, ils répondent à la demande (objets, rattachement, récap) — MVP.
3. US3 : visibilité pour les autres membres et suppression du profil.
4. Finitions ; mise en ligne = migration `0008` **avant** le déploiement du Worker, puis le site.
