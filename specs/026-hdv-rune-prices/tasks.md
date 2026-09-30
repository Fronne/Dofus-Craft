---

description: "Task list for 026-hdv-rune-prices"
---

# Tasks: Prix des runes dans la page HDV

**Input**: Design documents from `specs/026-hdv-rune-prices/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [quickstart.md](quickstart.md)

**Tests**: inclus. La constitution (principe II) impose des tests pour les règles pures (`filterRunes`,
filtres de prix génériques), et les pages HDV et Forgemagie ont déjà des tests d'intégration et e2e à
adapter.

**Organization**: une phase par user story de la spec (US1, US2), après une base commune.

## Format: `[ID] [P?] [Story] Description`

- **[P]** : parallélisable (fichiers différents, pas de dépendance sur une tâche non terminée)
- **[Story]** : user story de la spec (US1, US2)

## Path Conventions

Site dans `src/`, tests dans `tests/unit/`, `tests/integration/` (Vitest) et `tests/e2e/`
(Playwright). Aucun changement dans `worker/`.

---

## Phase 1: Setup

Aucune tâche : ni dépendance, ni configuration, ni donnée nouvelle (plan.md, data-model.md).

---

## Phase 2: Foundational (bloquant pour les deux stories)

**Purpose** : règles pures de l'onglet Runes et déplacement du hook d'origine.

- [X] T001 [P] Dans src/domain/hdv.ts, rendre `filterByPrice` et `countPriced` génériques (`<T extends { id: string }>(items: T[], …)`, même comportement), ajouter `'runes'` à `HdvId` et `{ id: 'runes', label: 'Runes' }` en dernière position de `HDV_TABS` ; `itemsForHdv(data, 'runes')` renvoie `[]`.
- [X] T002 [P] Dans src/domain/forgemagie.ts, ajouter `filterRunes(runes: RuneItem[], { query, stat }: { query: string; stat: string }): RuneItem[]` : nom comparé avec `normalizeSearchText` (sans accents ni casse, comme `filterHdvItems`), stat exacte quand `stat` n'est pas vide, ordre d'origine conservé.
- [X] T003 [P] Tests dans tests/unit/hdv-domain.test.ts : `isHdvId('runes')` vrai ; `HDV_TABS` finit par Runes ; `itemsForHdv(data, 'runes')` vide ; `filterByPrice` et `countPriced` acceptent une liste de runes (`{ id, name, … }`). Tests dans tests/unit/forgemagie-domain.test.ts : `filterRunes` par « do air » (sans casse), par « ré » (sans accent : trouve « Rune Ré Air »), par stat « Force », les deux combinés, ordre conservé.
- [X] T004 Déplacer le hook `useLatestOrigins` de src/features/forgemagie/RunesTab.tsx vers src/features/hdv/useLatestOrigins.ts, avec la signature `useLatestOrigins(serverId: string | undefined, priceMode: PriceMode, ids: string[], version: number): Record<string, PriceOrigin>` : lecture groupée `getCommunityPrices(ids, serverId)` seulement en Mode communautaire et avec au moins un identifiant, sinon `{}` ; une origine absente vaut `'manual'`.

**Checkpoint** : règles testées, hook disponible pour la page HDV.

---

## Phase 3: User Story 1 - Consulter et relever le prix des runes dans la page HDV (Priority: P1) 🎯 MVP

**Goal** : un quatrième onglet « Runes » dans la page HDV, sans connexion, avec recherche, filtre par
stat, filtres de prix, compteur, saisie et origine du dernier prix.

**Independent Test** : sans connexion, HDV → onglet Runes → « Do Air » : deux runes ; la Rune Do Air
affiche son prix partagé, sa date et « Bot Discord » ; saisir un prix pour la Rune Fo met à jour le
compteur.

### Tests for User Story 1

- [X] T005 [P] [US1] Tests d'intégration dans tests/integration/hdv-page.test.tsx (nouveau `describe` « Runes tab (specs/026) », avec un délai de 20 s comme les tests lourds de la page Forgemagie) : l'onglet Runes est le quatrième, après Créatures ; il liste 105 lignes et le compteur dit « 0 objet sur 105 a un prix » ; « Do Air » ne garde que Rune Do Air et Rune Pa Do Air ; la stat « Force » ne garde que des runes de Force ; « Sans prix » ne garde que les runes sans prix ; en Mode communautaire, une rune dont `getCommunityPrices` renvoie `latestOrigin: 'bot'` affiche « Bot Discord » ; en Mode personnel, aucune origine ; un prix saisi est enregistré dans le carnet et le compteur passe à « 1 objet sur 105 a un prix » ; l'onglet Runes est rouvert après un nouveau rendu. Mettre à jour le test existant de l'ordre de la navigation si besoin (l'entrée « Forgemagie » suit « XP Familier »).

### Implementation for User Story 1

- [X] T006 [US1] Dans src/features/hdv/HdvPage.tsx, choisir la source de l'onglet ouvert : les objets de `itemsForHdv(data, tab)` pour Ressources, Consommables et Créatures, les runes de src/data/rune-items.json (`RuneItemsData`) pour Runes, avec `filterRunes` au lieu de `filterHdvItems`. Le sélecteur de catégorie affiche « Tous les types » et `typesInTab` ailleurs, « Toutes les stats » et `runeStatLabels` dans l'onglet Runes (état `stat` remis à zéro au changement d'onglet, comme `typeId`), avec le libellé accessible « Stat » dans cet onglet. Filtres de prix, compteur (`useHdvPriceSummary`, `countPriced`), défilement progressif et `PriceEntryField` restent communs (FR-004, FR-005). L'onglet Runes ne dépend pas du chargement de hdv-items.json (pas d'écran « Chargement des objets… » ni « Liste indisponible » pour lui).
- [X] T007 [US1] Toujours dans src/features/hdv/HdvPage.tsx, la légende (`caption`) d'une rune affiche l'icône de sa caractéristique (`CHARACTERISTIC_ASSET_BY_ID`, `CharacteristicIcon`, taille 16), sa stat et, en Mode communautaire, l'origine du dernier prix sur sa propre ligne (`<span className="fm-origin">` avec `PRICE_ORIGIN_LABELS`) lue par `useLatestOrigins(serverId, priceMode, runeIds, version)` ; `version` est incrémenté au même moment que `summary.refresh` après un prix enregistré (FR-006). Réutiliser les classes `fm-rune-caption` et `fm-origin` de src/styles/global.css.
- [X] T008 [US1] Adapter le texte d'en-tête de src/features/hdv/HdvPage.tsx s'il cite les trois HDV, et la note de l'onglet ; aucune demande de connexion sur la page (FR-007).

**Checkpoint** : US1 fonctionne seule ; les runes sont listées dans la page HDV (et encore aussi dans
Forgemagie jusqu'à US2).

---

## Phase 4: User Story 2 - La page Forgemagie sans liste des runes (Priority: P2)

**Goal** : Forgemagie n'a plus que Sessions et Profil ; l'import de capture est dans Profil, sur son
propre profil, et met à jour les dépenses.

**Independent Test** : connecté, Forgemagie n'affiche que Sessions et Profil ; dans Profil, coller une
capture et valider : l'achat apparaît dans le total sans recharger ; sur le profil d'un autre membre,
pas d'import.

### Tests for User Story 2

- [X] T009 [P] [US2] Dans tests/integration/forgemagie-page.test.tsx : retirer le `describe` « runes » (couvert par T005) sauf le test d'import, qui passe dans l'onglet Profil ; ajouter : la page connectée n'a que les onglets « Sessions » et « Profil » ; après une validation d'import, `getFmPlayer` est relu et le nouveau total s'affiche ; le profil d'un autre membre (choisi dans « Voir le profil de ») n'affiche pas la zone d'import.

### Implementation for User Story 2

- [X] T010 [US2] Dans src/features/forgemagie/ProfileTab.tsx, afficher `CaptureImport` sous `ProfileSettings` seulement quand `isMine` (FR-010), avec `me` et `priceMode` (nouvelle prop de `ProfileTab`) ; `onImported` incrémente un compteur `version` ajouté aux dépendances de l'effet qui charge `getFmPlayer(shownId)`, pour relire les dépenses (FR-011).
- [X] T011 [US2] Dans src/features/forgemagie/ForgemagiePage.tsx, retirer l'onglet « Runes » de `TABS` (type `FmTab = 'sessions' | 'profile'`) et le rendu de `RunesTab` ; passer `priceMode` à `ProfileTab`. Supprimer src/features/forgemagie/RunesTab.tsx. Mettre à jour la phrase d'en-tête de la page (« Les sessions FM du bot Discord et les dépenses de chacun. ») et le texte de l'écran de connexion (sans « le prix des runes »).
- [X] T012 [US2] Dans src/features/forgemagie/CaptureImport.tsx, remplacer le message « Choisis d'abord ton serveur Dofus dans l'onglet Profil. » par « Choisis d'abord ton serveur Dofus ci-dessus. ».

**Checkpoint** : US1 et US2 fonctionnent ; la liste des runes n'existe plus qu'à un endroit.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T013 [P] Mettre à jour tests/e2e/forgemagie.spec.ts : le test « shows the origin of a rune's latest shared price » passe dans tests/e2e/hdv-price-entry.spec.ts (HDV → onglet Runes, sans connexion, `**/community-prices?*` simulé) ; vérifier dans forgemagie.spec.ts que seuls les onglets Sessions et Profil existent.
- [X] T014 [P] Mettre à jour README.md (la page Forgemagie ne liste plus les runes ; la page HDV a un onglet Runes avec l'origine du dernier prix ; l'import de capture est dans le Profil).
- [X] T015 [P] Ajouter les notes d'amendement de plan.md en fin de specs/023-hdv-price-entry/spec.md (FR-002 : quatre onglets) et specs/025-rune-purchase-import/spec.md (US4/FR-017 : liste des runes dans la page HDV ; US5 : import dans l'onglet Profil).
- [X] T016 Lancer `npm run typecheck`, `npm run lint`, `npm test` et `npx playwright test hdv-price-entry forgemagie --project=desktop`, puis dérouler [quickstart.md](quickstart.md) sur le serveur de développement (le laisser tourner).

---

## Dependencies & Execution Order

- **Phase 2** : T001, T002 et T004 en parallèle ; T003 après T001 et T002.
- **US1** (T005 → T006 → T007 → T008) : dépend de la Phase 2.
- **US2** (T009 → T010 → T011 → T012) : indépendante d'US1 pour le code, mais à livrer après pour que
  la liste des runes ne disparaisse jamais du site (T011 supprime `RunesTab.tsx`, dont T004 a déjà
  déplacé le hook).
- **Polish** : après US1 et US2.

## Parallel Example

```bash
# Phase 2 :
Task: "filterByPrice/countPriced génériques et onglet Runes dans src/domain/hdv.ts"
Task: "filterRunes dans src/domain/forgemagie.ts"
Task: "useLatestOrigins dans src/features/hdv/useLatestOrigins.ts"
```

## Implementation Strategy

1. Phase 2, puis US1 : la page HDV a son onglet Runes (MVP, déployable seul).
2. US2 : retrait de l'onglet Runes de Forgemagie et import dans Profil.
3. Finitions, puis déploiement du site uniquement (le Worker ne change pas).
