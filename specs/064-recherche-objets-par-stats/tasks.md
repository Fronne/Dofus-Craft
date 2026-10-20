# Tâches : Recherche d'objets par stats ciblées (page Brisage)

**Entrée** : [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [quickstart.md](quickstart.md)
Format : `- [ ] Txxx [P?] [US?] Description avec chemin`

## Phase 1 : Fondations (données et calcul)

- [x] T001 Extraire dans `src/data/catalogue-repository.ts` la règle de lecture des lignes d'effet de `getItemEffectRanges` (jet positif, `category !== 2`, `to: 0` = valeur fixe, `from ≤ to`) dans une fonction exportée pure, réutilisée par `getItemEffectRanges` sans changer son résultat (tests existants `tests/unit/catalogue-repository.test.ts` toujours verts).
- [x] T002 Écrire `scripts/build-brisage-items.mjs` sur le modèle de `scripts/build-rune-items.mjs` : lister les équipements DofusDB (mêmes super-types que `getDofusDbItemKind` → `Equipment`, sans filtre `hasRecipe`, en excluant les types d'objets non brisables : objets de quête et familiers, à vérifier dans le résumé), garder par objet `id`, `name`, `level`, `imageUrl`, `effects` (règle de T001, uniquement les `effectId` de `BRISAGE_STATS`, hors 696969) ; écrire `src/data/brisage-items.json` avec `source`, `sourceUrl`, `retrievedAt` ; rien n'est écrit si DofusDB échoue ; afficher un résumé (nombre d'objets, poids du fichier).
- [x] T003 Lancer le script, relire le résumé (cible < 2 Mo, sinon réduire les champs), commiter `src/data/brisage-items.json`. Si le réseau est indisponible, le noter et laisser un index minimal valide pour les tests.
- [x] T004 [P] Créer `src/data/brisage-items-repository.ts` : import dynamique de l'index, garde de format (objet invalide écarté, index invalide → erreur « indisponible »), mémorisation du résultat ; types `IndexedItem` / `BrisageItemsIndex` ([data-model.md](data-model.md)).
- [x] T005 [P] Tests dans `tests/unit/brisage-items-repository.test.ts` : index valide, objet mal formé écarté, index absent ou de mauvais format → échec explicite.
- [x] T006 Créer `src/domain/brisage-search.ts` : `targetableStats()` (stats de `BRISAGE_STATS`, ≠ 696969), `searchItemsByStats(items, effectIds, {minLevel, maxLevel})` (objets avec jet positif sur **toutes** les stats, bornes de niveau incluses, `min > max` → erreur de plage), `estimateTargetRunes(item, effectIds, settings)` (réutilise `averageRoll`, `lineWeight`, `runesForLine`, `wholeRunes`, `runeForStat` ; brisage normal : part de la ligne = 100 % du poids, coefficient de référence 100 %), `sortSearchResults(results, 'runes' | 'kamas' | 'maxRoll', runePrices)` selon les règles de [data-model.md](data-model.md) (inconnu en dernier, jamais 0, ordre stable nom puis `id`).
- [x] T007 [P] Tests dans `tests/unit/brisage-search.test.ts` : stat chasse et stat sans rune exclues ; ET sur deux stats ; jet négatif seul non listé ; jet fixe ; sélection vide → aucun résultat ; plage de niveaux (bornes, inversée) ; estimation égale à celle de `analyzeBrisage` à 100 % pour un objet donné ; SC-004 : 6 objets au classement connu par calcul manuel, les 5 premiers du tri par défaut correspondent ; chaque critère de tri, prix manquant classé en dernier, ordre stable.

## Phase 2 : US1 + US2 + US3 (P1) – liste, plusieurs stats, tri

**Test indépendant** : choisir Prospection puis Vitalité → objets portant les deux, runes estimées « à 100 % », ordre par runes décroissantes, changement de tri sans quitter la page.

- [x] T008 [US1] Créer `src/persistence/brisage-search-prefs.ts` : lecture défensive / écriture de `SearchSelection` (`effectIds`, `sort`, `minLevel`, `maxLevel`) sous la clé `craftcheck-brisage-search` ; toute valeur invalide → défauts (`sort: 'runes'`), stat non ciblable retirée.
- [x] T009 [P] [US1] Tests dans `tests/unit/brisage-search-prefs.test.ts` : valeur absente, JSON invalide, stats inconnues retirées, aller-retour.
- [x] T010 [US1] Créer `src/features/brisage/ItemSearchByStats.tsx` : chargement de l'index (états chargement / indisponible / prêt, date `retrievedAt` affichée), sélecteur multi-stats avec saisie pour filtrer et retrait d'une stat, invitation quand aucune stat n'est choisie, compteur « N objets », message si aucun résultat.
- [x] T011 [US2] Dans le même composant : liste des résultats (image, nom, niveau, fourchette `de X à Y` et runes estimées par stat choisie, étiquette « Estimation à 100 % »), pagination par 50 avec « Afficher plus ».
- [x] T012 [US3] Dans le même composant : sélecteur de tri (runes estimées par défaut, valeur en kamas avec `useRunePrices`, jet maximal) ; valeur inconnue affichée « — » ; prix manquant jamais traité comme 0.
- [x] T013 [US1] Dans `src/features/brisage/BrisagePage.tsx` : bascule « Par nom / Par stats » (« Par nom » reste l'affichage par défaut et inchangé), rendu de `ItemSearchByStats` avec les réglages de brisage et les prix de runes déjà chargés.
- [x] T014 [P] [US1] Styles du panneau dans `src/styles/global.css` (classes existantes d'abord, mobile et bureau).
- [x] T015 [P] [US1] Tests d'intégration dans `tests/integration/brisage-search.test.tsx` (index simulé) : invitation sans stat, une stat, deux stats (ET), stat chasse absente du sélecteur, tri par défaut et changement de tri, compteur, message sans résultat, index indisponible → message sans liste.

## Phase 3 : US4 (P2) – ouvrir un objet de la liste

**Test indépendant** : clic sur un objet → la page Brisage s'ouvre sur lui ; retour → sélection conservée.

- [x] T016 [US4] Clic sur une ligne : appeler `pick` de `BrisagePage` (objet `{id, name, level, imageUrl}`) et revenir à la vue Brisage ; mémoriser la sélection via T008 pour la restaurer au retour sur « Par stats » ; ne rien écrire dans les coefficients ni la session autrement que par `pick`.
- [x] T017 [P] [US4] Test d'intégration (même fichier que T015) : clic → objet ouvert, retour → mêmes stats, même tri ; aucun coefficient ni prix modifié par la recherche.

## Phase 4 : US5 (P3) – plage de niveaux

**Test indépendant** : plage 150–200 → tous les objets listés dans la plage.

- [x] T018 [US5] Champs niveau min / max dans `ItemSearchByStats.tsx`, mémorisés (T008) ; plage inversée refusée avec message, sans plantage.
- [x] T019 [P] [US5] Tests d'intégration : plage appliquée, plage inversée, champ vidé.

## Phase 5 : Finition

- [x] T020 Vérifier les types et lancer toute la suite (`npm test`, `npx tsc --noEmit`, lint du projet) ; noter tout échec étranger à la fonctionnalité ; contrôle manuel de SC-002 (changement de stat, de tri ou de niveau en moins de 1 s sur l'index complet).
- [x] T021 Parcours manuel de [quickstart.md](quickstart.md) sur le serveur de dev (bureau et mobile) ; donner l'URL de test à l'utilisateur.
- [x] T022 Documenter près de la fonctionnalité la fraîcheur de l'index et la commande pour le régénérer (en-tête du script et note dans `quickstart.md`).

## Dépendances

- T001 → T002 → T003 → T004. T006 dépend de T004 (types). T008 indépendant.
- Phase 2 dépend de T004, T006, T008. T013 après T010–T012.
- US4 (T016) dépend de T013. US5 (T018) dépend de T010.
- Parallèles : T005 ‖ T007 ‖ T009 ; T014 ‖ T015 ; T017 ‖ T019.

## Stratégie

MVP = Phases 1 et 2 (liste filtrée « toutes les stats », estimée, triée). Puis US4 (ouvrir l'objet), puis US5 (niveaux).
