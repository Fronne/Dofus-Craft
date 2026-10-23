# Tâches : Tableau de bord d'administration moderne et activation de toutes les pages

**Entrée** : documents de `specs/071-admin-dashboard-moderne/` (plan, spec, research, data-model, contracts, quickstart)

**Tests** : inclus (la constitution exige des tests pour les règles ; les tests existants des réglages et du tableau de bord sont adaptés).

## Format : `[ID] [P?] [Story] Description`

- **[P]** : parallélisable (fichiers différents, sans dépendance)
- **[Story]** : parcours de la spec (US1 pages activables, US2 tableau de bord moderne, US3 non-régression)

## Phase 1 : Fondations (bloquant)

**Objectif** : le réglage à sept pages dans le domaine, le stockage et la migration.

- [X] T001 Dans `src/domain/site-settings.ts`, remplacer les deux champs par `SITE_PAGES` (ordre de la navigation : `searchPage`/`search_page`/Recherche/`ROUTES.search`/activée, `pinnedPage`/`pinned_page`/Suivis/`ROUTES.pinned`/activée, `pricesPage`/`prices_page`/Rentabilité/`ROUTES.prices`/activée, `hdvPage`/`hdv_page`/HDV/`ROUTES.hdv`/activée, `petsPage`/`pets_page`/XP Familier/`ROUTES.pets`/activée, `forgemagiePage`/`forgemagie_page`/Forgemagie/`ROUTES.forgemagie`/**désactivée**, `brisagePage`/`brisage_page`/Brisage/`ROUTES.brisage`/activée) ; `SiteSettings` = sept booléens ; `DEFAULT_SITE_SETTINGS` dérivé ; `parseSiteSettings` : objet requis, `forgemagiePage` booléen requis (compatibilité), champ absent → défaut, champ présent non booléen → `undefined` ; `validateSiteSettingsChange` : chaque champ présent booléen (« Valeur attendue : activée ou désactivée. »), au moins un champ connu ; nouvelles fonctions pures `enabledPageCount`, `firstEnabledPage` (première page activée dans l'ordre, ou `undefined`), `isLastEnabledPage(settings, champ)`. Importer `ROUTES` sans créer de cycle (copier les chemins dans la liste si `ROUTES` est dans `src/app`, voir le fichier des routes)
- [X] T002 [P] Dans `worker/src/site-settings.ts`, lire les sept clés (`SITE_SETTING_KEYS` dérivé de `SITE_PAGES`, requête `WHERE key IN (...)` construite depuis la liste), valeur par défaut pour chaque clé absente ; adapter `admin-worker/src/settings.ts` si besoin (l'écriture itère déjà sur `SITE_SETTING_KEYS`)
- [X] T003 [P] Créer `worker/migrations/0023_widen_site_settings_keys.sql` sur le modèle de `0017_add_hdv_page_setting.sql` : `DROP TABLE IF EXISTS site_settings_new`, nouvelle table avec `CHECK (key IN ('forgemagie_page', 'hdv_page', 'search_page', 'pinned_page', 'prices_page', 'pets_page', 'brisage_page'))`, `value TEXT NOT NULL CHECK (value IN ('0', '1'))`, `updated_at TEXT NOT NULL`, copie des lignes, suppression, renommage ; rejouable ; reporter le même `CHECK` dans `worker/schema.sql` ; ajouter le script `worker:db:migrate-site-pages` dans `package.json` (même forme que `worker:db:migrate-dashboard-indexes`)
- [X] T004 [P] Mettre à jour `tests/unit/site-settings-domain.test.ts` : défauts, `parseSiteSettings` (réponse à deux champs → les cinq autres par défaut ; champ non booléen → `undefined`), `validateSiteSettingsChange` (sept champs, champ inconnu ignoré, corps vide refusé), `enabledPageCount`, `firstEnabledPage` (première, aucune, recherche coupée), `isLastEnabledPage`
- [X] T005 [P] Mettre à jour `tests/unit/site-settings-route.test.ts` et `tests/unit/worker-schema.test.ts` : lecture publique des sept réglages avec défauts, écriture d'une nouvelle clé, `PUT` d'un champ seul sans toucher aux autres ; test de la migration `0023` (états `forgemagie_page` et `hdv_page` conservés, nouvelle clé acceptée, clé inconnue refusée, rejouable)

**Point de contrôle** : `npx vitest run tests/unit/site-settings-domain.test.ts tests/unit/site-settings-route.test.ts tests/unit/worker-schema.test.ts` passe.

---

## Phase 2 : Parcours 1 - Activer ou désactiver n'importe quelle page (P1) 🎯 MVP

**Objectif** : sept pages dans l'éditeur ; navigation et routes du site public gardées par `SITE_PAGES`.

**Test indépendant** : désactiver Brisage : lien absent de la navigation, adresse « indisponible » ; réactiver : retour.

- [X] T006 [P] [US1] Créer `src/app/PageUnavailable.tsx` : `PageUnavailable({ title, icon, to, toLabel })` (titre h1, `EmptyState` « <Titre> est momentanément indisponible », description « La page reviendra bientôt. Vos données sont conservées. », lien « Aller à <Nom> » vers la première page encore active) et `NoPageAvailable` (« Aucune page n'est disponible pour le moment. » avec lien vers `ROUTES.settings`), en reprenant le style de `ForgemagieUnavailablePage` / `HdvUnavailablePage` de `src/app/AppShell.tsx`
- [X] T007 [US1] Modifier `src/app/AppShell.tsx` : navigation filtrée par `settings[champ]` pour chacun des sept liens (Paramètres toujours présent) ; chaque route de page désactivable passée par un garde commun (activée → page ; `readingSiteSettings` → « Chargement… » ; désactivée → `PageUnavailable`) ; `ROUTES.home`, le logo et l'adresse inconnue mènent à `firstEnabledPage` (`NoPageAvailable` si aucune) ; supprimer `ForgemagieUnavailablePage` et `HdvUnavailablePage` ; conserver `hdvPageEnabled` pour `FamilierPage` (dépend de T001, T006)
- [X] T008 [US1] Modifier `admin/SiteSettingsEditor.tsx` : lister les sept pages depuis `SITE_PAGES` (« Page <Nom> : Activée / Désactivée », bouton nommé « Désactiver la page <Nom> »), garder « seul le champ cliqué est envoyé » ; désactiver la dernière page active passe par une confirmation en deux temps (message « C'est la dernière page active : le site n'aura plus aucune page disponible. », boutons « Confirmer la désactivation » et « Annuler ») via `isLastEnabledPage` ; échec → message d'erreur et état affiché inchangé (dépend de T001)
- [X] T009 [P] [US1] Dans `admin/dashboard-summary.ts`, `summarizePages` : « N page(s) active(s) sur 7 » (`enabledPageCount`, pluriel) ; adapter `tests/unit/admin-dashboard-summary.test.ts`
- [X] T010 [US1] Créer `tests/integration/site-pages-toggle.test.tsx` sur le modèle de `tests/integration/hdv-page-toggle.test.tsx` : pour chacune des sept pages désactivée, lien absent et adresse « momentanément indisponible » avec lien vers une page active ; Paramètres toujours accessible ; accueil et logo vers la première page active quand Recherche est coupée ; aucune page active → « Aucune page n'est disponible pour le moment. » ; lecture en cours → « Chargement… » ; cache local à deux champs lu avec défauts pour les cinq autres (dépend de T007)
- [X] T011 [US1] Adapter `tests/integration/admin-page.test.tsx`, `tests/integration/hdv-page-toggle.test.tsx`, `tests/integration/forgemagie-page-toggle.test.tsx`, `tests/integration/app-nav.test.tsx` et `tests/integration/familier-page.test.tsx` aux sept champs (fixtures de réglages complètes) ; ajouter à `admin-page.test.tsx` : sept lignes, activer / désactiver une page, confirmation de la dernière page active (confirmer et annuler), échec d'enregistrement (dépend de T007, T008)

**Point de contrôle** : `npx vitest run tests/integration` passe, sans régression des pages Forgemagie et HDV.

---

## Phase 3 : Parcours 2 - Un tableau de bord moderne (P1)

**Objectif** : chiffres clés, grandes cartes de graphiques, cartes secondaires, habillage sombre à dégradés et lueur.

**Test indépendant** : ouvrir la page : rangée de quatre chiffres clés, quatre grandes cartes, quatre cartes secondaires.

- [X] T012 [P] [US2] Créer `admin/KeyFigures.tsx` : `KeyFigures({ figures })` rend un `<ul>` de cartes (valeur en grand, titre en petit, état en texte) ; chaque chiffre est un lien `href="#section"` sauf s'il n'a pas de cible ; `tone` normal / avertissement / dépassé / indisponible ; « Indisponible » quand la source manque, jamais de valeur inventée ; un `0` réel s'affiche « 0 »
- [X] T013 [US2] Modifier `admin/Dashboard.tsx` : trois étages — (1) `KeyFigures` : « Pages actives » (`#pages`, « 6 sur 7 »), « Lignes ce mois-ci » (`#cles`, total de `getKeyContributions`), « Visiteurs du jour » (sans lien, `getActivity().visitorsToday`), « Limite du jour » (`#cloudflare`, pire niveau de `getUsage`, texte « Proche de la limite » / « Limite dépassée ») ; (2) grandes cartes : Cloudflare, Clés, Prix communautaires, Visites ; (3) cartes secondaires : Pages du site, Bandeau, Compteurs, Mapping ; titres des chiffres clés distincts de ceux des cartes de section ; conserver les lectures indépendantes et les visuels de la spec 070 (dépend de T012, T009)
- [X] T014 [US2] Dans `admin/admin.css`, habillage moderne : fond à dégradés bleu-vert, `.key-figures` (grille 4 / 2 / 1 colonnes), cartes à grand rayon avec bordure fine et lueur (`box-shadow` colorée, plus forte au survol et au focus), grandes cartes sur 2 colonnes à partir de 1100 px, cartes secondaires en grille adaptative, états `--warning` / `--over` avec lueur, thème clair atténué (`:root[data-theme="light"]` et `prefers-color-scheme`), `@media (prefers-reduced-motion: reduce)` sans transition ; ne pas casser les classes de la spec 070
- [X] T015 [US2] Adapter `tests/integration/admin-dashboard.test.tsx` : compter les cartes de section (liens dans les grilles) plutôt que tous les liens ; assistant `cardNames` limité aux cartes de section ; ajouter : rangée de quatre chiffres clés avec leurs valeurs, chacun lien vers sa section sauf « Visiteurs du jour », « Indisponible » par chiffre sans bloquer les autres, « 0 » affiché, niveau Cloudflare en texte, ordre des trois étages (dépend de T013)

**Point de contrôle** : `npx vitest run tests/integration/admin-dashboard.test.tsx` passe.

---

## Phase 4 : Parcours 3 - Non-régression, téléphone, thème clair (P2)

- [X] T016 [US3] Vérifier par l'essai manuel (quickstart section 2) avec un serveur de développement et une API simulée temporaire (à supprimer ensuite, comme pour la spec 070) : trois étages en thème sombre et clair, 375 px sans défilement horizontal, focus visible au clavier, états lisibles sans la couleur ; corriger les défauts de `admin/admin.css`
- [X] T017 [P] Ajouter en tête de `specs/070-admin-dashboard-graphiques/contracts/admin-dashboard-ui.md` une note « Mise en page revue par la spec 071 » pointant vers `specs/071-admin-dashboard-moderne/contracts/admin-dashboard-ui.md`
- [X] T018 Exécuter `npm run typecheck`, `npx eslint` sur les fichiers modifiés et `npx vitest run` ; comparer les échecs restants à ceux de `master` (`tesseract.js`, `VITE_COMMUNITY_API_URL`) et corriger tout échec nouveau

---

## Dépendances et ordre d'exécution

- **Phase 1** avant tout ; T002 à T005 en parallèle après T001 (T003 indépendant de T001).
- **US1** (T006 à T011) : T006 puis T007 ; T008 et T009 en parallèle de T007 ; T010 et T011 après T007 et T008.
- **US2** (T012 à T015) indépendant de US1 hors T009 (résumé des pages) ; `Dashboard.tsx` (T013) après T012.
- **Finitions** (T016 à T018) en dernier.
- **Mise en production** (hors tâches de code, à la demande du propriétaire) : migration `0023` **avant** de déployer les Workers (quickstart section 4).

## Stratégie de mise en œuvre

1. **MVP** : Phase 1 puis US1 : le contrôle réel des sept pages.
2. Puis US2 : l'habillage, qui n'a aucune dépendance de données nouvelle.
3. US3 clôt par la vérification visuelle et la comparaison avec `master`.
