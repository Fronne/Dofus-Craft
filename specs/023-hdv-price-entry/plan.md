# Implementation Plan: Page Saisie HDV — relever les prix par hôtel des ventes

**Branch**: `023-hdv-price-entry` | **Date**: 2026-09-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/023-hdv-price-entry/spec.md`

## Summary

Nouvelle page « HDV » (entrée de navigation entre Prix et Familier, l'Accueil sortant de la
navigation) avec trois onglets — Ressources, Consommables, Animaux — listant les objets utiles à
l'app vendus à chaque HDV, chacun avec le même champ de prix que la page Recherche (même carnet, même
comportement personnel / communautaire). La liste des objets de chaque HDV est générée une fois par
un script (recettes DofusDB + tableau d'XP familier + nourriture pour familier) à partir d'une
correspondance type d'objet → HDV écrite à la main et validée en jeu, car ni le client ni DofusDB ne
la fournissent (research.md §1-§3). Le champ de prix de la Recherche est extrait en composant
partagé pour garantir un comportement identique (§4).

## Technical Context

**Language/Version**: TypeScript 5.7, React 19, Node 24 pour les scripts

**Primary Dependencies**: react-router-dom 7, Vite 5 ; aucune nouvelle dépendance

**Storage**: carnets IndexedDB existants (`resourcePricesFor(mode)`), localStorage pour l'onglet
mémorisé ; données statiques `src/data/hdv-items.json` chargées à la demande

**Testing**: Vitest + Testing Library (unit, integration), Playwright (e2e)

**Target Platform**: navigateur (ordinateur et mobile), site déployé sur Cloudflare Workers

**Project Type**: application web mono-projet (SPA + Worker de l'API communautaire, inchangé)

**Performance Goals**: filtrage / recherche < 1 s sur ≈ 2 800 objets (SC-005) ; données HDV hors du
bundle initial

**Constraints**: aucune valeur inventée (HDV non deviné, constitution I) ; comportement du champ de
prix strictement identique à la Recherche (FR-006)

**Scale/Scope**: ≈ 3 000 objets au total ; groupe de 10 à 20 joueurs

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principe | Vérification | Statut |
|---|---|---|
| I. Données traçables | Correspondance type → HDV commitée avec source (« relevé en jeu ») et date ; `hdv-items.json` porte sa source, sa date et les types non rattachés ; aucun HDV deviné | ✅ |
| II. Correction avant optimisation | Filtres, décompte et règle « objet utile » en fonctions pures testées ; script testé sur des cas limites (type non rattaché, certificats exclus, doublons) | ✅ |
| III. Décisions explicables | Date et âge de chaque prix ; décompte « N sur M » ; note sur l'onglet Animaux indiquant que la page Familier n'utilise que les nourritures de son tableau | ✅ |
| IV. Changements petits et cohérents | Extraction du champ de prix de la Recherche sans changement de comportement (nécessaire à FR-006) ; extraction du chargement au défilement de la page Prix (réutilisé) ; retrait de l'Accueil limité à la navigation | ✅ |
| V. Données utilisateur | Aucune nouvelle donnée ; mêmes carnets et même partage communautaire qu'aujourd'hui | ✅ |

Re-vérification après la phase 1 : inchangée, aucune violation.

## Project Structure

### Documentation (this feature)

```text
specs/023-hdv-price-entry/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── hdv-type-map.md       # table type d'objet → HDV (entrée du script)
│   └── hdv-items-data.md     # src/data/hdv-items.json (sortie du script)
└── tasks.md                  # /speckit-tasks
```

### Source Code (repository root)

```text
scripts/
├── data/hdv-type-map.json            # NOUVEAU — correspondance validée en jeu
└── build-hdv-items.mjs               # NOUVEAU — génère src/data/hdv-items.json

src/
├── app/
│   ├── router.tsx                    # + ROUTES.hdv
│   └── AppShell.tsx                  # entrée HDV, Accueil retiré, /accueil → /
├── components/Icon.tsx               # + icône de l'entrée HDV
├── data/hdv-items.json               # NOUVEAU — généré, commité
├── domain/hdv.ts                     # NOUVEAU — types, filtres, décompte (fonctions pures)
├── features/
│   ├── comparison/
│   │   ├── CommunityResourcePriceRow.tsx  # EXTRAIT de RecherchePage.tsx, inchangé
│   │   └── PriceEntryField.tsx            # NOUVEAU — champ partagé perso / communautaire
│   ├── hdv/
│   │   ├── HdvPage.tsx               # NOUVEAU — onglets, filtres, liste
│   │   ├── useHdvItems.ts            # NOUVEAU — import() dynamique de hdv-items.json
│   │   └── useHdvPriceSummary.ts     # NOUVEAU — lecture groupée du carnet pour décompte/filtres
│   ├── prices/PricesPage.tsx         # utilise useLoadMoreOnScroll extrait
│   └── search/RecherchePage.tsx      # utilise PriceEntryField
├── hooks/useLoadMoreOnScroll.ts      # EXTRAIT de PricesPage.tsx
└── styles/global.css                 # styles de la page HDV

tests/
├── unit/hdv-domain.test.ts           # filtres, décompte, prix ancien
├── unit/hdv-items-data.test.ts       # cohérence du JSON généré (types rattachés, pas de certificat, pas de doublon)
├── integration/hdv-page.test.tsx     # saisie → carnet → visible sur Recherche ; navigation
└── e2e/hdv-price-entry.spec.ts       # parcours complet
```

**Structure Decision**: mono-projet existant ; la page suit le découpage `features/<page>/` des
pages Prix et Familier, la logique pure va dans `src/domain/`, les données figées dans `src/data/`
générées par un script de `scripts/`, comme `pet-xp-data.json`.

## Étape bloquante avant l'implémentation

La correspondance de `scripts/data/hdv-type-map.json` (research.md §2) doit être **validée en jeu
par le porteur du projet**, en particulier les 8 types « à confirmer ». Les tâches doivent prévoir
cette validation avant de générer `hdv-items.json`.

## Complexity Tracking

Aucune violation de la constitution à justifier.
