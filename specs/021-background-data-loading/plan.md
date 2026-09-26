# Implementation Plan: Chargement des données en fond et cache persistant

**Branch**: `021-background-data-loading` | **Date**: 2026-09-26 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/021-background-data-loading/spec.md`

## Summary

Trois améliorations indépendantes du chargement des données :
1. Le cache du catalogue DofusDB (`cached()`) devient persistant : mémoire puis IndexedDB, frais 24 h,
   au-delà servi immédiatement et rechargé en fond ([research.md §1-§3](research.md)).
2. Le calcul de la page Prix sort du hook dans une fonction de module partagée, lancée en fond par
   l'`AppShell` quand le catalogue est prêt et le navigateur inactif ([§4](research.md)).
3. Nouvel endpoint worker `GET /community-prices` pour lire les médianes par lot, utilisé par le
   remplissage des prix communautaires ; cache de 60 s (mémoire de l'isolat + `Cache-Control`),
   contourné par `fresh=1` après une contribution ([§5-§6](research.md),
   [contrat](contracts/community-prices.md)).

## Technical Context

**Language/Version**: TypeScript 5 (site React 19 + Vite ; worker Cloudflare)

**Primary Dependencies**: React, react-router-dom ; worker : Cloudflare Workers + D1. Aucune
nouvelle dépendance.

**Storage**: IndexedDB `dofus-craft-catalogue-cache` (existante) ; localStorage existant pour les prix
communautaires ; D1 `dofus-craft-community-prices` (aucune migration).

**Testing**: Vitest (+ fake-indexeddb déjà utilisé si présent, sinon store injecté), Playwright pour
un scénario de bout en bout optionnel.

**Target Platform**: navigateurs récents ; worker sur `*.workers.dev`.

**Project Type**: application web + worker d'API.

**Performance Goals**: recherche utilisable < 1 s dès la 2ᵉ visite ; page Prix affichée < 1 s après
10 s sur le site ; 1 requête de prix partagés par recette.

**Constraints**: résultats strictement identiques (principe II) ; aucun blocage si IndexedDB
indisponible ; la préparation en fond ne doit pas ralentir l'interface.

**Scale/Scope**: 10 à 20 joueurs ; catalogue de quelques milliers d'objets.

## Constitution Check

| Principe | Vérification | Statut |
|---|---|---|
| I. Données traçables | Les entrées gardées portent `savedAt` ; les données périmées sont revalidées, jamais inventées | ✅ |
| II. Exactitude avant optimisation | Un seul calcul Prix partagé ; même fonction de médiane pour le lot ; tests d'équivalence | ✅ |
| III. Décisions explicables | Aucune valeur affichée ne change ; indicateurs de synchro existants conservés | ✅ |
| IV. Changements petits et cohérents | Pas de nouvelle dépendance ; modifications ciblées sur `cached()`, `useCraftProfits`, prix communautaires, worker | ✅ |
| V. Données utilisateur | Seules des données publiques sont mises en cache ; aucune donnée joueur ajoutée côté worker | ✅ |
| Échec sûr | IndexedDB ou worker indisponible → comportement actuel | ✅ |

Re-vérification après conception : aucune violation.

## Project Structure

### Documentation (this feature)

```text
specs/021-background-data-loading/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/community-prices.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── data/catalogue-cache.ts                         # cache deux niveaux + revalidation 24 h
├── persistence/indexeddb-catalogue-cache-store.ts  # formatVersion, erreurs avalées
├── app/AppShell.tsx                                # déclenche preloadCraftProfits
├── features/prices/useCraftProfits.ts              # computeCraftProfits partagé + preload
├── features/comparison/useCommunityPrice.ts        # lookupCommunityMedians (lot) + fresh après envoi
├── features/comparison/community-gap-fill.ts       # utilise le lot
└── services/community-price-api.ts                 # getCommunityPrices, option fresh

worker/src/
├── index.ts                                        # route /community-prices, cache GET, purge sur POST
├── contribution.ts                                 # fetchCurrentMedians (IN …)
└── read-cache.ts                                   # cache mémoire 60 s (nouveau)

tests/unit/                                         # tests correspondants
```

**Structure Decision**: structure existante (site dans `src/`, worker dans `worker/src/`), aucun
nouveau dossier hormis le fichier `worker/src/read-cache.ts`.

## Complexity Tracking

Aucune violation à justifier.
