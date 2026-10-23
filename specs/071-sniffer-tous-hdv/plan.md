# Implementation Plan: prix de tous les HDV envoyés par l'outil des amis

**Branch**: `071-sniffer-tous-hdv` | **Date**: 2026-10-22 | **Spec**: [spec.md](./spec.md)

## Summary

Les observations de `POST /community-price/batch` gagnent un champ optionnel `category` (typeId
DofusDB). Une table statique `worker/src/item-types.json`, générée par
`scripts/build-item-types.mjs` depuis `https://api.dofusdb.fr/item-types`, donne la nature de chaque
type (`equipment` / `resource` / `rune` / `consumable`). Une colonne `item_type` (NULL permis) est
ajoutée à `community_price_contributions` par `ALTER TABLE ... ADD COLUMN` — aucune ligne réécrite.
Équipement : `kind = 'item'`, prix = `lots["1"]`, référence = dernier prix d'objet connu (lu en une
requête par 98 ids), pas de prix par lot. Autres natures : chemin actuel (`unitPrice`, médiane,
`community_price_lots`), sans `isKnownResource`. Sans `category` : comportement 056 inchangé,
`item_type` NULL.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Cloudflare Workers

**Primary Dependencies**: aucune nouvelle

**Storage**: D1 — migration `0024_add_contribution_item_type.sql` (ADD COLUMN, pas de copie)

**Testing**: Vitest, D1 simulée (`tests/support/sqlite-d1.ts`) sur `worker/schema.sql`

**Déploiement** : appliquer 0024 en remote AVANT `wrangler deploy` (chaque INSERT écrit `item_type`).

**Constraints**: plan gratuit (≤ 1000 appels par invocation) : lots de 200 observations, références lues
par paquets de 98 ids ; `SNIFFER_MIN_VERSION` inchangé ; rien en remote

## Constitution Check

- **I. Données traçables** : la table des types porte sa source et sa date de génération ; chaque prix
  garde origine, clé et nature. ✅
- **II. Exactitude** : classification et routage testés (chaque nature, inconnue, mal formée, sans
  catégorie, mélange). ✅
- **IV. Petits changements** : un champ, une colonne, une table générée ; aucune réécriture des
  lectures du site. ✅
- **V. Données utilisateur** : rien de nouveau. ✅

## Décisions (research)

- **R1 — Natures** : rune = type 78 ; resource = super-type 9 hors 78 ; consumable = super-types 6,
  16, 70 ; equipment = super-types 1, 2, 3, 4, 5, 7, 10, 11, 12, 13, 22, 23, 25, 69. Le reste (14
  quêtes, 15, 17-20, 26) : absent de la table → `unknown_category`.
- **R2 — Colonne plutôt que `kind`** : `kind` décide du calcul (médiane / dernier prix) et est lu par 11
  requêtes ; élargir son CHECK obligerait à reconstruire la table (coût en écritures). `ADD COLUMN`
  avec un CHECK et sans défaut ne réécrit rien.
- **R3 — Référence d'un équipement** : comme `insertContribution` pour `kind = 'item'` (dernier prix
  d'objet), mais lue pour tout le lot : nouvelle fonction `readLatestItemContributions` dans
  `latest.ts`.
- **R4 — Forme d'un équipement** : uniquement la clé `"1"`, prix > 0 ; sinon `invalid` (0 → `no_price`).
- **R5 — Sans `category`** : `item_type` NULL (inconnu), même si l'id est une rune du catalogue : on
  ne devine pas.

## Project Structure

```text
scripts/build-item-types.mjs              # génère worker/src/item-types.json
worker/src/item-types.json                # typeId -> nature, source + date
worker/src/item-types.ts                  # itemTypeOf(category)
worker/migrations/0024_add_contribution_item_type.sql
worker/schema.sql                         # colonne item_type
worker/src/contribution.ts                # Contribution.itemType, INSERT
worker/src/latest.ts                      # readLatestItemContributions
worker/src/sniffer.ts                     # parseObservation par catégorie, insertions
specs/056-sniffer-batch-prices/contracts/sniffer-api.md
tests/unit/sniffer-routes.test.ts, tests/unit/worker-schema.test.ts, tests/unit/sniffer-item-types.test.ts
package.json                              # worker:db:migrate-item-type
```
