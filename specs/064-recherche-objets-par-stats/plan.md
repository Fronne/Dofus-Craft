# Plan d'implémentation : Recherche d'objets par stats ciblées (page Brisage)

**Branche** : `064-recherche-objets-par-stats` | **Date** : 2026-10-20 | **Spec** : [spec.md](spec.md)

**Constitution** : I (index d'objets généré avec source et date, données incomplètes signalées),
II (filtre, estimation et tri = fonctions pures testées), III (estimation étiquetée « à 100 % », prix
manquant jamais 0), IV (un script, un module de domaine, un panneau ; formules existantes inchangées),
V (seules des préférences d'affichage locales).

## Résumé

Un panneau « Par stats » sur la page Brisage : sélecteur multiple des stats ciblables, liste des
équipements qui portent **toutes** les stats choisies, estimation des runes à 100 %, tri (runes estimées
par défaut), clic = ouvre l'objet dans le brisage existant (`pick`). Les effets de tous les équipements
viennent d'un **index statique généré** (`src/data/brisage-items.json`), chargé à la demande, car la source
n'expose aujourd'hui les effets qu'objet par objet (`getItemEffectRanges`).

## Technical Context

**Langage** : TypeScript, React/Vite · **Tests** : vitest (unit + integration)
**Stockage** : index JSON versionné dans le dépôt (comme `rune-items.json`) ; préférences de recherche en
`localStorage` · **Plateforme** : web, pas de Worker, pas de migration
**Contraintes** : index chargé en import dynamique (hors bundle initial) ; liste paginée côté affichage ;
aucune valeur inventée ; le prix des runes n'est lu que pour le tri « valeur »

## Constitution Check

- I : l'index porte `source`, `sourceUrl`, `retrievedAt` ; la page affiche la date ; échec de chargement = message, pas de liste partielle présentée comme complète.
- II : `eligibleTargetStats`, `searchItemsByStats`, `estimateTargetRunes`, `sortSearchResults` testées (normal, bornes, vide, stat négative, chasse, exo).
- III : « Estimation à 100 % » sur chaque valeur ; prix inconnu → « — », classé en dernier.
- IV : `analyzeBrisage` et `BRISAGE_STATS` inchangés ; réutilise `lineWeight`, `averageRoll`, `runeForStat`.
- V : rien de personnel collecté ; la recherche n'écrit ni coefficient ni session.
Aucune violation, pas de Complexity Tracking.

## Project Structure

```text
specs/064-recherche-objets-par-stats/
├── plan.md · research.md · data-model.md · quickstart.md · tasks.md (étape suivante)
```

```text
scripts/build-brisage-items.mjs                 NEW  génère l'index (équipements brisables, effets positifs)
src/data/brisage-items.json                     NEW  index généré (revu puis commité)
src/domain/brisage-search.ts                    NEW  stats ciblables, filtre « toutes les stats », estimation, tri
src/data/brisage-items-repository.ts            NEW  import dynamique + garde de format de l'index
src/features/brisage/ItemSearchByStats.tsx      NEW  panneau : sélecteur, filtres, liste paginée
src/features/brisage/BrisagePage.tsx            + bascule « Par nom / Par stats », `pick` réutilisé
src/persistence/brisage-search-prefs.ts         NEW  stats, tri, plage de niveaux mémorisés (lecture défensive)
src/styles/global.css                           styles du panneau (classes existantes d'abord)
tests/unit/brisage-search.test.ts               NEW
tests/unit/brisage-items-repository.test.ts     NEW
tests/integration/brisage-search.test.tsx       NEW
```

**Structure Decision** : projet web unique existant ; aucune nouvelle dépendance.

## Parcours de la page

1. Page Brisage : onglet « Par nom » (existant, par défaut) et « Par stats ».
2. « Par stats » : charge l'index (état « chargement » puis liste, ou « indisponible »).
3. Le joueur choisit des stats : liste = objets avec jet positif sur toutes, triée par runes estimées.
4. Option : tri (runes / kamas / jet max), plage de niveaux ; compteur « N objets ».
5. Clic sur un objet : retour à la vue Brisage avec cet objet ouvert ; revenir à « Par stats » restaure la sélection.
