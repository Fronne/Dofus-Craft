# Implementation Plan: Forgemagie privée — chacun ne voit que ses séances

**Branch**: `030-private-fm-sessions` | **Date**: 2026-09-30 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/030-private-fm-sessions/spec.md`

## Summary

Chaque joueur connecté ne voit plus que ses propres séances FM, son propre profil, ses objets en FM et
ses salons. La règle est appliquée par l'API du Worker (`worker/src/fm/`) : toute séance, tout profil,
objet ou salon d'un autre joueur répond « introuvable » (404), comme une ressource inexistante. La page
Forgemagie retire le sélecteur « Voir le profil de » et corrige les textes qui parlaient de visibilité
publique. Le réglage public / privé reste enregistré, sans effet, pour un futur affichage public. Aucune
migration, aucun changement du bot.

## Technical Context

**Language/Version**: TypeScript 5 (React 19 + Vite pour le site ; Cloudflare Worker pour l'API)

**Primary Dependencies**: aucune nouvelle ; React, Cloudflare Workers runtime, D1

**Storage**: Cloudflare D1 `dofus-craft-community-prices` — tables `fm_*` existantes, **aucune
migration**

**Testing**: Vitest (unitaires Worker avec `tests/support/sqlite-d1.ts` et `tests/support/fm-worker.ts`,
intégration React avec Testing Library), Playwright (`tests/e2e/forgemagie.spec.ts`)

**Target Platform**: navigateur (site `dofus-craft`) + Cloudflare Worker
(`dofus-craft-community-price-api`)

**Project Type**: application web (site statique + API Worker)

**Performance Goals**: inchangés ; les requêtes filtrées portent sur quelques dizaines de séances

**Constraints**: aucune donnée d'un autre joueur ne doit sortir de l'API (SC-001) ; réponses
indiscernables entre « à un autre » et « inexistant » (SC-003)

**Scale/Scope**: groupe fermé de 10 à 20 joueurs ; 5 séances et 2 joueurs en production aujourd'hui

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principe | Vérification | Statut |
|---|---|---|
| I. Données traçables | Aucune donnée de jeu ni calcul modifié ; les montants d'une séance vue par son propriétaire sont identiques (FR-012). | ✅ |
| II. Exactitude avant optimisation | Règles de visibilité testées automatiquement pour chaque route (cas normal, séance d'un autre, séance sans propriétaire, identifiant inventé). | ✅ |
| III. Décisions explicables | Les textes n'expliquent plus une absence par un réglage qui n'a plus d'effet (research R8, R9). | ✅ |
| IV. Changements petits et cohérents | Restriction de lectures existantes, pas de nouvelle abstraction ni dépendance ; route `/fm/players` gardée pour ne rien casser. | ✅ |
| V. Données utilisateur | Renforce la protection des dépenses personnelles ; aucune nouvelle donnée collectée ; rien de supprimé. | ✅ |

Re-vérification après Phase 1 : inchangée, aucune violation.

## Project Structure

### Documentation (this feature)

```text
specs/030-private-fm-sessions/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── fm-private-reads.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
worker/src/fm/
├── reads.ts             # liste / détail des séances filtrés par propriétaire ; profil et liste des
│                        #   joueurs limités au viewer ; sessions[].canOpen ; canAttach
├── items.ts             # récap d'objet réservé au propriétaire ; rattacher / détacher : séance et
│                        #   objet au viewer, sinon 404
├── site-sessions.ts     # arrêt / renvoi : 404 au lieu de 403
└── channels.ts          # rattachement d'un salon : 404 au lieu de 403

src/
├── domain/forgemagie.ts               # type du profil : sessions[].canOpen
└── features/forgemagie/
    ├── ProfileTab.tsx                 # plus de sélecteur ni d'appel à la liste des joueurs ;
    │                                  #   texte du réglage Visibilité ; lien de séance si canOpen
    ├── FmItemRecap.tsx                # texte « Objet introuvable »
    ├── FmChannelsSection.tsx          # toujours sur son propre profil (isMine)
    └── SessionsTab.tsx                # texte de l'onglet (ses séances)

tests/
├── unit/fm-reads.test.ts, fm-items.test.ts, fm-site-sessions.test.ts, fm-channels.test.ts
├── integration/forgemagie-page.test.tsx
└── e2e/forgemagie.spec.ts
```

**Structure Decision**: structure existante du projet (site `src/`, API `worker/`, tests `tests/`) ;
aucun nouveau fichier de code.

## Complexity Tracking

Aucune violation de la constitution à justifier.
