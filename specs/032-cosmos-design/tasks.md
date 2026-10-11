---

description: "Task list for the Cosmos design"
---

# Tasks: Design « Cosmos » au choix

**Input**: Design documents from `specs/032-cosmos-design/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/design-attribute.md

**Tests**: tests ciblés (préférence, réglage, portée CSS), sur le modèle de specs/012.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [x] T001 Ajouter la dépendance `@fontsource-variable/nunito` dans package.json (et package-lock.json via `npm install`)

## Phase 2: Foundational

- [x] T002 Ajouter `{ id: 'cosmos', label: 'Cosmos' }` à `designs` et `'cosmos'` au type `DesignId` dans src/domain/designs.ts (commentaire specs/032)
- [x] T003 Faire poser `data-design` sur `<html>` pour toute valeur autre que `classic` (`modern` ou `cosmos`) dans `applyDesign` de src/persistence/design-preference.ts ; le défaut reste `'modern'`
- [x] T004 Créer src/styles/design-cosmos.css (en-tête de commentaire specs/032, `@import '@fontsource-variable/nunito'`) et l'importer après design-modern.css dans src/main.tsx

**Checkpoint**: choisir Cosmos pose `data-design="cosmos"` ; aucune règle encore.

## Phase 3: User Story 1 - Choisir le design Cosmos (P1) 🎯 MVP

**Goal**: toute l'application prend l'allure Cosmos, en sombre et en clair, avec chaque couleur principale.

**Independent Test**: Paramètres → Cosmos, puis parcourir toutes les pages ; tout fonctionne comme avant.

- [x] T005 [P] [US1] Étendre tests/unit/design-preference.test.ts : `setDesignId('cosmos')` est mémorisé, `applyDesign('cosmos')` pose `data-design="cosmos"`, retour à `classic` l'enlève
- [x] T006 [P] [US1] Étendre tests/integration/design-setting.test.tsx : le réglage propose « Cosmos » ; un clic l'active (`aria-pressed`), pose `data-design="cosmos"` et le mémorise
- [x] T007 [P] [US1] Créer tests/unit/design-cosmos-css-scope.test.ts : chaque sélecteur de src/styles/design-cosmos.css commence par `:root[data-design="cosmos"]` et la feuille ne redéfinit ni `--slot-*` ni `--image-bg`
- [x] T008 [US1] Jetons Cosmos sombres (bleu nuit, police Nunito, ombres longues, fond nébuleuse étoilée fixe sur la racine, barres de défilement ardoise) et nuances `--gold`/`--gold-bright` par `data-accent` dans src/styles/design-cosmos.css
- [x] T009 [US1] Variante claire lavande `:root[data-design="cosmos"][data-theme="light"]` (jetons + accents) dans src/styles/design-cosmos.css
- [x] T010 [US1] Fenêtres : `.panel`, `.card`, `.result`, dialogues et bulles (dégradé, liseré clair, bord sombre, ombre) ; `.card > h2:first-child` en barre de titre bombée centrée ; `.page-header` dans src/styles/design-cosmos.css
- [x] T011 [US1] Navigation : `.app-nav` en fenêtre, `.app-nav-link` en lignes capitales avec case d'icône, état `.active` en vert-jaune ; barre d'onglets mobile ; sélecteur de serveur dans src/styles/design-cosmos.css
- [x] T012 [US1] Contrôles : champs et `select` creusés ; `.btn-secondary`, `.icon-button`, `.settings-choice`, `.reset-filters`, onglets HDV biseautés en petites capitales ; `.btn-primary` et `.pin-item-button` hexagonaux ; états sélectionnés en liseré d'accent + halo dans src/styles/design-cosmos.css
- [x] T013 [US1] Listes : `.results button`, `.profit-row`, `.hdv-row`, `.pinned-card`, `.pinned-preview-card`, `.price-line`, `.ingredient-row`, `.server-onboarding-option` en lignes bombées ; zones creusées (`.item-stats`, `.filters-panel`, `.market-price-summary`) ; jauges (`.verdict-bar-track/fill`, `.level-slider-*`) ; niveaux en texte doré (`.result-item-level`, `.pinned-card-level`) dans src/styles/design-cosmos.css
- [x] T014 [US1] Écran de choix du serveur, bannière d'information, visite guidée, compteur de donjon, tuiles de statistiques, états vides et squelettes dans src/styles/design-cosmos.css

**Checkpoint**: Cosmos utilisable partout.

## Phase 4: User Story 2 - Recherche sur trois colonnes (P2)

**Goal**: résultats, fiche et ressources côte à côte sur la hauteur de l'écran, listes défilantes.

**Independent Test**: écran ≥ 1200 px, objet à longue recette : trois fenêtres visibles, chaque liste défile seule.

- [x] T015 [US2] Règle `@media (min-width: 1200px)` : `.app-page:has(> .search-panel)` en grille 3 colonnes à hauteur d'écran, `.grid` en `display: contents`, placement de `.search-panel` (col. 1), messages + `.market-price-panel` + `.item-detail-card` (col. 2), carte `[data-tour="resource-prices"]` (col. 3), défilement interne et titres collants, dans src/styles/design-cosmos.css
- [x] T016 [US2] Sous 1200 px : vérifier l'empilement dans le même ordre, sans défilement horizontal (aucune règle de colonnes) dans src/styles/design-cosmos.css

## Phase 5: User Story 3 - Revenir à un autre design (P3)

- [x] T017 [US3] Vérifier que tests/integration/design-setting.test.tsx couvre le retour de Cosmos vers Nouveau et Classique (attribut mis à jour ou retiré)

## Phase 6: Polish

- [x] T018 Lancer `npm run typecheck`, `npm run lint`, `npm test` et corriger
- [x] T019 Vérifier visuellement (quickstart.md) Recherche, Rentabilité, Paramètres en Cosmos sombre et clair, bureau et mobile ; corriger les débordements
- [x] T020 Mentionner Cosmos dans README.md si les designs y sont décrits

## Dependencies & Execution Order

- Phase 1 → Phase 2 → US1 (T008–T014 sur le même fichier, séquentiels) → US2 → US3 → Polish.
- T005, T006, T007 sont parallélisables entre eux (fichiers distincts).

## Parallel Example: User Story 1

```text
T005 tests/unit/design-preference.test.ts
T006 tests/integration/design-setting.test.tsx
T007 tests/unit/design-cosmos-css-scope.test.ts
```

## Implementation Strategy

MVP = Phases 1–3 (Cosmos choisissable et appliqué partout). US2 ajoute la disposition Recherche ;
US3 et Polish valident le retour et la qualité.
