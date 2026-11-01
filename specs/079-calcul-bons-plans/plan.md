# Implementation Plan: Calcul des bons plans selon la valeur de marché

**Branch**: `079-calcul-bons-plans` | **Date**: 2026-11-02 | **Spec**: [spec.md](spec.md)

## Summary

Changer la règle pure de `src/domain/good-deals.ts` : qualité avec un coefficient d'importance par stat, et comparabilité élargie au palier des exos et aux défauts d'écart au maximum. Le hook passe déjà `item.effects`, le Worker et l'affichage ne changent pas.

## Technical Context

**Language/Version**: TypeScript, React (existant)
**Primary Dependencies**: aucune nouvelle
**Storage**: aucun changement
**Testing**: Vitest (`tests/unit/good-deals.test.ts`, `tests/integration/bons-plans-page.test.tsx`)
**Target Platform**: navigateur, calcul côté site
**Project Type**: application web
**Performance Goals**: même ordre de grandeur que 078 (quelques milliers d'annonces jugées au chargement)
**Constraints**: `src/domain/brisage.ts` inchangé (FR-007), Worker inchangé (FR-013)
**Scale/Scope**: un fichier de règle et ses tests

## Constitution Check

- **I. Données traçables** : OK. Les règles viennent du propriétaire, les coefficients sont signalés comme estimations dans le code.
- **II. Correction d'abord** : OK. Tests des cas normaux, des limites (poids 30, écart exact, maximum 20) et des entrées incomplètes (ligne absente, bornes inconnues).
- **III. Décisions explicables** : OK. La référence affichée reste la même notion. Afficher les défauts n'est pas demandé.
- **IV. Petits changements** : OK. Pas de refactoring, pas de nouvelle configuration.
- **V. Données utilisateur** : sans objet.

## Project Structure

### Documentation (this feature)

```text
specs/079-calcul-bons-plans/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── tasks.md
```

Pas de `contracts/` : aucune interface externe ne change.

### Source Code

```text
src/domain/good-deals.ts        # coefficients, écarts, palier, défauts, comparabilité
tests/unit/good-deals.test.ts   # nouvelles règles et limites
```

## Complexity Tracking

Aucune violation de la constitution.
