# Implementation Plan: Page Familier — calculateur d'XP et ressources les moins chères

**Branch**: `022-pet-xp-calculator` | **Date**: 2026-09-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/022-pet-xp-calculator/spec.md`

## Summary

> **Révision 2026-09-27** : données Dofus Tool abandonnées ; XP par ressource de l'onglet « XP COMPLET »
> de l'Excel du porteur du projet (Dafous), courbe des fichiers du jeu, niveaux 0 à 100 (research.md §1).

Nouvelle page **Familier** (`/familier`) : le joueur saisit niveau actuel, XP déjà gagnée et niveau
cible ; la page affiche l'XP nécessaire puis les 10 ressources au coût total le plus bas, avec
quantité, prix unitaire (et sa date) et coût total.

Les deux tableaux de référence (courbe d'XP, XP par ressource) sont **figés dans l'app** sous forme
d'un fichier de données versionné, avec leur source et leur date de relevé. Le tableau des
ressources est rattaché **une fois, par un script**, aux identifiants DofusDB (nom exact, à la casse
et à « œ/oe » près) ; les noms introuvables ou ambigus sont écartés et listés dans un rapport
(research.md §2). À l'exécution, aucun rapprochement par nom n'a lieu.

Les calculs (XP nécessaire, quantité, coût, classement) sont des fonctions pures du domaine. Les prix
viennent du carnet de ressources du mode actif (`resourcePricesFor(priceMode)`), complétés en Mode
communautaire par les médianes communautaires en lecture seule (`getCommunityPrices`, déjà en place).

## Technical Context

**Language/Version** : TypeScript 5 (strict), React 19

**Primary Dependencies** : React, React Router, Vite. Aucune nouvelle dépendance

**Storage** : fichier de données JSON statique dans `src/data/` (nouveau) ; carnets IndexedDB de prix
existants (lecture seule) ; `localStorage` pour les derniers niveaux saisis

**Testing** : Vitest (unitaires domaine, intégration jsdom de la page), Playwright (un scénario e2e)

**Target Platform** : navigateurs modernes (ordinateur, mobile)

**Project Type** : SPA (+ Worker d'API communautaire existant, non modifié)

**Performance Goals** : recalcul < 1 s après une saisie (SC-005) — ~2 100 ressources, calcul trivial

**Constraints** : aucune valeur inventée ; ressource non rattachée de façon certaine = ignorée
(FR-005, SC-004) ; pas d'écriture dans le carnet depuis cette page

**Scale/Scope** : 1 page, ~2 100 ressources rattachées, niveaux 0 à 100

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principe | Vérification | Statut |
|---|---|---|
| I. Données traçables | Fichier de données avec `source`, `sourceUrl`, `retrievedAt` ; identifiants DofusDB stables ; ressources non rattachées écartées, pas devinées | OK |
| II. Correction d'abord | Calculs purs testés : bornes (1→100, cible ≤ actuel, XP saisie hors limite), arrondi supérieur, prix manquants | OK |
| III. Explicable | Chaque ligne : XP/unité, prix + date, quantité, coût ; source des données et nombre de ressources sans prix affichés | OK |
| IV. Petits changements | Une page, un module domaine, un fichier de données, un script de génération ; aucune refonte | OK |
| V. Données utilisateur | Seuls les niveaux saisis sont gardés, sur l'appareil | OK |
| Contraintes (adaptateurs, échec sûr) | Source externe isolée dans le script de génération ; médianes indisponibles → prix du carnet seuls | OK |

Post-design : inchangé, aucune exception.

## Project Structure

### Documentation (this feature)

```text
specs/022-pet-xp-calculator/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── pet-xp-data.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
scripts/
└── build-pet-xp-data.mjs          # nouveau : génère le fichier de données (scripts/data/ + DofusDB)
└── data/                          # sources commitées : XP par ressource (Excel/Dafous), courbe du client

src/
├── data/
│   └── pet-xp-data.json           # nouveau : courbe d'XP + ressources rattachées + provenance
├── domain/
│   └── pet-xp.ts                  # nouveau : xpNeeded, quantités, coûts, classement
├── persistence/
│   └── pet-levels-preference.ts   # nouveau : derniers niveaux saisis (localStorage)
├── features/pets/
│   ├── FamilierPage.tsx           # nouveau
│   └── usePetFoodPrices.ts        # nouveau : prix du mode actif (+ médianes en communautaire)
└── app/
    ├── router.tsx                 # + ROUTES.pets = '/familier'
    └── AppShell.tsx               # + entrée de navigation « Familier » et sa route

tests/
├── unit/pet-xp.test.ts
├── integration/familier-page.test.tsx
└── e2e/familier-page.spec.ts
```

**Structure Decision** : on suit le découpage existant (`domain/` pur, `features/<page>/`,
`persistence/` pour les préférences), comme la page Prix (specs/019).

## Complexity Tracking

Aucune violation de la constitution à justifier.
