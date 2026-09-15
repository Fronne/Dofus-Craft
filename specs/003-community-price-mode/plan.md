# Implementation Plan: Modes personnel et communautaire de gestion des prix

**Branch**: `003-community-price-mode` | **Date**: 2026-09-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-community-price-mode/spec.md`

## Summary

Ajouter dans les paramètres un choix explicite de mode de gestion des prix — « mode personnel »
(comportement actuel, inchangé) et « mode communautaire » — avec une explication claire de chaque
mode et un indicateur permanent du mode actif. Le changement de mode ne doit jamais toucher aux
prix personnels déjà enregistrés (001/002, inchangés). Conformément à la décision de cadrage
actée dans spec.md, l'infrastructure de partage communautaire (stockage partagé, identification
anonyme des contributeurs, agrégation par médiane) est explicitement différée à une itération
future : cette itération livre uniquement la préférence de mode, ses garanties de confidentialité
et de non-perte de données, et un message explicite indiquant que la consultation/contribution
communautaire est à venir lorsque ce mode est sélectionné.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 24 LTS (inchangé par rapport aux fonctionnalités
001 et 002).

**Primary Dependencies**: React 19, Vite, Vitest, React Testing Library, Playwright — aucune
nouvelle dépendance requise. La préférence de mode est portée par un état local de
`ComparisonPage`, sur le même modèle que le thème clair/sombre et la couleur d'accent déjà
implémentés (pas de nouveau contexte React : rien dans cette itération n'a besoin de lire le mode
en profondeur dans l'arbre de composants, contrairement au serveur actif qui alimente plusieurs
hooks de données distincts).

**Storage**: `localStorage`, nouvelle clé dédiée (`craftcheck-price-mode`), lue de façon
synchrone à l'initialisation, au même pattern que la préférence de thème
(`craftcheck-theme`) et la préférence de couleur d'accent (`craftcheck-accent-color`). Aucune
donnée IndexedDB nouvelle : les prix personnels restent gérés exactement comme dans 001/002, sans
modification de leur schéma ni de leur dépôt.

**Testing**: Vitest pour le module de persistance de la préférence de mode ; React Testing
Library pour le sélecteur de mode, l'indicateur de mode actif, le message « à venir » en mode
communautaire, et la non-altération des prix personnels lors des changements de mode ; Playwright
pour le parcours bout en bout (choix du mode, rechargement, retour au mode personnel avec prix
personnels intacts) et pour vérifier l'absence de toute requête réseau sortante liée aux prix
lorsque le mode communautaire est actif.

**Target Platform**: Navigateurs modernes sur ordinateur et mobile, application web statique
(inchangé).

**Project Type**: Application web monopage côté client (inchangé).

**Performance Goals**: Le changement de mode doit être instantané (mise à jour de préférence
locale uniquement, aucun appel réseau) ; aucune dégradation du temps de calcul de comparaison
existant.

**Constraints**: Aucune infrastructure serveur/backend n'est introduite par cette itération
(décision de cadrage, spec.md) ; le mode communautaire ne doit produire aucune requête réseau liée
aux prix ; le mode par défaut est le mode personnel ; aucune donnée personnelle existante (001/002)
n'est migrée, renommée ou restructurée par cette fonctionnalité.

**Scale/Scope**: Une préférence binaire par navigateur/appareil (personnel/communautaire),
indépendante du serveur actif et des autres préférences (thème, accent) ; aucune nouvelle entité
de données persistée au-delà de cette préférence.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Plan response |
|------|--------|----------------|
| Données de jeu exactes et traçables | PASS | Aucune nouvelle donnée de jeu. Le message « à venir » du mode communautaire décrit un état réel (aucune infrastructure communautaire construite) plutôt que de fabriquer ou laisser croire à des prix communautaires inexistants (FR-011). |
| Calculs corrects et testables | PASS | Aucune nouvelle règle de calcul : le calcul de comparaison (001) reste inchangé et continue d'utiliser exclusivement les prix personnels, quel que soit le mode (FR-009, FR-012), couvert par des tests dédiés (voir quickstart.md). |
| Résultats explicables | PASS | Le mode actif est affiché en permanence dans les paramètres (FR-002) avec une explication de ce qu'il implique (FR-003) ; le mode communautaire affiche explicitement son état « à venir » plutôt qu'un comportement silencieux ou ambigu (FR-011). |
| Changements cohésifs | PASS | Réutilisation stricte du pattern déjà établi (état local + `localStorage`, comme le thème et l'accent) sans nouveau contexte React, nouvelle dépendance, ni abstraction anticipant l'infrastructure communautaire différée (principe IV). |
| Données utilisateur sûres | PASS | Aucune donnée personnelle n'est envoyée, publiée ni exposée à un tiers dans cette itération, dans aucun des deux modes (FR-010) ; aucune migration destructrice n'est introduite (contrairement à 002/FR-016, cette fonctionnalité ne touche à aucune donnée existante). |

**Post-design re-check**: PASS. Les artefacts de conception (`data-model.md`,
`contracts/price-mode-preference.md`) confirment qu'aucune donnée personnelle existante n'est
modifiée, qu'aucune transmission réseau n'est introduite, et qu'aucune abstraction ou dépendance
supplémentaire n'est ajoutée au-delà du pattern de préférence locale déjà utilisé par le thème et
l'accent.

## Project Structure

### Documentation (this feature)

```text
specs/003-community-price-mode/
├── plan.md                          # This file (/speckit-plan command output)
├── research.md                      # Phase 0 output (/speckit-plan command)
├── data-model.md                    # Phase 1 output (/speckit-plan command)
├── quickstart.md                    # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── price-mode-preference.md     # Phase 1 output (/speckit-plan command)
└── tasks.md                         # Phase 2 output (/speckit-tasks command - NOT created here)
```

### Source Code (repository root)

```text
src/
├── app/
│   └── ServerContext.tsx            # Inchangé
├── domain/
│   └── price-modes.ts               # Nouveau : type PriceMode + libellés/descriptions des deux modes
├── features/
│   └── comparison/
│       ├── ComparisonPage.tsx       # Étendu : état de préférence de mode + rendu du sélecteur et du message « à venir »
│       └── PriceModeNotice.tsx      # Nouveau : bandeau affiché en mode communautaire (FR-011)
├── persistence/
│   └── price-mode-preference.ts     # Nouveau : lecture/écriture localStorage de la préférence de mode
├── styles/
│   └── global.css                   # Étendu : styles du sélecteur de mode et du bandeau « à venir »
└── main.tsx

tests/
├── unit/            # price-mode-preference.ts
├── integration/     # sélecteur de mode, non-altération des prix personnels au changement de mode, bandeau « à venir »
└── e2e/             # parcours complet mode personnel → communautaire → personnel avec vérification réseau
```

**Structure Decision**: L'application reste un projet web client unique. Le nouveau module
`domain/price-modes.ts` porte les deux modes et leurs descriptions (même rôle que
`domain/accent-colors.ts`), `persistence/price-mode-preference.ts` suit exactement le pattern déjà
établi par `persistence/accent-color-preference.ts` et `persistence/server-preference.ts`, et
l'interface est ajoutée à `ComparisonPage.tsx` aux côtés des sélecteurs de thème et d'accent déjà
présents dans les paramètres, sans nouveau contexte React ni nouvelle dépendance.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

Aucune violation à justifier : cette fonctionnalité réutilise des patterns déjà établis dans le
projet (préférence locale via `localStorage`, composant de notification déjà utilisé pour
002-server-scoped-prices) et n'introduit aucune abstraction, dépendance ou exception nouvelle.
