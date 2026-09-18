# Implementation Plan: Collections d'objets épinglés

**Branch**: `005-pinned-item-collections` | **Date**: 2026-09-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-pinned-item-collections/spec.md`

## Summary

Ajoute une organisation par collection nommée aux objets épinglés existants : chaque objet épinglé
gagne une assignation optionnelle à une collection (`collectionName`), la page Épinglés regroupe
son affichage par collection (plus un groupe « Sans collection »), et le joueur peut créer, assigner,
renommer ou supprimer une collection sans jamais perdre ou désépingler un objet. Approche technique :
étendre la structure `PinnedItem` existante (`src/persistence/pinned-items.ts`) d'un seul champ
optionnel plutôt que d'introduire une entité « Collection » séparée à synchroniser — une collection
n'est qu'un nom dérivé des objets qui le portent, jamais une liste maintenue indépendamment (principe
IV : pas d'abstraction sans besoin démontré, et surtout pas un second état à garder cohérent avec le
premier).

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 24 LTS, React 19 — inchangé, aucune nouvelle
dépendance de production requise.

**Primary Dependencies**: React 19, Vite, Vitest, React Testing Library, Playwright — inchangé.
Fonctionnalité purement client, aucun appel réseau, aucun backend concerné (contrairement à
004-community-price-sharing).

**Storage**: Étend la structure existante persistée sous la clé `localStorage`
`craftcheck-pinned-items` (`src/persistence/pinned-items.ts`) : `PinnedItem` gagne un champ optionnel
`collectionName?: string`. Aucune nouvelle clé de stockage, aucune structure « liste des collections »
persistée séparément — l'ensemble des collections existantes est calculé à la volée à partir des
`collectionName` actuellement portés par au moins un objet épinglé (cf. spec.md, Key Entities). La
compatibilité ascendante (FR-005) est gratuite : un objet déjà stocké sans `collectionName` est
simplement un objet dont ce champ est absent, traité comme « Sans collection » sans migration ni
transformation de données nécessaire.

**Testing**: Vitest + React Testing Library pour `src/persistence/pinned-items.ts` (validation du
nouveau champ optionnel, rétrocompatibilité avec des entrées stockées sans lui) et pour la logique
d'assignation/renommage/suppression/unicité insensible à la casse (probablement portée par
`usePinnedItems.ts`, à détailler dans data-model.md) ; tests d'intégration pour le regroupement de
`EpinglesPage.tsx` par collection et pour le choix de collection au moment d'épingler depuis
`ItemDetail.tsx`/`RecherchePage.tsx` ; Playwright pour le parcours complet (créer une collection,
assigner, renommer, supprimer, vérifier la rétrocompatibilité d'un objet déjà épinglé).

**Target Platform**: Navigateurs modernes sur ordinateur et mobile, application web statique —
inchangé.

**Project Type**: Application web monopage côté client — inchangé, aucun composant serveur concerné.

**Performance Goals**: Regroupement et tri alphabétique perçus comme instantanés (liste locale de
l'ordre de quelques dizaines d'objets au plus, cf. Scale/Scope) — aucune cible chiffrée stricte
nécessaire à cette échelle.

**Constraints**: Un objet épinglé appartient à au plus une collection à la fois (FR-008) ; deux
collections ne peuvent jamais coexister avec un nom identique à la casse près (FR-009) — assigner ou
renommer vers un nom déjà utilisé rattache/fusionne vers la collection existante, en conservant la
casse de sa première création (spec.md/Assumptions) ; supprimer une collection ou désépingler son
dernier objet ne doit jamais désépingler ni faire perdre les autres objets (FR-007, FR-012) ; aucune
donnée ne quitte l'appareil du joueur (FR-010, cohérent avec le reste du projet hors
004-community-price-sharing).

**Scale/Scope**: Public restreint, liste d'objets épinglés typiquement de l'ordre de quelques
dizaines d'entrées par joueur (cf. spec.md/Assumptions et la convention déjà établie pour ce projet) ;
aucune pagination, virtualisation ou repli/dépliage de groupe n'est nécessaire à cette échelle.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Plan response |
|------|--------|----------------|
| I. Données de jeu exactes et traçables | PASS | Sans objet : cette fonctionnalité n'introduit ni ne modifie aucune donnée de catalogue (objets, recettes, prix) — elle organise uniquement la liste déjà existante des objets épinglés par le joueur. |
| II. Calculs corrects et testables | PASS | Les règles nouvelles (unicité de nom insensible à la casse, fusion au renommage, disparition d'une collection vide) sont des règles explicites et testables, couvertes par des tests unitaires dédiés dans data-model.md/tasks.md — aucun calcul de rentabilité existant n'est modifié. |
| III. Résultats explicables | PASS | Le regroupement par collection est entièrement visible sur la page Épinglés elle-même (en-têtes de groupe nommés) ; renommer ou supprimer une collection produit un effet immédiatement observable (les objets se déplacent de groupe), sans logique cachée ni état invisible au joueur. |
| IV. Changements cohésifs | PASS | Réutilise la persistance `pinned-items.ts`/`usePinnedItems` déjà existante par l'ajout d'un seul champ optionnel, plutôt que d'introduire une nouvelle entité « Collection » à stocker et à garder synchronisée avec les objets épinglés — aucune nouvelle dépendance, aucun nouveau store. |
| V. Données utilisateur sûres | PASS | Aucune nouvelle catégorie de donnée sensible (un nom de collection est un texte libre choisi par le joueur, local à l'appareil) ; supprimer une collection ne désépingle jamais un objet (FR-007), donc aucune confirmation de type « action destructive » n'est requise pour cette action précise — seul le désépinglage d'un objet, déjà existant et déjà confirmé ailleurs dans l'app, reste destructif pour l'objet lui-même. |

**Post-design re-check**: PASS. Les artefacts de conception (`data-model.md`,
`contracts/pinned-item-collections.md`) confirment qu'aucune nouvelle entité persistée séparément
n'est introduite, que la compatibilité ascendante est gratuite (champ optionnel), et qu'aucune
dépendance nouvelle n'est nécessaire.

## Project Structure

### Documentation (this feature)

```text
specs/005-pinned-item-collections/
├── plan.md                              # This file (/speckit-plan command output)
├── research.md                          # Phase 0 output (/speckit-plan command)
├── data-model.md                        # Phase 1 output (/speckit-plan command)
├── quickstart.md                        # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── pinned-item-collections.md       # Phase 1 output (/speckit-plan command)
└── tasks.md                             # Phase 2 output (/speckit-tasks command - NOT created here)
```

### Source Code (repository root)

```text
src/
├── persistence/
│   └── pinned-items.ts                   # PinnedItem gagne `collectionName?: string` ; lecture/écriture/validation étendues, rétrocompatibles avec des entrées existantes sans ce champ
├── features/
│   └── catalogue/
│       ├── usePinnedItems.ts             # Nouvelles opérations : assignCollection(itemId, name|undefined), renameCollection(oldName, newName), deleteCollection(name) — dérive la liste des collections existantes des `pinnedItems` courants plutôt que d'un état séparé
│       ├── EpinglesPage.tsx              # Regroupe l'affichage par collection (tri alphabétique, « Sans collection » en dernier) ; ajoute les actions renommer/supprimer sur chaque en-tête de groupe et un contrôle d'assignation sur chaque carte
│       ├── ItemDetail.tsx                # Ajoute un contrôle secondaire (à côté du bouton Épingler existant, qui garde son comportement en un clic) pour choisir/créer une collection au moment d'épingler (US2)
│       └── CollectionPicker.tsx          # Nouveau composant partagé (liste des collections existantes + création d'une nouvelle) réutilisé par EpinglesPage.tsx et ItemDetail.tsx, pour éviter de dupliquer la logique de sélection/création
└── features/search/RecherchePage.tsx      # Inchangé dans sa structure ; continue de déléguer l'action d'épinglage à ItemDetail.tsx/usePinnedItems sans logique de collection propre

tests/
├── unit/
│   └── pinned-items.test.ts              # Étendu : collectionName optionnel, rétrocompatibilité d'une entrée sans ce champ
├── integration/
│   ├── pinned-item-collections.test.tsx  # Nouveau : création/assignation/renommage/suppression de collection, unicité insensible à la casse, regroupement sur EpinglesPage
│   └── epingles-prices.test.tsx          # Existant, non affecté dans son principe (les résumés de prix par carte restent inchangés, seul le regroupement autour d'elles change)
└── e2e/
    └── pinned-items.spec.ts              # Nouveau ou étendu : parcours complet de bout en bout des trois User Stories
```

**Structure Decision**: Fonctionnalité entièrement contenue dans les fichiers déjà existants de
`src/persistence/pinned-items.ts` et `src/features/catalogue/`, plus un seul nouveau composant
partagé (`CollectionPicker.tsx`) pour éviter de dupliquer la logique de sélection/création de
collection entre la page Épinglés et l'écran de détail d'objet. Aucun nouveau dossier, aucune
nouvelle dépendance, aucun composant serveur.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

Aucune violation à justifier. Le seul nouveau fichier de production est `CollectionPicker.tsx`,
introduit spécifiquement pour éviter de dupliquer une même logique d'interface à deux endroits
(principe IV) — pas une abstraction spéculative pour un besoin non démontré.
