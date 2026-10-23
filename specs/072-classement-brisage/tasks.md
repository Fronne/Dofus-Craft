---

description: "Liste des tâches du classement des objets les plus rentables à briser"
---

# Tâches : Classement des objets les plus rentables à briser

**Entrée** : documents de conception dans `specs/072-classement-brisage/`

**Prérequis** : [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/classement-ui.md](contracts/classement-ui.md), [quickstart.md](quickstart.md)

**Tests** : demandés par la constitution du projet (principe II : toute règle de calcul a ses tests automatiques) ; ils sont donc inclus. Écrire chaque test avant le code qu'il vérifie et constater qu'il échoue.

**Organisation** : tâches groupées par histoire utilisateur pour pouvoir les livrer et les tester une par une.

## Format : `[ID] [P?] [Story] Description`

- **[P]** : peut tourner en parallèle (fichiers différents, pas de dépendance inachevée)
- **[Story]** : histoire de la spec (US1 à US8)
- Chaque tâche cite le fichier concerné

## Phase 1 : Mise en place

**But** : vérifier le point de départ.

- [ ] T001 Lancer `npm run test` dans le worktree et noter les tests déjà en échec éventuels, pour ne pas confondre avec ceux de cette fonctionnalité (résultat à consigner en commentaire dans la description du commit de la phase)

---

## Phase 2 : Fondations (bloquant pour toutes les histoires)

**But** : le domaine pur, les lectures de données et le hook partagés par toutes les histoires.

**⚠️ CRITIQUE** : aucune histoire ne commence avant la fin de cette phase.

- [ ] T002 [P] Ajouter `listStoredCoefficients(serverId): Map<string, StoredCoefficient>` (coefficients valides du serveur, clé = id d'objet) dans `src/persistence/brisage-coefficients.ts`, avec un test dans `tests/unit/brisage-coefficients.test.ts` (serveur différent ignoré, entrée invalide ignorée)
- [ ] T003 [P] Créer `src/domain/brisage-ranking.ts` avec les types `RankingRow`, `RankingView`, `FreshnessLevel` de [data-model.md](data-model.md), la constante `STALE_AFTER_DAYS = 7` et la fonction `freshnessOf(date, now): FreshnessLevel` (`unknown` si la date est absente ou illisible) ; tests dans `tests/unit/brisage-ranking.test.ts` (frais, vieux, périmé à 7 jours, date absente)
- [ ] T004 [P] Exposer les dates des prix de runes : extraire `loadPrices` de `src/features/brisage/useRunePrices.ts` en une fonction partagée qui renvoie aussi `updatedAt` / `latestContributionAt` de chaque prix, sans changer ce que `useRunePrices` renvoie à la fiche ; ajouter un test dans `tests/unit/` qui vérifie que la fiche reçoit les mêmes prix qu'avant
- [ ] T005 Créer `src/features/brisage/useRankingData.ts` : charge `loadBrisageItemsIndex()`, les prix d'objets du mode actif (`pinnedItemPrices.listAllForServer` en mode personnel, `getSharedItemPrices` en mode communautaire), les prix de runes avec dates (T004) et les coefficients (locaux T002 + partagés par paquets de `MAX_ITEMS_PER_READ`, le plus récent gagne via `latestCoefficient`) ; renvoie `{ status, items, itemPrices, runePrices, coefficients, incomplete: string[] }` où `incomplete` liste les sources indisponibles (FR-014) ; dépend de T002 et T004

**Point de contrôle** : les données du classement sont disponibles ; le domaine et ses types existent.

---

## Phase 3 : Histoire 6 - Classement réservé au propriétaire (Priorité : P1)

**But** : l'onglet n'existe que pour le propriétaire ; mis en premier pour que rien ne soit visible avant que la porte soit en place.

**Test indépendant** : navigateur vierge sans onglet ; après `/brisage?classement=1`, onglet présent et conservé au rechargement ; `?classement=0` le retire.

### Tests de l'histoire 6

- [ ] T006 [P] [US6] Écrire `tests/unit/brisage-ranking-access.test.ts` : accès refusé par défaut, accordé après `?classement=1`, retiré après `?classement=0`, refusé si le stockage est illisible ou bloqué (échec sûr)

### Mise en œuvre de l'histoire 6

- [ ] T007 [US6] Créer `src/persistence/brisage-ranking-access.ts` : clé `craftcheck-brisage-ranking` (`'1'` = accordé), `hasRankingAccess()`, `applyRankingAccessFromSearch(search): boolean` qui lit `classement=1` ou `classement=0`, écrit ou retire l'indicateur, chaque accès au stockage dans un `try/catch`
- [ ] T008 [US6] Dans `src/features/brisage/BrisagePage.tsx`, appeler `applyRankingAccessFromSearch` au montage, retirer le paramètre `classement` de l'adresse (remplacement d'historique, sans recharger), et ajouter l'état d'accès ; ne rien monter du classement sans accès (FR-011) ; test d'intégration dans `tests/integration/brisage-ranking-tab.test.tsx` : sans indicateur, ni onglet ni requête de données du classement

**Point de contrôle** : la porte fonctionne ; aucun contenu de classement n'est encore affiché.

---

## Phase 4 : Histoire 1 - Voir les objets les plus rentables (Priorité : P1) 🎯 MVP

**But** : liste classée par gain, pour les objets au prix et au coefficient connus.

**Test indépendant** : trois objets avec prix et coefficient connus sont listés du gain le plus fort au plus faible ; le gain égale celui de la fiche pour un objet sans ligne négative.

### Tests de l'histoire 1

- [ ] T009 [P] [US1] Dans `tests/unit/brisage-ranking.test.ts`, tester `buildRankingRow` (coefficient connu) : gain, meilleur choix et seuil identiques à `analyzeBrisage` appelé directement avec les jets moyens (SC-002), objet sans ligne brisable → statut `no-breakable-line`, rune sans prix → statut `missing-rune-price` sans gain inventé, gain négatif conservé
- [ ] T010 [P] [US1] Dans `tests/integration/brisage-ranking-tab.test.tsx`, tester l'onglet avec accès accordé : trois objets listés dans l'ordre décroissant du gain, perte en bas, serveur changé = seules les données de ce serveur

### Mise en œuvre de l'histoire 1

- [ ] T011 [US1] Dans `src/domain/brisage-ranking.ts`, écrire `buildRankingRow(item, context)` pour un coefficient connu : fusion des lignes par stat comme `mergeRanges` de `BrisagePage.tsx`, jets moyens par `averageRoll`, appel de `analyzeBrisage`, remplissage de `RankingRow` ; et `buildRanking(items, context)` qui renvoie les lignes de tous les objets au prix connu
- [ ] T012 [US1] Créer `src/features/brisage/RankingTab.tsx` : appelle `useRankingData`, construit les lignes (mémoïsées par serveur, mode, prix, coefficients), affiche l'avertissement d'estimation (FR-015), l'état de chargement, le bandeau « Classement incomplet : … » (FR-014), le message de liste vide, et le tableau avec les colonnes Objet, Niveau, Prix, Meilleur choix, Gain, Coefficient, Seuil
- [ ] T013 [US1] Dans `src/features/brisage/BrisagePage.tsx`, ajouter le sélecteur d'onglets Fiche / Classement (visible seulement avec l'accès) et monter `RankingTab` ; la fiche reste inchangée et par défaut
- [ ] T014 [P] [US1] Ajouter les styles du classement dans `src/styles/global.css`, avec la charte et les classes du tableau de la fiche (`brisage-table`), et un affichage lisible sur mobile

**Point de contrôle** : MVP livrable (classement des objets au coefficient connu, réservé au propriétaire).

---

## Phase 5 : Histoire 2 - Trier par colonne (Priorité : P1)

**But** : un clic sur un en-tête trie, un second inverse.

**Test indépendant** : « Niveau » croissant puis décroissant ; valeurs inconnues toujours en fin ; tri conservé quand un filtre change.

- [ ] T015 [P] [US2] Dans `tests/unit/brisage-ranking.test.ts`, tester `sortRows(rows, column, direction)` : chaque colonne triable (nom, niveau, prix, gain, seuil, gain avec exo), sens inversé, valeurs inconnues toujours en fin quel que soit le sens, ordre stable à égalité
- [ ] T016 [US2] Écrire `sortRows` dans `src/domain/brisage-ranking.ts`
- [ ] T017 [US2] Dans `src/features/brisage/RankingTab.tsx`, rendre les en-têtes triables (bouton avec `aria-sort`, tri par défaut gain décroissant, clic = bascule du sens) ; test d'intégration dans `tests/integration/brisage-ranking-tab.test.tsx` sur « Niveau » et `aria-sort`

---

## Phase 6 : Histoire 7 - Objets sans coefficient connu (Priorité : P2)

**But** : groupe à part classé par seuil de coefficient croissant.

**Test indépendant** : deux objets sans coefficient, seuil 35 % et 90 % : le premier d'abord ; un seuil au-dessus de 100 % affiche « jamais rentable » en fin de groupe ; aucun gain en kamas.

- [ ] T018 [P] [US7] Dans `tests/unit/brisage-ranking.test.ts`, tester `buildRankingRow` sans coefficient : seuil = minimum des seuils connus de `analyzeFocusAdvice` (`normalBreakEven`, `focusBreakEven`), `neverProfitable` au-dessus de 100 %, pas de `gainKamas`, rune sans prix → statut `missing-rune-price`
- [ ] T019 [US7] Étendre `buildRankingRow` dans `src/domain/brisage-ranking.ts` pour le groupe `unknown` avec `analyzeFocusAdvice` et le prix de l'objet, et faire trier ce groupe par seuil croissant par défaut
- [ ] T020 [US7] Dans `src/features/brisage/RankingTab.tsx`, afficher deux groupes titrés « Coefficient connu » et « Coefficient inconnu », la mention « coefficient inconnu », « jamais rentable » et « — » à la place du gain ; test d'intégration correspondant

---

## Phase 7 : Histoire 3 - Fraîcheur et fiabilité (Priorité : P2)

**But** : voir l'ancienneté du prix, des runes et du coefficient, et ce qui est périmé.

**Test indépendant** : un coefficient vieux de plusieurs jours montre son ancienneté ; au-delà de 7 jours il est mis en évidence ; une rune sans prix est signalée et la ligne passe en fin.

- [ ] T021 [P] [US3] Dans `tests/unit/brisage-ranking.test.ts`, tester le calcul de `oldestRunePriceAt` (la plus ancienne date parmi les runes réellement utilisées) et que les dates absentes donnent `unknown`
- [ ] T022 [US3] Remplir `oldestRunePriceAt` dans `buildRankingRow` (`src/domain/brisage-ranking.ts`) à partir des dates de T004
- [ ] T023 [US3] Dans `src/features/brisage/RankingTab.tsx`, afficher l'ancienneté du prix, de la rune la plus ancienne et du coefficient (« il y a 3 j »), mettre en évidence ce qui est périmé par un texte et une icône, pas seulement une couleur ; test d'intégration

---

## Phase 8 : Histoire 4 - Filtres (Priorité : P2)

**But** : restreindre la liste.

**Test indépendant** : gain minimum 5 000 retire les objets en dessous ; « masquer sans coefficient » retire le groupe inconnu ; filtres sans résultat = message et réinitialisation.

- [ ] T024 [P] [US4] Dans `tests/unit/brisage-ranking.test.ts`, tester `filterRows(rows, view)` : niveau min/max, catégorie, gain minimum (groupe connu), masquer sans prix, masquer sans coefficient, combinaisons, niveau min supérieur au max (aucun filtrage et erreur `levelRangeError` de `src/domain/brisage-search.ts`)
- [ ] T025 [US4] Écrire `filterRows` dans `src/domain/brisage-ranking.ts`
- [ ] T026 [US4] Dans `src/features/brisage/RankingTab.tsx`, ajouter le formulaire de filtres (niveau, catégorie issue des catégories de la page Recherche, gain minimum, deux cases de masquage), le bouton « Réinitialiser les filtres » et le message d'absence de résultat ; test d'intégration
- [ ] T027 [US4] Dans `src/features/brisage/BrisagePage.tsx`, remonter l'état `RankingView` (tri et filtres) pour qu'il survive à un changement d'onglet (FR-010)

---

## Phase 9 : Histoire 5 - Ouvrir un objet depuis le classement (Priorité : P2)

**But** : un clic sur une ligne ouvre la fiche.

**Test indépendant** : clic sur une ligne = fiche de l'objet ; retour au classement = tri et filtres inchangés.

- [ ] T028 [US5] Dans `src/features/brisage/RankingTab.tsx`, rendre chaque ligne cliquable et atteignable au clavier (Entrée) avec une propriété `onOpen(item)` ; dans `src/features/brisage/BrisagePage.tsx`, la brancher sur `openItem` puis passer à l'onglet Fiche ; test d'intégration (ouverture, retour avec tri et filtres conservés)

---

## Phase 10 : Histoire 8 - Prendre en compte un exo (Priorité : P3)

**But** : colonne « Gain avec exo » avec la rune de l'exo déduite.

**Test indépendant** : pour un objet sans une stat à rune chère, gain avec exo = gain obtenu avec l'exo − prix d'une rune de cette stat ; sans amélioration, aucun exo ; sans prix de rune, exo non proposé.

- [ ] T029 [P] [US8] Dans `tests/unit/brisage-ranking.test.ts`, tester le calcul d'exo : ligne `{ value: 1, exo: true }` ajoutée par stat absente, prix d'une rune retranché, meilleur exo retenu, aucun exo recommandé s'il n'améliore pas le gain, exo ignoré sans prix de rune, effet sur le seuil dans le groupe inconnu (FR-018)
- [ ] T030 [US8] Écrire `bestExoFor(item, context)` dans `src/domain/brisage-ranking.ts` en réutilisant `analyzeBrisage` / `analyzeFocusAdvice`, `BRISAGE_STATS` et `runeForStat`, et remplir `RankingRow.exo` ; mesurer le temps de calcul sur l'index complet et, si la mesure dépasse 1 s au premier affichage, calculer l'exo en différé (après le premier affichage) sans bloquer le tri
- [ ] T031 [US8] Dans `src/features/brisage/RankingTab.tsx`, ajouter la colonne triable « Gain avec exo » (stat de l'exo, apport, note « une rune déduite : échecs et runes supplémentaires non comptés ») ; test d'intégration

---

## Phase 11 : Finitions et vérifications

- [ ] T032 Lancer `npm run test` et `npm run build` (et le lint si le projet en a un) et corriger ce qui casse
- [ ] T033 Mesurer le tri et un filtre sur l'index complet (SC-003, moins d'une seconde) et le consigner dans `specs/072-classement-brisage/quickstart.md`
- [ ] T034 Dérouler les huit scénarios de `specs/072-classement-brisage/quickstart.md` dans le navigateur (serveur de développement) et donner l'adresse du serveur de test à l'utilisateur
- [ ] T035 Lancer le sous-agent `relecteur` sur les changements et corriger les points graves qu'il signale

---

## Phase optionnelle : Ouvrir le classement à tous (à ne lancer que sur confirmation du propriétaire)

**But** : FR-012, deuxième moitié — passer de « seulement moi » à « tout le monde » sans livraison de code.

- [ ] T036 Après confirmation, ajouter un réglage booléen `brisageRanking` (défaut : faux) hors de la liste `SITE_PAGES` dans `src/domain/site-settings.ts`, sa lecture dans `worker/src/site-settings.ts`, son écriture dans `admin-worker/src/settings.ts` et un interrupteur dans `admin/SiteSettingsEditor.tsx`, avec les tests existants adaptés (`tests/unit/site-settings-domain.test.ts`, `tests/unit/site-settings-route.test.ts`)
- [ ] T037 Dans `src/features/brisage/BrisagePage.tsx`, afficher l'onglet si l'accès local est accordé **ou** si le réglage partagé est activé

---

## Dépendances et ordre d'exécution

### Dépendances entre phases

- **Mise en place (1)** : aucune
- **Fondations (2)** : après la phase 1 ; bloque toutes les histoires
- **Histoire 6 (3)** : après les fondations ; à finir avant tout affichage du classement
- **Histoire 1 (4)** : après les phases 2 et 3 ; c'est le MVP
- **Histoires 2, 7, 3, 4, 5, 8 (5 à 10)** : après la phase 4 ; elles modifient les mêmes fichiers (`brisage-ranking.ts`, `RankingTab.tsx`), donc à faire l'une après l'autre dans l'ordre des phases
- **Finitions (11)** : après les histoires voulues
- **Phase optionnelle** : après la phase 11, sur confirmation

### Dépendances entre tâches

- T005 dépend de T002 et T004
- T012 dépend de T005 et T011
- T013 dépend de T008 et T012
- T017 dépend de T016 ; T020 de T019 ; T023 de T022 ; T026 de T025 ; T031 de T030

### Opportunités de parallélisme

- Fondations : T002, T003 et T004 sont indépendants (fichiers différents)
- Dans chaque histoire, les tests marqués [P] (fichier de test à part) peuvent s'écrire ensemble, avant l'implémentation
- T014 (styles) peut avancer pendant T011 à T013

### Exemple de parallélisme : fondations

```text
T002 listStoredCoefficients dans src/persistence/brisage-coefficients.ts
T003 types et fraîcheur dans src/domain/brisage-ranking.ts
T004 dates des prix de runes dans src/features/brisage/useRunePrices.ts
```

---

## Stratégie de mise en œuvre

### MVP d'abord (histoires 6 et 1)

1. Phase 1 puis phase 2 (fondations)
2. Phase 3 (accès) puis phase 4 (classement de base)
3. **S'arrêter et valider** avec les scénarios 1 à 3 du guide de validation
4. Ajouter ensuite le tri (US2), puis le coefficient inconnu (US7), la fraîcheur (US3), les filtres (US4), le clic (US5) et l'exo (US8)

### Livraison progressive

Chaque histoire ajoute de la valeur sans casser la précédente ; la fusion dans `master` n'est proposée qu'après la phase 11 (`/speckit-git-merge`).

## Notes

- Aucune formule de brisage n'est réécrite : tout passe par `analyzeBrisage` et `analyzeFocusAdvice`
- Le classement ne lit pas les malus ni le coût de craft (voir la spec)
- Valider chaque point de contrôle avant de passer à la suite
