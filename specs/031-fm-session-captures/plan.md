# Implementation Plan: Captures d'une séance FM et rattachement d'objet par son nom

**Branch**: `031-fm-session-captures` (développée sur `claude/charming-goodall-wv8us5`) | **Date**: 2026-09-30 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/031-fm-session-captures/spec.md`

## Summary

Le détail d'une séance (`GET /fm/sessions/:id`) renvoie en plus la liste de ses **captures** : pour
chacune, sa date, son auteur (masqué s'il est privé), sa provenance, son montant et ses lignes
d'achat regroupées par objet, calculées comme le récap global. Le site les affiche dans une section
« Captures » repliable, sous le tableau « Achats ».

Le rattachement (`PUT /fm/sessions/:id/item`) accepte, à la place de `fmItemId`, un équipement du
catalogue (`item`) : le Worker crée l'objet en FM et rattache la séance dans un même lot D1, et
supprime l'objet créé si la séance n'a pas pu être rattachée. Sur le site, la liste déroulante est
remplacée par un champ de recherche qui propose d'abord les objets en FM du joueur, puis les
équipements du catalogue (même recherche que la création d'objet). Aucune migration, aucun
changement du bot. Détails : [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5.7 (site et Worker)

**Primary Dependencies**: React 19, Vite ; Cloudflare Workers + D1 (inchangées)

**Storage**: D1 — tables existantes `fm_captures`, `fm_purchase_lines`, `fm_items`, `fm_sessions` ;
aucune migration

**Testing**: Vitest (Worker sur `tests/support/fm-worker.ts`, intégration jsdom de la page
Forgemagie), Playwright (e2e avec API simulée)

**Target Platform**: navigateurs récents ; Cloudflare Workers

**Project Type**: application web (site statique + Worker d'API)

**Performance Goals**: le détail d'une séance reste une seule requête ; deux lectures SQL de plus
(captures, lignes par capture)

**Constraints**: API rétrocompatible (champ `captures` ajouté, `fmItemId` toujours accepté) ; le site
tolère une API sans `captures` (liste vide) ; visibilité de specs/030 inchangée

**Scale/Scope**: 10 à 20 joueurs ; quelques dizaines de captures par séance au plus

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principe | Vérification | Statut |
|---|---|---|
| I. Données traçables | Chaque montant de la séance est rattaché à la capture qui l'a apporté (auteur, date, provenance) ; les lignes sont affichées telles que lues. | ✅ |
| II. Exactitude avant optimisation | Le récap par capture utilise la même règle (`itemSummaries`, arrondi au kama) que le récap global ; tests : somme des captures = total, regroupement d'une rune achetée deux fois, capture sans ligne. | ✅ |
| III. Décisions explicables | La section « Captures » explique d'où vient chaque rune du tableau « Achats ». | ✅ |
| IV. Changements petits et cohérents | Un champ ajouté à une réponse, une variante du corps d'une route, un composant de recherche qui réutilise celle d'`EquipmentPicker` ; aucune dépendance. | ✅ |
| V. Données utilisateur | Aucune donnée nouvelle ; l'auteur d'une capture est masqué par `playerView` s'il est privé ; les captures ne sont lues que pour une séance du joueur (specs/030). | ✅ |

Re-vérification après la conception : inchangée.

## Project Structure

### Documentation (this feature)

```text
specs/031-fm-session-captures/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/fm-session-captures-api.md
├── checklists/requirements.md
└── tasks.md            # /speckit-tasks
```

### Source Code (repository root)

```text
worker/src/fm/
├── reads.ts            # sessionDetail : + captures
└── items.ts            # attachSession : + variante « item » (création + rattachement)

src/
├── domain/forgemagie.ts               # types FmCapture ; filtre des objets en FM par nom
├── services/fm-api.ts                 # validation de `captures` ; attachFmSession(item)
└── features/forgemagie/
    ├── SessionDetail.tsx              # section « Captures » ; rattachement par recherche
    ├── SessionCaptures.tsx            # nouveau : captures repliables et leur récap
    ├── SessionItemSearch.tsx          # nouveau : recherche objets en FM + catalogue
    └── EquipmentPicker.tsx            # recherche du catalogue extraite en hook réutilisable

tests/
├── unit/fm-reads.test.ts              # captures du détail
├── unit/fm-items.test.ts              # rattachement avec création
├── unit/forgemagie-domain.test.ts     # filtre par nom
├── integration/forgemagie-page.test.tsx
└── e2e/forgemagie.spec.ts
```

**Structure Decision**: même découpage que specs/027 et 030 : lecture dans `reads.ts`, écriture dans
`items.ts`, un composant par bloc du détail de séance.

## Complexity Tracking

Aucune violation de la constitution.
