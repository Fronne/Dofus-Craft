---

description: "Task list for 029-channel-ownership (site side)"
---

# Tasks: Salons FM personnels créés par le bot (côté site)

**Input**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/fm-channels-api.md](contracts/fm-channels-api.md), [quickstart.md](quickstart.md)

**Tests**: inclus (constitution, principe II). Les parties Discord (bouton, permissions, `/fmarchive`,
archivage automatique : US1, US2, FR-001 à FR-006) sont faites dans le bot par la pull request
préparée à part ; ici, seules les exigences du site (FR-007 côté réception, FR-008 à FR-013).

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [X] T001 Créer worker/migrations/0010_add_fm_channels.sql et reporter dans worker/schema.sql : table `fm_channels` (`channel_id TEXT PRIMARY KEY`, `channel_name TEXT NOT NULL`, `owner_discord_user_id TEXT REFERENCES fm_players (discord_user_id)`, `status TEXT NOT NULL CHECK (status IN ('active', 'archived', 'deleted'))`, `fm_item_id TEXT REFERENCES fm_items (id)`, `created_at TEXT NOT NULL`, `archived_at TEXT`), index `(owner_discord_user_id, status)` ; reconstruction de `fm_bot_commands` pour accepter `type = 'create-channel'`, avec `session_id` et `channel_id` facultatifs et les colonnes `requested_name`, `requester_discord_user_id`, `fm_item_id`, `result_channel_id` (création d'une nouvelle table, copie des lignes, suppression de l'ancienne, renommage, index recréés). Vérifier sur le schéma de `master` avec des lignes existantes.
- [X] T002 [P] Script `"worker:db:migrate-fm-channels"` dans package.json.

## Phase 2: Foundational

- [X] T003 [P] Types et client : `FmChannel` (+ `status`, `fmItem`), `FmChannelRequest`, `FmProfile.fmChannels` dans src/domain/forgemagie.ts ; `createFmChannel(name, fmItemId)`, `getFmChannelRequest(id)`, `attachFmChannel(channelId, fmItemId | null)` dans src/services/fm-api.ts (champs absents d'un Worker plus ancien → valeurs vides).

## Phase 3: Réception des salons (FR-007, FR-008) — [US1]

- [X] T004 [US1] Dans worker/src/fm/bot-events.ts : événements `channel-created` (auteur obligatoire, `commandId` facultatif : rattacher l'objet de la demande), `channel-archived`, `channel-deleted`, idempotents comme les autres.
- [X] T005 [P] [US1] Tests dans tests/unit/fm-channels.test.ts : création, archivage, suppression, renvoi sans effet, auteur manquant → `400`.

## Phase 4: Démarrer depuis le site dans ses salons, ou créer un salon (FR-009, FR-010) — [US3]

- [X] T006 [US3] Créer worker/src/fm/channels.ts : `GET /fm/channels` (salons actifs du joueur, `busy`, `fmItem`), `POST /fm/channels` (nom 1 à 30 caractères, limite de 5 avec les demandes en attente → `409 channel-limit`, objet du joueur ; `202 { requestId }`), `GET /fm/channel-requests/{id}` (`sessionId` : session ouverte du salon créé). Dans worker/src/fm/bot-commands.ts : demande `create-channel` (`name`, `player`, `item`) et `ack` avec `channelId`. Dans worker/src/fm/site-sessions.ts : `POST /fm/sessions` exige un salon actif du joueur (`403 not-your-channel`). Routes dans worker/src/fm/router.ts ; `listChannels` de specs/028 remplacé.
- [X] T007 [P] [US3] Tests dans tests/unit/fm-channels.test.ts : liste limitée aux salons actifs du joueur ; démarrage refusé dans le salon d'un autre, un salon archivé ou un ancien salon ; création mise en file, suivie jusqu'à `done` avec `channelId` et `sessionId` ; échec avec raison ; limite de 5 ; mettre à jour tests/unit/fm-site-sessions.test.ts (les salons de test deviennent des salons personnels).
- [X] T008 [US3] Dans src/features/forgemagie/StartSession.tsx : choix « Nouveau salon » (nom, 30 caractères) ou un de mes salons actifs ; pendant la création, « Création du salon dans Discord… » (suivi toutes les 3 s, 2 minutes au plus), puis ouverture de la session ; messages pour `channel-limit` et l'échec du bot.

## Phase 5: Rattacher un salon à un objet (FR-011 à FR-013) — [US4]

- [X] T009 [US4] Objet effectif `COALESCE(s.fm_item_id, ch.fm_item_id)` dans worker/src/fm/reads.ts (`fmItem` des sessions, `ownedItems`, `canAttach` / `canDetach` : rattachement manuel seulement) et worker/src/fm/items.ts (récap) ; `PUT /fm/channels/{id}/item` dans worker/src/fm/channels.ts ; `fmChannels` dans le profil ; `deleteMe` (worker/src/fm/me.ts) retire propriétaire et objet de ses salons.
- [X] T010 [P] [US4] Tests dans tests/unit/fm-channels.test.ts : rattacher un salon compte ses sessions passées et futures dans le récap et les totaux ; une session rattachée à la main garde son objet ; détacher le salon ; salon d'un autre → `403` ; profil privé masque ses salons ; suppression du profil.
- [X] T011 [US4] Créer src/features/forgemagie/FmChannelsSection.tsx (liste des salons du profil, état, objet rattaché ; sur son profil, choix de l'objet) ; l'afficher dans src/features/forgemagie/ProfileTab.tsx ; dans src/features/forgemagie/SessionDetail.tsx, indiquer « (via le salon) » quand l'objet vient du salon.

## Phase 6: Polish

- [X] T012 [P] Tests d'intégration dans tests/integration/forgemagie-page.test.tsx (création d'un salon depuis le site, choix d'un de mes salons, rattachement d'un salon) et adaptation des tests existants.
- [X] T013 [P] Styles (src/styles/global.css), README.md, worker/README.md, amendements en fin de specs/027 et specs/028, contrat du bot complété.
- [X] T014 Vérifications : typecheck, lint, `npm test`, e2e Forgemagie, puis scénario curl de [quickstart.md](quickstart.md) sur un Worker local.
