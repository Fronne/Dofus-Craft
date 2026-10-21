---

description: "Liste de tâches : lignes à jet négatif, page Brisage"
---

# Tâches : Lignes à jet négatif, page Brisage

**Entrée** : documents de `/specs/067-brisage-lignes-negatives/`

**Prérequis** : plan.md, spec.md, research.md, data-model.md, contracts/page-brisage-negatives.md

**Tests** : inclus, la constitution (principe II) exige des tests automatisés pour toute règle de calcul.

**Organisation** : tâches groupées par scénario utilisateur. Les règles vivent dans `src/domain/brisage.ts` et sont testées sans interface.

## Format : `[ID] [P?] [Story] Description`

- **[P]** : parallélisable (fichiers différents, pas de dépendance)
- **[Story]** : US1 à US3, selon la spec

## Phase 1 : Préparation

- [ ] T001 Vérifier que `npm run test`, `npm run lint` et `npm run build` passent avant toute modification (base propre), depuis le worktree `.claude/worktrees/brisage-lignes-negatives`.

---

## Phase 2 : Fondations (bloque toutes les histoires)

**Objectif** : règle de poids et lecture des données, sans interface.

- [ ] T002 [P] Ajouter `negativeRangesOf(effects)` et `getItemNegativeRanges(id)` dans `src/data/catalogue-repository.ts` : plages `{ effectId, from, to }` des effets (hors catégorie 2) dont les bornes sont toutes deux ≤ 0 et au moins une < 0, `from` ≤ `to`, un effet fixe écrit `to: 0` donne `from = to`. Ne pas modifier `effectRangesOf` ni `scripts/build-brisage-items.mjs`.
- [ ] T003 [P] Ajouter dans `src/domain/brisage.ts` le type `NegativeLine = { effectId: number; value: number }` et `negativeLineWeight(value, statWeight, level, settings)` = `Math.max(0, lineWeight(value, statWeight, level, settings))`, avec un commentaire qui cite Kama Master et marque la règle comme estimation.

**Point de contrôle** : la règle de poids existe et se teste seule.

---

## Phase 3 : Histoire 2 — La ligne négative est comptée dans le calcul (P1)

**Objectif** : le focus tient compte des lignes négatives ; le brisage normal ne change pas.

**Test indépendant** : niveau 200, Force −10 → poids 0, résultats inchangés ; niveau 20, Force −1 → poids 0,7, le focus ailleurs gagne 0,35.

- [ ] T004 [US2] Écrire `tests/unit/brisage-negative.test.ts` : (a) `negativeLineWeight` niveau 200 Force −10 vaut 0 ; (b) niveau 20 Force −1 vaut 0,7 ; (c) un focus avec une ligne négative de poids 0,7 reçoit +0,35 de poids de focus par rapport à l'objet sans elle ; (d) le brisage normal est identique avec et sans ligne négative ; (e) un objet avec seulement des lignes négatives donne `status: 'invalid'` ; (f) une ligne négative n'apparaît jamais dans `yields` ni comme `focusEffectId` ; (g) une ligne négative dont la stat n'a pas de rune est ignorée ; (h) mêmes résultats via `analyzeFocusAdvice` (coefficient inconnu).
- [ ] T005 [US2] Dans `src/domain/brisage.ts`, ajouter `negatives?: NegativeLine[]` à `BrisageInput` et à `FocusAdviceInput`. Écarter une ligne négative sans poids de stat ou sans rune. Dans `buildOption`, ajouter à `focusWeight` la somme de `negativeLineWeight × settings.focusOtherShare` de chaque ligne négative utilisable ; ne créer aucun `RuneYield`. Aucun changement sans focus.
- [ ] T006 [US2] Dans `analyzeBrisage` et `analyzeFocusAdvice`, passer les lignes négatives utilisables à `buildOption` ; garder le message « L'objet n'a aucune ligne exploitable. » quand il n'y a aucune ligne positive utilisable (FR-009).
- [ ] T007 [US2] Ajouter à `tests/unit/catalogue-item-effect-lines.test.ts` des cas pour `negativeRangesOf` : plage −15 à −10, effet fixe `to: 0`, positif ignoré, catégorie 2 ignorée, et `effectRangesOf` inchangée (SC-002).
- [ ] T008 [US2] Lancer `npm run test` : T004 et T007 doivent passer, rien d'autre ne casse.

**Point de contrôle** : le domaine répond à FR-003 à FR-006, FR-008 et FR-009.

---

## Phase 4 : Histoire 1 — Voir les lignes négatives de l'objet (P1)

**Objectif** : la page lit, affiche et transmet les lignes négatives.

**Test indépendant** : choisir un objet qui a un malus, vérifier la ligne rouge sans focus.

- [ ] T009 [US1] Dans `src/features/brisage/BrisagePage.tsx`, ajouter l'état `negativeRanges`, rempli par `getItemNegativeRanges(picked.id)` en même temps que `ranges` (même jeton `pickToken`) et remis à `[]` à l'ouverture d'un objet.
- [ ] T010 [US1] Construire `negativeLines` : seules les plages dont la stat a un poids connu et une rune ; `index = breakable.length + position` ; jet par défaut `averageRoll(from, to)` ; passer `negatives: [{ effectId, value }]` à `analyzeBrisage` et `analyzeFocusAdvice`. Compter à part les négatives ignorées (stat sans rune) dans `ignoredCount`.
- [ ] T011 [US1] Afficher les lignes négatives après les lignes positives dans le tableau : classe `brisage-negative`, nom de la stat avec l'icône de sa rune, jet signé, colonnes de prix, de runes et de focus à « — », mention « aucune rune » dans la cellule du jet, aucun badge « Meilleur focus ». Garder le rendu actuel quand l'objet n'a pas de ligne négative.
- [ ] T012 [P] [US1] Ajouter dans `src/styles/global.css` le style `.brisage-negative` (texte et jet en rouge selon la variable d'erreur du projet, lisible à 390 px).
- [ ] T013 [US1] Ajouter à `tests/integration/brisage-page.test.tsx` un cas : un objet avec une ligne négative la montre avec son jet signé, sans action de focus ; un objet sans ligne négative garde le même rendu. Étendre le mock de `getItemNegativeRanges` si besoin.
- [ ] T014 [US1] Lancer `npm run test` et `npm run lint`.

**Point de contrôle** : la page répond à FR-001, FR-002, FR-005 et FR-007.

---

## Phase 5 : Histoire 3 — Saisir un jet négatif (P3)

**Objectif** : le joueur règle le jet d'une ligne négative dans son étendue.

**Test indépendant** : régler une ligne négative sur sa borne basse puis haute, le tableau suit.

- [ ] T015 [US3] Dans `BrisagePage.tsx`, ajouter pour chaque ligne négative un champ numérique signé (`max={0}`, `aria-label` « Jet de … ») qui lit et écrit `rolls[index]` ; une saisie positive ou hors étendue est signalée (`aria-invalid`) et le jet par défaut est utilisé.
- [ ] T016 [US3] Ajouter à `tests/integration/brisage-page.test.tsx` un cas : saisir −1 sur une ligne d'étendue −15 à −10 est refusé et le jet par défaut (−13) reste utilisé ; saisir −12 est pris en compte.
- [ ] T017 [US3] Lancer `npm run test`.

---

## Phase 6 : Finitions

- [ ] T018 [P] Ajouter à `docs/dofocus-brisage.md` une section « Lignes négatives (specs/067) » : règle retenue (Kama Master), DoFocus écarté, ta règle de forgemagie non reprise, exemple chiffré, mention « estimation, à confirmer par un relevé ».
- [ ] T019 Lancer `npm run test`, `npm run lint` et `npm run build`, puis suivre `quickstart.md` à la main (objet avec malus, objet sans malus, comparaison avec `master`).

---

## Dépendances

- T001 → T002, T003 (parallèles) → T004 → T005 → T006 → T007 → T008.
- T009 → T010 → T011 (T012 en parallèle) → T013 → T014 ; Phase 4 dépend de la Phase 3.
- Phase 5 dépend de la Phase 4.
- T018 peut se faire dès la Phase 3 ; T019 clôt la fonctionnalité.

## Stratégie

MVP = Phases 1 à 4 (histoires 1 et 2, toutes deux P1). L'histoire 3 (saisie du jet) s'ajoute ensuite sans rien casser.
