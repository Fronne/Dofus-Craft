# Plan d'implémentation : Onboarding de la page Recherche

**Branch**: `011-search-onboarding` | **Date**: 2026-09-23 | **Spec**: [spec.md](spec.md)

**Input**: Spécification de `specs/011-search-onboarding/spec.md`

## Résumé

Ajouter une visite guidée de six étapes sur la page Recherche. Elle démarre seule à la première
visite d'un appareil, se relance par un bouton d'aide, met en surbrillance chaque zone de la page
(recherche, fiche objet, prix des ressources, prix HDV, recommandation) et termine par une bulle
centrée sur le mode de prix. Approche : un composant maison basé sur le `<dialog>` natif déjà
utilisé par `OutlierConfirmDialog`, des attributs `data-tour` sur les zones existantes, et une clé
`localStorage` pour ne pas réafficher la visite (voir [research.md](research.md)).

## Contexte technique

**Language/Version** : TypeScript 5.7, React 19

**Primary Dependencies** : React, React DOM, React Router 7 — aucune nouvelle dépendance

**Storage** : `localStorage` (clé `craftcheck-search-tour-seen`) ; rien côté serveur

**Testing** : Vitest + Testing Library (jsdom, polyfill `<dialog>` existant dans `src/test/setup.ts`)

**Target Platform** : navigateurs récents, bureau et mobile ; hébergé en assets statiques Cloudflare

**Project Type** : application web (SPA) — seul le front change, le Worker n'est pas touché

**Performance Goals** : changement d'étape instantané ; aucun impact sur le chargement de la page

**Constraints** : pas de défilement horizontal sur mobile (marge 16 px) ; utilisable au clavier ;
aucune modification des données de la page pendant la visite

**Scale/Scope** : 1 page, 6 étapes, petit groupe de joueurs (10–20)

## Constitution Check

| Principe | Évaluation |
|----------|-----------|
| I. Données de jeu traçables | Non concerné : aucune donnée de jeu affichée ni transformée. |
| II. Exactitude avant optimisation | Aucun calcul modifié. Les règles de la visite (ordre, fermeture, mémorisation, cible absente) sont couvertes par des tests. |
| III. Décisions explicables | Renforcé : la visite explique d'où viennent les prix, « Dernière mise à jour », les contributions et le « partiel » du coût de craft. |
| IV. Changements petits et cohérents | Un composant, un fichier d'étapes, une préférence locale, des attributs `data-tour`. Pas de dépendance, pas de refactor. |
| V. Données utilisateur | Seul un indicateur « vu » est stocké, localement. Rien d'envoyé. Pas d'action destructrice. |

**Résultat** : conforme, avant et après la phase 1. Aucune entrée dans « Complexity Tracking ».

## Project Structure

### Documentation (this feature)

```text
specs/011-search-onboarding/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── guided-tour-ui.md
├── checklists/
│   └── requirements.md
└── tasks.md             # créé par /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── features/
│   ├── onboarding/
│   │   ├── GuidedTour.tsx              # nouveau : <dialog>, découpe, bulle, navigation
│   │   └── search-tour-steps.ts        # nouveau : les 6 étapes (textes, cibles)
│   ├── search/RecherchePage.tsx        # bouton d'aide, démarrage auto, data-tour
│   └── catalogue/
│       ├── ItemSearch.tsx              # data-tour="search" (si la racine n'est pas déjà dans RecherchePage)
│       └── ItemDetail.tsx              # data-tour="item-detail"
├── persistence/
│   └── search-tour-preference.ts       # nouveau : lecture/écriture de la clé « vue »
└── styles/global.css                   # styles de la découpe et de la bulle

tests/
├── unit/search-tour-preference.test.ts
└── integration/search-onboarding.test.tsx
```

**Structure Decision** : SPA unique existante (`src/`, `tests/`). La visite vit dans un nouveau
dossier `src/features/onboarding/` pour rester réutilisable si d'autres pages en ont besoin plus
tard, sans rien généraliser d'avance.

## Points d'attention

- **Mode par défaut** : le code (`price-mode-preference.ts`) démarre en Mode personnel. L'étape 6
  affiche donc le mode actif plutôt que de supposer le Mode communautaire. L'hypothèse de la spec a
  été corrigée en ce sens.
- **Défilement** : la page doit défiler jusqu'à la cible avant de mesurer sa position ; la mesure se
  fait après `scrollIntoView`, puis à chaque `scroll`/`resize`.
- **Joueurs existants** : ils verront la visite une fois après le déploiement (hypothèse de la spec).
