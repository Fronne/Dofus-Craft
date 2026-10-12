# Implementation Plan: Actualiser les prix d'une recette sur la page Recherche

**Branch**: `047-recherche-refresh-prices` | **Date**: 2026-10-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/047-recherche-refresh-prices/spec.md`

## Summary

La page Recherche retrouve le bouton « Actualiser les prix » du site en ligne. Un clic envoie une demande
à la route existante `POST /external-prices/refresh` (serveur, objet affiché, identifiants de l'objet et
des ressources de sa chaîne de fabrication), affiche le message correspondant à la réponse, puis fait
relire le prix HDV partagé de l'objet et les prix des ressources : un compteur de relecture, incrémenté à
chaque réponse réussie, relance les lectures existantes sans en ajouter de nouvelle sorte. La ligne d'une
ressource affiche la mention de fragilité (« peu de relevés », « relevé ancien ») d'un prix Huzounet, et
le dernier prix gardé sur l'appareil conserve cette mention. Seul le site change ; rien n'est déployé.

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 18, Vite

**Primary Dependencies**: aucune dépendance ajoutée

**Storage**: aucun magasin nouveau ; le carnet du Mode communautaire (IndexedDB) et le dernier prix gardé
en `localStorage` (`craftcheck-community-price:…`) gardent leur format, ce dernier lisant deux champs de
plus qu'il écrivait déjà (`latestOrigin`, `latestFragile`)

**Testing**: Vitest (+ Testing Library, `fake-indexeddb`) ; l'API est simulée par `vi.mock` du module
`src/services/community-price-api`, comme dans `tests/integration/recherche-instant-cache.test.tsx`

**Target Platform**: navigateur (site statique servi par Cloudflare Workers)

**Project Type**: application web monopage + API existante ; seul le site est touché

**Performance Goals**: un message en moins de 10 s (SC-001) ; une seule demande de relecture par clic
(SC-003)

**Constraints**: 90 identifiants au plus, numériques, l'objet en premier ; libellés identiques à ceux du
site en ligne ; saisie en cours jamais perdue ; Node 22 pour l'outillage
(`C:/Users/Cyril/AppData/Roaming/nvm/v22.23.3`)

**Scale/Scope**: 1 module de règles, 1 fonction de service, 6 fichiers existants retouchés ; environ
120 lignes de code et autant de tests

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principe | Verdict | Remarque |
|----------|---------|----------|
| I. Données exactes et traçables | OK | Un prix relu garde sa date d'observation ; un prix Huzounet fragile le dit sur la ligne. |
| II. Exactitude avant optimisation | OK | La liste d'identifiants et le choix du message sont des règles pures, testées (bornes : 0, 89, 90, 91 ressources, doublons, identifiants non numériques). La règle « le plus récent gagne » (`pickCommunityPrice`) est réutilisée telle quelle. |
| III. Décisions explicables | OK | Chaque issue a son message ; la mention de fragilité n'apparaît que si le prix affiché est bien celui de Huzounet. |
| IV. Changements petits et cohérents | OK | Seule la page Recherche et ses lignes de prix changent ; la relecture réutilise les lectures existantes. |
| V. Données des utilisateurs | OK | Rien n'est partagé au nom du joueur ; le carnet personnel n'est pas touché ; seuls le serveur et des identifiants d'objets sont envoyés. |
| Contrainte : sources externes isolées | OK | Le site ne parle jamais à Huzounet : il passe par l'API, derrière `src/services/community-price-api.ts`. |
| Contrainte : échec sûr | OK | Un échec affiche un message et laisse les prix tels quels. |

Re-vérification après conception : inchangée, aucun écart à justifier.

## Project Structure

### Documentation (this feature)

```text
specs/047-recherche-refresh-prices/
├── plan.md
├── research.md
├── contracts/recherche-refresh-ui.md
├── quickstart.md
└── tasks.md
```

Pas de `data-model.md` : aucune donnée nouvelle n'est stockée ; les deux types ajoutés sont décrits dans
le contrat.

### Source Code (repository root)

```text
src/
├── domain/recipe-refresh.ts                       # nouveau : identifiants à relire, message
├── services/community-price-api.ts                # + refreshRecipePrices
├── components/Icon.tsx                            # + icône « refresh »
├── features/search/RecherchePage.tsx              # bouton, message, compteur de relecture
├── features/comparison/useSharedItemPrice.ts      # relit quand le compteur change
├── features/comparison/useCommunityPrice.ts       # le prix gardé conserve origine et mention
├── features/comparison/CommunityResourcePriceRow.tsx  # mention de fragilité
├── features/comparison/ResourcePriceInput.tsx     # affiche la mention après la date
└── styles/global.css                              # .prices-head, .prices-refresh, .price-note

tests/
├── unit/recipe-refresh.test.ts                    # nouveau
├── unit/community-price-api.test.ts               # + refreshRecipePrices
└── integration/recherche-refresh-prices.test.tsx  # nouveau
```

**Structure Decision**: structure existante du dépôt (règles pures dans `src/domain`, accès à l'API dans
`src/services`, écrans dans `src/features`). Le bouton reste dans `RecherchePage.tsx`, comme en ligne : il
n'a de sens qu'avec l'état de cette page (objet choisi, identifiants de la chaîne).

## Complexity Tracking

Aucun écart à la constitution.
