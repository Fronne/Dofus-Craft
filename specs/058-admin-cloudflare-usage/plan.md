# Implementation Plan : utilisation Cloudflare dans l'administration

**Branch** : `058-admin-cloudflare-usage` | **Date** : 2026-10-19 | **Spec** : [spec.md](./spec.md)

**Input** : Feature specification from `/specs/058-admin-cloudflare-usage/spec.md`

## Summary

Une section « Utilisation Cloudflare » dans la page d'administration (`admin/`) et une route
`GET /api/usage?days=7|30` dans le Worker `dofus-craft-admin` (`admin-worker/src/index.ts`),
derrière `verifyOwner` comme les autres routes.

- **Côté Worker** (`admin-worker/src/cloudflare-usage.ts`) : une seule requête GraphQL vers l'API
  d'analyse de Cloudflare (`https://api.cloudflare.com/client/v4/graphql`) lit, par jour UTC, les
  requêtes Workers (`workersInvocationsAdaptive`) et les lignes lues / écrites D1
  (`d1AnalyticsAdaptiveGroups`) du compte. Le jeton et l'identifiant de compte sont les secrets
  `CLOUDFLARE_API_TOKEN` et `CLOUDFLARE_ACCOUNT_ID` du Worker (`wrangler secret put`).
- **Réponse** : toujours HTTP 200 avec un `state` (`ok`, `not-configured`, `denied`,
  `unavailable`) pour que la page n'affiche jamais d'erreur réseau et ne laisse jamais fuir le
  jeton ni le détail brut de Cloudflare.
- **Logique pure partagée** (`src/domain/cloudflare-usage.ts`) : limites du plan gratuit,
  pourcentage, niveau (`ok` / `warning` ≥ 80 % / `over` ≥ 100 %), complétion des jours manquants
  à 0. Testable sans réseau.
- **Page** (`admin/CloudflareUsageEditor.tsx`) : trois lignes consommé / limite / % avec barre
  `<progress>`-like, bascule 7 / 30 jours, petit graphique SVG en ligne (sans dépendance) des trois
  métriques en % de leur limite, tableau textuel accessible, bouton « Actualiser », messages pour
  chaque état de la source.

Aucune migration, aucune table, aucune dépendance nouvelle.

## Technical Context

**Language/Version** : TypeScript 5 (strict), React 19 (page d'administration), Cloudflare Workers

**Primary Dependencies** : aucune nouvelle ; `fetch` du Worker vers l'API GraphQL de Cloudflare

**Storage** : aucun (lecture seule chez Cloudflare, rien n'est copié en base — FR-010)

**Testing** : Vitest — unitaires (`tests/unit/cloudflare-usage.test.ts` : domaine + module Worker
avec `fetch` injecté, route avec Access simulé comme `admin-access.test.ts`) et intégration de la
page (`tests/integration/admin-page.test.tsx`, `adminApi` simulé)

**Target Platform** : Cloudflare Workers, plan gratuit

**Project Type** : administration web (Worker + page React)

**Performance Goals** : une seule requête GraphQL par chargement / actualisation

**Constraints** : rien déployé, aucun secret créé en production, rien fusionné sans accord ; le
jeton ne quitte jamais le Worker ; les sections existantes de l'administration inchangées

**Scale/Scope** : un propriétaire ; 7 ou 30 points par métrique

## Constitution Check

- **I. Données traçables** : la section dit d'où viennent les chiffres (API d'analyse Cloudflare) et
  l'heure de lecture ; un état non lisible n'est jamais présenté comme un chiffre. ✔
- **II. Correction avant optimisation** : les règles (pourcentage, niveaux, complétion des jours)
  sont des fonctions pures testées aux bornes (0, 79/80, 99/100, > 100 %, jour absent). ✔
- **III. Décisions explicables** : consommé, limite et pourcentage sont tous affichés ; le niveau
  est dit en texte ; le périmètre (compte entier pour les Workers) est écrit dans la page. ✔
- **IV. Petits changements cohérents** : un fichier Worker, un module de domaine, un composant ;
  graphique SVG maison plutôt qu'une bibliothèque ; pas de refactor des sections existantes. ✔
- **V. Données utilisateur sûres** : jeton et compte en secrets Worker, jamais committés ni
  renvoyés ni journalisés ; erreurs Cloudflare réduites à une catégorie. ✔
- **Contraintes projet** : l'API tierce est isolée dans un module unique ; si elle est
  indisponible, la section échoue proprement sans valeur inventée. ✔

Aucune violation : pas de tableau de complexité. Réévalué après la conception : inchangé.

## Project Structure

### Documentation (this feature)

```text
specs/058-admin-cloudflare-usage/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── admin-usage-api.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
src/domain/cloudflare-usage.ts          # nouveau : limites, pourcentage, niveau, jours (pur)
admin-worker/src/cloudflare-usage.ts    # nouveau : requête GraphQL + états de la source
admin-worker/src/index.ts               # + route GET /api/usage, Env + 2 secrets optionnels
admin-worker/wrangler.toml              # + commentaire de création des secrets
admin-worker/tsconfig.json              # + src/domain/cloudflare-usage.ts
admin/CloudflareUsageEditor.tsx         # nouveau : la section
admin/UsageChart.tsx                    # nouveau : petit graphique SVG
admin/admin-api.ts                      # + adminApi.getUsage(days)
admin/AdminPage.tsx                     # + <CloudflareUsageEditor />
admin/admin.css                         # + styles barres / graphique
README.md                               # + secrets et section
tests/unit/cloudflare-usage.test.ts     # nouveau
tests/integration/admin-page.test.tsx   # + describe de la section
```

**Structure Decision** : même découpage que la spec 057 — logique pure dans `src/domain`, accès
externe dans `admin-worker/src`, composant dans `admin/`. `worker/` et le reste de `src/` ne sont
pas touchés (une autre session y travaille).
