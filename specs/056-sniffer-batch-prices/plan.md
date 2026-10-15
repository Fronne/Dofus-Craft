# Implementation Plan: envoi des prix HDV par les amis — côté API

**Branch**: `056-sniffer-batch-prices` | **Date**: 2026-10-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/056-sniffer-batch-prices/spec.md`

## Summary

Deux routes sur le Worker `dofus-craft-community-price-api` pour l'outil des amis :
`GET /sniffer/config` et `POST /community-price/batch`, authentifiées par une clé sniffer par ami
(table `sniffer_keys`, empreinte SHA-256). Le lot est validé (version d'outil, serveur, mapping
actif, plafond journalier), chaque observation est filtrée par le catalogue de ressources déjà
embarqué dans le Worker, réduite à un prix unitaire par la fonction pure `unitPrice`, puis
enregistrée par la même instruction d'insertion que la saisie manuelle (`contribution.ts`), avec
`kind = 'resource'`, `origin = 'sniffer'`, `device_id` = id de la clé. La liste des serveurs et le
catalogue de ressources sortent de `huzounet.ts` vers deux petits modules partagés.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Cloudflare Workers

**Primary Dependencies**: aucune nouvelle ; Web Crypto (`crypto.subtle.digest`) pour l'empreinte

**Storage**: D1 `dofus-craft-community-prices` — 3 nouvelles tables (`sniffer_keys`,
`sniffer_mappings`, `sniffer_daily_usage`), contrainte `origin` élargie à `'sniffer'`

**Testing**: Vitest (tests/unit), D1 simulée par `tests/support/sqlite-d1.ts` sur `worker/schema.sql`

**Target Platform**: Cloudflare Workers, plan gratuit (100k lignes écrites/jour, 1000 appels aux
services Cloudflare par invocation, 10 ms CPU)

**Project Type**: API (Worker) du site web

**Performance Goals**: un lot de 200 observations en un nombre constant de requêtes D1
(≤ 3 lectures de médianes + 1 lot d'écritures)

**Constraints**: rien appliqué en remote ni déployé sans accord ; aucune nouvelle colonne dans
`community_price_contributions` ; formulaire manuel inchangé

**Scale/Scope**: quelques amis, ≤ 5000 lignes/jour/clé

## Constitution Check

- **I. Données traçables** : chaque prix garde son origine (`sniffer`) et sa clé (`device_id`) ; le
  catalogue de ressources accepté est le fichier versionné déjà utilisé par le Worker. ✅
- **II. Exactitude d'abord** : `unitPrice` est une fonction pure, table de tests couvrant chaque
  branche et les bornes (lot unique, aucun lot, tout écarté). Les routes sont testées sur le vrai
  schéma SQL. ✅
- **III. Décisions explicables** : la règle est documentée dans le code avec ses deux constantes
  nommées et marquées « à recalibrer » ; l'écart à la médiane est stocké comme pour une saisie. ✅
- **IV. Changements petits** : deux modules extraits de `huzounet.ts` sans changer son comportement ;
  pas d'abstraction nouvelle hors du besoin. ✅
- **V. Données utilisateur** : la clé n'est jamais stockée en clair ni journalisée ; aucune donnée
  personnelle (le libellé de clé est saisi par le propriétaire). ✅

Post-design : inchangé. ✅

## Project Structure

### Documentation (this feature)

```text
specs/056-sniffer-batch-prices/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/sniffer-api.md
└── tasks.md
```

### Source Code (repository root)

```text
worker/
├── migrations/0018_add_sniffer_tables.sql     # sniffer_keys, sniffer_mappings, sniffer_daily_usage
├── migrations/0019_add_sniffer_origin.sql     # contrainte origin élargie (reconstruction de table)
├── schema.sql                                 # à jour
├── wrangler.toml                              # SNIFFER_MIN_VERSION, SNIFFER_DOWNLOAD_URL
└── src/
    ├── servers.ts            # nouveau : les 13 serveurs (+ ids Huzounet)
    ├── resource-catalogue.ts # nouveau : ids de ressources connues (sorti de huzounet.ts)
    ├── unit-price.ts         # nouveau : unitPrice, règle du prix unitaire
    ├── sniffer.ts            # nouveau : auth clé, config, batch
    ├── contribution.ts       # instruction d'insertion partagée, origin 'sniffer'
    ├── median.ts             # PriceOrigin gagne 'sniffer'
    ├── huzounet.ts           # importe servers.ts et resource-catalogue.ts
    └── index.ts              # routage des deux routes avant la clé publique
tests/unit/
├── sniffer-unit-price.test.ts
└── sniffer-routes.test.ts
package.json                  # worker:db:migrate-sniffer-tables, worker:db:migrate-sniffer-origin
```

**Structure Decision** : tout dans `worker/` ; tests dans `tests/unit` comme les autres tests du
Worker.

## Complexity Tracking

| Écart | Pourquoi | Alternative plus simple rejetée |
|---|---|---|
| Reconstruction de `community_price_contributions` (0019) | SQLite ne modifie pas une contrainte CHECK ; `origin = 'sniffer'` est exigé par le plan | Réutiliser `origin = 'capture'` : mélangerait les prix sniffer et les captures Forgemagie, contraire à la décision du plan |
