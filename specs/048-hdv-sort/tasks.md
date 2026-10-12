# Tasks: Trier la page HDV et onglets à icônes

**Input**: Design documents from `/specs/048-hdv-sort/` (plan.md, spec.md)

**Tests**: demandés (constitution, principe II).

**Rappels** : Node 22 ; le Worker n'est pas modifié ; aucun déploiement.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Foundational (règle de tri)

- [ ] T001 Dans src/domain/hdv.ts : ajouter `HdvSort = 'default' | 'price-desc' | 'price-asc' | 'recent' | 'oldest'`, `HDV_SORTS` (les quatre tris nommés, libellés « Prix le plus élevé », « Prix le plus bas », « Mis à jour récemment », « Mis à jour il y a longtemps »), `isHdvSort(value)` et `sortHdvLines(items, prices, sort)` (règle du plan : `default` rend la liste telle quelle ; sinon lignes avec prix triées par prix ou par `Date.parse(updatedAt) || 0`, égalités dans l'ordre d'origine, lignes sans prix à la fin) ; retirer `filterByPrice`, `HdvPriceFilter` et l'import devenu inutile.
- [ ] T002 Dans tests/unit/hdv-domain.test.ts : remplacer les tests de `filterByPrice` par ceux de `sortHdvLines` — chaque tri, objets sans prix à la fin dans l'ordre d'origine, égalité de prix et de date, date illisible comptée la plus ancienne, liste sans aucun prix inchangée, la liste reçue n'est pas modifiée ; `isHdvSort` (valeurs connues, inconnue, `null`).

**Checkpoint** : `npx vitest run tests/unit/hdv-domain.test.ts` passe.

---

## Phase 2: User Story 1 - Trier la liste d'un onglet (P1)

- [ ] T003 [US1] Dans src/features/hdv/HdvPage.tsx : état `sort` (`'default'` au départ, gardé au changement d'onglet) ; appliquer `sortHdvLines` après les filtres et avant `useLoadMoreOnScroll` ; ajouter le `<select className="hdv-type-filter" aria-label="Trier">` (première option « Tri par nom » ou « Tri par stat » dans l'onglet Runes, puis `HDV_SORTS`), qui ramène la liste à ses premières lignes ; retirer `PRICE_FILTERS`, l'état `priceFilter` et le bloc `hdv-price-filters` ; mettre à jour le commentaire de src/features/hdv/useHdvPriceSummary.ts qui cite les filtres.
- [ ] T004 [US1] Dans tests/integration/hdv-page.test.tsx : remplacer les deux scénarios « Sans prix » par des scénarios de tri (Créatures : trois prix de montants et de dates différents → ordre pour chacun des quatre tris, objets sans prix ensuite, compteur inchangé ; le tri reste choisi après un changement d'onglet ; Runes : première option « Tri par stat », un prix saisi remonte en tête avec « Prix le plus élevé ») ; vérifier que les boutons « Sans prix » et « Prix ancien » n'existent plus.

---

## Phase 3: User Story 2 - Reconnaître un onglet à son icône (P2)

- [ ] T005 [P] [US2] Dans src/components/Icon.tsx : ajouter les icônes `potion` et `rune` (tracés du site en ligne).
- [ ] T006 [US2] Dans src/features/hdv/HdvPage.tsx : onglets en `hdv-tab hdv-tab--icon`, icône de 16 px (`package`, `potion`, `paw`, `rune`) puis libellé dans un `<span>`.
- [ ] T007 [P] [US2] Dans src/styles/global.css : `.hdv-tabs` (ombre intérieure à la place de la bordure, `overflow-y: hidden`, barre de défilement masquée), `.hdv-tab` (sans marge négative, `white-space: nowrap`), `.hdv-tab--icon` ; sur écran étroit `.hdv-tabs { gap: 0 }`, `.hdv-tab { font-size: .82rem }`, `.hdv-tab--icon` en colonne — valeurs du site en ligne.
- [ ] T008 [US2] Dans tests/integration/hdv-page.test.tsx : chaque onglet contient une icône (`svg[aria-hidden]`) et garde son libellé pour nom accessible.

---

## Phase 4: Polish

- [ ] T009 Lancer `npx tsc -b --noEmit`, `npx eslint src tests --quiet`, `npx vitest run` ; noter le total dans specs/048-hdv-sort/plan.md (section Vérification).
- [ ] T010 Vérifier à l'écran sur le site local : menu « Trier » et icônes, en largeur de bureau et de téléphone ; ne pas cliquer sur « Charger depuis Huzounet ».
- [ ] T011 Ajouter à specs/023-hdv-price-entry/spec.md une note de révision renvoyant à specs/048 (récit 4 remplacé par le tri) ; mettre à jour README.md si la page HDV y décrit les filtres.

## Dependencies

T001 → T002 → T003 → T004 ; T005 → T006 ; T008 après T004 (même fichier) ; Polish en dernier.
