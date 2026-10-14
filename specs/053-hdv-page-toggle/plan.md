# Implementation Plan: Activer ou désactiver la page HDV

**Branch**: `053-hdv-page-toggle` | **Date**: 2026-10-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/053-hdv-page-toggle/spec.md`

## Summary

On ajoute un second réglage, « page HDV activée », au mécanisme de réglages du site créé par
specs/050 : une nouvelle clé `hdv_page` dans la table `site_settings`, un champ `hdvPage` dans
l'objet de réglages lu publiquement et écrit par l'administration, une seconde ligne dans la section
« Pages du site » de l'administration, et dans le site le même masquage que pour la Forgemagie
(lien retiré, adresse remplacée par un message d'indisponibilité). Différence avec la Forgemagie :
la valeur par défaut est « activée ». L'écriture devient partielle (seuls les champs envoyés sont
enregistrés) pour que changer un réglage ne puisse jamais écraser l'autre (FR-010).

## Technical Context

**Language/Version**: TypeScript 5 (React 19 côté site et administration, Cloudflare Workers)

**Primary Dependencies**: React, react-router-dom, Vite ; aucune nouvelle dépendance

**Storage**: Cloudflare D1 `dofus-craft-community-prices`, table `site_settings` (contrainte de clé
élargie par une migration 0017) ; `localStorage` (`craftcheck-site-settings`) pour le dernier état
connu sur l'appareil

**Testing**: Vitest + Testing Library (`tests/unit`, `tests/integration`)

**Target Platform**: navigateurs (site public et page d'administration), Cloudflare Workers

**Project Type**: application web + deux Workers (public `worker/`, administration `admin-worker/`)

**Performance Goals**: la lecture du réglage ne retarde pas l'affichage du site (appliquée après coup)

**Constraints**: lecture publique sans clé ; écriture réservée au propriétaire (Cloudflare Access) ;
compatibilité avec les états déjà mémorisés et avec un Worker public pas encore redéployé (objet sans
`hdvPage` → page HDV activée)

**Scale/Scope**: un réglage de plus, une migration, un interrupteur, une page d'indisponibilité

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Données traçables** — non concerné ; le réglage porte sa date de dernier changement. ✅
- **II. Exactitude avant optimisation** — valeurs par défaut, lecture tolérante et écriture
  partielle sont des fonctions explicites, testées (absence de ligne, ancien format, valeur
  invalide, indépendance des deux réglages). ✅
- **III. Décisions explicables** — page désactivée : message clair plutôt qu'une page introuvable. ✅
- **IV. Changements petits et cohérents** — extension du mécanisme existant, sans nouvelle
  abstraction ; le seul changement de forme (écriture partielle) répond directement à FR-010. ✅
- **V. Données utilisateur** — aucune donnée personnelle ; désactiver ne supprime aucun prix
  (FR-011). ✅

Re-vérifié après la conception : aucun écart.

## Project Structure

### Documentation (this feature)

```text
specs/053-hdv-page-toggle/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/site-settings-api.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
src/domain/site-settings.ts                  # hdvPage, défauts, parseSiteSettings, validation partielle
src/services/site-settings-api.ts            # lecture publique via parseSiteSettings
src/persistence/site-settings-cache.ts       # relit l'ancien format (sans hdvPage)
src/app/useSiteSettings.ts                   # remplace useForgemagiePageEnabled : réglages + lecture en cours
src/app/AppShell.tsx                         # lien HDV et route /hdv conditionnels, HdvUnavailablePage
worker/src/site-settings.ts                  # HDV_PAGE_KEY, lecture des deux clés
worker/migrations/0017_add_hdv_page_setting.sql  # recrée la table avec la clé élargie
worker/schema.sql, package.json              # schéma de référence + script de migration
admin-worker/src/settings.ts                 # écriture des seules clés envoyées
admin/admin-api.ts                           # saveSettings accepte un changement partiel
admin/SiteSettingsEditor.tsx                 # seconde ligne « Page HDV »
tests/unit/site-settings-domain.test.ts, site-settings-route.test.ts
tests/integration/hdv-page-toggle.test.tsx, admin-page.test.tsx, app-nav.test.tsx
```

**Structure Decision**: on étend à l'identique les fichiers de specs/050 ; aucun nouveau module
hormis le hook généralisé et la migration.

## Complexity Tracking

Aucune violation à justifier.
