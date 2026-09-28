# Implementation Plan: Dernier prix partagé pour les ressources

**Branch**: `024-latest-community-price` | **Date**: 2026-09-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/024-latest-community-price/spec.md`

## Summary

En Mode communautaire, une ressource affiche et utilise le **dernier prix partagé** par le groupe au
lieu de la médiane, et ce dernier prix remplace le prix gardé sur l'appareil quand il est plus
récent. Le Worker ajoute `latestAmountKamas` / `latestContributionAt` à ses réponses de lecture
(rétrocompatible) et continue d'enregistrer médiane et écart avec chaque contribution. Côté site,
une règle pure `pickCommunityPrice` (date du prix gardé contre date du dernier relevé) est appliquée
par la ligne de prix (Recherche, HDV), par la synchronisation des pages qui calculent sans afficher
chaque ligne (Recherche, Suivis, Rentabilité) et par XP Familier. La confirmation d'un prix aberrant
compare toujours à la médiane, sans la montrer. Détails : [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5.7 (site et Worker)

**Primary Dependencies**: React 19, React Router 7, Vite 5 ; Cloudflare Workers + D1 (Worker
`dofus-craft-community-price-api`)

**Storage**: D1 `community_price_contributions` (inchangée) ; IndexedDB côté appareil (carnet Mode
communautaire) ; localStorage (cache du dernier prix partagé lu)

**Testing**: Vitest (unitaires, intégration avec jsdom et fake-indexeddb), Playwright (e2e, API
communautaire coupée)

**Target Platform**: navigateurs récents (ordinateur et mobile) ; Cloudflare Workers

**Project Type**: application web (site statique + Worker d'API)

**Performance Goals**: un nouveau prix visible sur les autres appareils en moins d'1 minute (cache
de 60 s inchangé) ; pas de requête supplémentaire par ressource (lectures groupées par 98)

**Constraints**: rétrocompatibilité de l'API avec le site déjà en ligne ; fonctionnement hors ligne
inchangé (FR-010) ; aucune donnée identifiant le joueur ne sort du Worker

**Scale/Scope**: petit groupe fermé (10 à 20 joueurs) ; quelques milliers de ressources par serveur

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principe | Vérification | Statut |
|---|---|---|
| I. Données traçables | Chaque prix affiché garde sa date (celle du relevé, pas celle de l'appareil) ; la médiane reste tracée en base avec chaque contribution. | ✅ |
| II. Exactitude avant optimisation | Règle de choix et calcul du dernier prix en fonctions pures testées (cas nominal, égalité de date, absence de prix, entrée de cache ancienne). | ✅ |
| III. Décisions explicables | La ligne montre le prix utilisé et sa date ; la confirmation d'un prix aberrant ne montre plus la référence (choix explicite du joueur, option B). Écart documenté ci-dessous. | ✅ (justifié) |
| IV. Changements petits et cohérents | Pas de table, pas de dépendance ; une règle partagée remplace le pré-remplissage unique ; `fillCommunityGaps` renommé et élargi plutôt que dupliqué. | ✅ |
| V. Données utilisateur | Aucune donnée nouvelle collectée ; aucun identifiant d'appareil renvoyé. Le remplacement d'un prix gardé n'est pas une action destructive du joueur : il est remplacé par un relevé plus récent du groupe, et la saisie en cours est protégée. | ✅ |

Re-vérification après la conception : inchangée.

## Project Structure

### Documentation (this feature)

```text
specs/024-latest-community-price/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── community-price-api.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
worker/src/
├── median.ts                      # summarizeContributions : + dernier prix (montant, date)
├── contribution.ts                # réponse /community-prices : + latestAmountKamas / latestContributionAt
└── index.ts                       # réponse /community-price (construite ici) : mêmes champs ajoutés

src/
├── domain/
│   ├── types.ts                   # CommunityPrice : + latestAmountKamas, latestContributionAt
│   ├── community-price-choice.ts  # NOUVEAU : pickCommunityPrice (règle pure)
│   └── pet-xp.ts                  # PetFoodPrice.origin : 'community-median' → 'community-latest'
├── persistence/
│   ├── resource-price-repository.ts        # save(serverId, id, price, updatedAt?)
│   └── server-scoped-price-store.ts        # date fournie ou heure actuelle
├── services/community-price-api.ts          # lecture des nouveaux champs
└── features/
    ├── comparison/
    │   ├── useCommunityPrice.ts             # cache local avec les nouveaux champs ; lookup du dernier prix
    │   ├── community-gap-fill.ts            # → syncCommunityPrices (toutes les ressources, règle de date)
    │   ├── CommunityResourcePriceRow.tsx    # synchronisation au lieu du pré-remplissage unique ; date du relevé
    │   ├── PriceEntryField.tsx              # « en cours de saisie » séparé de « a un prix gardé » ; save avec date
    │   ├── useResourcePrices.ts             # save avec date optionnelle
    │   └── OutlierConfirmDialog.tsx         # ressource : pas de référence ni d'écart affichés
    ├── search/RecherchePage.tsx             # syncCommunityPrices pour les lignes non affichées
    ├── catalogue/EpinglesPage.tsx           # syncCommunityPrices
    ├── prices/useCraftProfits.ts            # syncCommunityPrices
    └── pets/
        ├── usePetFoodPrices.ts              # pickCommunityPrice + écriture dans le carnet
        └── FamilierPage.tsx                 # plus de « Médiane · »

tests/
├── unit/        # community-price-choice, community-price-summary (dernier prix), community-prices-route,
│                # community-price-api, use-community-price, outlier (dialogue ressource)
└── integration/ # community-price-prefill (remplacement par un prix plus récent, saisie protégée),
                 # epingles-community-prices, prices-page, familier-page
```

**Structure Decision**: structure existante (site dans `src/`, Worker dans `worker/`, tests dans
`tests/`). Un seul fichier nouveau : `src/domain/community-price-choice.ts`, pour que toutes les
pages appliquent la même règle.

## Amendements aux specs existantes

À noter en fin de chaque spec concernée lors de l'implémentation :
- specs/004 : FR-001, FR-003 (dernier prix au lieu de la médiane), FR-006 (remplacé par la règle de
  date).
- specs/007 : FR-005 (la confirmation d'une ressource ne montre plus la médiane ni l'écart).
- specs/021 : contrat `/community-prices` (champs ajoutés).
- specs/022 : research §4 (la page écrit le dernier prix dans le carnet ; plus de « Médiane »).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Principe III : la confirmation d'un prix aberrant de ressource ne montre plus sa référence | Demande explicite (spec FR-003, FR-009 option B) : la médiane ne doit plus être visible | Montrer le dernier prix comme référence (option A) : refusé par le joueur ; montrer la médiane : contraire à FR-003 |
