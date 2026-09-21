# Implementation Plan: Fiche d'arme façon tooltip du jeu

**Branch**: `009-weapon-tooltip-layout` | **Date**: 2026-09-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-weapon-tooltip-layout/spec.md`

## Summary

Pour un objet identifié comme une arme (super-type DofusDB "Arme"), afficher dans `ItemDetail` un
bloc d'informations de combat (coût PA, portée, lancers par tour, critique, bonus critique, zone)
séparé de la liste des effets, puis répartir les effets entre une section "Effets de l'arme"
(dommages/vol propres à l'arme) et une section "Effets" (bonus de caractéristiques). Approche :
étendre les types DofusDB déjà consommés par `getItemDetail` avec les champs de combat déjà
présents dans la réponse `/items/{id}`, dériver un `WeaponInfo` optionnel et marquer chaque
`ItemStat` avec `isWeaponEffect` (à partir du champ `category` déjà fourni par DofusDB), sans
requête réseau supplémentaire. Les objets non-armes gardent l'affichage actuel à l'identique.

## Technical Context

**Language/Version**: TypeScript 5 / React 19 (Vite)

**Primary Dependencies**: React 19 — aucune nouvelle dépendance requise

**Storage**: N/A — dérivé à la volée depuis la réponse DofusDB déjà chargée par `getItemDetail`
(pas de nouveau schéma worker/D1, pas de nouvelle clé IndexedDB)

**Testing**: Vitest + Testing Library (`tests/unit`), suit les conventions existantes
(`catalogue-repository` est déjà couvert indirectement ; ce plan ajoute des tests dédiés au
mapping `WeaponInfo`/`isWeaponEffect` et au rendu conditionnel des sections dans `ItemDetail`)

**Target Platform**: Application web SPA (navigateur), même surface que le reste de Dofus Craft

**Project Type**: Single project (frontend React + worker Cloudflare existant, non affecté ici)

**Performance Goals**: Négligeable — dérivation de quelques champs supplémentaires par appel à
`getItemDetail`, déjà appelé une fois par consultation de fiche

**Constraints**: Purement présentationnel côté fiche d'objet ; ne doit fabriquer aucune valeur
absente des données source (FR-008) ; ne doit pas modifier l'affichage des objets non-armes
(FR-005)

**Scale/Scope**: Un composant de vue concerné (`ItemDetail`) et son mapping de données
(`getItemDetail`/`mapItemStats` dans `catalogue-repository.ts`) ; pas de nouvel écran

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Accurate, Traceable Game Data** — PASS. Tous les nouveaux champs (`apCost`, `range`,
  `minRange`, `criticalHitProbability`, `criticalHitBonus`, `maxCastPerTurn`, `category`)
  proviennent directement de la réponse DofusDB déjà tracée comme source ; une donnée absente est
  omise plutôt que substituée (research.md §4, data-model.md).
- **II. Correctness Before Optimization** — PASS. La classification arme/non-arme et la
  répartition des effets (`isWeaponEffect`) sont des fonctions pures testables aux cas limites
  (portée fixe vs variable, objet sans effet de dommage, objet non-arme).
- **III. User Decisions Remain Explainable** — PASS. Le changement rend plus lisible une
  distinction déjà présente dans les données (dommages d'arme vs bonus passifs) ; aucune logique
  cachée n'est introduite, seule la présentation est réorganisée.
- **IV. Small, Cohesive Changes** — PASS. Aucune nouvelle dépendance ; extension ciblée des types
  DofusDB déjà consommés et du composant `ItemDetail` existant, pas de nouvelle couche
  d'abstraction.
- **V. Safe Handling of User Data** — PASS. Aucune nouvelle donnée utilisateur collectée ; aucune
  action destructive introduite.

Aucune violation à justifier.

## Project Structure

### Documentation (this feature)

```text
specs/009-weapon-tooltip-layout/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

Pas de répertoire `contracts/` : la fonctionnalité est purement client-side (lecture de champs
DofusDB déjà récupérés) et ne modifie ni n'ajoute aucune interface exposée à un autre système
(API worker, schéma D1).

### Source Code (repository root)

```text
src/
├── domain/
│   └── types.ts                    # MODIFIÉ : ItemStat.isWeaponEffect, nouveau type WeaponInfo
├── data/
│   └── catalogue-repository.ts     # MODIFIÉ : getItemDetail calcule weaponInfo ; mapItemStats calcule isWeaponEffect
├── services/
│   ├── dofusdb-types.ts            # MODIFIÉ : DofusDbItem gagne apCost/range/minRange/criticalHitProbability/
│   │                                #           criticalHitBonus/maxCastPerTurn/possibleEffects ; DofusDbItemEffect a déjà `category`
│   └── dofusdb-mappers.ts          # MODIFIÉ (ou nouvelle fonction dédiée) : détection "objet = arme" via super-type 2, réutilisant superTypeId()
└── features/
    └── catalogue/
        └── ItemDetail.tsx          # MODIFIÉ : bloc d'informations d'arme + sections "Effets de l'arme"/"Effets" conditionnelles

tests/
└── unit/
    ├── catalogue-repository.test.ts  # NOUVEAU (ou étendu) : weaponInfo dérivé, isWeaponEffect, portée fixe/variable, objet non-arme
    └── item-detail.test.tsx          # NOUVEAU (ou étendu) : rendu conditionnel des sections et du bloc d'informations
```

**Structure Decision**: Projet unique existant (frontend React sous `src/`, tests sous `tests/`,
worker Cloudflare sous `worker/` non touché par cette fonctionnalité). La fonctionnalité étend le
pipeline de mapping déjà en place (`dofusdb-types.ts` → `dofusdb-mappers.ts`/`catalogue-repository.ts`
→ `ItemDetail.tsx`) plutôt que d'introduire un nouveau module ou une nouvelle couche.

## Complexity Tracking

*Aucune violation de la constitution à justifier — section non applicable.*
