# Implementation Plan: Page Prix — bénéfice de craft par objet

**Branch**: `019-craft-profit-list` | **Date**: 2026-09-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/019-craft-profit-list/spec.md`

## Summary

La page Prix (`/prix`) est réécrite : elle liste les objets du serveur actif dont le prix HDV est
connu et le coût de craft calculable, avec prix HDV (et sa date), coût de craft, bénéfice en kamas
et marge en %, triés par kamas ou par % (décroissant, puis par nom). Un filtre par nom et une limite
de lignes (10 / 25 / 50 / 100) restent. Une ligne ouvre l'objet dans la page Recherche.

Le calcul réutilise exactement celui des pages Recherche et Suivis : `loadRecipeTree`,
`effectiveIngredientPrices` avec **aucun choix forcé** (= « Auto » partout, FR-004), puis
`compare()`. Les prix suivent le mode : `resourcePricesFor(priceMode)` pour les ressources (avec
`fillCommunityGaps` en Mode communautaire), et pour le prix HDV le carnet `pinnedItemPrices` en Mode
personnel ou le dernier prix partagé en Mode communautaire.

Seul manque la liste des objets candidats en Mode communautaire : une nouvelle route de lecture
anonyme du Worker, `GET /item-prices?serverId=`, renvoie le dernier prix partagé de chaque objet du
serveur (même règle que `/latest-price`, specs/016). En Mode personnel, la liste vient de
`pinnedItemPrices.listAllForServer`, comme aujourd'hui.

## Technical Context

**Language/Version** : TypeScript 5 (strict), React 19 ; Worker Cloudflare (TypeScript)

**Primary Dependencies** : React, React Router, Vite ; Worker : Cloudflare Workers + D1. Aucune
nouvelle dépendance

**Storage** : D1 `community_price_contributions` (lu, **sans migration**) ; carnets IndexedDB
existants (ressources par mode, prix HDV personnels) ; cache catalogue existant (recettes DofusDB)

**Testing** : Vitest (unitaires Worker et domaine, intégration jsdom de la page), Playwright (un
scénario e2e)

**Target Platform** : navigateurs modernes (ordinateur, mobile) ; Worker Cloudflare

**Project Type** : SPA + Worker d'API communautaire

**Performance Goals** : liste affichée en moins de 3 s (SC-004) ; la page se remplit
progressivement (lignes ajoutées dès que l'arbre de recettes d'un objet est complet)

**Constraints** : même calcul que Recherche (SC-001) ; aucune valeur inventée (FR-009) ; pas de
taxe HDV ; lisible sur téléphone (FR-011)

**Scale/Scope** : quelques dizaines à quelques centaines d'objets avec un prix HDV par serveur

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principe | Vérification | Statut |
|---|---|---|
| I. Données traçables | Chaque ligne vient de prix réels (carnet ou prix partagés) ; date du prix HDV affichée ; objet non calculable absent, jamais complété | ✅ |
| II. Exactitude avant optimisation | Calcul partagé avec Recherche (mêmes fonctions), tests : bénéfice, marge, arrondi, tri et égalités, exclusion des non calculables, « Auto » ignore les choix forcés | ✅ |
| III. Décisions explicables | Prix HDV, coût, bénéfice, marge et date visibles ; une ligne ouvre le détail du calcul dans Recherche | ✅ |
| IV. Changements petits et cohérents | Une route de lecture ajoutée, calcul réutilisé ; l'ancienne page est remplacée, pas dupliquée | ✅ |
| V. Données utilisateur | Aucune donnée nouvelle collectée ; la route n'expose que ce que `/latest-price` expose déjà (montant, date), sans `device_id` | ✅ |
| Contraintes projet | Accès au Worker via `community-price-api.ts` ; panne → message, pas de valeur ; règle de calcul (domaine), chargement (hook) et présentation (page) séparés | ✅ |

**Réévaluation après la phase 1** : inchangée, aucune violation.

## Project Structure

### Documentation (this feature)

```text
specs/019-craft-profit-list/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── item-prices-api.md     # GET /item-prices (Worker) + client
│   └── prices-page-ui.md      # Page Prix
└── tasks.md                   # /speckit-tasks
```

### Source Code (repository root)

```text
worker/src/
├── latest.ts                 # modifié : readLatestItemPrices(db, serverId) + itemPricesResponse
└── index.ts                  # modifié : route GET /item-prices

src/
├── domain/
│   └── craft-profit.ts               # nouveau : ligne de bénéfice (bénéfice, marge), tri, filtre
├── services/
│   └── community-price-api.ts        # modifié : getSharedItemPrices(serverId), ne lève jamais
└── features/prices/
    ├── PricesPage.tsx                # réécrit : liste des objets rentables
    └── useCraftProfits.ts            # nouveau : candidats, recettes, prix, calcul progressif

tests/
├── unit/
│   ├── item-prices-route.test.ts     # Worker : dernier prix par objet, kind, serveur, 400
│   ├── item-prices-api.test.ts       # client
│   └── craft-profit.test.ts          # bénéfice, marge, tri, égalités, filtre
├── integration/
│   └── prices-page.test.tsx          # réécrit : modes, calcul = Recherche, exclusions, tri, clic
└── e2e/
    └── prices-page.spec.ts           # adapté ou nouveau : liste affichée, tri par %
```

**Structure Decision** : structure existante. Le calcul de coût reste celui de `craft-tree.ts` /
`craft-comparison.ts` ; `craft-profit.ts` n'ajoute que bénéfice, marge et tri.

## Complexity Tracking

Aucune violation de la constitution : section sans objet.
