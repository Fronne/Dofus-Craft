---

description: "Liste de tâches : exos sur les lignes de l'objet, page Brisage"
---

# Tâches : Exos sur les lignes de l'objet, page Brisage

**Entrée** : documents de `/specs/066-exo-brisage/`

**Prérequis** : plan.md, spec.md, research.md, data-model.md, contracts/page-brisage-exo.md

**Tests** : inclus, la constitution (principe II) exige des tests automatisés pour toute règle de calcul.

**Organisation** : tâches groupées par scénario utilisateur. Les règles vivent dans `src/domain/brisage.ts` et sont testées sans interface.

## Format : `[ID] [P?] [Story] Description`

- **[P]** : parallélisable (fichiers différents, pas de dépendance)
- **[Story]** : US1 à US5, selon la spec

## Phase 1 : Préparation

- [ ] T001 Vérifier que `npm run test`, `npm run lint` et `npm run build` passent avant toute modification (base propre), depuis le worktree `.claude/worktrees/brisage-exo`.

---

## Phase 2 : Fondations (bloque toutes les histoires)

**Objectif** : règles de domaine d'un exo, sans interface.

- [ ] T002 Dans `src/domain/brisage.ts`, ajouter `exo?: boolean` à `BrisageLine`, et le conserver dans `usableLines` (fusion par stat) pour que `buildOption` reçoive des lignes marquées.
- [ ] T003 Dans `src/domain/brisage.ts`, exporter `MAX_LINE_WEIGHT = 101`, `maxValueForWeight(weight)` = `floor(101 / weight + 1e-9)` (0 si `weight` ≤ 0) et `lineValueLimit(effectId, settings, naturalMax?)` : exo = `maxValueForWeight(poids)`, ligne d'origine (over) = `max(maxValueForWeight(poids), naturalMax)`. Le poids vient de `settings.stats[effectId].weight`, repli sur `brisageStat`.
- [ ] T004 Dans `src/domain/brisage.ts`, `analyzeBrisage` et `analyzeFocusAdvice` : ne construire aucune option de focus pour une ligne `exo`. L'exo reste dans l'option normale (part = coefficient / 100) et dans chaque focus d'une autre ligne (part = `focusOtherShare`).
- [ ] T005 [P] Créer `tests/unit/brisage-exo.test.ts` : (a) exo ajoute ses runes en normal, gain = gain sans exo + valeur de ses runes ; (b) aucune option focus avec `focusEffectId` d'un exo ; (c) exo à `focusOtherShare` dans un focus sur une autre ligne ; (d) `analyzeFocusAdvice` : pas de focus exo, `switchCoefficient` tient compte de l'exo ; (e) sans exo, résultats identiques à avant (SC-005) ; (f) `maxValueForWeight` : poids 1 → 101, PA 100 → 1, Vitalité 0,2 → 505, Pods 0,25 → 404, poids 0 → 0 ; (g) `lineValueLimit` : Sagesse 3 avec maximum naturel 60 → 60.

**Point de contrôle** : `npx vitest run tests/unit/brisage-exo.test.ts` passe.

---

## Phase 3 : US1 - Ajouter un exo à l'objet choisi (P1) 🎯 MVP

**Objectif** : saisir, voir et retirer des exos, en tête du tableau et en bleu.

**Test indépendant** : ajouter 5 Force puis 1 % Dommages aux sorts sur un objet, vérifier deux lignes exo en tête, en bleu, retirer l'une.

- [ ] T006 [P] [US1] Créer `src/features/brisage/ExoAdder.tsx` : liste des stats proposées (prop `choices`), champ valeur entière, bouton « Ajouter », texte « maximum N » de la stat choisie, champ marqué `aria-invalid` avec message si valeur vide, nulle, négative, décimale ou au-dessus du plafond ; rappel que le calcul d'un exo est une estimation (DoFocus). Aucune logique de calcul : le plafond arrive en prop.
- [ ] T007 [US1] Dans `src/features/brisage/BrisagePage.tsx`, état `exos: { effectId: number; value: number }[]` ; remis à `[]` à l'ouverture d'un autre objet ; calcul des stats proposées = `BRISAGE_STATS` avec rune (`runeForStat`) moins tous les `effectId` de `ranges` (même ignorés) moins les exos déjà présents (FR-002, FR-005).
- [ ] T008 [US1] Dans `BrisagePage.tsx`, rendre les lignes exo **avant** les lignes d'origine, le dernier ajouté en premier : badge « exo », jet en lecture seule sans bornes, bouton « Retirer l'exo <stat> », colonnes de focus à « — », jamais « Meilleur focus ». Insérer `ExoAdder` sous le tableau, affiché seulement si un objet est chargé et a des lignes.
- [ ] T009 [P] [US1] Dans `src/styles/global.css`, style des lignes exo en bleu (nom de stat et jet), lisible en thème clair et sombre ; style de `ExoAdder` cohérent avec les champs du tableau et utilisable à 390 px.

---

## Phase 4 : US2 - L'exo est compté dans le brisage (P1)

**Objectif** : tous les chiffres de la page incluent les exos.

**Test indépendant** : gain avec exo = gain sans exo + valeur des runes de l'exo ; retirer l'exo restaure le gain.

- [ ] T010 [US2] Dans `BrisagePage.tsx`, ajouter les exos (`exo: true`) à `lineInputs` pour `analyzeBrisage`, `analyzeFocusAdvice` et l'estimation `runesValue` ; vérifier que verdict, seuil, descente, gains suivants et conseil sans coefficient les utilisent.
- [ ] T011 [P] [US2] Dans `BrisagePage.tsx`, afficher pour chaque ligne exo les runes et la valeur « sans focus », et « prix manquant » (jamais 0) quand la rune n'a pas de prix ; ajouter les `runeIds` des exos à `useRunePrices`.
- [ ] T012 [P] [US2] Dans `tests/integration/brisage-page.test.tsx`, parcours : ajouter un exo, vérifier la ligne en tête, l'absence de focus sur elle, la hausse du total et le retour au total précédent après retrait.

---

## Phase 5 : US3 - Limite de poids d'un exo (P2)

**Test indépendant** : Force 150 refusé avec « maximum 101 » ; PA limité à 1 ; chaque exo contrôlé séparément.

- [ ] T013 [US3] Dans `ExoAdder.tsx` et `BrisagePage.tsx`, brancher `lineValueLimit` / `maxValueForWeight` : plafond affiché par stat, valeur au-dessus refusée avec message, valeur nulle, négative, décimale ou vide refusée sans ajouter de ligne (FR-003).
- [ ] T014 [P] [US3] Dans `tests/integration/brisage-page.test.tsx`, cas : Force 150 refusé, PA 2 refusé, PA 1 accepté, deux exos chacun à son plafond acceptés, valeur décimale refusée.

---

## Phase 6 : US4 - Exos conservés (P2)

**Test indépendant** : ajouter un exo, recharger, rouvrir le même objet : exo restauré ; autre objet : ses propres exos.

- [ ] T015 [P] [US4] Créer `src/persistence/brisage-exos.ts` : clé `craftcheck-brisage-exos`, `getBrisageExos(serverId, itemId)` et `setBrisageExos(serverId, itemId, exos)` ; table `"<serverId>:<itemId>" → ExoLine[]` ; à la lecture, écarter tout champ de mauvais type, valeur non entière ou < 1, hors plafond ; tout `localStorage` indisponible ou JSON invalide = aucun exo (try/catch comme `brisage-session.ts`) ; liste vide = clé retirée.
- [ ] T016 [P] [US4] Créer `tests/unit/brisage-exos-persistence.test.ts` : aller-retour, deux objets distincts, deux serveurs distincts, JSON invalide, valeurs hors plafond écartées, clé absente.
- [ ] T017 [US4] Dans `BrisagePage.tsx`, lire les exos à l'ouverture d'un objet (y compris la reprise de session) et les écrire à chaque ajout ou retrait ; vérifier qu'une session enregistrée avant cette fonction s'ouvre sans exo (FR-012).
- [ ] T018 [P] [US4] Dans `tests/integration/brisage-page.test.tsx`, cas : exo ajouté, page remontée, même objet : exo restauré ; autre objet : liste différente.

---

## Phase 7 : US5 - Over (P2)

**Test indépendant** : ligne Force 21 à 30 : saisir 33 accepté, signalé « over », runes en hausse ; jet au-dessus du plafond refusé.

- [ ] T019 [US5] Dans `BrisagePage.tsx`, validation du jet saisi d'une ligne d'origine avec `lineValueLimit(effectId, SETTINGS, range.to)` : au-dessus de la limite, jet refusé, jet moyen utilisé et texte « jet maximal N » ; au-dessus du maximum de la ligne et dans la limite, état « over » à la place de « modifié » ; Min / Moyen / Max inchangés (FR-013).
- [ ] T020 [P] [US5] Dans `tests/integration/brisage-page.test.tsx`, cas : jet 33 sur une ligne 21-30 accepté et signalé « over » ; jet au-dessus du plafond refusé avec le maximum affiché ; Sagesse jamais refusée sous son maximum naturel ; « Max » remet dans la plage.

---

## Phase 8 : Finition

- [ ] T021 [P] Compléter `docs/dofocus-brisage.md` : section « Exos et over dans Dofus Craft » (règle retenue, estimation, plafond 101, over, pas de focus sur un exo).
- [ ] T022 Lancer `npm run test`, `npm run lint`, `npm run build` ; tout doit passer.
- [ ] T023 Suivre `specs/066-exo-brisage/quickstart.md` sur le serveur de dev (écran à 390 px et ordinateur, thème clair et sombre) et donner l'URL du serveur de dev à l'utilisateur.

---

## Dépendances et ordre d'exécution

- Phase 1 → Phase 2 (bloque tout) → US1 et US2 (P1) → US3, US4, US5 (P2, indépendantes entre elles, dépendent d'US1) → Finition.
- US2 dépend d'US1 pour avoir des exos à compter (T010 après T007).
- T013 dépend de T006 et T007. T017 dépend de T007. T019 est indépendante d'US1 mais touche `BrisagePage.tsx` : à faire après T010 pour éviter les conflits.
- Tâches touchant `BrisagePage.tsx` (T007, T008, T010, T011, T013, T017, T019) : à faire en série.

## Parallélisme

- Après Phase 2 : T006 (ExoAdder), T009 (CSS), T015 (persistance) et T016 (tests persistance) en parallèle.
- Tests d'intégration (T012, T014, T018, T020) : même fichier, à écrire en série, mais indépendants du code des autres fichiers.

## Stratégie

- **MVP** : Phases 1 à 4 (US1 + US2) : on peut ajouter un exo et il compte.
- Puis US3 (plafond), US4 (persistance), US5 (over), chaque incrément testable seul.
