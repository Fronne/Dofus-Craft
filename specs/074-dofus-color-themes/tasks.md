# Tasks: Thèmes de couleurs des Dofus primordiaux

**Input**: `specs/074-dofus-color-themes/` (plan.md, spec.md, research.md, data-model.md, contracts/ui-contract.md, quickstart.md)

**Tests**: inclus, car le plan les prévoit (unit, integration, contraste, e2e).

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [ ] T001 [P] Télécharger depuis DofusDB (`https://api.dofusdb.fr/img/items/<iconId>.png`) les images `dofus-turquoise.png` (23003), `dofus-ocre.png` (23012), `dofus-ebene.png` (23007) et `dofus-ivoire.png` (23011) dans `public/`, et vérifier que `public/dofus-pourpre.png` (23001) et `public/dofus-emeraude.png` (23002) sont identiques à celles de DofusDB (sinon les remplacer).

## Phase 2: Foundational (bloque toutes les histoires)

- [ ] T002 Créer `src/domain/dofus-themes.ts` : type `DofusId` (`emeraude` | `pourpre` | `turquoise` | `ocre` | `ebene` | `ivoire`), liste `dofusThemes` dans cet ordre avec `id`, `name` (Dofus Émeraude, Dofus Pourpre, Dofus Turquoise, Dofus Ocre, Dofus Ébène, Dofus Ivoire), `dofusDbId` (737, 694, 739, 7754, 7114, 7115), `image` (`/dofus-<id>.png`) et `themeColor` ; constantes `DEFAULT_DOFUS = 'emeraude'` et `DOFUS_STORAGE_KEY = 'craftcheck-dofus'` ; fonction `readStoredDofus(storage)` qui renvoie un `id` valide, ou `emeraude` si la valeur est absente, inconnue ou si l'accès lève une erreur.
- [ ] T003 [P] Écrire `tests/unit/dofus-themes.test.ts` : six Dofus dans l'ordre, ids uniques, `readStoredDofus` avec chaque id valide, une valeur inconnue, une valeur absente et un stockage qui lève une erreur.

## Phase 3: User Story 1 — choisir un Dofus et changer les couleurs (P1) 🎯 MVP

**Goal**: cliquer sur un Dofus dans Paramètres change les couleurs du site.

**Independent Test**: dans Paramètres, cliquer sur chacun des six Dofus ; les couleurs changent à chaque clic, sur plusieurs pages, en clair et en sombre.

- [ ] T004 [P] [US1] Ajouter dans `src/styles/theme.css`, après le bloc `:root[data-theme="light"]`, les 10 blocs de palette `:root[data-dofus="pourpre|turquoise|ocre|ebene|ivoire"]` (sombre) et `:root[data-dofus="…"][data-theme="light"]` (clair). Chaque bloc redéfinit seulement les jetons de research.md §2 : `--accent`, `--accent-bright`, `--accent-gradient-from/to`, `--on-accent`, `--success`, `--bg`, `--panel`, `--panel-strong`, `--panel-soft`, `--nav-bg`, `--bg-glow`, `--border`, `--border-control`, `--input-bg`, `--button-bg`, `--image-bg`, `--inner-bg`, `--scrim`, textes, et `--link` pour turquoise. Jamais `--kamas`, `--exo`, `--warning`, `--danger`. Le bloc `:root` actuel (émeraude) ne change pas.
- [ ] T005 [US1] Étendre `tests/unit/theme-contrast.test.ts` : en plus de `sombre` et `clair`, tester les 10 palettes de Dofus (fusionner `:root`, puis le bloc `:root[data-dofus="x"]`, puis pour le clair `:root[data-theme="light"]` et `:root[data-dofus="x"][data-theme="light"]`), avec les mêmes paires et minimums (texte 4,5:1, formes 3:1) ; ajuster les couleurs de T004 jusqu'à ce que tout passe.
- [ ] T006 [US1] Créer `src/app/useDofusTheme.ts` : hook qui lit `readStoredDofus(window.localStorage)` à l'initialisation, renvoie `[dofus, setDofus]`, et dans un effet pose `document.documentElement.dataset.dofus` (supprime l'attribut pour `emeraude`) et écrit `craftcheck-dofus` dans `localStorage` (try/catch).
- [ ] T007 [US1] Créer `src/features/settings/DofusPicker.tsx` : six `<button type="button">` selon `contracts/ui-contract.md` §1 (image `alt=""` avec `width`/`height`, nom visible, `aria-pressed`, classe `selected` pour l'actif), props `dofus` et `setDofus`. Ajouter ses styles dans `src/styles/global.css`, avec jetons uniquement, calés sur `.settings-choice`.
- [ ] T008 [US1] Modifier `src/features/settings/ParametresPage.tsx` : nouvelles props `dofus` et `setDofus` ; section « Dofus » (titre `h2`, description « Choisissez le Dofus dont le site prend les couleurs. ») placée après la section « Thème ». Modifier `src/app/AppShell.tsx` : appeler `useDofusTheme` et passer `dofus`/`setDofus` à `ParametresPage`.
- [ ] T009 [US1] Mettre à jour `tests/integration/settings-style.test.tsx` (nouvelles props obligatoires) et créer `tests/integration/settings-dofus.test.tsx` : six boutons dans l'ordre, émeraude `aria-pressed="true"` par défaut, un clic appelle `setDofus` avec l'id et un clic sur pourpre pose `data-dofus="pourpre"` sur `<html>` via le hook.

**Checkpoint**: US1 complète et testable seule.

## Phase 4: User Story 2 — l'icône suit le Dofus (P1)

**Goal**: icône de navigation et icône d'onglet = Dofus choisi.

**Independent Test**: choisir chaque Dofus et vérifier l'icône de la barre de navigation et l'icône d'onglet.

- [ ] T010 [US2] Dans `src/app/AppShell.tsx`, remplacer le `src="/dofus-emeraude.png"` de `.app-nav-brand-mark` par l'image du Dofus actif (`dofusThemes`), avec repli sur l'émeraude si l'image échoue (`onError`).
- [ ] T011 [US2] Dans `src/app/useDofusTheme.ts`, mettre aussi à jour `link[rel="icon"]` (`href` = image du Dofus) et `meta[name="theme-color"]` (`themeColor`) à chaque changement ; `apple-touch-icon` et `og-image` ne bougent pas.
- [ ] T012 [P] [US2] Ajouter dans `tests/integration/settings-dofus.test.tsx` un test : après un clic sur ocre, l'icône de navigation et `link[rel="icon"]` pointent sur `/dofus-ocre.png`.

**Checkpoint**: US1 et US2 fonctionnent ensemble.

## Phase 5: User Story 3 — le choix est conservé (P2)

**Goal**: choix retrouvé au rechargement, sans flash.

**Independent Test**: choisir turquoise, recharger : site turquoise dès le premier affichage.

- [ ] T013 [US3] Ajouter dans `index.html`, dans `<head>` avant les styles, un script synchrone (en ligne, dans un `try/catch`) qui lit `craftcheck-dofus`, et si la valeur est l'un des cinq id hors émeraude, pose `document.documentElement.dataset.dofus`, met à jour `link[rel="icon"]` et `meta[name="theme-color"]`. L'`id` → `href` / couleur est écrit en dur dans le script (dupliqué de `dofus-themes.ts`, avec un commentaire qui le dit).
- [ ] T014 [US3] Créer `tests/e2e/dofus-theme.spec.ts` (Playwright, sur le modèle de `tests/e2e/catalogue-responsive.spec.ts`) : choisir turquoise dans Paramètres, recharger, vérifier `data-dofus="turquoise"` dès le chargement et l'icône ; une valeur inconnue dans `localStorage` donne l'émeraude (pas d'attribut).
- [ ] T015 [P] [US3] Ajouter à `tests/unit/dofus-themes.test.ts` un test qui lit `index.html` et vérifie que ses cinq id, chemins d'icône et couleurs correspondent à `dofusThemes`.

**Checkpoint**: les trois histoires fonctionnent.

## Phase 6: Polish

- [ ] T016 [P] Mettre à jour `DESIGN.md` §2 (nouveau paragraphe « Thèmes de Dofus » : `data-dofus`, jetons redéfinis, jetons jamais redéfinis, règle des contrastes) et la mention du halo du logo.
- [ ] T017 Lancer `npm run test`, `npm run build` et le lint du projet ; corriger les erreurs.
- [ ] T018 Vérifier dans le navigateur (serveur de dev) le parcours de `quickstart.md`, six Dofus × clair/sombre, captures à l'appui, sur ordinateur et mobile (375 px).

## Dépendances

- T001 → T010 (images). T002 → T003, T006, T007, T013, T015.
- US1 : T004 → T005 ; T006, T007 → T008 → T009.
- US2 dépend de T006 et T008 (T010, T011) ; US3 dépend de T002 (T013) ; polish après tout.
- Parallèles : T001 ∥ T002 ; T003 ∥ T004 ; T012 ∥ T011 ; T015 ∥ T014 ; T016 ∥ T017.

## Stratégie

MVP = Phase 1 + 2 + US1 (changement de couleurs), puis US2 (icône), puis US3 (mémorisation sans flash). Livraison unique à la fin, comme demandé : commit, push, déploiement.
