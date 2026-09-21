---

description: "Task list for feature implementation"
---

# Tasks: Mise en évidence des prix de ressources obsolètes

**Input**: Design documents from `/specs/008-stale-resource-highlight/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Incluses — la Constitution du projet (Principe II) exige des tests automatisés pour les
règles de calcul (cas normaux, limites, entrées incomplètes).

**Organization**: Tâches groupées par user story pour une implémentation et une validation
indépendantes de chacune.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Peut s'exécuter en parallèle (fichiers différents, pas de dépendance bloquante)
- **[Story]**: User story concernée (US1, US2)
- Chemins de fichiers exacts inclus dans chaque description

## Path Conventions

Projet unique existant : `src/` (app React), `tests/unit/` (Vitest + Testing Library). Aucun
changement côté `worker/`.

---

## Phase 1: Setup

Aucune tâche de setup requise : aucune nouvelle dépendance, aucun nouvel outil de build/lint n'est
nécessaire (Vite/Vitest/ESLint couvrent déjà les nouveaux fichiers `.ts`/`.tsx` sans configuration
additionnelle).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Règle de classification d'âge de prix, partagée par les deux user stories.

**⚠️ CRITICAL**: Aucune tâche des user stories ne doit démarrer avant la fin de cette phase.

- [X] T001 Créer `src/domain/price-age.ts` exportant `PRICE_AGE_STALE_DAYS = 3`,
  `PRICE_AGE_EXPIRED_DAYS = 7`, et `classifyPriceAge(updatedAt: string | undefined, now: Date = new Date()): 'unknown' | 'fresh' | 'stale' | 'expired'` :
  retourne `'unknown'` si `updatedAt` est `undefined` (FR-005), `'fresh'` si l'ancienneté est
  strictement inférieure à 3 jours (FR-004), `'stale'` si elle est comprise entre 3 jours (inclus)
  et 7 jours (exclu) (FR-002), `'expired'` à partir de 7 jours inclus (FR-003). Suivre le style du
  module voisin `src/domain/outlier-threshold.ts` (fonction pure, pas d'effet de bord).
- [X] T002 [P] Créer `tests/unit/price-age.test.ts` couvrant les cas limites de
  `classifyPriceAge` : `updatedAt` absent → `'unknown'` ; ancienneté de 2 jours 23h → `'fresh'` ;
  exactement 3 jours → `'stale'` ; 6 jours 23h → `'stale'` ; exactement 7 jours → `'expired'` ;
  10 jours → `'expired'` (suivre le style de `tests/unit/outlier-threshold.test.ts`).

**Checkpoint**: `classifyPriceAge` est disponible et testé — les user stories peuvent commencer.

---

## Phase 3: User Story 1 - Repérer un prix de ressource périmé (Priority: P1) 🎯 MVP

**Goal**: La ligne d'une ressource (`.price-line` dans `ResourcePriceInput`) s'affiche en orange
entre 3 et 7 jours d'ancienneté de prix, et en rouge à partir de 7 jours.

**Independent Test**: Monter `ResourcePriceInput` avec des valeurs `updatedAt` de différents âges
et vérifier la classe CSS appliquée à la racine du composant, sans dépendre d'aucune autre story.

### Implementation for User Story 1

- [X] T003 [US1] Dans `src/styles/global.css`, ajouter les règles `.price-line--stale small`
  (`color: var(--warning)`) et `.price-line--expired small` (`color: var(--danger)`), à la suite du
  bloc `/* ---------- Price list ---------- */` existant. Révisé le 2026-09-21 (retour
  utilisateur) : seul le texte « Dernière mise à jour : ... » change de couleur, sans fond teinté ni
  bordure sur toute la ligne (FR-009).
- [X] T004 [US1] Dans `src/features/comparison/ResourcePriceInput.tsx`, importer
  `classifyPriceAge` depuis `../../domain/price-age`, calculer le statut à partir de la prop
  `updatedAt`, et appliquer conditionnellement `price-line--stale` ou `price-line--expired` à la
  classe du `<label className="price-line">` racine (aucune classe ajoutée pour `'unknown'` ou
  `'fresh'`) (dépend de T001, T003).
- [X] T005 [P] [US1] Étendre `tests/unit/resource-price-input.test.tsx` : rendre le composant avec
  un `updatedAt` d'il y a 1 jour (aucune classe d'alerte), 4 jours (`price-line--stale`) et 8 jours
  (`price-line--expired`), en asserant la présence/absence de ces classes sur l'élément racine
  (dépend de T004).

**Checkpoint**: User Story 1 fonctionnelle et testable indépendamment (MVP livrable).

---

## Phase 4: User Story 2 - Comprendre pourquoi une ligne est signalée (Priority: P2)

**Goal**: La coloration ne prête pas à confusion : le texte de dernière mise à jour reste lisible,
une ressource sans prix connu n'est jamais colorée, et le signal reste visuellement distinct de
l'indicateur `communityMeta.stale` existant (réseau).

**Independent Test**: Vérifier, sur un rendu de `ResourcePriceInput`, que (a) le texte "Dernière
mise à jour : ..." reste visible sur une ligne colorée, (b) une ressource sans `updatedAt` n'a
aucune classe d'alerte, (c) une ligne avec `communityMeta.stale = true` et un `updatedAt` ancien
affiche les deux signaux sans que l'un masque l'autre.

### Implementation for User Story 2

- [X] T006 [US2] Dans `src/styles/global.css`, rendre le texte "Dernière mise à jour : ..."
  (`.price-line small`) directement coloré en orange/rouge sur les lignes signalées (`color:
  var(--warning)` / `var(--danger)`, même convention que `.badge-warning`), au lieu de le laisser
  en `--text-muted` — retour utilisateur du 2026-09-21 : la teinte de fond seule n'était pas assez
  visible, le signal doit se lire sur la ligne de texte elle-même (FR-006).
- [X] T007 [P] [US2] Dans `tests/unit/resource-price-input.test.tsx`, ajouter un test : rendu sans
  prop `updatedAt` (aucun prix connu) → aucune classe `price-line--stale`/`price-line--expired`
  n'est appliquée, même avec `communityMeta` défini (FR-005).
- [X] T008 [P] [US2] Dans `tests/unit/resource-price-input.test.tsx`, ajouter un test : rendu avec
  `updatedAt` vieux de 10 jours **et** `communityMeta={{ sampleSize: 2, stale: true }}` → la classe
  `price-line--expired` est appliquée **et** le texte "peut-être daté" reste présent dans le DOM
  (FR-008 : les deux signaux coexistent sans se masquer).

**Checkpoint**: Les deux user stories fonctionnent indépendamment et ensemble.

---

## Phase 5: User Story 3 - Être averti d'un possible écart avec le prix en jeu (Priority: P2)

**Goal**: Un survol de la ligne d'une ressource au prix ancien (≥ 3 jours) affiche une info-bulle
expliquant que le prix affiché peut différer du prix en jeu, faute de mise à jour récente (retour
utilisateur du 2026-09-21, FR-010/FR-011).

**Independent Test**: Monter `ResourcePriceInput` avec des `updatedAt` de différents âges et
vérifier l'attribut `title` (ou équivalent accessible) porté par la ligne : absent pour un prix
récent ou inconnu, présent avec le texte explicatif pour un prix `stale`/`expired`.

### Implementation for User Story 3

- [X] T011 [US3] Dans `src/features/comparison/ResourcePriceInput.tsx`, rendre un
  `<span className="price-age-tooltip" role="tooltip">` (au lieu d'un attribut `title` natif —
  retour utilisateur du 2026-09-21 : l'info-bulle par défaut du navigateur ne colle pas au design),
  présent uniquement quand `priceAge` vaut `'stale'` ou `'expired'`, avec le texte : "Ce prix n'a
  pas été mis à jour récemment : il peut être différent du prix actuellement pratiqué en jeu."
  Dans `src/styles/global.css`, positionner `.price-line small` en `position: relative` et
  styliser `.price-age-tooltip` avec les tokens de l'app (`--panel-strong`, `--border-strong`,
  `--radius-md`, `--shadow-md`), affiché uniquement via `:hover` (souris) sur `.price-line small`
  (retour utilisateur du 2026-09-21 : le survol de toute la ligne était trop large, et le focus
  clavier ne doit pas déclencher l'info-bulle) (dépend de T004).
- [X] T012 [P] [US3] Dans `tests/unit/resource-price-input.test.tsx`, ajouter des tests : pas de
  `role="tooltip"` dans le DOM pour un prix récent (< 3 jours) ni pour une ressource sans prix
  connu ; `role="tooltip"` présent avec le texte attendu pour un prix `stale` (4 jours) et
  `expired` (10 jours) (dépend de T011).

**Checkpoint**: Les trois user stories fonctionnent indépendamment et ensemble.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T009 Exécuter `npm run typecheck` et `npm run test` pour confirmer que l'ensemble de la
  suite (existante + nouveaux tests) passe sans régression.
- [ ] T010 Dérouler manuellement les scénarios de [quickstart.md](./quickstart.md) dans `npm run
  dev` (prix récent, orange, rouge, sans prix, mode communautaire) pour valider visuellement les
  couleurs en thème clair et sombre.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Aucune tâche — rien ne bloque la suite.
- **Foundational (Phase 2)**: Bloque toutes les user stories (T001 avant T003/T004 ; T002 peut
  courir en parallèle de T001 une fois le fichier squelette de T001 créé, ou juste après).
- **User Story 1 (Phase 3)**: Dépend de la Phase 2. Aucune dépendance sur US2.
- **User Story 2 (Phase 4)**: Dépend de la Phase 2 et de T003/T004 (US1) car elle vérifie/ajuste le
  même CSS et le même composant déjà modifiés.
- **User Story 3 (Phase 5)**: Dépend de la Phase 2 et de T004 (US1) car elle ajoute un attribut sur
  le même composant.
- **Polish (Phase 6)**: Dépend de toutes les user stories retenues.

### User Story Dependencies

- **User Story 1 (P1)**: Indépendante — livrable seule comme MVP.
- **User Story 2 (P2)**: S'appuie sur l'implémentation d'US1 (même composant, même CSS) mais reste
  testable indépendamment via ses propres tests (T007, T008).
- **User Story 3 (P2)**: S'appuie sur l'implémentation d'US1 (même composant) mais reste testable
  indépendamment via ses propres tests (T012).

### Parallel Opportunities

- T002 (tests du domaine) en parallèle de T001 une fois le squelette du fichier posé.
- T005, T007, T008 (fichiers de test) peuvent être écrits en parallèle entre eux une fois T004
  terminé.

---

## Parallel Example: User Story 1

```bash
# Après T001 (domaine) et T003 (CSS) :
Task: "Update ResourcePriceInput.tsx to apply price-age classes (T004)"
# Puis, une fois T004 fait :
Task: "Extend resource-price-input.test.tsx with age-based class assertions (T005)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Terminer la Phase 2 (Foundational) : `classifyPriceAge` + ses tests.
2. Terminer la Phase 3 (US1) : coloration orange/rouge fonctionnelle et testée.
3. **STOP and VALIDATE**: dérouler manuellement les scénarios US1 de quickstart.md.
4. C'est un MVP livrable seul (US2 n'est qu'un raffinement de lisibilité/non-confusion).

### Incremental Delivery

1. Foundational → US1 (coloration de base) → validation manuelle → possible mise en prod.
2. US2 (lisibilité, cas "pas de prix", distinction avec l'indicateur réseau) → validation manuelle
   complète (quickstart.md en entier) → mise en prod.
3. Polish final (typecheck + suite complète + relecture visuelle clair/sombre).

## Notes

- Aucune tâche ne touche `worker/` : fonctionnalité 100% client-side.
- Toutes les couleurs réutilisent les tokens existants (`--warning`, `--warning-soft`, `--danger`)
  définis dans `src/styles/theme.css` — aucune nouvelle variable de couleur à créer.
- Commit après chaque tâche ou groupe logique cohérent.
