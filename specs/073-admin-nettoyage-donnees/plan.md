# Plan d'implémentation : Nettoyage des données depuis la page d'administration

**Branche** : `073-admin-nettoyage-donnees` | **Date** : 2026-10-23 | **Spec** : [spec.md](spec.md)

**Entrée** : spécification `specs/073-admin-nettoyage-donnees/spec.md`

## Résumé

Un nouvel onglet « Données » dans la page d'administration liste les lignes les plus récentes de trois
tables (coefficients de brisage, prix de la communauté, prix externes), permet de supprimer une sélection
ou tout ce qui est plus récent que 10 min / 1 h / 24 h, avec aperçu du nombre exact, plafond de 500 lignes et
trace des suppressions. Côté serveur : un module `admin-worker/src/data-cleanup.ts` (registre de tables en
liste blanche, SQL paramétré uniquement), quatre routes `/api/data/...` derrière la vérification
propriétaire existante, et une table `admin_cleanup_log` (migration 0025). Côté page : un composant
`DataCleanupEditor` et une section `donnees` dans le tableau de bord.

## Contexte technique

**Langage/Version** : TypeScript (React 18 pour `admin/`, Cloudflare Workers pour `admin-worker/`)

**Dépendances principales** : aucune nouvelle (Vite, Vitest, Wrangler déjà en place)

**Stockage** : Cloudflare D1 (la base partagée avec `worker/`) ; une nouvelle table de trace

**Tests** : Vitest ; D1 simulé par `tests/support/sqlite-d1.ts` (charge `worker/schema.sql`), tests
d'intégration React comme `tests/integration/admin-page.test.tsx`

**Plateforme cible** : Worker d'administration (`dofus-craft-admin`) + page statique `dist-admin/`

**Type de projet** : application web (front React + Worker API)

**Objectifs de performance** : liste en moins de 1 s ; une suppression de 500 lignes en moins de 3 s

**Contraintes** : D1 limite à 100 paramètres liés par requête (suppression par paquets de 90 via
`batch`) ; plan gratuit : lectures bornées (50 lignes, un `COUNT` ciblé, index existants sur les dates)

**Échelle/Portée** : 3 tables, 1 administrateur, quelques suppressions par semaine

## Vérification de la constitution

| Principe | Verdict |
|----------|---------|
| I. Données de jeu traçables | OK — on retire des données, on n'en fabrique pas ; la trace dit quoi, quand, combien |
| II. Justesse avant optimisation | OK — règles explicites (plafond, liste blanche, comptage exact) couvertes par des tests : cas normaux, bornes (0, 500, 501 lignes), entrées invalides |
| III. Décisions explicables | OK — aperçu du nombre exact avant tout effacement ; la liste montre ce qui part |
| IV. Petits changements cohérents | OK — un module, une section, une table ; aucun refactoring étranger ; modèle = `sniffer-keys` |
| V. Données utilisateur | OK — `device_id` jamais renvoyé ; action destructrice avec confirmation + aperçu ; pas de secret ajouté |

Après conception : toujours OK. Aucune dérogation (pas de tableau de complexité).

## Structure du projet

### Documentation (cette fonctionnalité)

```text
specs/073-admin-nettoyage-donnees/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── admin-data-api.md
└── tasks.md             # produit par /speckit-tasks
```

### Code source (racine du dépôt)

```text
admin-worker/src/
├── data-cleanup.ts      # NOUVEAU : registre des tables, liste, comptage, suppression, trace
└── index.ts             # routes /api/data/... + type Env.DB

admin/
├── DataCleanupEditor.tsx # NOUVEAU : onglet « Données »
├── admin-api.ts          # appels adminApi.* + gardes de type
├── AdminPage.tsx         # section 'donnees'
├── dashboard-summary.ts  # SectionId 'donnees' + carte
├── Dashboard.tsx         # résumé statique de la carte
└── admin.css             # styles du tableau et de la confirmation

worker/
├── schema.sql                              # table admin_cleanup_log
└── migrations/0025_add_admin_cleanup_log.sql

package.json             # script worker:db:migrate-cleanup-log

tests/
├── unit/admin-data-cleanup.test.ts          # NOUVEAU : module + routes sur D1 simulé
├── unit/worker-schema.test.ts               # + table de trace
└── integration/admin-data-cleanup.test.tsx  # NOUVEAU : parcours de l'onglet
```

**Décision de structure** : on suit le découpage existant (un module Worker par domaine, un composant
par section, contrats dans `contracts/`), sans nouvelle couche.

## Suivi de complexité

Aucune violation à justifier.
