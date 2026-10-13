# Implementation Plan: Nouveau style visuel pour tout le site

**Branch**: `051-site-visual-refresh` | **Date**: 2026-10-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/051-site-visual-refresh/spec.md`

## Summary

Remplacer les deux designs actuels (« Classique », « Moderne ») et les cinq accents par un seul
style, celui de la maquette validée : palette bleu-vert avec une couleur par rôle, polices Rowdies
et Lexend, navigation en barre flottante en haut sur écran large, thème clair décliné dans le même
esprit. Sur la page Recherche : 6 résultats, bloc verdict teinté, barres de répartition turquoise,
effets avec leur icône de caractéristique, disposition de la maquette (révision 2026-10-13).

Approche : les feuilles de style du site ne contiennent aucune couleur en dur (tout passe par les
jetons de `src/styles/theme.css`), donc l'essentiel du changement est une réécriture des jetons,
suivie de la restructuration de la navigation et de retouches ciblées des composants de la page
Recherche. Aucun calcul, aucune donnée ni aucun contrat de service n'est touché.

## Technical Context

**Language/Version**: TypeScript 5 (strict), CSS natif (propriétés personnalisées, `color-mix()`)

**Primary Dependencies**: React 19, react-router-dom 7, Vite ; ajout de `@fontsource-variable/lexend`
et `@fontsource/rowdies` (polices servies par le site), retrait de `@fontsource-variable/inter`

**Storage**: `localStorage` du navigateur — le thème reste mémorisé (`craftcheck-theme`) ; les clés
du design et de l'accent ne sont plus lues et sont effacées au démarrage

**Testing**: Vitest + Testing Library (unitaires et intégration), Playwright (bout en bout)

**Target Platform**: navigateurs récents, ordinateur et mobile ; site servi par Cloudflare Workers

**Project Type**: application web monopage (plus l'application d'administration, qui partage les
mêmes feuilles de style)

**Performance Goals**: pas de régression perceptible du premier affichage ; deux familles de polices
au lieu d'une, chargées avec `font-display: swap`

**Constraints**: contraste texte ≥ 4,5:1 et icônes/contours ≥ 3:1 dans les deux thèmes ; cibles
≥ 44 px ; pas de défilement horizontal de 320 à 1920 px ; aucune animation décorative sous
`prefers-reduced-motion` ; repli opaque quand `backdrop-filter` n'est pas disponible

**Scale/Scope**: 4 feuilles de style (~2 400 lignes), la coque `AppShell`, la page Paramètres, les
composants de la page Recherche (résultats, verdict, ressources, effets), 3 fichiers de tests à
retirer et quelques-uns à ajouter, `DESIGN.md` à réécrire

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principe | Verdict | Justification |
| --- | --- | --- |
| I. Données exactes et traçables | Conforme | Aucune donnée ni source modifiée. L'ancienneté des prix reste signalée (icône + texte), FR-006. |
| II. Exactitude avant optimisation | Conforme | Aucune règle de calcul touchée ; SC-005 impose que les tests de calcul passent sans modification. |
| III. Décisions explicables | Conforme | Montants comparés, ressources, hypothèses et mentions acheté/crafté restent affichés ; seule leur présentation change. |
| IV. Changements petits et cohérents | Conforme, avec vigilance | Le périmètre est large (tout le site) mais d'un seul objet : la présentation. Deux nouvelles dépendances (polices) répondent à un besoin démontré par la maquette ; une est retirée. Aucun refactoring hors sujet. |
| V. Données des utilisateurs | Conforme | Aucune nouvelle donnée collectée. Les polices sont servies par le site : aucune requête vers un tiers. Deux préférences locales devenues sans objet sont effacées. |

Workflow : spec écrite et validée avant le plan ; le plan identifie ci-dessous les contrats
visuels et la couverture de tests. Aucune violation à justifier.

**Re-check après conception (Phase 1)** : inchangé, conforme.

## Project Structure

### Documentation (this feature)

```text
specs/051-site-visual-refresh/
├── plan.md              # Ce fichier
├── research.md          # Décisions techniques
├── data-model.md        # Jetons de style et préférences locales
├── quickstart.md        # Parcours de validation
├── contracts/
│   └── ui-contract.md   # Rôles de couleur, navigation, page Recherche
└── tasks.md             # Créé par /speckit-tasks
```

### Source Code (repository root)

```text
index.html                                 # couleur de thème du navigateur
package.json                               # polices : +lexend, +rowdies, −inter
DESIGN.md                                  # règles visuelles réécrites
src/
├── main.tsx                               # imports de styles, retrait du design
├── app/AppShell.tsx                       # barre du haut, retrait design/accent
├── domain/
│   ├── designs.ts                         # supprimé
│   └── accent-colors.ts                   # supprimé
├── persistence/
│   ├── design-preference.ts               # supprimé
│   ├── accent-color-preference.ts         # supprimé
│   └── retired-style-preferences.ts       # nouveau : efface les deux clés devenues inutiles
├── components/
│   └── CharacteristicIcon.tsx             # (lu) source des identifiants de caractéristiques
├── features/
│   ├── settings/ParametresPage.tsx        # retrait des réglages Design et Accent
│   ├── catalogue/ItemResults.tsx          # 6 résultats, puis 12 de plus
│   ├── catalogue/ItemDetail.tsx           # en-tête d'objet et bloc Effets (icônes du jeu)
│   ├── comparison/                        # bloc verdict teinté, barres
│   └── search/                            # filtres, pastilles (déjà en place : couleurs seules)
└── styles/
    ├── theme.css                          # jetons réécrits, sombre et clair
    ├── global.css                         # navigation du haut, composants communs
    ├── comparison.css                     # verdict, barres
    └── design-modern.css                  # supprimé (ce qui sert est repris dans global.css)
admin/main.tsx                             # imports de styles alignés
tests/
├── unit/theme-contrast.test.ts            # nouveau : contrastes des jetons, deux thèmes
├── unit/design-preference.test.ts         # supprimé
├── unit/design-modern-css-scope.test.ts   # supprimé
├── integration/design-setting.test.tsx    # supprimé
├── integration/                           # nouveaux : barre de navigation, Paramètres, 6 résultats
└── e2e/                                   # parcours existants, à faire passer tels quels
```

**Structure Decision**: structure existante conservée (application unique sous `src/`, styles
centralisés sous `src/styles/`, tests sous `tests/`). Aucun nouveau dossier ; un seul nouveau module
de persistance, un fichier de test de contraste.

## Phasage de la réalisation

1. **Fondations** — polices, jetons sombres et clairs, retrait des designs et des accents, test de
   contraste. À ce stade tout le site a déjà les nouvelles couleurs (histoires 1, 4, 5).
2. **Navigation** — barre du haut sur écran large, navigation du bas inchangée (histoire 2).
3. **Page Recherche** — 6 résultats, verdict, ressources, effets (histoire 3).
4. **Revue page par page** — chaque page et chaque dialogue, deux thèmes, de 320 à 1920 px ;
   `DESIGN.md` ; validation du thème clair par l'utilisateur avant la fusion.

## Complexity Tracking

Aucune violation de la constitution à justifier.
