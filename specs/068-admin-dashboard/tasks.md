# Tâches : Tableau de bord de l'administration

**Entrée** : documents de `specs/068-admin-dashboard/` (plan, spec, research, data-model, contracts, quickstart)

**Tests** : inclus (la constitution exige des tests pour les règles ; les tests d'intégration existants de la page doivent être adaptés).

## Format : `[ID] [P?] [Story] Description`

- **[P]** : parallélisable (fichiers différents, sans dépendance)
- **[Story]** : parcours de la spec (US1, US2, US3)

## Phase 1 : Fondations (bloquant)

**Objectif** : logique pure et navigation par ancre, nécessaires à tous les parcours.

- [X] T001 [P] Créer `admin/dashboard-summary.ts` : type `SectionId` (`'pages' | 'bandeau' | 'compteurs' | 'cles' | 'correspondances' | 'cloudflare'`), liste ordonnée `SECTIONS` (id + titre : « Pages du site », « Bandeau d'information », « Compteurs », « Clés de l'outil de prix », « Correspondances », « Utilisation Cloudflare »), `parseSection(hash)` (accepte `#id` ou `id`, renvoie `undefined` si vide ou inconnu), type `CardSummary` (`state: 'loading' | 'ok' | 'unavailable'`, `text`, `tone: 'neutral' | 'good' | 'warning' | 'over'`)
- [X] T002 [P] Créer `admin/useSection.ts` : hook qui lit `location.hash` via `parseSection`, écoute `hashchange` (retire l'écouteur au démontage) et renvoie la section courante
- [X] T003 Ajouter dans `admin/dashboard-summary.ts` les fonctions pures de résumé, selon `data-model.md` : `summarizePages(settings)` (« 1 page active sur 2 »), `summarizeBanner(message)` (« Aucun bandeau » / « Bandeau affiché »), `summarizeCounters(list)` (« Aucun compteur » / « 1 compteur » / « n compteurs »), `summarizeKeys(list)` (clés sans `revokedAt` ; « Aucune clé active »), `summarizeMappings(list)` (total et build actif, sinon « Aucune correspondance active »), `summarizeUsage(response)` (métrique la plus haute en %, ton selon le pire `usageLevel`/`usagePercent`/`USAGE_LEVEL_TEXT` de `src/domain/cloudflare-usage.ts` ; `not-configured` → « Jeton non configuré » neutre ; `denied`/`unavailable` → `unavailable`) (dépend de T001)
- [X] T004 [P] Créer `tests/unit/admin-dashboard-summary.test.ts` : `parseSection` (valide avec/sans `#`, vide, inconnue) ; chaque résumé sur cas normal et limites (0, 1, plusieurs ; clé révoquée ignorée ; aucun mapping actif ; Cloudflare ok / avertissement à 80 % / dépassé à 100 % / non configuré / refusé / indisponible)

**Point de contrôle** : `npx vitest run tests/unit/admin-dashboard-summary.test.ts` passe.

---

## Phase 2 : Parcours 1 - Voir l'état de tout d'un coup d'œil (P1) 🎯 MVP

**Objectif** : tableau de bord avec six cartes-résumé.

**Test indépendant** : ouvrir la page sans ancre : six cartes avec résumé ; une lecture en échec n'affecte que sa carte.

- [X] T005 [P] [US1] Créer `tests/integration/admin-dashboard.test.tsx` (mock de `adminApi` comme dans `tests/integration/admin-page.test.tsx`) : six cartes et leurs résumés ; bandeau affiché/masqué ; Cloudflare en avertissement avec texte « Proche de la limite » ; une lecture en échec → « Indisponible » sans bloquer les autres ; e-mail « Connecté : … » conservé
- [X] T006 [US1] Créer `admin/Dashboard.tsx` : au montage, lit en parallèle `adminApi.getSettings`, `getMessage`, `list`, `listSnifferKeys`, `listSnifferMappings`, `getUsage(7)` ; chaque résultat devient un `CardSummary` indépendant (`loading` puis `ok`/`unavailable`, sans fabriquer de valeur) ; rend `<ul>` de six `<a href="#id">` (titre h2, résumé en texte, état d'alerte en texte, nom accessible = titre + résumé) ; annule les mises à jour après démontage
- [X] T007 [US1] Ajouter dans `admin/admin.css` les styles `.dashboard-grid`, `.dashboard-card`, `--warning`/`--over`/`--good` (variables existantes `--border`, `--inner-bg`, `--warning`, `--danger`, `--success`, `--accent-bright`), grille adaptative en une colonne en étroit, focus visible (`:focus-visible`), lisible en thème clair et sombre
- [X] T008 [US1] Modifier `admin/AdminPage.tsx` : sans section courante (hook `useSection`), afficher l'en-tête puis `<Dashboard />`

**Point de contrôle** : le tableau de bord s'affiche et passe `admin-dashboard.test.tsx`.

---

## Phase 3 : Parcours 2 - Accéder en un clic à une section (P1)

**Objectif** : une section ouverte seule, avec retour, comportement inchangé.

**Test indépendant** : cliquer chaque carte, vérifier la section seule, revenir, voir la carte à jour.

- [X] T009 [US2] Modifier `admin/AdminPage.tsx` : avec une section courante, rendre uniquement elle (`SiteSettingsEditor`, `MessageEditor`, bloc Compteurs existant avec `notice`/`NewCounterForm`, `SnifferKeysEditor`, `SnifferMappingsEditor`, `CloudflareUsageEditor`), précédée d'un lien « ← Retour au tableau de bord » (`href="#"`) ; le chargement de la liste des compteurs (`list`) ne se fait plus que pour la section Compteurs ; déplacer le focus sur le titre de la vue au changement de vue
- [X] T010 [US2] Adapter `tests/integration/admin-page.test.tsx` : `renderPage` accepte l'ancre de la section visée (`window.location.hash = '#compteurs'` etc. avant `render`, remis à `''` dans `afterEach`) ; les assertions de comportement des éditeurs restent identiques
- [X] T011 [US2] Compléter `tests/integration/admin-dashboard.test.tsx` : clic sur chaque carte → seule la section choisie est affichée ; « Retour au tableau de bord » → cartes réaffichées ; après une modification (ex. page activée) la carte est à jour au retour

**Point de contrôle** : `npx vitest run tests/integration` passe, sans régression des six sections.

---

## Phase 4 : Parcours 3 - Navigation par le navigateur et liens directs (P2)

**Objectif** : ancres, bouton précédent, ancre inconnue.

**Test indépendant** : charger `/#compteurs`, changer l'ancre, charger une ancre inconnue.

- [X] T012 [US3] Compléter `tests/integration/admin-dashboard.test.tsx` : ancre initiale `#cloudflare` ouvre la section ; changement d'ancre (événement `hashchange`) bascule la vue dans les deux sens ; ancre inconnue → tableau de bord
- [X] T013 [US3] Vérifier dans `admin/useSection.ts` et `admin/AdminPage.tsx` que le retour arrière du navigateur fonctionne (l'ouverture d'une carte ajoute une entrée d'historique, le lien de retour `href="#"` aussi) ; corriger si un test de T012 échoue

---

## Phase 5 : Finition

- [X] T014 [P] Mettre à jour le commentaire d'en-tête de `admin/AdminPage.tsx` (référence à `specs/068-admin-dashboard`) et la section Administration du `README.md` (décrire le tableau de bord et les ancres)
- [X] T015 Lancer `npm run test`, `npm run lint`, `npm run build` ; corriger les erreurs
- [X] T016 Valider `quickstart.md` en navigateur : six cartes, un clic par section, précédent, largeur téléphone (~375 px), clavier, thèmes clair et sombre ; donner l'URL du serveur de dev à l'utilisateur

---

## Dépendances et ordre

- Phase 1 d'abord. T001 avant T003 ; T002 et T004 (après T001/T003) en parallèle des autres fichiers.
- Phase 2 dépend de la Phase 1 ; Phase 3 dépend de T008 (même fichier `AdminPage.tsx`) ; Phase 4 dépend de la Phase 3.
- T005 et T006 touchent des fichiers différents : parallélisables ; T008 après T006.
- Phase 5 en dernier.

## Stratégie

MVP = Phases 1 + 2 (tableau de bord lisible). Ensuite Phase 3 (accès rapide), puis Phase 4 (confort de navigation). Commit unique à l'étape implement.
