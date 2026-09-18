# Implementation Plan: Comptage anonyme des visites

**Branch**: `006-anonymous-visit-count` | **Date**: 2026-09-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-anonymous-visit-count/spec.md`

## Summary

Au chargement de l'application (`AppShell.tsx`, une seule fois par montage), un identifiant
d'appareil anonyme dédié (distinct de celui des contributions de prix communautaires) est envoyé à
une nouvelle route `POST /visit` sur le Worker Cloudflare déjà existant
(`worker/src/index.ts`, même base D1 que specs/004-community-price-sharing). Le Worker enregistre
une ligne `(device_id, day)` dans une nouvelle table `app_visits`, avec une clé primaire composite
qui déduplique naturellement par jour (`INSERT OR IGNORE`) — aucune logique de déduplication n'est
nécessaire côté client. Ce signal part indépendamment du mode de prix actif (Mode personnel ou
Mode communautaire), ce qui amende FR-015 de specs/004-community-price-sharing ; cet amendement est
répercuté dans le fichier de cette spec-là (voir Project Structure ci-dessous). Aucune nouvelle
infrastructure : même Worker, même base D1, même pattern d'appel `fetch` que
`community-price-api.ts`.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 24 LTS (frontend) + TypeScript sur runtime Cloudflare
Workers pour le backend (`worker/`). Identique à specs/004-community-price-sharing, non modifié.

**Primary Dependencies**: React 19, Vite, Vitest, React Testing Library ; `wrangler` et
`@cloudflare/workers-types` en dépendances de développement pour le Worker. Aucune nouvelle
dépendance : `crypto.randomUUID()` (déjà utilisé pour l'identifiant d'appareil des contributions de
prix, `community-device-id.ts`) est réutilisé pour ce second identifiant, et `Date` native suffit
pour calculer le jour courant (`YYYY-MM-DD`, fuseau du navigateur — voir research.md).

**Storage**: Nouvelle table D1 `app_visits` dans la base déjà existante
`dofus-craft-community-prices` (même base que `community_price_contributions`, pas de nouvelle
base). Nouvelle clé `localStorage`, `craftcheck-visit-device-id`, distincte de
`craftcheck-community-device-id` (FR-002).

**Testing**: Vitest + React Testing Library, même pattern que `community-device-id.test.ts`/
`community-price-api.test.ts` (mock de `fetch`/`localStorage`). Pas de test end-to-end dédié : ce
signal est un effet de bord invisible à l'écran, sans assertion utilisateur observable à couvrir en
e2e au-delà de « le chargement de la page ne casse rien », déjà couvert par les specs e2e
existantes qui chargent l'application.

**Target Platform**: Navigateurs modernes (identique aux fonctionnalités existantes) ; Worker
Cloudflare + D1 existant, redéployé pour cette fonctionnalité (nouvelle route, nouvelle table).

**Project Type**: Application web monopage côté client avec le même backend applicatif minimal
existant (Worker Cloudflare). Inchangé.

**Performance Goals**: Le signal de présence est un appel `fetch` en tâche de fond
(fire-and-forget) : il ne doit jamais retarder le rendu initial de l'application ni bloquer
l'interaction (FR-007/SC-005) — pas de cible chiffrée au-delà de cette exigence de non-blocage.

**Constraints**: Le signal ne doit jamais contenir de donnée de prix, de ressource, de serveur, ou
d'information identifiant personnellement le joueur (FR-004) ; il ne doit jamais être affiché dans
l'application ni exposé par une route publique (FR-006) ; un échec d'envoi doit rester silencieux,
sans erreur visible (FR-007).

**Scale/Scope**: Même échelle que specs/004-community-price-sharing (~10-20 joueurs) — au plus
quelques dizaines de lignes ajoutées à `app_visits` par jour, très loin des plafonds D1/Workers déjà
documentés comme non contraignants à cette échelle (research.md de la spec 004).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Plan response |
|------|--------|----------------|
| I. Données de jeu exactes et traçables | PASS | Sans objet : cette fonctionnalité ne touche à aucune donnée de jeu, de recette ou de prix. |
| II. Calculs corrects et testables | PASS | La seule « règle » (déduplication par jour) est déléguée à une contrainte de clé primaire SQL, testable simplement (deux envois le même jour → une seule ligne). |
| III. Résultats explicables | PASS | Sans objet côté joueur : aucune donnée n'est affichée dans l'application (FR-006) — rien à expliquer dans l'interface. |
| IV. Changements cohésifs | PASS | Réutilise le Worker et la base D1 déjà existants (aucune nouvelle infrastructure), le même pattern d'identifiant d'appareil que la révision 5 de specs/004 (nouveau module minimal, pas de nouvelle dépendance), un seul nouveau point d'appel (`AppShell.tsx`, montage). |
| V. Données utilisateur sûres | PASS | Signal strictement anonyme (FR-004), non exposé publiquement (FR-006), échec silencieux sans impact utilisateur (FR-007) ; amende FR-015 de specs/004 de façon délibérée et documentée (spec.md, FR-003), pas silencieusement. |

**Post-design re-check**: PASS. `data-model.md` et `contracts/visit-api.md` confirment qu'aucune
route existante n'est modifiée (seule une route `POST /visit` est ajoutée), qu'aucune donnée de prix
n'entre dans `app_visits`, et que la déduplication repose entièrement sur la base de données plutôt
que sur une logique applicative supplémentaire.

## Project Structure

### Documentation (this feature)

```text
specs/006-anonymous-visit-count/
├── plan.md                              # This file (/speckit-plan command output)
├── research.md                          # Phase 0 output (/speckit-plan command)
├── data-model.md                        # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── visit-api.md                     # Phase 1 output (/speckit-plan command)
└── tasks.md                             # Phase 2 output (/speckit-tasks command - NOT created here)
```

**Amendement d'une spec existante** : `specs/004-community-price-sharing/spec.md` (FR-015) est
révisée en même temps que cette fonctionnalité est implémentée, pour documenter l'exception admise
par FR-003 de cette spec — voir tasks.md.

### Source Code (repository root)

```text
worker/
├── migrations/
│   └── 0002_add_app_visits.sql          # Nouveau : CREATE TABLE IF NOT EXISTS app_visits (device_id, day, clé primaire composite)
├── schema.sql                            # app_visits ajoutée, pour toute base future créée depuis zéro
└── src/
    └── index.ts                          # Nouvelle route POST /visit (déduplication via INSERT OR IGNORE sur la clé primaire composite) ; routes /community-price inchangées

src/
├── persistence/
│   ├── community-device-id.ts            # Refactorisé : délègue à un nouvel helper générique partagé (device-id.ts), signature publique inchangée
│   ├── device-id.ts                      # Nouveau : createDeviceId(storageKey) — logique générique de lecture/génération/persistance extraite de community-device-id.ts, réutilisée par les deux identifiants
│   └── visit-device-id.ts                # Nouveau : getOrCreateVisitDeviceId() — même pattern que community-device-id.ts, clé localStorage distincte (craftcheck-visit-device-id)
├── services/
│   └── visit-api.ts                      # Nouveau : recordVisit() — POST /visit fire-and-forget, résout toujours sans jamais lever, même pattern d'échec silencieux que community-price-api.ts
└── app/
    └── AppShell.tsx                      # Nouveau useEffect au montage (tableau de dépendances vide) : appelle recordVisit(getOrCreateVisitDeviceId()) une seule fois par session

tests/
└── unit/
    ├── device-id.test.ts                 # Nouveau : couvre l'helper générique (génération, réutilisation, dégradation sans localStorage) — remplace la couverture équivalente déjà dans community-device-id.test.ts, qui devient un test fin de non-régression sur sa propre clé
    ├── visit-device-id.test.ts            # Nouveau : mêmes cas que community-device-id.test.ts, sur la clé craftcheck-visit-device-id
    └── visit-api.test.ts                 # Nouveau : POST /visit envoie { deviceId, day } (day au format YYYY-MM-DD) ; une erreur réseau ne lève jamais d'exception
```

**Structure Decision**: Réutilisation complète du Worker et de la base D1 existants (principe IV) —
une seule nouvelle route, une seule nouvelle table. Extraction d'un petit helper générique
(`device-id.ts`) pour éviter de dupliquer la logique try/catch-autour-de-localStorage entre les deux
identifiants d'appareil (celui des contributions de prix, révision 5 de specs/004, et celui de cette
fonctionnalité) — la seule abstraction nouvelle introduite par ce plan, justifiée par un doublon réel
et immédiat (deux appelants dès ce plan), pas anticipée pour un besoin futur.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

Aucune violation à justifier. Le solde net est un module générique partagé (device-id.ts), une
route, une table, zéro nouvelle dépendance, zéro nouvelle infrastructure.
