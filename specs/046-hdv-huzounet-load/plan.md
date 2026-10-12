# Implementation Plan: Charger les prix d'un onglet HDV depuis Huzounet

**Branch**: `046-hdv-huzounet-load` | **Date**: 2026-10-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/046-hdv-huzounet-load/spec.md`

## Summary

La page HDV reçoit, dans chacun de ses quatre onglets, un bouton « Charger depuis Huzounet ». Un clic
découpe les objets de l'onglet en tranches de 90, les envoie l'une après l'autre à la route existante
`POST /external-prices/refresh` (5,5 secondes entre deux départs), puis relit les prix de la tranche et
les écrit dans le carnet du Mode communautaire avec la règle déjà en place (« le plus récent gagne »).
La progression, l'arrêt et les messages d'échec viennent d'un module de règles pur, testé seul. Le site
apprend au passage à lire l'origine `external` et la mention `latestFragile` que l'API renvoie déjà, et
les affiche sur la ligne. Le Worker reçoit un seul ajout, la limite d'un chargement par onglet et par
heure (FR-017, research.md §9). Rien n'est déployé.

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 18, Vite

**Primary Dependencies**: aucune dépendance ajoutée

**Storage**: IndexedDB — carnet du Mode communautaire (`communityModePrices`), déjà existant ; aucun
nouveau magasin, aucune migration

**Testing**: Vitest (+ Testing Library, `fake-indexeddb`) ; l'API est simulée par `vi.mock` du module
`src/services/community-price-api`, comme dans `tests/integration/hdv-page.test.tsx`

**Target Platform**: navigateur (site statique servi par Cloudflare Workers)

**Project Type**: application web monopage + API existante ; seul le site est touché

**Performance Goals**: Consommables, Créatures, Runes chargés en moins de 15 s ; Ressources (2 537
objets, 29 tranches) en moins de 4 minutes (SC-001, SC-002)

**Constraints**: au plus une demande toutes les 5 s vers l'API (SC-007) ; 90 identifiants au plus par
demande ; serveur Mikhal uniquement ; carnet personnel jamais modifié ; saisie en cours jamais perdue ;
Node 22 pour l'outillage (`C:/Users/Cyril/AppData/Roaming/nvm/v22.23.3`)

**Scale/Scope**: 1 module de règles, 1 fonction de service, 2 crochets React, 1 composant, 4 fichiers
existants retouchés ; environ 350 lignes de code et autant de tests

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principe | Verdict | Remarque |
|----------|---------|----------|
| I. Données exactes et traçables | OK | Un prix venu de Huzounet garde sa date d'observation et porte sa source sur la ligne (« Huzounet », « peu de relevés », « relevé ancien »). |
| II. Exactitude avant optimisation | OK | Découpage, espacement, reprises et messages sont des règles pures avec tests (cas normal, bornes : 0, 1, 90, 91 objets ; échecs). La règle « le plus récent gagne » existante (`pickCommunityPrice`) est réutilisée telle quelle. |
| III. Décisions explicables | OK | La mention d'origine n'est affichée que si le prix montré est bien celui de Huzounet ; le bouton annonce le nombre d'objets et la durée ; chaque échec a son message. |
| IV. Changements petits et cohérents | OK | Seule la page HDV change ; la lecture de `external` / `latestFragile` est ajoutée au client existant sans le réorganiser ; les écrans 032–044 restent hors périmètre. |
| V. Données des utilisateurs | OK | Aucun prix n'est partagé au nom du joueur ; le carnet personnel n'est pas touché ; aucune donnée nouvelle n'est envoyée (identifiants d'objets et serveur seulement). |
| Contrainte : sources externes isolées | OK | Le site ne parle jamais à Huzounet : il passe par l'API, derrière `src/services/community-price-api.ts`. |
| Contrainte : échec sûr | OK | Une tranche en échec n'invente aucun prix ; les prix déjà affichés sont conservés. |

Re-vérification après conception : inchangée, aucun écart à justifier.

## Project Structure

### Documentation (this feature)

```text
specs/046-hdv-huzounet-load/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── external-prices-refresh.md   # ce que le site attend de la route existante
│   └── hdv-huzounet-ui.md           # libellés, états du bouton, messages
└── tasks.md                         # produit par /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── domain/
│   ├── huzounet-load.ts                 # NOUVEAU — règles pures : tranches, durée, avancement, messages
│   ├── forgemagie.ts                    # origine 'external' + libellé « Huzounet »
│   ├── types.ts                         # CommunityPrice : latestOrigin 'external', latestFragile
│   └── outlier-threshold.ts             # inchangé (la garde « pas de médiane » est dans la ligne)
├── services/
│   └── community-price-api.ts           # refreshExternalPrices() ; lecture de latestFragile
├── features/
│   ├── hdv/
│   │   ├── HdvPage.tsx                  # bouton, mentions d'origine sur tous les onglets
│   │   ├── HuzounetLoadButton.tsx       # NOUVEAU — bouton, progression, « Arrêter », message
│   │   ├── useHuzounetLoad.ts           # NOUVEAU — boucle de chargement, arrêt, écriture du carnet
│   │   └── useLatestOrigins.ts          # origine + mention + date, pour les lignes affichées
│   └── comparison/
│       ├── useResourcePrices.ts         # reload() : relire le carnet après une tranche
│       └── CommunityResourcePriceRow.tsx # pas de confirmation d'écart sans médiane (sampleSize 0)
└── styles/global.css                         # mise en forme du bouton et de la progression

tests/
├── unit/
│   ├── huzounet-load.test.ts            # NOUVEAU
│   └── community-price-api.test.ts      # refreshExternalPrices, origine external, latestFragile
└── integration/
    ├── hdv-huzounet-load.test.tsx       # NOUVEAU — les quatre récits, sur la page
    └── huzounet-load-hook.test.tsx      # NOUVEAU — la boucle : cadence réelle, reprises, arrêt
```

**Structure Decision**: celle du dépôt — règles dans `src/domain/`, appels réseau dans `src/services/`,
écran dans `src/features/hdv/`. Le Worker (`worker/`) n'est pas modifié (FR-016).

## Décisions de conception (résumé — détail dans research.md)

1. **Tranches et cadence** : 90 identifiants par demande ; 5,5 s entre deux *départs* de demande (l'API
   compte 5 s à partir de l'instant où elle reçoit la demande ; la marge absorbe l'écart de latence).
2. **Refus « trop récent »** : attendre 5,5 s puis redemander la même tranche, 3 fois au plus.
3. **Après chaque tranche réussie** : relire `GET /community-prices` pour les identifiants de la tranche
   (lecture fraîche), écrire dans le carnet communautaire ce que `pickCommunityPrice` dit de remplacer,
   puis rafraîchir le compteur, le carnet des lignes affichées et les mentions d'origine.
4. **Arrêt** : un jeton d'arrêt vérifié avant chaque demande et après chaque attente ; l'effet de
   nettoyage du crochet l'active au changement d'onglet, de serveur, de mode et au démontage.
5. **Mention d'origine** : calculée pour les lignes affichées seulement (pas les 2 537 de l'onglet), et
   montrée seulement si la date du prix affiché est celle du dernier prix connu de l'API.
6. **Serveurs relus** : constante `HUZOUNET_SERVERS = ['mikhal']` dans `src/domain/huzounet-load.ts`,
   avec renvoi vers `READ_SERVERS` de `worker/src/huzounet.ts`.

## Complexity Tracking

Aucun écart à justifier.
