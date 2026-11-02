# Plan d'implémentation : Auteur et date des prix communautaires

**Branche** : `082-auteur-prix-communautaires` | **Date** : 2026-11-02 | **Spec** : [spec.md](spec.md)

**Entrée** : spécification `specs/082-auteur-prix-communautaires/spec.md`

## Résumé

Aujourd'hui une contribution de prix (`community_price_contributions`) n'a aucun auteur, seulement un
identifiant d'appareil anonyme. Le site affiche déjà, pour le prix communautaire, **le dernier prix
saisi et sa date** (spec 024 pour les ressources, spec 016 pour les objets). On ajoute l'auteur de
cette dernière saisie :

- **Worker** : une colonne `author_discord_user_id` (nullable) sur les contributions. `POST
  /community-price` lit un jeton de session optionnel (en-tête `X-Fm-Session`) : valide, il donne
  l'auteur ; absent, expiré ou invalide, la saisie reste anonyme et réussit quand même. Les lectures
  (`/community-price`, `/community-prices`, `/latest-price`, `/item-prices`) renvoient en plus le
  pseudo de l'auteur de la dernière saisie (`latestAuthor` / `author`), résolu **à la lecture** dans
  `fm_players` et seulement si le profil est public ; l'identifiant Discord ne sort jamais. Une
  nouvelle route `GET /fm/me/contributions` alimente « Mes contributions ». La suppression du profil
  met `author_discord_user_id` à NULL sur ses prix.
- **Site** : la saisie envoie le jeton s'il existe ; un petit composant partagé affiche
  « par Pseudo · il y a 2 h » (ou « il y a 2 h ») dans les lignes de prix qui montrent déjà une date.
  Mon profil gagne le réglage de confidentialité (avec sa phrase d'explication) et la section « Mes
  contributions ».
- Aucun calcul de prix ne change (médiane, valeurs aberrantes, dernier prix, Huzounet). Migration
  additive : les anciens prix restent sans auteur.

## Contexte technique

**Langage/Version** : TypeScript (React 18 + Vite côté site ; Cloudflare Worker côté API)

**Dépendances principales** : react-router-dom, Vitest + Testing Library, Playwright (e2e) ; D1 (SQLite) ; aucune nouvelle dépendance

**Stockage** : D1 — `community_price_contributions` (+ `author_discord_user_id`) ; lecture du pseudo et de la confidentialité dans `fm_players` ; jeton de session déjà côté navigateur (`dofus-craft:fm-session-token`)

**Tests** : `npm run test` (Vitest, `tests/unit`, `tests/integration`), e2e Playwright dans `tests/e2e`

**Plateforme cible** : navigateurs desktop et mobile ; Worker Cloudflare

**Type de projet** : application web (site + Worker)

**Objectifs de performance** : les lectures de prix gardent leur forme et leur cache de 60 s ; l'auteur s'ajoute par une jointure sur la seule dernière ligne de chaque prix ; la saisie d'un prix ne gagne qu'une lecture de session quand un jeton est présent

**Contraintes** : ne jamais exposer l'identifiant Discord (FR-013) ; saisie jamais refusée à cause de la session (FR-012) ; l'en-tête CORS doit autoriser `X-Fm-Session` ; l'ordre de déploiement est migration, Worker, site (un site déjà en ligne ignore simplement les nouveaux champs)

**Échelle/Périmètre** : une communauté Dofus (quelques centaines d'utilisateurs) ; prix conservés 90 jours

## Vérification de la constitution

| Principe | Verdict |
|---|---|
| I. Données de jeu traçables | OK — la provenance d'un prix gagne une précision (qui, quand) ; un prix sans auteur est dit sans auteur, rien n'est inventé. |
| II. Correction avant optimisation | OK — règles testables : résolution de l'auteur (jeton valide / absent / expiré), pseudo masqué si privé, auteur retiré à la suppression, aucun changement des prix calculés. |
| III. Décisions explicables | OK — la mention « par … · il y a … » explique d'où vient le prix ; la date complète est au survol. |
| IV. Changements petits et cohérents | OK — une colonne, une route de lecture, un composant d'affichage ; on réutilise `fm_players`, les sessions et `formatRelativeTime`. |
| V. Données utilisateur | OK — le pseudo est public par défaut (décision de l'utilisateur) mais le profil privé le masque ; suppression du profil = rupture du lien ; seul le pseudo public sort du Worker. |

Re-vérification après conception : aucune violation, pas de table de complexité.

## Structure du projet

### Documentation

```text
specs/082-auteur-prix-communautaires/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── price-author-api.md
└── tasks.md          # créé par /speckit-tasks
```

### Code source

```text
worker/
├── migrations/0031_add_price_author.sql        # author_discord_user_id + index
├── schema.sql                                  # même colonne
└── src/
    ├── cors.ts                                 # + X-Fm-Session
    ├── contribution.ts                         # auteur dans Contribution, insert et lectures
    ├── median.ts                               # ContributionRow.authorName, summary.latestAuthor
    ├── latest.ts                               # auteur de la dernière saisie d'un objet
    ├── index.ts                                # POST /community-price lit le jeton, auteur dans /community-price
    └── fm/
        ├── http.ts                             # optionalViewer(request, db)
        ├── me.ts                               # deleteMe rompt le lien ; clearReadCache après PATCH/DELETE
        ├── contributions.ts                    # GET /fm/me/contributions
        ├── router.ts                           # route /fm/me/contributions (hors contrôle d'appartenance)
        └── (imports/captures)                  # le viewer devient auteur d'une capture importée

src/
├── domain/
│   ├── types.ts                                # CommunityPrice.latestAuthor
│   ├── price-update.ts                         # formatPriceUpdate(date, author) → « par X · il y a 2 h »
│   └── forgemagie.ts                           # FmContributions
├── services/
│   ├── community-price-api.ts                  # jeton envoyé à la saisie ; author lu dans les réponses
│   └── fm-api.ts                               # getFmContributions
├── components/PriceUpdateNote.tsx              # mention partagée (date complète au survol)
├── features/
│   ├── comparison/ResourcePriceInput.tsx, MarketPriceInput.tsx, CommunityResourcePriceRow.tsx
│   ├── brisage/RunePriceInput.tsx
│   ├── prices/PricesPage.tsx
│   └── account/ProfilPage.tsx, ContributionsSection.tsx   # confidentialité + Mes contributions
tests/
├── unit/            # price-author (worker), fm-contributions, price-update, community-price-api
└── integration/     # PriceUpdateNote dans les lignes, profil (confidentialité, contributions)
```

**Décision de structure** : on reste dans les deux projets existants (site et Worker). Les lectures
publiques gardent leur forme, avec un champ optionnel en plus, de sorte qu'un site plus ancien ou un
Worker plus ancien continue de fonctionner.

## Suivi de complexité

Aucune violation de la constitution à justifier.
