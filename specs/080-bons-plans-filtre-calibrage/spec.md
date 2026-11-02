# Feature Specification: Filtre par exo et calibrage des bons plans

**Feature Branch**: `080-bons-plans-filtre-calibrage`

**Created**: 2026-11-02

**Status**: Draft

**Input**: Page Bons plans : filtrer sur un exo précis avec un sélecteur à recherche, et laisser chaque joueur calibrer le calcul depuis le site (suite de `specs/078-bons-plans-hdv` et `specs/079-calcul-bons-plans`).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Trouver les bons plans d'un exo précis (Priority: P1)

Un joueur cherche un objet exo Dommages aux sorts. Il ouvre le sélecteur d'exo, tape « sorts », choisit la rune, et ne voit que les bons plans avec cet exo, quelle qu'en soit la valeur. Il précise 2 % et ne voit plus que les exos à 2 %.

**Why this priority**: c'est l'usage le plus fréquent, et la liste « Jet » actuelle n'y répond pas.

**Independent Test**: choisir un exo, vérifier que toutes les cartes portent cet exo, puis préciser une valeur et vérifier qu'il ne reste que celle-là.

**Acceptance Scenarios**:

1. **Given** la page Bons plans, **When** le joueur ouvre le sélecteur d'exo, **Then** il voit un champ de recherche en haut, et la liste des exos avec l'icône de la rune et son nom.
2. **Given** la liste ouverte, **When** il tape « sorts », **Then** seule la ligne Dommages aux sorts reste.
3. **Given** un exo choisi sans valeur, **When** la liste s'affiche, **Then** les annonces à 1 %, 2 %, 3 % et plus apparaissent toutes.
4. **Given** un exo choisi avec la valeur 2, **When** la liste s'affiche, **Then** seules les annonces avec exactement 2 de cet exo apparaissent.
5. **Given** un exo choisi, **When** le joueur le retire, **Then** tous les bons plans reviennent.

---

### User Story 2 - Calibrer le calcul à sa façon (Priority: P2)

Un joueur qui valorise la Sagesse ouvre « Calibrer le calcul » et la passe en importance Très importante. Les bons plans se recalculent aussitôt, pour lui seul.

**Why this priority**: tous les joueurs ne jugent pas un jet de la même façon, mais les réglages par défaut servent déjà la majorité.

**Independent Test**: changer l'importance d'une stat et vérifier que la liste change, sans rechargement ni effet pour un autre navigateur.

**Acceptance Scenarios**:

1. **Given** le panneau ouvert, **When** le joueur change l'importance d'une stat, **Then** les bons plans sont recalculés aussitôt.
2. **Given** le panneau ouvert, **When** il change l'écart accepté d'une stat, **Then** les bons plans sont recalculés aussitôt.
3. **Given** le panneau ouvert, **When** il change le seuil, **Then** seuls les exemplaires qui passent ce seuil restent, et le texte de la page affiche ce seuil.
4. **Given** des réglages modifiés, **When** il recharge la page, **Then** ses réglages sont toujours là.
5. **Given** des réglages modifiés, **When** il clique sur « Réinitialiser », **Then** les valeurs par défaut reviennent.

---

### Edge Cases

- Aucun bon plan ne correspond à l'exo choisi : la page le dit et propose de retirer le filtre.
- Un exo sans annonce n'apparaît pas dans le sélecteur. S'il disparaît alors qu'il est choisi, le filtre reste affiché et la page dit qu'aucun bon plan ne correspond.
- Une valeur d'exo vide ou invalide revient à ne pas préciser de valeur.
- Une sauvegarde illisible ou d'une ancienne version est ignorée pour ce qui ne peut pas être lu : les valeurs par défaut s'appliquent.
- Navigateur sans stockage possible : le calibrage marche jusqu'au rechargement de la page.
- Un seuil hors de 5 à 90 % est refusé et le dernier seuil valide reste appliqué.
- Si toutes les stats d'une annonce sont à importance Aucune, sa qualité vaut 0 et elle n'est pas jugée.

## Requirements *(mandatory)*

### Functional Requirements

**Filtre par exo**

- **FR-001**: La liste « Jet » et la case « Exo uniquement » DOIVENT être retirées de la page.
- **FR-002**: La page DOIT offrir un sélecteur d'exo qui s'ouvre sur un champ de recherche et une liste, avec pour chaque exo l'icône de sa rune et son nom, au même comportement que le sélecteur de rune de la page Brisage.
- **FR-003**: Le sélecteur NE DOIT proposer que les exos présents dans les annonces du serveur, et un seul exo peut être choisi à la fois.
- **FR-004**: Sans valeur précisée, le filtre DOIT garder toutes les annonces qui portent cet exo, quelle que soit sa valeur.
- **FR-005**: Avec une valeur précisée, le filtre DOIT garder seulement les annonces où cet exo a exactement cette valeur.
- **FR-006**: Le joueur DOIT pouvoir retirer le filtre. Le tri par économie reste disponible.

**Calibrage**

- **FR-007**: La page DOIT offrir un panneau « Calibrer le calcul », fermé par défaut.
- **FR-008**: Le joueur DOIT pouvoir choisir, pour chaque stat, son importance parmi Primordiale (1,5), Très importante (1), Moyenne (0,5), Faible (0,25) et Aucune (0).
- **FR-009**: Le joueur DOIT pouvoir régler, pour chaque stat, l'écart accepté au maximum de l'objet, ou le laisser vide pour que la stat ne fasse jamais de défaut.
- **FR-010**: La Vitalité et les Dommages Critiques DOIVENT garder par défaut leurs règles de `specs/079`. Une valeur saisie par le joueur remplace cette règle par un écart fixe.
- **FR-011**: Le joueur DOIT pouvoir régler son seuil de bon plan, de 5 à 90 %. Sans réglage personnel, le seuil fixé par l'administration s'applique.
- **FR-012**: Tout changement DOIT recalculer les bons plans aussitôt, sans rechargement.
- **FR-013**: Les réglages DOIVENT être gardés dans le navigateur du joueur et ne jamais être envoyés au serveur.
- **FR-014**: Un bouton « Réinitialiser » DOIT rendre toutes les valeurs par défaut.
- **FR-015**: Le calibrage s'applique à tous les objets. Le palier d'exo de 30 de poids et les poids du brisage NE DOIVENT PAS être réglables.

**Ce qui ne change pas**

- **FR-016**: Sans réglage personnel, les résultats DOIVENT être identiques à ceux de `specs/079`.
- **FR-017**: Le service de lecture des annonces et l'outil de prix NE DOIVENT PAS changer.

### Key Entities

- **Filtre d'exo** : une stat, et une valeur facultative.
- **Calibrage du joueur** : pour chaque stat modifiée, son importance et son écart accepté, plus un seuil facultatif. Seuls les écarts aux valeurs par défaut comptent.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un joueur trouve un exo précis et voit ses bons plans en moins de 10 secondes.
- **SC-002**: Le recalcul après un réglage paraît immédiat sur les quelques milliers d'annonces d'un serveur.
- **SC-003**: Sans réglage personnel, la liste des bons plans est identique à celle d'avant cette fonctionnalité.
- **SC-004**: Les réglages sont retrouvés à l'identique après un rechargement de la page.

## Assumptions

- La valeur d'un exo se compare à la valeur brute de la ligne : 2 pour 2 %.
- Le filtre d'exo se remet à zéro au rechargement. Seul le calibrage est gardé.
- Les réglages suivent le navigateur, pas le compte : ils ne suivent pas le joueur sur un autre appareil. Limite acceptée.
- Le calibrage par objet est hors périmètre pour l'instant.
- La liste « Jet » est retirée sans remplaçant : filtrer sur une stat normale n'est plus possible.
