# Feature Specification: Page Brisage

**Feature Branch**: `claude/page-brisage-229081` (worktree ; numérotation Speckit : `060-page-brisage`)
**Created**: 2026-10-19
**Status**: Draft
**Input**: « Une page dédiée Brisage : dire si briser un item est rentable, s'il faut faire un focus,
et sur quelle rune. » Fonctionnalité validée par le porteur du projet.

> **Révision (spec 061)** : l'interface décrite ici (saisie manuelle, coût et coefficient saisis, prix de
> runes saisis, réglages éditables, courbe de descente) est remplacée par
> [061-simplification-page-brisage](../061-simplification-page-brisage/spec.md). Restent valables les
> formules et hypothèses H1–H4 ; FR-002, FR-004 (saisie), FR-005 (courbe), FR-007 et l'US 3 ne le sont plus.

## Contexte

Briser un objet donne des runes selon ses lignes de stats et un **coefficient** propre à l'objet
(en %), qui baisse à chaque brisage. Le joueur veut savoir (1) si briser est rentable au regard du prix
de l'objet et des runes, (2) jusqu'à quel coefficient, donc combien d'objets, (3) si un **focus**
(cibler une rune) rapporte plus qu'un brisage normal, et sur quelle rune.

La page est **autonome** : route propre `/brisage`, sans lien depuis les autres pages pour l'instant.

## ⚠️ Estimations et hypothèses (affichées sur la page, à confirmer en jeu)

Aucune de ces formules n'est officielle (Constitution I et III).

- **H1 – Descente du coefficient** : formule empirique de Dorel, mesurée sur des objets **niveau 40**
  (écart ≤ 2 %) : `coef_suivant = ⌊x − (2,63·10⁻⁵ − 5,958·10⁻¹⁰·x)·x²⌋`. Le niveau de l'objet
  influence la vitesse de descente : hors niveau 40, la descente est une **estimation**.
- **H2 – Runes obtenues** (testée sur 2 relevés réels niveau 100, coef 50 %) :
  poids de ligne = `valeur × poids_stat × niveau × 0,015 + 1` ;
  runes = `poids de ligne × coef/100 ÷ poids de la rune`.
- **H3 – Focus** (hypothèse non officielle, **à confirmer par des relevés en jeu**) : la ligne ciblée
  compte à 100 % de son poids, les autres lignes à 50 %. Sur le relevé de la Cape du Chef Bwork (focus
  Dommages, coef 50 %) le calcul donne ≈ 6 runes Do pour 6 observées. Le rendement du focus est supposé
  **indépendant du coefficient** (les parts 100 % / 50 % remplacent le coefficient).
- **H4 – Poids** : poids de stat par point (Vitalité 0,2 ; Intelligence/Force/Agilité/Chance 1 ;
  Sagesse 3 ; Prospection 3 ; PM 90 ; PA 100 ; Dommages 20 ; Résistance % 6 …) et rune Ba/Pa/Ra =
  1× / 3× / 10× le poids de la rune simple. Seuls Vitalité, Intelligence, Agilité, Sagesse et Dommages
  sont recoupés par les relevés ; les autres stats sont marquées « à confirmer ».

Relevés de référence (tests) : Bottes du Chef Bwork niv. 100, sans focus, coef 50 % (Vi 44, Int 35,
Agi 26, Sa 19, PM 1, Pro 5, Ré 2 % ×3) → 26 Int, 20 Agi, ~7 Vi, ~15 Sa ; Cape du Chef Bwork niv. 100,
focus Dommages, coef 50 % → 6 runes Do.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Savoir si briser est rentable et combien d'objets (Priority: P1)

Le joueur choisit un objet du catalogue (ou saisit ses lignes à la main), indique le coefficient actuel
et le coût de l'objet. La page affiche la valeur des runes obtenues, le gain par objet, le **coefficient
minimal rentable** (`coef × coût ÷ valeur des runes`), le **nombre d'objets** à briser avant de passer
sous ce seuil, et la courbe de descente du coefficient objet par objet.

**Acceptance Scenarios** :
1. **Given** coef 50 %, coût 10 000, valeur des runes 21 000, **Then** le seuil vaut ≈ 23,8 % et les
   objets brisés sont ceux dont le coefficient reste ≥ ce seuil.
2. **Given** un coefficient déjà sous le seuil, **Then** « Pas rentable » et 0 objet.
3. **Given** une valeur de runes nulle (aucun prix), **Then** aucun résultat chiffré n'est inventé : la
   page demande les prix manquants.

### User Story 2 - Focus : sur quelle rune ? (Priority: P1)

Pour chaque ligne de l'objet, la page compare le brisage normal et le focus sur la rune de cette ligne,
avec les prix actuels des runes (HDV de la base, saisie manuelle possible). Elle classe les options de
la plus à la moins rentable et indique la meilleure : « pas de focus » ou « focus sur la rune X ».

**Acceptance Scenarios** :
1. **Given** une ligne Dommages et un prix de rune Do élevé, **Then** le focus Do est classé en tête si
   son gain par objet dépasse celui du brisage normal.
2. **Given** une rune sans prix, **Then** l'option est signalée « prix manquant » et classée après les
   options chiffrées ; le prix peut être saisi à la main.
3. **Then** le focus affiche « estimation non officielle ».

### User Story 3 - Régler les poids et rendements (Priority: P2)

Poids de stat, points par rune, multiplicateurs Ba/Pa/Ra, facteur de niveau (0,015), bonus de ligne
(+1), parts du focus (100 % / 50 %) sont des **réglages** modifiables, gardés sur l'appareil, avec
« Rétablir les valeurs par défaut ».

## Requirements *(mandatory)*

- **FR-001** Route `/brisage` (titre d'onglet « Brisage — Dofus Craft »), sans entrée de menu ni lien
  depuis les autres pages.
- **FR-002** Entrées : objet du catalogue (recherche par nom, valeurs numériques lues dans DofusDB,
  valeur maximale de chaque ligne) **ou** saisie manuelle (niveau + lignes stat/valeur) ; coefficient
  actuel (%) ; coût de l'objet (kamas). Les valeurs lues restent corrigeables.
- **FR-003** Formules pures et testées : descente du coefficient (H1), poids de ligne et nombre de runes
  (H2), focus (H3), coefficient minimal rentable et nombre d'objets.
- **FR-004** Prix des runes : carnet du mode de prix actif et, en mode communautaire, dernier prix
  partagé (même règle que XP Familier) ; saisie manuelle par rune, prioritaire.
- **FR-005** Classement des options (normal + un focus par ligne), meilleure option, gain par objet,
  seuil de rentabilité, nombre d'objets, courbe de descente.
- **FR-006** Bandeau permanent d'estimation (H1–H4) ; stats « à confirmer » signalées.
- **FR-007** Réglages éditables, persistés (`localStorage`, tolérant aux erreurs), réinitialisables.
- **FR-008** Lignes négatives, effets d'arme ou stats inconnues ignorés, avec mention du nombre ignoré.
- **FR-009** Aucune valeur fabriquée : données manquantes → message explicite (Constitution I).
- **Hors périmètre** : intégration aux autres pages, brisage en lot, tirage aléatoire Ba/Pa/Ra.

## Success Criteria

- **SC-001** Les relevés de référence sont reproduits par les formules (tests unitaires).
- **SC-002** Le joueur obtient la meilleure option et le nombre d'objets avec 4 saisies au plus
  (objet, coefficient, coût, prix manquants éventuels).
