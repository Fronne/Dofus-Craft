# Tasks: Bulle « donjons sans drop » de Le-Lanceurdeglyphe

**Input**: Documents de conception de `specs/013-dungeon-drop-counter/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/dungeon-counter-api.md, quickstart.md

**Tests**: inclus (plan.md) : logique du Worker, service client, bulle.

**Organization**: tâches groupées par user story. Générées juste avant `/speckit-implement`
(l'étape `/speckit-tasks` n'avait pas été lancée).

## Format: `[ID] [P?] [Story] Description`

- **[P]** : parallélisable (fichiers différents, pas de dépendance sur une tâche inachevée)
- **[Story]** : US1 (voir le compteur), US2 (mettre à jour le compteur)

---

## Phase 1: Setup

- [X] T001 [P] Extraire le portrait `Head_10` (Féca homme) de `Content/Picto/UI/class_assets_.bundle` du client Dofus 3 (UnityPy, `FALLBACK_UNITY_VERSION = '6000.3.16f1'`) vers `public/dungeon-counter/feca.png` (research.md §1).
- [X] T002 [P] Télécharger l'icône DofusDB `https://api.dofusdb.fr/img/items/50733.png` (« Parangon de puissance », id 21189) vers `public/dungeon-counter/parangon.png`, et noter les deux sources dans `public/dungeon-counter/SOURCES.md` (principe I).
- [X] T003 [P] Créer `worker/migrations/0004_add_dungeon_counter.sql` : table `dungeon_drop_counter` (`id INTEGER PRIMARY KEY CHECK (id = 1)`, `count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0)`, `updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`) et `INSERT OR IGNORE` de la ligne `id = 1` ; ajouter la même définition à `worker/schema.sql` ; ajouter le script `worker:db:migrate-dungeon-counter` dans `package.json`.

---

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T004 [P] Écrire `tests/unit/dungeon-counter-worker.test.ts` : `readCounter` renvoie `{ count, updatedAt }` ; `applyCounterAction` : `increment` +1, `decrement` jamais sous 0, `reset` → 0, action inconnue refusée ; `isOwnerCode` : vrai seulement pour le code exact, faux si le secret n'est pas configuré ou si le code est vide (base simulée comme dans `tests/unit/community-price-retention.test.ts`).
- [X] T005 Créer `worker/src/dungeon-counter.ts` : types structurels pour la base (comme `worker/src/retention.ts`), `readCounter(db)`, `applyCounterAction(db, action)` (`UPDATE ... SET count = count + 1` / `MAX(count - 1, 0)` / `0`, `updated_at` à l'heure du serveur, puis relecture), `isCounterAction(value)`, `isOwnerCode(provided, secret)` en temps constant (comparaison octet par octet sur toute la longueur).
- [X] T006 Brancher dans `worker/src/index.ts` : `GET /dungeon-counter` public (avant le contrôle de la clé d'app, comme `GET /community-price`) ; `POST /dungeon-counter` après le contrôle de la clé : limiteur `OWNER_CODE_LIMITER` par IP (429), code `X-Owner-Code` vérifié (401 sinon, et 401 si `COUNTER_OWNER_CODE` absent), action validée (400), `verify` renvoie la valeur sans modifier ; ajouter `X-Owner-Code` aux en-têtes CORS autorisés ; déclarer `COUNTER_OWNER_CODE?` et `OWNER_CODE_LIMITER?` dans `Env` ; ajouter le limiteur (`limit = 10`, `period = 60`) dans `worker/wrangler.toml`.
- [X] T007 [P] Écrire `tests/unit/dungeon-counter-api.test.ts` puis créer `src/services/dungeon-counter-api.ts` : `getDungeonCounter()` → `{ status: 'ok', counter } | { status: 'unavailable' }` (ne lève jamais) ; `updateDungeonCounter(action, code)` → `{ status: 'ok', counter } | { status: 'refused' } | { status: 'unavailable' }` (401 → `refused`) ; en-têtes `Authorization` et `X-Owner-Code`.
- [X] T008 [P] Créer `src/persistence/dungeon-counter-storage.ts` : `readCachedCounter` / `writeCachedCounter` (clé `craftcheck-dungeon-counter`), `getOwnerCode` / `setOwnerCode` / `clearOwnerCode` (clé `craftcheck-counter-owner-code`), tout dans `try/catch`.

---

## Phase 3: User Story 1 - Voir le compteur (Priority: P1) 🎯 MVP

**Goal**: portrait fixe sur toutes les pages, bulle avec pseudo, nombre et ressource.

**Independent Test**: ouvrir/fermer la bulle depuis n'importe quelle page (quickstart.md 1, 2, 5, 7).

- [X] T009 [US1] Écrire `tests/integration/dungeon-counter-bubble.test.tsx` (US1) : le bouton « Compteur de donjons de Le-Lanceurdeglyphe » est présent, bulle fermée par défaut ; clic → pseudo, nombre renvoyé par le service, « Parangon de puissance » ; Échap, clic extérieur et « Fermer » referment ; service indisponible avec valeur en cache → valeur + « peut-être daté » ; sans cache → « Compteur indisponible ».
- [X] T010 [US1] Créer `src/features/dungeon-counter/DungeonCounterBubble.tsx` : bouton rond (portrait `/dungeon-counter/feca.png`, `aria-label`, `aria-expanded`) ; panneau `role="dialog"` non modal ancré au-dessus ; lecture à l'arrivée et à chaque ouverture, écriture du cache ; fermeture par Échap, clic extérieur (`pointerdown` sur le document) et bouton « Fermer ».
- [X] T011 [US1] Rendre `<DungeonCounterBubble />` dans `src/app/AppShell.tsx` (donc absent de l'écran de choix du serveur).
- [X] T012 [US1] Styles dans `src/styles/global.css` : bouton rond 56 px fixe en bas à droite (16 px), `z-index: 9` ; sous 960 px, `bottom: calc(86px + env(safe-area-inset-bottom, 0px))` ; panneau `width: min(300px, calc(100vw - 32px))`, ancré au-dessus à droite ; couleurs par variables du thème. Retouches « Nouveau » (coins, ombre) dans `src/styles/design-modern.css`, préfixées.

**Checkpoint**: tout le groupe voit le compteur.

---

## Phase 4: User Story 2 - Mettre à jour le compteur (Priority: P1)

**Goal**: le propriétaire s'identifie une fois puis utilise « +1 », « −1 », « Drop ! ».

**Independent Test**: quickstart.md 3, 4, 6.

- [X] T013 [US2] Compléter `tests/integration/dungeon-counter-bubble.test.tsx` (US2) : « Modifier » → champ code ; code refusé → « Code refusé. », pas de commandes, rien mémorisé ; code accepté → code mémorisé, commandes visibles ; « +1 » affiche la valeur renvoyée ; code mémorisé puis refusé → oublié, commandes masquées ; échec réseau → valeur inchangée et message.
- [X] T014 [US2] Compléter `DungeonCounterBubble.tsx` : action discrète « Modifier » (masquée si identifié), formulaire code + « Valider » (appel `verify`), commandes « +1 », « −1 », « Drop ! » désactivées pendant l'envoi, messages « Code refusé. » et « Modification impossible pour le moment. ».

**Checkpoint**: compteur modifiable par le seul propriétaire.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T015 Lancer `npm test`, `npm run typecheck`, `npm run lint`, typecheck du Worker (`npx tsc --noEmit -p worker`) et `npx playwright test --project=desktop` (API coupée : bulle « indisponible », aucun test bloqué).
- [X] T016 Vérifier en navigateur (serveur de dev, API interceptée) : ordinateur et 375 px, « Classique » et « Nouveau », clair et sombre ; bouton jamais sur la barre d'onglets ; bulle lisible.

---

## Révision 2026-09-24 : chiffre en dur

À la demande du propriétaire (« pas de code, le compteur sera en dur dans le code ») :

- Retirés : T003 (migration et table), T004–T006 (logique et routes du Worker, limiteur), T007–T008
  (service et stockage local), T013–T014 (identification et commandes). Le Worker est revenu à
  son état commité.
- Ajouté : `src/features/dungeon-counter/dungeon-counter.ts` avec la constante
  `DUNGEONS_WITHOUT_DROP` ; la bulle la lit directement. Tests de la bulle réécrits (affichage,
  fermeture, singulier/pluriel, aucune commande de modification).

## Révision 2 : deuxième compteur (Nicomoux)

- [X] T017 Extraire `Head_100` (Sadida homme, DofusDB `/breeds/10`) vers `public/dungeon-counter/sadida.png` et télécharger l'icône 1235 de l'Amulette du Strigide (DofusDB 14094) vers `public/dungeon-counter/amulette-strigide.png` ; compléter `SOURCES.md`.
- [X] T018 Remplacer les constantes par une liste `PLAYER_COUNTERS` dans `src/features/dungeon-counter/dungeon-counter.ts` (joueur, classe, portrait, chiffre, libellés singulier/pluriel, objet visé et son icône) ; `DungeonCounterBubble` prend un compteur en paramètre ; `PlayerCounters` rend la pile.
- [X] T019 Pile verticale en bas à droite dans `src/styles/global.css` ; tests de la bulle adaptés (deux compteurs, une seule bulle ouverte à la fois).
- Nicomoux passé à 157, puis de Sadida à Pandawa (portrait `Head_120`, DofusDB `/breeds/12`) à la
  demande du propriétaire. La bulle ouverte a `z-index: 1` pour passer
  au-dessus des portraits empilés au-dessus d'elle (vu sur mobile).

## Notes d'implémentation

- Ajout non prévu : un petit badge avec le nombre sur le portrait, pour voir le compteur sans
  ouvrir la bulle.
- Le pseudo reste sur une ligne (`white-space: nowrap`) : il se coupait au trait d'union.
- Portrait réduit à 48 px sous 960 px de large.
- Vérifié en navigateur avec l'API interceptée : ordinateur et 375 px, « Classique » et
  « Nouveau », clair et sombre, identification puis « +1 », aucun défilement horizontal.
- La bulle apparaît aussi en « Classique » : les captures de référence de specs/012 diffèrent
  désormais sur toutes les pages (élément ajouté, attendu).
- Pas encore déployé : seul le front est concerné.

## Dependencies & Execution Order

- Phase 1 et 2 avant les stories ; T005 avant T006 ; T004 avant T005 (tests d'abord).
- US1 avant US2 (même composant).
- Déploiement (hors tâches, sur accord) : migration D1, secret `COUNTER_OWNER_CODE`, Worker, front.

### Parallel Opportunities

- T001, T002, T003 ; T004, T007, T008.

## Implementation Strategy

MVP = Phases 1–3 (affichage). Puis US2 (modification), puis vérifications.
