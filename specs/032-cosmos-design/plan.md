# Implementation Plan: Design « Cosmos » au choix

**Branch**: `claude/peaceful-galileo-go5rny` (fonctionnalité 032) | **Date**: 2026-10-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/032-cosmos-design/spec.md`

## Summary

Ajouter « Cosmos » comme troisième valeur de la préférence de design existante (specs/012) :
`designs` gagne une entrée, `applyDesign` pose `data-design="cosmos"` sur `<html>`, et une feuille
`src/styles/design-cosmos.css`, dont chaque règle est limitée à `:root[data-design="cosmos"]`,
redéfinit les jetons de couleur (sombre et clair) puis habille les composants existants à la
manière des fenêtres de Dofus 3. La page Recherche passe en trois colonnes pleine hauteur sur
grand écran par CSS seul (`:has()` + `display: contents`), sans toucher au JSX : Classique et
Nouveau restent strictement identiques.

## Technical Context

**Language/Version**: TypeScript 5.7, React 19, CSS

**Primary Dependencies**: Vite 5 ; ajout de `@fontsource-variable/nunito` (police servie avec
l'application, comme Inter pour « Nouveau »)

**Storage**: localStorage, clé existante `craftcheck-design-choice` (valeur `cosmos` en plus)

**Testing**: Vitest + Testing Library (unitaires et intégration), Playwright (e2e existants)

**Target Platform**: navigateurs récents (ordinateur et mobile) ; `:has()` requis pour la mise en
page trois colonnes (Chrome/Edge 105+, Safari 15.4+, Firefox 121+) — sans `:has()`, la page
garde la disposition empilée, entièrement fonctionnelle

**Project Type**: application web (SPA) + Workers Cloudflare (non concernés)

**Performance Goals**: changement de design < 1 s (attribut posé de façon synchrone)

**Constraints**: aucune modification de comportement, de libellé ni de JSX des pages ; règles
CSS toutes limitées au sélecteur Cosmos ; images du jeu inchangées ; `prefers-reduced-motion`

**Scale/Scope**: 1 nouvelle feuille CSS (~400 lignes), 3 fichiers TS modifiés, 2 tests étendus,
1 test ajouté

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Données traçables** : aucune donnée ni calcul touchés. ✅
- **II. Correction avant optimisation** : aucune règle de calcul modifiée ; tests existants
  conservés, test de portée CSS ajouté. ✅
- **III. Décisions explicables** : tous les montants, verdicts, dates et entrées restent
  affichés (seule l'apparence change ; aucun élément masqué). ✅
- **IV. Changements petits et cohérents** : une valeur de préférence et une feuille isolée ; une
  dépendance (police) justifiée par FR-006 et alignée sur le précédent Inter. ✅
- **V. Données utilisateur** : préférence locale uniquement (FR-013). ✅

Re-check après Phase 1 : inchangé, aucune violation.

## Project Structure

### Documentation (this feature)

```text
specs/032-cosmos-design/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/design-attribute.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── domain/designs.ts                 # + { id: 'cosmos', label: 'Cosmos' }
├── persistence/design-preference.ts  # applyDesign pose data-design pour modern ET cosmos
├── main.tsx                          # importe design-cosmos.css
└── styles/design-cosmos.css          # NOUVEAU, tout sous :root[data-design="cosmos"]

tests/
├── unit/design-preference.test.ts        # + cas cosmos
├── unit/design-cosmos-css-scope.test.ts  # NOUVEAU, même garde que design-modern
└── integration/design-setting.test.tsx   # + choix Cosmos dans Paramètres
```

**Structure Decision**: application unique existante ; la fonctionnalité suit exactement le
patron de specs/012 (préférence + feuille isolée).

## Complexity Tracking

Aucune violation à justifier.
