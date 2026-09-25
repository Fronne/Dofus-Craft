# Implementation Plan: Prix HDV des objets partagé en Mode communautaire

**Branch**: `016-shared-item-prices` (travail sur `master`, comme les fonctionnalités précédentes) | **Date**: 2026-09-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/016-shared-item-prices/spec.md`

## Summary

En Mode communautaire, le prix HDV d'un objet devient partagé : le champ affiche la **dernière**
contribution du groupe pour cet objet et ce serveur (pas de médiane), avec sa date ; une saisie
validée est partagée et devient le dernier prix ; un écart de plus de 50 % avec le dernier prix
affiché demande une confirmation. Côté Worker, les contributions d'objets vont dans la même table
que celles des ressources (même espace d'identifiants DofusDB), distinguées par une nouvelle colonne
`kind` : on ajoute une lecture `GET /latest-price`, un champ `kind: 'item'` à l'envoi (enregistré, et
qui fait tracer l'écart par rapport au dernier prix), et la purge des 90 jours épargne désormais la
contribution la plus récente de chaque objet/serveur — les ressources gardent la règle actuelle. Côté
application, un hook `useSharedItemPrice` (cache local + rafraîchissement) alimente le champ « Prix
HDV » (qui gagne verrouillage, date et validation) sur la fiche, et la page Suivis lit le même prix.
Le Mode personnel ne change pas.

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 19 ; Worker Cloudflare (TypeScript)

**Primary Dependencies**: React, react-router-dom, Vite ; Worker : Cloudflare Workers + D1 ; aucune nouvelle dépendance

**Storage**: D1 `community_price_contributions` (existant) + colonne `kind` (migration `0005`) ; cache local
`localStorage` du dernier prix vu par objet/serveur ; Mode personnel : `pinnedItemPrices` (IndexedDB) inchangé

**Testing**: Vitest (unitaires Worker + application, intégration), Playwright (e2e existant)

**Target Platform**: navigateurs modernes (ordinateur, mobile) ; Worker Cloudflare

**Project Type**: SPA + Worker d'API communautaire

**Performance Goals**: prix affiché dès l'ouverture depuis le cache local, puis rafraîchi (comme les prix de ressources)

**Constraints**: aucune donnée identifiant le joueur (specs/004 FR-010) ; Mode personnel strictement inchangé ; jamais de prix inventé

**Scale/Scope**: groupe fermé de ~10-20 joueurs ; une requête de lecture par objet affiché ou suivi

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principe | Vérification | Statut |
|---|---|---|
| I. Données traçables | Le prix affiché est une contribution réelle datée ; absence de contribution → champ vide, jamais de valeur inventée ; date toujours visible | ✅ |
| II. Exactitude avant optimisation | Règles testées : dernier prix (pas de calcul), seuil 50 % (bornes 49/50/51 %), pas de confirmation sans dernier prix, purge qui garde la plus récente | ✅ |
| III. Décisions explicables | Date de mise à jour sous le champ ; la confirmation montre dernier prix, prix saisi et écart | ✅ |
| IV. Changements petits et cohérents | Même table, même endpoint d'écriture (champ `kind` facultatif), un endpoint de lecture ; le champ HDV réutilise le comportement des champs de ressources | ✅ |
| V. Données utilisateur | Contribution anonyme (deviceId existant) ; seule la dernière contribution de chaque **objet** (`kind = 'item'`) est gardée au-delà de 90 jours, parce que FR-001 en a besoin ; les ressources gardent la règle des 90 jours (analyse C1) — révision de specs/004 FR-013 documentée | ✅ |
| Contraintes projet | Source externe (API communautaire) derrière `community-price-api.ts` ; service injoignable → dernier prix connu ou champ vide | ✅ |

## Project Structure

### Documentation (this feature)

```text
specs/016-shared-item-prices/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── community-api.md       # GET /latest-price, POST /community-price (kind), purge
│   └── market-price-ui.md     # champ « Prix HDV » en Mode communautaire, page Suivis
└── tasks.md
```

### Source Code (repository root)

```text
worker/
├── schema.sql               # colonne kind
└── migrations/0005_add_contribution_kind.sql   # NOUVEAU

worker/src/
├── index.ts                 # GET /latest-price ; POST accepte kind: 'item'
├── latest.ts                # NOUVEAU : lecture de la dernière contribution
├── outlier.ts               # écart par rapport au dernier prix pour kind: 'item' (seuil 50 %)
└── retention.ts             # purge : garde la plus récente par objet/serveur

src/
├── domain/outlier-threshold.ts          # ITEM_OUTLIER_THRESHOLD_PERCENT = 50
├── services/community-price-api.ts      # getLatestItemPrice, submitCommunityPrice(…, kind)
├── features/comparison/
│   ├── useSharedItemPrice.ts            # NOUVEAU : dernier prix partagé (cache + rafraîchissement)
│   ├── MarketPriceInput.tsx             # verrouillage, date, validation (Mode communautaire)
│   └── OutlierConfirmDialog.tsx         # libellé « Dernier prix » pour les objets
├── features/search/RecherchePage.tsx    # branche le prix partagé en Mode communautaire
└── features/catalogue/EpinglesPage.tsx  # cartes : prix partagé en Mode communautaire

tests/
├── unit/community-latest-price.test.ts   # Worker : lecture, purge, écart item
├── unit/use-shared-item-price.test.tsx
└── integration/shared-item-price.test.tsx
```

**Structure Decision**: structure existante (app `src/` + `worker/src/`, tests communs dans
`tests/`) ; aucune nouvelle couche.

## Complexity Tracking

Aucune violation. Seul écart à une spec existante : specs/004 FR-013 (purge à 90 jours) est révisée
pour conserver la contribution la plus récente de chaque objet/serveur (lignes `kind = 'item'`
uniquement) — nécessaire à FR-001 de la spec 016 (« prix le plus récent, sans limite d'ancienneté »).
