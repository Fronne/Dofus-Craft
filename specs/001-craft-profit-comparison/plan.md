# Implementation Plan: Comparaison rentabilité craft

**Branch**: `001-craft-profit-comparison` | **Date**: 2026-09-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-craft-profit-comparison/spec.md`

## Summary

Construire une application web responsive permettant de rechercher un objet Dofus, consulter sa
recette, enregistrer les prix unitaires de ses ressources, saisir un prix HDV et comparer le coût
de craft à l'achat. L'application est un client web mono-projet : le catalogue versionné est livré
avec l'application et les prix personnels sont persistés localement dans le navigateur. Les calculs
de rentabilité restent des fonctions de domaine pures, isolées de l'interface et du stockage.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 24 LTS

**Primary Dependencies**: React 19, Vite, React Router (navigation), Vitest, React Testing
Library, Playwright

**Storage**: Données de catalogue versionnées dans des fichiers statiques ; IndexedDB du navigateur
pour les prix de ressources et les métadonnées de profil local

**Testing**: Vitest pour les règles de calcul et la persistance ; React Testing Library pour les
composants et l'accessibilité ; Playwright pour les parcours navigateur desktop et mobile

**Target Platform**: Navigateurs modernes sur ordinateur et mobile, hébergés comme application web
statique

**Project Type**: Application web monopage côté client

**Performance Goals**: 95 % des comparaisons avec données disponibles visibles en moins de
2 secondes ; recherche et filtrage immédiats sur le catalogue livré ; aucune interaction de
saisie ne bloque l'interface

**Constraints**: Fonctionnement sans compte et sans service HDV externe dans le MVP ; prix en kamas
entiers non négatifs ; données incomplètes explicitement signalées ; persistance limitée à
l'origine et à l'appareil du navigateur ; interface sans défilement horizontal à 320 px de large

**Scale/Scope**: Un profil local par navigateur, un catalogue Dofus versionné, une vue de recherche
et une vue de comparaison ; favoris, historique, opportunités et récupération automatique de prix
sont exclus de cette livraison

## Constitution Check

| Gate | Status | Plan response |
|------|--------|---------------|
| Données de jeu exactes et traçables | PASS | Le manifeste du catalogue porte sa source, sa version et sa date de mise à jour ; chaque objet et recette utilise des identifiants stables. |
| Calculs corrects et testables | PASS | Les calculs sont des fonctions pures avec des tests de cas usuels, incomplets, égaux et limites. |
| Résultats explicables | PASS | Le contrat de résultat expose les sous-totaux, données manquantes, hypothèses et base du pourcentage. |
| Changements cohésifs | PASS | Un seul client web et des frontières catalogue, domaine, persistance et interface ; aucun serveur ou synchronisation prématuré. |
| Données utilisateur sûres | PASS | Seuls les prix unitaires et leur date sont conservés localement ; aucune donnée sensible ni secret n'est requis. |

**Post-design re-check**: PASS. Les artefacts de données et contrats maintiennent les frontières,
la provenance et l'affichage des données incomplètes exigés par la constitution.

## Project Structure

### Documentation (this feature)

```text
specs/001-craft-profit-comparison/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── ui-and-storage.md
└── tasks.md                 # Created later by $speckit-tasks
```

### Source Code (repository root)

```text
src/
├── app/                     # Application shell, routing and global providers
├── components/              # Reusable accessible UI components
├── features/
│   ├── catalogue/           # Search, category filtering and object selection
│   └── comparison/          # Recipe, price entry and profitability presentation
├── domain/                  # Types and pure recipe/comparison calculations
├── data/                    # Versioned catalogue, manifest and catalogue repository
├── persistence/             # IndexedDB repository for local resource prices
├── styles/                  # Theme, responsive tokens and global styles
└── main.tsx

tests/
├── unit/                    # Domain calculations and validation
├── integration/             # Repositories and feature interactions
└── e2e/                     # Desktop and mobile player journeys
```

**Structure Decision**: A single browser application is sufficient because the MVP has no account,
server-owned data, or automatic HDV import. `data/` and `persistence/` are separate adapters so a
future remote catalogue or price provider can be introduced without changing calculation rules or
screens.

## Complexity Tracking

No constitution violations or exceptional complexity require justification.
