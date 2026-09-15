# Implementation Plan: Gestion multi-serveurs des prix

**Branch**: `002-server-scoped-prices` | **Date**: 2026-09-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-server-scoped-prices/spec.md`

## Summary

Ajouter la notion de serveur Dofus à l'application existante : sélection obligatoire à la
première visite, mémorisation et changement de serveur à tout moment, isolation par serveur des
prix de ressources et des prix de marché des items épinglés, tandis que la liste des items
épinglés elle-même reste commune à tous les serveurs. La fonctionnalité finalise et généralise le
scoping par serveur déjà amorcé côté persistance IndexedDB (actuellement non branché à
l'interface et cassant la compilation), sans modifier le catalogue, les recettes ni le calcul de
comparaison de la fonctionnalité 001.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 24 LTS (inchangé par rapport à la fonctionnalité
001)

**Primary Dependencies**: React 19, Vite, React Router, Vitest, React Testing Library,
Playwright — aucune nouvelle dépendance requise ; le serveur actif est porté par un contexte
React natif.

**Storage**: `localStorage` pour la préférence de serveur actif (même pattern que la préférence
de thème existante) ; IndexedDB pour les données scoped par serveur, via une fabrique de dépôt
partagée instanciée pour les prix de ressources (store existant `resource-prices-by-server`,
jusqu'ici non branché à l'interface) et pour les nouveaux prix de marché des items épinglés
(store `pinned-item-prices-by-server`) ; `localStorage` inchangé pour la liste des items épinglés
elle-même (commune à tous les serveurs).

**Testing**: Vitest pour la logique de sélection/persistance du serveur actif et les dépôts
scoped par serveur ; React Testing Library pour les interactions de changement de serveur et
d'affichage des prix ; Playwright pour le parcours de première visite bloquant et le parcours de
changement de serveur bout en bout.

**Target Platform**: Navigateurs modernes sur ordinateur et mobile, application web statique
(inchangé).

**Project Type**: Application web monopage côté client (inchangé).

**Performance Goals**: Le changement de serveur doit afficher les prix du nouveau serveur sans
délai perceptible (même budget que le recalcul immédiat de la fonctionnalité 001) ; aucune
interaction de saisie ne doit bloquer l'interface.

**Constraints**: Fonctionnement sans compte ; liste de serveurs fermée, maintenue dans le code, sans
saisie libre ; sélection de serveur bloquante tant qu'aucun choix n'a été fait lors de la
première visite ; aucune récupération automatique des anciens prix de marché d'items épinglés non
scopés (abandon avec avertissement) ; persistance limitée à l'origine et à l'appareil du
navigateur, comme pour la fonctionnalité 001.

**Scale/Scope**: Une liste fermée de l'ordre de la dizaine à quelques dizaines de serveurs
officiels ; un serveur actif par navigateur ; les prix de ressources et les prix de marché des
items épinglés deviennent scoped par serveur, la liste des items épinglés reste inchangée dans
son principe (commune).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Plan response |
|------|--------|---------------|
| Données de jeu exactes et traçables | PASS | La liste des serveurs est une donnée fermée et maintenue par le projet (pas de saisie libre) ; chaque prix scoped porte son serveur et sa date de mise à jour, comme pour les prix de ressources existants. |
| Calculs corrects et testables | PASS | Aucune nouvelle règle de calcul (la comparaison craft/achat de la fonctionnalité 001 est inchangée) ; les nouvelles règles testables portent sur l'isolation par serveur et la persistance, couvertes par des tests dédiés (voir quickstart.md). |
| Résultats explicables | PASS | Le serveur actif est affiché en permanence (FR-004) ; un champ de prix vide pour le serveur actif n'affiche jamais la valeur d'un autre serveur (FR-006, FR-010), rendant l'origine de chaque donnée explicite. |
| Changements cohésifs | PASS | Une seule nouvelle fabrique de dépôt IndexedDB partagée entre deux usages concrets et immédiats (prix de ressource, prix de marché d'item épinglé), justifiée par le besoin explicite d'extensibilité FR-013 plutôt que par anticipation ; aucune dépendance nouvelle. |
| Données utilisateur sûres | PASS (exception documentée) | L'abandon des anciens prix de marché non scopés (FR-016) déroge au Principe V ; l'exception est établie conformément à la Gouvernance avec rationale, **scope** (uniquement le prix de marché non scopé des items épinglés, aucune autre donnée) et **condition de levée** (dès qu'un mécanisme de confirmation avant suppression sera disponible dans l'application) — voir spec.md § Assumptions. |

**Post-design re-check**: PASS. Les artefacts de données (`data-model.md`) et le contrat
(`contracts/server-scoped-storage.md`) maintiennent l'isolation par serveur, l'affichage explicite
du serveur actif et n'introduisent aucune abstraction ou dépendance supplémentaire par rapport à
ce qui est justifié ci-dessus.

## Project Structure

### Documentation (this feature)

```text
specs/002-server-scoped-prices/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── server-scoped-storage.md
└── tasks.md                 # Created later by /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── App.tsx               # Monte ServerProvider puis, selon l'état, le sélecteur bloquant ou ComparisonPage
│   └── ServerContext.tsx     # Nouveau : contexte du serveur actif + hook useActiveServer
├── components/
├── features/
│   ├── catalogue/            # Inchangé (recherche, filtres, sélection d'objet)
│   ├── comparison/           # useResourcePrices branché sur le serveur actif du contexte
│   └── server/                # Nouveau
│       ├── ServerOnboarding.tsx   # Sélecteur bloquant de première visite
│       └── ServerSwitcher.tsx     # Sélecteur de changement de serveur + indicateur du serveur actif
├── domain/
│   ├── servers.ts             # Nouveau : liste fermée des serveurs officiels + type Server
│   └── types.ts                # Étendu : ServerId, PinnedItemPrice
├── data/                       # Inchangé (catalogue versionné)
├── persistence/
│   ├── server-preference.ts                      # Nouveau : lecture/écriture localStorage du serveur actif
│   ├── server-scoped-price-store.ts               # Nouveau : fabrique IndexedDB partagée
│   ├── indexeddb-resource-price-repository.ts     # Finalisé : instancié via la fabrique partagée
│   ├── indexeddb-pinned-item-price-repository.ts  # Nouveau : instancié via la fabrique partagée
│   └── pinned-items.ts                             # Simplifié : retrait du champ marketPrice
├── styles/
└── main.tsx

tests/
├── unit/            # servers.ts, server-preference.ts, dépôts scoped par serveur
├── integration/     # Changement de serveur, isolation des prix, migration des anciennes données
└── e2e/             # Parcours de première visite bloquant et changement de serveur bout en bout
```

**Structure Decision**: L'application reste un projet web client unique. Le nouveau module
`features/server/` regroupe l'UI de sélection/changement de serveur, `domain/servers.ts` porte la
liste fermée, et `persistence/server-scoped-price-store.ts` généralise l'accès IndexedDB déjà
amorcé pour `resource-prices-by-server` afin de le réutiliser pour les prix de marché des items
épinglés (`pinned-item-prices-by-server`), conformément à l'exigence d'extensibilité FR-013 sans
introduire de nouvelle dépendance externe.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|---------------------------------------|
| Fabrique de dépôt IndexedDB partagée (`server-scoped-price-store.ts`) plutôt qu'un dépôt dédié par type de donnée | FR-013 exige explicitement de pouvoir ajouter facilement une future donnée scoped par serveur ; deux usages concrets (prix de ressource, prix de marché d'item épinglé) existent dès cette fonctionnalité | Deux fichiers de dépôt dupliquant la même ouverture de base, transaction et gestion d'erreur IndexedDB : rejeté, duplication immédiate et contraire au principe de changements cohésifs. |
| Abandon sans confirmation préalable des anciens prix de marché d'items épinglés (FR-016) | Ces prix ne sont associés à aucun serveur et ne peuvent être attribués de façon fiable à un serveur particulier ; les fabriquer ou les deviner contredirait le principe de traçabilité des données. **Scope de l'exception** : uniquement le prix de marché non scopé des items épinglés (aucune autre donnée). **Condition de levée** : dès qu'un mécanisme de confirmation explicite avant suppression sera disponible dans l'application. | Une boîte de dialogue de confirmation avant suppression : rejetée par le choix explicite du produit lors de la clarification de la spécification (« abandonner avec avertissement »), documenté dans spec.md § Assumptions. |
