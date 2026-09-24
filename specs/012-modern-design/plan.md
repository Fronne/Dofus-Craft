# Plan d'implémentation : nouveau design « Moderne épuré » au choix

**Branch**: `012-modern-design` | **Date**: 2026-09-24 | **Spec**: [spec.md](spec.md)

**Input**: Spécification de `specs/012-modern-design/spec.md`

## Résumé

Ajouter un réglage « Design : Classique / Nouveau » dans Paramètres. « Nouveau » pose
`data-design="modern"` sur `<html>` et active une feuille de style dédiée dont toutes les règles
sont préfixées par cet attribut : le « Classique » reste strictement identique, et le design non
retenu se supprimera en retirant un fichier. Le nouveau design redéfinit surtout les variables CSS
existantes (rayons, ombres, espacements, fonds), ajoute une police Inter embarquée et quelques
animations discrètes (voir [research.md](research.md)).

## Contexte technique

**Language/Version** : TypeScript 5.7, React 19, CSS

**Primary Dependencies** : ajout de `@fontsource-variable/inter` (police embarquée, voir research §3)

**Storage** : `localStorage` (`craftcheck-design`) ; rien côté serveur

**Testing** : Vitest + Testing Library ; Playwright (non-régression des parcours) ; captures
manuelles pour le rendu

**Target Platform** : navigateurs récents, bureau et mobile

**Project Type** : application web (SPA), front uniquement

**Performance Goals** : bascule de design instantanée ; police chargée seulement en « Nouveau »

**Constraints** : « Classique » inchangé au pixel près ; clair/sombre × 5 accents ; 375 px sans
défilement horizontal ; animations coupées si réduction des animations demandée

**Scale/Scope** : toute l'application (6 écrans), une feuille de style d'environ 300 lignes

## Constitution Check

| Principe | Évaluation |
|----------|-----------|
| I. Données de jeu traçables | Non concerné. Les éléments reproduisant le jeu gardent les couleurs du jeu (FR-011). |
| II. Exactitude avant optimisation | Aucun calcul modifié. Les parcours sont revérifiés par les tests existants dans les deux designs. |
| III. Décisions explicables | Non concerné : aucun libellé ni information retiré (FR-007). |
| IV. Changements petits et cohérents | Une feuille isolée, une préférence, une section de Paramètres. Une dépendance ajoutée (police), justifiée en research §3 ; retirable avec le design si non retenu. |
| V. Données utilisateur | Préférence locale uniquement. Police servie par l'app, sans appel à un tiers. |

**Résultat** : conforme, avant et après la phase 1.

## Project Structure

### Documentation (this feature)

```text
specs/012-modern-design/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── design-setting-ui.md
├── checklists/
│   └── requirements.md
└── tasks.md             # créé par /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── domain/designs.ts                      # nouveau : liste des designs
├── persistence/design-preference.ts       # nouveau : lecture/écriture de craftcheck-design
├── main.tsx                               # pose data-design avant le premier rendu
├── app/AppShell.tsx                       # état du design, mise à jour de l'attribut
├── features/settings/ParametresPage.tsx   # section « Design »
└── styles/design-modern.css               # nouveau : tout le design « Nouveau »

tests/
├── unit/design-preference.test.ts
├── unit/design-modern-css-scope.test.ts   # invariant : toutes les règles sont préfixées
└── integration/design-setting.test.tsx
```

**Structure Decision** : SPA existante. Le design vit entièrement dans `design-modern.css` pour
être retiré ou généralisé d'un seul geste.

## Points d'attention

- Le préfixe `:root[data-design="modern"]` doit aussi précéder les sélecteurs combinés au thème et
  à l'accent (`:root[data-design="modern"][data-theme="light"]`).
- `data-design` est posé en même temps que `data-theme` et `data-accent`, sans modifier leur
  logique.
