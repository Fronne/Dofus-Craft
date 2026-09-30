---

description: "Task list for 028-site-started-sessions"
---

# Tasks: Démarrer une session FM depuis le site, synchronisée avec Discord

**Input**: Design documents from `specs/028-site-started-sessions/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/fm-site-sessions-api.md](contracts/fm-site-sessions-api.md), [contracts/fm-bot-commands.md](contracts/fm-bot-commands.md), [quickstart.md](quickstart.md)

**Tests**: inclus (constitution, principe II) : les transitions de la file et des sessions sont des
règles à tester. Tests Worker avec `tests/support/fm-worker.ts`.

**Organization**: socle, puis US1 (démarrer), US4 (`/fmstart` inchangé, propriétaire), US2 (arrêter),
US3 (captures du site), finitions.

## Format: `[ID] [P?] [Story] Description`

## Path Conventions

Site dans `src/`, Worker dans `worker/src/fm/`, tests dans `tests/`.

---

## Phase 1: Setup

- [X] T001 Créer worker/migrations/0009_add_site_sessions.sql (en-tête renvoyant à specs/028) et reporter dans worker/schema.sql, selon [data-model.md](data-model.md) : colonnes de `fm_sessions` `owner_discord_user_id TEXT REFERENCES fm_players (discord_user_id)`, `origin TEXT NOT NULL DEFAULT 'discord' CHECK (origin IN ('discord', 'site'))`, `sync_status TEXT CHECK (sync_status IN ('pending', 'opened', 'failed', 'cancelled'))`, `sync_error TEXT` ; table `fm_bot_commands` (`id TEXT PRIMARY KEY`, `type TEXT NOT NULL CHECK (type IN ('open', 'close'))`, `session_id TEXT NOT NULL REFERENCES fm_sessions (id)`, `channel_id TEXT NOT NULL`, `status TEXT NOT NULL CHECK (status IN ('pending', 'done', 'failed', 'cancelled'))`, `error TEXT`, `created_at TEXT NOT NULL`, `acknowledged_at TEXT`) avec les index `(status, created_at)` et `(channel_id, status)`. Vérifier qu'elle s'applique sur le schéma de `master`.
- [X] T002 [P] Script `"worker:db:migrate-site-sessions"` dans package.json pour `worker/migrations/0009_add_site_sessions.sql`.

---

## Phase 2: Foundational

- [X] T003 Dans worker/src/fm/reads.ts, ajouter aux sessions (`withPlayers`, `sessionsPage`, `sessionDetail`) : `owner` (`playerView` du propriétaire, ou `null`), `origin`, `sync` (`null` pour `origin = 'discord'` ; sinon `{ status, error }`, avec `status = 'stale'` quand `sync_status = 'pending'` et que la dernière commande `open` en attente a plus de 10 minutes) et `canStop` (ouverte et propriétaire = lecteur). `sessionsPage` accepte un filtre `mine=open` (sessions ouvertes du lecteur, sans pagination). Dans worker/src/fm/router.ts, passer `url.searchParams.get('mine')`.
- [X] T004 [P] Dans src/domain/forgemagie.ts : `FmSession` gagne `owner: FmPlayer | null`, `origin: 'discord' | 'site'`, `sync: null | { status: 'pending' | 'opened' | 'failed' | 'cancelled' | 'stale'; error: string | null }`, `canStop: boolean` ; type `FmChannel = { channelId: string; channelName: string; busy: boolean }`. Dans src/services/fm-api.ts : ces champs sont facultatifs dans les réponses (Worker plus ancien → `owner: null`, `origin: 'discord'`, `sync: null`, `canStop: false`) ; fonctions `getFmChannels()`, `startFmSession(channelId, fmItemId | null)`, `stopFmSession(id)`, `resendFmSession(id)`, `getFmSessions(before, { mine: 'open' })`, et `importFmCapture(lines, sharePrices, sessionId?)`.
- [X] T005 [P] Tests dans tests/unit/fm-api.test.ts : une session sans les nouveaux champs reçoit les valeurs par défaut ; `startFmSession` renvoie `{ status: 'error', code: 'channel-busy' }` sur un 409.

---

## Phase 3: User Story 1 - Démarrer une session depuis le site (Priority: P1) 🎯 MVP

**Independent Test** : démarrer sur le site (salon `fm-anneau`, objet « Rtograf PA ») → session ouverte, rattachée, « en attente de Discord » ; `GET /fm/bot/commands` la donne ; `ack done` → « ouverte dans Discord » ; une `capture` pour ce salon s'y ajoute.

### Tests for User Story 1

- [X] T006 [P] [US1] Tests Worker dans tests/unit/fm-site-sessions.test.ts : `GET /fm/channels` liste les salons connus (dernier nom), `busy` si une session y est ouverte ; `POST /fm/sessions` crée une session `open`, `origin = 'site'`, `sync.status = 'pending'`, propriétaire = joueur connecté, rattachée à l'objet donné, et une commande `open` `pending` ; salon inconnu ou objet d'un autre joueur → `404` ; salon occupé → `409 channel-busy` ; un joueur peut avoir deux sessions ouvertes dans deux salons. Dans tests/unit/fm-bot-commands.test.ts : `GET /fm/bot/commands` sans clé → `401` ; renvoie les commandes `pending` dans l'ordre de création avec `player`, `item` et `pollAfterSeconds: 10` ; une commande non confirmée est renvoyée à l'appel suivant ; `ack done` → commande `done`, `sync_status = 'opened'`, plus renvoyée ; `ack` répété → aucun effet ; `ack failed` avec `error` (200 caractères au plus) → `sync_status = 'failed'`, `sync_error` ; commande inconnue → `404` ; une `capture` du bot pour ce salon s'ajoute à la session du site ; `sync.status = 'stale'` après 10 minutes (date de commande modifiée en base) ; `POST /fm/sessions/{id}/resend` annule l'ancienne `open` et en crée une nouvelle.

### Implementation for User Story 1

- [X] T007 [US1] Créer worker/src/fm/site-sessions.ts : `listChannels`, `startSession` (vérifie salon connu, salon libre, objet du joueur ; insère la session et la commande `open` dans un `batch` ; un conflit sur l'index unique « une session ouverte par salon » → `409 channel-busy`), `resendSession` ; routes `GET /fm/channels`, `POST /fm/sessions`, `POST /fm/sessions/{id}/resend` dans worker/src/fm/router.ts.
- [X] T008 [US1] Créer worker/src/fm/bot-commands.ts : `GET /fm/bot/commands` et `POST /fm/bot/commands/{id}/ack` (clé du bot, même contrôle que bot-events.ts), selon [contracts/fm-bot-commands.md](contracts/fm-bot-commands.md) ; mise à jour de `sync_status` / `sync_error` de la session pour les commandes `open`. Routes dans worker/src/fm/router.ts, avant le contrôle de session du site.
- [X] T009 [US1] Créer src/features/forgemagie/StartSession.tsx : bouton « Démarrer une session » dans l'onglet Sessions ; formulaire avec le salon (`getFmChannels`, salons occupés désactivés avec « session en cours ») et l'objet en FM facultatif (ses objets, lus avec `getFmPlayer(me)`) ; message si aucun salon connu (« Lance d'abord /fmstart une fois dans le salon voulu. ») ou si le salon vient d'être pris (`channel-busy`) ; à la réussite, ouvrir le détail de la nouvelle session. L'afficher en tête de src/features/forgemagie/SessionsTab.tsx (qui reçoit `me`).
- [X] T010 [US1] Afficher l'état de synchronisation : sur les cartes de src/features/forgemagie/SessionsTab.tsx et dans src/features/forgemagie/SessionDetail.tsx (« En attente de Discord… », « Ouverte dans Discord », « Non transmise à Discord » avec un bouton « Relancer » pour le propriétaire, « Échec dans Discord : {raison} » avec « Relancer ») ; le détail d'une session `pending` se relit toutes les 10 secondes tant qu'il est affiché.

**Checkpoint** : on démarre une session depuis le site ; le bot (simulé) l'ouvre.

---

## Phase 4: User Story 4 - `/fmstart` et `/fmstop` inchangés, propriétaire (Priority: P1)

- [X] T011 [P] [US4] Tests dans tests/unit/fm-bot-events.test.ts : `session-start` avec `author` → joueur créé, session à son nom (`owner`) ; sans `author` → `owner: null`, comme avant ; les tests existants restent verts.
- [X] T012 [US4] Dans worker/src/fm/bot-events.ts, lire `author` facultatif de `session-start` (même validation que pour `capture`), faire l'upsert du joueur et remplir `owner_discord_user_id`.

---

## Phase 5: User Story 2 - Arrêter une session depuis le site (Priority: P1)

**Independent Test** : arrêter sur le site → « Terminée » ; `close` en attente ; une `capture` avant l'`ack` → `ignored` ; `ack done` → plus renvoyée.

### Tests for User Story 2

- [X] T013 [P] [US2] Tests dans tests/unit/fm-site-sessions.test.ts : `POST /fm/sessions/{id}/stop` par le propriétaire → `closed`, commande `close` `pending` ; par un autre → `403` ; session fermée → `409 not-open` ; session démarrée par `/fmstart` avec `author` = joueur → arrêtable ; stop alors que l'`open` est encore `pending` → `open` `cancelled`, `sync_status = 'cancelled'`, aucune `close`. Dans tests/unit/fm-bot-events.test.ts : `capture` pour un salon sans session ouverte mais avec une `close` `pending` → réponse `{ status: "ignored", reason: "session-closed" }`, aucune capture enregistrée, aucune session créée ; sans `close` en attente → session ouverte comme avant (specs/025) ; `session-stop` → les `close` `pending` du salon passent `cancelled`.

### Implementation for User Story 2

- [X] T014 [US2] Dans worker/src/fm/site-sessions.ts, `stopSession` (règles de [data-model.md](data-model.md), dans un `batch`) et la route `POST /fm/sessions/{id}/stop`. Dans worker/src/fm/bot-events.ts : la capture ignorée après un arrêt (research R3) et l'annulation des `close` sur `session-stop` (R4).
- [X] T015 [US2] Dans src/features/forgemagie/SessionDetail.tsx, bouton « Arrêter la session » quand `canStop`, avec une confirmation courte (« La session sera aussi fermée dans Discord. ») ; après l'arrêt, afficher le détail renvoyé.

---

## Phase 6: User Story 3 - Captures du site dans la session en cours (Priority: P2)

- [X] T016 [P] [US3] Tests dans tests/unit/fm-imports.test.ts : `sessionId` d'une session ouverte du joueur → capture rattachée à la session (total de la session et récap de son objet mis à jour) ; session fermée → `409 session-not-open` ; session d'un autre joueur → `403` ; sans `sessionId` → hors session, comme avant.
- [X] T017 [US3] Dans worker/src/fm/imports.ts, accepter `sessionId` et renseigner `fm_captures.session_id`. Dans src/features/forgemagie/CaptureImport.tsx, lire les sessions ouvertes du joueur (`getFmSessions(null, { mine: 'open' })`) : aucune → comme aujourd'hui ; une → « Ajouter à la session #{salon} » cochée par défaut ; plusieurs → un choix de session (ou « Hors session ») visible avant « Valider ».

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T018 [P] Tests d'intégration dans tests/integration/forgemagie-page.test.tsx : démarrer une session (salon et objet envoyés, salon occupé désactivé) ; état « En attente de Discord » puis « Non transmise » avec « Relancer » ; arrêter avec confirmation ; import proposé dans la session ouverte.
- [X] T019 [P] Styles des nouveaux éléments dans src/styles/global.css (formulaire de démarrage, pastilles d'état de synchronisation).
- [X] T020 [P] Documentation : README.md (démarrer et arrêter une session depuis le site), worker/README.md (routes, migration 0009), note d'amendement en fin de specs/025-rune-purchase-import/spec.md (auteur de `session-start`, capture `ignored`, `sessionId` de l'import), et lien vers [contracts/fm-bot-commands.md](contracts/fm-bot-commands.md) depuis specs/025-rune-purchase-import/contracts/fm-bot-api.md.
- [X] T021 Lancer `npm run typecheck`, `npx tsc -p worker --noEmit`, `npm run lint`, `npm test`, `npx playwright test forgemagie --project=desktop`, puis le scénario curl de [quickstart.md](quickstart.md) sur un Worker local avec une base temporaire.

---

## Dependencies & Execution Order

- T001 avant tous les tests Worker ; T003–T005 avant les stories.
- US1 (T006–T010) puis US4 (T011–T012), US2 (T013–T015), US3 (T016–T017) ; US4 et US3 sont indépendantes d'US2.
- Finitions après les stories.

## Parallel Example

```bash
Task: "Types et client dans src/domain/forgemagie.ts et src/services/fm-api.ts"
Task: "Tests de la file du bot dans tests/unit/fm-bot-commands.test.ts"
```

## Implementation Strategy

1. Socle, US1 et US2 : démarrer et arrêter depuis le site (MVP, utile dès que le bot est à jour).
2. US4 : propriétaire des sessions `/fmstart` (dépend de la mise à jour du bot pour `author`).
3. US3 : captures du site dans la session.
4. Mise en ligne : sauvegarde, migration `0009`, Worker, site ; puis envoyer
   [contracts/fm-bot-commands.md](contracts/fm-bot-commands.md) à l'auteur du bot.
