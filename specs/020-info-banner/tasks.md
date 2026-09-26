---

description: "Task list for 020-info-banner"
---

# Tasks: Bandeau d'information

**Input**: Design documents from `/specs/020-info-banner/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests** : inclus (constitution, principe II ; contracts/info-message-api.md « Tests obligatoires »).

**Organization** : US1 publier et afficher (P1), US2 fermer (P1), US3 retirer ou expirer (P2).

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [ ] T001 Créer `worker/migrations/0006_add_info_message.sql` : table `info_message` (`id TEXT PRIMARY
  KEY` toujours `'current'`, `text TEXT NOT NULL`, `tone TEXT NOT NULL CHECK (tone IN ('info',
  'important'))`, `ends_at TEXT NULL`, `updated_at TEXT NOT NULL`), avec l'en-tête de commentaire des
  autres migrations ; ajouter la même table à `worker/schema.sql` (utilisé par
  `tests/support/sqlite-d1.ts`) ; ajouter le script `worker:db:migrate-info-message` dans
  `package.json` sur le modèle de `worker:db:migrate-player-counters`.

---

## Phase 2: Foundational (règles partagées)

- [ ] T002 [P] Écrire `tests/unit/info-message-validation.test.ts` pour `validateInfoMessageInput` :
  texte vide ou fait d'espaces → `{ ok: false, field: 'text', error: 'Le message ne peut pas être
  vide.' }` ; 281 caractères → `'280 caractères au plus.'` ; 280 → valide (texte rogné aux
  extrémités) ; `tone` autre que `'info'` / `'important'` → `field: 'tone'`, `'Style inconnu.'` ;
  `endsAt` illisible ou passé (par rapport à `now` passé en paramètre) → `field: 'endsAt'`, `'La date
  de fin doit être dans le futur.'` ; `endsAt` absent ou `null` → valide avec `endsAt: null` ; plus
  `isInfoMessageActive(message, now)` (sans fin, fin future, fin passée).
- [ ] T003 [P] Créer `src/domain/info-message.ts` : types `InfoTone`, `InfoMessage` (`{ text, tone,
  endsAt: string | null, version: string }`), `InfoMessageInput`, `validateInfoMessageInput(input,
  now = new Date())` (forme `{ ok: true; value } | { ok: false; field; error }` comme
  `src/domain/player-counter.ts`), `isInfoMessageActive(message, now = new Date())`,
  `INFO_MESSAGE_MAX_LENGTH = 280`.

---

## Phase 3: User Story 1 - Publier un message visible par tous (Priority: P1) 🎯 MVP

**Goal** : le propriétaire publie ; tous les joueurs voient le bandeau.

**Independent Test** : publier depuis l'administration, ouvrir le site ailleurs, voir le bandeau.

### Tests

- [ ] T004 [P] [US1] Écrire `tests/unit/info-message-route.test.ts` (avec `createTestD1`) pour
  `infoMessageResponse(db, now)` de `worker/src/info-message.ts` : 200 `null` sans ligne ; message
  sans fin renvoyé au format `{ text, tone, endsAt: null, version: updated_at }` ; aucune autre clé.
- [ ] T005 [P] [US1] Écrire `tests/unit/admin-message-api.test.ts` (sur le modèle de
  `tests/unit/admin-worker-counters.test.ts`, avec `createTestD1`) : 403 sans propriétaire sur
  GET / PUT / DELETE `/api/message` ; PUT valide → 200 et message enregistré ; second PUT → remplace,
  `version` différente ; PUT invalide → 400 `{ error, field }` ; GET renvoie le message.
- [ ] T006 [P] [US1] Écrire `tests/unit/info-message-api.test.ts` pour `getInfoMessage()` : message
  valide → objet ; `null` → `undefined` ; 500, réseau coupé, JSON invalide, `tone` inconnu →
  `undefined` sans exception.

### Implementation

- [ ] T007 [US1] Créer `worker/src/info-message.ts` : `readInfoMessage(db)` (`SELECT text, tone,
  ends_at, updated_at FROM info_message WHERE id = 'current'`), `infoMessageFromRow`,
  `infoMessageResponse(db, now)` ; brancher `GET /info-message` (lecture anonyme) dans
  `worker/src/index.ts`, à côté de `/player-counters`.
- [ ] T008 [US1] Créer `admin-worker/src/message.ts` : `getMessage(db)`, `saveMessage(db, value)`
  (`INSERT INTO info_message … ON CONFLICT(id) DO UPDATE`, `updated_at` = maintenant en ISO),
  `deleteMessage(db)` ; brancher dans `admin-worker/src/index.ts` `GET` / `PUT` / `DELETE`
  `/api/message` après `verifyOwner`, PUT validé par `validateInfoMessageInput`.
- [ ] T009 [P] [US1] Créer `src/services/info-message-api.ts` : `getInfoMessage(): Promise<InfoMessage
  | undefined>` sur `${import.meta.env.VITE_COMMUNITY_API_URL}/info-message`, comme
  `src/services/player-counters-api.ts`, sans jamais lever.
- [ ] T010 [US1] Ajouter dans `admin/admin-api.ts` `getMessage`, `saveMessage`, `deleteMessage` ; créer
  `admin/MessageEditor.tsx` selon contracts/info-banner-ui.md « Éditeur » (texte avec « n / 280 »,
  radios Info / Important, `datetime-local` de fin en heure de Paris convertie en ISO, aperçu,
  « Publier », « Retirer » si un message existe, erreurs par champ, « Message publié » /
  « Message retiré », « Expiré le … » si expiré) ; l'insérer en tête de `admin/AdminPage.tsx` ; styles
  dans `admin/admin.css`.
- [ ] T011 [US1] Créer `src/components/InfoBanner.tsx` : charge `getInfoMessage()` au montage (et au
  changement de page si le dernier chargement a plus de 5 minutes), n'affiche rien sans message actif
  (`isInfoMessageActive`) ; classes `info-banner info-banner--info|important`, `role="status"` ou
  `role="alert"`, icône `info`, texte brut ; l'insérer en haut de la zone principale dans
  `src/app/AppShell.tsx` ; styles dans `src/styles/global.css` (retour à la ligne, pas de défilement
  horizontal, Important en couleur d'avertissement).
- [ ] T012 [US1] Écrire `tests/integration/info-banner.test.tsx` : pas de bandeau sans message ;
  bandeau Info puis Important (classe et rôle) sur deux pages ; `getInfoMessage` en échec → pas de
  bandeau et site utilisable.

**Checkpoint** : publication de bout en bout.

---

## Phase 4: User Story 2 - Fermer le bandeau (Priority: P1)

- [ ] T013 [P] [US2] Écrire `tests/unit/info-banner-dismissal.test.ts` et créer
  `src/persistence/info-banner-dismissal.ts` : `readDismissedVersion()` / `dismissVersion(version)` sur
  `localStorage['craftcheck-info-banner-dismissed']`, `try/catch` (indisponible → rien de fermé,
  jamais d'exception).
- [ ] T014 [US2] Dans `InfoBanner.tsx`, bouton icône `close` `aria-label="Fermer le message"` qui
  enregistre la version et masque le bandeau ; ne pas afficher si la version reçue est la version
  fermée.
- [ ] T015 [US2] Compléter `tests/integration/info-banner.test.tsx` : fermer → disparaît et reste
  fermé après un nouveau rendu ; nouvelle version → réapparaît.

---

## Phase 5: User Story 3 - Retirer ou faire expirer (Priority: P2)

- [ ] T016 [US3] Compléter `tests/unit/info-message-route.test.ts` (message expiré → `null` ; fin
  future → renvoyé) et `tests/unit/admin-message-api.test.ts` (DELETE → 204 puis GET → `null` ;
  GET administration renvoie un message expiré).
- [ ] T017 [US3] Dans `worker/src/info-message.ts`, ne renvoyer le message que si
  `isInfoMessageActive(message, now)` ; dans `InfoBanner.tsx`, masquer le bandeau quand `endsAt`
  passe pendant que la page est ouverte (minuterie jusqu'à `endsAt`).

---

## Phase 6: Polish

- [ ] T018 [P] Vérifier que `tests/unit/no-admin-on-public-site.test.ts` passe toujours (aucun code
  d'administration dans le site public) ; mettre à jour `README.md` (fonctionnalité) et
  `worker/README.md` (route `/info-message`, migration `0006`).
- [ ] T019 Lancer `npm run typecheck`, `npm run lint`, `npx vitest run`, `npm run admin:build` ; vérifier
  le bandeau dans le navigateur (dev) sur ordinateur et téléphone.

---

## Dependencies & Execution Order

- T001 → tout le reste (schéma de test) ; T002 ∥ T003, puis US1.
- US1 : T004–T006 en parallèle ; T007 après T004 ; T008 après T005 ; T009 après T006 ; T010 après T008 ;
  T011 après T009 ; T012 après T011.
- US2 après T011 ; US3 après T007, T008 et T011.

## Parallel Example

```text
T004 route publique | T005 administration | T006 client
puis T007 (worker) | T008 (admin-worker) | T009 (client)
```

## Implementation Strategy

MVP = Setup + Foundational + US1. Déploiement : migration distante (`npm run
worker:db:migrate-info-message`), puis Worker public, puis administration (`admin:build` +
`admin:deploy`), puis site.
