# Tâches : Brisage sans coefficient connu (focus conseillé)

**Entrée** : [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md)
Format : `- [ ] Txxx [P?] [US?] Description avec chemin`

## Phase 1 : Fondations (calcul de domaine)

- [x] T001 Ajouter `analyzeFocusAdvice(input sans coefficient, runes, prices, settings)` dans `src/domain/brisage.ts` : référence = option « normal » avec part 100 % (`buildOption`), une option focus par ligne, `bestFocus` = option complète de plus grande `valueKamas` (égalité → première ligne), `switchCoefficient = 100 × bestFocus.valueKamas / referenceOption.valueKamas` (absent si valeur incomplète ou référence ≤ 0), `missingRuneIds`, statut `invalid` si aucune ligne exploitable ou niveau < 1 ; le prix de l'objet n'intervient pas.
- [x] T002 [P] Tests unitaires dans `tests/unit/brisage-advice.test.ts` : cas de base, prix de rune manquant (pas de `bestFocus` ni de seuil), égalité, une seule ligne, référence à 0, et cohérence : avec `analyzeBrisage` à un coefficient juste sous / juste au-dessus de `switchCoefficient`, le meilleur choix passe de focus à normal.

## Phase 2 : US1 + US2 (P1) – tableau, ligne conseillée, seuil

**Test indépendant** : objet sans coefficient mémorisé et runes chiffrées → tableau, « Meilleur focus », bloc « Conseil » avec seuil.

- [x] T003 [US1] Dans `src/features/brisage/BrisagePage.tsx`, calculer `advice = analyzeFocusAdvice(...)` quand l'objet est chargé, le prix de l'objet prêt et `coefficient` inconnu ; n'afficher plus le seul message « Indiquez le coefficient » dans ce cas.
- [x] T004 [US1] Réutiliser le tableau existant en mode sans coefficient : colonnes Rune, Jet, Prix unitaire, Sans focus (référence), Avec focus (runes + gain, ou valeur des runes si le prix de l'objet manque) ; ligne `bestFocus` mise en évidence avec le badge « Meilleur focus » ; pied de tableau adapté.
- [x] T005 [US2] Remplacer le verdict par un bloc « Conseil » : « Focus {rune} tant que le coefficient est sous X % ; au-dessus, brisez sans focus. » ; cas seuil > 100 % (« focus conseillé sur les coefficients courants ») ; aucun conseil si un prix de rune manque (message « Prix manquant pour … » conservé) ; pas de cartes « Gain selon le coefficient ».
- [x] T006 [US1] Garder le retour à l'affichage complet actuel dès qu'un coefficient est mémorisé ou saisi, et le retour à l'affichage sans coefficient quand il est effacé.
- [x] T007 [P] [US1] Tests d'intégration dans `tests/integration/brisage-page.test.tsx` : sans coefficient → tableau + « Meilleur focus » + seuil affiché ; saisie du coefficient → verdict complet ; effacement → retour ; prix de rune manquant → pas de conseil ; prix de l'objet absent → conseil gardé.

## Phase 3 : US3 (P2) – colonne « Sans focus » honnête

**Test indépendant** : sans coefficient, toute valeur « Sans focus » est étiquetée « à 100 % ».

- [x] T008 [US3] Dans `BrisagePage.tsx` et `src/styles/global.css`, étiqueter l'en-tête « Sans focus » en « Sans focus (à 100 % : référence) » sans coefficient, sans verdict « Rentable / Pas rentable » ; en-tête inchangé avec coefficient.
- [x] T009 [P] [US3] Test d'intégration (même fichier) : l'étiquette « à 100 % » est présente sans coefficient et absente avec coefficient.

## Phase 4 : Finition

- [x] T010 Tests de brisage et vérification des types passés (fm-api.test.ts échoue pour une raison étrangère : variable d'environnement absente dans le worktree) ; aperçu à vérifier à la main.

## Dépendances

T001 → T002, T003 → T004 → T005 → T006 → T007 ; T008 après T004 ; T010 en dernier. MVP : phases 1 et 2.
