# Implementation Plan : administration des clés sniffer et du mapping

**Branch** : `057-sniffer-admin` | **Date** : 2026-10-15 | **Spec** : [spec.md](./spec.md)

**Input** : Feature specification from `/specs/057-sniffer-admin/spec.md`

## Summary

Deux sections dans la page d'administration (`admin/`, servie par le Worker `dofus-craft-admin`
derrière Cloudflare Access) et leurs routes dans `admin-worker/src/index.ts`, toutes derrière
`verifyOwner` comme les routes existantes :

- « Clés sniffer » : liste (avec le compteur du jour par `LEFT JOIN sniffer_daily_usage`), création
  (clé aléatoire `dcp_` + 64 hex, seule l'empreinte `sha256Hex` de `worker/src/fm/http.ts` — la même
  que `authenticateSnifferKey` — est stockée ; la clé en clair n'apparaît que dans la réponse 201),
  révocation idempotente.
- « Mapping » : dépôt `{ build, keymap, schema }` (textes des fichiers), validé par une fonction pure
  (`validateMappingUpload`), enregistré tel quel et rendu actif de son build dans un seul lot D1 ;
  historique ; réactivation (retour arrière) dans un seul lot D1.

Aucune migration : les tables de la phase 2 (`0018_add_sniffer_tables.sql`) sont utilisées telles
quelles.

## Technical Context

**Language/Version** : TypeScript 5 (strict), React 19 (page d'administration), Cloudflare Workers

**Primary Dependencies** : aucune nouvelle ; Web Crypto (`crypto.getRandomValues`, SHA-256 via
`sha256Hex`)

**Storage** : D1 `dofus-craft-community-prices` (même base que le Worker principal, déjà liée à
`dofus-craft-admin`) — tables `sniffer_keys`, `sniffer_mappings`, `sniffer_daily_usage`

**Testing** : Vitest (`tests/unit`), D1 simulée par `tests/support/sqlite-d1.ts` sur
`worker/schema.sql`, vérification Access simulée comme dans `tests/unit/site-settings-route.test.ts`

**Target Platform** : Cloudflare Workers, plan gratuit

**Project Type** : administration web (Worker + page React)

**Performance Goals** : chaque route en 1 à 3 requêtes D1

**Constraints** : rien appliqué en remote, rien déployé, rien fusionné sans accord explicite ;
aucune table ni colonne nouvelle ; les sections existantes de l'administration inchangées

**Scale/Scope** : quelques clés, quelques dizaines de mappings sur la vie de l'outil

## Constitution Check

- **I. Données traçables** : chaque mapping garde son build et sa date de dépôt ; l'historique n'est
  jamais effacé ; l'identifiant de clé reste le `device_id` des prix envoyés. ✅
- **II. Exactitude d'abord** : la validation du mapping est une fonction pure testée cas par cas
  (JSON invalide, non-objet, `price_list` absent ou en note `_`, `of` non résolu, cycle, taille) ;
  les routes sont testées sur le vrai schéma SQL, dont le lien avec `authenticateSnifferKey` et
  `snifferConfigResponse` de la phase 2. ✅
- **III. Décisions explicables** : la page dit pourquoi un dépôt est refusé (document et raison) et
  montre quel mapping est actif par build. ✅
- **IV. Changements petits** : deux modules admin, deux composants, des routes ajoutées au routeur
  existant ; `sha256Hex` réutilisé, pas recopié. ✅
- **V. Données utilisateur** : la clé en clair n'est ni stockée, ni journalisée, ni renvoyée après
  la création ; la liste ne renvoie pas l'empreinte. La révocation (destructive) demande une
  confirmation. ✅

Post-design : inchangé. ✅

## Project Structure

### Documentation (this feature)

```text
specs/057-sniffer-admin/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/admin-sniffer-api.md
└── tasks.md
```

### Source Code (repository root)

```text
admin-worker/
├── tsconfig.json            # inclut worker/src/fm/http.ts et worker/src/cors.ts (sha256Hex)
└── src/
    ├── sniffer-keys.ts      # nouveau : listKeys, createKey, revokeKey
    ├── sniffer-mappings.ts  # nouveau : validateMappingUpload, listMappings, uploadMapping, activateMapping
    └── index.ts             # routes /api/sniffer/keys…, /api/sniffer/mappings…
admin/
├── admin-api.ts             # appels des nouvelles routes
├── SnifferKeysEditor.tsx    # nouveau : section « Clés sniffer »
├── SnifferMappingsEditor.tsx# nouveau : section « Mapping »
├── AdminPage.tsx            # ajoute les deux sections
└── admin.css                # quelques styles (clé affichée, tableau)
tests/unit/
├── admin-sniffer-keys.test.ts
└── admin-sniffer-mappings.test.ts
```

**Structure Decision** : même découpage que les sections existantes (un module de données par
table côté `admin-worker/src`, un composant par section côté `admin/`). Les « deux pages » du plan
sont deux sections de la page d'administration unique, comme les autres réglages (FR-015 de
specs/014).

## Complexity Tracking

Aucun écart.
