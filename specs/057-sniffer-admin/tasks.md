# Tasks : administration des clés sniffer et du mapping

**Input** : documents de `specs/057-sniffer-admin/` (plan, spec, research, data-model,
contracts/admin-sniffer-api.md, quickstart)

**Tests** : demandés par la consigne (routes `admin-worker` testées avec vitest), sur la vraie D1
simulée (`tests/support/sqlite-d1.ts`) et la vérification Access simulée.

## Phase 1 : Setup

- [ ] T001 Ajouter `../worker/src/fm/http.ts` et `../worker/src/cors.ts` à `include` dans `admin-worker/tsconfig.json` (réutiliser `sha256Hex`, research R1)

## Phase 2 : Foundational

Aucune : les tables existent (0018), `verifyOwner` et `handleApi` existent.

## Phase 3 : Histoire 1 + 2 — Clés sniffer (P1)

**But** : créer une clé (affichée une fois), la révoquer, lister l'activité.

**Test indépendant** : une clé créée par `POST /api/sniffer/keys` passe `authenticateSnifferKey` ;
révoquée, elle ne passe plus ; la liste montre `rowsToday` et `lastSeenAt`.

- [ ] T002 [US1] Écrire `admin-worker/src/sniffer-keys.ts` : `validateKeyLabel` (« 1-60 caractères, espaces autour retirés »), `listKeys(db, now)` (LEFT JOIN `sniffer_daily_usage` sur le jour UTC, `COALESCE(rows_written, 0)`, plus récente d'abord, jamais `key_hash`), `createKey(db, label, now)` (`id` = `crypto.randomUUID()`, secret `dcp_` + `randomHex(32)`, `key_hash` = `sha256Hex(secret)`), `revokeKey(db, id, now)` (`revoked_at = COALESCE(revoked_at, ?)`, `null` si 0 ligne)
- [ ] T003 [US1] Brancher dans `admin-worker/src/index.ts` : `GET /api/sniffer/keys`, `POST /api/sniffer/keys` (201 `{ key, secret }`, 400 `{ error, field: 'label' }`), `POST /api/sniffer/keys/:id/revoke` (200 ou 404 `Clé introuvable.`), après `verifyOwner`
- [ ] T004 [P] [US1] Tests `tests/unit/admin-sniffer-keys.test.ts` : 403 pour un étranger sur les 3 routes sans écriture ; création → seule l'empreinte en base, secret absent de la liste et de la base ; secret accepté par `authenticateSnifferKey` puis `last_seen_at` visible dans la liste ; libellé vide / > 60 refusé ; révocation → 401 côté `handleSniffer`, date d'origine conservée si répétée ; id inconnu → 404 ; `rowsToday` lit le jour UTC courant seulement
- [ ] T005 [US1] Ajouter à `admin/admin-api.ts` : `listSnifferKeys`, `createSnifferKey`, `revokeSnifferKey` et leurs gardes de type
- [ ] T006 [US1] Écrire `admin/SnifferKeysEditor.tsx` (section « Clés sniffer » selon contracts/admin-sniffer-api.md « Interface ») et l'ajouter dans `admin/AdminPage.tsx`

## Phase 4 : Histoire 3 — Publier un mapping (P1)

**But** : déposer keymap + schema pour un build ; il devient l'actif de son build.

**Test indépendant** : après `POST /api/sniffer/mappings`, `snifferConfigResponse` pour ce build
renvoie le même id et les mêmes documents.

- [ ] T007 [US3] Écrire `admin-worker/src/sniffer-mappings.ts` : `validateMappingUpload` (data-model « Validation d'un dépôt » : build `^\d+\.\d+\.\d+(\.\d+)?$` ≤ 32 caractères ; documents ≤ 256 Ko, JSON valide, objet ; keymap `price_list` chaîne non vide ; schema `price_list` objet et chaque `of` résolu de proche en proche vers une définition objet ne commençant pas par `_`), `listMappings`, `uploadMapping` (un lot : désactive l'actif du build puis insère `active = 1` ; relit l'actif)
- [ ] T008 [US3] Brancher dans `admin-worker/src/index.ts` : `GET /api/sniffer/mappings`, `POST /api/sniffer/mappings` (201 ou 400 `{ error, field }`)
- [ ] T009 [P] [US3] Tests `tests/unit/admin-sniffer-mappings.test.ts` : chaque refus de la table du contrat sans écriture ; `_price_list` ne compte pas ; cycle de `of` accepté sans boucle ; dépôt valide = mapping de `snifferConfigResponse` (texte identique) ; second dépôt du même build remplace l'actif ; autre build intact ; 403 pour un étranger
- [ ] T010 [US3] Ajouter à `admin/admin-api.ts` : `listSnifferMappings`, `uploadSnifferMapping`
- [ ] T011 [US3] Écrire `admin/SnifferMappingsEditor.tsx` (build, deux fichiers lus par `File.text()`, « Publier », historique groupé par build) et l'ajouter dans `admin/AdminPage.tsx`

## Phase 5 : Histoire 4 — Retour arrière (P2)

**Test indépendant** : déposer A puis B, réactiver A : la config renvoie A et un lot avec l'id de B
reçoit 409.

- [ ] T012 [US4] `activateMapping(db, id)` dans `admin-worker/src/sniffer-mappings.ts` (un lot : désactive l'actif du build autre que la cible, active la cible ; `null` si inconnu) et la route `POST /api/sniffer/mappings/:id/activate` dans `admin-worker/src/index.ts`
- [ ] T013 [P] [US4] Tests dans `tests/unit/admin-sniffer-mappings.test.ts` : réactivation → config renvoie A, lot avec l'id de B → 409 ; réactiver l'actif ne change rien ; id inconnu → 404
- [ ] T014 [US4] `activateSnifferMapping` dans `admin/admin-api.ts` et bouton « Réactiver » avec confirmation dans `admin/SnifferMappingsEditor.tsx`

## Phase 6 : Polish

- [ ] T015 Styles des deux sections (encadré de la clé, tableaux lisibles en 375 px) dans `admin/admin.css`
- [ ] T016 `npm test`, `npm run typecheck`, `npm run lint`, `npm run admin:build`
- [ ] T017 Vérification locale de bout en bout selon `specs/057-sniffer-admin/quickstart.md` (D1 locale partagée, aucune commande `--remote`)

## Dépendances

- T001 avant T002. T002 → T003 → T004 ; T005 → T006.
- T007 → T008 → T009 ; T010 → T011. T012 après T008 ; T014 après T011.
- Phases 3 et 4 indépendantes l'une de l'autre (fichiers différents, sauf `index.ts`, `admin-api.ts`
  et `AdminPage.tsx` à éditer l'un après l'autre).

## Stratégie

MVP : phases 3 et 4 (une clé et un mapping suffisent à faire tourner l'outil d'un ami). Phase 5
ensuite, puis polish et vérification locale.
