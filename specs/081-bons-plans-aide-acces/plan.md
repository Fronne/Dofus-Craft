# Implementation Plan: Aide du calibrage et accès réservé aux bons plans

**Branch**: `081-bons-plans-aide-acces` | **Date**: 2026-11-02 | **Spec**: [spec.md](spec.md)

## Summary

Le panneau de calibrage gagne une explication et des titres de colonnes. Un réglage du navigateur, calqué sur le classement Brisage (specs/072), ouvre la page Bons plans à un navigateur même quand l'administration la coupe.

## Technical Context

**Language/Version**: TypeScript, React (existant)
**Primary Dependencies**: aucune nouvelle
**Storage**: `localStorage`, clé `dofus-craft-bons-plans-access`
**Testing**: Vitest
**Target Platform**: navigateur
**Constraints**: calcul, Worker et outil inchangés (FR-011).

## Constitution Check

- **I. Données traçables** : OK. Aucune donnée nouvelle.
- **II. Correction d'abord** : OK. Tests de l'accès et de l'affichage.
- **III. Décisions explicables** : OK. C'est l'objet de l'US1.
- **IV. Petits changements** : OK. Même forme que `brisage-ranking-access.ts`.
- **V. Données utilisateur** : OK. Rien ne quitte le navigateur.

## Source Code

```text
src/persistence/bons-plans-access.ts          # nouveau : lecture et application de ?bonsplans=
src/app/AppShell.tsx                          # réglages vus par le menu et les routes
src/features/good-deals/CalibrationPanel.tsx  # explication, titres de colonnes
src/styles/global.css                         # liste sur une colonne, titres alignés
tests/unit/bons-plans-access.test.ts, tests/integration/site-pages-toggle.test.tsx, tests/integration/bons-plans-page.test.tsx
```

## Décisions

- **Lecture dans `AppShell`** : le menu doit montrer le lien sur toutes les pages (edge case), donc la lecture ne peut pas être dans la page Bons plans, à la différence de Brisage.
- **Réglages surchargés** : `AppShell` dérive `siteSettings` avec `bonsPlansPage: true`. Le menu et `guarded` n'ont rien d'autre à savoir. `useSiteSettings` et l'administration ne changent pas.
- **Liste sur une colonne** : avec plusieurs colonnes, une ligne de titres ne peut pas s'aligner. Les titres sont collants dans la zone qui défile, avec des largeurs fixes pour coïncider avec les lignes.
- **Aide repliée** : un bouton d'information ouvre l'explication dans une bulle, sur le modèle de `RunePicker` (clic à côté, Échap).
- **Niveaux tirés de `IMPORTANCE_LEVELS`** : le texte ne peut pas diverger de la liste du calcul.
