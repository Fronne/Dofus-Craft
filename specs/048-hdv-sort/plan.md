# Implementation Plan: Trier la page HDV et onglets à icônes

**Branch**: `048-hdv-sort` | **Date**: 2026-10-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/048-hdv-sort/spec.md`

## Summary

La page HDV reprend l'état du site en ligne : un menu « Trier » remplace les trois boutons de filtre par
prix, et les onglets portent une icône. Le tri est une règle pure (`sortHdvLines`) appliquée après la
recherche et les filtres, sur les prix déjà lus pour le compteur. Seul le site change.

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 18, Vite

**Primary Dependencies**: aucune dépendance ajoutée

**Storage**: aucun changement ; le tri n'est pas mémorisé

**Testing**: Vitest (+ Testing Library, `fake-indexeddb`), fichiers existants `tests/unit/hdv-domain.test.ts`
et `tests/integration/hdv-page.test.tsx`

**Target Platform**: navigateur

**Project Type**: application web monopage ; seul le site est touché

**Performance Goals**: réordonner 2 537 objets en moins d'une seconde (SC-003) — un tri en mémoire

**Constraints**: libellés identiques au site en ligne ; ordre identique (objets sans prix à la fin, égalités
dans l'ordre habituel) ; fonctionnalité 046 inchangée ; Node 22

**Scale/Scope**: 1 règle pure, 1 page, 2 icônes, quelques règles de style ; environ 60 lignes de code

## Constitution Check

| Principe | Verdict | Remarque |
|----------|---------|----------|
| I. Données exactes et traçables | OK | Le tri ne change aucun prix ; il lit ceux du compteur. |
| II. Exactitude avant optimisation | OK | Règle pure testée : chaque tri, objets sans prix, égalités, date illisible, valeur inconnue. |
| III. Décisions explicables | OK | Le menu nomme l'ordre appliqué ; l'ordre habituel reste le choix par défaut. |
| IV. Changements petits et cohérents | OK | Une seule page ; le retrait des boutons de filtre est une révision annoncée de specs/023. |
| V. Données des utilisateurs | OK | Rien n'est envoyé ni stocké. |
| Contraintes (sources isolées, échec sûr) | OK | Aucun appel réseau nouveau. |

Re-vérification après conception : inchangée.

## Décisions de conception

Relevé du site en ligne (`site-index-original.js`, ≈ 717 600 à 722 300) :

- **Règle de tri** : `default` rend la liste telle quelle. Sinon, les lignes avec un prix sont triées par
  la clé (prix unitaire, ou `Date.parse(updatedAt) || 0`), en ordre décroissant pour « Prix le plus
  élevé » et « Mis à jour récemment », croissant pour les deux autres ; à égalité, par position d'origine ;
  les lignes sans prix suivent, dans l'ordre d'origine.
- **Place du tri** : après la recherche et le filtre par type ou par stat, avant le chargement progressif
  de la liste ; changer de tri ramène la liste à ses premières lignes.
- **Menu** : `<select class="hdv-type-filter" aria-label="Trier">`, valeurs `default`, `price-desc`,
  `price-asc`, `recent`, `oldest` ; une valeur inconnue vaut `default`. L'état vit dans la page et n'est pas
  remis à zéro au changement d'onglet.
- **Onglets** : classe `hdv-tab hdv-tab--icon`, icône de 16 px (`package`, `potion`, `paw`, `rune`) puis
  libellé dans un `<span>`. Icônes `potion` et `rune` à ajouter à `Icon.tsx` (tracés du site en ligne).
- **Styles** : `.hdv-tabs` passe d'une bordure basse à une ombre intérieure, sans barre de défilement ;
  sur écran étroit, onglets sans espace, police `.82rem`, icône au-dessus du libellé.
- **Retraits** : `filterByPrice` et `HdvPriceFilter` (domaine), le bloc `hdv-price-filters` de la page. Les
  classes de style `.hdv-price-filter*` restent : le site en ligne les réutilise sur la page Forgemagie
  (choix « Public / Privé »), à réécrire dans une fonctionnalité suivante.
- **Alternative écartée** : garder les boutons de filtre à côté du tri — ce ne serait pas la page que les
  joueurs ont aujourd'hui, et « Mis à jour il y a longtemps » couvre le besoin de specs/023.

## Project Structure

```text
src/domain/hdv.ts                 # + HdvSort, HDV_SORTS, isHdvSort, sortHdvLines ; − filterByPrice
src/components/Icon.tsx           # + potion, rune
src/features/hdv/HdvPage.tsx      # menu « Trier », onglets à icônes, retrait des boutons de filtre
src/styles/global.css             # .hdv-tabs, .hdv-tab--icon
tests/unit/hdv-domain.test.ts     # tests du tri à la place de ceux du filtre
tests/integration/hdv-page.test.tsx  # tri à l'écran, onglets
```

Pas de `data-model.md`, de `research.md` ni de contrat séparés : la fonctionnalité n'a ni donnée ni
interface nouvelle, et ses décisions tiennent dans la section ci-dessus.

## Vérification

```bash
export PATH="/c/Users/Cyril/AppData/Roaming/nvm/v22.23.3:$PATH"
npx vitest run tests/unit/hdv-domain.test.ts tests/integration/hdv-page.test.tsx tests/integration/hdv-huzounet-load.test.tsx
npx tsc -b --noEmit && npx eslint src tests --quiet && npx vitest run
```

Puis, sur le site local : page HDV, menu « Trier » dans chaque onglet, icônes des onglets en largeur de
bureau et de téléphone. Référence avant modification : 1 062 tests.
