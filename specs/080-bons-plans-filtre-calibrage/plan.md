# Implementation Plan: Filtre par exo et calibrage des bons plans

**Branch**: `080-bons-plans-filtre-calibrage` | **Date**: 2026-11-02 | **Spec**: [spec.md](spec.md)

## Summary

Le calcul pur accepte un calibrage facultatif. Le hook garde les annonces lues et rejuge à chaque changement de calibrage. La page remplace ses filtres par le sélecteur de rune de Brisage, et ajoute un panneau de calibrage gardé dans le navigateur.

## Technical Context

**Language/Version**: TypeScript, React (existant)
**Primary Dependencies**: aucune nouvelle
**Storage**: `localStorage` du navigateur, clé `dofus-craft-deal-calibration`
**Testing**: Vitest
**Target Platform**: navigateur
**Constraints**: Worker et outil inchangés (FR-017). Sans calibrage, résultats identiques à 079 (FR-016).

## Constitution Check

- **I. Données traçables** : OK. Le calibrage est propre au joueur et les valeurs par défaut restent celles de 079.
- **II. Correction d'abord** : OK. Tests de la règle, du filtre, de la lecture de la sauvegarde.
- **III. Décisions explicables** : OK. Le seuil appliqué reste affiché.
- **IV. Petits changements** : OK. `RunePicker` est réutilisé, pas recopié.
- **V. Données utilisateur** : OK. Rien ne quitte le navigateur (FR-013).

## Source Code

```text
src/domain/good-deals.ts                      # DealCalibration, ExoFilter
src/features/good-deals/deal-calibration.ts   # lecture et écriture du calibrage
src/features/good-deals/useGoodDeals.ts       # rejuge selon le calibrage
src/features/good-deals/CalibrationPanel.tsx  # panneau
src/features/good-deals/BonsPlansPage.tsx     # sélecteur d'exo, panneau
src/features/brisage/ExoRow.tsx               # RunePicker exporté
src/styles/global.css
tests/unit/good-deals.test.ts, tests/unit/deal-calibration.test.ts, tests/integration/bons-plans-page.test.tsx
```

## Décisions

- **Écart vide** : pour une stat à écart fixe, vider le champ veut dire « jamais de défaut » (`null`). Pour la Vitalité et les Dommages Critiques, vider le champ rend la règle par défaut (FR-010). Une stat sans écart par défaut reste sans défaut.
- **Sauvegarde** : seuls les écarts aux valeurs par défaut sont gardés. Une valeur invalide est ignorée, valeur par valeur.
- **Icône d'exo** : la rune de la stat, comme sur Brisage. Une stat sans rune ne s'affiche pas dans le sélecteur.
