# Implementation Plan: Refonte de la page XP Familier

**Branch**: `055-refonte-xp-familier` | **Date**: 2026-10-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/055-refonte-xp-familier/spec.md`

## Summary

La page XP Familier passe d'un bandeau de saisie + une liste à quatre blocs : bandeau objectif avec
barre de progression, podium des 3 ressources les moins chères, fiche d'une ressource précise, et
tableau des autres ressources avec leur rang. Les règles de calcul de la spec 022 ne changent pas :
on ajoute dans `src/domain/pet-xp.ts` quelques fonctions pures qui les composent (progression,
classement, podium, fiche), testées à part, et on découpe `FamilierPage.tsx` en composants de
présentation. Style : celui du site (spec 051), classes `pet-*` existantes étendues.

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 18

**Primary Dependencies**: Vite 5, react-router-dom ; aucune nouvelle dépendance

**Storage**: préférences existantes sur l'appareil (`pet-levels-preference`,
`pet-max-quantity-preference`) ; la ressource visée n'est pas mémorisée (spec FR-008)

**Testing**: Vitest + Testing Library (unit, integration), Playwright (e2e)

**Target Platform**: navigateur, site statique sur Cloudflare Workers (assets)

**Project Type**: application web front seule (SPA)

**Performance Goals**: recalcul instantané à la saisie (≈ 2 000 ressources, déjà le cas aujourd'hui)

**Constraints**: aucun changement de calcul ni de donnée (spec FR-010) ; thèmes sombre et clair ;
375 px sans défilement horizontal (SC-004)

**Scale/Scope**: une page, ~4 composants, ~5 fonctions de domaine

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Données traçables** : aucune donnée nouvelle ; prix, dates et provenance inchangés. ✅
- **II. Exactitude d'abord** : les nouveaux chiffres (progression, rang, écarts, part de l'objectif)
  sont des fonctions pures du domaine avec tests unitaires (cas normaux, bornes 0 / 100, moins de
  3 ressources, ressource sans prix, au-delà du plafond). Les chiffres existants viennent des
  fonctions actuelles (SC-002). ✅
- **III. Décisions explicables** : chaque carte et la fiche montrent quantité, prix unitaire, XP par
  unité et âge du prix ; « Prix inconnu » et « Non classée » sont explicites. ✅
- **IV. Changements petits et cohérents** : présentation seulement, pas de nouvelle abstraction
  générique (la liste de suggestions est faite de boutons simples, pas d'un composant combobox). ✅
- **V. Données utilisateur** : rien de nouveau n'est conservé. ✅

Post-design : inchangé, aucune violation.

## Project Structure

### Documentation (this feature)

```text
specs/055-refonte-xp-familier/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── ui-contract.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── domain/
│   └── pet-xp.ts                  # + petXpProgress, rankPetFoods, petFoodPodium, petFoodTarget, formatObjectiveShare
├── features/pets/
│   ├── FamilierPage.tsx           # orchestre les 4 blocs (état, prix, saisies)
│   ├── PetObjectiveBanner.tsx     # bloc 1 : saisies, barre de progression, XP à donner, Almanax
│   ├── PetFoodPodium.tsx          # bloc 2 : 3 cartes
│   ├── PetFoodTarget.tsx          # bloc 3 : recherche + fiche
│   └── usePetFoodPrices.ts        # inchangé
└── styles/
    └── global.css                 # section « specs/022 … Familier page » étendue

tests/
├── unit/pet-xp.test.ts            # + nouvelles fonctions
├── integration/familier-page.test.tsx   # adapté aux 4 blocs
└── e2e/familier-page.spec.ts      # adapté
```

**Structure Decision**: application front unique ; on suit l'organisation existante
(`src/domain` pour les règles pures, `src/features/pets` pour la page, `src/styles/global.css`).

## Complexity Tracking

Aucune violation de la constitution.
