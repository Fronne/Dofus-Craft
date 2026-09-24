# Tasks: Nouveau design « Moderne épuré » au choix

**Input**: Documents de conception de `specs/012-modern-design/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/design-setting-ui.md, quickstart.md

**Tests**: inclus (plan.md) : préférence, invariant de portée de la feuille de style, réglage dans
Paramètres, comparaison de captures du « Classique » avant/après.

**Organization**: tâches groupées par user story.

## Format: `[ID] [P?] [Story] Description`

- **[P]** : parallélisable (fichiers différents, pas de dépendance sur une tâche inachevée)
- **[Story]** : US1 (essayer le nouveau design), US2 (revenir à l'ancien)

---

## Phase 1: Setup

- [X] T001 Capturer les captures de référence du design actuel AVANT toute modification, avec un script Playwright placé dans le scratchpad (pas dans le dépôt), sur le serveur de dev : pages Choix du serveur, Accueil, Recherche (objet sélectionné), Épinglés, Prix, Paramètres ; en 1366×820 et 375×740 ; en thème sombre et clair ; appels à l'API communautaire interceptés et `craftcheck-search-tour-seen = "1"`. Enregistrer les PNG dans le scratchpad (`shots/baseline/`) pour SC-002.
- [X] T002 Ajouter la dépendance `@fontsource-variable/inter` avec `npm install` (met à jour `package.json` et `package-lock.json`) ; vérifier que le paquet fournit la famille « Inter Variable » (research.md §3).

---

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T003 [P] Créer `src/domain/designs.ts` sur le modèle de `src/domain/accent-colors.ts` : type `DesignId = 'classic' | 'modern'`, liste `designs = [{ id: 'classic', label: 'Classique' }, { id: 'modern', label: 'Nouveau' }]`, `isKnownDesignId(value: string): value is DesignId`.
- [X] T004 [P] Créer `src/persistence/design-preference.ts` sur le modèle de `src/persistence/accent-color-preference.ts` : clé `craftcheck-design` ; `getDesignId(): DesignId` renvoie `'classic'` quand la clé est absente, la valeur inconnue ou le stockage indisponible (FR-004) ; `setDesignId(id)` écrit la valeur (dans `try/catch`, sans lever) ; `applyDesign(id)` pose `data-design="modern"` sur `document.documentElement` pour `modern` et retire l'attribut pour `classic`.
- [X] T005 [P] Écrire `tests/unit/design-preference.test.ts` : défaut `classic` (clé absente, valeur inconnue, `getItem` qui lève) ; `setDesignId('modern')` puis `getDesignId()` → `modern` ; `applyDesign('modern')` pose l'attribut, `applyDesign('classic')` le retire.
- [X] T006 Dans `src/main.tsx`, appeler `applyDesign(getDesignId())` avant `createRoot(...).render(...)` pour que l'écran de choix du serveur et la première page s'affichent directement dans le bon design (FR-003, research.md §4).
- [X] T007 Dans `src/app/AppShell.tsx`, ajouter l'état `design` initialisé par `getDesignId()`, et un `useEffect` qui appelle `applyDesign(design)` et `setDesignId(design)`, sur le modèle de `accentColor` ; passer `design` et `setDesign` à `ParametresPage`.

**Checkpoint**: préférence et attribut en place, sans effet visible (aucune feuille « Nouveau » encore).

---

## Phase 3: User Story 1 - Essayer le nouveau design (Priority: P1) 🎯 MVP

**Goal**: choisir « Nouveau » dans Paramètres change immédiatement toute l'application.

**Independent Test**: Paramètres → « Nouveau », puis parcourir toutes les pages (quickstart.md 1 à 4).

### Tests for User Story 1

- [X] T008 [P] [US1] Écrire `tests/integration/design-setting.test.tsx` (App rendue comme dans `tests/integration/price-mode-settings.test.tsx`) : la section « Design » propose « Classique » et « Nouveau », « Classique » `aria-pressed="true"` par défaut ; clic sur « Nouveau » → `document.documentElement.dataset.design === 'modern'` et `localStorage['craftcheck-design'] === 'modern'`, sans rechargement.
- [X] T009 [P] [US1] Écrire `tests/unit/design-modern-css-scope.test.ts` : lire `src/styles/design-modern.css` (via `fs`), retirer les commentaires, et vérifier que chaque sélecteur de règle (hors `@media`, `@supports`, `@keyframes` et leurs étapes `from`/`to`/`%`) commence par `:root[data-design="modern"]` — l'invariant qui garantit le « Classique » inchangé (FR-005, contrat).

### Implementation for User Story 1

- [X] T010 [US1] Ajouter la section « Design » en tête de `src/features/settings/ParametresPage.tsx`, avant « Thème » : titre « Design », description « Essayez le nouveau design, ou revenez au design classique à tout moment. », deux boutons `settings-choice` générés depuis `designs`, `aria-pressed` sur le choix actif (contracts/design-setting-ui.md).
- [X] T011 [US1] Créer `src/styles/design-modern.css` — variables : sous `:root[data-design="modern"]`, importer la police (`@import '@fontsource-variable/inter'` en tête de fichier, hors préfixe car c'est une déclaration `@font-face` qui ne télécharge rien tant qu'aucune règle ne l'utilise) ; `font-family: 'Inter Variable', <pile actuelle>` ; rayons plus grands (`--radius-sm` .625rem, `--radius-md` 1rem, `--radius-lg` 1.375rem) ; ombres plus douces et plus diffuses en sombre et en clair (`:root[data-design="modern"][data-theme="light"]`) ; fond de page avec dégradés doux basés sur `--gold` ; `--panel-gradient` légèrement dégradé. Ne jamais redéfinir `--slot-*` ni `--image-bg` (FR-011).
- [X] T012 [US1] Compléter `src/styles/design-modern.css` — composants, tous préfixés : `.panel, .card, .result` (bordure plus légère, ombre douce, padding plus généreux) ; `.page-header h1` et titres `h2` (hiérarchie plus marquée, graisse et interlettrage) ; `.app-nav` et `.app-nav-link` (fond, état actif en pastille) ; `.btn`, `.icon-button`, `.settings-choice`, champs `input`/`select` (coins, états survol/focus) ; cartes de résultats de recherche (élévation au survol) ; bulles de la visite guidée et dialogue de confirmation (coins et ombres cohérents).
- [X] T013 [US1] Compléter `src/styles/design-modern.css` — animations, préfixées : transitions 150–200 ms sur survol des cartes, boutons et liens ; `@keyframes` d'apparition (fondu + glissement de 8 px) appliqué aux `.panel`, `.card` et cartes de résultats. La règle `prefers-reduced-motion` de `src/styles/theme.css` les neutralise déjà (FR-010) : ne pas la dupliquer.
- [X] T014 [US1] Importer `./styles/design-modern.css` dans `src/main.tsx`, après les feuilles existantes.

**Checkpoint**: « Nouveau » visible et fonctionnel sur toutes les pages.

---

## Phase 4: User Story 2 - Revenir à l'ancien design en un clic (Priority: P1)

**Goal**: « Classique » redonne exactement l'application actuelle, et le choix survit au rechargement.

**Independent Test**: passer en « Nouveau » puis en « Classique » ; recharger (quickstart.md 5 et 6).

### Tests for User Story 2

- [X] T015 [US2] Compléter `tests/integration/design-setting.test.tsx` : après « Nouveau » puis « Classique », l'attribut `data-design` est absent et `craftcheck-design === 'classic'` ; avec `craftcheck-design = 'modern'` déjà enregistré, `applyDesign(getDesignId())` (appel de `main.tsx`) pose l'attribut avant le rendu de l'App.

### Implementation for User Story 2

- [X] T016 [US2] Refaire les captures de T001 en « Classique » après implémentation et les comparer pixel à pixel aux références (script dans le scratchpad, par exemple avec la comparaison d'images de Playwright ou `pixelmatch` s'il est déjà disponible) ; toute différence doit être expliquée (contenu dynamique comme « il y a X minutes ») ou corrigée (FR-005, SC-002).

**Checkpoint**: les deux designs coexistent, bascule dans les deux sens.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T017 Lancer `npm test`, `npm run typecheck`, `npm run lint` et `npx playwright test --project=desktop` ; les tests Playwright tournent en « Classique » (défaut) et doivent tous passer.
- [X] T018 Relancer toute la suite Playwright desktop avec `craftcheck-design = 'modern'` ajouté temporairement au `storageState` de `playwright.config.ts` (puis retiré) : tous les parcours doivent passer en « Nouveau » aussi (SC-003).
- [X] T019 Captures du design « Nouveau » sur toutes les pages de T001, en clair et sombre, 1366 px et 375 px, avec au moins deux couleurs d'accent : vérifier lisibilité, contraste, absence de défilement horizontal (SC-004) ; corriger `src/styles/design-modern.css` si besoin.

---

## Notes d'implémentation

- T001/T016 : captures déterministes (identiques octet par octet entre deux passages). Après
  implémentation, 20 captures « Classique » sur 24 sont identiques ; les 4 différences sont la
  page Paramètres, qui affiche la nouvelle section « Design » (attendu).
- Pas de `backdrop-filter` sur `.app-nav` : il faisait tomber le sélecteur de serveur (fixé en haut
  sur mobile) sur la barre d'onglets. La barre latérale est transparente sur ordinateur à la place.
- T018 : 3 passages complets sur 4 à 15/15 en « Nouveau » ; un échec ponctuel de
  `catalogue-search.spec.ts:18`, qui réussit relancé seul.
- `pnpm-lock.yaml` n'est pas mis à jour par `npm install` (seul `package-lock.json` l'est).
- Hors périmètre, préexistant : l'écran de choix du serveur n'applique ni le thème clair ni
  l'accent (appliqués dans `AppShell`), dans les deux designs.

- Itération 2 (demande « améliore le nouveau thème », dans le périmètre de FR-009) : catégories en
  pastilles, verdict HDV en encart teinté, titres de cartes à gauche, chiffres alignés, tuiles de
  l'Accueil en verre dépoli, cartes épinglées qui se soulèvent au survol, barre d'onglets mobile
  flottante et sélecteur de serveur en pastille, barre de défilement discrète. Corrigé : décalage
  des cartes de la page Prix (règle `.panel + .panel` retirée) et titre de recherche passant sous
  le bouton d'aide. « Classique » revérifié octet par octet (mêmes 4 différences attendues sur
  Paramètres), Playwright 15/15 dans les deux designs.

- Itération 3 (« le menu à gauche ne se distingue pas ») : sur ordinateur, la barre latérale devient
  un panneau flottant (marge, fond de carte, bordure, ombre), limité à `min-width: 961px` pour ne
  pas toucher la barre d'onglets mobile. Le dégradé de fond passe de `<body>` à la racine : sur
  `<body>` (une hauteur d'écran), il laissait une arête visible une fois la page défilée.

- Itération 4 (« le bloc Prix HDV est trop haut ») : marges réduites dans ce panneau, verdict
  placé à côté du champ dès 320 px de place, badge et coût de craft sur la même ligne, phrase
  d'économie en dessous. Hauteur mesurée (Coiffe du Bouftou, verdict complet) : 183 px contre
  242 px en « Classique » à 1366 px, 160 contre 172 à 1848 px, identique sur mobile.

## Dependencies & Execution Order

- **T001 avant toute modification du code** (références du « Classique »).
- Phase 2 bloque US1 et US2.
- US1 : T008/T009 (tests) → T010 → T011 → T012 → T013 → T014.
- US2 dépend de T010 (réglage) ; T016 dépend de toute l'US1 (feuille en place).
- Polish en dernier.

### Parallel Opportunities

- T003, T004, T005 (fichiers distincts).
- T008 et T009.

## Parallel Example: Phase 2

```text
Task: "T003 Créer src/domain/designs.ts"
Task: "T004 Créer src/persistence/design-preference.ts"
Task: "T005 Écrire tests/unit/design-preference.test.ts"
```

## Implementation Strategy

### MVP First

1. T001–T002, puis Phase 2.
2. US1 : le réglage et le design « Nouveau ».
3. **Stop et validation** : essayer le design sur le serveur de dev.

### Incremental Delivery

1. MVP : « Nouveau » essayable.
2. US2 : garantie de retour identique vérifiée par captures.
3. Polish : parcours complets dans les deux designs, puis déploiement.
