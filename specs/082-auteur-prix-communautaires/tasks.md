---

description: "Liste des tâches : Auteur et date des prix communautaires"
---

# Tâches : Auteur et date des prix communautaires

**Entrée** : documents de `specs/082-auteur-prix-communautaires/`

**Prérequis** : plan.md, spec.md, research.md, data-model.md, contracts/price-author-api.md

**Tests** : inclus — la constitution (principe II) exige des tests pour les règles modifiées (résolution de l'auteur, confidentialité, suppression) et la non-régression des prix calculés.

**Organisation** : par parcours utilisateur (US1 à US4) ; chaque parcours se teste seul une fois la phase 2 terminée.

## Format : `[ID] [P?] [Story] Description`

- **[P]** : parallélisable (fichiers différents, sans dépendance en cours)
- **[Story]** : US1 à US4, comme dans spec.md

## Conventions de chemins

Projet web existant : site dans `src/`, Worker dans `worker/`, tests dans `tests/unit` et `tests/integration`. Les tests du Worker utilisent la base simulée de `tests/support/fm-worker.ts`, qui charge `worker/schema.sql`.

---

## Phase 1 : Préparation

- [X] T001 Lister les endroits qui affichent une date de prix communautaire : `rg "formatRelativeTime" src` et `rg "latestContributionAt|contributedAt" src` ; vérifier pour chacun si le prix vient du groupe (à compléter par l'auteur) ou du carnet local (à laisser tel quel) ; noter la liste en commentaire de PR (pas de fichier)

---

## Phase 2 : Fondations (bloque tous les parcours)

**But** : colonne d'auteur, lecture optionnelle de la session, transport du pseudo dans les résumés de prix.

- [X] T002 Créer la migration `worker/migrations/0031_add_price_author.sql` : `ALTER TABLE community_price_contributions ADD COLUMN author_discord_user_id TEXT;` et `CREATE INDEX IF NOT EXISTS idx_community_price_contributions_author ON community_price_contributions (author_discord_user_id, created_at);` — même colonne et même index dans `worker/schema.sql` (colonne ajoutée en dernier dans la table, comme l'`ADD COLUMN` la place) ; ajouter le script `worker:db:migrate-price-author` dans `package.json` sur le modèle de `worker:db:migrate-site-login`
- [X] T003 [P] Dans `worker/src/cors.ts` : ajouter `X-Fm-Session` à `Access-Control-Allow-Headers`
- [X] T004 [P] Dans `worker/src/fm/http.ts` : ajouter `optionalViewer(request, db): Promise<string | undefined>` — lit l'en-tête `X-Fm-Session`, renvoie l'identifiant Discord d'une session non expirée (même requête que `requireSession`), `undefined` sinon ; ne lève jamais d'exception (une erreur de base donne `undefined`, FR-012)
- [X] T005 Dans `worker/src/contribution.ts` : `Contribution` gagne `authorDiscordUserId?: string` ; `contributionInsert` écrit `author_discord_user_id` (`NULL` quand absent) dans le même `INSERT` ; `parseContributionPayload` reste inchangé (le client ne peut pas se déclarer auteur)
- [X] T006 Dans `worker/src/median.ts` : `ContributionRow` gagne `authorName?: string | null` ; `ContributionsSummary` gagne `latestAuthor?: string | null`, pris sur la dernière ligne (`latest`) ; aucun autre calcul ne change (médiane, bornes, `lastContributionAt`)
- [X] T007 [P] Tests unitaires `tests/unit/median-author.test.ts` : le résumé de lignes avec auteur donne `latestAuthor` de la dernière ligne ; une dernière ligne sans auteur donne `null`/absent même si une ligne plus ancienne en a un ; la médiane, `sampleSize` et `lastContributionAt` sont identiques avec et sans auteurs (FR-015)
- [X] T008 [P] Tests unitaires `tests/unit/price-author-schema.test.ts` : la table simulée contient `author_discord_user_id` ; une contribution insérée par `contributionInsert` avec `authorDiscordUserId` le stocke, sans lui stocke `NULL`

**Point de contrôle** : colonne, lecture de session et résumé prêts ; aucun comportement visible ne change encore.

---

## Phase 3 : Parcours 1 — Voir qui a mis un prix à jour, et quand (P1)

**But** : « par Pseudo · il y a 2 h » sur les prix, de la saisie à l'affichage.

**Test indépendant** : un utilisateur connecté saisit un prix ; un autre navigateur voit « par Pseudo · … » ; un visiteur anonyme saisit ensuite un prix et le nom disparaît.

### Worker

- [X] T009 [US1] Dans `worker/src/index.ts` : `handlePostContribution` lit `optionalViewer(request, env.DB)` et passe l'identifiant à `insertContribution` comme `authorDiscordUserId` ; la réponse reste `201 { id }` quel que soit le jeton
- [X] T010 [US1] Dans `worker/src/contribution.ts` : `fetchCurrentMedian` et `fetchCurrentMedians` joignent `fm_players` (`LEFT JOIN fm_players p ON p.discord_user_id = c.author_discord_user_id`) et renseignent `ContributionRow.authorName` avec `CASE WHEN p.is_private = 0 THEN p.display_name END` ; la requête garde ses filtres, son ordre (`created_at, rowid`) et ses alias de colonnes
- [X] T011 [US1] Dans `worker/src/index.ts` (`communityPriceResponse`) et `worker/src/contribution.ts` (`communityPricesResponse`) : ajouter `latestAuthor` à la réponse quand il existe ; `withExternalPrice` (`worker/src/external-price.ts`) ne doit pas laisser un auteur sur un prix remplacé par Huzounet — retirer `latestAuthor` dans ce cas
- [X] T012 [US1] Dans `worker/src/latest.ts` : `readLatestContribution`, `LATEST_ITEM_PRICES_SQL` / `readLatestItemPrices` et `latestPriceResponse` / `itemPricesResponse` renvoient `author` (même règle que T010 : pseudo si profil public) ; un prix Huzounet plus récent remplace la dernière saisie sans auteur ; `readLatestItemContributions` (référence des valeurs aberrantes) reste inchangée
- [X] T013 [US1] Dans `worker/src/fm/purchases.ts` : `insertContribution` reçoit `authorDiscordUserId` du joueur seulement quand `origin === 'capture'` (import d'une capture sur le site) ; l'origine `bot` reste sans auteur ; dans `worker/src/fm/captures.ts` (`sharedPrice`, correction d'une ligne), même règle avec `capture.discord_user_id` quand `capture.origin === 'capture'` ; ne pas modifier `worker/src/sniffer.ts`
- [X] T014 [P] [US1] Tests Worker `tests/unit/price-author-api.test.ts` : POST avec jeton valide → `author_discord_user_id` rempli ; sans en-tête, avec jeton inconnu et avec jeton expiré → 201 et `NULL` ; `GET /community-price` et `GET /community-prices` donnent `latestAuthor` d'un profil public, rien pour un profil privé, rien pour une dernière saisie anonyme (même si une saisie plus ancienne avait un auteur) ; `GET /latest-price` et `GET /item-prices` donnent `author` selon la même règle ; aucune réponse ne contient l'identifiant Discord (rechercher la valeur de l'identifiant dans le JSON sérialisé) ; une contribution de l'origine `bot` n'a pas d'auteur, une de l'origine `capture` en a un ; une base qui échoue à la lecture de la session (requête qui lève une erreur) enregistre quand même le prix, sans auteur

### Site

- [X] T015 [P] [US1] Dans `src/domain/types.ts`, `src/services/community-price-api.ts` : `CommunityPrice` gagne `latestAuthor?: string | null` ; `LatestItemPrice` et `SharedItemPriceEntry` gagnent `author?: string | null` ; les validateurs (`isCommunityPriceRow`, `isLatestItemPriceRow`, `isSharedItemPriceEntry`) acceptent le champ absent, `null` ou une chaîne et ignorent un autre type
- [X] T016 [US1] Dans `src/services/community-price-api.ts` (`submitCommunityPrice`) : ajouter l'en-tête `X-Fm-Session` avec `readFmSessionToken()` (`src/persistence/fm-session-token.ts`) uniquement quand un jeton existe ; sans jeton la requête reste exactement celle d'aujourd'hui
- [X] T017 [P] [US1] Créer `src/domain/price-update.ts` : `formatPriceUpdate(date: string, author?: string | null, now?: Date): string` — « par <auteur> · <durée> » ou « <durée> » ; durée = « il y a quelques instants » sous une minute, sinon `formatRelativeTime` (`src/domain/time.ts`, inchangé) ; `formatPriceUpdateTitle(date)` = date complète lisible en français pour l'attribut `title`
- [X] T018 [P] [US1] Tests `tests/unit/price-update.test.ts` : avec auteur, sans auteur, `null`, moins d'une minute, quelques heures, plusieurs jours, date invalide (renvoie « date inconnue », rien d'inventé)
- [X] T019 [US1] Créer `src/components/PriceUpdateNote.tsx` : rend `<small>` avec le texte de `formatPriceUpdate` et le `title` de la date complète, que le même élément rend aussi accessible au toucher (`tabIndex={0}` et `aria-label` avec la date complète) ; accepte un préfixe (« Dernière mise à jour : ») et une classe d'âge (`market-date…`) pour remplacer le texte actuel sans changer la mise en page
- [X] T020 [US1] (fait : lignes de ressource, prix HDV d'un objet ; reporté : Runes, page Prix, Familier) Brancher la mention (liste de T001) : `src/features/comparison/ResourcePriceInput.tsx` et `src/features/comparison/CommunityResourcePriceRow.tsx` (passer `author={latestAuthor}` seulement quand la date affichée est `latestContributionAt` du groupe, sinon rien) ; `src/features/comparison/MarketPriceInput.tsx` et son appelant d'un prix d'objet partagé (`useSharedItemPrice`) ; `src/features/brisage/RunePriceInput.tsx` (info-bulle) via `useRunePrices` ; `src/features/prices/PricesPage.tsx` (colonne de date) ; `src/features/pets/PetFoodPodium.tsx` et `src/features/pets/FamilierPage.tsx` (ligne de prix avec date) si le prix vient du groupe ; garder les classes d'âge existantes (`classifyPriceAge`)
- [X] T021 [P] [US1] Tests d'interface `tests/integration/price-update-note.test.tsx` : `ResourcePriceInput` / `MarketPriceInput` affichent « par Cyril · il y a 2 h » avec auteur et « il y a 2 h » sans ; le nom n'est pas affiché quand la date montrée est celle du carnet local et non celle du groupe ; la date complète est en `title`
- [X] T022 [P] [US1] Tests `tests/unit/community-price-api.test.ts` (existant, à compléter) : `submitCommunityPrice` envoie `X-Fm-Session` avec un jeton en mémoire et pas sans ; les lectures acceptent `latestAuthor` / `author` absents, `null`, ou chaîne

**Point de contrôle** : un utilisateur connecté signe ses prix, l'affichage est correct partout, un visiteur reste anonyme.

---

## Phase 4 : Parcours 2 — Rester anonyme avec un profil privé (P1)

**But** : le réglage « privé » masque le nom, et il se règle depuis Mon profil.

**Test indépendant** : passer en privé masque le pseudo sur ses prix ; repasser en public le fait réapparaître.

- [X] T023 [US2] Dans `worker/src/fm/me.ts` (`patchMe`, `deleteMe`) : appeler `clearReadCache()` (`worker/src/read-cache.ts`) après une mise à jour de `isPrivate` et après la suppression, pour que le nom apparaisse ou disparaisse sans attendre le cache de 60 s de l'isolat
- [X] T024 [US2] Dans `src/features/account/ProfilPage.tsx` : ajouter une section « Confidentialité » (interrupteur public / privé via `useAuth().updateMe({ isPrivate })`) avec la phrase : « Ce réglage décide si ton pseudo est affiché sur les prix que tu saisis. En privé, seul le moment de la mise à jour reste visible. » ; état d'enregistrement et message d'échec comme pour les autres réglages
- [X] T025 [P] [US2] Tests Worker (dans `tests/unit/price-author-api.test.ts`) : après `PATCH /fm/me {isPrivate: true}`, la lecture du même prix n'a plus d'auteur, y compris pour un prix saisi avant le changement ; après `{isPrivate: false}`, l'auteur revient
- [X] T026 [P] [US2] Tests d'interface `tests/integration/profil-page.test.tsx` (existant, à compléter) : la section Confidentialité s'affiche avec sa phrase, le bouton appelle `updateFmMe({ isPrivate })` et reflète l'état, un échec affiche le message

**Point de contrôle** : la confidentialité s'applique à tous les prix, passés et futurs.

---

## Phase 5 : Parcours 3 — Mes contributions dans Mon profil (P2)

**But** : retrouver ses prix saisis.

**Test indépendant** : après trois saisies, Mon profil indique 3 contributions et les liste du plus récent au plus ancien.

- [X] T027 [US3] Créer `worker/src/fm/contributions.ts` : `getMyContributions(db, discordUserId)` renvoie `{ total, recent }` (total = prix de l'utilisateur dans la période de conservation `retentionCutoff()`, 20 plus récents en `resourceId`, `kind`, `serverId`, `amountKamas`, `createdAt`, `ORDER BY created_at DESC, rowid DESC`) ; ajouter la route `GET /fm/me/contributions` dans `worker/src/fm/router.ts`, ouverte aux non-membres comme `/fm/me`, `401` sans session
- [X] T028 [P] [US3] Tests Worker `tests/unit/fm-contributions.test.ts` : total et ordre, limite de 20, ignore les prix des autres, ignore les prix hors conservation, `401` sans session, accessible à une session non membre, utilisateur sans prix → `{ total: 0, recent: [] }`, un profil privé voit ses prix
- [X] T029 [P] [US3] Dans `src/domain/forgemagie.ts` et `src/services/fm-api.ts` : types `FmContributions` / `FmContribution` et `getFmContributions()` (`GET /fm/me/contributions`, validation de la forme, statuts comme `getFmMe`) ; compléter `tests/unit/fm-api.test.ts`
- [X] T030 [US3] Créer `src/features/account/ContributionsSection.tsx` : titre « Mes contributions », nombre de prix, liste (nom de la ressource ou de l'objet via le catalogue local — repli sur l'identifiant, jamais un nom inventé —, serveur, montant en kamas, date relative), état vide « Tu n'as encore saisi aucun prix. », état d'erreur discret ; l'afficher dans `ProfilPage.tsx` pour un utilisateur connecté seulement
- [X] T031 [P] [US3] Tests d'interface `tests/integration/profil-page.test.tsx` : liste et nombre affichés, état vide, visiteur sans section, identifiant inconnu affiché tel quel, échec de lecture sans casser la page

**Point de contrôle** : l'utilisateur retrouve ses prix.

---

## Phase 6 : Parcours 4 — Suppression du profil (P2)

**But** : les prix restent, redeviennent anonymes.

**Test indépendant** : saisir un prix, supprimer le profil, le prix reste sans nom.

- [X] T032 [US4] Dans `worker/src/fm/me.ts` (`deleteMe`) : ajouter à la transaction `db.prepare('UPDATE community_price_contributions SET author_discord_user_id = NULL WHERE author_discord_user_id = ?')` avant la suppression de `fm_players`
- [X] T033 [P] [US4] Tests Worker `tests/unit/fm-me.test.ts` (existant, à compléter) : après `DELETE /fm/me`, les prix de la personne existent encore avec `author_discord_user_id` à `NULL` et la lecture ne donne plus d'auteur ; se reconnecter avec le même compte ne les rattache pas ; les prix des autres sont intacts

**Point de contrôle** : plus aucun lien entre la personne et ses prix.

---

## Phase 7 : Finition

- [X] T034 [P] Mettre à jour `README.md` et `worker/README.md` : auteur des prix, en-tête `X-Fm-Session`, route `/fm/me/contributions`, ordre de déploiement (migration `worker:db:migrate-price-author`, Worker, site)
- [X] T035 Vérifier la non-régression (SC-007) : `npm run test` complet, `tsc -b`, `tsc -p worker --noEmit`, `eslint` sur les fichiers touchés ; les tests existants de prix (médiane, valeurs aberrantes, derniers prix) passent sans modification
- [ ] T036 Vérifier à l'écran (aperçu) : la mention sur une ligne de ressource, sur un prix d'objet et sur la page Prix, à 375 px sans débordement horizontal, clair et sombre (SC-008) ; vérifier le scénario connecté / anonyme / privé du quickstart avec une session simulée
- [X] T037 Mettre à jour la case cochée de chaque tâche terminée dans ce fichier et lancer le sous-agent `relecteur` sur les changements avant de proposer la fusion

---

## Dépendances et ordre

- Phase 1 sans dépendance. Phase 2 bloque les phases 3 à 6. T002 avant T005 à T008 (schéma) ; T004 avant T009.
- **US1** (phase 3) est le cœur : T009 à T013 (Worker) avant T014 ; T015 à T019 (site) avant T020 ; T020 avant T021.
- **US2** dépend de US1 (le nom doit exister pour être masqué) ; T023 avant T025 ; T024 avant T026.
- **US3** dépend de T002 seulement (colonne) et de la route de session : peut avancer en parallèle d'US2 une fois la phase 2 faite ; T027 avant T028 et T029 ; T029 avant T030.
- **US4** dépend de T002 ; T032 avant T033.
- Phase 7 en dernier.

## Exécution parallèle

- Phase 2 : T003, T004 en parallèle ; T007 et T008 en parallèle après T005 et T006.
- Phase 3 : après T009 à T013, T014 pendant que T015, T017 et T018 avancent côté site.
- Après la phase 2, US3 (T027 à T031) et US4 (T032, T033) peuvent avancer pendant US1.

## Stratégie

1. **MVP** : phases 1 à 3 (US1) — les prix des utilisateurs connectés sont signés et l'affichage est correct. Le profil privé (US2) suit immédiatement, avant toute mise en ligne, pour que personne ne soit affiché sans pouvoir se masquer.
2. Puis US3, US4 et la finition.
3. Mise en ligne : migration `0031`, Worker, site (voir quickstart.md).
