# Feature Specification: Barre de progression glissable du familier

**Feature Branch**: `075-familier-level-slider`

**Created**: 2026-10-26

**Status**: Draft

**Input**: User description: "Page XP Familier : la barre de progression du bandeau objectif devient un curseur glissable (souris, tactile, flèches du clavier) qui fait varier le « Niveau actuel » du familier, du niveau minimum (0) au niveau maximum. Quand on glisse, l'XP totale du familier s'aligne sur le début exact du niveau choisi (l'éventuelle XP en plus déjà saisie est remplacée), « XP à donner » et le pourcentage se recalculent en direct. Le niveau visé n'est pas modifié. Les champs de saisie existants restent utilisables et la barre les suit. Une bulle « Niveau N » s'affiche pendant le glissement. Complète la spec 055-refonte-xp-familier (bandeau objectif)."

**Périmètre** : cette spec ne change que le bandeau « objectif » de la page XP Familier
(`specs/055-refonte-xp-familier`, histoire 1). Les règles de calcul, la courbe d'XP, les ressources,
les prix, l'Almanax et la mémorisation des saisies restent ceux de `specs/022-pet-xp-calculator`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Choisir le niveau actuel en faisant glisser la barre (Priority: P1)

Dans le bandeau objectif, la barre de progression du familier peut être saisie et déplacée avec la
souris, au doigt ou avec les flèches du clavier. Le repère suit le geste et le niveau actuel du
familier change en conséquence, entre le niveau minimum (0) et le niveau maximum. Le joueur n'a plus à taper
un nombre pour comparer plusieurs niveaux de départ.

**Why this priority**: c'est toute la fonctionnalité demandée ; le reste en dépend.

**Independent Test**: sur la page, faire glisser le repère jusqu'au niveau 85 : le champ « Niveau
actuel » indique 85, l'XP totale vaut exactement le début du niveau 85, et « XP à donner » vaut
132 589 pour un niveau visé de 100.

**Acceptance Scenarios**:

1. **Given** un familier au niveau 40 visant le niveau 100, **When** le joueur fait glisser le repère
   vers le niveau 85, **Then** le niveau actuel devient 85, l'XP totale s'aligne sur le début exact
   du niveau 85 et « XP à donner » ainsi que le pourcentage se recalculent pendant le geste.
2. **Given** une XP totale saisie qui dépasse le début du niveau 40, **When** le joueur déplace le
   repère sur un autre niveau, **Then** l'XP en plus est remplacée par le début exact du niveau
   choisi.
3. **Given** le repère sélectionné au clavier, **When** le joueur appuie sur la flèche droite ou
   haut (resp. gauche ou bas), **Then** le niveau actuel augmente (resp. diminue) d'un niveau ;
   Début et Fin vont au niveau minimum et au niveau maximum.
4. **Given** un niveau visé de 60, **When** le joueur fait glisser le repère au-delà de 60, **Then**
   le niveau visé n'est pas modifié et le bandeau indique qu'il n'y a plus d'XP à donner.
5. **Given** un écran tactile, **When** le joueur fait glisser le repère du doigt, **Then** le
   comportement est le même qu'à la souris et la page ne défile pas pendant le geste.

---

### User Story 2 - Voir le niveau pendant le glissement et garder les champs cohérents (Priority: P2)

Pendant le glissement, une bulle « Niveau N » suit le repère. Les champs « Niveau actuel » et « XP
totale du familier » restent utilisables au clavier : quand le joueur y tape une valeur, la barre se
place sur le niveau correspondant.

**Why this priority**: sans retour visuel, le geste manque de précision ; la cohérence avec les
champs évite deux sources de vérité.

**Independent Test**: taper 70 dans « Niveau actuel » : le repère se place au niveau 70. Faire
glisser le repère : la bulle affiche le niveau pendant le geste et disparaît au relâchement.

**Acceptance Scenarios**:

1. **Given** le joueur qui glisse le repère, **When** il passe d'un niveau à l'autre, **Then** une
   bulle « Niveau N » affiche le niveau courant et disparaît au relâchement.
2. **Given** une valeur tapée dans « Niveau actuel » ou dans « XP totale du familier », **When** la
   saisie est valide, **Then** le repère se place sur le niveau correspondant.
3. **Given** une saisie invalide dans un des champs, **When** le joueur touche la barre, **Then** la
   barre redevient utilisable et remplace la saisie invalide par le niveau choisi.

---

### Edge Cases

- Niveau actuel minimum (0) et niveau maximum : le repère reste dans la barre, sans déborder.
- Niveau actuel supérieur ou égal au niveau visé : « XP à donner » indique qu'il n'y a rien à donner
  (comportement existant), et la barre reste déplaçable.
- Relâchement hors de la barre pendant un glissement : le niveau courant est conservé.
- Le joueur déplace la barre quand la page n'a pas de niveau actuel valide : la barre part du
  niveau choisi.
- Prise en compte d'une valeur mémorisée : au rechargement, le repère est placé sur le niveau
  mémorisé.
- Lecteurs d'écran : la barre est annoncée comme un curseur avec le niveau courant.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Le joueur MUST pouvoir faire glisser le repère de la barre de progression du bandeau
  objectif à la souris et au doigt pour choisir le niveau actuel du familier, du niveau minimum (0) au niveau
  maximum.
- **FR-002**: Le joueur MUST pouvoir régler le niveau avec le clavier : flèches (±1 niveau), Début
  (niveau minimum), Fin (niveau maximum).
- **FR-003**: Quand un niveau est choisi sur la barre, l'XP totale du familier MUST être remplacée
  par le début exact de ce niveau, sans conserver d'XP en plus.
- **FR-004**: Le niveau actuel, l'XP totale, « XP à donner » et le pourcentage de progression MUST
  se mettre à jour pendant le geste, sans attendre le relâchement.
- **FR-005**: Le niveau visé MUST rester inchangé par un glissement.
- **FR-006**: Une bulle « Niveau N » MUST s'afficher pendant le glissement et disparaître au
  relâchement.
- **FR-007**: Les champs « Niveau actuel » et « XP totale du familier » MUST rester utilisables, et
  la barre MUST suivre toute valeur valide qui y est saisie.
- **FR-008**: La barre MUST être annoncée aux technologies d'assistance comme un curseur avec le
  niveau courant, la valeur minimale et la valeur maximale.
- **FR-009**: Le glissement au doigt MUST ne pas faire défiler la page.
- **FR-010**: La mémorisation des saisies existante MUST enregistrer le niveau choisi sur la barre
  comme une saisie normale.
- **FR-011**: Aucun calcul, aucune donnée ni aucun autre bloc de la page ne MUST changer.

### Key Entities

- **Niveau actuel du familier** : niveau de départ, du niveau minimum (0) au niveau maximum ; son début exact donne
  l'XP totale du familier.
- **XP totale du familier** : XP accumulée depuis le niveau 0 ; elle détermine le niveau actuel et
  la position de la barre.
- **Niveau visé** : objectif choisi par le joueur, indépendant du glissement.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Le joueur passe d'un niveau de départ à un autre en un seul geste, sans saisir de
  nombre, en moins de 3 secondes.
- **SC-002**: Pendant un glissement, « XP à donner » et le pourcentage suivent le repère sans retard
  perceptible (pas de saut visible entre le repère et les chiffres).
- **SC-003**: Après un choix sur la barre, l'XP totale affichée égale exactement le début du niveau
  choisi dans 100 % des niveaux du niveau minimum (0) au niveau maximum.
- **SC-004**: Les mêmes gestes fonctionnent à la souris, au doigt et au clavier ; tout niveau est
  atteignable avec le clavier seul.

## Assumptions

- Le niveau maximum est celui déjà utilisé par la page (niveau 100).
- La courbe d'XP et la fonction qui donne l'XP du début d'un niveau existent déjà et ne changent
  pas.
- La bulle « Niveau N » est un simple repère visuel ; elle n'a pas besoin d'être annoncée en plus
  de la valeur du curseur.
- Le thème sombre et le thème clair reprennent les couleurs actuelles de la barre.
