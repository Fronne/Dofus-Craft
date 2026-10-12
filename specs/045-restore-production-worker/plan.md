# Implementation Plan: Remettre dans le dépôt le Worker de l'API tel qu'il tourne en production

**Branch**: `045-restore-production-worker` | **Date**: 2026-10-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/045-restore-production-worker/spec.md`

## Summary

Le Worker de l'API en production contient treize fonctionnalités (032 à 044) absentes du dépôt. On les
remet dans `worker/src/` à partir de la sauvegarde `backups/production-2026-10-12/worker-api-en-ligne.js`
(bundle esbuild non minifié, découpé par fichier d'origine), on écrit les migrations qui amènent une base
neuve à la structure de production, on réécrit des tests, et on prouve l'identité en reconstruisant le
Worker et en le comparant ligne à ligne à la sauvegarde. Rien n'est déployé.

## Technical Context

**Language/Version**: TypeScript 5 (strict, `noUnusedLocals`, `noUnusedParameters`), cible ES2022

**Primary Dependencies**: Cloudflare Workers (wrangler 4.132), `@cloudflare/workers-types` ; aucune
dépendance ajoutée

**Storage**: Cloudflare D1 `dofus-craft-community-prices` (SQLite) ; schéma dans `worker/schema.sql`,
migrations dans `worker/migrations/`

**Testing**: Vitest ; les tests du Worker appellent `worker.fetch` avec une base D1 simulée sur SQLite
(`tests/support/sqlite-d1.ts`, `tests/support/fm-worker.ts`)

**Target Platform**: Cloudflare Workers sur `*.workers.dev`

**Project Type**: service web (API) à côté d'un site statique ; seul le Worker est touché

**Performance Goals**: inchangés — ceux de la production

**Constraints**: comportement identique à la production (FR-002) ; lecture Huzounet limitée à 50 objets
par requête, 1 requête par seconde, 12 requêtes par passage ; wrangler exige Node 22 (le Node par défaut
du poste est 21.6.2 : utiliser `C:/Users/Cyril/AppData/Roaming/nvm/v22.23.3`)

**Scale/Scope**: environ 800 lignes de Worker à remettre : 5 modules nouveaux, 16 modules modifiés,
3 fichiers de données, 5 migrations

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principe | Verdict | Remarque |
|----------|---------|----------|
| I. Données exactes et traçables | OK | Les prix Huzounet gardent leur source (`source = 'huzounet'`), leur date d'observation et leur niveau de confiance ; l'origine `external` est transmise au site. |
| II. Exactitude avant optimisation | OK | Règles de comptage et de fusion des prix reprises telles quelles, couvertes par des tests réécrits (FR-013). |
| III. Décisions explicables | OK | Aucun changement d'affichage ; `latestOrigin` et `latestFragile` restent exposés. |
| IV. Changements petits et cohérents | Écart justifié | Une seule fonctionnalité en regroupe treize : voir Complexity Tracking. |
| V. Données des utilisateurs | OK | Aucune donnée de production modifiée ; structure lue en lecture seule ; aucun secret dans le dépôt. |
| Contrainte : sources externes isolées | OK | Huzounet reste derrière `worker/src/huzounet.ts` et `worker/src/external-price.ts`. |
| Flux : spec écrite avant le code | Écart justifié | Le code existe déjà en production ; la spec le décrit après coup. |

Re-vérification après conception : inchangée.

## Project Structure

### Documentation (this feature)

```text
specs/045-restore-production-worker/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── api.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
worker/
├── wrangler.toml                  # + cron de lecture Huzounet, + HUZOUNET_SYNC
├── schema.sql                     # aligné sur la production
├── migrations/
│   ├── 0011_add_external_prices.sql
│   ├── 0012_add_fm_guild.sql
│   ├── 0013_add_line_corrections.sql
│   ├── 0014_add_line_read_name_and_counted.sql
│   └── 0015_add_channel_commands.sql
└── src/
    ├── external-price.ts          # nouveau
    ├── huzounet.ts                # nouveau
    ├── equipment-items.json       # nouveau (données)
    ├── priced-extras.json         # nouveau (données)
    ├── index.ts, latest.ts, median.ts, retention.ts   # modifiés
    └── fm/
        ├── seances.ts, players.ts, captures.ts        # nouveaux
        ├── priceable-items.json                       # remplacé (ajout de `names`)
        └── auth.ts, item-names.ts, purchases.ts, bot-events.ts, imports.ts,
            bot-commands.ts, channels.ts, reads.ts, items.ts, site-sessions.ts,
            me.ts, router.ts                           # modifiés

tests/unit/
├── external-price.test.ts, huzounet-sync.test.ts, huzounet-refresh.test.ts   # nouveaux
├── fm-seances.test.ts, fm-players.test.ts, fm-captures.test.ts               # nouveaux
└── fm-*.test.ts, community-*.test.ts existants                               # adaptés au besoin
tests/support/fm-worker.ts         # schéma de test aligné

package.json                       # scripts worker:db:migrate-* pour 0011 à 0015
```

**Structure Decision**: structure existante du Worker, inchangée. L'ordre des modules dans le bundle de
production donne l'ordre des imports à respecter pour que la comparaison soit lisible.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Treize fonctionnalités dans une seule (principe IV) | Le Worker en production est un tout : le dépôt ne redevient déployable que lorsque tout y est. | Treize restaurations séparées laisseraient douze états intermédiaires non déployables et sans référence de comparaison. |
| Spec écrite après le code (flux de travail) | Le code d'origine et ses specs sont perdus ; la production est la seule référence. | Respécifier chaque fonctionnalité de zéro inviterait à réinterpréter un comportement que les joueurs utilisent déjà. |
