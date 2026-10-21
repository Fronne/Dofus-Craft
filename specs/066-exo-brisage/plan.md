# Plan d'implémentation : Exos sur les lignes de l'objet, page Brisage

**Branche**: `066-exo-brisage` | **Date**: 2026-10-21 | **Spec**: [spec.md](spec.md)

**Entrée**: spécification `specs/066-exo-brisage/spec.md`

## Résumé

Ajouter à la page Brisage des **lignes exo** (stat absente de l'objet) qui entrent dans tous les calculs comme des lignes séparées, jamais comme cible de focus, plafonnées à un poids de 101. Les stats déjà présentes sur l'objet se règlent en **over** : le jet saisi peut dépasser le maximum de la ligne, avec le même plafond de poids.

Approche : le domaine (`src/domain/brisage.ts`) reçoit un drapeau `exo` sur `BrisageLine` et une fonction de plafond ; l'analyse n'engendre plus d'option de focus pour une ligne exo, mais l'exo compte toujours (coefficient en normal, part « autres lignes » en focus). L'interface ajoute un petit composant d'ajout d'exo et des lignes exo dans le tableau. Les exos sont conservés par objet dans un module de persistance dédié.

## Contexte technique

**Langage/Version** : TypeScript (React 18, Vite), tests Vitest

**Dépendances principales** : aucune nouvelle

**Stockage** : `localStorage`, nouvelle clé `craftcheck-brisage-exos` (exos par serveur et par objet) ; la clé de session existante ne change pas

**Tests** : `npm run test` (Vitest, `tests/unit`, `tests/integration`), `npm run lint`, `npm run build`

**Plateforme cible** : navigateur ordinateur et téléphone

**Type de projet** : application web monopage (front seul)

**Objectifs de performance** : recalcul instantané à chaque ajout d'exo (calcul pur en mémoire)

**Contraintes** : aucun résultat existant ne change pour un objet sans exo (SC-005) ; aucune valeur inventée quand un prix manque ; page utilisable à 390 px

**Échelle/Périmètre** : 1 page modifiée, 1 composant ajouté, 1 module de domaine étendu, 1 module de persistance ajouté

## Vérification de la constitution

| Principe | Verdict |
|---|---|
| I. Données traçables | OK : la règle de l'exo vient de DoFocus (`docs/dofocus-brisage.md`), tracée dans `research.md` et signalée comme estimation à l'écran. |
| II. Correction avant optimisation | OK : règles dans `src/domain/brisage.ts`, tests unitaires (normal, bornes, entrées invalides). |
| III. Décisions explicables | OK : ligne exo repérée « exo », jet en over repéré, message avec le jet maximal. |
| IV. Changements petits et cohérents | OK : aucune dépendance, aucune refonte ; réutilise tableau, formule et prix de runes. |
| V. Données utilisateur | OK : données locales, retrait d'un exo en un clic récupérable en le rajoutant. |

**Revérification après conception** : mêmes verdicts.

## Structure du projet

### Documentation (cette fonctionnalité)

```text
specs/066-exo-brisage/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── page-brisage-exo.md
└── tasks.md             # créé par /speckit-tasks
```

### Code source (racine du dépôt)

```text
src/
├── domain/brisage.ts                 # + exo sur BrisageLine, MAX_LINE_WEIGHT, maxValueForWeight, focus ignoré pour un exo
├── persistence/brisage-exos.ts       # NOUVEAU : exos par serveur + objet
├── features/brisage/
│   ├── BrisagePage.tsx               # lignes exo dans le tableau, over validé, intégration persistance
│   └── ExoAdder.tsx                  # NOUVEAU : choix de stat + valeur + message de plafond
└── styles/global.css                 # style de la ligne exo et du formulaire d'ajout

tests/
├── unit/brisage-exo.test.ts          # NOUVEAU : calcul, plafond, focus
├── unit/brisage-exos-persistence.test.ts  # NOUVEAU
└── integration/brisage-page.test.tsx # + parcours exo et over
```

**Décision de structure** : projet web unique, dossiers existants conservés. Toute règle (plafond, exclusion du focus, part en focus) vit dans `src/domain/brisage.ts` pour être testée sans interface.

## Suivi de la complexité

Aucune violation.
