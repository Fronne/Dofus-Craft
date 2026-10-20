# Plan d'implémentation : Refonte de la page Brisage, la recherche d'objet en premier

**Branche**: `065-refonte-page-brisage` | **Date**: 2026-10-20 | **Spec**: [spec.md](spec.md)

**Entrée**: spécification `specs/065-refonte-page-brisage/spec.md`

## Résumé

On réorganise la page Brisage sans toucher aux calculs. Un seul bloc « trouver l'objet » (champ de nom + panneau de filtres repliable : catégorie, niveau, stats en 3 colonnes) alimente une rangée de cartes ; la carte choisie ouvre l'en-tête (prix Achat / Craft / Auto, coefficient) et le tableau de brisage déjà en place ; les informations annexes passent sur une ligne en bas.

Approche technique : la liste de cartes lit l'index local des équipements déjà utilisé par la recherche par stats (`src/data/brisage-items.json`), au lieu de la recherche réseau par nom. Ce seul index permet de combiner nom, catégorie, niveau et stats, hors ligne et instantanément. On y ajoute la catégorie de chaque objet (régénération du JSON par le script existant), on ajoute le mode de prix « Auto », et on découpe `BrisagePage.tsx` (580 lignes) en composants d'affichage pour la nouvelle partie haute.

## Contexte technique

**Langage/Version** : TypeScript (React 18, Vite), tests Vitest

**Dépendances principales** : aucune nouvelle (React, composants et styles existants)

**Stockage** : `localStorage` du navigateur (clés existantes `craftcheck-brisage-search`, session de brisage, coefficients) ; aucune donnée serveur ajoutée

**Tests** : `npm run test` (Vitest, `tests/unit`, `tests/integration`), `npm run lint`, `npm run build` (`tsc -b`)

**Plateforme cible** : navigateur ordinateur et téléphone (déploiement Cloudflare depuis `master`, hors périmètre de cette feature)

**Type de projet** : application web monopage (front seul pour cette feature)

**Objectifs de performance** : filtrer l'index complet des équipements (plusieurs milliers d'objets) à chaque frappe sans à-coup perceptible (< 100 ms), pas de requête réseau pour la liste de cartes

**Contraintes** : mêmes résultats de calcul qu'avant (SC-003) ; aucune valeur inventée quand un prix, un coefficient ou une donnée manque ; page utilisable à 390 px sans défilement horizontal de la page

**Échelle/Périmètre** : une page, 3 à 4 nouveaux composants, 1 module de domaine étendu, 1 script de génération étendu

## Vérification de la constitution

*Porte : à passer avant la phase 0, à revérifier après la phase 1.*

| Principe | Verdict | Justification |
|----------|---------|---------------|
| I. Données de jeu exactes et traçables | OK | La catégorie ajoutée à l'index vient de DofusDB via le script existant, avec la même règle que `dofusdb-mappers.ts` ; la date et la source de l'index restent affichées ; données absentes signalées. |
| II. Exactitude avant optimisation | OK | Aucune règle de calcul modifiée. Les nouvelles règles (filtre nom/catégorie/niveau/stats, groupes de stats, prix Auto) sont des fonctions pures testées (normal, bornes, entrées vides). |
| III. Décisions explicables | OK | Le prix retenu en Auto indique sa provenance et les deux prix d'origine ; valeur saisie / enregistrée / dérivée distinguées ; prix manquant jamais traité comme 0. |
| IV. Changements petits et cohérents | OK | Pas de nouvelle dépendance. `ItemSearchByStats` est remplacé (sa logique est reprise, pas dupliquée) ; le découpage de `BrisagePage` se limite à la partie haute qui change. |
| V. Données utilisateur protégées | OK | Aucune nouvelle donnée collectée ; clés de stockage existantes conservées, lecture tolérante des anciennes valeurs. |

Aucune violation : section « Suivi de la complexité » inutile.

**Revérification après conception** : mêmes verdicts. La seule régénération de donnée (index) est tracée dans `research.md` (D2) et vérifiée par un test sur le JSON.

## Structure du projet

### Documentation (cette fonctionnalité)

```text
specs/065-refonte-page-brisage/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── page-brisage.md
└── tasks.md            # produit par /speckit-tasks
```

### Code source (racine du dépôt)

```text
scripts/
└── build-brisage-items.mjs        # ajoute categoryId à chaque objet de l'index

src/
├── data/
│   ├── brisage-items.json         # régénéré (champ categoryId)
│   └── brisage-items-repository.ts# lit categoryId
├── domain/
│   ├── brisage-search.ts          # IndexedItem.categoryId, filtre nom/catégorie, groupes de stats
│   ├── brisage-price.ts           # NOUVEAU : choix Achat / Craft / Auto (fonction pure)
│   └── brisage.ts                 # inchangé (calculs)
├── persistence/
│   ├── brisage-search-prefs.ts    # + categoryId, + filtres ouverts/repliés
│   └── brisage-session.ts         # PriceSource accepte 'auto'
└── features/brisage/
    ├── BrisagePage.tsx            # assemble la page, garde les calculs
    ├── ItemFinder.tsx             # NOUVEAU : champ, bouton Filtres, panneau, pastilles, cartes
    ├── ItemFilters.tsx            # NOUVEAU : catégories, niveau, stats en 3 colonnes
    ├── ItemCard.tsx               # NOUVEAU : carte d'objet
    ├── ItemHeader.tsx             # NOUVEAU : icône, nom, niveau, prix Achat/Craft/Auto, coefficient
    └── ItemSearchByStats.tsx      # SUPPRIMÉ (repris par ItemFinder)

src/styles/global.css              # styles de la nouvelle partie haute

tests/
├── unit/                          # brisage-search (filtre, groupes), brisage-price, prefs, index
└── integration/                   # parcours de la page : recherche, carte, prix, coefficient
```

**Décision de structure** : projet web unique, dossiers existants conservés. Les composants nouveaux sont purement d'affichage ; toute règle (filtre, groupes, prix Auto) vit dans `src/domain/` pour être testée sans interface.

## Suivi de la complexité

Aucune violation de la constitution à justifier.
