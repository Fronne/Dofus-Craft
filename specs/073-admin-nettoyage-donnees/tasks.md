# Tâches : Nettoyage des données depuis la page d'administration

**Entrée** : `specs/073-admin-nettoyage-donnees/` (spec.md, plan.md, research.md, data-model.md,
contracts/admin-data-api.md, quickstart.md)

**Tests** : demandés — la constitution (principe II) exige des tests sur les règles explicites (plafond,
liste blanche, comptage).

**Format** : `- [ ] Txxx [P?] [USn?] Description avec chemin de fichier` — `[P]` = parallélisable
(fichiers différents, sans dépendance non terminée).

## Phase 1 : Mise en place (base de données)

- [x] T001 Créer `worker/migrations/0025_add_admin_cleanup_log.sql` : table `admin_cleanup_log` (`id INTEGER PRIMARY KEY AUTOINCREMENT`, `deleted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))`, `table_id TEXT NOT NULL`, `mode TEXT NOT NULL CHECK (mode IN ('selection','duration'))`, `filter_text TEXT NOT NULL DEFAULT ''`, `row_count INTEGER NOT NULL CHECK (row_count > 0)`) et index `idx_admin_cleanup_log_deleted_at (deleted_at)`, avec un en-tête dans le style de `0024_add_contribution_item_type.sql` (ordre : appliquer AVANT de déployer le Worker admin)
- [x] T002 Ajouter la même table et le même index à `worker/schema.sql` (avec un commentaire `specs/073-admin-nettoyage-donnees`)
- [x] T003 Ajouter le script `worker:db:migrate-cleanup-log` à `package.json` (même forme que `worker:db:migrate-item-type`, fichier `0025_add_admin_cleanup_log.sql`)
- [x] T004 [P] Étendre `tests/unit/worker-schema.test.ts` : colonnes de `admin_cleanup_log` et refus d'un `mode` inconnu ou d'un `row_count` ≤ 0 ; la migration 0025 rejouée donne la même table que `schema.sql`

## Phase 2 : Fondations (bloque toutes les histoires)

- [x] T005 Créer `admin-worker/src/data-cleanup.ts` : types `Statement`/`CleanupDb` (comme `sniffer-keys.ts`, avec `batch`), registre `CLEANUP_TABLES` des trois tables (`brisage-coefficients` : clé `id`, date `noted_at`, filtre `server` ; `prix-communaute` : clé `id`, date `created_at`, filtres `server` et `origin` ; `prix-externes` : clé `rowid`, date `fetched_at`, filtre `server`), colonnes affichées selon `research.md` R8 — jamais `device_id` —, constantes `MAX_ROWS = 500`, `LIST_LIMIT = 50`, `DURATIONS = {'10m','1h','24h'}`, et `validateFilters(table, query)` : `server` doit valoir `[a-z0-9_-]{1,40}`, `origin` ∈ `manual|capture|bot|sniffer` et seulement pour `prix-communaute`, sinon erreur `{ error, field }`
- [x] T006 [P] Étendre `admin/admin-api.ts` : types `CleanupTable`, `CleanupRow`, `CleanupLogEntry`, gardes de type `isCleanupOverview` / `isCleanupRows` (comme `isSnifferKey`), et les appels `adminApi.getCleanup()`, `listCleanupRows(table, filters)`, `countCleanup(table, since, filters)`, `deleteCleanup(table, body)` (le 409 et le 422 doivent revenir comme `invalid` avec le message du serveur — voir T017)
- [x] T007 [P] Ajouter la section `donnees` : `SectionId` et `SECTIONS` (`{ id: 'donnees', title: 'Nettoyage des données' }`) dans `admin/dashboard-summary.ts`, résumé statique « Supprimer des lignes récentes » (`ok(...)`) dans `admin/Dashboard.tsx` (valeur initiale + remplissage), et mettre à jour `tests/unit/admin-dashboard-summary.test.ts` (7 sections, `parseSection('#donnees')`)
- [x] T008 Câbler `admin/AdminPage.tsx` : `{section === 'donnees' && <DataCleanupEditor />}` (import de `./DataCleanupEditor`, composant créé en T012) et ajouter dans `admin/admin.css` les styles de base du tableau (`.cleanup-table`, `.cleanup-confirm`) dans le style des panneaux existants

**Point de contrôle** : le type-check passe quand T012 existe ; les tâches de story peuvent démarrer.

## Phase 3 : Histoire 1 — Voir et supprimer les dernières lignes (Priorité P1) 🎯 MVP

**Objectif** : choisir une table, voir ses 50 plus récentes lignes, en supprimer une sélection après confirmation.

**Test indépendant** : ajouter trois coefficients, cocher les deux plus récents, confirmer ; seuls ces deux disparaissent.

### Tests

- [x] T009 [P] [US1] Créer `tests/unit/admin-data-cleanup.test.ts` (D1 simulé `createTestD1`, `handleApi` avec le vérificateur propriétaire, comme `admin-activity.test.ts`) : GET `/api/data` liste les 3 tables ; GET `/api/data/brisage-coefficients` renvoie au plus 50 lignes, la plus récente d'abord ; filtre `server` et filtre `origin` (prix communauté) ; `origin` sur les coefficients → 400 ; table inconnue → 404 ; `device_id` absent de toutes les réponses ; DELETE `{keys}` supprime exactement les clés données, ignore une clé déjà disparue (`deleted` = réel) ; 501 clés → 422 sans rien supprimer ; 0 clé ou doublon → 400 ; non-propriétaire → 403 ; `external_prices` supprimé par `rowid`
- [x] T010 [P] [US1] Créer `tests/integration/admin-data-cleanup.test.tsx` (comme `admin-page.test.tsx`, `fetch` simulé) : l'onglet affiche les lignes ; bouton « Supprimer la sélection » désactivé sans case cochée ; cocher 2 lignes → zone « Supprimer 2 lignes ? » ; Annuler n'appelle pas DELETE ; Confirmer appelle DELETE avec les 2 clés puis recharge la liste ; table vide → « Aucune ligne » sans bouton de suppression

### Implémentation

- [x] T011 [US1] Dans `admin-worker/src/data-cleanup.ts` : `describeTables()`, `listRows(db, tableId, filters)` (requête paramétrée, `ORDER BY dateColumn DESC LIMIT 50`, colonnes du registre seulement, `key` = clé en texte) et `deleteByKeys(db, tableId, keys)` (validation 1–500 clés uniques de 1–64 caractères, paquets de 90 dans un `db.batch`, total = somme des `changes`)
- [x] T012 [US1] Créer `admin/DataCleanupEditor.tsx` : sélecteur de table, filtres selon `filters` de la table, tableau avec cases à cocher et date en `Intl.DateTimeFormat('fr-FR', …, timeZone 'Europe/Paris')`, bouton « Supprimer la sélection », zone de confirmation en ligne (« Supprimer N lignes ? Confirmer / Annuler », `role="alertdialog"`), états chargement / erreur avec `failureMessage` et « Réessayer », message « N lignes supprimées », « Aucune ligne » (modèle : `SnifferKeysEditor.tsx`)
- [x] T013 [US1] Dans `admin-worker/src/index.ts` : ajouter `CleanupDb` au type `Env.DB`, routes `GET /api/data`, `GET /api/data/:table`, `DELETE /api/data/:table` (corps `{keys}`), validation → 400 `{error, field}`, table inconnue → 404, dépassement → 422 (contrat `admin-data-api.md`)

**Point de contrôle** : T009 et T010 passent ; l'histoire 1 se démontre seule.

## Phase 4 : Histoire 2 — Supprimer tout ce qui est récent (Priorité P2)

**Objectif** : aperçu du nombre exact puis suppression de tout ce qui est plus récent que 10 min / 1 h / 24 h.

**Test indépendant** : lignes d'âges variés, « 1 heure » → l'aperçu annonce le nombre de la dernière heure, la confirmation ne supprime que celles-ci.

### Tests

- [x] T014 [P] [US2] Étendre `tests/unit/admin-data-cleanup.test.ts` (horloge figée avec `vi.useFakeTimers({ toFake: ['Date'] })`) : GET `/count` pour `10m`, `1h`, `24h` (bornes incluses/exclues) avec et sans filtre ; durée inconnue → 400 ; DELETE `{since, expectedCount}` supprime exactement les lignes du filtre ; `expectedCount` différent → 409 sans suppression ; 501 lignes → 422 sans suppression ; exactement 500 lignes → supprimées ; `expectedCount` manquant → 400
- [x] T015 [P] [US2] Étendre `tests/integration/admin-data-cleanup.test.tsx` : choisir une durée appelle `/count` et affiche « Supprimer 37 lignes des dernières 24 h ? » ; Annuler ne supprime rien ; Confirmer envoie `{since, expectedCount: 37, filtres}` ; réponse 422 → message « affinez » et rien ne change ; aperçu à 0 → « Aucune ligne » sans confirmation

### Implémentation

- [x] T016 [US2] Dans `admin-worker/src/data-cleanup.ts` : `sinceLimit(duration, now)` (ISO UTC), `countRecent(db, tableId, duration, filters)` (`COUNT(*)` paramétré) et `deleteRecent(db, tableId, duration, filters, expectedCount)` : recompte, refuse si > 500 (422) ou ≠ `expectedCount` (409), puis `DELETE … WHERE clé IN (SELECT clé … WHERE date >= ? [filtres] LIMIT 500)`
- [x] T017 [US2] Dans `admin-worker/src/index.ts` : route `GET /api/data/:table/count` et corps `{since, expectedCount, server?, origin?}` pour `DELETE /api/data/:table` ; réponses 409/422 avec `{error, count}` ; dans `admin/admin-api.ts`, faire remonter ces erreurs comme `invalid` (message du serveur) sans les confondre avec `unavailable`
- [x] T018 [US2] Dans `admin/DataCleanupEditor.tsx` : boutons de durée « 10 minutes / 1 heure / 24 heures » (appel `countRecent`), zone de confirmation avec le nombre exact, envoi de `expectedCount`, message de refus > 500 invitant à choisir une durée plus courte ou un filtre

**Point de contrôle** : T014 et T015 passent ; US1 et US2 fonctionnent ensemble.

## Phase 5 : Histoire 3 — Trace des suppressions (Priorité P3)

**Objectif** : chaque suppression réussie laisse une trace relisible dans l'onglet.

**Test indépendant** : supprimer des lignes, vérifier l'entrée (heure, table, nombre, mode, filtre).

### Tests

- [x] T019 [P] [US3] Étendre `tests/unit/admin-data-cleanup.test.ts` : une suppression par sélection écrit une entrée `mode: 'selection'` avec le nombre réel ; une suppression par durée écrit `mode: 'duration'` et un `filter` lisible (« durée 1h · serveur mikhal · origine sniffer ») ; 0 ligne supprimée, 409, 422, 400 → aucune entrée ; `GET /api/data` renvoie au plus 20 entrées, la plus récente d'abord ; échec d'écriture de la trace (table absente simulée) → suppression conservée et `logged: false`
- [x] T020 [P] [US3] Étendre `tests/integration/admin-data-cleanup.test.tsx` : la trace s'affiche sous le tableau (heure, nom lisible de la table, nombre, mode, filtre) et se recharge après une suppression ; liste vide → « Aucune suppression pour l'instant »

### Implémentation

- [x] T021 [US3] Dans `admin-worker/src/data-cleanup.ts` : `writeLog(db, entry)` (insertion paramétrée dans `admin_cleanup_log`, appelée seulement si `deleted > 0`, erreur avalée → `logged: false`), `filterText(...)`, `readLog(db)` (20 dernières) ; brancher `deleteByKeys` / `deleteRecent` et `describeTables()` (`log` dans `GET /api/data`) ; renvoyer `{ deleted, logged }`
- [x] T022 [US3] Dans `admin/DataCleanupEditor.tsx` : section « Dernières suppressions » (modèle de liste de `SnifferKeysEditor`), rechargée après chaque suppression

## Phase 6 : Finition et vérifications transverses

- [x] T023 Lancer `npm run test`, `npm run typecheck`, `npm run lint` ; corriger les écarts
- [x] T024 [P] Vérifier à la main le déroulé de `specs/073-admin-nettoyage-donnees/quickstart.md` sur le serveur de dev (admin) et donner l'URL de test à l'utilisateur
- [x] T025 [P] Documenter dans `admin-worker/` ou `worker/README.md` (section existante des migrations) la migration 0025 et son ordre (avant le déploiement du Worker admin), en cohérence avec `worker/README.md`
- [x] T026 Lancer le sous-agent `relecteur` sur les changements et corriger les points graves

## Dépendances et ordre d'exécution

- **Phase 1** → **Phase 2** → histoires. T005 (registre) précède T011, T016, T021 ; T012 précède le contrôle de type de T008.
- **US1** est le MVP ; **US2** réutilise le registre, la route DELETE et le composant d'US1 (T016–T018 étendent T011–T013) ; **US3** étend les deux suppressions (T021 touche T011 et T016).
- Ordre conseillé : P1 → P2 → P3 (les trois modifient `data-cleanup.ts`, `index.ts` et `DataCleanupEditor.tsx` : pas de parallélisme entre histoires).
- **Parallélisables** : T004 ; T006 + T007 ; T009 + T010 ; T014 + T015 ; T019 + T020 ; T024 + T025.

## Stratégie de livraison

1. **MVP** : Phases 1, 2 et 3 — l'onglet liste et supprime une sélection ; déployable seul (après la migration).
2. Ajouter US2 (suppression par durée), puis US3 (trace) ; chaque étape reste testable seule.
3. Finition : tests complets, quickstart, relecture.
