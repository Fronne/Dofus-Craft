---
description: "Tâches de la fonctionnalité 054 — page Rentabilité déjà prête à l'arrivée"
---

# Tasks: Page Rentabilité déjà prête à l'arrivée

**Input**: Design documents from `specs/054-rentabilite-prechargee/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui-rentabilite.md

**Tests**: inclus — la constitution (principe II) exige des tests automatiques pour tout changement
touchant les résultats affichés, et quickstart.md les liste.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

Aucune tâche : aucune dépendance ni configuration nouvelle.

---

## Phase 2: Foundational

- [X] T001 [P] Créer `src/persistence/craft-profits-cache.ts` : `readKeptCraftProfits(serverId, mode)` → `{ computedAt, rows } | undefined` et `keepCraftProfits(serverId, mode, rows, computedAt)`, clé `craftcheck-craft-profits:<serverId>:<mode>`, entrée `{ formatVersion: 1, computedAt, rows }` ; rejeter si « `formatVersion` doit valoir `1` », si `computedAt` est invalide ou de « plus de 7 jours », ou si une ligne n'a pas « `item.id`, `item.name`, `marketPriceKamas`, `craftCostKamas`, `profitKamas` » (chaînes / nombres) ; toute exception de `localStorage` est ignorée (research.md §1-§2)
- [X] T002 [P] Tests unitaires de ce module dans `tests/unit/craft-profits-cache.test.ts` : aller-retour, clé par serveur + mode (pas de mélange), format différent ignoré, plus de 7 jours ignoré, ligne mal formée ignorée, `localStorage` qui lève une exception (lecture et écriture) sans erreur

**Checkpoint**: la liste gardée peut être lue et écrite de façon sûre.

---

## Phase 3: User Story 1 - La liste de la visite précédente s'affiche tout de suite (Priority: P1) 🎯 MVP

**Goal**: à l'ouverture de la page, la dernière liste complète gardée s'affiche aussitôt avec une
mention datée, puis est remplacée en une fois par la liste à jour.

**Independent Test**: calculer la liste, recharger, rouvrir Rentabilité : liste immédiate avec
« Liste du … — mise à jour en cours… », remplacée à la fin du calcul.

### Tests for User Story 1

- [X] T003 [P] [US1] Dans `tests/integration/prices-page.test.tsx`, ajouter : (a) une liste gardée dans `localStorage` pour `mikhal` + mode actif s'affiche sans « Calcul en cours » avec la mention « Liste du JJ/MM à HH:MM — mise à jour en cours… », puis la mention disparaît et les lignes à jour (valeurs du calcul) remplacent les gardées ; (b) après un calcul complet, la liste est enregistrée dans `localStorage` ; (c) en mode communautaire avec `getSharedItemPrices` indisponible, la liste gardée reste avec « mise à jour impossible pour le moment » ; (d) la liste gardée de l'autre mode n'est jamais affichée ; (e) la recherche dans la liste fonctionne pendant la mise à jour et reste appliquée après le remplacement

### Implementation for User Story 1

- [X] T004 [US1] Dans `src/features/prices/useCraftProfits.ts` : ajouter `keptAt?: string` et `refreshFailed?: boolean` à `CraftProfitsState` ; dans `startRun.publish`, à l'état `ready`, appeler `keepCraftProfits(serverId, priceMode, state.rows, new Date().toISOString())` ; dans `useCraftProfits`, état initial et `cached` = liste de la visite (mémoire) › liste gardée (`readKeptCraftProfits`, `{ status: 'ready', rows, done: rows.length, total: rows.length, keptAt: computedAt }`) › `run.latest` › `INITIAL` ; le listener ne remplace une liste affichée que par l'état `ready` final (qui n'a pas de `keptAt`) et, sur `unavailable`, garde la liste gardée en posant `refreshFailed: true` (research.md §3-§4, data-model.md)
- [X] T005 [US1] Dans `src/features/prices/PricesPage.tsx`, afficher à la place de « Calcul en cours… » la mention du contrat `contracts/ui-rentabilite.md` quand `keptAt` est présent (`role="status"`, date `fr-FR` jour/mois et heures:minutes ; texte « mise à jour en cours… » ou « mise à jour impossible pour le moment. » selon `refreshFailed`)
- [X] T006 [P] [US1] Style discret de la mention (classe réutilisée de `.empty` ou nouvelle classe `profit-kept-note`) dans `src/styles/global.css`, cohérent clair / sombre

**Checkpoint**: US1 fonctionne seule : la liste gardée s'affiche tout de suite et se met à jour.

---

## Phase 4: User Story 2 - La préparation démarre dès l'ouverture et avance plus vite (Priority: P2)

**Goal**: la préparation en fond part dès que le catalogue est prêt et va jusqu'à 4 chargements
simultanés, en cédant la main au navigateur entre deux chargements.

**Independent Test**: ouvrir le site sur Recherche, attendre ~10 s, ouvrir Rentabilité : liste à jour
sans progression.

### Tests for User Story 2

- [X] T007 [P] [US2] Dans `tests/unit/craft-profits-preload.test.ts` : remplacer « at most 2 » par « at most 4 item loads at a time in the background » (8 candidats, pic ≤ 4 et > 2) ; ajouter « starts as soon as the catalogue is ready, without waiting for an idle period » (`requestIdleCallback` qui ne rappelle jamais avec un `timeout` ≥ 1000 → le calcul démarre quand même) ; ajouter « also starts when a kept list exists » (liste gardée dans `localStorage` → `listAllForServer` appelé)

### Implementation for User Story 2

- [X] T008 [US2] Dans `src/features/prices/useCraftProfits.ts`, `preloadCraftProfits` : lancer `begin` directement après `whenCatalogueReady()` (supprimer `requestIdleCallback` / `setTimeout(2000)` et leur annulation ; garder `stopped`) ; `BACKGROUND_CONCURRENCY = 4` ; dans `compute`, avant chaque chargement d'objet en fond (`!run.foreground`), céder la main via `requestIdleCallback(…, { timeout: 200 })` avec repli `setTimeout(0)` (research.md §5-§6) ; mettre à jour les commentaires spec 021 concernés

**Checkpoint**: US1 et US2 fonctionnent ensemble.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T009 [P] Ajouter une section « Révision (2026-10-14) : liste gardée et départ immédiat (specs/054-rentabilite-prechargee) » à la fin de `specs/021-background-data-loading/spec.md` (FR-006 sans attente d'inactivité, 4 simultanés, liste gardée d'une visite à l'autre remplaçant l'hypothèse « pas gardée »)
- [X] T010 Lancer `npx vitest run`, `npx tsc -b` et `npx eslint .` ; tout doit passer
- [X] T011 Vérification dans le navigateur selon `quickstart.md` (étapes 1, 2, 4)

---

## Dependencies & Execution Order

- T001 → T004 (US1 dépend du module de stockage) ; T002 en parallèle de T001.
- T004 → T005 ; T006 parallèle.
- US2 (T007-T008) est indépendante de US1 hormis le fichier partagé `useCraftProfits.ts` : faire T008
  après T004 pour éviter les conflits d'édition.
- Polish après les deux histoires.

## Parallel Example

```text
T001 (module) ‖ T002 (tests du module)
T003 (tests intégration US1) ‖ T006 (style) ‖ T007 (tests préchargement US2)
```

## Implementation Strategy

MVP = Phase 2 + US1 (plus gros gain, dès la deuxième visite). Puis US2 pour que la liste à jour soit
elle aussi prête à l'arrivée.
