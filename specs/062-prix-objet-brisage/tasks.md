---

description: "Liste de tâches : Prix de l'objet sur la page Brisage (HDV ou craft)"
---

# Tâches : Prix de l'objet sur la page Brisage (HDV ou craft)

**Entrée** : documents de conception dans `specs/062-prix-objet-brisage/`

**Prérequis** : plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests** : demandés par la constitution (principe II) et FR-011 : un calcul de prix change, il est testé (cas normal, bornes, entrées incomplètes).

## Format : `[ID] [P?] [Story] Description`

- **[P]** : parallélisable (fichiers différents, pas de dépendance sur une tâche inachevée)
- **[Story]** : histoire concernée (US1, US2, US3)

## Phase 1 : Fondations (bloque toutes les histoires)

**But** : la mémorisation du choix et le calcul du prix de craft, nécessaires à la page.

- [ ] T001 [P] Ajouter `priceSource: 'hdv' | 'craft'` à `BrisageSession` dans `src/persistence/brisage-session.ts` : lecture tolérante (champ absent ou valeur inconnue → `'hdv'`), écriture avec le champ
- [ ] T002 [P] Créer `src/features/brisage/useItemCraftCost.ts` : pour (serveur, objet, mode de prix), charge `getItemDetail`, `loadRecipeTree` (`src/features/comparison/recipe-tree-loader.ts`), lit le carnet via `resourcePricesFor(priceMode)`, applique `effectiveIngredientPrices` puis `compare`, et, en mode communautaire, `syncCommunityPrices` comme `src/features/catalogue/EpinglesPage.tsx`. Retourne `{ status: 'loading' | 'ready'; costKamas?: number; reason?: 'incomplete' | 'no-recipe' }` ; `costKamas` défini seulement si `craftCostStatus === 'complete'` et total > 0 ; annuler le résultat d'un calcul périmé (changement d'objet, serveur ou mode)
- [ ] T003 [P] Test `tests/unit/brisage-session.test.ts` : session ancienne sans `priceSource` → `'hdv'` ; valeur inconnue → `'hdv'` ; `'craft'` restitué (FR-007)
- [ ] T004 Test `tests/unit/item-craft-cost.test.ts` : chaîne complète (même total que `compare` sur le même arbre), ressource sans prix → `incomplete` sans montant, objet sans recette → `no-recipe`, total nul → indisponible, changement de mode de prix, calcul périmé ignoré (FR-004, FR-005, FR-008, FR-011)

**Point de contrôle** : `npx vitest run tests/unit/brisage-session.test.ts tests/unit/item-craft-cost.test.ts` passe.

## Phase 2 : Histoire 1 — Choisir entre le prix HDV et le prix de craft (P1) 🎯 MVP

**But** : sélecteur HDV/craft, montant retenu, tout le résultat suit le choix.

**Test indépendant** : un objet avec prix HDV et chaîne de craft chiffrée ; basculer et vérifier montant, verdict, gains, cartes.

- [ ] T005 [US1] Dans `src/features/brisage/BrisagePage.tsx`, renommer « Coût de l'objet » en « Prix de l'objet » (étiquette, libellé accessible du champ de saisie, texte du verdict « …le prix de l'objet », libellé de tableau « Total de l'objet, prix déduit ») (FR-001)
- [ ] T006 [US1] Dans `src/features/brisage/BrisagePage.tsx`, ajouter l'état `priceSource` (initialisé depuis la session, `'hdv'` par défaut), l'appel à `useItemCraftCost`, et le calcul du prix retenu : `(priceSource === 'craft' ? craft.costKamas : itemCost.costKamas) ?? parse(manualCost)` ; écrire `priceSource` dans `setBrisageSession` et le restituer dans `openItem` (FR-002, FR-006, FR-007)
- [ ] T007 [US1] Dans `src/features/brisage/BrisagePage.tsx`, afficher le sélecteur à deux choix « Prix HDV » / « Prix de craft » (boutons radio accessibles) au-dessus du montant, et passer l'analyse en attente tant que la source choisie charge (FR-010)
- [ ] T008 [P] [US1] Style du sélecteur à deux choix dans `src/styles/global.css` (mobile compris, 16 px de marge, focus visible)
- [ ] T009 [US1] Tests d'intégration dans `tests/integration/brisage-page.test.tsx` : HDV par défaut inchangé (SC-005), bascule vers craft change montant et verdict, choix restitué après rechargement, libellé « Prix de l'objet » (scénarios 1 à 4 de l'histoire 1)

**Point de contrôle** : l'histoire 1 fonctionne seule ; craft complet = montant d'Épingles (SC-002).

## Phase 3 : Histoire 2 — Craft incomplet : le dire et laisser saisir (P2)

**But** : aucun total partiel, message clair, saisie manuelle.

**Test indépendant** : « Prix de craft » sur un objet dont une ressource n'a pas de prix, puis saisir un montant.

- [ ] T010 [US2] Dans `src/features/brisage/BrisagePage.tsx`, quand la source choisie n'a pas de montant : message selon `reason` (« prix de craft incomplet : il manque le prix d'une ressource » / « aucun craft pour cet objet » / message HDV actuel) et champ de saisie manuelle unique, valeur conservée en basculant (FR-005, scénarios 1 à 4)
- [ ] T011 [US2] Dans `src/features/brisage/BrisagePage.tsx`, refuser un prix nul ou négatif quelle que soit la source, y compris la saisie manuelle (FR-008)
- [ ] T012 [US2] Tests d'intégration dans `tests/integration/brisage-page.test.tsx` : craft incomplet (message, pas de total partiel, saisie utilisée par le verdict), objet sans recette, prix nul refusé, saisie conservée en basculant, HDV sans prix inchangé

**Point de contrôle** : les histoires 1 et 2 passent ensemble.

## Phase 4 : Histoire 3 — Savoir d'où vient le prix (P3)

**But** : mention de provenance sous le montant.

**Test indépendant** : vérifier la mention dans les trois cas.

- [ ] T013 [US3] Dans `src/features/brisage/BrisagePage.tsx`, afficher sous le montant « Prix noté sur la page Recherche », « Coût de la chaîne de craft » (avec le mode de prix actif : personnel ou communautaire) ou « Saisi à la main » selon la source qui a fourni le montant (FR-009)
- [ ] T014 [US3] Test d'intégration dans `tests/integration/brisage-page.test.tsx` : les trois mentions, et le prix qui suit le changement de mode de prix (scénarios 1 et 2)

## Phase 5 : Finition

- [ ] T015 Lancer `npx tsc --noEmit -p tsconfig.app.json`, `npx eslint src tests` et `npx vitest run tests/unit tests/integration/brisage-page.test.tsx` ; corriger ce qui casse
- [ ] T016 Vérifier à la main les 6 scénarios de `specs/062-prix-objet-brisage/quickstart.md` sur le serveur de dev (port 5173)

## Dépendances

- Phase 1 d'abord ; T001, T002, T003 en parallèle, T004 après T002.
- Phase 2 dépend de la phase 1 ; T008 en parallèle de T005 à T007 ; T009 en dernier.
- Phase 3 dépend de la phase 2 (même fichier `BrisagePage.tsx`, donc en série).
- Phase 4 dépend de la phase 2 ; indépendante de la phase 3 sauf pour le fichier partagé.
- Phase 5 en dernier.

## Stratégie d'implémentation

1. **MVP** : phases 1 et 2 — le sélecteur fonctionne, craft complet seulement.
2. Phase 3 — robustesse (craft incomplet, saisie), indispensable avant de proposer la fonctionnalité en production : sans elle, « Prix de craft » est faux pour beaucoup d'objets.
3. Phase 4 — confort de lecture.

## Parallélisme

- Fondations : T001, T002, T003 ensemble.
- Style (T008) pendant le travail de la page.
- `BrisagePage.tsx` est touché par T005 à T007, T010, T011, T013 : ces tâches se font en série.
