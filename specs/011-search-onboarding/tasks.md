# Tasks: Onboarding de la page Recherche

**Input**: Documents de conception de `specs/011-search-onboarding/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/guided-tour-ui.md, quickstart.md

**Tests**: inclus. La constitution exige des tests pour les règles explicites, et le plan prévoit
`tests/unit/search-tour-preference.test.ts` et `tests/integration/search-onboarding.test.tsx`.

**Organization**: tâches groupées par user story.

## Format: `[ID] [P?] [Story] Description`

- **[P]** : parallélisable (fichiers différents, pas de dépendance sur une tâche inachevée)
- **[Story]** : US1, US2, US3 (voir spec.md)

---

## Phase 1: Setup

**Purpose**: aucune initialisation nécessaire (pas de dépendance, pas de configuration). Le dossier
`src/features/onboarding/` est créé par la première tâche qui y écrit.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: briques utilisées par toutes les user stories.

- [X] T001 [P] Créer `src/persistence/search-tour-preference.ts` sur le modèle de `src/persistence/price-mode-preference.ts` : `hasSeenSearchTour(): boolean` lit la clé `localStorage` `craftcheck-search-tour-seen` et renvoie `true` seulement si la valeur vaut `"1"` ; `markSearchTourSeen(): void` écrit `"1"`. Lecture et écriture dans `try/catch` : stockage indisponible → `hasSeenSearchTour()` renvoie `false`, `markSearchTourSeen()` ne lève rien (research.md §5, FR-010).
- [X] T002 [P] Écrire `tests/unit/search-tour-preference.test.ts` : clé absente → `false` ; après `markSearchTourSeen()` → `true` ; valeur autre que `"1"` → `false` ; `localStorage.getItem`/`setItem` qui lèvent → `false` et aucune exception.
- [X] T003 [P] Créer `src/features/onboarding/search-tour-steps.ts` : type `TourStep = { id: string; target?: string; title: string; body: string; absentHint?: string }` et une fonction `searchTourSteps(priceModeLabel: string): TourStep[]` qui renvoie les 6 étapes dans l'ordre de data-model.md : `search` (target `search`), `recipe` (target `item-detail`), `resource-prices` (target `resource-prices`), `market-price` (target `market-price`), `recommendation` (target `recommendation`), `price-mode` (pas de target). Textes en français, « au plus trois phrases » par `body` (FR-004), avec les libellés exacts de la page : « Prix des ressources », « Prix HDV », « Dernière mise à jour », « Mode communautaire », « Mode personnel » (FR-012). Les étapes 2 à 5 ont `absentHint: "Cette zone apparaît après avoir choisi un objet."`. Contenu attendu : (1) rechercher par nom, filtrer par catégorie et niveau ; (2) choisir un objet pour voir sa fiche et sa recette ; (3) renseigner le prix unitaire de chaque ressource, « Dernière mise à jour » = date du dernier prix connu, « N contributions » = nombre de prix partagés par le groupe, un prix surligné est ancien et mérite d'être vérifié ; (4) saisir le « Prix HDV » de l'objet fini ; (5) la recommandation compare coût de craft et Prix HDV, « (partiel) » signale qu'il manque des prix de ressources ; (6) mode actif = `priceModeLabel`, Mode communautaire = prix partagés anonymement avec le groupe, Mode personnel = prix gardés sur cet appareil, changement dans Paramètres.
- [X] T004 Ajouter les attributs `data-tour` du contrat (contracts/guided-tour-ui.md) : `data-tour="search"` sur l'élément racine rendu par `ItemSearch` dans `src/features/catalogue/ItemSearch.tsx` ; `data-tour="item-detail"` sur la `<section className="card item-detail-card">` de `src/features/catalogue/ItemDetail.tsx` (pas sur la carte « Sélectionnez un objet… », pour que l'étape 2 bascule en bulle centrée sans objet) ; dans `src/features/search/RecherchePage.tsx`, `data-tour="market-price"` sur la `<section className="panel market-price-panel">`, `data-tour="recommendation"` sur `<div className="market-price-summary">`, `data-tour="resource-prices"` sur la `<section className="card">` qui contient « Prix des ressources ». Aucun autre changement de rendu.

**Checkpoint**: préférence, étapes et cibles prêtes.

---

## Phase 3: User Story 1 - Découvrir la page à la première visite (Priority: P1) 🎯 MVP

**Goal**: la visite guidée démarre seule à la première visite, met en surbrillance chaque zone,
se parcourt avec Suivant/Précédent et ne revient plus après « Terminer », « Passer » ou Échap.

**Independent Test**: supprimer `craftcheck-search-tour-seen`, ouvrir la page Recherche, parcourir
les 6 étapes, recharger : la visite ne revient pas (quickstart.md scénarios 1, 2, 4, 6).

### Tests for User Story 1

- [X] T005 [P] [US1] Écrire `tests/integration/search-onboarding.test.tsx` (rendu de `RecherchePage` dans les mêmes providers que `tests/integration/recherche-typing.test.tsx`) : (a) clé absente → un dialogue « 1 / 6 » est affiché ; (b) « Suivant » → « 2 / 6 », « Précédent » → « 1 / 6 », « Précédent » absent à l'étape 1 ; (c) à l'étape 6 le bouton s'appelle « Terminer » et le clic ferme la visite et écrit `craftcheck-search-tour-seen = "1"` ; (d) « Passer » ferme et écrit la clé ; (e) événement `cancel` sur le `<dialog>` (Échap) ferme et écrit la clé ; (f) clé déjà à `"1"` → pas de dialogue au montage ; (g) sans objet sélectionné, l'étape 3 affiche « Cette zone apparaît après avoir choisi un objet. » ; (h) démonter la page pendant la visite n'écrit pas la clé ; (i) aucun appel `fetch` vers l'API communautaire n'est déclenché par la visite elle-même.

### Implementation for User Story 1

- [X] T006 [US1] Créer `src/features/onboarding/GuidedTour.tsx` selon contracts/guided-tour-ui.md : props `steps: TourStep[]`, `open: boolean`, `onClose(reason: 'finished' | 'skipped' | 'escaped')`. Rendu : `<dialog>` ouvert par `showModal()` quand `open` passe à `true` (même approche que `src/features/comparison/OutlierConfirmDialog.tsx`), fermé par `close()` sinon ; `onCancel` → `preventDefault()` puis `onClose('escaped')`. État interne `index`, remis à 0 à chaque ouverture. À chaque étape : `document.querySelector('[data-tour="<target>"]')` ; si trouvé, `scrollIntoView({ block: 'center' })` puis mesure `getBoundingClientRect()`, recalculée sur `resize` et `scroll` (écouteurs retirés à la fermeture) ; rendu d'une découpe `position: fixed` sur le rectangle + 8 px de marge ; bulle placée sous la cible, ou au-dessus si la place manque. Cible absente → pas de découpe, fond assombri, bulle centrée avec `absentHint`. Bulle : « n / total », titre (`id` utilisé par `aria-labelledby` du dialogue), texte, boutons « Passer », « Précédent » (masqué à l'étape 1), « Suivant » / « Terminer ». Focus placé sur « Suivant »/« Terminer » à chaque changement d'étape.
- [X] T007 [US1] Ajouter les styles dans `src/styles/global.css` : `<dialog>` de visite plein écran, transparent, sans bordure ni padding, `::backdrop` transparent ; découpe avec `box-shadow: 0 0 0 100vmax` semi-opaque et `border-radius` des cartes ; fond assombri équivalent quand il n'y a pas de découpe ; bulle aux couleurs des cartes existantes (variables CSS du thème, clair et sombre), largeur max 360 px ; sous 640 px de large, bulle ancrée en bas, largeur `calc(100vw - 32px)`, sans défilement horizontal (FR-011).
- [X] T008 [US1] Brancher la visite dans `src/features/search/RecherchePage.tsx` : état `tourOpen` initialisé à `false`, passé à `!hasSeenSearchTour()` dans un `useEffect` au montage ; rendre `<GuidedTour steps={searchTourSteps(label du mode actif via priceModes)} open={tourOpen} onClose={() => { markSearchTourSeen(); setTourOpen(false); }} />`. La visite ne modifie aucun état de la page (recherche, `inputs`, `market`, carnet) (FR-009).

**Checkpoint**: US1 fonctionnelle et testée — c'est le MVP.

---

## Phase 4: User Story 2 - Revoir l'onboarding à la demande (Priority: P2)

**Goal**: un bouton d'aide toujours visible relance la visite à l'étape 1.

**Independent Test**: après avoir fermé la visite, cliquer sur le bouton d'aide : « 1 / 6 » s'affiche
(quickstart.md scénario 5).

### Tests for User Story 2

- [X] T009 [US2] Compléter `tests/integration/search-onboarding.test.tsx` : clé à `"1"`, clic sur le bouton « Comment fonctionne cette page ? » → dialogue « 1 / 6 » ; après avoir avancé à l'étape 3 puis « Passer », un nouveau clic rouvre à « 1 / 6 ».

### Implementation for User Story 2

- [X] T010 [US2] Dans `src/features/search/RecherchePage.tsx`, ajouter en haut de la première `<section className="panel">` un bouton `type="button"`, `className="icon-button"`, `aria-label="Comment fonctionne cette page ?"`, `title` identique, contenant `<Icon name="info" size={18} />`, qui fait `setTourOpen(true)`. Ajuster `src/styles/global.css` pour l'aligner à droite sans décaler le formulaire de recherche.

**Checkpoint**: US1 et US2 fonctionnent.

---

## Phase 5: User Story 3 - Comprendre les informations de prix affichées (Priority: P3)

**Goal**: les étapes 3 et 6 expliquent « Dernière mise à jour », les contributions, le surlignage d'un
prix ancien et la différence entre les deux modes.

**Independent Test**: parcourir la visite et lire les étapes 3 et 6.

### Tests for User Story 3

- [X] T011 [P] [US3] Écrire `tests/unit/search-tour-steps.test.ts` : 6 étapes dans l'ordre `search`, `recipe`, `resource-prices`, `market-price`, `recommendation`, `price-mode` ; chaque `body` contient au plus trois phrases (FR-004) ; l'étape `resource-prices` mentionne « Dernière mise à jour » et « contributions » ; l'étape `price-mode` n'a pas de `target`, mentionne « Mode communautaire », « Mode personnel », « Paramètres », et le libellé de mode passé en argument.

### Implementation for User Story 3

- [X] T012 [US3] Relire et ajuster les textes des étapes `resource-prices` et `price-mode` dans `src/features/onboarding/search-tour-steps.ts` pour que T011 passe, en gardant les libellés exacts de la page.

**Checkpoint**: toutes les user stories fonctionnent.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T013 Lancer `npm test`, `npm run typecheck` et `npm run lint`, corriger les erreurs introduites.
- [X] T014 Dérouler les scénarios manuels de `specs/011-search-onboarding/quickstart.md` sur le serveur de dev (bureau et largeur 375 px, thèmes clair et sombre) et noter les écarts.

---

## Notes d'implémentation

- Corrections de l'analyse intégrées : I1 (étapes 3 à 5 : « objet craftable »), I2 (texte de l'étape 3
  selon le mode actif : `searchTourSteps(priceMode)`), U1 (`data-tour="market-price"` sur le champ
  seul, dans `MarketPriceInput.tsx`, pour ne pas englober la recommandation).
- `GuidedTour` n'a pas de prop `open` : la page ne le monte que pendant la visite, ce qui remet
  l'étape à 1 à chaque ouverture.
- `tests/integration/pinned-item-collections.test.tsx` marque la visite comme vue : ces tests passent
  par la page Recherche sans concerner la visite.
- T014 (Playwright, 1366 px et 375 px) : 6 étapes parcourues, aucune erreur, aucun défilement
  horizontal. Limite connue : sur mobile, la carte « Prix des ressources » étant en bas de page, la
  bulle ancrée en bas en recouvre une partie.

- Ordre des étapes révisé à la demande du joueur (spec FR-003) : recherche, Prix HDV, Crafter ou
  acheter, fiche de l'objet, prix des ressources, mode de prix.

- Bulles allégées à la demande du joueur (spec FR-004) : une phrase + au plus trois puces
  (`TourStep.points`).

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)** : bloque toutes les user stories.
- **US1 (Phase 3)** : dépend de la phase 2.
- **US2 (Phase 4)** : dépend de T008 (état `tourOpen` et rendu de `GuidedTour` dans la page).
- **US3 (Phase 5)** : dépend seulement de T003 ; peut avancer en parallèle de US1.
- **Polish (Phase 6)** : après les stories retenues.

### Within Each User Story

- Écrire les tests d'abord et vérifier qu'ils échouent.
- T006 → T007 → T008 (même composant puis même page).
- T005 et T009 modifient le même fichier : les faire dans cet ordre.

### Parallel Opportunities

- T001, T002, T003 : fichiers différents, en parallèle.
- T005 et T011 : en parallèle, une fois la phase 2 terminée.

## Parallel Example: Phase 2

```text
Task: "T001 Créer src/persistence/search-tour-preference.ts"
Task: "T002 Écrire tests/unit/search-tour-preference.test.ts"
Task: "T003 Créer src/features/onboarding/search-tour-steps.ts"
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 2 (T001–T004).
2. Phase 3 (T005–T008).
3. **Stop et validation** : scénarios 1, 2, 4, 6 de quickstart.md.

### Incremental Delivery

1. MVP : visite automatique à la première visite.
2. US2 : bouton d'aide pour la relancer.
3. US3 : textes des prix et des modes vérifiés par tests.
4. Polish, puis déploiement du front.
