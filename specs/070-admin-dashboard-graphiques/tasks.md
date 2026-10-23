# Tâches : Graphiques sur le tableau de bord de l'administration

**Entrée** : documents de `specs/070-admin-dashboard-graphiques/` (plan, spec, research, data-model, contracts, quickstart)

**Tests** : inclus (la constitution exige des tests pour les règles de calcul ; les tests d'intégration du tableau de bord doivent être adaptés).

## Format : `[ID] [P?] [Story] Description`

- **[P]** : parallélisable (fichiers différents, sans dépendance)
- **[Story]** : parcours de la spec (US1 Cloudflare, US2 clés du mois, US3 évolution et mois précédents, US4 autres cartes)

## Phase 1 : Fondations (bloquant)

**Objectif** : structure de carte « lien + visuel », composants de graphique partagés, simulation des nouvelles lectures dans les tests existants.

- [X] T001 [P] Créer `admin/DashboardVisual.tsx` : enveloppe d'un visuel de carte, props `state: 'loading' | 'ok' | 'empty' | 'unavailable'` et `children` ; affiche « Chargement… », « Indisponible » ou « Aucune donnée » (texte, pas la couleur seule) à la place des enfants sauf en `ok` ; rien d'inventé
- [X] T002 [P] Créer `admin/BarList.tsx` : barres horizontales en SVG (`viewBox`, largeur 100 %) pour une liste `{ label, value, note? }[]` ; barre proportionnelle à la plus grande valeur, valeur exacte en texte à côté, `<title>` au survol avec le libellé complet, libellé tronqué à l'affichage ; un `<details>` « Voir les valeurs » avec un `<table>` (libellé, valeur, note) pour clavier et lecteur d'écran ; au-delà de `maxItems` (8 par défaut), regroupe le reste en « Autres (N) » en gardant le total exact
- [X] T003 [P] Créer `admin/DailyColumns.tsx` : colonnes par jour en SVG pour `{ date, parts: Record<string, number> }[]` avec une légende ; empilées par clé de `parts` ; chaque série distincte par motif de remplissage ET par couleur (`<pattern>`), jour sans valeur tracé à 0, jours à venir non tracés ; `<title>` par colonne (date + valeurs exactes) ; `<details>` « Voir les valeurs jour par jour » avec tableau jour × série ; aucune dépendance de graphique
- [X] T004 Ajouter dans `admin/admin.css` les styles `.dashboard-visual`, `.chart-figure`, `.chart-legend`, `.chart-table`, `.bar-list`, `.daily-columns` (variables existantes `--border`, `--inner-bg`, `--accent-bright`, `--warning`, `--danger`, `--success`, `--text-muted`), lisibles en thème clair et sombre, sans défilement horizontal de la page à 375 px, focus visible sur les `<summary>` (dépend de T001, T002, T003 pour les noms de classes)
- [X] T005 Modifier `admin/Dashboard.tsx` : chaque carte devient un `<li>` contenant le lien existant (`<a href="#id">` avec titre h2 et résumé, nom accessible inchangé = titre + résumé) puis un bloc frère `<div className="dashboard-visual">` (vide pour l'instant) ; le `<details>` ne doit jamais être dans le lien ; conserver les résumés et les six cartes à l'identique (dépend de T001)
- [X] T006 [P] Dans `tests/integration/admin-dashboard.test.tsx` et `tests/integration/admin-page.test.tsx`, ajouter au `vi.hoisted` de `adminApi` les futures lectures `getTodayUsage`, `getKeyContributions`, `getActivity` avec une valeur par défaut `{ status: 'unavailable' }` pour que les tests existants continuent de passer ; vérifier que tout passe encore

**Point de contrôle** : `npm test` passe, le tableau de bord s'affiche comme avant (spec 068 sans régression).

---

## Phase 2 : Parcours 1 - Courbe Cloudflare de la journée en cours (P1) 🎯 MVP

**Objectif** : la carte Cloudflare montre le cumul heure par heure de la journée UTC en cours, avec les franchissements de 80 % et 100 %.

**Test indépendant** : avec des données horaires simulées, la carte contient une courbe de 00:00 UTC à l'heure actuelle dont le dernier point égale le pourcentage de la carte ; sans jeton ou en erreur, la carte dit « indisponible » sans bloquer les autres.

- [ ] T007 [US1] Lever l'inconnue de [research.md](research.md) R1 (étape 1 du [quickstart.md](quickstart.md)) : avec `CLOUDFLARE_API_TOKEN` et `CLOUDFLARE_ACCOUNT_ID`, vérifier par introspection GraphQL que `d1AnalyticsAdaptiveGroups` accepte la dimension `datetimeHour` ; si elle est absente, choisir `datetimeFiveMinutes` ou `datetime` (regroupement par heure dans le code) ou conclure « indisponible » ; consigner le résultat dans `research.md` R1 avant T010
- [X] T008 [P] [US1] Dans `src/domain/cloudflare-usage.ts`, ajouter selon `data-model.md` : types `UsageHour` (`hour` 0 à 23 et les trois métriques, entiers ≥ 0), `TodayUsageResponse` (`{ state: 'ok', date, readAt, hours }` ou `not-configured` / `denied` / `unavailable`), `CumulativeHour`, `ThresholdCrossing` ; fonctions pures `fillTodayHours(now, rows)` (une entrée par heure de 0 à l'heure en cours, heures absentes à 0, heures de même valeur additionnées, heures hors jour ignorées), `cumulativeHours(hours)` (cumul par métrique, pourcentage via `usagePercent`, non plafonné, `partial` vrai pour l'heure en cours), `thresholdCrossings(cumulative)` (première heure où `usageLevel` passe à `warning` puis `over`, rien si jamais atteint), `parseTodayUsageResponse(payload)`
- [X] T009 [P] [US1] Créer `tests/unit/cloudflare-usage-today.test.ts` (partie domaine) : heures manquantes à 0, cumul croissant, 112 % non plafonné, franchissements à 80 % et 100 % (et absents si non atteints), début de journée (00:xx) sans reprise de la veille, `parseTodayUsageResponse` valide et invalide
- [X] T010 [US1] Dans `admin-worker/src/cloudflare-usage.ts`, ajouter la requête `TODAY_QUERY` et `readTodayUsage(env, now, fetchFn)` : mêmes états `not-configured` / `denied` / `unavailable` que `readCloudflareUsage`, requêtes Workers par heure (`workersInvocationsAdaptive`, `datetimeHour`) et D1 par heure selon le résultat de T007, filtre de `00:00:00Z` du jour à `now`, résultat passé par `fillTodayHours` ; jamais le jeton ni le détail brut d'une erreur Cloudflare dans la réponse (dépend de T007, T008)
- [X] T011 [US1] Dans `admin-worker/src/index.ts`, ajouter `GET /api/usage/today` (après `verifyOwner`, toujours 200 avec un `state`, `Cache-Control: no-store`) selon `contracts/admin-dashboard-api.md` (dépend de T010)
- [X] T012 [US1] Compléter `tests/unit/cloudflare-usage-today.test.ts` (partie worker) avec `fetchFn` simulé comme dans `tests/unit/cloudflare-usage.test.ts` : jeton absent (aucune requête envoyée), 401 → `denied`, erreur GraphQL ou réseau → `unavailable`, réponse valide → `hours` complétées ; la route répond 403 à un non-propriétaire et ne renvoie jamais le jeton (dépend de T011)
- [X] T013 [P] [US1] Dans `admin/admin-api.ts`, ajouter `getTodayUsage()` (`GET /usage/today`, lecture via `parseTodayUsageResponse`, résultat invalide → `unavailable`)
- [X] T014 [P] [US1] Créer `admin/DayUsageChart.tsx` : courbes SVG du cumul de la journée pour les trois métriques en % de la limite (axe 0 à max(100, valeurs) comme `UsageChart.tsx`, ligne des 100 %, motifs de trait distincts), repère aux heures de franchissement, dernier point marqué « partiel » avec l'heure de lecture, `<title>` par point (heure UTC + valeur exacte + %), phrases de franchissement en texte (« Écritures D1 : 80 % franchi à 14 h UTC »), `<details>` « Voir les valeurs heure par heure » avec tableau
- [X] T015 [US1] Dans `admin/Dashboard.tsx`, lire `adminApi.getTodayUsage()` à part et rendre `DayUsageChart` dans le visuel de la carte Cloudflare via `DashboardVisual` ; `not-configured` / `denied` / `unavailable` → « Indisponible » (le résumé en pourcentage de la carte reste celui de `getUsage(7)`) ; annule les mises à jour après démontage (dépend de T005, T013, T014)
- [X] T016 [US1] Compléter `tests/integration/admin-dashboard.test.tsx` : la carte Cloudflare contient la courbe avec la phrase de franchissement et le tableau de valeurs ; le dernier point égale le pourcentage du résumé ; source indisponible → « Indisponible » dans la carte seulement, les autres cartes et liens fonctionnent (dépend de T015)

**Point de contrôle** : `npx vitest run tests/unit/cloudflare-usage-today.test.ts tests/integration/admin-dashboard.test.tsx` passe.

---

## Phase 3 : Parcours 2 - Lignes ajoutées par clé sur le mois (P1)

**Objectif** : la carte des clés montre le total du mois et la répartition par clé.

**Test indépendant** : deux clés à 120 et 30 lignes ce mois-ci → total 150, barres Alice 120 et Bob 30 ; une clé révoquée avec des lignes reste comptée et signalée.

- [X] T017 [P] [US2] Créer `admin-worker/src/sniffer-contributions.ts` selon `data-model.md` : `validateMonth(raw, now)` (format `AAAA-MM`, mois 01 à 12, pas dans le futur ; sinon `{ ok: false, error: 'Mois attendu sous la forme 2026-10.', field: 'month' }`) et `readKeyContributions(db, month, now)` lisant `sniffer_daily_usage` jointe à `sniffer_keys` (libellé, `revoked_at`, `rows_written`) sur `day >= 'AAAA-MM-01' AND day < 'mois suivant'` ; renvoie `month`, `months` (mois ayant des données, du plus récent), `total` (somme des `rows`), `keys` (toutes les clés actives, même à 0 ; une clé révoquée seulement si elle a des lignes ce mois-là ; tri par `rows` décroissant puis libellé), `days` (un point par jour du mois jusqu'à aujourd'hui ou fin de mois passé, jours sans ajout à 0) ; ne sélectionne jamais `key_hash`
- [X] T018 [P] [US2] Créer `tests/unit/admin-sniffer-contributions.test.ts` (base simulée comme dans `tests/unit/admin-sniffer-keys.test.ts`) : total et répartition (120 + 30 = 150), clé active sans ligne listée à 0, clé révoquée comptée et `revoked: true`, clé révoquée sans ligne absente, mois vide (`total` 0), mois passé, `validateMonth` (valide, `2026-13`, `26-10`, mois futur), aucun champ `keyHash` / `key_hash` / secret dans la sortie
- [X] T019 [US2] Dans `admin-worker/src/index.ts`, ajouter `GET /api/sniffer/contributions?month=AAAA-MM` (mois facultatif = mois en cours UTC ; 400 `{ error, field: 'month' }` si invalide) selon `contracts/admin-dashboard-api.md`, et exposer `DB` avec les méthodes nécessaires (dépend de T017)
- [X] T020 [P] [US2] Dans `admin/admin-api.ts`, ajouter le type `KeyContributions` (importé du worker comme `SnifferKeyJson`), son garde `isKeyContributions` et `getKeyContributions(month?)`
- [X] T021 [US2] Créer `admin/KeyContributions.tsx` : total « N lignes ajoutées en <mois> (UTC) » (ou « 0 ligne ce mois-ci »), puis `BarList` des clés (valeur = lignes, note « révoquée » en texte pour une clé révoquée), au plus 8 clés puis « Autres (N clés) » ; état vide → « 0 ligne ce mois-ci » sans graphique vide (dépend de T002, T020)
- [X] T022 [US2] Dans `admin/Dashboard.tsx`, lire `adminApi.getKeyContributions()` à part et rendre `KeyContributions` dans le visuel de la carte des clés ; échec → « Indisponible » (dépend de T005, T021)
- [X] T023 [US2] Compléter `tests/integration/admin-dashboard.test.tsx` : total du mois et barres par clé avec valeurs en texte ; clé révoquée signalée ; mois sans ligne → « 0 ligne ce mois-ci » ; lecture en échec → « Indisponible » sans bloquer les autres cartes (dépend de T022)

**Point de contrôle** : `npx vitest run tests/unit/admin-sniffer-contributions.test.ts tests/integration/admin-dashboard.test.tsx` passe.

---

## Phase 4 : Parcours 3 - Évolution jour par jour et mois précédents (P2)

**Objectif** : sur la carte des clés, l'évolution quotidienne du mois et le choix d'un mois précédent.

**Test indépendant** : choisir le mois précédent met à jour total, répartition par clé et évolution quotidienne sans recharger la page.

- [X] T024 [US3] Étendre `admin/KeyContributions.tsx` : `DailyColumns` des lignes par jour du mois (une seule série, jours sans ajout à 0, jours à venir non tracés) et un `<select>` « Mois » alimenté par `months` ; changer le mois relit `adminApi.getKeyContributions(month)` et met à jour total, barres et colonnes ensemble ; mois sans donnée affiché comme vide, pas masqué ; échec de lecture du mois choisi → message « Indisponible » en gardant le sélecteur (dépend de T003, T021)
- [X] T025 [US3] Compléter `tests/integration/admin-dashboard.test.tsx` : la carte montre un point par jour du mois en cours ; choisir un mois précédent met tout à jour sans recharger ; mois vide indiqué comme tel ; le sélecteur est utilisable au clavier (dépend de T024)

**Point de contrôle** : le choix d'un mois fonctionne dans les tests d'intégration.

---

## Phase 5 : Parcours 4 - Un visuel utile sur les autres cartes (P3)

**Objectif** : prix communautaires, visites, correspondances, clés endormies, compteurs, bandeau.

**Test indépendant** : chaque visuel du tableau de la spec s'affiche avec les mêmes valeurs que son texte ; « Pages du site » reste sans visuel ; les cartes « Prix communautaires » et « Visites » ne sont pas des liens.

- [X] T026 [P] [US4] Créer `worker/migrations/0022_add_dashboard_indexes.sql` (rejouable : `CREATE INDEX IF NOT EXISTS idx_community_price_contributions_created_at ON community_price_contributions (created_at, origin)` et `CREATE INDEX IF NOT EXISTS idx_app_visits_day ON app_visits (day)`) avec un commentaire d'en-tête dans le style des autres migrations ; reporter les mêmes index dans `worker/schema.sql` ; ajouter le script `worker:db:migrate-dashboard-indexes` dans `package.json` sur le modèle de `worker:db:migrate-brisage-coefficients`
- [X] T027 [P] [US4] Créer `admin-worker/src/activity.ts` selon `data-model.md` : `readActivity(db, now)` renvoie `days` (30 entrées du plus ancien au plus récent, aujourd'hui compris, `prices: { manual, capture, bot, sniffer }` et `visitors`, jours sans ligne à zéro), `pricesTotal`, `visitorsToday` ; requêtes `SELECT substr(created_at,1,10) AS day, origin, COUNT(*) ... WHERE created_at >= ? GROUP BY day, origin` et `SELECT day, COUNT(*) FROM app_visits WHERE day >= ? GROUP BY day` ; ne sélectionne jamais `device_id` ni `resource_id`
- [X] T028 [P] [US4] Créer `tests/unit/admin-activity.test.ts` : 30 jours complétés à 0, ventilation par origine, total de la période, visiteurs du jour, origine inconnue ignorée sans erreur, aucun `deviceId` / `device_id` / `resourceId` dans la sortie
- [X] T029 [US4] Dans `admin-worker/src/index.ts`, ajouter `GET /api/activity` selon `contracts/admin-dashboard-api.md` ; dans `admin/admin-api.ts`, ajouter le type `Activity`, son garde et `getActivity()` (dépend de T027)
- [X] T030 [P] [US4] Créer `admin/dashboard-insights.ts` selon `data-model.md` (fonctions pures, `now` en paramètre) : `mappingAge(mappings, now)` (correspondance active : `build`, `uploadedAt`, jours, `stale` seulement si strictement plus de 30 jours ; sinon `none`), `keyActivity(keys, now)` (par clé non révoquée : `never` si `lastSeenAt` nul, `dormant` si dernier envoi à plus de 30 jours, sinon `recent`), `counterBars(counters)` (`{ label, count }` triés par `count` décroissant), `bannerRemaining(message, now)` (`none`, `open-ended` sans `endsAt`, `expired`, ou temps restant en jours puis heures)
- [X] T031 [P] [US4] Créer `tests/unit/admin-dashboard-insights.test.ts` : ancienneté à 29, 30 et 31 jours (31 seulement `stale`), aucune correspondance active, clés jamais utilisée / endormie (31 jours) / récente / révoquée ignorée, tri des compteurs, temps restant du bandeau (sans fin, expiré, 3 heures, 5 jours)
- [X] T032 [US4] Dans `admin/dashboard-summary.ts`, ajouter `READ_ONLY_CARDS` (`prix` « Prix communautaires », `visites` « Visites ») distinctes de `SECTIONS` (donc `parseSection` les ignore toujours) et les résumés `summarizePrices(activity)` (« N lignes sur 30 jours ») et `summarizeVisits(activity)` (« N visiteurs aujourd'hui »), « Aucune donnée » si zéro ; compléter `tests/unit/admin-dashboard-summary.test.ts` (dépend de T029)
- [X] T033 [US4] Dans `admin/Dashboard.tsx`, rendre les deux cartes en lecture seule (titre h2 et résumé sans lien, visuel `DailyColumns` : prix empilés par origine avec légende texte, visiteurs par jour) à partir d'une seule lecture `adminApi.getActivity()` ; et ajouter les visuels calculés côté navigateur sur les lectures déjà faites : correspondances (« Publiée il y a N jours », « en retard » en texte si `stale`), clés (pastille texte récente / endormie / jamais utilisée dans la carte des clés), compteurs (`BarList` de `counterBars`), bandeau (`bannerRemaining`) ; « Pages du site » reste sans visuel (dépend de T005, T029, T030, T032)
- [X] T034 [US4] Compléter `tests/integration/admin-dashboard.test.tsx` : cartes « Prix communautaires » et « Visites » présentes, non liens, avec graphique et tableau de valeurs ; correspondance de plus de 30 jours signalée en texte ; clé endormie distinguée ; barres des compteurs ; temps restant du bandeau et « Sans fin programmée » ; « Pages du site » sans visuel ; activité indisponible → les deux cartes « Indisponible » sans bloquer les autres (dépend de T033)

**Point de contrôle** : `npx vitest run` passe en entier.

---

## Phase 6 : Finitions et vérifications transversales

- [X] T035 [P] Vérifier que `tests/unit/no-admin-on-public-site.test.ts` passe toujours (aucune route ni code d'administration côté site public) et que les trois nouvelles routes sont refusées à un non-propriétaire (ajouter le cas 403 dans `tests/unit/admin-access.test.ts` si absent)
- [X] T036 [P] Ajouter en tête de `specs/068-admin-dashboard/contracts/admin-dashboard-ui.md` une note « Complété par la spec 070 : visuels sur les cartes » pointant vers `specs/070-admin-dashboard-graphiques/contracts/admin-dashboard-ui.md`
- [X] T037 Exécuter `npm run typecheck`, `npm run lint` et `npm test` ; corriger tout échec
- [X] T038 Parcourir le [quickstart.md](quickstart.md) section 3 (essai manuel avec `npm run admin:dev`) : courbe Cloudflare, mois des clés, cartes prix / visites, source coupée, téléphone 375 px, thème sombre, non-régression des six sections ; noter tout écart
- [X] T039 Appliquer la migration après relecture (`npm run worker:db:migrate-dashboard-indexes`, `--remote` donc production) et contrôler dans le tableau de bord Cloudflare que les lectures D1 ne bondissent pas à l'ouverture de la page (quickstart section 4) ; à faire avant le déploiement de `npm run admin:deploy`

---

## Dépendances et ordre d'exécution

- **Phase 1** (fondations) avant toutes les autres ; T006 peut se faire en parallèle de T001 à T005.
- **US1** (T007 à T016) : T007 avant T010 ; T008, T009, T013, T014 en parallèle ; T011 puis T012 après T010.
- **US2** (T017 à T023) indépendant de US1 ; seul `Dashboard.tsx` (T005) est partagé : les tâches qui modifient `Dashboard.tsx` (T015, T022, T033) s'enchaînent, pas en parallèle.
- **US3** (T024, T025) dépend de US2 (même composant `KeyContributions`).
- **US4** (T026 à T034) indépendant de US1 à US3 hormis `Dashboard.tsx` et les composants partagés de la phase 1.
- **Finitions** (T035 à T039) en dernier ; T039 avant tout déploiement.

## Exemples d'exécution en parallèle

- Phase 1 : T001, T002, T003 ensemble, puis T004.
- US1 : T008 + T009 + T013 + T014 en parallèle pendant que T007 est mené avec le jeton.
- US2 et US4 : T017 + T018 et T026 + T027 + T028 + T030 + T031 en parallèle (fichiers distincts).

## Stratégie de mise en œuvre

1. **MVP** : Phase 1 puis US1 (courbe Cloudflare de la journée) : c'est l'apport le plus utile, il détecte une coupure à venir.
2. Livrer ensuite US2 (clés du mois), la demande explicite principale, puis US3.
3. US4 en dernier : chaque carte s'ajoute indépendamment ; on peut en retirer une (compteurs, bandeau) sans toucher aux autres.
4. Si T007 conclut qu'aucune dimension horaire n'existe pour D1, ne pas bloquer : la carte Cloudflare garde son pourcentage, la courbe affiche « Indisponible », et la décision est consignée dans `research.md` R1.
