# Implementation Plan: Catalogue du jeu servi en snapshot statique

**Branch**: `072-snapshot-catalogue-statique` | **Date**: 2026-10-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/072-snapshot-catalogue-statique/spec.md`

## Summary

Un script Node (`scripts/build-catalogue-snapshot.mjs`, branché sur `prebuild`) interroge DofusDB une
fois par déploiement et écrit deux fichiers JSON dans `public/catalogue-snapshot/` (`items.json`,
`item-sets.json`) plus un `meta.json` (date, totaux). Cloudflare les sert en brotli/gzip (≈ 1 Mo
transférés). Au lancement, un nouveau module `src/data/catalogue-snapshot.ts` lit le snapshot et
amorce le cache (`catalogue-item-index`, `item-set-index`) ; `preloadCatalogueIndexes()` ne garde le
crawl que comme repli. Un contrôle de fraîcheur discret (`$limit=0` sur `/items` et `/item-sets`,
délai minimal 6 h) ne retélécharge que sur écart de `total`.

## Technical Context

**Language/Version**: TypeScript 5 / React 19 / Vite ; script de build en Node ESM (`.mjs`, comme les `scripts/build-*.mjs`)

**Primary Dependencies**: aucune nouvelle (fetch natif Node, compression assurée par le CDN)

**Storage**: cache IndexedDB existant (`catalogue-cache`, spec 021) + fichiers statiques `public/catalogue-snapshot/` (gitignorés, générés)

**Testing**: Vitest (module snapshot, contrôle de fraîcheur, repli, script de génération avec `fetch` simulé)

**Target Platform**: navigateurs mobiles et desktop ; Cloudflare Workers static assets (`wrangler.toml`)

**Project Type**: web-app (front seul ; le Worker `worker/` n'est pas touché)

**Performance Goals**: première visite : ≤ 2 requêtes catalogue (+ `meta.json`), ≈ 1 Mo transféré, TTI mobile < 8 s (SC-001/002)

**Constraints**: aucune requête paginée DofusDB à l'ouverture si snapshot présent ; erreurs de rafraîchissement silencieuses ; génération qui échoue plutôt que de livrer un catalogue vide

**Scale/Scope**: ≈ 5-8 Mo de JSON brut (≈ 1 Mo compressé) ; 2 index (objets avec recette, panoplies)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- I. Données traçables : le snapshot porte `generatedAt`, `totals` et la source ; l'origine du catalogue (snapshot / rafraîchi) est gardée avec le cache (FR-013). OK.
- II. Correction avant optimisation : test d'équivalence entre résultats issus du snapshot et du catalogue brut (SC-006). OK.
- III. Décisions explicables : aucun calcul modifié ; la date du catalogue reste disponible. OK.
- IV. Changements cohérents : un module nouveau, un script, un changement minimal dans `catalogue-repository.ts` (corps de `preloadCatalogueIndexes`). Aucune dépendance. OK.
- V. Données utilisateur : aucune donnée utilisateur, aucun secret (DofusDB public). OK.
- Contraintes projet : source externe isolée derrière un adaptateur (script + module), échec sûr sans fabriquer de valeurs (repli crawl). OK.

Pas de violation. Re-contrôle après Phase 1 : inchangé.

## Project Structure

### Documentation (this feature)

```text
specs/072-snapshot-catalogue-statique/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/snapshot-format.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
scripts/
└── build-catalogue-snapshot.mjs     # nouveau : génère public/catalogue-snapshot/*
src/data/
├── catalogue-snapshot.ts            # nouveau : lecture snapshot, amorçage cache, contrôle de fraîcheur
├── catalogue-cache.ts               # + seedCache(key, value, meta) (petit ajout)
└── catalogue-repository.ts          # preloadCatalogueIndexes() : appelle le module snapshot, repli crawl
package.json                         # + "snapshot:catalogue", "prebuild"
.gitignore                           # + public/catalogue-snapshot/
```

Tests : à côté des tests existants de `src/data/` (convention du dépôt à confirmer à l'étape tasks).

**Structure Decision**: un module séparé pour limiter la zone de conflit avec la session `perf-audit`
(seul le corps de `preloadCatalogueIndexes` change dans `catalogue-repository.ts`).

## Complexity Tracking

Aucune violation à justifier.
