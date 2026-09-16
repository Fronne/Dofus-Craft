# Implementation Plan: Partage communautaire des prix

**Branch**: `004-community-price-sharing` | **Date**: 2026-09-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-community-price-sharing/spec.md`

## Summary

Construire l'infrastructure de partage communautaire des prix explicitement différée par
003-community-price-mode : un joueur en mode communautaire doit pouvoir consulter un vrai prix
communautaire (médiane des contributions récentes) pour une ressource sur son serveur actif, et
contribuer son propre prix après un consentement explicite et distinct du mode lui-même. Approche
technique : un Worker Cloudflare (trois routes HTTP) devant une base Cloudflare D1 (SQLite managé)
comme infrastructure serveur — choisi (voir research.md) pour son palier gratuit qui ne peut jamais
basculer vers une facturation sans action explicite de l'utilisateur, contrairement à l'option
Supabase initialement envisagée. Le Worker calcule lui-même la médiane et applique le filtrage des
valeurs aberrantes (D1/SQLite n'a pas d'équivalent natif à `percentile_cont`). Le client parle à ce
Worker via `fetch` natif, au même pattern que `services/dofusdb-api.ts` existant.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 24 LTS (frontend inchangé, 001/002/003) + TypeScript
sur runtime Cloudflare Workers pour le nouveau backend (`worker/`, tsconfig et typage
`@cloudflare/workers-types` séparés du frontend).

**Primary Dependencies**: React 19, Vite, Vitest, React Testing Library, Playwright (inchangé côté
frontend, aucune nouvelle dépendance npm de production — voir research.md, choix de `fetch` natif
sans framework serveur). Nouvelle dépendance de développement : `wrangler` (CLI officielle
Cloudflare, build/déploiement/local dev du Worker et de la base D1) et `@cloudflare/workers-types`
(typage du runtime Workers) — justifiées par l'introduction du premier vrai backend du projet.

**Storage**: Nouvelle table D1 (SQLite) `community_price_contributions` (voir data-model.md et
`worker/schema.sql`) ; aucune vue SQL équivalente à l'ancienne conception Postgres, la médiane est
calculée en JavaScript par le Worker (`worker/src/median.ts`). Côté client : deux nouvelles clés
`localStorage` (`craftcheck-community-consent` pour `ShareConsent`, gérée par
`community-consent-preference.ts` au pattern de `price-mode-preference.ts` ;
`craftcheck-community-contributions` pour la liste `LocalContributionRecord`, gérée par
`community-contributions.ts` au pattern de `pinned-items.ts`) et un cache de session
(`sessionStorage`) pour le dernier prix communautaire connu en cas d'indisponibilité. Aucune
modification du schéma existant (`ResourcePrice`, `PinnedItemPrice`, `PriceModePreference` —
001/002/003).

**Testing**: Vitest + React Testing Library pour le service client (`community-price-api.ts`,
`fetch` mocké via `vi.stubGlobal`, même pattern que `dofusdb-api.test.ts`), les nouvelles
préférences de persistance, l'interrupteur de consentement, l'affichage du prix communautaire et
ses états (disponible / pas encore de données / indisponible), et la non-transmission de prix hors
consentement. Vitest également pour la logique pure d'agrégation du Worker
(`worker/src/median.ts`, testée directement sans runtime Workers). Playwright pour les parcours
complets (US1 à US5) avec le Worker simulé par interception réseau. Le déploiement réel du Worker
et de la base D1 est vérifié manuellement (voir quickstart.md), pas par un environnement Workers
complet en CI (décision actée en research.md).

**Target Platform**: Navigateurs modernes sur ordinateur et mobile, application web statique
(inchangé) ; nouveau Worker Cloudflare + base D1 comme composant serveur.

**Project Type**: Application web monopage côté client, complétée pour la première fois par un
backend applicatif minimal (un Worker Cloudflare, pas un serveur à héberger soi-même). Le code du
Worker vit dans `worker/` à la racine du dépôt, avec son propre `tsconfig.json` (runtime Workers,
pas de DOM) pour ne pas polluer le typage du frontend.

**Performance Goals**: Consultation d'un prix communautaire perçue comme instantanée dans l'usage
courant (pas de cible chiffrée stricte, cohérent avec l'échelle réelle — voir Scale/Scope) ; le
calcul de rentabilité (001) ne doit subir aucune dégradation, la lecture du prix communautaire
étant strictement parallèle et non bloquante pour lui.

**Constraints**: Aucun prix personnel n'est transmis sans `ShareConsent.given === true` (FR-004) ;
aucune contribution ni aucun prix communautaire ne contient d'information identifiant un joueur,
un appareil ou une IP (FR-007) ; le prix personnel prévaut toujours à l'affichage et dans les
calculs (FR-008) ; le mode personnel reste inchangé et sans appel réseau lié aux prix (héritage de
003, FR-014) ; le backend choisi ne doit jamais pouvoir facturer sans action explicite de
l'utilisateur (contrainte exprimée par l'utilisateur, motivant le choix Cloudflare D1 — voir
research.md).

**Scale/Scope**: Public restreint (~10-20 joueurs, cf. spec.md/Assumptions) ; dizaines de
contributions et de lectures attendues, très loin des plafonds gratuits de Cloudflare D1/Workers —
ce qui justifie directement les choix de research.md (pas de mise à jour incrémentale en base, pas
de cache persistant, pas d'environnement Workers complet en CI).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Plan response |
|------|--------|----------------|
| I. Données de jeu exactes et traçables | PASS | Aucune donnée de jeu (items/recettes) n'est modifiée. Un prix communautaire absent est explicitement signalé comme tel (FR-002) plutôt que fabriqué ; `sampleSize` (data-model.md) permet de ne jamais présenter une médiane à une seule contribution comme une valeur de marché établie. |
| II. Calculs corrects et testables | PASS | La médiane et le filtrage des valeurs aberrantes sont une fonction pure explicite et testée (`worker/src/median.ts`, `tests/unit/community-price-median.test.ts`), reproduisant exactement la formule d'interpolation linéaire déjà spécifiée. Le calcul de rentabilité existant (001) n'est pas modifié : il continue d'utiliser exclusivement le prix personnel (FR-008). |
| III. Résultats explicables | PASS | Le prix communautaire est toujours affiché séparément du prix personnel, jamais fusionné (FR-008) ; son absence, son caractère daté (mode dégradé, US5) et le nombre de contributions retenues restent visibles plutôt qu'implicites. |
| IV. Changements cohésifs | PASS | Réutilisation stricte des patterns déjà établis côté client (service `fetch` façon `dofusdb-api.ts`, préférences `localStorage` façon `price-mode-preference.ts`/`pinned-items.ts`) ; le Worker lui-même est minimal (trois routes, zéro dépendance de framework) ; chaque écart par rapport à une solution plus complexe (SDK, cache persistant, CI Workers complète, déclencheur de mise à jour incrémentale) est documenté et justifié dans research.md plutôt qu'ajouté par anticipation. |
| V. Données utilisateur sûres | PASS | Aucun prix personnel n'est transmis sans consentement explicite et distinct (FR-004) ; aucune donnée technique identifiant un joueur n'est collectée ni conservée (FR-007, contrainte de schéma — aucune route du Worker n'expose une contribution individuelle) ; le retrait du consentement (User Story 4) offre un chemin de « récupération »/contrôle clair sur les contributions déjà envoyées, conformément à l'exigence de confirmation/réversibilité pour les actions affectant les données du joueur. |

**Post-design re-check**: PASS. Les artefacts de conception (`data-model.md`,
`contracts/community-price-api.md`, `contracts/share-consent.md`) confirment qu'aucune entité
existante (001/002/003) n'est modifiée, que l'anonymat est appliqué structurellement (aucune route
Worker ne lit une contribution individuelle) et non par simple convention applicative, et qu'aucune
dépendance ni abstraction non justifiée par un besoin actuel n'a été introduite.

## Project Structure

### Documentation (this feature)

```text
specs/004-community-price-sharing/
├── plan.md                              # This file (/speckit-plan command output)
├── research.md                          # Phase 0 output (/speckit-plan command)
├── data-model.md                        # Phase 1 output (/speckit-plan command)
├── quickstart.md                        # Phase 1 output (/speckit-plan command)
├── contracts/
│   ├── community-price-api.md           # Phase 1 output (/speckit-plan command)
│   └── share-consent.md                 # Phase 1 output (/speckit-plan command)
└── tasks.md                             # Phase 2 output (/speckit-tasks command - NOT created here)
```

### Source Code (repository root)

```text
worker/
├── wrangler.toml                         # Nouveau : configuration Cloudflare (binding D1, nom du Worker)
├── tsconfig.json                         # Nouveau : typage runtime Workers, isolé du frontend
├── schema.sql                            # Nouveau : table D1 (SQLite), sans RLS — data-model.md
└── src/
    ├── index.ts                          # Nouveau : les trois routes HTTP (GET/POST /community-price, DELETE /community-price/:id)
    └── median.ts                         # Nouveau : fonction pure de calcul de médiane + filtrage IQR (FR-010/FR-011)

src/
├── app/
│   └── AppShell.tsx                      # Étendu : nouvel état `shareConsent`/`setShareConsent` (useState + persistence), au même pattern que `priceMode` déjà présent ; passé en props à ParametresPage et RecherchePage
├── domain/
│   └── types.ts                          # Étendu : types CommunityPrice, ShareConsent
├── services/
│   └── community-price-api.ts            # Nouveau : appels fetch vers le Worker (contracts/community-price-api.md), même pattern que dofusdb-api.ts
├── persistence/
│   ├── community-consent-preference.ts   # Nouveau : lecture/écriture localStorage du consentement (contracts/share-consent.md)
│   └── community-contributions.ts        # Nouveau : liste locale des contributions envoyées (LocalContributionRecord, data-model.md)
├── features/
│   ├── comparison/
│   │   └── CommunityPriceDisplay.tsx     # Nouveau : affichage du prix communautaire + états (disponible/absent/indisponible), séparé du prix personnel (FR-008)
│   ├── search/
│   │   └── RecherchePage.tsx             # Étendu : intègre CommunityPriceDisplay à côté du prix personnel d'une ressource (US1, US3)
│   └── settings/
│       └── ParametresPage.tsx            # Étendu : nouvelle section « Partage communautaire » (interrupteur de consentement + retrait rétroactif), au même pattern inline que les sections Thème/Accent/Mode déjà présentes — pas de nouveau composant séparé (User Story 2, 4)
└── main.tsx

tests/
├── unit/            # community-price-api, community-consent-preference, community-contributions, community-price-median (worker)
├── integration/     # affichage du prix communautaire et ses états, interrupteur de consentement, non-transmission hors consentement, priorité du prix personnel
└── e2e/             # parcours complets US1-US5 avec le Worker simulé par interception réseau
```

**Structure Decision**: Le frontend reste un projet unique, mais cette fonctionnalité introduit un
second projet TypeScript autonome (`worker/`), avec son propre `tsconfig.json` (runtime Workers,
pas de DOM) pour éviter tout conflit de typage avec le frontend ; il n'est inclus ni dans
`tsconfig.app.json` ni dans le build Vite. `services/community-price-api.ts` suit exactement le
rôle et le pattern de `dofusdb-api.ts` côté client (adaptateur derrière une frontière documentée,
principe constitutionnel « Project Constraints » : source externe isolée derrière un adaptateur).
Les nouvelles préférences suivent le pattern déjà établi par `price-mode-preference.ts` et
`pinned-items.ts`, sans nouveau contexte React.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

Aucune violation à justifier : chaque écart par rapport à une solution plus complexe (framework
côté Worker, cache persistant IndexedDB, environnement Workers complet en CI, mise à jour
incrémentale en base, mécanisme de modération plus élaboré qu'un filtrage statistique) est
documenté avec sa justification et son alternative rejetée dans [research.md](./research.md),
conformément au principe IV. L'introduction du Worker lui-même (code serveur, alors que le projet
était jusqu'ici 100 % client) est justifiée par une contrainte explicite de l'utilisateur (aucun
risque de facturation) documentée dans research.md, pas ajoutée par anticipation.
