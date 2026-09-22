# Implementation Plan: Affichage instantané du cache local sur la page Recherche

**Branch**: `010-search-instant-cache` | **Date**: 2026-09-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-search-instant-cache/spec.md`

## Summary

Au chargement de la page Recherche, afficher immédiatement les données déjà connues localement
(objets/recette DofusDB, prix perso, prix communautaire) pendant qu'un rafraîchissement réseau se
fait en arrière-plan, et ne mettre à jour l'affichage que si le contenu a changé — sans jamais
laisser une réponse obsolète écraser une donnée plus fraîche. Approche : un hook générique unique
`useStaleWhileRevalidate` (lecture cache locale immédiate + revalidation réseau + garde anti-race
par génération de requête), réutilisé par le catalogue DofusDB (nouvelle persistance IndexedDB,
absente aujourd'hui) et par les prix (déjà en IndexedDB, mais affichage non garanti "immédiat"). Un
indicateur discret partagé communique l'état de fraîcheur (revalidation en cours / hors ligne /
dernière synchro).

## Technical Context

**Language/Version**: TypeScript 5 / React 19 (Vite)

**Primary Dependencies**: React 19, react-router-dom — aucune nouvelle dépendance de production ;
`fake-indexeddb` (déjà en devDependency, déjà activé globalement dans `src/test/setup.ts`) pour
tester la nouvelle persistance sans navigateur réel

**Storage**: Nouvelle base IndexedDB dédiée `dofus-craft-catalogue-cache` (store générique
`entries`, clé texte) pour les résultats de recherche/détail/catégories DofusDB — aujourd'hui
absente (`src/data/catalogue-cache.ts` n'est qu'un cache mémoire vidé au reload). Réutilisation
inchangée des stores IndexedDB existants pour les prix (`resource-prices-by-server`,
`community-mode-prices-by-server`, base `dofus-craft`). Le cache de médiane communautaire passe de
`sessionStorage` à `localStorage` (même API, juste un survol plus robuste que le remplacement d'un
onglet fermé/rouvert).

**Testing**: Vitest + Testing Library (`tests/unit`, `tests/integration`), suit les conventions
existantes (`server-scoped-price-store.test.ts`, `recherche-search-context.test.tsx`)

**Target Platform**: Application web SPA (navigateur), même surface que le reste de Dofus Craft

**Project Type**: Single project (frontend React + worker Cloudflare existant, non affecté ici —
aucun changement d'API ni de schéma D1)

**Performance Goals**: Données déjà connues localement visibles à l'écran en moins d'une seconde au
rechargement, sans attendre de round-trip réseau (SC-001) ; la lecture IndexedDB locale est
considérée instantanée du point de vue utilisateur

**Constraints**: Aucune régression sur le premier chargement (US3) ; aucun écrasement d'une réponse
plus récente par une réponse obsolète ou par une lecture de cache (FR-009/FR-010) ; aucune
réinitialisation de la recherche/filtres/scroll/objet sélectionné lors d'une mise à jour de
l'affichage (FR-005) ; préserver sans modification les invariants déjà spécifiés dans
specs/004-community-price-sharing (isolation des carnets, pré-remplissage unique) et
specs/007-outlier-confirmation (confirmation d'écart avant commit) ; aucun message d'erreur
bloquant en cas d'échec réseau (FR-007)

**Scale/Scope**: Un seul écran concerné (page Recherche : `RecherchePage`, `useCatalogue`,
`useResourcePrices`, `useCommunityPrice`, `ItemResults`) ; un nouveau module de persistance ; un
nouveau hook générique partagé ; un nouveau composant d'indicateur discret partagé

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Accurate, Traceable Game Data** — PASS. Chaque donnée affichée depuis le cache reste
  associée à sa date de dernière synchronisation réussie (FR-013) ; en cas d'échec réseau, la
  donnée locale est explicitement signalée comme potentiellement non à jour (FR-008) plutôt que
  présentée comme fraîche sans nuance.
- **II. Correctness Before Optimization** — PASS avec exigence de test. Cette fonctionnalité est
  un travail de performance perçue ; elle ne doit modifier aucune règle de calcul de coût de craft
  existante — uniquement quand/comment les données déjà correctes sont affichées. Les garanties
  anti-race (FR-009/FR-010) sont le cœur de la correction ici et DOIVENT être couvertes par des
  tests automatisés (cas normal, réponse obsolète, cache après réseau plus frais).
- **III. User Decisions Remain Explainable** — PASS. L'indicateur discret distingue explicitement
  une donnée fraîchement synchronisée d'une donnée locale affichée faute de réseau disponible ;
  aucune logique cachée n'est introduite dans le calcul de comparaison lui-même.
- **IV. Small, Cohesive Changes** — PASS avec justification. Un seul nouvel abstraction est
  introduite (`useStaleWhileRevalidate`) : elle est requise explicitement par la demande
  utilisateur pour éviter deux implémentations dupliquées (catalogue vs prix, perso vs
  communautaire) et réduit le risque en centralisant la garde anti-race à un seul endroit testé,
  plutôt que de la répliquer trois fois. Aucun changement n'est apporté à `catalogue-repository.ts`
  ni `catalogue-cache.ts` (cache mémoire interne existant, inchangé) : la nouvelle persistance se
  branche uniquement au niveau de `useCatalogue`, ce qui garde le changement localisé.
- **V. Safe Handling of User Data** — PASS. Aucune nouvelle donnée n'est collectée ni envoyée à un
  service distant ; seules des données déjà obtenues (catalogue public DofusDB, prix déjà saisis
  ou déjà reçus du service communautaire) sont mises en cache localement sur l'appareil de
  l'utilisateur.

Aucune violation à justifier.

**Re-check post Phase 1** (après `research.md` et `data-model.md`) : la conception détaillée
(nouvelle base IndexedDB dédiée et isolée des prix, aucune donnée personnelle nouvelle, hook unique
testé pour la garde anti-race, `catalogue-repository.ts`/`catalogue-cache.ts` non modifiés) ne fait
apparaître aucune violation supplémentaire ni ne remet en cause les points ci-dessus. Gate toujours
PASS.

## Project Structure

### Documentation (this feature)

```text
specs/010-search-instant-cache/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

Pas de répertoire `contracts/` : la fonctionnalité est purement client-side (cache local +
affichage), elle n'ajoute ni ne modifie aucune interface exposée à un autre système (le worker
Cloudflare et son API HTTP restent inchangés).

### Source Code (repository root)

```text
src/
├── data/
│   ├── catalogue-cache.ts                    # inchangé (cache mémoire interne à catalogue-repository.ts)
│   ├── catalogue-repository.ts               # inchangé (searchItems/getItemDetail/getCategories réutilisés tels quels comme "fetchRemote")
│   └── use-stale-while-revalidate.ts         # NOUVEAU : hook générique cache-local + revalidation réseau + garde anti-race
├── persistence/
│   ├── indexeddb-catalogue-cache-store.ts    # NOUVEAU : store IndexedDB générique clé/valeur + horodatage pour le catalogue
│   ├── indexeddb-resource-price-repository.ts   # inchangé
│   └── indexeddb-community-mode-price-repository.ts # inchangé
├── features/
│   ├── catalogue/
│   │   ├── useCatalogue.ts                   # MODIFIÉ : utilise useStaleWhileRevalidate pour search/detail/categories, expose isRevalidating/offline/lastSyncedAt
│   │   └── ItemResults.tsx                   # MODIFIÉ : distingue "aucune donnée encore" (skeleton) de "revalidation en cours" (liste conservée + indicateur discret)
│   ├── comparison/
│   │   ├── useResourcePrices.ts              # MODIFIÉ : lecture IndexedDB sans flash vide au remontage, garde anti-race par génération de requête
│   │   └── useCommunityPrice.ts              # MODIFIÉ : lecture cache-first (localStorage) avant le réseau, plutôt qu'en secours après échec uniquement
│   └── search/
│       └── RecherchePage.tsx                 # MODIFIÉ : branche le nouvel indicateur discret (revalidation / hors ligne / dernière synchro)
└── components/
    └── SyncStatusIndicator.tsx               # NOUVEAU : petit composant partagé affichant l'état de fraîcheur (discret, non bloquant)

tests/
├── unit/
│   ├── use-stale-while-revalidate.test.ts    # NOUVEAU : garanties anti-race (réponse obsolète ignorée, cache n'écrase jamais du réseau plus frais, pas de mise à jour si contenu identique)
│   ├── catalogue-cache-store.test.ts         # NOUVEAU : get/set/horodatage du nouveau store IndexedDB
│   └── use-community-price.test.ts           # MODIFIÉ si existant, sinon nouveau : affichage cache-first avant résolution réseau
└── integration/
    └── recherche-instant-cache.test.tsx      # NOUVEAU : rechargement avec cache déjà présent → affichage immédiat, sans reset de la recherche/filtres/objet sélectionné ; échec réseau → données locales conservées + indicateur discret
```

**Structure Decision**: Projet unique existant (frontend React sous `src/`, tests sous `tests/`,
worker Cloudflare sous `worker/` non touché par cette fonctionnalité). La logique anti-race et
cache-puis-revalidation est centralisée dans un seul hook générique (`src/data/`, aux côtés de
l'infrastructure de données existante), consommé par le catalogue et par les deux carnets de prix,
conformément à l'exigence explicite de ne pas dupliquer cette logique entre Mode personnel et Mode
communautaire.

## Complexity Tracking

*Aucune violation de la constitution à justifier — section non applicable.*
