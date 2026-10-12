# Implementation Plan: Activer ou désactiver la page Forgemagie

**Branch**: `050-forgemagie-page-toggle` | **Date**: 2026-10-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/050-forgemagie-page-toggle/spec.md`

## Summary

Un réglage « page Forgemagie activée » est enregistré dans la base partagée, lu publiquement par le
site et modifié seulement par l'API protégée de l'administration, sur le modèle du message
d'information (specs/020). Le site masque le lien de navigation et remplace la page par un message
d'indisponibilité tant que le réglage est « désactivée » — valeur par défaut quand rien n'est
enregistré ou lisible et qu'aucun état n'est connu sur l'appareil.

## Technical Context

**Language/Version**: TypeScript 5 (React 18 côté site et administration, Cloudflare Workers)

**Primary Dependencies**: React, react-router-dom, Vite ; aucune nouvelle dépendance

**Storage**: Cloudflare D1 `dofus-craft-community-prices` (nouvelle table `site_settings`) ;
`localStorage` pour le dernier état connu sur l'appareil

**Testing**: Vitest + Testing Library (`tests/unit`, `tests/integration`)

**Target Platform**: navigateurs (site public et page d'administration), Cloudflare Workers

**Project Type**: application web + deux Workers (public `worker/`, administration `admin-worker/`)

**Performance Goals**: la lecture du réglage ne retarde pas l'affichage du site (appliquée après coup)

**Constraints**: lecture publique sans clé ; écriture réservée au propriétaire (Cloudflare Access) ;
repli sûr quand le service est injoignable (FR-009)

**Scale/Scope**: un réglage, une route publique, une route d'administration, un interrupteur

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Données traçables** — non concerné (aucune donnée de jeu) ; le réglage porte sa date de
  dernier changement. ✅
- **II. Exactitude avant optimisation** — les règles (valeur par défaut, repli) sont des fonctions
  explicites et testées (cas normal, absence de ligne, charge utile invalide, service injoignable). ✅
- **III. Décisions explicables** — page désactivée : le joueur lit un message clair plutôt qu'une
  page introuvable. ✅
- **IV. Changements petits et cohérents** — même découpage que specs/020 ; aucune dépendance ;
  la table clé/valeur répond au besoin présent sans autre abstraction. ✅
- **V. Données utilisateur** — aucune donnée personnelle ; désactiver ne supprime rien (FR-010). ✅

Re-vérifié après la conception : aucun écart.

## Project Structure

### Documentation (this feature)

```text
specs/050-forgemagie-page-toggle/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/site-settings-api.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
src/domain/site-settings.ts                  # type, valeur par défaut, garde de type, validation
src/services/site-settings-api.ts            # lecture publique, ne lève jamais
src/persistence/site-settings-cache.ts       # dernier état connu (localStorage)
src/app/useForgemagiePageEnabled.ts          # dernier état connu, puis valeur lue
src/app/AppShell.tsx                         # lien de navigation et route conditionnels
worker/src/site-settings.ts                  # lecture D1 + réponse GET /site-settings
worker/src/index.ts                          # route publique
worker/migrations/0016_add_site_settings.sql # table, + worker/schema.sql + script npm
admin-worker/src/settings.ts                 # écriture D1
admin-worker/src/index.ts                    # GET/PUT /api/settings
admin/admin-api.ts                           # getSettings / saveSettings
admin/SiteSettingsEditor.tsx                 # interrupteur, + admin/AdminPage.tsx
tests/unit/site-settings-*.test.ts           # domaine, routes, service, cache
tests/integration/forgemagie-page-toggle.test.tsx, admin-page.test.tsx
```

**Structure Decision**: on reprend à l'identique la répartition de specs/020 (domaine partagé,
Worker public en lecture, Worker d'administration en écriture, éditeur dans `admin/`).

## Complexity Tracking

Aucune violation à justifier.
