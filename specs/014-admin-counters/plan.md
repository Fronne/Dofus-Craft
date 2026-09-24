# Plan d'implémentation : administration des compteurs de joueurs

**Branch**: `014-admin-counters` | **Date**: 2026-09-24 | **Spec**: [spec.md](spec.md)

**Input**: Spécification de `specs/014-admin-counters/spec.md`

## Résumé

Les compteurs quittent le code pour une table D1 partagée, lue publiquement par le site
(`GET /player-counters` sur le Worker existant). Un nouveau Worker `dofus-craft-admin` sert une page
d'administration (seconde entrée Vite, mêmes styles que le site) et son API ; il est protégé en
entier par Cloudflare Access (connexion par code e-mail, seule l'adresse du propriétaire), et son API
revérifie le jeton Access et l'adresse. Les portraits des 19 classes (deux sexes) sont extraits du
jeu ; l'objet visé se choisit par recherche dans DofusDB. Voir [research.md](research.md).

## Contexte technique

**Language/Version** : TypeScript 5.7, React 19 ; Cloudflare Workers + D1

**Primary Dependencies** : `jose` (vérification du jeton Access, Worker d'administration seulement)

**Storage** : D1 `player_counters` ; `localStorage` pour la dernière liste côté joueurs

**Testing** : Vitest + Testing Library (validation, API admin avec base simulée, service public,
bulles, page d'administration) ; Playwright (non-régression du site) ; vérification manuelle de la
connexion Access après déploiement

**Target Platform** : navigateurs récents ; trois Workers (site, API publique, administration)

**Project Type** : application web + Workers

**Performance Goals** : une lecture des compteurs au chargement du site

**Constraints** : aucune trace d'administration sur le site public ; refus côté serveur sans jeton
valide ; adresse du propriétaire hors du dépôt ; page d'administration utilisable en 375 px

**Scale/Scope** : 1 table, 1 route publique, 5 routes d'administration, 1 page, 38 portraits

## Constitution Check

| Principe | Évaluation |
|----------|-----------|
| I. Données de jeu traçables | Portraits : `class_assets_.bundle` (`Head_{classe}{sexe}`), classes et objets : DofusDB (identifiants stockés). |
| II. Exactitude | Validation des compteurs (entiers ≥ 0, champs obligatoires, classe connue) testée ; « au moins » testé à l'affichage. |
| III. Décisions explicables | Les compteurs n'entrent dans aucun calcul ; sans service, seule la dernière liste réellement reçue est affichée, jamais un compteur inventé (FR-004). |
| IV. Changements petits | Un Worker et une page ajoutés, justifiés par la protection Access (research §1). Une dépendance (`jose`), recommandée par Cloudflare, limitée à l'administration. |
| V. Données utilisateur | Aucune donnée sur les joueurs. `OWNER_EMAIL` en secret Cloudflare. Suppression confirmée (action destructrice, principe V). |

**Résultat** : conforme, avant et après la phase 1.

## Project Structure

### Documentation (this feature)

```text
specs/014-admin-counters/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── player-counters-api.md
│   └── admin-ui.md
├── checklists/
│   └── requirements.md
└── tasks.md             # créé par /speckit-tasks
```

### Source Code (repository root)

```text
public/class-heads/Head_{10,11,20,21,…,200,201}.png   # 38 portraits extraits du jeu

src/
├── domain/breeds.ts                          # 19 classes (id, nom) + portrait(breedId, sex)
├── domain/player-counter.ts                  # type, validation, formatage (150+)
├── services/player-counters-api.ts           # lecture publique
├── services/dofusdb-api.ts                   # + recherche d'objet par nom (tout le catalogue)
├── persistence/player-counters-cache.ts      # dernière liste reçue
└── features/dungeon-counter/                 # bulles : lisent la liste au lieu des constantes

admin/                                         # page d'administration (entrée Vite séparée)
├── index.html
├── main.tsx
├── AdminPage.tsx
├── CounterEditor.tsx / NewCounterForm.tsx
└── admin-api.ts

admin-worker/
├── wrangler.toml                              # assets = dist-admin, D1, vars, run_worker_first
└── src/{index.ts, access.ts, counters.ts}     # routes /api/*, vérification Access, CRUD

worker/
├── migrations/0004_add_player_counters.sql
├── schema.sql
└── src/index.ts                               # GET /player-counters

vite.admin.config.ts                           # build de admin/ vers dist-admin/
package.json                                   # admin:build, admin:deploy, worker:db:migrate-player-counters

tests/
├── unit/player-counter-validation.test.ts
├── unit/admin-worker-counters.test.ts
├── unit/admin-access.test.ts
├── unit/player-counters-api.test.ts
├── integration/dungeon-counter-bubble.test.tsx   # adapté : liste chargée
└── integration/admin-page.test.tsx
```

**Structure Decision** : validation et types partagés dans `src/domain/player-counter.ts`,
importés par le site, la page d'administration et le Worker d'administration.

## Points d'attention

- Ordre de mise en ligne (quickstart.md) : migration → API publique → admin → réglage Access par le
  propriétaire → site public. Le site public ne doit être déployé qu'une fois la table en place,
  sinon il n'afficherait aucune bulle.
- Tant qu'Access n'est pas configuré, le Worker d'administration refuse tout (403) : pas de fenêtre
  d'exposition.
- Le réglage Access et le secret `OWNER_EMAIL` sont faits par le propriétaire, guidé.
