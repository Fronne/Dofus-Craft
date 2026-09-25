# Implementation Plan: Graphe d'historique des prix HDV

**Branch**: `017-price-history-chart` | **Date**: 2026-09-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/017-price-history-chart/spec.md`

## Summary

En Mode communautaire, un bouton « historique » sur chaque ligne de ressource et sur le champ « Prix
HDV » ouvre un popover avec la courbe des prix partagés sur 90 jours, pour le serveur actif. Le
joueur choisit le regroupement jour / semaine / mois ; chaque point est la médiane des prix de la
période et le nombre de prix qui la composent.

Côté Worker, une nouvelle route de lecture anonyme `GET /price-history` calcule ces points à partir
des contributions existantes. Elle renvoie les trois regroupements en une seule réponse, et jamais un
prix individuel. Le calcul reprend les règles actuelles :
- un appareil compte une seule fois par période, avec son dernier prix (specs/004 FR-023) ;
- les valeurs aberrantes sont écartées par la méthode de l'écart interquartile (specs/004 FR-012) ;
- la médiane est interpolée (`percentile_cont`).

Les périodes suivent l'heure de Paris. La rétention ne change pas.

Côté application, un client `getPriceHistory` (qui ne lève jamais d'exception) alimente un popover.
Ce popover reprend le comportement de la bulle des compteurs : Échap, clic à l'extérieur, bouton
« Fermer ». Il est rendu hors du `<label>` de la ligne, et contient une petite courbe SVG dessinée à
la main, sans nouvelle dépendance. Le choix du regroupement est retenu dans `localStorage`. Rien ne
change en Mode personnel.

## Technical Context

**Language/Version** : TypeScript 5 (strict), React 19 ; Worker Cloudflare (TypeScript)

**Primary Dependencies** : React, Vite ; Worker : Cloudflare Workers + D1. **Aucune nouvelle
dépendance** : la courbe est un SVG en ligne (research.md §4)

**Storage** : D1 `community_price_contributions` (existant, **sans migration**, lu uniquement) ;
préférence de regroupement dans `localStorage` ; cache en mémoire des historiques déjà chargés
pendant la visite

**Testing** : Vitest (unitaires Worker et application, intégration jsdom), Playwright (un scénario
e2e)

**Target Platform** : navigateurs modernes (ordinateur, mobile) ; Worker Cloudflare

**Project Type** : SPA + Worker d'API communautaire

**Performance Goals** : popover rempli en moins de 2 s (SC-005). Une requête par ouverture, et aucune
au changement de regroupement, puisque les trois regroupements arrivent ensemble

**Constraints** :
- aucun prix individuel ne sort du Worker (FR-006) ;
- aucune valeur inventée (constitution I) ;
- la comparaison craft / HDV n'est pas modifiée (FR-014) ;
- lisible à la largeur d'un téléphone (FR-015).

**Scale/Scope** : groupe fermé de 10 à 20 joueurs ; au plus quelques centaines de contributions par
ressource et par serveur sur 90 jours ; au plus 91 + 14 + 4 points par réponse

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principe | Vérification | Statut |
|---|---|---|
| I. Données traçables | Chaque point est un agrégat de contributions réelles et datées, accompagné de son nombre de prix. Aucune période sans prix n'est affichée, et il n'y a pas de courbe sous 2 périodes. Si le service est injoignable, un message s'affiche, jamais une valeur | ✅ |
| II. Exactitude avant optimisation | Règles de regroupement testées : limites de jour en heure de Paris (y compris au changement d'heure), semaine du lundi, mois civil, un appareil par période, filtre des valeurs aberrantes, séparation ressource / objet, fenêtre de 90 jours | ✅ |
| III. Décisions explicables | La période, la médiane et le nombre de prix sont visibles sur chaque point. Le popover indique la fenêtre de 90 jours et que ce sont des médianes. L'historique ne change aucun calcul (FR-014) | ✅ |
| IV. Changements petits et cohérents | Une seule route de lecture, qui réutilise `percentileCont`, `outlierBounds` et `latestPerDevice` de `median.ts`. Aucune migration, aucune dépendance. Le popover reprend le comportement de `DungeonCounterBubble` | ✅ |
| V. Données utilisateur | Aucune donnée nouvelle n'est collectée ni conservée plus longtemps. La réponse ne contient que des agrégats par période, sans `device_id` ni horodatage individuel. La préférence de regroupement reste sur l'appareil | ✅ |
| Contraintes projet | L'accès au service passe par `community-price-api.ts`, et une panne donne l'état « indisponible ». Règles d'agrégation (Worker), présentation (popover, courbe) et préférence (persistence) sont séparées | ✅ |

**Réévaluation après la phase 1** : le design (research.md, data-model.md, contracts/) ne change aucun
des points ci-dessus. Il n'y a aucune violation à justifier.

## Project Structure

### Documentation (this feature)

```text
specs/017-price-history-chart/
├── plan.md              # Ce fichier
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── price-history-api.md   # GET /price-history (Worker)
│   └── price-history-ui.md    # Bouton, popover, courbe (application)
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
worker/src/
├── median.ts                 # modifié : exporte percentileCont / outlierBounds (déjà utilisés en interne)
├── price-history.ts          # nouveau : regroupement par période (heure de Paris) + réponse de la route
└── index.ts                  # modifié : route GET /price-history (lecture anonyme)

src/
├── domain/
│   └── price-history.ts      # nouveau : types HistoryPoint / Grouping, règle « au moins 2 périodes »
├── services/
│   └── community-price-api.ts        # modifié : getPriceHistory(kind, id, serverId), ne lève jamais
├── persistence/
│   └── history-grouping-preference.ts # nouveau : regroupement retenu (localStorage, try/catch)
├── features/comparison/
│   ├── PriceHistoryButton.tsx        # nouveau : bouton + popover (portail), fermeture Échap/extérieur
│   ├── PriceHistoryChart.tsx         # nouveau : courbe SVG, axe du temps proportionnel, info-bulle
│   ├── usePriceHistory.ts            # nouveau : chargement à l'ouverture, cache mémoire de la visite
│   ├── ResourcePriceInput.tsx        # modifié : emplacement facultatif `history` sur la ligne
│   └── MarketPriceInput.tsx          # modifié : emplacement facultatif `history` à côté du champ
├── features/search/
│   └── RecherchePage.tsx             # modifié : passe le bouton en Mode communautaire uniquement
├── components/Icon.tsx               # modifié : icône « chart »
└── styles/comparison.css             # modifié : styles du bouton, du popover et de la courbe

tests/
├── unit/
│   ├── price-history-aggregation.test.ts   # Worker : périodes, appareils, aberrants, kind, fenêtre
│   ├── price-history-route.test.ts         # Worker : 400 / 200 et forme de la réponse
│   ├── price-history-api.test.ts           # client : parsing, indisponible, jamais d'exception
│   ├── history-grouping-preference.test.ts
│   └── price-history-chart.test.tsx        # points, trous, info-bulle, état « pas assez »
├── integration/
│   └── price-history-popover.test.tsx      # ouverture, fermeture, Mode personnel, changement de serveur
└── e2e/
    └── price-history.spec.ts               # popover ouvert sur une ressource, API simulée
```

**Structure Decision** : la structure existante (SPA `src/` + Worker `worker/`) est conservée. La
logique d'agrégation vit dans le Worker, à côté de `median.ts`, parce que c'est le seul endroit où
les prix individuels existent (FR-006). L'application ne reçoit que des points déjà agrégés.

## Complexity Tracking

Aucune violation de la constitution : section sans objet.
