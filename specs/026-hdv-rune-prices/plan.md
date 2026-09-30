# Implementation Plan: Prix des runes dans la page HDV

**Branch**: `026-hdv-rune-prices` | **Date**: 2026-09-30 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/026-hdv-rune-prices/spec.md`

## Summary

La liste des prix des runes quitte la page Forgemagie pour devenir un quatrième onglet « Runes » de la
page HDV, accessible sans connexion. `HdvPage` garde un seul chemin de rendu (barre d'outils, filtres
de prix, compteur, ligne de prix) et ne change que la source de l'onglet ouvert (objets de
`hdv-items.json` ou runes de `rune-items.json`), le filtre de catégorie (type ou stat) et la légende
(type, ou stat avec origine du dernier prix). La page Forgemagie garde Sessions et Profil ; l'import de
capture passe dans l'onglet Profil, sur son propre profil. Aucun changement du Worker. Détails :
[research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5.7

**Primary Dependencies**: React 19, React Router 7, Vite 5 (inchangées)

**Storage**: aucun changement (carnet IndexedDB existant, `localStorage` de l'onglet HDV retenu)

**Testing**: Vitest (unitaires, intégration jsdom), Playwright (e2e)

**Target Platform**: navigateurs récents (ordinateur et mobile)

**Project Type**: application web (site statique) ; Worker inchangé

**Performance Goals**: l'onglet Runes (105 lignes) s'affiche comme les autres onglets, avec le même
défilement progressif

**Constraints**: page HDV sans connexion (FR-007) ; comportement identique des champs de prix entre
onglets (FR-005)

**Scale/Scope**: 2 pages modifiées, 1 composant supprimé, 1 hook déplacé

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principe | Vérification | Statut |
|---|---|---|
| I. Données traçables | Chaque prix de rune garde sa date et, en Mode communautaire, son origine ; la liste des runes garde sa source DofusDB (`rune-items.json`). | ✅ |
| II. Exactitude avant optimisation | `filterRunes` et les filtres de prix génériques sont des fonctions pures testées ; aucune règle de calcul ne change. | ✅ |
| III. Décisions explicables | Même champ de prix, même date, même historique que les autres onglets ; aucune valeur inventée pour une rune sans prix. | ✅ |
| IV. Changements petits et cohérents | Un onglet ajouté à une page existante en réutilisant son rendu ; un composant supprimé plutôt que dupliqué ; aucune dépendance. | ✅ |
| V. Données utilisateur | Aucune donnée nouvelle ; les prix des runes deviennent visibles sans connexion, comme tous les autres prix partagés du site ; l'import (qui touche au profil) reste derrière la connexion. | ✅ |

Re-vérification après la conception : inchangée.

## Project Structure

### Documentation (this feature)

```text
specs/026-hdv-rune-prices/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

Pas de dossier `contracts/` : aucune interface externe ne change (research R5).

### Source Code (repository root)

```text
src/
├── domain/
│   ├── hdv.ts                      # HdvId + 'runes', HDV_TABS, filterByPrice / countPriced génériques
│   └── forgemagie.ts               # + filterRunes
└── features/
    ├── hdv/
    │   ├── HdvPage.tsx             # source de l'onglet (objets ou runes), filtre type/stat, légende
    │   └── useLatestOrigins.ts     # déplacé depuis forgemagie/RunesTab.tsx
    └── forgemagie/
        ├── ForgemagiePage.tsx      # onglets Sessions et Profil
        ├── ProfileTab.tsx          # + CaptureImport sur son propre profil, relecture après import
        ├── CaptureImport.tsx       # message « serveur » adapté à l'onglet Profil
        └── RunesTab.tsx            # SUPPRIMÉ

tests/
├── unit/hdv-domain.test.ts, forgemagie-domain.test.ts
├── integration/hdv-page.test.tsx, forgemagie-page.test.tsx
└── e2e/hdv-price-entry.spec.ts, forgemagie.spec.ts
```

**Structure Decision**: structure existante ; les runes rejoignent `src/features/hdv/`.

## Amendements aux specs existantes

À noter en fin de spec lors de l'implémentation :
- specs/023 : FR-002 (quatre onglets, dont Runes).
- specs/025 : US4 et FR-017 (la liste des runes est dans la page HDV), US5 (import dans l'onglet
  Profil).

## Complexity Tracking

Aucune violation.
