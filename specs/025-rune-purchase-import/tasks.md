---

description: "Task list for 025-rune-purchase-import"
---

# Tasks: Page Forgemagie — profils Discord, sessions FM et prix des runes

**Input**: Design documents from `specs/025-rune-purchase-import/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/fm-bot-api.md](contracts/fm-bot-api.md), [contracts/fm-site-api.md](contracts/fm-site-api.md), [contracts/rune-items-data.md](contracts/rune-items-data.md), [quickstart.md](quickstart.md)

**Tests**: inclus. La constitution (principe II) impose des tests automatisés pour toute règle de
calcul : prix unitaire, totaux de session identiques au bot, statuts de prix, masquage des joueurs
privés. Les tests du Worker utilisent la base SQLite en mémoire de `tests/support/sqlite-d1.ts`, qui
charge `worker/schema.sql`.

**Organization**: une phase par user story de la spec (US1 à US5), après un socle commun.

## Format: `[ID] [P?] [Story] Description`

- **[P]** : parallélisable (fichiers différents, pas de dépendance sur une tâche non terminée)
- **[Story]** : user story de la spec (US1 à US5)

## Path Conventions

Site dans `src/`, Worker dans `worker/src/` (code FM dans `worker/src/fm/`), scripts de données dans
`scripts/`, tests dans `tests/unit/` et `tests/integration/` (Vitest) et `tests/e2e/`
(Playwright), à la racine du dépôt.

---

## Phase 1: Setup

**Purpose** : dépendance, configuration et scripts.

- [ ] T001 Ajouter la dépendance `tesseract.js` (dernière version majeure stable) dans package.json via `npm install tesseract.js`. Elle est **uniquement** importée dynamiquement (`await import('tesseract.js')`), jamais au chargement d'une page (research R9).
- [ ] T002 [P] Documenter dans worker/wrangler.toml, en commentaire comme `COMMUNITY_API_KEY`, les secrets `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_GUILD_ID` et `FM_BOT_API_KEY` (commande `wrangler secret put … --config worker/wrangler.toml`), et ajouter la variable publique `SITE_URL = "https://dofus-craft.dofus-craft.workers.dev"` dans `[vars]` ; ajouter `worker/.dev.vars` à .gitignore s'il n'y est pas.
- [ ] T003 [P] Ajouter le script `"worker:db:migrate-forgemagie"` dans package.json, sur le modèle de `worker:db:migrate-contribution-kind`, qui exécute `worker/migrations/0007_add_forgemagie.sql` sur la base distante.

---

## Phase 2: Foundational (bloquant pour toutes les stories)

**Purpose** : tables, données des runes, index des noms, origine des prix, règles pures, client
API et routage `/fm/*`.

### Base de données

- [ ] T004 Créer worker/migrations/0007_add_forgemagie.sql (commentaire d'en-tête comme 0005, renvoyant à specs/025) et reporter les mêmes ajouts dans worker/schema.sql, exactement selon [data-model.md](data-model.md) : tables `fm_players` (`is_private INTEGER NOT NULL DEFAULT 0`, `server_id` et `first_login_at` NULL autorisés), `fm_auth_sessions` (`token_hash` PK, jamais le jeton lui-même), `fm_oauth_states`, `fm_sessions` (`status` CHECK `IN ('open','closed')`, index unique partiel `ON fm_sessions(channel_id) WHERE status = 'open'`), `fm_captures` (`origin` CHECK `IN ('bot','capture')`, `spent_kamas INTEGER NOT NULL CHECK (spent_kamas >= 0)`, `session_id` NULL pour un import), `fm_purchase_lines` (`quantity` CHECK `> 0`, `total_kamas` CHECK `> 0`, `capture_id` avec `ON DELETE CASCADE`, `price_status` CHECK `IN ('recorded','unknown-item','ambiguous-item','no-server','outlier','personal-mode')`), `fm_processed_events` ; et `ALTER TABLE community_price_contributions ADD COLUMN origin TEXT NOT NULL DEFAULT 'manual' CHECK (origin IN ('manual','capture','bot'))` (dans schema.sql, la colonne est dans le `CREATE TABLE`). Index : `fm_captures(session_id)`, `fm_captures(discord_user_id)`, `fm_purchase_lines(capture_id)`, `fm_sessions(opened_at)`.

### Données des runes et index des noms

- [ ] T005 Créer scripts/build-rune-items.mjs sur le modèle de scripts/build-hdv-items.mjs (mêmes `get` / `getAll` avec 3 essais) : lire `GET /items?typeId=78` (champs `id`, `name`, `iconId`, `level`, `possibleEffects`), puis `GET /effects` pour les `effectId` trouvés (champ `characteristic`) et `GET /characteristics` (nom français) ; écrire src/data/rune-items.json au format de [contracts/rune-items-data.md](contracts/rune-items-data.md) (`characteristicId: null` et `statLabel: "Autre"` quand l'effet n'a pas de caractéristique ; tri par `statLabel` puis `level`). Écrire aussi worker/src/fm/priceable-items.json à partir de src/data/hdv-items.json et des runes : clé = nom normalisé (minuscules, espaces multiples réduits à un, `trim`, **accents conservés**), valeur = identifiant, ou `null` si plusieurs objets partagent ce nom. Afficher un résumé (nombre de runes, de stats, de noms ambigus). Ne jamais écrire de fichier partiel si DofusDB échoue.
- [ ] T006 Exécuter `node scripts/build-rune-items.mjs`, relire le résumé et commiter src/data/rune-items.json et worker/src/fm/priceable-items.json.
- [ ] T007 [P] Test des données dans tests/unit/rune-items-data.test.ts (sur le modèle de tests/unit/hdv-items-data.test.ts) : au moins 100 runes, identifiants uniques, `imageUrl` en https, `statLabel` non vide ; « Rune Fo » a `characteristicId` 10 ; chaque rune est présente dans priceable-items.json sous son nom normalisé.

### Règles pures du domaine

- [ ] T008 [P] Créer src/domain/forgemagie.ts : `normalizeItemName(name)` (même règle que T005) ; `PURCHASE_LINE_PATTERN`, copie exacte de l'expression `LINE_PATTERN` du bot (`(\d[\d\s]{0,6})\s*x\s*\[([^\]]{2,40})\]\s*\(?\s*(\d[\d\s]{2,12})\s*kamas\)?`, insensible à la casse) ; `parsePurchaseLines(text): PurchaseLine[]` (`{ itemName, quantity, totalKamas }`, espaces, espaces insécables et espaces fines retirés des nombres, lignes à quantité ou total nul ou illisible écartées, FR-022) ; `unitPriceKamas(line) = Math.round(totalKamas / quantity)` ; **chaque ligne lue reste un achat distinct**, même si plusieurs lignes sont identiques (quatre lignes `10 x [Rune Do Air] (15 868 kamas)` = quatre lots achetés, comme dans le bot) ; `summarizeByItem(lines)` qui regroupe, **pour l'affichage seulement**, par nom : quantité totale, total et prix moyen `round(total / quantité)` ; `type PriceOrigin = 'manual' | 'capture' | 'bot'` et `PRICE_ORIGIN_LABELS` (« Saisie manuelle », « Capture », « Bot Discord ») ; types `FmPlayer`, `FmSession`, `FmSessionDetail`, `FmPlayerSpend`, `FmItemSummary`, `FmProfile`, `FmMe` conformes à [contracts/fm-site-api.md](contracts/fm-site-api.md).
- [ ] T009 [P] Tests dans tests/unit/forgemagie-domain.test.ts : `10 x [Rune Do Air] (15 868 kamas)` → `{ itemName: 'Rune Do Air', quantity: 10, totalKamas: 15868 }` et prix unitaire 1 587 ; séparateurs ` ` et `\xa0` ; quantité 0 écartée ; texte sans ligne → `[]` ; quatre lignes identiques → quatre lignes, et `summarizeByItem` donne Rune Do Air 40 / 63 472 / 1 587 ; `normalizeItemName('  Rune   DO Air ')` = `'rune do air'` ; les accents sont conservés.

### Origine des prix dans le Worker

- [ ] T010 Ajouter l'origine aux contributions dans worker/src/contribution.ts : `origin: 'manual' | 'capture' | 'bot'` dans le type `Contribution` (`parseContributionPayload` fixe toujours `'manual'` : le client public ne peut pas choisir une autre origine) ; `insertContribution` écrit la colonne `origin` ; `fetchCurrentMedian` et `fetchCurrentMedians` lisent `origin`. Dans worker/src/median.ts, `summarizeContributions` renvoie aussi `latestOrigin`, l'origine de la ligne retenue comme dernier prix (même règle que `latestAmountKamas`, lignes sans origine → `'manual'`). Ajouter `latestOrigin` à la réponse de `communityPriceResponse` (worker/src/index.ts) et de `communityPricesResponse`.
- [ ] T011 [P] Tests dans tests/unit/contribution-origin.test.ts (avec `createTestD1`) : une contribution postée par la route publique a l'origine `manual` même si le corps envoie `origin: 'bot'` ; `insertContribution` avec `origin: 'bot'` l'enregistre ; `/community-price` et `/community-prices` renvoient le `latestOrigin` de la contribution la plus récente ; les tests existants de tests/unit/community-prices-route.test.ts restent verts.
- [ ] T012 [P] Lire `latestOrigin` côté site : champ optionnel `latestOrigin?: PriceOrigin` dans `CommunityPrice` (src/domain/types.ts), accepté par `isCommunityPriceRow` (src/services/community-price-api.ts) sans être exigé ; une valeur inconnue est ignorée (traitée comme absente). Test dans tests/unit/community-price-api.test.ts : présent → lu ; absent → la réponse reste `found`.

### Socle FM du Worker

- [ ] T013 Créer worker/src/fm/item-names.ts : importe priceable-items.json ; `lookupItem(name): { status: 'found'; itemId } | { status: 'unknown-item' } | { status: 'ambiguous-item' }` avec la normalisation de T005 (code dupliqué depuis src/domain/forgemagie.ts avec un commentaire, comme worker/src/outlier.ts, les deux projets ne partageant pas de code) ; `isPriceableItemId(id)`.
- [ ] T014 Créer worker/src/fm/http.ts : `json(body, status)` avec les en-têtes CORS du Worker (ajouter `PATCH, DELETE` à `Access-Control-Allow-Methods` dans worker/src/index.ts) ; `sha256Hex(text)` via `crypto.subtle` ; `requireSession(request, env)` qui lit `Authorization: Bearer <jeton>`, cherche `sha256Hex(jeton)` dans `fm_auth_sessions` avec `expires_at > maintenant` et renvoie le `discord_user_id` ou `undefined` ; `upsertPlayer(db, { discordUserId, displayName, avatarUrl })` qui crée le joueur (public, sans serveur) ou met à jour pseudo et avatar.
- [ ] T015 Router `/fm/*` dans worker/src/index.ts **avant** le contrôle `isAuthorized` (research R3) : une fonction `handleFm(request, url, env)` dans worker/src/fm/router.ts renvoie une `Response` pour les chemins `/fm/…` (404 JSON pour un chemin inconnu). Étendre `Env` avec `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_GUILD_ID`, `FM_BOT_API_KEY`, `SITE_URL`. Les routes existantes ne changent pas.
- [ ] T016 [P] Tests dans tests/unit/fm-http.test.ts : `requireSession` accepte un jeton valide, refuse un jeton inconnu, expiré ou absent ; `upsertPlayer` ne change ni `is_private` ni `server_id` d'un joueur existant ; un chemin `/fm/inconnu` répond 404 sans exiger `COMMUNITY_API_KEY` ; `POST /community-price` exige toujours la clé.

### Socle FM du site

- [ ] T017 [P] Créer src/persistence/fm-session-token.ts : `readFmSessionToken()`, `writeFmSessionToken(token)`, `clearFmSessionToken()` sur la clé `dofus-craft:fm-session-token`, chaque accès dans un try/catch (stockage indisponible → pas de jeton).
- [ ] T018 Créer src/services/fm-api.ts : client de toutes les routes de [contracts/fm-site-api.md](contracts/fm-site-api.md) (`VITE_COMMUNITY_API_URL`, en-tête `Authorization: Bearer <jeton>`), qui ne lève jamais d'exception : résultat `{ status: 'ok', data } | { status: 'unauthorized' } | { status: 'not-found' } | { status: 'error', code? } | { status: 'unavailable' }` ; une réponse 401 efface le jeton (T017) ; `fmLoginUrl()` renvoie `${API_URL}/fm/auth/login`. Valider la forme des réponses comme `isCommunityPriceRow`.
- [ ] T019 [P] Tests dans tests/unit/fm-api.test.ts (fetch simulé) : l'en-tête contient le jeton ; 401 → `unauthorized` et jeton effacé ; erreur réseau → `unavailable` ; réponse malformée → `unavailable`.
- [ ] T020 Ajouter `forgemagie: '/forgemagie'` à `ROUTES` (src/app/router.tsx), la route vers `ForgemagiePage` dans src/app/AppShell.tsx, et l'entrée « Forgemagie » dans la navigation principale (icône existante de src/components/Icon.tsx la plus proche, par exemple une enclume ou un marteau, sinon en ajouter une au même format) ; créer src/features/forgemagie/ForgemagiePage.tsx avec un contenu provisoire.

**Checkpoint** : migration appliquée en local, données générées, origine lue, routage `/fm/*` en
place, page accessible depuis la navigation.

---

## Phase 3: User Story 1 - Se connecter avec Discord et avoir un profil (Priority: P1) 🎯 MVP

**Goal** : un membre du serveur Discord du groupe se connecte, retrouve son profil (pseudo, avatar,
serveur Dofus, visibilité) ; un non-membre est refusé ; les autres pages restent anonymes.

**Independent Test** : connexion d'un compte membre → profil avec pseudo et avatar, serveur
choisissable ; compte non membre → refus, aucun profil créé (quickstart, scénario 1).

### Tests for User Story 1

- [ ] T021 [P] [US1] Tests dans tests/unit/fm-auth.test.ts (Discord simulé en remplaçant `fetch`) : `GET /fm/auth/login` redirige vers `https://discord.com/oauth2/authorize` avec `scope=identify guilds.members.read`, `client_id` et un `state` enregistré ; callback avec `state` inconnu ou expiré → redirection `#error=login-failed`, rien créé ; membre → redirection `{SITE_URL}/forgemagie#session=<jeton>`, joueur créé avec `first_login_at`, seul le SHA-256 du jeton est en base, le `state` est supprimé ; non-membre (404 sur `/users/@me/guilds/{id}/member`) → `#error=not-member`, aucun joueur ni session ; paramètre `error` renvoyé par Discord → `#error=login-failed` ; `POST /fm/auth/logout` supprime la session.
- [ ] T022 [P] [US1] Tests dans tests/unit/fm-me.test.ts : `GET /fm/me` sans jeton → 401 ; avec jeton → profil ; `PATCH /fm/me` avec `serverId` d'une chaîne non vide et `isPrivate` booléen → mis à jour ; valeur invalide → 400.

### Implementation for User Story 1

- [ ] T023 [US1] Créer worker/src/fm/auth.ts : `GET /fm/auth/login` (`state` de 32 octets aléatoires en hexadécimal, stocké dans `fm_oauth_states` avec `expires_at` = +10 minutes, purge des états expirés au passage ; `redirect_uri` = `${origine du Worker}/fm/auth/callback`) ; `GET /fm/auth/callback` (vérifie et supprime le `state`, échange le `code` sur `https://discord.com/api/oauth2/token`, lit `/users/@me` et `/users/@me/guilds/${DISCORD_GUILD_ID}/member`, **n'enregistre jamais le jeton Discord**, pseudo = `global_name ?? username`, avatar = URL CDN Discord ou `null`) ; crée un jeton de session de 32 octets aléatoires, stocke son SHA-256 avec `expires_at` = +30 jours, et redirige selon le tableau de [contracts/fm-site-api.md](contracts/fm-site-api.md) ; `POST /fm/auth/logout`.
- [ ] T024 [US1] Créer worker/src/fm/me.ts : `GET /fm/me` et `PATCH /fm/me` (`{ serverId?, isPrivate? }`) selon [contracts/fm-site-api.md](contracts/fm-site-api.md) ; brancher les routes dans worker/src/fm/router.ts.
- [ ] T025 [US1] Créer src/features/forgemagie/useFmAuth.ts : au montage, lit le fragment de l'adresse (`#session=…` → `writeFmSessionToken` ; `#error=not-member` ou `#error=login-failed` → message) puis l'efface avec `history.replaceState` ; charge `GET /fm/me` ; à la première connexion (`serverId` absent), envoie `PATCH /fm/me` avec le serveur actif du sélecteur (`ServerContext`, FR-005) ; expose `status` (`anonymous` | `loading` | `connected` | `unavailable`), `me`, `error`, `logout()`, `updateMe()`.
- [ ] T026 [US1] Écrire src/features/forgemagie/ForgemagiePage.tsx : non connecté → courte explication (sessions FM du bot, dépenses, prix des runes), bouton « Se connecter avec Discord » (lien vers `fmLoginUrl()`) et message d'erreur éventuel (« La page Forgemagie est réservée aux membres du serveur Discord du groupe. » pour `not-member`, « La connexion a échoué, réessaie. » sinon) ; service injoignable → message sans bloquer le reste du site ; connecté → en-tête avec pseudo, avatar, bouton « Se déconnecter », et onglets Sessions / Profil / Runes (contenu des onglets par les stories suivantes).
- [ ] T027 [US1] Créer src/features/forgemagie/ProfileTab.tsx, partie réglages : choix du serveur Dofus (liste des serveurs existante, texte : « Tes achats envoyés par le bot sont rangés sur ce serveur. »), interrupteur Public / Privé (texte : un profil privé n'est visible que par toi, et ton nom est masqué dans les sessions).
- [ ] T028 [US1] Styles de la page, de l'en-tête connecté et des onglets dans src/styles/global.css (et src/styles/design-modern.css si la page HDV y a des règles propres), cohérents avec la page HDV ; largeur téléphone sans défilement horizontal.
- [ ] T029 [P] [US1] Tests d'intégration dans tests/integration/forgemagie-page.test.tsx (API simulée) : non connecté → bouton de connexion ; `#error=not-member` → message et fragment effacé ; `#session=abc` → jeton gardé, fragment effacé, profil affiché ; première connexion → `PATCH` avec le serveur actif ; déconnexion → retour à l'écran non connecté ; la page Recherche s'affiche sans aucun appel `/fm/*`.

**Checkpoint** : US1 fonctionne seule : connexion, profil, réglages.

---

## Phase 4: User Story 2 - Retrouver les sessions FM du bot sur le site (Priority: P1)

**Goal** : les événements du bot créent et mettent à jour les sessions ; le site les liste avec
les mêmes totaux que le bot.

**Independent Test** : envoyer `session-start`, `capture` et `session-stop` avec `curl`
(quickstart, scénario 2) ; la session apparaît avec 63 472 kamas et Rune Do Air 40 / 63 472 /
1 587 kamas/u ; un renvoi ne change rien ; sans clé → 401.

### Tests for User Story 2

- [ ] T030 [P] [US2] Tests dans tests/unit/fm-bot-events.test.ts (avec `createTestD1`, corps de [contracts/fm-bot-api.md](contracts/fm-bot-api.md)) : sans clé ou mauvaise clé → 401 et rien enregistré ; clé = `COMMUNITY_API_KEY` → 401 ; champ commun manquant → 400 ; `session-start` ouvre une session ; un second `session-start` dans le même salon ferme la première (`closed_at` renseigné) et en ouvre une autre ; `capture` sans session ouverte ouvre une session à `occurredAt` ; `capture` enregistre `spent_kamas = spentKamas` et chaque ligne valide ; ligne à quantité 0 → `priceStatus: "invalid"`, non enregistrée ; plus de 200 lignes → 400 ; même `eventId` renvoyé → réponse d'origine avec `duplicate: true`, aucune ligne en plus ; `session-reset` supprime captures et lignes de la session, qui reste ouverte ; `session-stop` la ferme ; `session-reset` ou `session-stop` sans session ouverte → `status: "ignored"` ; l'auteur est créé dans `fm_players` (public, sans serveur) puis son pseudo et son avatar mis à jour.
- [ ] T031 [P] [US2] Tests dans tests/unit/fm-reads.test.ts : `GET /fm/sessions` trie par `opened_at` décroissant, pagine par 20 avec `nextBefore` ; total de session = somme des `spent_kamas` (et **pas** la somme des lignes quand elles diffèrent) ; dépense par joueur ; détail par objet `{ itemName, itemId, quantity, totalKamas, averageUnitKamas = round(total/quantité) }` trié par total décroissant ; session inconnue → 404 ; sans jeton → 401.

### Implementation for User Story 2

- [ ] T032 [US2] Créer worker/src/fm/bot-events.ts : `POST /fm/bot/events` protégé par `Authorization: Bearer ${FM_BOT_API_KEY}` (comparaison sur l'égalité exacte, clé vide refusée) ; validation des champs communs et des limites du contrat (200 lignes, entiers de 0 à 2 000 000 000, `name` de 1 à 80 caractères) ; idempotence par `fm_processed_events` (réponse d'origine stockée, renvoyée avec `duplicate: true`) ; transitions de [data-model.md](data-model.md) ; pour une `capture` : `upsertPlayer`, création de `fm_captures` (`origin = 'bot'`, `server_id` = serveur du profil au moment de l'enregistrement, research R11) et de `fm_purchase_lines` avec `item_id` via `lookupItem` et `price_status` provisoire (`unknown-item`, `ambiguous-item` ou `no-server` ; la création de prix vient en US4). Grouper les écritures d'un événement dans un `db.batch` quand la base le permet. Brancher la route dans worker/src/fm/router.ts.
- [ ] T033 [US2] Créer worker/src/fm/reads.ts : `GET /fm/sessions` et `GET /fm/sessions/{id}` selon [contracts/fm-site-api.md](contracts/fm-site-api.md), totaux calculés à la lecture (data-model, « Règles dérivées »), joueurs au format du contrat (masquage des privés ajouté en US3) ; brancher les routes.
- [ ] T034 [US2] Créer src/features/forgemagie/SessionsTab.tsx : liste des sessions (salon, date d'ouverture, état « En cours » ou « Terminée », total, avatars et montants des joueurs), bouton « Charger plus » avec `nextBefore`, état vide (« Aucune session pour l'instant. Lance `/fmstart` dans Discord. »), état injoignable.
- [ ] T035 [US2] Créer src/features/forgemagie/SessionDetail.tsx : dates d'ouverture et de fermeture, total, dépense de chaque joueur, tableau des objets (nom, quantité, total, prix moyen en kamas/u avec la mention que c'est un arrondi), sans limite de nombre de lignes. Montants formatés avec src/domain/kamas.ts.
- [ ] T036 [P] [US2] Tests d'intégration dans tests/integration/forgemagie-page.test.tsx : la liste affiche une session en cours et une terminée avec leurs totaux ; le détail montre Rune Do Air 40 / 63 472 / 1 587 ; « Charger plus » ajoute la page suivante.

**Checkpoint** : US1 et US2 fonctionnent ; le bot peut être branché.

---

## Phase 5: User Story 3 - Voir ses dépenses de forgemagie (Priority: P2)

**Goal** : chaque joueur voit ses dépenses ; les profils publics sont consultables ; un profil
privé est masqué partout pour les autres ; un joueur peut supprimer son profil.

**Independent Test** : deux sessions à 100 000 et 50 000 kamas → le profil affiche 150 000 ;
profil privé → « Joueur privé » dans les sessions pour un autre membre, profil introuvable ;
suppression → ligne retirée des sessions, totaux recalculés (quickstart, scénario 4).

### Tests for User Story 3

- [ ] T037 [P] [US3] Tests de masquage dans tests/unit/fm-reads.test.ts : vu par un autre membre, un joueur privé apparaît `{ discordUserId: null, displayName: null, avatarUrl: null, private: true }` dans `/fm/sessions` et `/fm/sessions/{id}`, son montant reste dans le total ; vu par lui-même, il apparaît normalement ; `GET /fm/players` exclut les privés sauf le joueur connecté ; `GET /fm/players/{id}` d'un privé → 404 pour un autre, 200 pour lui-même ; le passage public ↔ privé s'applique immédiatement aux sessions passées.
- [ ] T038 [P] [US3] Tests de dépenses et de suppression dans tests/unit/fm-me.test.ts : `GET /fm/players/{id}` renvoie total, montant par session et hors session (imports), détail par objet ; un joueur qui a posté dans Discord **avant** sa première connexion (joueur créé par le bot) retrouve ces achats dans `GET /fm/players/{id}` après s'être connecté, sans doublon de joueur (FR-013) ; `DELETE /fm/me` supprime sessions de connexion, captures, lignes d'achat et joueur ; les totaux de session relus ne comptent plus ses montants ; les contributions de prix déjà créées restent.

### Implementation for User Story 3

- [ ] T039 [US3] Dans worker/src/fm/reads.ts, ajouter le masquage des joueurs privés **côté Worker** pour toutes les réponses (FR-014, FR-015, SC-004) selon le joueur connecté, et les routes `GET /fm/players` et `GET /fm/players/{discordUserId}` de [contracts/fm-site-api.md](contracts/fm-site-api.md).
- [ ] T040 [US3] Dans worker/src/fm/me.ts, ajouter `DELETE /fm/me` : dans un seul `db.batch`, supprimer `fm_auth_sessions`, `fm_purchase_lines` (par ses captures), `fm_captures` et `fm_players` du joueur ; ne pas toucher `community_price_contributions` (research R10).
- [ ] T041 [US3] Compléter src/features/forgemagie/ProfileTab.tsx : dépenses du joueur (total, liste des sessions avec son montant, lien vers le détail de la session, montant des imports hors session, détail par objet) ; sélecteur « Voir le profil de » avec les joueurs publics (`GET /fm/players`) ; bouton « Supprimer mon profil » avec une boîte de confirmation explicite qui dit ce qui est supprimé et que c'est définitif (principe V), puis déconnexion.
- [ ] T042 [US3] Dans SessionsTab.tsx et SessionDetail.tsx, afficher un joueur privé comme « Joueur privé » avec un avatar neutre.
- [ ] T043 [P] [US3] Tests d'intégration dans tests/integration/forgemagie-page.test.tsx : profil avec 150 000 kamas sur deux sessions ; « Joueur privé » affiché ; suppression annulée → aucun appel ; confirmée → `DELETE /fm/me` puis écran non connecté.

**Checkpoint** : US1 à US3 fonctionnent.

---

## Phase 6: User Story 4 - Consulter le prix des runes (Priority: P2)

**Goal** : les achats du bot créent des prix de ressource (avec les règles de la spec) ; l'onglet
Runes liste les 105 runes avec prix, date et origine, recherche et filtre par stat, saisie manuelle.

**Independent Test** : après la capture d'exemple d'un joueur dont le serveur est S, l'onglet Runes
(serveur S dans le sélecteur) affiche Rune Do Air à 1 587 kamas, avec la date et « Bot Discord »
(quickstart, scénario 3).

### Tests for User Story 4

- [ ] T044 [P] [US4] Tests dans tests/unit/fm-purchases.test.ts (avec `createTestD1`) : ligne reconnue et joueur avec serveur → contribution `kind = 'resource'`, `origin = 'bot'`, montant 1 587, `device_id` = `fm:` + 16 premiers caractères hexadécimaux du SHA-256 de l'identifiant Discord, `price_status = 'recorded'` et `contribution_id` renseigné ; ressource non rune de hdv-items.json → prix créé aussi ; nom inconnu → `unknown-item`, pas de contribution ; nom ambigu → `ambiguous-item` ; joueur sans serveur → `no-server` ; écart de plus de 25 % avec la médiane → `outlier`, pas de contribution, dépense inchangée ; exactement 25 % → prix créé ; aucune médiane → prix créé ; deux achats du même joueur comptent une fois dans la médiane (`latestPerDevice`).

### Implementation for User Story 4

- [ ] T045 [US4] Créer worker/src/fm/purchases.ts : `recordLinePrice(db, { itemId, serverId, unitPriceKamas, discordUserId, origin, checkOutlier })` qui applique research R8 (réutiliser `fetchCurrentMedian`, `computeDeviationPercent` et `OUTLIER_THRESHOLD_PERCENT` de worker/src/outlier.ts, puis `insertContribution` avec l'origine) et renvoie `{ priceStatus, contributionId? }` ; l'appeler depuis worker/src/fm/bot-events.ts pour chaque ligne reconnue d'un joueur avec serveur (`checkOutlier: true`), et vider le cache de lecture (`clearReadCache`) si au moins un prix a été créé.
- [ ] T046 [US4] Créer src/features/forgemagie/RunesTab.tsx : liste de src/data/rune-items.json (icône, nom, icône de la caractéristique via src/domain/characteristic-icons.ts), recherche par nom (normalisation de `normalizeSearchText`), filtre par stat (liste des `statLabel`), une ligne de prix par rune qui réutilise la ligne de prix de ressource existante (`CommunityResourcePriceRow` / `ResourcePriceInput`, comme src/features/hdv/HdvPage.tsx) sur le **serveur actif du sélecteur** (FR-017), donc avec saisie manuelle, date, prix périmé, historique et confirmation d'un prix aberrant existants ; sous le prix, l'origine du dernier prix partagé (« Bot Discord », « Capture », « Saisie manuelle », `latestOrigin` absent → « Saisie manuelle »), en Mode communautaire seulement. Charger les prix par lots de 98 comme la page HDV (`useHdvPriceSummary` ou équivalent). Aucune valeur inventée pour une rune sans prix (FR-006 d'origine, FR-019).
- [ ] T047 [US4] Si la ligne de prix existante n'expose pas le `CommunityPrice` complet, faire remonter `latestOrigin` par src/features/comparison/useCommunityPrice.ts (cache localStorage compris : une entrée sans `latestOrigin` reste valide) sans changer l'affichage des autres pages.
- [ ] T048 [P] [US4] Tests d'intégration dans tests/integration/forgemagie-page.test.tsx : l'onglet Runes liste les runes ; « Do Air » dans la recherche ne garde que les runes correspondantes ; le filtre « Force » ne garde que les runes de Force ; une rune avec prix affiche montant, date et « Bot Discord » ; une rune sans prix a un champ vide ; la saisie manuelle envoie une contribution par la route existante.

**Checkpoint** : US1 à US4 fonctionnent ; les achats du bot alimentent les prix.

---

## Phase 7: User Story 5 - Importer une capture sur le site (Priority: P3)

**Goal** : un joueur connecté colle ou dépose une capture, corrige les lignes lues sur son
appareil, puis valide ; ses dépenses et les prix sont mis à jour.

**Independent Test** : coller la capture d'exemple → proposition Rune Do Air, 10, 15 868, 1 587,
rien d'enregistré avant validation ; après validation, dépense sur le profil et prix « Capture »
dans l'onglet Runes (quickstart, scénario 5).

### Tests for User Story 5

- [ ] T049 [P] [US5] Tests dans tests/unit/fm-imports.test.ts : `POST /fm/imports` sans jeton → 401 ; `itemId` absent ou inconnu de l'index → 400 ; profil sans serveur → 409 `no-server` ; `sharePrices: true` → capture `origin = 'capture'` sans session, `spent_kamas` = somme des totaux, contributions `origin = 'capture'` **sans** filtre d'écart ; `sharePrices: false` → lignes `personal-mode`, aucune contribution.
- [ ] T050 [P] [US5] Tests dans tests/unit/capture-ocr.test.ts : `readPurchaseLinesFromText` (la partie de src/services/capture-ocr.ts qui suit l'OCR) propose pour chaque ligne la ressource dont le nom normalisé correspond exactement, ou « non reconnue » ; lignes identiques conservées séparément (quatre lignes lues → quatre lignes proposées) ; Tesseract.js simulé : `recognize` en échec (chargement impossible) → erreur « lecture indisponible » sans exception non gérée.

### Implementation for User Story 5

- [ ] T051 [US5] Créer worker/src/fm/imports.ts : `POST /fm/imports` selon [contracts/fm-site-api.md](contracts/fm-site-api.md), avec `isPriceableItemId` et `recordLinePrice(…, { origin: 'capture', checkOutlier: false })` ; brancher la route.
- [ ] T052 [US5] Créer src/services/capture-ocr.ts : `readCapture(file: Blob)` qui dessine l'image dans un `<canvas>` avec le prétraitement du bot (niveaux de gris, agrandissement ×3, contraste automatique, seuil à 150), charge `tesseract.js` par import dynamique avec la langue `fra` et `--psm 6` (`tessedit_pageseg_mode`), puis passe le texte à `readPurchaseLinesFromText(text)` (T008 + index des ressources du site : runes de rune-items.json et objets de hdv-items.json) ; refuse ce qui n'est pas une image ; renvoie `{ status: 'ok', lines } | { status: 'no-lines' } | { status: 'unavailable' } | { status: 'not-an-image' }`, jamais d'exception.
- [ ] T053 [US5] Créer src/features/forgemagie/CaptureImport.tsx, affiché dans l'onglet Runes : zone « Coller ou déposer une capture du chat » (événement `paste` sur la page et glisser-déposer, plus un bouton de choix de fichier pour mobile), indicateur de lecture, tableau des lignes lues (ressource, quantité, total, prix unitaire recalculé à chaque correction, case « garder ») ; une ligne non reconnue affiche un choix de ressource (recherche dans les runes et ressources) et ne peut pas être validée sans choix (FR-024) ; bouton « Valider » qui, en Mode communautaire, demande la confirmation existante (`OutlierConfirmDialog`, specs/007) pour chaque prix à plus de 25 % de la médiane connue, puis appelle `POST /fm/imports` avec `sharePrices: true` ; en Mode personnel, `sharePrices: false` et enregistre les prix sur l'appareil par le carnet existant (`useResourcePrices`). Messages : aucune ligne lue, lecture indisponible, pas d'image, profil sans serveur. Mention visible : « La capture est lue sur ton appareil et n'est jamais envoyée. »
- [ ] T054 [P] [US5] Tests d'intégration dans tests/integration/forgemagie-page.test.tsx (`readCapture` simulé) : les lignes proposées s'affichent, rien n'est envoyé avant « Valider » ; corriger le total recalcule le prix unitaire ; une ligne non reconnue bloque la validation tant qu'elle n'est ni choisie ni décochée ; validation → `POST /fm/imports` avec les bonnes lignes.

**Checkpoint** : toutes les stories fonctionnent.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T055 [P] Test e2e tests/e2e/forgemagie.spec.ts (API et Discord simulés par interception des requêtes, comme les autres tests e2e) : connexion par `#session=…`, liste et détail d'une session, profil privé, onglet Runes, import d'une capture avec OCR simulé ; à largeur téléphone, pas de défilement horizontal.
- [ ] T056 [P] Mettre à jour README.md (section Fonctionnalités : page Forgemagie, connexion Discord réservée aux membres du serveur du groupe, sessions du bot, prix des runes, import de capture) et worker/README.md (routes `/fm/*`, secrets, migration 0007, lien vers [contracts/fm-bot-api.md](contracts/fm-bot-api.md)).
- [ ] T057 [P] Ajouter les notes d'amendement listées dans plan.md (« Amendements aux specs existantes ») en fin de specs/004-community-price-sharing/spec.md, specs/021-background-data-loading/spec.md, specs/023-hdv-price-entry/spec.md et specs/024-latest-community-price/spec.md.
- [ ] T058 Vérifier qu'aucun secret n'apparaît dans le code publié ni dans `dist/` (recherche de `FM_BOT_API_KEY`, `DISCORD_CLIENT_SECRET` et de leurs valeurs locales), et que `tesseract.js` n'est pas dans le bundle initial (`npm run build`, inspection des fichiers de `dist/assets/`).
- [ ] T059 Lancer `npm run typecheck`, `npm run lint`, `npm test` et `npm run test:e2e`, puis dérouler les scénarios manuels de [quickstart.md](quickstart.md) avec `npm run worker:dev` et `npm run dev` (laisser le serveur de développement tourner à la fin).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** : aucune dépendance.
- **Foundational (Phase 2)** : dépend de Setup ; **bloque toutes les stories**. T004 avant tous les
  tests du Worker ; T005 → T006 → T007 et T013 ; T014 → T015.
- **US1 (Phase 3)** : dépend de Phase 2.
- **US2 (Phase 4)** : dépend de Phase 2 ; pour l'affichage, de la page connectée d'US1 (T025, T026).
  Les tâches Worker d'US2 (T030 à T033) peuvent avancer en parallèle d'US1.
- **US3 (Phase 5)** : dépend d'US1 (profil) et d'US2 (sessions à masquer).
- **US4 (Phase 6)** : dépend d'US2 pour les prix issus du bot (T045 modifie bot-events.ts) ;
  l'onglet Runes (T046 à T048) ne dépend que de la Phase 2 et d'US1.
- **US5 (Phase 7)** : dépend d'US4 (`recordLinePrice`, onglet Runes).
- **Polish (Phase 8)** : après les stories livrées.

### Within Each User Story

- Tests d'abord, qui doivent échouer, puis Worker, puis site.
- Worker : route → branchement dans router.ts.
- Site : hook ou service → composant → styles.

### Parallel Opportunities

- Phase 1 : T002 et T003.
- Phase 2 : T008/T009, T010/T011, T012, T017, T019 en parallèle une fois T004 fait.
- US1 : T021 et T022 (tests) en parallèle ; T023 et T024 (Worker) en parallèle de T025 à T028
  (site).
- US2 : T030 et T031 en parallèle ; T034 et T035 après T033.
- US3 : T037 et T038 en parallèle.

---

## Parallel Example: User Story 2

```bash
# Tests Worker en parallèle :
Task: "Tests des événements du bot dans tests/unit/fm-bot-events.test.ts"
Task: "Tests des lectures de sessions dans tests/unit/fm-reads.test.ts"

# Puis, une fois T033 fait, le site en parallèle :
Task: "Liste des sessions dans src/features/forgemagie/SessionsTab.tsx"
Task: "Détail d'une session dans src/features/forgemagie/SessionDetail.tsx"
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Phase 1 et Phase 2.
2. US1 (connexion) puis US2 (sessions du bot) : ensemble, ils répondent au besoin principal, garder
   les sessions du bot et les consulter.
3. **STOP et VALIDATE** : scénarios 1 et 2 du quickstart avec `curl`, puis envoyer
   [contracts/fm-bot-api.md](contracts/fm-bot-api.md) à l'auteur du bot.

### Incremental Delivery

1. Socle → US1 → US2 → validation → déploiement (MVP).
2. US4 → validation → déploiement (prix des runes).
3. US3 → validation → déploiement (dépenses, profil privé, suppression).
4. US5 → validation → déploiement (import de capture).

US4 passe avant US3, comme dans le plan : les prix des runes ont de la valeur dès que le bot est
branché, alors que les dépenses du profil demandent plusieurs sessions pour être utiles.
