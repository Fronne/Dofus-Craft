# Implementation Plan: Historique des prix par fenêtre de temps

**Branch**: `018-price-history-windows` | **Date**: 2026-09-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/018-price-history-windows/spec.md`

## Summary

Les boutons « Jour », « Semaine » et « Mois » du popover d'historique (spec 017) deviennent des
fenêtres glissantes de 24 heures, 7 jours et 30 jours. La courbe montre chaque prix partagé dans la
fenêtre, à son heure réelle, au lieu de médianes par période.

Côté Worker, la route `GET /price-history` garde son URL et ses paramètres, mais change de réponse :
pour chaque fenêtre, la liste des prix `{ amountKamas, sharedAt }`, valeurs aberrantes écartées sur
la fenêtre. Aucun `device_id` ne sort (FR-006 révisée). Le regroupement par période (heure de Paris)
et ses tests sont retirés.

Côté application, les types, le client, la règle d'affichage et la courbe passent des points médians
aux prix individuels. L'axe du temps couvre toute la fenêtre. Le bouton, le popover, la préférence
retenue (mêmes valeurs `day` / `week` / `month`, même clé `localStorage`) et le cache de visite ne
changent pas.

## Technical Context

**Language/Version** : TypeScript 5 (strict), React 19 ; Worker Cloudflare (TypeScript)

**Primary Dependencies** : React, Vite ; Worker : Cloudflare Workers + D1. Aucune nouvelle
dépendance : la courbe reste un SVG en ligne

**Storage** : D1 `community_price_contributions` (existant, **sans migration**, lu uniquement) ;
préférence dans `localStorage` (clé et valeurs inchangées) ; cache mémoire de visite (inchangé)

**Testing** : Vitest (unitaires Worker et application, intégration jsdom), Playwright (scénario e2e
existant, adapté)

**Target Platform** : navigateurs modernes (ordinateur, mobile) ; Worker Cloudflare

**Project Type** : SPA + Worker d'API communautaire

**Performance Goals** : popover rempli en moins de 2 s (SC-004) ; une requête par ouverture, aucune
au changement de fenêtre (les trois fenêtres arrivent ensemble)

**Constraints** :
- aucun identifiant d'appareil dans la réponse (FR-006, SC-003) ;
- aucune valeur inventée entre deux prix (FR-008, constitution I) ;
- la comparaison craft / HDV n'est pas modifiée (spec 017 FR-014) ;
- lisible à la largeur d'un téléphone (spec 017 FR-015).

**Scale/Scope** : groupe fermé de 10 à 20 joueurs ; quelques dizaines de prix au plus par ressource,
serveur et mois

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principe | Vérification | Statut |
|---|---|---|
| I. Données traçables | Chaque point est un prix réellement partagé, avec sa date et son heure. Aucun point entre deux prix, pas de courbe sous 2 prix, état « indisponible » si le service ne répond pas | ✅ |
| II. Exactitude avant optimisation | Tests des bornes de fenêtre (24 h, 7 j, 30 j incluses), du filtre des aberrants par fenêtre, de la séparation ressource / objet et serveur, de l'absence de `device_id` | ✅ |
| III. Décisions explicables | L'info-bulle donne date, heure et prix de chaque point ; l'historique ne change aucun calcul | ✅ |
| IV. Changements petits et cohérents | Même route, même popover, même préférence ; le regroupement par période est retiré plutôt que conservé à côté | ✅ |
| V. Données utilisateur | Aucune donnée nouvelle collectée ni conservée plus longtemps. Les prix individuels et leur heure deviennent lisibles (révision assumée de la spec 017 FR-006, petit groupe fermé), jamais l'identifiant d'appareil. Heure arrondie à la minute (research.md §2) | ✅ (écart justifié ci-dessous) |
| Contraintes projet | Accès au service via `community-price-api.ts` ; panne → « indisponible » ; filtrage (Worker), présentation (popover, courbe) et préférence (persistence) restent séparés | ✅ |

**Réévaluation après la phase 1** : le design ne change aucun des points ci-dessus.

## Project Structure

### Documentation (this feature)

```text
specs/018-price-history-windows/
├── plan.md              # Ce fichier
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── price-history-api.md   # GET /price-history, nouvelle réponse
│   └── price-history-ui.md    # Fenêtres, courbe, états
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
worker/src/
└── price-history.ts          # réécrit : fenêtres 24 h / 7 j / 30 j, prix individuels, aberrants par fenêtre

src/
├── domain/price-history.ts           # modifié : types HistoryWindow / SharedPrice, règle d'affichage, formats date + heure
├── services/community-price-api.ts   # modifié : validation de la nouvelle réponse
├── persistence/history-grouping-preference.ts  # inchangé (mêmes valeurs), commentaire mis à jour
└── features/comparison/
    ├── PriceHistoryButton.tsx        # modifié : états « aucun prix sur cette période » / prix unique / invitation
    └── PriceHistoryChart.tsx         # modifié : un point par prix, axe = fenêtre entière, info-bulle date + heure

tests/
├── unit/
│   ├── price-history-aggregation.test.ts   # réécrit : fenêtres, bornes, aberrants, kind, serveur
│   ├── price-history-route.test.ts         # adapté : forme de la réponse, pas de device_id
│   ├── price-history-api.test.ts           # adapté : nouvelle validation
│   ├── price-history-display.test.ts       # réécrit : règle d'affichage et invitation
│   └── price-history-chart.test.tsx        # adapté : points individuels, axe de la fenêtre
├── integration/price-history-popover.test.tsx  # adapté
└── e2e/price-history.spec.ts                    # adapté

specs/017-price-history-chart/spec.md   # note de révision renvoyant à la spec 018
```

**Structure Decision** : structure existante conservée. Le filtre des aberrants reste dans le
Worker, qui renvoie les trois fenêtres déjà filtrées : l'application n'a qu'à afficher.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Prix individuels et leur heure exposés (spec 017 FR-006 levée) | Le porteur du projet veut voir chaque prix comme un point (spec 018 FR-003, FR-006) | Médianes par heure / par jour (variante proposée) refusée par le porteur du projet ; l'identifiant d'appareil reste masqué et l'heure est arrondie à la minute |
