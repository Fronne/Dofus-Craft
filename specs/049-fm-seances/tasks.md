# Tasks: Page Forgemagie en séances de FM

**Input**: Design documents from `/specs/049-fm-seances/` (plan.md, spec.md, research.md,
contracts/fm-seances-client.md, quickstart.md)

**Tests**: demandés (constitution, principe II ; SC-005).

**Rappels** : Node 22 ; le Worker n'est pas modifié ; aucun déploiement ; libellés du site en ligne.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Foundational (types, règles, client de l'API)

- [ ] T001 Dans src/domain/forgemagie.ts : ajouter les types `FmSeanceState`, `FmSeanceItem`, `FmSeance`, `FmCaptureLine`, `FmIgnoredLine`, `FmSeanceCapture`, `FmSeanceSession`, `FmSeanceRequest`, `FmSeanceDetail`, `FmGroupPlayer`, `FmGroupSeance` (formes du contrat) ; `corrected?` et `readNames?` sur `FmItemSummary` ; `guildName?` sur `FmMe` ; `channelId?` sur les sessions de `FmProfile` ; les règles pures `SEANCE_STATE_LABELS`, `groupTabLabel(me)` (nom du groupe, à défaut « Joueurs »), `isRuneName(name)`, `mergeIgnoredLines(lines)`, `spendingBySeance(sessions)` (une ligne par séance, la plus récente d'abord, lien seulement si `canOpen`) et `correctionValues(quantity, total)` (entiers d'au moins 1, sinon rien) ; retirer les types que plus rien n'utilise.
- [ ] T002 [P] Compléter tests/unit/forgemagie-domain.test.ts pour chacune de ces règles (cas normal et bornes : nom de groupe vide, « Rune » sans espace, lignes ignorées en double, sessions d'un même salon, session sans salon, quantité 0 / vide / non numérique).
- [ ] T003 Réécrire src/services/fm-api.ts selon contracts/fm-seances-client.md (fonctions, gardes de forme, valeurs par défaut, `fmLoginUrl` avec `return_to` en local) ; retirer les fonctions du modèle précédent.
- [ ] T004 Réécrire tests/unit/fm-api.test.ts : pour chaque fonction la méthode, la route et le corps ; valeurs par défaut d'une API plus ancienne ; 401 (jeton effacé), 404, 409 avec code, 500, réponse de forme inattendue, panne réseau ; `fmLoginUrl` en local et ailleurs.

**Checkpoint** : `npx vitest run tests/unit/forgemagie-domain.test.ts tests/unit/fm-api.test.ts` passe.

---

## Phase 2: User Story 1 - Retrouver ses séances de FM (P1)

- [ ] T005 [P] [US1] Dans src/components/Icon.tsx : ajouter `hammer` et `user`.
- [ ] T006 [P] [US1] Créer src/features/forgemagie/FmItemIcon.tsx et src/features/forgemagie/PurchasesTable.tsx (tableau Objet / Quantité / Total / Prix moyen, icône de rune, « lu : … », « corrigé », ligne de total si plus d'un objet).
- [ ] T007 [US1] Créer src/features/forgemagie/SeancesTab.tsx (`SeanceStatus`, `SeanceCard`, liste, états chargement / indisponible / vide, relecture toutes les 10 s si une séance est en cours et la page visible).
- [ ] T008 [US1] Créer src/features/forgemagie/SeanceSessions.tsx (sessions repliables « Session du … », état Discord, captures repliables, lignes non comptées, notes) — la correction arrive en US3.
- [ ] T009 [US1] Créer src/features/forgemagie/SeanceDetail.tsx : retour, titre et état, dates, quatre tuiles, « Achats », sessions ; états chargement / introuvable / indisponible ; relecture automatique (research §5).
- [ ] T010 [US1] Réécrire src/features/forgemagie/ForgemagiePage.tsx (texte d'en-tête, écran de connexion et sa note, trois onglets à icône) et adapter src/features/forgemagie/useFmAuth.ts (le serveur du profil suit celui du site).
- [ ] T011 [US1] Dans tests/integration/forgemagie-page.test.tsx (réécrit) : connexion (anonyme, erreur, retour de Discord, déconnexion, aucune route appelée depuis une autre page), liste des séances, liste vide, détail avec tuiles, achats, sessions, captures et lignes non comptées, retour à la liste, serveur du profil aligné.

---

## Phase 3: User Story 2 - Créer et conduire une séance de FM (P1)

- [ ] T012 [P] [US2] Créer src/features/forgemagie/SeanceItemSearch.tsx (mes objets puis catalogue ; libellé en paramètre) à la place de SessionItemSearch.tsx et EquipmentPicker.tsx.
- [ ] T013 [US2] Créer src/features/forgemagie/StartSeance.tsx (nom ≤ 30 caractères, objet facultatif, attente du bot toutes les 3 s pendant 2 min au plus, messages de limite, d'échec et d'attente dépassée).
- [ ] T014 [US2] Créer src/features/forgemagie/SeanceItem.tsx (objet affiché, « Changer », « Renommer » ≤ 40 caractères, « Retirer », choix initial).
- [ ] T015 [US2] Dans src/features/forgemagie/SeanceDetail.tsx : actions « Relancer », « Arrêter la session », « Reprendre », « Archiver la séance » (dialogue de confirmation), « Rouvrir » ; message d'une demande Discord ; messages d'erreur par code.
- [ ] T016 [US2] Adapter src/features/forgemagie/CaptureImport.tsx : session reçue en paramètre, plus de choix de session ; note « pas une rune : non comptée dans la séance » ; message de fin avec le nombre de lignes non comptées ; messages « session arrêtée » et « serveur non enregistré ».
- [ ] T017 [US2] Compléter tests/integration/forgemagie-page.test.tsx : création (attente puis ouverture, limite, attente dépassée), chaque action et son appel, archivage confirmé, import dans la session ouverte, choix / renommage / retrait de l'objet.

---

## Phase 4: User Story 3 - Corriger une capture mal lue (P2)

- [ ] T018 [US3] Créer src/features/forgemagie/CaptureCorrection.tsx et le brancher dans SeanceSessions.tsx (« Corriger », valeur lue, « Rétablir la valeur lue », validation, seules les lignes modifiées envoyées, message du prix non partagé, « corrigée »).
- [ ] T019 [US3] Compléter tests/integration/forgemagie-page.test.tsx : correction envoyée, rien envoyé si rien ne change, bouton inactif sur valeur invalide, rétablissement, message du prix non partagé, échec.

---

## Phase 5: User Story 4 - Voir ce que la FM a coûté au groupe (P2)

- [ ] T020 [US4] Créer src/features/forgemagie/PlayersTab.tsx (note d'en-tête, joueurs, « toi », profil privé, séances dépliables, états vide / indisponible).
- [ ] T021 [US4] Compléter tests/integration/forgemagie-page.test.tsx : libellé de l'onglet (nom du groupe, « Joueurs »), liste, joueur sans séance, dépliage, états.

---

## Phase 6: User Story 5 - Régler son profil (P3)

- [ ] T022 [US5] Réécrire src/features/forgemagie/ProfileTab.tsx : serveur du site en lecture, visibilité et son texte, « Par séance de FM » (via `spendingBySeance`), « Captures importées hors séance », « Par objet acheté », suppression.
- [ ] T023 [US5] Compléter tests/integration/forgemagie-page.test.tsx : réglage de visibilité, dépenses par séance (lien vers la séance), suppression confirmée.

---

## Phase 7: Polish

- [ ] T024 Supprimer SessionsTab.tsx, SessionDetail.tsx, SessionCaptures.tsx, StartSession.tsx, SessionItemSearch.tsx, EquipmentPicker.tsx, FmItemsSection.tsx, FmItemRecap.tsx, FmChannelsSection.tsx de src/features/forgemagie/ et vérifier qu'aucune fonction retirée du client n'est encore importée.
- [ ] T025 Aligner la section Forgemagie de src/styles/global.css sur la feuille du site en ligne (règles ajoutées, règles inutilisées retirées).
- [ ] T026 Lancer `npx tsc -b --noEmit`, `npx eslint src tests --quiet`, `npx vitest run` ; noter le total dans specs/049-fm-seances/quickstart.md.
- [ ] T027 Vérifier à l'écran l'état non connecté (quickstart, étapes 1 et 2).
- [ ] T028 Ajouter une note de révision en tête de specs/027 à 031 renvoyant à specs/049 ; mettre à jour README.md (page Forgemagie).

## Dependencies

Phase 1 avant tout ; US1 avant US2 (détail) et US3 (captures) ; US4 et US5 indépendantes après T010 ;
Polish en dernier. Le fichier de test de page est commun : ses tâches se suivent.
