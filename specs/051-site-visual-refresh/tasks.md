# Tasks: Nouveau style visuel pour tout le site

**Input**: Design documents from `/specs/051-site-visual-refresh/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui-contract.md, quickstart.md

**Tests**: inclus — le plan prévoit un test de contraste (SC-003) et des tests d'intégration pour la
navigation, Paramètres et le nombre de résultats ; la constitution demande des tests automatisés
verts avant acceptation.

**Organization**: tâches groupées par histoire utilisateur. Les histoires 1, 4 et 5 reposent sur les
mêmes fondations (jetons de style), d'où une phase 2 conséquente.

## Format: `[ID] [P?] [Story] Description`

- **[P]** : parallélisable (fichiers différents, pas de dépendance sur une tâche en cours)
- **[Story]** : histoire utilisateur concernée (US1…US5)

---

## Phase 1: Setup

- [X] T001 Ajouter `@fontsource-variable/lexend` et `@fontsource/rowdies`, retirer `@fontsource-variable/inter` dans `package.json` (et le fichier de verrouillage utilisé par le projet)
- [X] T002 Relever l'état de départ : lancer `npm run typecheck`, `npm run lint` et `npm run test` et noter le résultat, pour distinguer plus tard une régression d'un échec déjà présent

---

## Phase 2: Foundational (jetons et retrait des anciens styles)

**⚠️ Bloquant** : aucune histoire ne peut commencer avant la fin de cette phase.

- [X] T003 Écrire le test de contraste `tests/unit/theme-contrast.test.ts` : lit `src/styles/theme.css`, résout les jetons des thèmes sombre et clair, compose les fonds translucides sur `--bg`, et vérifie chaque couple de la section 2 de `contracts/ui-contract.md` (texte ≥ 4,5:1 ; icônes, contours et losanges ≥ 3:1). Il doit échouer avant T004
- [X] T004 Réécrire les jetons de `src/styles/theme.css` selon `data-model.md` : thème sombre de la maquette, thème clair décliné, nouveaux jetons `--accent*`, `--kamas*`, `--link*`, `--nav-bg`, `--accent-gradient`, `--stat-*`, `--font-display`, `--font-body` ; supprimer les vingt jetons `--accent-<couleur>-*` et les sélecteurs `[data-accent]` ; importer les deux polices
- [X] T005 Renommer `--gold`, `--gold-bright`, `--gold-soft` en `--accent`, `--accent-bright`, `--accent-soft` dans `src/styles/global.css`, `src/styles/comparison.css`, `admin/admin.css` et tout fichier `src/**/*.tsx` qui les cite
- [X] T006 Reprendre dans `src/styles/global.css` les règles utiles de `src/styles/design-modern.css` (sans le préfixe `[data-design]`), puis supprimer `src/styles/design-modern.css` et ses imports dans `src/main.tsx` et `admin/main.tsx`
- [X] T007 [P] Créer `src/persistence/retired-style-preferences.ts` : efface du `localStorage` les clés du design et de l'accent, sans jamais lever d'erreur ; l'appeler au démarrage dans `src/main.tsx`
- [X] T008 Supprimer `src/domain/designs.ts`, `src/domain/accent-colors.ts`, `src/persistence/design-preference.ts`, `src/persistence/accent-color-preference.ts` et leurs usages dans `src/app/AppShell.tsx` et `src/main.tsx` (plus d'attributs `data-design` ni `data-accent`)
- [X] T009 Supprimer les tests devenus sans objet : `tests/unit/design-preference.test.ts`, `tests/unit/design-modern-css-scope.test.ts`, `tests/integration/design-setting.test.tsx`
- [X] T010 [P] Mettre à jour la couleur de thème du navigateur (`theme-color`) dans `index.html` avec la valeur de `--bg` sombre

**Checkpoint** : le site se lance, `npm run typecheck` passe, le test de contraste est vert.

---

## Phase 3: User Story 1 — Un site aux couleurs plus vivantes, partout (P1) 🎯 MVP

**Goal** : toutes les pages portent la palette de la maquette en thème sombre, une couleur par rôle.

**Independent Test** : parcours 1 de `quickstart.md`.

- [X] T011 [US1] Appliquer le fond de page dans `src/styles/global.css` : `--bg-glow` sur la coque, fixé à la fenêtre, avec repli pour les appareils tactiles (research §7)
- [X] T012 [US1] Appliquer les polices dans `src/styles/global.css` : `--font-body` sur la racine, `--font-display` en capitales sur les titres de page et de section, chiffres tabulaires sur les montants
- [X] T013 [US1] Aligner les composants communs de `src/styles/global.css` sur la section 4 de `contracts/ui-contract.md` : panneaux, champs, bouton plein (`--accent-gradient`), bouton secondaire, pastilles, sélecteurs segmentés, cases d'objet, menus, dialogues et bulles opaques
- [X] T014 [US1] Passer les liens et boutons-liens au rôle `--link` dans `src/styles/global.css` et `src/styles/comparison.css` (research §3), en laissant sélection, bouton plein et focus sur l'accent
- [X] T015 [US1] Passer le symbole et les montants de kamas mis en avant au rôle `--kamas`, les avertissements à `--warning` et les erreurs à `--danger` dans `src/styles/global.css` et `src/styles/comparison.css`
- [X] T016 [US1] Revoir chaque page en thème sombre (Recherche, Suivis, Rentabilité, HDV, XP Familier, Forgemagie, Paramètres, choix du serveur, visite guidée, bandeau d'information, compteurs, graphiques d'historique) et corriger dans `src/styles/global.css` tout élément resté hors palette ou illisible
- [X] T017 [P] [US1] Aligner `admin/admin.css` et `admin/main.tsx` pour que l'application d'administration prenne le nouveau style

**Checkpoint** : parcours 1 de `quickstart.md` validé.

---

## Phase 4: User Story 2 — Le menu en haut de l'écran (P1)

**Goal** : barre flottante en haut au-dessus de 960 px ; navigation du bas inchangée en dessous.

**Independent Test** : parcours 2 de `quickstart.md`.

- [X] T018 [US2] Écrire `tests/integration/app-nav.test.tsx` : la navigation contient, dans l'ordre, la marque, les rubriques, puis le serveur actif, Paramètres et la bascule de thème ; la rubrique active porte `aria-current="page"` ; Forgemagie est absente quand la page est désactivée
- [X] T019 [US2] Réordonner le balisage de la navigation dans `src/app/AppShell.tsx` : marque, liste des rubriques, puis un groupe de droite avec `ServerSwitcher`, le lien Paramètres et la bascule de thème
- [X] T020 [US2] Écrire dans `src/styles/global.css` la barre du haut au-dessus de 960 px : coque en colonne, barre `sticky`, arrondie, centrée sur la largeur du contenu, fond `--nav-bg` avec flou et repli opaque sous `@supports not (backdrop-filter: blur(1px))`, rubrique active avec fond `--accent-soft` et losange `--accent`, passage sur deux lignes quand tout ne tient pas
- [X] T021 [US2] Vérifier dans `src/styles/global.css` que les règles sous 960 px donnent la même navigation du bas qu'avant avec le nouveau balisage (sélecteur de serveur, pied de navigation), et ajuster les marges du contenu maintenant que la colonne a disparu (dont la règle `.app-shell:has(.player-counters)`)

**Checkpoint** : parcours 2 et 6 de `quickstart.md` validés.

---

## Phase 5: User Story 3 — La page Recherche de la maquette (P2)

**Goal** : 6 résultats, verdict teinté, barres de répartition, effets colorés.

**Independent Test** : parcours 3 de `quickstart.md`.

- [X] T022 [US3] Écrire `tests/integration/search-results-page-size.test.tsx` : 6 résultats par défaut quand la recherche en renvoie davantage ; « Afficher 12 de plus » en montre 18 ; adapter les tests existants qui supposaient 12
- [X] T023 [US3] Dans `src/features/catalogue/ItemResults.tsx`, passer `RESULTS_PAGE_SIZE` à 6 et ajouter un pas de 12 pour « Afficher 12 de plus » ; vérifier l'usage du paramètre `limit` dans `src/features/search/RecherchePage.tsx`
- [X] T024 [US3] Mettre le bloc verdict aux normes de la maquette dans `src/features/comparison/` et `src/styles/comparison.css` : bloc teinté d'accent, losange coché, économie en `--kamas`, barre du montant le plus bas en accent et l'autre neutre
- [X] T025 [US3] Dans le tableau des ressources (`src/features/comparison/`, `src/styles/comparison.css`) : barre de répartition `--link` sous chaque sous-total, mentions « acheté » (teinte or) et « crafté » (teinte turquoise), trait vertical des sous-recettes
- [X] T026 [US3] Bloc Effets (`src/features/catalogue/ItemDetail.tsx` et le composant d'effets) : losange coloré par caractéristique via une table de présentation caractéristique → jeton `--stat-*`, teinte neutre par défaut ; le nom de la caractéristique reste écrit — **Révisé le 2026-10-13** : losanges retirés à la demande de l'utilisateur, les effets gardent `CharacteristicIcon` ; la page Recherche reprend la disposition de la maquette (FR-025a).
- [X] T027 [US3] Vérifier filtres, pastilles et résultat sélectionné de la page Recherche contre la section 5 de `contracts/ui-contract.md` et corriger les écarts dans `src/styles/global.css`

**Checkpoint** : parcours 3 de `quickstart.md` validé à 1440 px contre la maquette.

---

## Phase 6: User Story 4 — Un thème clair dans le même esprit (P2)

**Goal** : le thème clair suit le même style et reste lisible.

**Independent Test** : parcours 4 de `quickstart.md`.

- [X] T028 [US4] Revoir chaque page en thème clair et ajuster les jetons clairs de `src/styles/theme.css` (le test de contraste doit rester vert)
- [X] T029 [US4] Corriger dans `src/styles/global.css` et `src/styles/comparison.css` les éléments qui ne se lisent bien que dans un thème (ombres, halos, voiles, graphiques)

**Checkpoint** : parcours 4 de `quickstart.md` validé.

---

## Phase 7: User Story 5 — Plus de réglages de design ni d'accent (P3)

**Goal** : Paramètres ne propose plus ces deux réglages ; les anciens choix sont ignorés sans erreur.

**Independent Test** : parcours 5 de `quickstart.md`.

- [X] T030 [US5] Écrire `tests/integration/settings-style.test.tsx` (Paramètres n'affiche ni réglage « Design » ni réglage d'accent ; les autres réglages sont là) et `tests/unit/retired-style-preferences.test.ts` (les deux clés sont effacées ; aucune erreur si le stockage est indisponible)
- [X] T031 [US5] Retirer de `src/features/settings/ParametresPage.tsx` les réglages Design et Accent et leurs propriétés, et de `src/app/AppShell.tsx` les propriétés correspondantes passées à la page

**Checkpoint** : parcours 5 de `quickstart.md` validé.

---

## Phase 8: Polish & Cross-Cutting

- [X] T032 Réécrire `DESIGN.md` : un seul style, nouveaux jetons et rôles, navigation en haut, plus de mention des designs ni des accents (FR-029)
- [X] T033 [P] Noter dans `specs/012-modern-design/spec.md` que les deux designs sont remplacés par la fonctionnalité 051
- [X] T034 Contrôler les largeurs 320, 375, 768, 960, 961, 1280 et 1920 px dans les deux thèmes (parcours 6) et la réduction des animations (parcours 7)
- [X] T035 Lancer `npm run typecheck`, `npm run lint`, `npm run test` et `npm run test:e2e` ; corriger jusqu'au vert sans modifier d'attente portant sur un calcul ou une donnée (SC-005)
- [ ] T036 Montrer le thème clair et le site réalisé à l'utilisateur et recueillir son accord avant toute fusion (SC-007)

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → histoires. La phase 2 bloque tout.
- US1 (phase 3) d'abord : elle pose les composants communs dont dépendent US2 et US3.
- US2 (phase 4) et US3 (phase 5) sont indépendantes l'une de l'autre après US1, mais touchent toutes deux `src/styles/global.css` : à faire l'une après l'autre.
- US4 (phase 6) après US1 à US3, pour revoir en clair ce qui a été fait en sombre.
- US5 (phase 7) ne dépend que de la phase 2.
- Phase 8 en dernier.

### Parallel Opportunities

- T007 et T010 pendant T004 à T006.
- T017 (administration) pendant T011 à T016.
- T033 pendant T032.

## Implementation Strategy

1. **MVP** : phases 1 à 3 — tout le site a les nouvelles couleurs en thème sombre.
2. Phase 4 : la barre du haut, deuxième décision validée par l'utilisateur.
3. Phase 5 : la page Recherche conforme à la maquette.
4. Phases 6 et 7 : thème clair, réglages.
5. Phase 8 : documentation, contrôles, accord de l'utilisateur.
