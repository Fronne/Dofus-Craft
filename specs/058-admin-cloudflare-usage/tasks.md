# Tasks : utilisation Cloudflare dans l'administration

**Input** : documents de `specs/058-admin-cloudflare-usage/` (plan, spec, research, data-model,
contracts/admin-usage-api.md, quickstart)

**Tests** : demandés (vitest) : domaine pur, module Worker avec `fetch` injecté, route avec Access
simulé, page avec `adminApi` simulé.

## Phase 1 : Setup

- [x] T001 Ajouter `../src/domain/cloudflare-usage.ts` à `include` dans `admin-worker/tsconfig.json`

## Phase 2 : Foundational — domaine pur

- [x] T002 Écrire `src/domain/cloudflare-usage.ts` : `UsageMetric`, `USAGE_LIMITS`, `USAGE_LABELS`, `UsageDay`, `UsageLevel`, `UsageResponse`, `usagePercent`, `usageLevel` (seuil 80 %), `usageDates(days, now)`, `fillUsageDays(days, now, rows)` (data-model.md)
- [x] T003 [P] Tests `tests/unit/cloudflare-usage.test.ts` (partie domaine) : pourcentage arrondi et non plafonné (0, 50 %, 112 %) ; niveaux aux bornes 79,9 % / 80 % / 99,9 % / 100 % ; `usageDates` 7 et 30 jours, dernière = jour UTC, passage de mois ; `fillUsageDays` met les jours absents à 0, additionne les doublons, ignore les dates hors fenêtre

## Phase 3 : Histoire 3 + 1 — Source et section du jour (P1)

**But** : lire Cloudflare côté Worker et afficher la consommation du jour, avec les états
non configuré / refusé / indisponible.

**Test indépendant** : route `GET /api/usage` avec `fetch` simulé → `ok` avec 7 jours ; sans
secret → `not-configured` sans appel réseau ; 401 → `denied` ; panne → `unavailable`.

- [x] T004 [US3] Écrire `admin-worker/src/cloudflare-usage.ts` : constante de requête GraphQL (research §1), `readCloudflareUsage(env, days, now, fetchFn)` → `UsageResponse` (secrets absents → `not-configured` avec `missing`, sans `fetch` ; Bearer ; classification research §4 ; forme inattendue → `unavailable` ; `fillUsageDays` ; aucune donnée Cloudflare brute ni jeton dans le résultat)
- [x] T005 [US3] Brancher dans `admin-worker/src/index.ts` : `Env` + `CLOUDFLARE_API_TOKEN?`, `CLOUDFLARE_ACCOUNT_ID?` ; `GET /api/usage?days=` (défaut 7, 400 `{ error, field: 'days' }` hors 7/30) après `verifyOwner`, `fetch` injectable pour les tests
- [x] T006 [P] [US3] Tests (même fichier, partie Worker) : 403 pour un étranger sans appel Cloudflare ; en-tête `Authorization: Bearer` envoyé, corps GraphQL avec l'identifiant de compte et la fenêtre de dates ; réponse nominale → `history` de `days` éléments, jours absents à 0 ; secret manquant (un seul, puis les deux) → `not-configured` + `missing`, `fetch` non appelé ; 401, 403, erreur GraphQL d'authentification → `denied` ; réseau en échec, 500, JSON invalide, forme inattendue → `unavailable` ; le texte du jeton n'apparaît dans aucune réponse ; `days=15` → 400
- [x] T007 [US1] Ajouter à `admin/admin-api.ts` : `getUsage(days)` + garde de type de `UsageResponse` (réponse invalide → `unavailable`)
- [x] T008 [US1] Écrire `admin/CloudflareUsageEditor.tsx` : chargement, trois lignes consommé / limite / % + barre + niveau en texte (`ok` / `warning` / `over`), « Actualiser » et heure de lecture, messages et « Réessayer » pour `not-configured` (avec les commandes `wrangler secret put`), `denied`, `unavailable` ; l'ajouter dans `admin/AdminPage.tsx` ; styles de barres dans `admin/admin.css`
- [x] T009 [P] [US1] Tests dans `tests/integration/admin-page.test.tsx` (ajouter `getUsage` au mock `api` et une valeur par défaut `not-configured` dans le `beforeEach`) : 50 000 / 100 000 → « 50 % » ; 80 % → alerte en texte ; 112 % affiché, barre pleine ; 0 → « 0 % » ; `not-configured` → message et commandes, sans alerte d'erreur ; `denied` et `unavailable` → message + « Réessayer » relance ; « Actualiser » relit ; les autres sections restent affichées quand `getUsage` échoue

## Phase 4 : Histoire 2 — Historique 7 / 30 jours (P2)

**But** : petit graphique et bascule.

**Test indépendant** : 7 jours = 7 points ; clic sur « 30 jours » appelle `getUsage(30)` et montre 30 points.

- [x] T010 [US2] Écrire `admin/UsageChart.tsx` : SVG en ligne, trois courbes en % de limite, échelle `max(100, plus grand %)`, repère à 100 %, `<title>` par point, tableau textuel accessible (date et valeurs)
- [x] T011 [US2] Intégrer dans `CloudflareUsageEditor` la bascule « 7 jours » / « 30 jours » (7 par défaut, `aria-pressed`, relit avec le nouveau `days`, garde l'ancien affichage pendant le chargement) et le graphique
- [x] T012 [P] [US2] Tests intégration : 7 points par défaut ; clic « 30 jours » → `getUsage(30)` et 30 points ; jour à 0 présent comme point ; valeurs d'un jour lisibles dans le tableau

## Phase 5 : Documentation et finition

- [x] T013 [P] Documenter dans `admin-worker/wrangler.toml` (commentaire à côté de `OWNER_EMAIL`) et `README.md` la création du jeton (Account Analytics : Read), de l'identifiant de compte et des deux `wrangler secret put` ; mentionner la section dans le tableau « Administration »
- [x] T014 Lancer `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test` et corriger ; vérifier que `git diff master` ne touche ni `worker/` ni `src/` hors `src/domain/cloudflare-usage.ts`
- [ ] T015 Lancer le sous-agent `relecteur` sur les changements et corriger les points graves

## Dépendances

T001 → T002 → T004 → T005 → T007 → T008 → T011 ; T010 avant T011 ; chaque test [P] après le code qu'il couvre.
Rien n'est déployé : le quickstart manuel (secrets, `admin:deploy`) attend l'accord du propriétaire.
