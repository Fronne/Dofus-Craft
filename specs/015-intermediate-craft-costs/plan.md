# Implementation Plan: Coût de craft des ressources intermédiaires

**Branch**: `015-intermediate-craft-costs` (travail sur `master`, comme les fonctionnalités précédentes) | **Date**: 2026-09-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/015-intermediate-craft-costs/spec.md`

## Summary

Chaque ingrédient d'une recette qui se crafte lui-même (`hasRecipe` côté DofusDB) reçoit un **coût
retenu** : le moins cher entre son prix d'achat (carnet, inchangé) et le coût de sa propre recette,
calculé récursivement sur toute la chaîne ; le joueur peut forcer « acheter » ou « crafter » par
ressource. Le calcul est une fonction pure du domaine (`craft-tree.ts`) qui produit, à partir de
l'arbre de recettes, des prix du carnet et des choix forcés, un **prix effectif par ingrédient de
premier niveau** : la fonction existante `compare()` reste inchangée et reçoit ces prix effectifs à
la place des prix bruts. La fiche (RecherchePage) et la page Suivis (EpinglesPage) passent par le
même assembleur, ce qui garantit un coût identique (FR-011). L'arbre de recettes est chargé
progressivement (une requête `/recipes?resultId=` par ressource craftable, mise en cache), et la
fiche affiche des lignes dépliables récursives réutilisant les champs de prix existants.

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 18

**Primary Dependencies**: React, react-router-dom, Vite ; aucune nouvelle dépendance

**Storage**: carnet de prix existant (IndexedDB, par serveur et par mode) inchangé ; choix forcés
dans `localStorage` (nouvelle clé `craftcheck-ingredient-choices`) ; recettes dans le cache mémoire
existant `cached()` (TTL 24 h)

**Testing**: Vitest + Testing Library (unitaires et intégration), Playwright (e2e existant)

**Target Platform**: navigateurs modernes, ordinateur et mobile (Cloudflare Workers en statique)

**Project Type**: application web front-end seule (SPA) + Worker communautaire existant (non modifié)

**Performance Goals**: premier niveau affiché sans attendre les recettes profondes ; chaîne de trois
niveaux complétée en moins de 3 s (SC-004)

**Constraints**: aucune valeur inventée (constitution, contraintes projet) ; calcul toujours
terminé (cycles) ; coût de recette jamais écrit dans le carnet (FR-008)

**Scale/Scope**: recettes Dofus de 1 à 8 ingrédients, chaînes rarement au-delà de 3 niveaux ;
groupe fermé de ~10-20 joueurs

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principe | Vérification | Statut |
|---|---|---|
| I. Données traçables | Recettes intermédiaires issues de la même source DofusDB et du même adaptateur (`dofusdb-api` / `dofusdb-mappers`) que les recettes d'objets ; recette introuvable → ingrédient non craftable, rien d'inventé (FR-012) | ✅ |
| II. Exactitude avant optimisation | Règles de calcul isolées dans une fonction pure testée : cas normal, égalité, valeurs manquantes, choix forcé sans valeur, cycle, profondeur 3, quantités multipliées | ✅ |
| III. Décisions explicables | Chaque ligne craftable affiche l'option retenue, les deux montants et « automatique »/« forcé » ; valeurs calculées distinguées des prix saisis (FR-005, FR-008) | ✅ |
| IV. Changements petits et cohérents | Un module de domaine, un chargeur de recettes, un composant de ligne récursif ; `compare()` et le carnet inchangés | ✅ |
| V. Données utilisateur | Choix forcés locaux à l'appareil, non partagés, sans donnée personnelle | ✅ |
| Contraintes projet | Source externe derrière l'adaptateur existant ; échec réseau → résultat partiel, jamais fabriqué | ✅ |

Re-vérification après la phase 1 : aucune violation introduite (voir data-model et contrats).

## Project Structure

### Documentation (this feature)

```text
specs/015-intermediate-craft-costs/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── craft-tree.md         # contrat de la fonction de calcul (domaine)
│   └── recipe-tree-ui.md     # contrat d'interface de la fiche et de la page Suivis
└── tasks.md                  # /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── domain/
│   ├── craft-tree.ts                 # NOUVEAU : coût retenu récursif, prix effectifs de 1er niveau
│   ├── craft-comparison.ts           # inchangé (reçoit les prix effectifs)
│   └── types.ts                      # Resource.craftable?, types du coût retenu
├── services/
│   └── dofusdb-mappers.ts            # mapDofusDbResource conserve hasRecipe → craftable
├── data/
│   └── catalogue-repository.ts       # NOUVEAU getResourceRecipe(id) (cached)
├── persistence/
│   └── ingredient-choices.ts         # NOUVEAU : choix forcés (localStorage)
├── features/
│   ├── comparison/
│   │   ├── useRecipeTree.ts          # NOUVEAU : chargement progressif de l'arbre
│   │   ├── useIngredientChoices.ts   # NOUVEAU : lecture/écriture des choix forcés
│   │   └── community-gap-fill.ts     # extrait d'EpinglesPage : médianes → carnet (partagé)
│   ├── search/
│   │   ├── RecherchePage.tsx         # prix effectifs + lignes récursives
│   │   └── IngredientRow.tsx         # NOUVEAU : ligne dépliable (achat/craft/forcer)
│   └── catalogue/
│       └── EpinglesPage.tsx          # même assembleur que la fiche
└── styles/global.css                 # styles des lignes imbriquées et du badge

tests/
├── unit/craft-tree.test.ts           # règles de calcul
├── unit/ingredient-choices.test.ts
├── integration/intermediate-craft-costs.test.tsx   # fiche : dépliage, saisie, forcer
└── integration/epingles-intermediate-costs.test.tsx # Suivis = fiche
```

**Structure Decision**: projet unique existant (`src/` + `tests/`), découpage déjà en place
domaine / services / data / persistence / features ; la fonctionnalité s'y insère sans nouvelle
couche.

## Complexity Tracking

Aucune violation de la constitution à justifier.
