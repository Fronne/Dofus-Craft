# Tasks: Bons plans HDV

**Input**: documents de conception dans `specs/078-bons-plans-hdv/` (plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md)

**Tests**: demandés par la constitution (principe II) pour toute règle de calcul : ils sont écrits avant le code qu'ils vérifient.

**Format**: `- [ ] T### [P?] [US?] Description avec chemin de fichier` — `[P]` = parallélisable (fichiers différents, aucune dépendance en cours).

## Phase 1: Setup

- [ ] T001 Relever, dans une capture de `D:\Documents\Projet Claude Code\SniffSniffSquared\sniffer\testdata`, un exemple réel d'offre d'équipement (listing_id, effect, value) et le copier en jeu d'essai dans `tests/fixtures/hdv-listings.json` ; vérifier que `effect` est un `effectId` présent dans `src/data/brisage-items.json` et que `listing_id` est stable entre deux captures (research R7) ; noter le résultat en tête de `specs/078-bons-plans-hdv/research.md`.

- [ ] T001b Si T001 montre que `listing_id` n'est pas stable : remplacer l'identifiant d'annonce par une empreinte (objet, prix, jet) dans `worker/src/listings.ts` et `contracts/sniffer-copies.md` ; sinon noter « sans objet » ici.

## Phase 2: Foundational (bloque toutes les histoires)

- [ ] T002 Créer `worker/migrations/0028_add_hdv_listings.sql` et ajouter la table `hdv_listings` à `worker/schema.sql` : colonnes et index exacts de `data-model.md` (clé primaire `(server_id, listing_id)`, index `(server_id, last_seen_at)` et `(server_id, item_id)`) ; ajouter la colonne `copies_written INTEGER NOT NULL DEFAULT 0 CHECK (copies_written >= 0)` à `sniffer_daily_usage`.
- [ ] T003 [P] Créer `src/domain/good-deals.ts` : types `Listing`, `JetLine`, `DealVerdict` et constantes `EXO_FACTOR = 1.5`, `NEIGHBOUR_RANGE = 0.25`, `MIN_NEIGHBOURS = 3`, `DEFAULT_THRESHOLD_PERCENT = 25`, `MAX_AGE_HOURS = 24` (research R2–R4), sans logique encore.
- [ ] T004 [P] Écrire `tests/unit/good-deals.test.ts` (échoue d'abord) : exemplaire à –30 % marqué ; –10 % non marqué ; seuil exact marqué ; jet supérieur au même prix marqué ; moins de 3 voisins non marqué ; un prix aberrant parmi les voisins ne change pas le verdict (médiane) ; voisins limités au même ensemble d'exos ; stat inconnue ignorée et comptée ; liste vide sans erreur.
- [ ] T005 Implémenter dans `src/domain/good-deals.ts` : `jetQuality` (somme `valeur × poids(effectId) × (exo ? EXO_FACTOR : 1)`, poids via `brisageStat` de `src/domain/brisage.ts`, exo = `effectId` absent des effets de l'objet dans `src/data/brisage-items.json`) et `evaluateListings(listings, itemEffects, thresholdPercent)` selon research R4 ; faire passer T004.
- [ ] T006 [P] Écrire `tests/unit/sniffer-copies.test.ts` (échoue d'abord) selon `contracts/sniffer-copies.md` : copies valides écrites ; observation sans `copies` ne touche pas aux annonces ; copies refusées sur une ressource (`invalid`) ; `listingId` en double, prix ≤ 0, `stats` vide ou à plus de 40 lignes, plus de 50 copies → `invalid` ; un même exemplaire vu par deux clés donne une seule annonce ; les copies comptent dans leur propre plafond `COPY_DAILY_LIMIT = 20000` (429 `daily_limit`, `kind: copies`), pas dans celui des observations.
- [ ] T007 Créer `worker/src/listings.ts` : `parseCopies` (règles exactes du tableau de validation du contrat) et `listingStatements` (upsert des annonces de l'objet, suppression de celles absentes du lot, `first_seen_at` conservé).
- [ ] T008 Modifier `worker/src/sniffer.ts` : `parseObservation` accepte `copies` pour un équipement uniquement, `snifferBatchResponse` ajoute `listingStatements` au lot atomique et compte les copies dans `copies_written` (plafond `COPY_DAILY_LIMIT = 20000`, lot refusé en entier au-delà) ; `lots` et le prix le moins cher restent inchangés (FR-014) ; faire passer T006.
- [ ] T009 [P] Écrire `tests/unit/bons-plans-route.test.ts` (échoue d'abord) selon `contracts/bons-plans-api.md` : annonces de plus de 24 h absentes ; serveur inconnu → 400 `unknown_server` ; objets à moins de 4 annonces fraîches exclus ; au plus 5 000 annonces, les plus récentes d'abord ; table vide → `listings: []`.
- [ ] T010 Ajouter dans `worker/src/listings.ts` la lecture `readFreshListings` et la route `GET /bons-plans` dans `worker/src/index.ts` (cache 60 s, seuil provisoire de 25 jusqu'à T023) ; faire passer T009.
- [ ] T011 Créer `src/features/good-deals/useGoodDeals.ts` : lit `GET /bons-plans?server=` pour le serveur actif (`useActiveServer`), charge les effets des objets, appelle `evaluateListings` ; états chargement / erreur / vide ; aucune valeur inventée si la lecture échoue.

**Point de contrôle** : `npx vitest run tests/unit/good-deals.test.ts tests/unit/sniffer-copies.test.ts tests/unit/bons-plans-route.test.ts` passe.

## Phase 3: User Story 1 – Voir qu'une annonce est un bon plan (P1) 🎯 MVP

**Objectif** : la pastille « Bon plan » sur les annonces d'un équipement. **Test indépendant** : objet d'essai à annonces connues → seule l'annonce nettement moins chère porte la pastille.

- [ ] T012 [P] [US1] Écrire `tests/integration/good-deal-badge.test.tsx` (échoue d'abord) : pastille avec économie en kamas et en pourcentage sur l'annonce à –30 % ; aucune pastille à –10 % ni sans comparables ; âge de l'annonce affiché.
- [ ] T013 [P] [US1] Créer `src/features/good-deals/GoodDealBadge.tsx` : pastille « Bon plan » (style du site, voir `DESIGN.md`), économie, prix de référence et nombre de comparables en info-bulle accessible au clavier (constitution III).
- [ ] T013b [US1] Dans `GoodDealBadge.tsx`, indiquer « jet partiellement lu » quand `unknownLines > 0` (stats inconnues ignorées).
- [ ] T014 [US1] Montrer d'abord à l'utilisateur une proposition visuelle de la liste « Annonces à l'HDV » (maquette dans le canevas), attendre son accord, puis créer `src/features/comparison/ListingsSection.tsx` : liste des annonces fraîches de l'objet (jets, exo repéré, prix, âge) avec `GoodDealBadge`, insérée dans `src/features/comparison/ComparisonResult.tsx` pour un équipement seulement.
- [ ] T015 [US1] Adapter le client de relevé dans `D:\Documents\Projet Claude Code\SniffSniffSquared\sniffer\core\src\upload.rs` (dépôt séparé, livré à part) : joindre `copies` à chaque observation d'équipement à partir des offres décodées (`listing_id`, premier palier du `ladder`, lignes `effect`/`value`), au plus 50 copies, `lots` inchangé ; `cargo test` ; ne pas relever `SNIFFER_MIN_VERSION`.

## Phase 4: User Story 2 – Parcourir tous les bons plans (P1)

**Objectif** : la page « Bons plans ». **Test indépendant** : plusieurs bons plans sur deux serveurs → la page n'affiche que ceux du serveur choisi, triés et filtrés comme demandé.

- [ ] T016 [P] [US2] Écrire `tests/integration/bons-plans-page.test.tsx` (échoue d'abord) : liste triée par économie en kamas puis en pourcentage ; filtre « exo uniquement » ; filtre par jet ; changement de serveur ; message clair quand il n'y a aucun bon plan ou aucun relevé récent.
- [ ] T017 [US2] Créer `src/features/good-deals/BonsPlansPage.tsx` : liste des bons plans avec objet (lien vers sa fiche), jets, exo, prix, prix de référence, économie, âge ; tri kamas / pourcentage ; filtres exo, jet, serveur ; chargement progressif comme `HdvPage` (`useLoadMoreOnScroll`).
- [ ] T018 [US2] Ajouter la route et l'entrée de navigation dans `src/app/AppShell.tsx` (`lazyPage`, `ROUTES`), montrée seulement si la page est activée (réglage de page, comme `hdvPage`) ; ajouter `bonsPlansPage` (clé `bons_plans_page`, défaut activée) dans `src/domain/site-settings.ts` (`SITE_PAGES`), créer la migration `worker/migrations/0029_add_bons_plans_setting.sql` sur le modèle de `0025`, la lecture `worker/src/site-settings.ts` et le test `tests/unit/site-settings-domain.test.ts`.

## Phase 5: User Story 3 – Des bons plans toujours frais (P2)

**Objectif** : aucune annonce de plus de 24 h ni vendue. **Test indépendant** : annonce vue il y a 25 h absente partout ; revue à l'instant, elle revient.

- [ ] T019 [P] [US3] Écrire `tests/unit/listings-retention.test.ts` (échoue d'abord) : la purge supprime les annonces dont `last_seen_at` a plus de 24 h et garde les autres ; un nouveau lot d'un objet supprime ses annonces absentes (scénario 3).
- [ ] T020 [US3] Ajouter la purge des annonces de plus de 24 h à `worker/src/retention.ts` et l'appeler depuis le déclencheur planifié existant ; vérifier la suppression par lot de T007 ; faire passer T019.
- [ ] T021 [US3] Filtrer côté site les annonces de plus de 24 h dans `src/features/good-deals/useGoodDeals.ts` (horloge du client, pour qu'une page restée ouverte se rafraîchisse) et afficher l'âge « vu il y a … » dans `ListingsSection.tsx` et `BonsPlansPage.tsx`.

## Phase 6: User Story 4 – Régler le seuil (P3)

**Objectif** : seuil réglable, 25 % par défaut. **Test indépendant** : passer à 40 % retire les annonces entre 25 et 40 %.

- [ ] T022 [P] [US4] Écrire `tests/unit/good-deal-threshold.test.ts` (échoue d'abord) : défaut 25 ; valeur lue de `site_settings` (`good_deal_threshold`) ; hors bornes 5–90 refusée à l'écriture ; valeur illisible → 25.
- [ ] T023 [US4] Ajouter la lecture du seuil dans `worker/src/listings.ts` (lecture séparée de `readSiteSettings`, qui ne gère que `'0'/'1'`) et la renvoyer dans `GET /bons-plans` (`thresholdPercent`) ; remplacer la valeur par défaut provisoire de T010.
- [ ] T024 [US4] Ajouter le champ « Seuil bon plan (%) » dans `admin/Dashboard.tsx` et son écriture validée (entier 5–90) dans le fichier de `admin-worker/src/` qui écrit déjà les réglages du site (le repérer d'abord) ; test dans `tests/integration/admin-dashboard.test.tsx`.
- [ ] T025 [US4] Utiliser `thresholdPercent` de la réponse dans `useGoodDeals.ts` à la place de `DEFAULT_THRESHOLD_PERCENT`.

## Phase 7: Polish & transversal

- [x] T026 [P] Documenter dans `README.md` la fonctionnalité, la fraîcheur de 24 h, la dépendance au client de relevé et la limite des poids de stats (principe I, section Project Constraints).
- [x] T027 [P] Mettre à jour `specs/056-sniffer-batch-prices/contracts/sniffer-api.md` avec un renvoi vers `contracts/sniffer-copies.md`.
- [ ] T028 Exécuter `npm run test` complet et le parcours de `quickstart.md` ; donner l'URL du serveur de développement pour les essais manuels.
- [ ] T029 Lancer le sous-agent `relecteur` sur les changements et corriger les points graves.

## Dépendances et ordre

- Phase 1 → Phase 2 → histoires. T003 avant T004/T005 ; T007 avant T008 ; T010 avant T011.
- **US1 et US2** dépendent de la Phase 2 seule et sont indépendantes entre elles ; T015 (client) peut avancer en parallèle de tout, mais aucune annonce réelle n'arrive avant sa livraison.
- **US3** dépend de T007 et de la Phase 2. **US4** dépend de T010 (T023 remplace sa valeur provisoire).
- Le client (T015) est livré à part : le site fonctionne avec des annonces d'essai en attendant.

## Parallélisme

- Phase 2 : T003, T004, T006, T009, T011 (fichiers distincts).
- US1 : T012 et T013 ensemble. US2 : T016 pendant que T017 s'écrit à partir de T011.
- US3 (T019) et US4 (T022) peuvent démarrer dès la fin de la Phase 2.

## Stratégie

- **MVP** : Phases 1–2 + US1 (T001–T015), vérifiable avec des annonces d'essai puis avec le client modifié.
- **Ensuite** : US2 (la page), puis US3 (fraîcheur), puis US4 (seuil réglable). Le tout reste utilisable après chaque histoire.
