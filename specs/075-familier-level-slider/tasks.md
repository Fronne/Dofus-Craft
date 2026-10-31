# Tasks: Barre de progression glissable du familier

**Input**: `specs/075-familier-level-slider/` (spec.md, plan.md, research.md, data-model.md, quickstart.md)

Format : `- [ ] T### [P] [US#] Description avec chemin de fichier`

## Phase 1: Fondation

- [x] T001 Ajouter à `src/domain/pet-xp.ts` la fonction pure `levelAtProgress(fraction, curve = PET_XP_CURVE)` : renvoie le niveau entier dont le début d'XP est ≤ `fraction × maxTotalXp(curve)`, borné à `PET_MIN_LEVEL`..`PET_MAX_LEVEL` (fraction hors 0..1 ramenée aux bornes, valeur non numérique traitée comme 0).
- [x] T002 [P] Tests unitaires de `levelAtProgress` dans `tests/unit/pet-xp.test.ts` : fraction 0 → niveau 0, fraction 1 → niveau 100, fraction hors bornes, valeur NaN, et pour chaque niveau n de 0 à 100 `levelAtProgress(PET_XP_CURVE[n] / maxTotalXp())` = n (début exact de niveau).

## Phase 2: User Story 1 - Choisir le niveau en glissant la barre (P1)

**Test indépendant** : glisser ou piloter au clavier la barre : le niveau actuel, l'XP totale (début exact du niveau) et « XP à donner » changent, le niveau visé reste.

- [x] T003 [US1] Dans `src/features/pets/PetObjectiveBanner.tsx`, rendre la piste glissable : ajouter la prop `onLevelChange: (level: number) => void` ; gérer `pointerdown/move/up` avec `setPointerCapture`, position → fraction → `levelAtProgress` ; n'appeler `onLevelChange` que quand le niveau change.
- [x] T004 [US1] Dans le même composant, passer la piste en `role="slider"` focusable (`tabIndex=0`, `aria-valuemin={PET_MIN_LEVEL}`, `aria-valuemax={PET_MAX_LEVEL}`, `aria-valuenow` = niveau, `aria-valuetext` « Niveau N, XX,X % »), avec flèches droite/haut (+1), gauche/bas (−1), Début (niveau minimum) et Fin (niveau maximum).
- [x] T005 [US1] Dans `src/features/pets/FamilierPage.tsx`, passer `onLevelChange={(level) => setText((current) => withField(current, 'currentLevel', String(level)))}` à `PetObjectiveBanner` (le niveau visé n'est pas touché ; l'XP totale s'aligne sur `PET_XP_CURVE[level]`).
- [x] T006 [P] [US1] Styles de la piste dans `src/styles/global.css` (bloc `.pet-progress-track`) : `touch-action: none`, curseur `grab`/`grabbing`, zone de saisie d'au moins 28 px de haut, anneau de focus visible sur le repère.
- [x] T007 [US1] Tests d'intégration dans `tests/integration/familier-page.test.tsx` : flèche droite augmente le niveau et met l'XP totale au début du niveau ; Début → niveau 0, Fin → niveau 100 ; avec un niveau visé de 60, atteindre un niveau supérieur laisse le niveau visé à 60 et affiche « Aucune XP à donner » ; une XP totale tapée en plus est remplacée par le début du niveau.

## Phase 3: User Story 2 - Bulle de niveau et cohérence avec les champs (P2)

**Test indépendant** : taper 70 dans « Niveau actuel » place le repère au niveau 70 ; la bulle apparaît pendant le glissement et disparaît au relâchement.

- [x] T008 [US2] Dans `PetObjectiveBanner.tsx`, ajouter l'état local « glissement en cours » et afficher une bulle « Niveau N » au-dessus du repère pendant le geste, retirée au relâchement ou à la perte du pointeur.
- [x] T009 [P] [US2] Styles de la bulle dans `src/styles/global.css` (thèmes sombre et clair, sans déborder de la barre aux extrémités).
- [x] T010 [US2] Tests d'intégration dans `tests/integration/familier-page.test.tsx` : taper 70 dans « Niveau actuel » donne `aria-valuenow` 70 sur la barre ; une saisie invalide suivie d'un choix sur la barre remplace la saisie ; la bulle n'est pas affichée hors glissement.

## Phase 4: Finitions

- [x] T011 Mettre à jour `specs/055-refonte-xp-familier/spec.md` d'une note de révision renvoyant à `specs/075-familier-level-slider` (la barre du bandeau objectif est désormais glissable).
- [x] T012 Lancer `npx vitest run tests/unit/pet-xp.test.ts tests/integration/familier-page.test.tsx`, `npx tsc -b`, puis vérifier au navigateur le scénario de `quickstart.md` (souris, clavier, mode mobile).

## Dépendances

T001 → T002, T003 → T004 → T005 → T007 ; T006 en parallèle de T003-T005 ; T008 après T003 ; T009 en parallèle ; T010 après T008 ; T011-T012 à la fin.

## Stratégie

MVP = phase 2 (glissement + clavier). La bulle (phase 3) s'ajoute ensuite sans changer le comportement.
