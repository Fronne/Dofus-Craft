# Implementation Plan: Mise en évidence des prix de ressources obsolètes

**Branch**: `008-stale-resource-highlight` | **Date**: 2026-09-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-stale-resource-highlight/spec.md`

## Summary

Colorer la ligne d'une ressource (`ResourcePriceInput`, le composant `.price-line` utilisé dans
`RecherchePage`) en orange quand son prix (`ResourcePrice.updatedAt`) a entre 3 et 7 jours, et en
rouge à partir de 7 jours, pour signaler visuellement un prix probablement obsolète. Approche :
une fonction pure de classification d'âge dans `src/domain/`, appliquée comme classe CSS
conditionnelle sur `.price-line`, réutilisant les tokens de couleur `--warning`/`--danger` déjà
définis dans `theme.css` (aucune nouvelle couleur, aucun nouvel état serveur/worker).

## Technical Context

**Language/Version**: TypeScript 5 / React 19 (Vite)

**Primary Dependencies**: React 19, react-router-dom — aucune nouvelle dépendance requise

**Storage**: N/A — utilise le champ `updatedAt` déjà présent sur `ResourcePrice` (client-side, pas de changement de schéma worker/D1)

**Testing**: Vitest + Testing Library (`tests/unit`), suit les conventions existantes (`outlier-threshold.test.ts`, `resource-price-input.test.tsx`)

**Target Platform**: Application web SPA (navigateur), même surface que le reste de Dofus Craft

**Project Type**: Single project (frontend React + worker Cloudflare existant, non affecté ici)

**Performance Goals**: Négligeable — calcul de différence de dates en O(1) par ligne, déjà recalculé au même rythme que `formatRelativeTime`

**Constraints**: Purement visuel ; ne doit pas modifier les calculs de comparaison ni bloquer une action (cf. Assumptions du spec) ; doit rester visuellement distinct de l'indicateur `communityMeta.stale` existant (FR-008)

**Scale/Scope**: Un seul composant UI concerné (`ResourcePriceInput` / `.price-line`), pas de nouvel écran

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Accurate, Traceable Game Data** — PASS. La fonctionnalité rend explicite qu'un prix est
  potentiellement daté au lieu de le présenter comme fiable sans nuance ; elle s'appuie sur
  `updatedAt`, une donnée déjà tracée.
- **II. Correctness Before Optimization** — PASS. La classification d'âge (normal/orange/rouge)
  sera une fonction pure testée aux limites (3j, 7j) ; aucune règle de calcul de coût existante
  n'est modifiée.
- **III. User Decisions Remain Explainable** — PASS. Le texte "Dernière mise à jour : ..." déjà
  affiché reste visible (FR-006) ; la couleur ne fait qu'accentuer une information déjà montrée à
  l'utilisateur, sans logique cachée.
- **IV. Small, Cohesive Changes** — PASS. Un seul module de domaine ajouté, une classe CSS
  conditionnelle, réutilisation des tokens de couleur existants ; aucune nouvelle dépendance ni
  abstraction superflue.
- **V. Safe Handling of User Data** — PASS. Aucune nouvelle donnée utilisateur collectée ; aucune
  action destructive introduite.

Aucune violation à justifier.

## Project Structure

### Documentation (this feature)

```text
specs/008-stale-resource-highlight/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

Pas de répertoire `contracts/` : la fonctionnalité est purement client-side et ne modifie ni
n'ajoute aucune interface (API worker, schéma D1) exposée à un autre système.

### Source Code (repository root)

```text
src/
├── domain/
│   ├── price-age.ts                # NOUVEAU : seuils (3j/7j) + classification pure de l'âge d'un prix
│   └── time.ts                     # existant, réutilisé (formatRelativeTime reste inchangé)
├── features/
│   └── comparison/
│       └── ResourcePriceInput.tsx  # MODIFIÉ : applique une classe CSS selon price-age
└── styles/
    ├── theme.css                   # existant : --warning/--warning-soft/--danger déjà définis, réutilisés tels quels
    └── global.css                  # MODIFIÉ : règles `.price-line--stale` / `.price-line--expired`

tests/
└── unit/
    ├── price-age.test.ts           # NOUVEAU : tests de la classification pure aux limites (3j, 7j)
    └── resource-price-input.test.tsx  # MODIFIÉ : vérifie la classe CSS appliquée selon updatedAt
```

**Structure Decision**: Projet unique existant (frontend React sous `src/`, tests sous `tests/`,
worker Cloudflare sous `worker/` non touché par cette fonctionnalité). Aucune nouvelle couche ni
répertoire introduits ; la fonctionnalité suit le même découpage que la fonctionnalité voisine
`specs/007-outlier-confirmation` (règle pure dans `src/domain/`, consommée par le composant UI).

## Complexity Tracking

*Aucune violation de la constitution à justifier — section non applicable.*
