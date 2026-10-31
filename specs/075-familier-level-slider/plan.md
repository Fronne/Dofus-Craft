# Implementation Plan: Barre de progression glissable du familier

**Branch**: `075-familier-level-slider` | **Date**: 2026-10-26 | **Spec**: [spec.md](spec.md)

## Summary

La barre de progression du bandeau objectif (`PetObjectiveBanner`) devient un curseur : le repère se
saisit à la souris, au doigt ou au clavier et fait varier le niveau actuel. Le choix d'un niveau
remplace l'XP totale par le début exact du niveau (`PET_XP_CURVE[niveau]`), ce qui recalcule « XP à
donner » et le pourcentage. La logique de passage position ↔ niveau est une fonction pure du domaine
(testée), le composant ne gère que les gestes.

## Technical Context

**Language/Version**: TypeScript, React 19, Vite (comme le reste du projet)
**Primary Dependencies**: aucune nouvelle (événements pointeur natifs)
**Storage**: aucune nouveauté ; la saisie mémorisée (`setPetLevels`) suit l'XP totale déjà gérée
**Testing**: Vitest + Testing Library (tests unitaires du domaine, test d'intégration de la page)
**Target Platform**: navigateur, souris, tactile et clavier
**Project Type**: application web (SPA)
**Constraints**: aucun changement des calculs ni des données ; thèmes sombre et clair inchangés

## Constitution Check

- I. Données traçables : aucune donnée nouvelle. OK.
- II. Correction avant optimisation : la conversion position → niveau est une fonction pure avec tests
  (bornes 0 et 100, début de niveau exact). OK.
- III. Décisions explicables : l'XP totale affichée reste celle du début du niveau choisi, visible dans
  le champ « XP totale ». OK.
- IV. Changements petits et cohérents : un composant et une fonction de domaine, pas de dépendance. OK.
- V. Données utilisateur : rien de nouveau collecté. OK.

## Décisions de conception (research)

- **Échelle de la barre** : elle reste proportionnelle à l'XP (comme aujourd'hui, 85 ↔ 26,2 %). La
  position du pointeur est convertie en XP, puis en niveau (`levelForTotalXp`, niveau dont le début
  est ≤ XP). Conséquence : les premiers niveaux sont serrés sur la barre ; la bulle « Niveau N », les
  flèches du clavier (±1 niveau) et les champs permettent la précision.
- **Gestes** : événements pointeur avec capture (`setPointerCapture`) et `touch-action: none` sur la
  piste pour ne pas faire défiler la page.
- **Accessibilité** : la piste devient `role="slider"` (valeurs 0..100 en niveaux, `aria-valuetext`
  « Niveau N, XX,X % »), focusable, avec flèches, Début et Fin.
- **Aucun nouvel état** : la page garde un seul état (`text`) ; le composant reçoit un rappel
  `onLevelChange(niveau)` qui appelle `withField(text, 'currentLevel', String(niveau))`, déjà chargé
  d'aligner l'XP totale sur le début du niveau.

## Project Structure

```text
specs/075-familier-level-slider/   spec.md, plan.md, research.md, data-model.md, quickstart.md, tasks.md
src/domain/pet-xp.ts               + levelAtProgress(fraction), levelStartXp déjà couvert par PET_XP_CURVE
src/features/pets/PetObjectiveBanner.tsx   piste glissable, bulle, clavier
src/features/pets/FamilierPage.tsx          rappel onLevelChange
src/styles/*.css                    repère, bulle, état de glissement, curseur
tests/unit/pet-xp.test.ts           levelAtProgress (bornes, début de niveau)
tests/integration/familier-page.test.tsx    clavier, saisie ↔ barre, niveau visé inchangé
```

## Complexity Tracking

Aucune violation de la constitution.
