---

description: "Task list for feature implementation"
---

# Tasks: Fiche d'arme façon tooltip du jeu

**Input**: Design documents from `/specs/009-weapon-tooltip-layout/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Incluses — la Constitution du projet (Principe II) exige des tests automatisés pour
les cas normaux, les limites et les entrées incomplètes, et l'existant (`catalogue-repository.test.ts`,
`item-detail.test.tsx`) suit déjà cette convention.

**Organization**: Tâches groupées par user story pour une implémentation et une validation
indépendantes de chacune (US1 : bloc d'informations de combat ; US2 : séparation des sections
d'effets ; US3 : ligne de catégorie d'arme).

> **Révisé le 2026-09-21 (retour utilisateur)** : US1 est retirée (voir Phase 3 ci-dessous). Par
> conséquent, le signal "objet = arme" consommé par US2/US3 n'est plus le type `WeaponInfo` posé
> en T002/T006 (retirés), mais un simple booléen `isWeapon` sur le détail d'objet. Les descriptions
> de tâches US2/US3 ci-dessous qui mentionnent encore `detail.weaponInfo` doivent se lire comme
> `detail.isWeapon` — non réécrites une à une pour éviter d'alourdir cet historique, mais le code
> livré (et les tests) utilisent bien `isWeapon`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Peut s'exécuter en parallèle (fichiers différents, pas de dépendance bloquante)
- **[Story]**: User story concernée (US1, US2, US3)
- Chemins de fichiers exacts inclus dans chaque description

## Path Conventions

Projet unique existant : `src/` (app React), `tests/unit/` (Vitest + Testing Library). Aucun
changement côté `worker/`.

---

## Phase 1: Setup

Aucune tâche de setup requise : aucune nouvelle dépendance, aucun nouvel outil de build/lint n'est
nécessaire (le pipeline DofusDB → `catalogue-repository.ts` → `ItemDetail.tsx` existant est
étendu, pas remplacé).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Étendre les types DofusDB et le domaine pour exposer les données de combat d'une
arme et la distinction dommages/vol vs bonus de caractéristique, partagées par les trois user
stories.

**⚠️ CRITICAL**: Aucune tâche des user stories ne doit démarrer avant la fin de cette phase.

- [X] T001 Dans `src/services/dofusdb-types.ts`, étendre `DofusDbItem` avec les champs optionnels
  `apCost?: number`, `range?: number`, `minRange?: number`, `criticalHitProbability?: number`,
  `criticalHitBonus?: number`, `maxCastPerTurn?: number` (valeurs vérifiées sur un exemple réel
  DofusDB, cf. research.md §2) ; et `DofusDbItemEffect` a déjà `category?: number` (aucun
  changement requis sur ce type).
- [X] T002 Dans `src/domain/types.ts`, ajouter le champ `isWeaponEffect: boolean` à `ItemStat`, et
  créer le type `WeaponInfo = {apCost?: number; minRange?: number; maxRange?: number;
  maxCastPerTurn?: number; criticalHitProbability?: number; criticalHitBonus?: number;
  zoneLabel?: string}` (cf. data-model.md — tous les champs sont individuellement optionnels : une
  donnée absente côté DofusDB est omise, jamais remplacée par une valeur par défaut, FR-008).
- [X] T003 Dans `src/services/dofusdb-mappers.ts`, ajouter une constante exportée
  `WEAPON_SUPER_TYPE_ID = 2` et une fonction exportée `isWeapon(item: DofusDbItem): boolean` qui
  retourne `true` quand `superTypeId(item) === WEAPON_SUPER_TYPE_ID` (réutilise la fonction privée
  `superTypeId` déjà définie dans ce fichier ; cf. research.md §1 — même donnée que celle utilisée
  par `CRAFTCHECK_EQUIPMENT_SUPER_TYPE_IDS`).
- [X] T004 [P] Dans `src/data/catalogue-repository.ts`, modifier `mapItemStats` pour renseigner
  `isWeaponEffect: effect.category === 2` sur chaque `ItemStat` retourné (donnée déjà présente sur
  chaque entrée de `item.effects`, cf. research.md §3 ; aucun appel réseau supplémentaire).
- [X] T005 [P] Dans `tests/unit/catalogue-repository.test.ts`, ajouter un cas de test vérifiant
  que `getItemDetail` retourne des `stats` dont `isWeaponEffect` vaut `true` pour un effet de
  dommage/vol (`category: 2` dans la réponse `/items/{id}` mockée) et `false` pour un bonus de
  caractéristique (`category: 0`) sur le même objet (dépend de T004).

**Checkpoint**: Les types et la détection "arme"/"effet d'arme" sont disponibles et testés — les
user stories peuvent commencer.

---

## Phase 3: User Story 1 - Voir les informations de combat d'une arme en un coup d'œil (Priority: P1) — RETIRÉE

> **Révisé le 2026-09-21 (retour utilisateur, capture d'écran)** : l'utilisateur a demandé de
> retirer le bloc d'informations de combat après l'avoir vu implémenté, pour ne garder que les
> deux sections d'effets ("Effets de l'arme" et "Effets", cf. Phases 4 et 5). Les tâches T006-T011
> ci-dessous ont été **annulées et leur code retiré** : `WeaponInfo`, `resolveWeaponInfo`,
> `resolveZoneLabel`, la section `.weapon-info` et les champs de combat DofusDB associés
> (`apCost`, `range`, `minRange`, `criticalHitProbability`, `criticalHitBonus`, `maxCastPerTurn`,
> `possibleEffects`) ont été supprimés. Ils sont laissés ci-dessous à titre d'historique
> uniquement — ne pas les réimplémenter sans nouvelle demande explicite.
>
> La détection "objet = arme" posée en Phase 2 (T003, `isWeapon`) reste nécessaire : elle pilote
> désormais directement la répartition des sections dans `ItemDetail` via un simple booléen
> `isWeapon` sur le détail d'objet (au lieu de la présence d'un `weaponInfo`).

~~**Goal**: La fiche d'une arme affiche un bloc dédié (coût PA, portée, lancers par tour, taux et
bonus critique) séparé de la liste des effets.~~

~~**Independent Test**: Ouvrir la fiche d'une arme dont les données incluent `apCost`, `range` et
`criticalHitProbability`, et vérifier que ces valeurs apparaissent dans un bloc dédié avant les
effets, sans dépendre de la répartition des sections d'effets (US2).~~

### Implementation for User Story 1 (historique — retiré)

- [X] ~~T006 [US1] Dans `src/data/catalogue-repository.ts`, dans `getItemDetail`, construire
  `weaponInfo: WeaponInfo | undefined` à partir de l'`item` chargé : `undefined` si
  `!isWeapon(item)` (import depuis `dofusdb-mappers.ts`) ; sinon un objet ne portant que les
  champs présents sur `item` (`apCost`, `minRange`, `maxRange` mappé depuis `item.range`,
  `maxCastPerTurn`, `criticalHitProbability`, `criticalHitBonus`) — un champ source `undefined`
  n'est pas ajouté à l'objet résultat (FR-008). `zoneLabel` reste hors scope de cette tâche
  (traité en T007). Inclure `weaponInfo` dans la valeur retournée par `getItemDetail`.~~ (retiré :
  remplacé par un simple booléen `isWeapon` sur le détail d'objet)
- [X] ~~T007 [US1] Dans `src/data/catalogue-repository.ts`, ajouter une fonction privée
  `resolveZoneLabel(item: DofusDbItem): string | undefined` qui lit
  `item.possibleEffects?.[0]?.zoneDescr` et ne retourne un libellé que pour les formes reconnues
  (à ce stade : `shape === 67` avec `param1` défini → `` `croix de taille ${param1}` ``, cf.
  research.md §4) ; retourne `undefined` pour toute autre forme ou si `possibleEffects`/`zoneDescr`
  est absent. Appeler cette fonction dans `weaponInfo.zoneLabel` (T006).~~ (retiré)
- [X] ~~T008 [P] [US1] Dans `tests/unit/catalogue-repository.test.ts`, ajouter des cas de test pour
  `getItemDetail` : (a) un objet avec `type: { superType: { id: 2 } }` et `apCost`/`range`/
  `minRange`/`criticalHitProbability`/`criticalHitBonus`/`maxCastPerTurn` définis → `weaponInfo`
  contient exactement ces valeurs ; (b) le même objet mais avec `minRange` absent de la réponse
  mockée → `weaponInfo.minRange` est `undefined` (pas de valeur inventée, FR-008) ; (c) un objet
  avec `type: { superType: { id: 1 } }` (non-arme) → `weaponInfo` est `undefined` (dépend de
  T006).~~ (retiré : remplacé par deux tests sur le booléen `isWeapon`)
- [X] ~~T009 [P] [US1] Dans `tests/unit/catalogue-repository.test.ts`, ajouter un cas de test pour
  `resolveZoneLabel`/`weaponInfo.zoneLabel` : `possibleEffects: [{ zoneDescr: { shape: 67,
  param1: 1 } }]` → `zoneLabel === 'croix de taille 1'` ; `possibleEffects: [{ zoneDescr: { shape:
  999, param1: 1 } }]` (forme non reconnue) → `zoneLabel` est `undefined` (dépend de T007).~~
  (retiré)
- [X] ~~T010 [US1] Dans `src/features/catalogue/ItemDetail.tsx`, ajouter au type `ItemDetailData`
  local le champ `weaponInfo?: WeaponInfo` (import depuis `../../domain/types`) et, quand il est
  défini, afficher une section `<section className="weapon-info">` avant la section `item-stats`,
  listant chaque valeur présente (coût PA, portée, lancers par tour, taux critique, bonus
  critique, zone) ; une valeur absente de `weaponInfo` n'affiche pas sa ligne (dépend de T006).
  Pour la portée : si `weaponInfo.minRange === weaponInfo.maxRange`, afficher une valeur unique
  (ex. "Portée : 1") ; sinon afficher un intervalle (ex. "Portée : 1 à 2") (cf. data-model.md,
  règle de validation portée).~~ (retiré)
- [X] ~~T011 [P] [US1] Dans `tests/unit/item-detail.test.tsx`, ajouter des cas de test : (a) un
  `detail.weaponInfo` complet → chaque valeur (PA, portée, lancers/tour, critique, bonus critique)
  est visible dans le document, avant la liste des effets ; (b) `weaponInfo` avec `minRange`
  absent → aucune ligne de portée invalide ou "undefined" n'apparaît ; (c) `weaponInfo` avec
  `minRange !== maxRange` → la portée s'affiche en intervalle ; `minRange === maxRange` → valeur
  unique ; (d) `detail.weaponInfo` absent (objet non-arme) → aucune section `.weapon-info` n'est
  rendue (dépend de T010).~~ (retiré)

**Checkpoint**: Phase annulée — les Phases 4 et 5 (US2, US3) ne dépendent plus de cette phase que
pour le booléen `isWeapon` (posé en Phase 2, T003).

---

## Phase 4: User Story 2 - Distinguer les dégâts de l'arme des autres bonus de l'objet (Priority: P2)

**Goal**: Pour une arme, les effets de dommages/vol apparaissent sous "Effets de l'arme" et les
autres bonus sous "Effets" ; pour un objet non-arme, tout reste sous une unique section "Effets"
comme aujourd'hui.

**Independent Test**: Ouvrir la fiche d'une arme ayant à la fois des effets de dommages/vol et des
bonus de caractéristiques, et vérifier les deux sections distinctes ; ouvrir la fiche d'un objet
non-arme et vérifier qu'une seule section "Effets" regroupe tout, sans dépendre du bloc
d'informations de combat (US1).

### Implementation for User Story 2

- [X] T012 [US2] Dans `src/features/catalogue/ItemDetail.tsx`, quand `detail.weaponInfo` est
  défini (objet identifié comme arme), répartir `stats` en `weaponEffects = stats.filter(s =>
  s.isWeaponEffect)` et `otherEffects = stats.filter(s => !s.isWeaponEffect)` ; rendre une section
  `<h3>Effets de l'arme</h3>` avec `weaponEffects` uniquement si ce tableau est non vide, suivie
  d'une section `<h3>Effets</h3>` avec `otherEffects` uniquement si ce tableau est non vide
  (FR-006). Quand `detail.weaponInfo` est `undefined` (objet non-arme), conserver le rendu actuel
  : une unique section `<h3>Effets</h3>` listant tous les `stats` sans filtrage, à l'identique du
  comportement avant cette fonctionnalité (FR-005) (dépend de T010, T004).
- [X] T013 [P] [US2] Dans `tests/unit/item-detail.test.tsx`, ajouter un cas de test : une arme
  (`detail.weaponInfo` défini) avec `stats` mêlant `isWeaponEffect: true` (ex. "16 à 20 dommages
  Eau") et `isWeaponEffect: false` (ex. "394 Vitalité") → les deux libellés sont présents, celui
  marqué `isWeaponEffect: true` apparaît sous le titre "Effets de l'arme" et l'autre sous le titre
  "Effets" (vérifier l'ordre document via `compareDocumentPosition`, à l'image du test existant
  sur "Panoplie") (dépend de T012).
- [X] T014 [P] [US2] Dans `tests/unit/item-detail.test.tsx`, ajouter un cas de test : un objet
  non-arme (`detail.weaponInfo` absent) avec des `stats` dont certains ont `isWeaponEffect: true`
  → un seul titre "Effets" est rendu (`getAllByRole('heading', { name: /Effets/ })` de longueur 1)
  et tous les libellés apparaissent dans cette unique liste, sans régression du comportement
  actuel (FR-005) (dépend de T012).
- [X] T015 [P] [US2] Dans `tests/unit/item-detail.test.tsx`, ajouter un cas de test : une arme
  dont tous les `stats` ont `isWeaponEffect: true` (aucun bonus de caractéristique) → le titre
  "Effets" n'est pas rendu (FR-006) ; à l'inverse, une arme sans aucun `stats` marqué
  `isWeaponEffect: true` → le titre "Effets de l'arme" n'est pas rendu (dépend de T012).

**Checkpoint**: À ce stade, les User Stories 1 ET 2 fonctionnent indépendamment ; la fiche d'une
arme sépare informations de combat, dommages/vol et bonus de caractéristiques, et les objets
non-armes restent inchangés.

---

## Phase 5: User Story 3 - Repérer la catégorie de l'arme (Priority: P3) — RETIRÉE

> **Révisé le 2026-09-21 (retour utilisateur, capture d'écran)** : une fois testée visuellement,
> cette ligne s'est révélée être un doublon exact de la ligne "Catégorie : ..." déjà affichée plus
> haut dans la fiche (le libellé réutilisé est la catégorie générique, ex. "Arme", pas un type
> d'arme précis comme "Marteau"). Retirée à la demande de l'utilisateur, qui cherchait à réduire
> la hauteur de la fiche. Le code (`leading` sur `StatList`, ligne de catégorie dans la section
> "Effets") a été supprimé ; les tests T017/T018 ont été remplacés par un seul test vérifiant
> l'absence de doublon.

~~**Goal**: La section "Effets" d'une arme affiche en tête une ligne indiquant sa catégorie (ex.
"Marteau").~~

~~**Independent Test**: Ouvrir la fiche d'une arme de catégorie connue et vérifier qu'une ligne de
catégorie apparaît en tête de la section "Effets", sans dépendre du contenu du bloc d'informations
de combat (US1) ni de la répartition des effets (US2) au-delà de la section "Effets" elle-même.~~

### Implementation for User Story 3 (historique — retiré)

- [X] ~~T016 [US3] Dans `src/features/catalogue/ItemDetail.tsx`, quand `detail.weaponInfo` est
  défini et que `category` (prop déjà reçue par le composant) est fournie, afficher en première
  ligne de la section "Effets" (avant `otherEffects`, cf. T012) le libellé de catégorie déjà
  résolu (`category.label`, ex. "Marteau"), réutilisant le même style que les autres lignes
  d'effet (cf. Assumptions du spec.md — aucune nouvelle source de donnée, réutilisation du
  libellé déjà affiché plus haut dans la fiche) (dépend de T012).~~ (retiré : doublon avec
  "Catégorie : ...")
- [X] ~~T017 [P] [US3] Dans `tests/unit/item-detail.test.tsx`, ajouter un cas de test : une arme
  (`detail.weaponInfo` défini) avec `category: { label: 'Marteau', ... }` → le libellé "Marteau"
  apparaît en tête de la section "Effets", avant les autres lignes de `otherEffects` (vérifier
  l'ordre document) (dépend de T016).~~ (retiré)
- [X] ~~T018 [P] [US3] Dans `tests/unit/item-detail.test.tsx`, ajouter un cas de test : une arme
  sans `category` fournie (prop absente) → la section "Effets" se rend sans ligne de catégorie ni
  erreur (dépend de T016).~~ (retiré : remplacé par un test vérifiant l'absence de doublon)

**Checkpoint**: Phase annulée — seule User Story 2 reste en vigueur.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Vérifications globales une fois les trois user stories complètes.

- [X] T019 [P] Dans `src/styles/global.css`, ajouter les règles de mise en forme du bloc
  `.weapon-info` (espacement, séparation visuelle des sections "Effets de l'arme"/"Effets"),
  réutilisant les tokens de couleur déjà définis dans `theme.css` (aucune nouvelle couleur).
  Note du 2026-09-21 (retour utilisateur, capture d'écran) : les règles `.weapon-info` ont été
  retirées avec le bloc lui-même (US1) ; en revanche, une fois les deux sections restantes vues en
  situation réelle sur une arme à beaucoup d'effets, elles ont été jugées trop hautes — resserrage
  des marges/espacements partagés (`.card h3`, `.item-stats`, `.item-stats ul/li`) pour gagner de
  la place, sur toutes les fiches d'objet (pas seulement les armes).
- [X] T020 Exécuter `npm run typecheck` et corriger toute erreur de typage introduite par les
  nouveaux champs `WeaponInfo`/`isWeaponEffect`.
- [X] T021 Exécuter `npm run test -- catalogue-repository item-detail` et vérifier que tous les
  cas ajoutés (T005, T008, T009, T011, T013, T014, T015, T017, T018) passent.
- [ ] T022 Dérouler manuellement `quickstart.md` (scénarios 1 à 6) sur `npm run dev` avec une
  arme réelle (ex. "Masse Étacée") pour confirmer visuellement le rendu.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Aucune tâche — passage direct à Phase 2.
- **Foundational (Phase 2)**: T001 → T002 → T003 (types puis détection arme) ; T004 dépend de
  T002 (champ `isWeaponEffect` sur `ItemStat`) ; T005 dépend de T004. BLOQUE toutes les user
  stories.
- **User Stories (Phase 3-5)**: Toutes dépendent de la fin de la Phase 2.
  - US1 (T006-T011) : peut démarrer seule après Phase 2.
  - US2 (T012-T015) : dépend de T010 (bloc `ItemDetailData`/`weaponInfo` posé par US1) et de T004
    (Phase 2) ; ne dépend pas du contenu du bloc d'informations de combat (T006-T009).
  - US3 (T016-T018) : dépend de T012 (structure des sections posée par US2).
- **Polish (Phase 6)**: Dépend de la fin des user stories livrées.

### Within Each User Story

- Types/mapping de données avant rendu (T006/T007 avant T010 ; T012 avant T016).
- Tests ajoutés à la suite de l'implémentation qu'ils couvrent, mais doivent échouer avant elle
  (écrire T008/T009 en même temps que T006/T007, les faire échouer puis passer).

### Parallel Opportunities

- T004 et T005 (US Foundational, fichiers de test vs mapping) peuvent s'exécuter en parallèle une
  fois T002 posé.
- T008, T009 (tests US1) sont parallélisables entre eux une fois T006/T007 posés.
- T013, T014, T015 (tests US2) sont parallélisables entre eux une fois T012 posé.
- T017, T018 (tests US3) sont parallélisables entre eux une fois T016 posé.
- T019 (CSS) est indépendant du reste et parallélisable dès que les classes qu'il stylise
  (`.weapon-info`) existent (T010).

---

## Parallel Example: User Story 1

```bash
# Une fois T006 et T007 posés, lancer en parallèle :
Task: "Ajouter les cas de test weaponInfo (valeurs présentes/absentes, non-arme) dans tests/unit/catalogue-repository.test.ts"
Task: "Ajouter les cas de test zoneLabel (forme reconnue/non reconnue) dans tests/unit/catalogue-repository.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Compléter Phase 2 : Foundational (types + détection arme).
2. Compléter Phase 3 : User Story 1 (bloc d'informations de combat).
3. **STOP et VALIDER** : ouvrir la fiche d'une arme réelle, vérifier le bloc d'informations.
4. Livrable : la fiche d'arme montre déjà l'information la plus demandée (PA/portée/critique),
   même si les sections d'effets ne sont pas encore séparées.

### Incremental Delivery

1. Foundational → base commune prête.
2. US1 → bloc d'informations de combat → valider indépendamment.
3. US2 → sections "Effets de l'arme"/"Effets" séparées → valider indépendamment (US1 inchangée).
4. US3 → ligne de catégorie d'arme → valider indépendamment (US1/US2 inchangées).
5. Polish → styles, vérification globale, quickstart.

---

## Notes

- [P] tasks = fichiers différents ou sections de test indépendantes, sans dépendance bloquante.
- [Story] label trace chaque tâche à sa user story pour la traçabilité.
- Vérifier que les tests échouent avant l'implémentation correspondante (T008/T009 avant T006/T007
  finalisés, etc.), conformément à la Constitution (Principe II).
- Committer après chaque tâche ou groupe logique.
- S'arrêter à chaque checkpoint pour valider une user story indépendamment des suivantes.
