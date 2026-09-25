---

description: "Task list for 016-shared-item-prices"
---

# Tasks: Prix HDV des objets partagé en Mode communautaire

**Input**: Design documents from `/specs/016-shared-item-prices/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: inclus — la constitution (principe II) impose des tests pour toute règle de calcul
(dernier prix, seuil de 50 %, purge), et `contracts/community-api.md` liste les cas obligatoires.

**Organization**: tâches groupées par user story (spec.md).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallélisable (fichiers différents, pas de dépendance sur une tâche inachevée)
- **[Story]**: US1 à US4 (spec.md)

## Path Conventions

Application `src/`, Worker `worker/src/`, tests communs `tests/` (plan.md, Structure Decision).

---

## Phase 1: Setup

- [X] T001 Vérifier que la base est verte avant de commencer : `npx tsc -b --noEmit`, `npx vitest run`, `npx eslint src tests` et `npx tsc -p worker --noEmit` depuis la racine (aucune modification de fichier)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: lecture du dernier prix côté Worker et côté application, requise par toutes les stories

- [X] T002 Créer worker/migrations/0005_add_contribution_kind.sql (`ALTER TABLE community_price_contributions ADD COLUMN kind TEXT NOT NULL DEFAULT 'resource' CHECK (kind IN ('resource', 'item'));`, avec un commentaire), ajouter la même colonne dans worker/schema.sql (et la requête du modérateur par type dans son commentaire : `kind = 'resource' AND deviation_percent > 25`, `kind = 'item' AND deviation_percent > 50`), et le script `worker:db:migrate-contribution-kind` dans package.json sur le modèle des migrations existantes
- [X] T003 [P] Écrire tests/unit/community-latest-price.test.ts (section lecture) pour `readLatestContribution(db, itemId, serverId)` de worker/src/latest.ts : renvoie la ligne `kind = 'item'` la plus récente parmi plusieurs (`{ amountKamas, contributedAt }`), ignore les lignes `'resource'` du même identifiant, `undefined` sans ligne, et une contribution de plus de 90 jours reste lue (« sans filtre d'ancienneté ») — base simulée comme dans tests/unit/community-price-retention.test.ts, ou `node:sqlite` en mémoire avec `worker/schema.sql` si disponible
- [X] T004 Créer worker/src/latest.ts : `readLatestContribution(db, itemId, serverId)` avec `SELECT amount_kamas, created_at FROM community_price_contributions WHERE resource_id = ? AND server_id = ? AND kind = 'item' ORDER BY created_at DESC LIMIT 1`, type de base structurel comme worker/src/retention.ts ; faire passer T003
- [X] T005 Ajouter la route `GET /latest-price?itemId=&serverId=` dans worker/src/index.ts, lecture anonyme placée avant le contrôle de clé (comme `GET /community-price`) : 400 `{ "error": "itemId and serverId are required" }` si un paramètre manque, 404 `null` sans contribution, 200 `{ itemId, serverId, amountKamas, contributedAt }` (contracts/community-api.md)
- [X] T006 [P] Ajouter `getLatestItemPrice(itemId, serverId): Promise<LatestItemPriceLookup>` dans src/services/community-price-api.ts (`{ status: 'found'; price: { itemId, serverId, amountKamas, contributedAt } } | { status: 'not-found' } | { status: 'unavailable' }`, ne lève jamais d'exception, même validation de forme que `isCommunityPriceRow`), et le couvrir dans tests/unit/community-price-api.test.ts (200, 404, erreur réseau, corps invalide)
- [X] T007 Créer src/features/comparison/useSharedItemPrice.ts sur le modèle de src/features/comparison/useCommunityPrice.ts : état `loading | found { price, stale } | not-found | unavailable`, cache `localStorage['craftcheck-latest-item-price:<serverId>:<itemId>']` (`{ amountKamas, contributedAt }`) lu au montage (affiché `stale`) et écrit à chaque lecture réussie, rafraîchissement toutes les 5 min, et une fonction exportée `lookupLatestItemPrice(itemId, serverId)` (réseau puis cache) réutilisable hors React ; `commit` est ajouté en US2
- [X] T008 [P] Couvrir le hook dans tests/unit/use-shared-item-price.test.tsx (API simulée) : cache affiché immédiatement puis remplacé par le réseau, `not-found`, service injoignable → dernier prix en cache (`stale`), cache absent + injoignable → `unavailable`

**Checkpoint**: le dernier prix d'un objet est lisible de bout en bout ; aucune interface modifiée.

---

## Phase 3: User Story 1 — Voir le dernier prix HDV partagé (Priority: P1) 🎯 MVP

**Goal**: en Mode communautaire, la fiche pré-remplit « Prix HDV » avec le dernier prix partagé, verrouillé, avec sa date.

**Independent Test**: contribution à 6 000 pour les Dagues sur Mikhal → le champ affiche 6 000 verrouillé avec sa date, et la comparaison l'utilise (quickstart.md, scénario 1, étape 3).

### Tests for User Story 1

- [X] T009 [US1] Écrire tests/integration/shared-item-price.test.tsx (catalogue et API communautaire simulés, Mode communautaire) : dernier prix 6 000 → `getByLabelText('Prix HDV')` vaut « 6 000 », en lecture seule, bouton « Modifier ce prix », « Dernière mise à jour » affichée, aucun « contribution » affiché ; aucun prix partagé → champ vide et modifiable ; en Mode personnel → comportement actuel (prix local, pas de verrou ni de date)

### Implementation for User Story 1

- [X] T010 [US1] Étendre src/features/comparison/MarketPriceInput.tsx avec des props facultatives `lockWhenFilled`, `updatedAt` et `onCommit` reprenant la logique de src/features/comparison/ResourcePriceInput.tsx : verrou quand il y a une valeur et qu'aucune édition n'est en cours, bouton « Modifier ce prix » (crayon), validation seulement après une vraie édition (garde `editing`, cf. correctif du double-clic), retour à la valeur précédente si `onCommit` renvoie `'rejected'`, et « Dernière mise à jour : <formatRelativeTime> » sous le champ avec la classe d'ancienneté de specs/008 (`classifyPriceAge`) ; sans ces props, comportement strictement actuel
- [X] T011 [US1] Dans src/features/search/RecherchePage.tsx, en Mode communautaire uniquement : `useSharedItemPrice(selectedItem.id, serverId)` fournit la valeur du champ (état `found` → `String(amountKamas)`), `updatedAt = contributedAt`, `lockWhenFilled` ; `market` (et donc la comparaison) suit ce prix ; en Mode personnel, lecture/écriture `pinnedItemPrices` inchangées
- [X] T012 [P] [US1] Styles de la date sous le champ HDV dans la ligne « Prix HDV » du bloc de comparaison (src/styles/global.css), alignés sur les dates des lignes de ressources, lisibles en clair/sombre et dans les deux designs

**Checkpoint**: T009 vert ; le prix partagé s'affiche.

---

## Phase 4: User Story 2 — Partager un prix HDV relevé en jeu (Priority: P1)

**Goal**: une saisie validée est partagée et devient le dernier prix.

**Independent Test**: saisir 7 000 et quitter le champ → contribution envoyée, date « maintenant » ; ouvrir le crayon puis quitter sans modifier → rien envoyé (quickstart.md, scénario 1).

### Tests for User Story 2

- [X] T013 [US2] Compléter tests/integration/shared-item-price.test.tsx : champ vide, saisie 7 000 + perte de focus → `submitCommunityPrice` appelé avec `('208', 'mikhal', 7000, 'item')` et date « maintenant » ; crayon puis perte de focus sans modification → aucun envoi ; service injoignable à l'envoi → la valeur reste affichée et utilisée par la comparaison, sans message bloquant ; en Mode personnel, aucune saisie n'appelle `submitCommunityPrice`
- [X] T014 [P] [US2] Compléter tests/unit/community-latest-price.test.ts (section écriture) : POST avec `kind: 'item'` → trace calculée par rapport à la dernière contribution (`median_at_submission_kamas` = dernier prix, `deviation_percent` = écart), `null` pour une première contribution ; `kind` invalide → 400 ; POST sans `kind` → comportement actuel (écart par rapport à la médiane)

### Implementation for User Story 2

- [X] T015 [US2] Dans worker/src/index.ts : accepter `kind` facultatif (`'item'` ou absent, sinon 400) dans `isContributionPayload` ; enregistrer `kind` dans l'INSERT (`'item'` ou `'resource'`) ; pour `kind: 'item'`, calculer la trace avec `readLatestContribution` (worker/src/latest.ts) au lieu de `fetchCurrentMedian`, via une variante de `resolveOutlierFields` dans worker/src/outlier.ts qui prend le dernier montant ; faire passer T014
- [X] T016 [US2] Ajouter un paramètre facultatif `kind?: 'item'` à `submitCommunityPrice` dans src/services/community-price-api.ts (envoyé seulement s'il est fourni) et un `commit(amount)` à src/features/comparison/useSharedItemPrice.ts : envoi avec `kind: 'item'`, puis relecture du dernier prix en cas de succès ; en cas d'échec, renvoie `undefined` sans toucher à la valeur affichée (comme `useCommunityPrice`)
- [X] T017 [US2] Brancher dans src/features/search/RecherchePage.tsx l'`onCommit` du champ HDV (Mode communautaire) sur `commit` ; la valeur saisie reste affichée localement pendant l'envoi et après un échec

**Checkpoint**: T013 et T014 verts ; partage de bout en bout.

---

## Phase 5: User Story 3 — Confirmer un prix très différent (Priority: P2)

**Goal**: au-delà de 50 % d'écart avec le dernier prix affiché, confirmation avant partage.

**Independent Test**: dernier prix 10 000 → saisir 100 000 : confirmation « Dernier prix : 10 000 kamas » ; Annuler → retour à 10 000, rien partagé ; 14 000 (40 %) → pas de confirmation (quickstart.md, scénario 2).

### Tests for User Story 3

- [X] T018 [P] [US3] Tests unitaires du seuil dans tests/unit/outlier-threshold.test.ts (créer si absent) : `ITEM_OUTLIER_THRESHOLD_PERCENT = 50`, écarts de 49 %, 50 % (pas de confirmation : « confirmation si écart > 50 ») et 51 % (confirmation), dernier prix à 0 et saisie différente de 0 → confirmation
- [X] T019 [US3] Compléter tests/integration/shared-item-price.test.tsx : dernier prix 10 000, saisie 100 000 → fenêtre avec « Dernier prix : 10 000 kamas », le prix saisi et l'écart ; Annuler → champ à 10 000, aucun envoi, date inchangée ; Confirmer → envoi de 100 000 ; saisie 14 000 → aucun dialogue ; aucun prix partagé → aucun dialogue

### Implementation for User Story 3

- [X] T020 [P] [US3] Ajouter `ITEM_OUTLIER_THRESHOLD_PERCENT = 50` et `needsItemPriceConfirmation(entered, last)` dans src/domain/outlier-threshold.ts (règle de data-model.md : « confirmation si `dernier` existe, `dernier > 0` et `écart > 50` ; si `dernier = 0`, tout prix différent de 0 demande confirmation »)
- [X] T021 [US3] Ajouter à src/features/comparison/OutlierConfirmDialog.tsx un libellé facultatif pour la valeur de référence (« Dernier prix » pour les objets, « Prix habituel » par défaut, inchangé pour les ressources)
- [X] T022 [US3] Dans le gestionnaire `onCommit` du champ HDV (src/features/search/RecherchePage.tsx) : si `needsItemPriceConfirmation(saisi, dernier prix affiché)`, afficher la confirmation (`useOutlierConfirm`, libellé « Dernier prix ») ; Annuler → renvoyer `'rejected'` (le champ revient à la valeur précédente, rien n'est envoyé) ; Confirmer → `commit`

**Checkpoint**: T018 et T019 verts.

---

## Phase 6: User Story 4 — La page Suivis affiche le prix partagé (Priority: P2)

**Goal**: « HDV : … » des cartes = dernier prix partagé en Mode communautaire.

**Independent Test**: objet suivi, dernier prix partagé 8 000 → carte « HDV : 8 000 kamas » sans ouvrir la fiche (quickstart.md, scénario 3).

### Tests for User Story 4

- [X] T023 [US4] Écrire tests/integration/epingles-shared-item-price.test.tsx : Mode communautaire, dernier prix 8 000 → carte « HDV : 8 000 kamas » et comparaison de la carte basée dessus ; Mode personnel → prix local inchangé

### Implementation for User Story 4

- [X] T024 [US4] Dans src/features/catalogue/EpinglesPage.tsx, en Mode communautaire : prix HDV de chaque carte via `lookupLatestItemPrice` (src/features/comparison/useSharedItemPrice.ts) au lieu de `pinnedItemPrices.getMany` ; conserver l'affichage immédiat puis la mise à jour ; Mode personnel inchangé

**Checkpoint**: T023 vert.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T025 Purge : écrire d'abord le test dans tests/unit/community-price-retention.test.ts (garde la plus récente ancienne d'un couple `'item'`, supprime les autres anciennes et toute ancienne ligne `'resource'`, même la plus récente de sa ressource, ne touche pas aux récentes — sur `node:sqlite` en mémoire avec `worker/schema.sql`), puis modifier `purgeExpiredContributions` dans worker/src/retention.ts pour supprimer `created_at < cutoff` **sauf** la ligne la plus récente de chaque couple parmi les lignes `kind = 'item'`
- [X] T026 [P] Consigner les révisions dans les specs existantes : specs/004-community-price-sharing/spec.md (FR-013 : la contribution la plus récente de chaque objet/serveur est conservée au-delà de 90 jours ; le prix HDV d'un objet est partagé, cf. spec 016) et specs/003-community-price-mode/spec.md (le prix HDV d'un objet n'est plus exclu du partage en Mode communautaire)
- [X] T027 [P] Mettre à jour la description du Mode communautaire dans README.md (prix HDV des objets partagé, dernier prix affiché)
- [X] T028 Dérouler les scénarios de specs/016-shared-item-prices/quickstart.md avec le Worker local et deux profils de navigateur, captures en thème sombre, ordinateur et mobile
- [X] T029 Validation finale : `npx tsc -b --noEmit`, `npx tsc -p worker --noEmit`, `npx vitest run`, `npx eslint src tests`, `npm run build`

---

## Dependencies & Execution Order

- **Setup (T001)** → **Foundational (T002–T008)** → stories. La migration T002 est à appliquer en production **avant** tout déploiement du Worker.
- **US1 (T009–T012)** : après la phase 2.
- **US2 (T013–T017)** : après US1 (le champ verrouillé et son `onCommit` viennent de T010) ; T014/T015 (Worker) peuvent démarrer dès T004.
- **US3 (T018–T022)** : T018/T020/T021 dès la phase 2 ; T022 après T017.
- **US4 (T023–T024)** : après la phase 2 (utilise `lookupLatestItemPrice` de T007).
- **Polish (T025–T029)** : T025 est indépendant (Worker) et peut se faire à tout moment ; doit être **déployé avec** US1, sinon un vieux dernier prix disparaîtrait à la purge suivante.

### Parallel Opportunities

- Phase 2 : T003 (tests Worker) ∥ T006 (client API) ; T008 ∥ T005.
- T014/T015 (Worker, écriture) en parallèle du travail d'interface US1.
- T018, T020, T021 en parallèle entre eux.
- US4 en parallèle de US2/US3.
- T026, T027 en parallèle.

---

## Parallel Example: Phase 2

```text
Task: "T003 Tests de lecture du dernier prix dans tests/unit/community-latest-price.test.ts"
Task: "T006 getLatestItemPrice dans src/services/community-price-api.ts"
```

## Parallel Example: User Story 3

```text
Task: "T018 Tests du seuil dans tests/unit/outlier-threshold.test.ts"
Task: "T020 ITEM_OUTLIER_THRESHOLD_PERCENT dans src/domain/outlier-threshold.ts"
Task: "T021 Libellé « Dernier prix » dans src/features/comparison/OutlierConfirmDialog.tsx"
```

---

## Implementation Strategy

### MVP First

Phase 2 + US1 + US2 : voir et partager le dernier prix (US1 seule n'a rien à afficher tant que
personne ne partage). **Déployer le Worker avant l'application**, avec la purge modifiée (T025).

### Incremental Delivery

1. Worker (T003–T005, T014–T015, T025) → déploiement Worker.
2. US1 + US2 → partage visible sur la fiche.
3. US3 → confirmation d'écart.
4. US4 → page Suivis alignée.

---

## Notes

- Aucune migration D1 : même table, mêmes colonnes (les colonnes de trace gardent leur nom).
- Le Mode personnel ne doit pas changer : chaque story le vérifie dans ses tests.
