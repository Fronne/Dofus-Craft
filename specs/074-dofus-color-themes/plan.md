# Implementation Plan: Thèmes de couleurs des Dofus primordiaux

**Branch**: `074-dofus-color-themes` | **Date**: 2026-10-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/074-dofus-color-themes/spec.md`

## Summary

Ajouter un second axe de personnalisation, le Dofus primordial, qui se combine avec le mode
clair/sombre existant. Chaque Dofus redéfinit les jetons de couleur de `src/styles/theme.css`
(accent, fond, lueurs, bordures) via un attribut `data-dofus` sur `<html>`, comme `data-theme`
le fait déjà pour clair/sombre. L'émeraude reste le thème par défaut : aucun attribut, rendu
inchangé. La page Paramètres gagne une section de six boutons-images ; l'icône de la barre de
navigation et l'icône d'onglet suivent le Dofus choisi. Le choix est stocké dans `localStorage` et
appliqué par un petit script dans `index.html` avant le premier affichage, pour éviter tout flash.
Les six images sont celles de DofusDB, copiées dans `public/` comme l'est déjà celle de l'émeraude.

## Technical Context

**Language/Version**: TypeScript, React (Vite), CSS à jetons

**Primary Dependencies**: aucune nouvelle

**Storage**: `localStorage` du navigateur (clé `craftcheck-dofus`), comme `craftcheck-theme`

**Testing**: Vitest (unit, integration avec Testing Library), Playwright (e2e)

**Target Platform**: navigateurs récents, bureau et mobile

**Project Type**: application web monopage (front React + Worker Cloudflare, ce dernier non concerné)

**Performance Goals**: changement de thème perceptible en moins d'une seconde, sans rechargement

**Constraints**: aucun flash de l'ancien thème au chargement ; contrastes WCAG AA (4,5:1 texte, 3:1 formes) pour 12 combinaisons ; rendu émeraude identique à l'actuel ; pas de valeur de couleur écrite en dur hors `theme.css` (DESIGN.md §1)

**Scale/Scope**: 6 thèmes × 2 modes ; 1 section de Paramètres ; 1 icône de navigation ; 1 icône d'onglet

## Constitution Check

*GATE: passe avant la recherche, revérifié après la conception.*

| Principe | Verdict |
| --- | --- |
| I. Données de jeu traçables | OK. Les images sont celles de DofusDB (ids en [data-model.md](data-model.md)) ; aucune donnée de craft touchée. |
| II. Exactitude avant optimisation | OK. Aucun calcul de craft modifié. Les règles propres à la fonctionnalité (repli sur émeraude, contrastes) sont testées. |
| III. Décisions explicables | OK. Aucun impact : les couleurs de verdict (kamas, avertissement, erreur) gardent leur sens (FR-010). |
| IV. Changements petits et cohérents | OK. Pas de dépendance, pas de refonte : on étend le mécanisme `data-theme` existant. |
| V. Données utilisateur | OK. Une seule préférence locale, sans compte ni envoi réseau. Rien de destructif. |

Après conception : toujours OK, aucune exception à justifier.

## Project Structure

### Documentation (this feature)

```text
specs/074-dofus-color-themes/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── ui-contract.md
└── tasks.md             # créé par /speckit-tasks
```

### Source Code (repository root)

```text
index.html                          # script d'amorçage (data-dofus avant affichage), icône d'onglet
public/
├── dofus-emeraude.png              # existe déjà
├── dofus-pourpre.png               # existe déjà (vérifier qu'elle vient de DofusDB)
└── dofus-{turquoise,ocre,ebene,ivoire}.png   # à ajouter
src/
├── domain/dofus-themes.ts          # liste des six Dofus, lecture/validation du choix mémorisé
├── app/
│   ├── AppShell.tsx                # état dofus, data-dofus, icône de navigation et d'onglet
│   └── useDofusTheme.ts            # état + mémorisation (extrait pour rester petit)
├── features/settings/
│   ├── ParametresPage.tsx          # section « Dofus »
│   └── DofusPicker.tsx             # six boutons-images
└── styles/
    ├── theme.css                   # 5 blocs de palette sombre + 5 clairs
    └── global.css                  # styles de la section (jetons seulement)
tests/
├── unit/dofus-themes.test.ts       # liste, repli, validation
├── unit/theme-contrast.test.ts     # étendu aux 12 combinaisons
├── integration/settings-dofus.test.tsx
└── e2e/dofus-theme.spec.ts         # choix, rechargement, pas de flash
DESIGN.md                           # §2 Couleurs : nouveau paragraphe « Thèmes de Dofus »
```

**Structure Decision**: projet web unique existant. On ajoute un module de domaine (liste et
validation, sans React), un hook d'état, un composant de sélection et des blocs CSS ; rien d'autre
ne bouge.

## Complexity Tracking

Aucune violation de la constitution.
