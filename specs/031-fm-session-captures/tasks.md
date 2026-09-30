# Tasks: Captures d'une séance FM et rattachement d'objet par son nom

**Input**: Design documents from `specs/031-fm-session-captures/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/fm-session-captures-api.md, quickstart.md

**Tests**: inclus — la constitution (II) exige des tests automatisés pour les règles de calcul.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

Aucune tâche : pas de dépendance, pas de migration (plan.md).

## Phase 2: Foundational

- [ ] T001 Ajouter le type `FmCapture` (`id`, `createdAt`, `origin: 'bot' | 'capture'`, `player: FmPlayer`, `spentKamas`, `items: FmItemSummary[]`) et le champ `captures: FmCapture[]` à `FmSessionDetail` dans src/domain/forgemagie.ts

## Phase 3: User Story 1 — Captures d'une séance avec leur récap (P1) 🎯 MVP

**Goal**: le détail d'une séance liste chaque capture (date, auteur, provenance, montant) avec le récap de ses runes.

**Independent Test**: une séance avec deux captures affiche deux captures, chacune avec sa ligne ; leurs montants font le total de la séance.

- [ ] T002 [P] [US1] Tests Worker dans tests/unit/fm-reads.test.ts : `captures` triées par `createdAt` puis `id` ; récap regroupé par objet (deux lots de Rune Do Air → une ligne, quantités et totaux additionnés, prix moyen arrondi) ; somme des `spentKamas` = `totalKamas` ; capture sans ligne → `items: []` ; auteur privé masqué pour un autre joueur ; `/fmreset` vide les captures
- [ ] T003 [US1] Dans worker/src/fm/reads.ts, `sessionDetail` : lire les captures de la séance (`SELECT c.id, c.created_at, c.origin, c.spent_kamas, p.* FROM fm_captures c JOIN fm_players p … WHERE c.session_id = ? ORDER BY c.created_at, c.id`) et leurs lignes groupées (`GROUP BY l.capture_id, l.item_name ORDER BY total_kamas DESC, l.item_name`), puis renvoyer `captures` (auteur via `playerView`, récap via `itemSummaries`)
- [ ] T004 [P] [US1] Tests client dans tests/unit/fm-api.test.ts : un détail sans `captures` donne `captures: []` ; un détail avec des captures est accepté
- [ ] T005 [US1] Dans src/services/fm-api.ts, valider `captures` quand il est présent (`isCapture`) et le normaliser à `[]` dans `withDetailActions`
- [ ] T006 [US1] Créer src/features/forgemagie/SessionCaptures.tsx : section « Captures (N) », une `<details>` par capture (résumé : date et heure `formatFmDate`, `PlayerBadge`, « Discord » ou « Site », montant ; contenu : `ItemSummaryTable` sans la note d'arrondi répétée), ouvertes par défaut si N ≤ 5 ; message « Aucune capture n'a encore été lue. » si N = 0
- [ ] T007 [US1] Afficher `SessionCaptures` sous le tableau « Achats » dans src/features/forgemagie/SessionDetail.tsx ; permettre à `ItemSummaryTable` de masquer sa note (`showNote`)
- [ ] T008 [P] [US1] Styles `.fm-captures`, `.fm-capture` (résumé sur une ligne, montant aligné à droite, lisible sur mobile) dans src/styles/global.css
- [ ] T009 [US1] Test d'intégration dans tests/integration/forgemagie-page.test.tsx : le détail d'une séance affiche ses captures, leur provenance, leur montant et leurs lignes

## Phase 4: User Story 2 — Rattacher un objet en tapant son nom (P1)

**Goal**: dans le détail d'une séance rattachable, un champ propose les objets en FM du joueur puis les équipements du catalogue ; choisir un équipement crée l'objet et rattache la séance.

**Independent Test**: sans objet en FM, taper « Anneau Rtograf » et choisir l'équipement : la séance indique l'objet, et le profil le liste avec 1 séance.

- [ ] T010 [P] [US2] Tests Worker dans tests/unit/fm-items.test.ts : `PUT …/item` avec `{ item }` crée l'objet (`label` null) et rattache la séance (200, `fmItem` renseigné, objet sur le profil avec `sessionCount` 1) ; `item` invalide → 400 ; séance déjà rattachée (à la main ou par le salon) → 409 et aucun objet créé ; séance d'un autre joueur → 404 et aucun objet créé ; `{ fmItemId }` toujours accepté
- [ ] T011 [US2] Dans worker/src/fm/items.ts, `attachSession` : accepter `item` (règles de `parseItemInput`, sans `label`) ; après les vérifications existantes, exécuter en un `db.batch` : INSERT dans `fm_items`, `UPDATE fm_sessions SET fm_item_id = ? WHERE id = ? AND fm_item_id IS NULL`, `DELETE FROM fm_items WHERE id = ? AND NOT EXISTS (SELECT 1 FROM fm_sessions WHERE fm_item_id = ?)` ; relire et répondre 409 `already-attached` si la séance n'est pas rattachée au nouvel objet
- [ ] T012 [P] [US2] Tests domaine dans tests/unit/forgemagie-domain.test.ts : `matchesItemQuery` ignore majuscules et accents, cherche dans le nom affiché et le nom de l'équipement
- [ ] T013 [P] [US2] Ajouter `matchesItemQuery(item, query)` dans src/domain/forgemagie.ts (normalisation NFD sans diacritiques, minuscules, espaces réduits ; « contient »)
- [ ] T014 [US2] Dans src/services/fm-api.ts, `attachFmSession(sessionId, target)` avec `target` = `{ fmItemId }` ou `{ item: { itemId, itemName, imageUrl } }`
- [ ] T015 [US2] Extraire de src/features/forgemagie/EquipmentPicker.tsx un hook `useEquipmentSearch(query)` (≥ 2 caractères, anti-rebond 300 ms, équipements seulement, 10 résultats) réutilisé par `EquipmentPicker`, sans changer son comportement
- [ ] T016 [US2] Créer src/features/forgemagie/SessionItemSearch.tsx : champ « Rattacher à un objet… » ; à partir de 2 caractères, liste « Mes objets en FM » (filtrés par `matchesItemQuery`) puis « Catalogue » (`useEquipmentSearch`) ; « Aucun objet ne correspond » ; message si le catalogue est indisponible ; `onPick({ fmItemId } | { item })`
- [ ] T017 [US2] Dans src/features/forgemagie/SessionDetail.tsx, `SessionItem` : remplacer la liste déroulante et le bouton « Créer un objet en FM » par `SessionItemSearch` ; au choix, appeler `attachFmSession` et afficher les erreurs existantes (`already-attached`) ; le détachement reste inchangé
- [ ] T018 [P] [US2] Styles `.fm-item-search` (groupes de résultats, titres de groupe) dans src/styles/global.css
- [ ] T019 [US2] Test d'intégration dans tests/integration/forgemagie-page.test.tsx : taper un nom propose l'objet en FM avant l'équipement du catalogue ; choisir un équipement envoie `{ item }` et affiche l'objet rattaché

## Phase 5: Polish

- [ ] T020 Mettre à jour le scénario e2e du détail de séance dans tests/e2e/forgemagie.spec.ts (captures affichées ; rattachement par recherche) et son API simulée
- [ ] T021 Mentionner les captures d'une séance et le rattachement par le nom dans la section Fonctionnalités de README.md
- [ ] T022 Lancer `npm run typecheck`, `npm run lint`, `npm test` et `npx playwright test tests/e2e/forgemagie.spec.ts` (quickstart.md)

## Dependencies & Execution Order

- T001 avant US1 et US2.
- US1 (T002–T009) et US2 (T010–T019) sont indépendantes ; toutes deux touchent `SessionDetail.tsx` (T007, T017) et `fm-api.ts` (T005, T014) : les faire l'une après l'autre dans ces fichiers.
- Dans chaque story : tests Worker → Worker → client API → composants → intégration.
- Polish après les deux stories.

## Parallel Example

```text
US1 : T002 (tests Worker), T004 (tests client), T008 (styles)
US2 : T010 (tests Worker), T012 + T013 (domaine), T018 (styles)
```

## Implementation Strategy

MVP : Phase 2 + US1 (les captures dans chaque séance), livrable seule. Puis US2 (rattachement par le
nom), puis Polish.
