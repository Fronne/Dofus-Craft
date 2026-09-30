# Implementation Plan: Récap de forgemagie par objet

**Branch**: `027-fm-item-recap` | **Date**: 2026-09-30 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/027-fm-item-recap/spec.md`

## Summary

Un joueur déclare ses **objets en FM** (un exemplaire d'équipement du catalogue, avec un nom libre
facultatif) et y rattache, depuis le site, les sessions du bot où il a dépensé. Le Worker gagne une
table `fm_items` et une colonne `fm_sessions.fm_item_id` (migration `0008`), des routes pour créer,
renommer, supprimer un objet et lire son récap, et deux routes pour rattacher ou détacher une
session, sûres en cas de clics simultanés. Les totaux restent calculés à la lecture à partir des
captures. Sur le site : une section « Objets en FM » dans le Profil, un récap par objet, et le
rattachement dans le détail d'une session. Aucun changement du bot. Détails : [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5.7 (site et Worker)

**Primary Dependencies**: React 19, React Router 7, Vite 5 ; Cloudflare Workers + D1 (inchangées)

**Storage**: D1 — table `fm_items`, colonne `fm_sessions.fm_item_id` (migration `0008`)

**Testing**: Vitest (Worker sur la base SQLite en mémoire `tests/support/sqlite-d1.ts` et
`tests/support/fm-worker.ts`, intégration jsdom), Playwright (e2e avec API simulée)

**Target Platform**: navigateurs récents ; Cloudflare Workers

**Project Type**: application web (site statique + Worker d'API)

**Performance Goals**: un récap se lit en une requête ; pas de coût ajouté aux autres pages

**Constraints**: visibilité filtrée dans le Worker (SC-003) ; API rétrocompatible avec le site en
ligne (champs ajoutés seulement) ; migration appliquée avant le déploiement du Worker

**Scale/Scope**: 10 à 20 joueurs ; quelques objets en FM par joueur

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principe | Vérification | Statut |
|---|---|---|
| I. Données traçables | L'objet garde l'identifiant, le nom et l'icône DofusDB de l'équipement choisi ; le récap renvoie aux sessions dont il additionne les totaux. | ✅ |
| II. Exactitude avant optimisation | Totaux calculés à la lecture, avec la même règle que le total d'une session ; tests : somme des sessions, rattachement concurrent, non-participant, détachement, suppression. | ✅ |
| III. Décisions explicables | Le récap liste chaque session rattachée avec son montant, et le détail par rune avec la mention de l'arrondi ; rien n'est estimé. | ✅ |
| IV. Changements petits et cohérents | Une table et une colonne ; réutilisation des lectures de specs/025 (`withPlayers`, `ITEMS_SELECT`, `playerView`) ; aucune dépendance. | ✅ |
| V. Données utilisateur | Pas de nouvelle donnée personnelle (un équipement et un nom libre) ; objets masqués pour un profil privé ; supprimés avec le profil ; suppression d'un objet après confirmation. | ✅ |

Re-vérification après la conception : inchangée.

## Project Structure

### Documentation (this feature)

```text
specs/027-fm-item-recap/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/fm-items-api.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
worker/
├── migrations/0008_add_fm_items.sql   # NOUVEAU
├── schema.sql                         # mêmes ajouts
└── src/fm/
    ├── items.ts                       # NOUVEAU : POST/PATCH/DELETE/GET /fm/items, PUT/DELETE /fm/sessions/{id}/item
    ├── reads.ts                       # fmItem sur les sessions, canAttach/canDetach, fmItems du profil
    ├── me.ts                          # DELETE /fm/me : objets supprimés, sessions détachées
    └── router.ts                      # nouvelles routes

package.json                           # script worker:db:migrate-fm-items

src/
├── domain/forgemagie.ts               # FmOwnedItem, FmItemRecap, FmSessionItem, fmItemDisplayName
├── services/fm-api.ts                 # client des nouvelles routes
└── features/forgemagie/
    ├── FmItemsSection.tsx             # NOUVEAU : liste, ajout (recherche d'équipement), renommer, supprimer
    ├── FmItemRecap.tsx                # NOUVEAU : récap d'un objet
    ├── EquipmentPicker.tsx            # NOUVEAU : recherche dans le catalogue (équipements seulement)
    ├── ProfileTab.tsx                 # section « Objets en FM »
    ├── SessionDetail.tsx              # ligne « Objet », rattacher / détacher
    ├── SessionsTab.tsx                # nom de l'objet sur la carte
    └── ForgemagiePage.tsx             # ouverture du récap d'un objet

tests/
├── unit/fm-items.test.ts              # NOUVEAU (Worker)
├── unit/fm-reads.test.ts, fm-me.test.ts, fm-api.test.ts
├── integration/forgemagie-page.test.tsx
└── e2e/forgemagie.spec.ts
```

**Structure Decision**: structure existante de specs/025 ; le code des objets en FM va dans
`worker/src/fm/items.ts` et `src/features/forgemagie/`.

## Amendements aux specs existantes

- specs/025 : contrat des sessions (`fmItem`, `canAttach`, `canDetach`) et du profil (`fmItems`) ;
  FR-007 (la suppression du profil supprime aussi ses objets en FM).

## Complexity Tracking

Aucune violation.
