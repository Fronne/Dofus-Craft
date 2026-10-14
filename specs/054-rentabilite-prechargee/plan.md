# Implementation Plan: Page Rentabilité déjà prête à l'arrivée

**Branch**: `054-rentabilite-prechargee` | **Date**: 2026-10-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/054-rentabilite-prechargee/spec.md`

## Summary

La dernière liste Rentabilité complète de chaque couple serveur + mode est gardée dans le
`localStorage` de l'appareil (lecture synchrone : elle est affichée dès le premier rendu de la page,
sans état « Calcul en cours »), avec sa date de calcul et une version de format. Pendant qu'elle est
affichée, la page montre une mention datée « mise à jour en cours… » ; la liste à jour la remplace en
une fois quand elle est complète. Côté préparation en fond, l'attente d'inactivité de 5 s avant de
démarrer disparaît (départ dès que le catalogue est prêt), la limite passe de 2 à 4 chargements
simultanés, et chaque chargement en fond cède d'abord la main au navigateur (courte attente
d'inactivité, 200 ms au plus) pour que les actions du joueur passent en priorité. Les règles de calcul
ne changent pas.

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 18

**Primary Dependencies**: React, React Router, Vite (aucune nouvelle dépendance)

**Storage**: `localStorage` du navigateur (nouvelle clé par serveur + mode) ; mémoire pour la visite
(existant)

**Testing**: Vitest + Testing Library (unitaires et intégration, jsdom, fake-indexeddb)

**Target Platform**: navigateurs récents, ordinateur et mobile

**Project Type**: application web (front React) + Worker Cloudflare (non touché)

**Performance Goals**: liste gardée affichée en < 1 s à l'ouverture de la page (SC-001) ; liste à jour
prête < 10 s après l'ouverture du site pour < 100 objets candidats (SC-002)

**Constraints**: la Recherche reste fluide pendant la préparation (SC-003) ; aucune valeur ne change
(SC-004) ; stockage indisponible → comportement actuel (FR-007)

**Scale/Scope**: 10 à 20 joueurs, quelques dizaines à quelques centaines d'objets candidats par
serveur et mode ; 3 fichiers source touchés + 1 nouveau

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Données exactes et traçables** — ✅ une liste gardée n'est jamais présentée comme à jour : elle
  porte toujours sa date de calcul (FR-003, SC-005) ; au-delà de 7 jours ou d'un format incompatible,
  elle n'est pas affichée (FR-006).
- **II. Exactitude avant optimisation** — ✅ le calcul est inchangé (`compute` réutilisé tel quel) ;
  seule une liste **complète** est gardée ; tests de non-régression (liste gardée = liste calculée).
- **III. Décisions explicables** — ✅ la mention datée explique pourquoi les chiffres peuvent différer
  du carnet actuel ; l'échec de mise à jour est dit, pas masqué.
- **IV. Changements petits et cohérents** — ✅ un module de persistance de ~40 lignes, des ajustements
  dans `useCraftProfits` et `PricesPage` ; aucune abstraction ni dépendance nouvelle.
- **V. Données utilisateur** — ✅ la liste reste sur l'appareil, rien n'est envoyé (FR-012) ; en mode
  personnel elle dérive de prix déjà stockés localement.
- **Contraintes projet** — ✅ échec sûr : stockage indisponible ou liste invalide → comportement
  actuel ; jamais de valeur inventée.

Révision de specs existantes : l'hypothèse « la liste Prix n'est pas gardée d'une visite à l'autre »
des specs 019 et 021 est remplacée ; une note de révision est ajoutée à la spec 021.

## Project Structure

### Documentation (this feature)

```text
specs/054-rentabilite-prechargee/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── ui-rentabilite.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── persistence/
│   └── craft-profits-cache.ts      # NOUVEAU : lecture / écriture de la liste gardée
├── features/prices/
│   ├── useCraftProfits.ts          # liste gardée à l'initialisation, enregistrement, préparation plus tôt et plus rapide
│   └── PricesPage.tsx              # mention datée « mise à jour en cours / impossible »
└── styles/global.css               # style de la mention (si nécessaire)

tests/
├── unit/
│   ├── craft-profits-cache.test.ts      # NOUVEAU
│   └── craft-profits-preload.test.ts    # départ sans inactivité, 4 simultanés
└── integration/
    └── prices-page.test.tsx             # liste gardée affichée, remplacée, échec
```

**Structure Decision**: application web existante ; le stockage suit le modèle des petits caches
`localStorage` de `src/persistence/` (ex. `site-settings-cache.ts`).

## Complexity Tracking

Aucune violation de la constitution à justifier.
