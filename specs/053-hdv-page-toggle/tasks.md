---

description: "Task list for 053-hdv-page-toggle"
---

# Tasks: Activer ou désactiver la page HDV

**Input**: Design documents from `/specs/053-hdv-page-toggle/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests** : inclus (constitution, principe II).

**Organization** : US1 interrupteur d'administration (P1), US2 page HDV masquée (P1), US3 repli
quand le réglage est illisible (P2).

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [X] T001 Créer `worker/migrations/0017_add_hdv_page_setting.sql` (en-tête de commentaire comme
  0016) : créer `site_settings_new` (`key TEXT PRIMARY KEY CHECK (key IN ('forgemagie_page',
  'hdv_page'))`, `value TEXT NOT NULL CHECK (value IN ('0', '1'))`, `updated_at TEXT NOT NULL`),
  `INSERT INTO site_settings_new SELECT key, value, updated_at FROM site_settings`, `DROP TABLE
  site_settings`, `ALTER TABLE site_settings_new RENAME TO site_settings` ; élargir la contrainte de
  clé dans `worker/schema.sql` ; ajouter le script `worker:db:migrate-hdv-page-setting` dans
  `package.json` sur le modèle de `worker:db:migrate-site-settings`.

---

## Phase 2: Foundational (règles partagées)

- [X] T002 Étendre `src/domain/site-settings.ts` : `SiteSettings = { forgemagiePage: boolean; hdvPage:
  boolean }`, `DEFAULT_SITE_SETTINGS = { forgemagiePage: false, hdvPage: true }` ;
  `parseSiteSettings(value): SiteSettings | undefined` (objet avec `forgemagiePage` booléen ;
  `hdvPage` absent ⇒ `true`, présent non booléen ⇒ `undefined`) ; type `SiteSettingsChange =
  Partial<SiteSettings>` et `validateSiteSettingsChange(input)` (au moins un champ connu ; tout champ
  présent booléen, sinon `{ ok: false, field, error: 'Valeur attendue : activée ou désactivée.' }`,
  `field: 'forgemagiePage'` quand rien de connu n'est envoyé) ; retirer `isSiteSettings` et
  `validateSiteSettingsInput` une fois leurs usages remplacés.
- [X] T003 Mettre à jour `tests/unit/site-settings-domain.test.ts` : `parseSiteSettings` (objet
  complet, ancien format sans `hdvPage` ⇒ `true`, `hdvPage` non booléen, `null`) et
  `validateSiteSettingsChange` (un champ, deux champs, objet vide, champ non booléen nommé dans
  l'erreur).
- [X] T004 Étendre `worker/src/site-settings.ts` : `HDV_PAGE_KEY = 'hdv_page'` ; `readSiteSettings`
  lit les deux clés en une requête (`SELECT key, value … WHERE key IN (…)`, `.all()`) et applique le
  défaut de chaque clé absente ; adapter le type structurel `ReadDb` ; `siteSettingsResponse` renvoie
  toujours `DEFAULT_SITE_SETTINGS` en cas d'erreur.
- [X] T005 Remplacer l'usage de `isSiteSettings` par `parseSiteSettings` dans
  `src/services/site-settings-api.ts`, `src/persistence/site-settings-cache.ts` et
  `admin/admin-api.ts`.

**Checkpoint** : `npx tsc -b --noEmit` et `npx tsc -p worker --noEmit` passent.

---

## Phase 3: User Story 1 - Interrupteur dans l'administration (P1) 🎯 MVP

**Goal** : le propriétaire active ou désactive la page HDV sans toucher la Forgemagie.

**Independent Test** : `PUT /api/settings { hdvPage: false }` puis lecture publique ⇒ `hdvPage:
false`, `forgemagiePage` inchangé.

- [X] T006 [US1] `admin-worker/src/settings.ts` : `saveSettings(db, change: SiteSettingsChange, now)`
  écrit seulement les clés présentes (`forgemagie_page`, `hdv_page`) avec le même `INSERT … ON
  CONFLICT`, puis relit l'objet complet.
- [X] T007 [US1] `admin-worker/src/index.ts` : `PUT /api/settings` utilise
  `validateSiteSettingsChange` ; `admin/admin-api.ts` : `saveSettings(input: SiteSettingsChange)`.
- [X] T008 [US1] `admin/SiteSettingsEditor.tsx` : une ligne par page (« Page Forgemagie », « Page HDV »)
  avec état et bouton ; `toggle` n'envoie que le champ cliqué ; message « Page HDV activée. » /
  « Page HDV désactivée. » ; boutons inactifs pendant un enregistrement.
- [X] T009 [P] [US1] `tests/unit/site-settings-route.test.ts` : adapter les attentes à l'objet complet ;
  ajouter : HDV activée par défaut ; désactiver puis réactiver HDV ; changer HDV laisse la Forgemagie
  (et inversement) ; `hdvPage: 'non'` ⇒ 400 sur le champ `hdvPage` ; objet vide ⇒ 400 ; la migration
  0017 appliquée à une base 0016 garde la ligne `forgemagie_page`.
- [X] T010 [P] [US1] `tests/integration/admin-page.test.tsx` : la ligne « Page HDV » s'affiche, son
  bouton envoie `{ hdvPage: false }` seul, l'état affiché est celui renvoyé ; échec ⇒ message
  d'erreur et état inchangé.

---

## Phase 4: User Story 2 - Page HDV masquée (P1)

**Goal** : page désactivée, ni lien ni contenu HDV.

**Independent Test** : réglages `{ hdvPage: false }` ⇒ navigation sans « HDV », `/hdv` affiche le
message d'indisponibilité.

- [X] T011 [US2] Renommer `src/app/useForgemagiePageEnabled.ts` en `src/app/useSiteSettings.ts` :
  renvoie `{ settings: SiteSettings, reading: boolean }` avec la même logique (dernier état connu,
  lecture, mémorisation).
- [X] T012 [US2] `src/app/AppShell.tsx` : utiliser `useSiteSettings` ; filtrer `NAV_ITEMS` selon
  `forgemagiePage` et `hdvPage` ; ajouter `HdvUnavailablePage` (titre « HDV », EmptyState icône
  `store`, « HDV est momentanément indisponible », « La page reviendra bientôt. Vos prix sont
  conservés. », lien « Aller à la recherche ») ; route `/hdv` : page si activée, « Chargement… » si
  désactivée pendant une lecture, sinon `HdvUnavailablePage` ; ajouter `hdvPage` aux dépendances du
  placement du losange de navigation.
- [X] T013 [P] [US2] Créer `tests/integration/hdv-page-toggle.test.tsx` (sur le modèle de
  `forgemagie-page-toggle.test.tsx`) : page désactivée ⇒ pas de lien « HDV » et message sur `/hdv` ;
  page activée ⇒ lien et page présents ; aucun réglage lu ⇒ page visible.
- [X] T014 [P] [US2] Adapter `tests/integration/forgemagie-page-toggle.test.tsx` et
  `tests/integration/app-nav.test.tsx` aux réglages complets ; ajouter dans app-nav : HDV désactivée
  ⇒ « HDV » absent de la navigation.

---

## Phase 5: User Story 3 - Repli quand le réglage est illisible (P2)

**Goal** : FR-009 avec « activée » comme repli pour l'HDV.

- [X] T015 [US3] Dans `tests/integration/hdv-page-toggle.test.tsx` : cache `{ forgemagiePage: false,
  hdvPage: false }` et lecture en échec ⇒ page masquée ; ancien cache `{ forgemagiePage: true }` et
  lecture en échec ⇒ page HDV visible ; aucun cache et lecture en échec ⇒ page visible.

---

## Phase 6: Polish

- [X] T016 Lancer `npx tsc -b --noEmit`, `npx tsc -p worker --noEmit`, `npx vitest run` (référence :
  17 échecs connus dans `fm-api.test.ts` et `hdv-page.test.tsx`) et `npx eslint src tests admin
  admin-worker worker` (référence : 0 erreur).
- [X] T017 Vérifier dans l'aperçu : réglages simulés, lien « HDV » absent et `/hdv` affichant le
  message.

---

## Dependencies & Execution Order

- T001 → T004 et T009 (schéma). T002 → T003, T004, T005 → toutes les histoires.
- US1 (T006–T010) et US2 (T011–T014) sont indépendantes après la phase 2 ; US3 (T015) suit T011–T012.
- [P] : T009 ∥ T010 ; T013 ∥ T014.

## Implementation Strategy

MVP : phases 1–3 (l'interrupteur enregistre le réglage), puis phase 4 qui le rend visible côté site ;
les deux sont livrées ensemble, car un interrupteur sans effet sur le site n'aurait pas d'intérêt.
