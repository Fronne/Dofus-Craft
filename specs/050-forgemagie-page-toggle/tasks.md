---

description: "Task list for 050-forgemagie-page-toggle"
---

# Tasks: Activer ou désactiver la page Forgemagie

**Input**: Design documents from `/specs/050-forgemagie-page-toggle/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests** : inclus (constitution, principe II).

**Organization** : US1 page masquée (P1), US2 interrupteur d'administration (P1), US3 repli quand le
réglage est illisible (P2).

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [ ] T001 Créer `worker/migrations/0016_add_site_settings.sql` : table `site_settings` (`key TEXT
  PRIMARY KEY CHECK (key IN ('forgemagie_page'))`, `value TEXT NOT NULL CHECK (value IN ('0', '1'))`,
  `updated_at TEXT NOT NULL`), avec l'en-tête de commentaire des autres migrations ; ajouter la même
  table à `worker/schema.sql` ; ajouter le script `worker:db:migrate-site-settings` dans
  `package.json` sur le modèle de `worker:db:migrate-info-message`.

---

## Phase 2: Foundational (règles partagées)

- [ ] T002 [P] Créer `src/domain/site-settings.ts` : type `SiteSettings = { forgemagiePage: boolean }`,
  `DEFAULT_SITE_SETTINGS = { forgemagiePage: false }`, `isSiteSettings(value)` et
  `validateSiteSettingsInput(input)` (« `forgemagiePage` doit être un booléen, sinon erreur sur le
  champ `forgemagiePage` »).
- [ ] T003 [P] Écrire `tests/unit/site-settings-domain.test.ts` : garde de type (objet valide, champ
  manquant, non booléen, `null`) et validation (booléen accepté, chaîne ou absence refusée).
- [ ] T004 Créer `worker/src/site-settings.ts` : `readSiteSettings(db)` (aucune ligne ⇒
  `DEFAULT_SITE_SETTINGS`, `'1'` ⇒ activée) et la route `GET /site-settings` dans
  `worker/src/index.ts`, à côté de `/info-message`, sans clé et sans cache.
- [ ] T005 [P] Écrire `tests/unit/site-settings-route.test.ts` : aucune ligne ⇒ `false`, `'1'` ⇒
  `true`, `'0'` ⇒ `false`.

---

## Phase 3: User Story 1 — La page Forgemagie est masquée aux joueurs (P1)

**Goal** : sans réglage activé, ni lien ni page. **Independent test** : ouvrir le site sans rien
activer.

- [ ] T006 [P] [US1] Créer `src/services/site-settings-api.ts` : `getSiteSettings()` lit
  `GET /site-settings`, ne lève jamais, `undefined` sur toute erreur ou charge utile invalide ; test
  `tests/unit/site-settings-api.test.ts`.
- [ ] T007 [US1] Créer `src/app/useForgemagiePageEnabled.ts` (lit le réglage au montage) et, dans
  `src/app/AppShell.tsx`, retirer le lien « Forgemagie » de la navigation et remplacer l'élément de
  la route `/forgemagie` par un état vide « Forgemagie est momentanément indisponible » avec le lien
  « Aller à la recherche » tant que la page est désactivée (FR-003, FR-004, FR-005).
- [ ] T008 [US1] Écrire `tests/integration/forgemagie-page-toggle.test.tsx` : désactivée ⇒ pas de
  lien et message d'indisponibilité sur `/forgemagie` ; activée ⇒ lien et page présents.

---

## Phase 4: User Story 2 — Réactiver ou désactiver depuis l'administration (P1)

**Goal** : un clic change l'état. **Independent test** : activer puis désactiver dans
l'administration et recharger le site.

- [ ] T009 [US2] Créer `admin-worker/src/settings.ts` (`getSettings`, `saveSettings` avec
  `INSERT … ON CONFLICT(key) DO UPDATE`) et les routes `GET` / `PUT /api/settings` dans
  `admin-worker/src/index.ts`, derrière `verifyOwner`, validation par `validateSiteSettingsInput`
  (400 avec `field`).
- [ ] T010 [P] [US2] Écrire `tests/unit/admin-settings-api.test.ts` : 403 sans propriétaire, lecture
  par défaut, écriture puis relecture, 400 sur valeur non booléenne.
- [ ] T011 [US2] Ajouter `getSettings` / `saveSettings` à `admin/admin-api.ts`, créer
  `admin/SiteSettingsEditor.tsx` (section « Pages du site », état « Activée » / « Désactivée »,
  bouton « Activer » / « Désactiver », erreur affichée et état conservé en cas d'échec — FR-006,
  FR-008) et l'insérer dans `admin/AdminPage.tsx` avant le bandeau d'information.
- [ ] T012 [US2] Compléter `tests/integration/admin-page.test.tsx` : état affiché, clic qui change
  l'état, échec qui laisse l'état précédent et affiche une erreur.

---

## Phase 5: User Story 3 — Repli quand le réglage ne peut pas être lu (P2)

**Goal** : dernier état connu, sinon désactivée. **Independent test** : lire « activée », couper le
service, recharger.

- [ ] T013 [US3] Créer `src/persistence/site-settings-cache.ts` (clé `craftcheck-site-settings`,
  illisible ou absent ⇒ `DEFAULT_SITE_SETTINGS`) et l'utiliser dans
  `src/app/useForgemagiePageEnabled.ts` : état initial = dernier état connu, mis à jour et mémorisé
  à chaque lecture réussie, inchangé si la lecture échoue (FR-009).
- [ ] T014 [P] [US3] Écrire `tests/unit/site-settings-cache.test.ts` et compléter
  `tests/integration/forgemagie-page-toggle.test.tsx` : lecture en échec avec « activée » mémorisée
  ⇒ page accessible ; sans rien de mémorisé ⇒ page masquée.

---

## Phase 6: Polish

- [ ] T015 Documenter la route et la migration dans `worker/README.md`, puis lancer
  `npm run typecheck`, `npm run lint` et `npm run test`.

## Dependencies

T001 → T004 → (US1, US2). T002 → T004, T006, T009, T011, T013. US3 dépend de US1 (T007). US1 et US2
sont indépendantes l'une de l'autre après la phase 2.

## Parallel Example

T002, T003 et T005 peuvent être écrits en même temps ; T006 et T010 aussi.

## Implementation Strategy

MVP = phases 1 à 3 (la page est masquée). La phase 4 rend la désactivation réversible ; les deux
sont livrées ensemble, la page n'étant jamais réactivable sans l'interrupteur.
