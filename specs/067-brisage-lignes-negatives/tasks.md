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

- [X] T001 Vérifier que `npm run test`, `npm run lint` et `npm run build` passent avant toute modification (base propre), depuis le worktree `.claude/worktrees/brisage-lignes-negatives`.

---

## Phase 2 : Fondations (bloque toutes les histoires)

**Objectif** : règle de poids et lecture des données, sans interface.

- [X] T002 [P] Ajouter `negativeRangesOf(effects)` et `getItemNegativeRanges(id)` dans `src/data/catalogue-repository.ts` : plages `{ effectId, from, to }` des effets (hors catégorie 2) dont les bornes sont toutes deux ≤ 0 et au moins une < 0, `from` ≤ `to`, un effet fixe écrit `to: 0` donne `from = to`. Ne pas modifier `effectRangesOf` ni `scripts/build-brisage-items.mjs`.
- [X] T003 [P] Ajouter dans `src/domain/brisage.ts` le type `NegativeLine = { effectId: number; value: number }` et `negativeLineWeight(value, statWeight, level, settings)` = `Math.max(0, lineWeight(value, statWeight, level, settings))`, avec un commentaire qui cite Kama Master et marque la règle comme estimation.

**Point de contrôle** : la règle de poids existe et se teste seule.

---

## Phase 3 : Histoire 2 — La ligne négative est comptée dans le calcul (P1)

**Objectif** : le focus tient compte des lignes négatives ; le brisage normal ne change pas.

**Test indépendant** : niveau 200, Force −10 → poids 0, résultats inchangés ; niveau 20, Force −1 → poids 0,7, le focus ailleurs gagne 0,35.

- [X] T004 [US2] Écrire `tests/unit/brisage-negative.test.ts` : (a) `negativeLineWeight` niveau 200 Force −10 vaut 0 ; (b) niveau 20 Force −1 vaut 0,7 ; (c) un focus avec une ligne négative de poids 0,7 reçoit +0,35 de poids de focus par rapport à l'objet sans elle ; (d) le brisage normal est identique avec et sans ligne négative ; (e) un objet avec seulement des lignes négatives donne `status: 'invalid'` ; (f) une ligne négative n'apparaît jamais dans `yields` ni comme `focusEffectId` ; (g) une ligne négative dont la stat n'a pas de rune est ignorée ; (h) mêmes résultats via `analyzeFocusAdvice` (coefficient inconnu) ; (i) le total d'un focus avec une ligne négative est supérieur ou égal à celui sans elle (SC-003).
- [X] T005 [US2] Dans `src/domain/brisage.ts`, ajouter `negatives?: NegativeLine[]` à `BrisageInput` et à `FocusAdviceInput`. Écarter une ligne négative sans poids de stat ou sans rune. Dans `buildOption`, ajouter à `focusWeight` la somme de `negativeLineWeight × settings.focusOtherShare` de chaque ligne négative utilisable ; ne créer aucun `RuneYield`. Aucun changement sans focus.
- [X] T006 [US2] Dans `analyzeBrisage` et `analyzeFocusAdvice`, passer les lignes négatives utilisables à `buildOption` ; garder le message « L'objet n'a aucune ligne exploitable. » quand il n'y a aucune ligne positive utilisable (FR-009).
- [X] T007 [US2] Ajouter à `tests/unit/catalogue-item-effect-lines.test.ts` des cas pour `negativeRangesOf` : plage −15 à −10, effet fixe `to: 0`, positif ignoré, catégorie 2 ignorée, et `effectRangesOf` inchangée (SC-002).
- [X] T008 [US2] Lancer `npm run test` : T004 et T007 doivent passer, rien d'autre ne casse.

**Point de contrôle** : le domaine répond à FR-003 à FR-006, FR-008 et FR-009.

---

## Phase 4 : Histoire 1 — Voir les lignes négatives de l'objet (P1)

**Objectif** : la page lit, affiche et transmet les lignes négatives.

**Test indépendant** : choisir un objet qui a un malus, vérifier la ligne rouge sans focus.

- [X] T009 [US1] Dans `src/features/brisage/BrisagePage.tsx`, ajouter l'état `negativeRanges`, rempli par `getItemNegativeRanges(picked.id)` en même temps que `ranges` (même jeton `pickToken`) et remis à `[]` à l'ouverture d'un objet. Dans la même tâche, ajouter `getItemNegativeRanges` (résolue à `[]` par défaut) aux mocks du module catalogue de `tests/integration/*` (brisage-page, brisage-search, app-nav, etc.), sans quoi ces tests cassent.
- [X] T010 [US1] Construire `negativeLines` : seules les plages dont la stat a un poids connu et une rune ; `index = breakable.length + position` ; jet par défaut `averageRoll(from, to)` ; passer `negatives: [{ effectId, value }]` à `analyzeBrisage` et `analyzeFocusAdvice`. Compter à part les négatives ignorées (stat sans rune) dans `ignoredCount`.
- [X] T011 [US1] Afficher les lignes négatives après les lignes positives dans le tableau : classe `brisage-negative`, nom de la stat avec l'icône de sa rune, jet signé, colonnes de prix, de runes et de focus à « — », mention « aucune rune » dans la cellule du jet, aucun badge « Meilleur focus ». Garder le rendu actuel quand l'objet n'a pas de ligne négative.
- [X] T012 [P] [US1] Ajouter dans `src/styles/global.css` le style `.brisage-negative` (texte et jet en rouge selon la variable d'erreur du projet, lisible à 390 px).
- [X] T013 [US1] Ajouter à `tests/integration/brisage-page.test.tsx` les cas : (a) un objet avec une ligne négative la montre avec son jet signé, sans action de focus ; (b) un objet sans ligne négative garde le même rendu ; (c) un objet qui a la même stat en positif et en négatif montre deux lignes distinctes (FR-007) ; (d) une session mémorisée avant la fonction (`rolls` seuls) s'ouvre sans erreur (FR-010).
- [X] T013b [US1] Dans `BrisagePage.tsx`, quand l'objet n'a aucune ligne positive exploitable mais au moins une ligne négative, afficher une note qui nomme les lignes négatives et dit « L'objet n'a aucune ligne exploitable » au lieu de l'analyse (`ready` exige aujourd'hui `ranges.length > 0`). Ajouter le cas d'intégration correspondant dans `tests/integration/brisage-page.test.tsx` (FR-009).
- [X] T014 [US1] Lancer `npm run test` et `npm run lint`.

**Point de contrôle** : la page répond à FR-001, FR-002, FR-005 et FR-007.

---

## Phase 5 : Histoire 3 — Saisir un jet négatif (P3)

**Objectif** : le joueur règle le jet d'une ligne négative dans son étendue.

**Test indépendant** : régler une ligne négative sur sa borne basse puis haute, le tableau suit.

- [X] T015 [US3] Dans `BrisagePage.tsx`, ajouter pour chaque ligne négative un champ numérique signé (`max={0}`, `aria-label` « Jet de … ») qui lit et écrit `rolls[index]` ; une saisie positive ou hors étendue est signalée (`aria-invalid`) et le jet par défaut est utilisé.
- [X] T016 [US3] Ajouter à `tests/integration/brisage-page.test.tsx` un cas : saisir −1 sur une ligne d'étendue −15 à −10 est refusé et le jet par défaut (−13) reste utilisé ; saisir −12 est pris en compte.
- [X] T017 [US3] Lancer `npm run test`.

---

## Phase 5b : Histoire 4 — Passer un malus en positif après une forgemagie (P1)

**Objectif** : un jet positif sur un malus en fait une ligne exo qui donne des runes ; le prix de la rune est visible sur tous les malus.

**Test indépendant** : sur un objet avec −Sagesse, taper un jet positif : la ligne donne des runes, le gain augmente.

- [X] T020 [US4] Dans `src/domain/brisage.ts`, `usableLines` : à la fusion de deux lignes d'une même stat, `exo` n'est vrai que si toutes les parties sont exo (aujourd'hui `known?.exo || line.exo`). Ajouter un test dans `tests/unit/brisage-negative.test.ts` : une ligne d'origine + une ligne exo de la même stat restent cible de focus.
- [X] T021 [US4] Dans `BrisagePage.tsx` : le jet d'un malus accepte une valeur négative dans l'étendue de la ligne, ou un entier positif de 1 à `lineValueLimit(effectId, SETTINGS)` (plafond 101) ; 0 et le reste sont refusés (jet par défaut, `aria-invalid`, message « jet maximal N : moyen utilisé » au-dessus du plafond). Un malus à jet positif passe dans `lineInputs` avec `exo: true` et non dans `negativeInputs`.
- [X] T022 [US4] Dans `BrisagePage.tsx` : `ready` accepte aussi un objet sans ligne positive d'origine si un malus est passé en positif (cas d'une session restaurée) ; la note « aucune ligne exploitable » ne s'affiche que s'il n'y a aucune ligne positive, d'origine ou convertie.
- [X] T023 [US4] Dans `BrisagePage.tsx` : ajouter les runes des malus à `runeIds` pour récupérer leur prix ; afficher le prix de la rune sur toutes les lignes de malus (prix manquant : « prix manquant », sans bloquer). Une ligne passée en positif affiche aussi ses runes et sa valeur, avec « — » en focus, et reprend le style exo (`brisage-line--exo`) avec le badge « Malus corrigé ».
- [X] T024 [US4] Ajouter à `tests/integration/brisage-page.test.tsx` : (a) le prix de la rune d'un malus est visible ; (b) un jet positif sur un malus fait apparaître des runes et augmente le total ; (c) un jet au-dessus du plafond ou égal à 0 est refusé ; (d) revenir à un jet négatif refait un malus.
- [X] T025 [US4] Lancer `npm run test`, `tsc` et eslint ; vérifier à la main sur la Cape du Tofu Fou (−Sagesse, −PA).

---

## Phase 5c : Histoire 5 — Modifier le prix d'une rune depuis le tableau (P2)

- [X] T026 [US5] Créer `src/features/brisage/RunePriceInput.tsx` : champ de prix, enregistrement dans le carnet du mode, partage et confirmation de valeur aberrante en mode communautaire.
- [X] T027 [US5] Brancher le champ dans `BrisagePage.tsx` (prix saisis pris en compte aussitôt) et `ExoRow.tsx` (`priceCell`) ; styles dans `src/styles/global.css`.
- [X] T028 [US5] Tests dans `tests/integration/brisage-page.test.tsx` : prix saisi enregistré et total recalculé, champ vide ou 0 sans effet.

---

## Phase 6 : Finitions

- [X] T018 [P] Ajouter à `docs/dofocus-brisage.md` une section « Lignes négatives (specs/067) » : règle retenue (Kama Master), DoFocus écarté, ta règle de forgemagie non reprise, exemple chiffré, mention « estimation, à confirmer par un relevé ».
- [X] T019 Lancer `npm run test`, `npm run lint` et `npm run build`, puis suivre `quickstart.md` à la main (objet avec malus, objet sans malus, comparaison avec `master`).

---

## Dépendances

- T001 → T002, T003 (parallèles) → T004 → T005 → T006 → T007 → T008.
- T009 → T010 → T011 (T012 en parallèle) → T013 → T014 ; Phase 4 dépend de la Phase 3.
- Phase 5 dépend de la Phase 4.
- T018 peut se faire dès la Phase 3 ; T019 clôt la fonctionnalité.

## Stratégie

MVP = Phases 1 à 4 (histoires 1 et 2, toutes deux P1). L'histoire 3 (saisie du jet) s'ajoute ensuite sans rien casser.
