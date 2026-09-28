# Feature Specification: Page Prix — bénéfice de craft par objet

**Feature Branch**: `019-craft-profit-list`

**Created**: 2026-09-26

**Status**: Draft

**Input**: User description: « Pour la page Prix j'aimerais la refaire complètement pour afficher les
objets avec le bénéfice réalisé si on craft. » Choix du porteur du projet : lister tous les objets
calculables sur le serveur actif ; prix selon le mode actif (comme la page Recherche) ; coût de
craft calculé comme le choix « Auto » ; la page actuelle est entièrement remplacée.

## Revisions

- 2026-09-28 : la page « Prix » est renommée « Rentabilité » (navigation et titre), à la demande du
  porteur du projet qui trouvait le nom peu clair ; son adresse devient `/rentabilite`, l'ancienne
  adresse `/prix` y redirige.

## Clarifications

### Session 2026-09-26

- Q: Comment trier la liste et quel bénéfice afficher ? → A: bénéfice en kamas et en % du coût de
  craft, avec un choix de tri (kamas ou %), kamas par défaut.
- Q: Faut-il écarter ou signaler les prix anciens ? → A: tous les objets sont gardés, avec la date
  du prix HDV affichée sur la ligne.
- Q: Faut-il déduire la taxe de mise en vente de l'HDV du bénéfice ? → A: non, comme la page
  Recherche.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Voir les objets rentables à crafter (Priority: P1)

Le joueur ouvre la page Prix. Il voit la liste des objets dont tous les prix sont connus sur le
serveur actif, avec pour chacun le prix HDV, le coût de craft et le bénéfice (prix HDV − coût de
craft), triée du plus gros bénéfice au plus petit.

**Why this priority**: c'est la raison d'être de la nouvelle page : savoir d'un coup d'œil quoi
crafter pour gagner des kamas.

**Independent Test**: avec trois objets calculables (bénéfice +5 000, −2 000, +12 000) et un objet
dont une ressource n'a pas de prix, vérifier que la page liste les trois premiers dans l'ordre
+12 000, +5 000, −2 000, et pas le quatrième.

**Acceptance Scenarios**:

1. **Given** un objet dont le prix HDV et le prix de chaque ressource nécessaire sont connus,
   **When** le joueur ouvre la page Prix, **Then** l'objet apparaît avec son prix HDV, son coût de
   craft et son bénéfice en kamas.
2. **Given** plusieurs objets calculables, **When** la page s'affiche, **Then** ils sont triés par
   bénéfice décroissant.
3. **Given** la liste triée par kamas, **When** le joueur choisit le tri par marge, **Then** les
   objets sont triés par marge en % décroissante.
4. **Given** un objet dont il manque le prix HDV ou le prix d'une ressource nécessaire, **When** la
   page s'affiche, **Then** cet objet n'apparaît pas.
5. **Given** un objet dont le coût de craft dépasse le prix HDV, **When** la page s'affiche,
   **Then** son bénéfice est affiché négatif et visuellement distinct d'un bénéfice positif.
6. **Given** une ligne d'objet, **When** le joueur la choisit, **Then** il arrive sur la page
   Recherche avec cet objet ouvert, pour voir le détail du calcul.

---

### User Story 2 - Même calcul que la page Recherche (Priority: P1)

Le coût de craft et le bénéfice affichés sur la page Prix sont ceux que la page Recherche afficherait
pour le même objet avec le choix « Auto » sur chaque ingrédient.

**Why this priority**: deux chiffres différents pour le même objet détruiraient la confiance dans
l'outil (constitution, principe III).

**Independent Test**: pour un objet avec un ingrédient craftable moins cher à crafter qu'à acheter,
comparer le coût de craft de la page Prix et celui de la page Recherche en « Auto ».

**Acceptance Scenarios**:

1. **Given** un ingrédient craftable dont le craft coûte moins cher que l'achat, **When** le coût de
   craft est calculé, **Then** cet ingrédient est compté à son coût de craft.
2. **Given** un ingrédient craftable dont l'achat est moins cher, ou dont le craft n'est pas
   calculable faute de prix, **When** le coût est calculé, **Then** il est compté à son prix
   d'achat.
3. **Given** un ingrédient craftable sans prix d'achat mais dont le craft est calculable, **When**
   le coût est calculé, **Then** l'objet reste calculable avec le coût de craft de cet ingrédient.
4. **Given** le Mode communautaire, **When** la page s'affiche, **Then** elle utilise les prix
   partagés (médiane pour les ressources, prix le plus récent pour les objets) ; **Given** le Mode
   personnel, **Then** elle utilise le carnet de l'appareil ; comme la page Recherche.

---

### User Story 3 - Retrouver un objet dans la liste (Priority: P2)

Le joueur filtre la liste par nom et limite le nombre de lignes affichées.

**Why this priority**: utile dès que la liste est longue, mais la liste triée seule apporte déjà la
valeur principale.

**Independent Test**: taper une partie d'un nom d'objet et vérifier que seuls les objets
correspondants restent, toujours triés par bénéfice.

**Acceptance Scenarios**:

1. **Given** une liste d'objets, **When** le joueur tape « amul », **Then** seuls les objets dont le
   nom contient « amul » (sans tenir compte des accents ni de la casse) restent affichés.
2. **Given** plus de 25 objets, **When** la page s'affiche, **Then** les 25 premiers selon le tri
   sont affichés avec le nombre total d'objets calculables, et les suivants apparaissent quand le
   joueur fait défiler jusqu'au bas de la liste.

---

### Edge Cases

- Aucun serveur actif : la page invite à choisir un serveur, comme aujourd'hui.
- Aucun objet calculable : un état vide explique qu'il faut des prix HDV et des prix de ressources, et
  renvoie vers la page Recherche.
- Bénéfice nul : affiché « 0 kamas » et « 0 % », ni positif ni négatif.
- Deux objets à égalité sur le critère de tri : départagés par nom, dans l'ordre alphabétique.
- Recette qui contient un ingrédient craftable à plusieurs niveaux : le choix « Auto » s'applique à
  chaque niveau, comme sur la page Recherche.
- Service communautaire injoignable en Mode communautaire : la page affiche qu'elle ne peut pas
  charger les prix partagés, sans valeur inventée.
- Changement de mode ou de serveur pendant que la page est ouverte : la liste se recalcule.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La page Prix MUST être remplacée par une liste d'objets avec leur bénéfice de craft ;
  les anciennes listes de prix des objets et des ressources MUST disparaître de cette page.
- **FR-002**: La liste MUST contenir chaque objet du catalogue qui a une recette et pour lequel, sur
  le serveur actif et dans le mode actif, le prix HDV est connu et le coût de craft est calculable
  (chaque ingrédient a un prix d'achat ou un coût de craft calculable).
- **FR-003**: Pour chaque objet, la ligne MUST afficher son nom, son visuel, son prix HDV, son coût de
  craft, son bénéfice (prix HDV − coût de craft) en kamas et sa marge en % du coût de craft
  (bénéfice ÷ coût de craft × 100, arrondie à l'unité), ainsi que la date du prix HDV utilisé
  (même présentation que la date de mise à jour du champ « Prix HDV » de la page Recherche). Aucun
  objet n'est écarté à cause de l'âge de ses prix.
- **FR-004**: Le coût de craft MUST être celui de la page Recherche avec le choix « Auto » sur chaque
  ingrédient à tous les niveaux (specs/015), sans tenir compte des choix « Acheter » / « Crafter »
  faits manuellement sur la page Recherche.
- **FR-005**: Les prix MUST suivre le mode actif, avec les mêmes règles que la page Recherche :
  Mode communautaire → prix partagés (specs/004, specs/016) ; Mode personnel → carnet de l'appareil
  et prix HDV saisis (specs/002, specs/005).
- **FR-006**: Le joueur MUST pouvoir trier la liste uniquement en cliquant sur l'en-tête d'une
  colonne (Objet, Prix HDV, Coût de craft, Bénéfice, Marge) : un premier clic trie du plus grand au
  plus petit (de A à Z pour le nom), un second inverse l'ordre ; par défaut, bénéfice en kamas
  décroissant (révision du 2026-09-26, à la demande du porteur du projet : plus de menu « Trier
  par », la marge devient une colonne) ; un bénéfice négatif MUST être distinct visuellement d'un bénéfice
  positif.
- **FR-007**: Le joueur MUST pouvoir filtrer la liste par nom (sans accents ni casse)  ; la liste
  s'affiche par défilement infini, 25 objets de plus à chaque fois que le bas de la liste approche
  (révision du 2026-09-26 : plus de sélecteur « Afficher ») ; le nombre total d'objets calculables MUST rester
  visible.
- **FR-008**: Choisir une ligne MUST ouvrir la page Recherche sur cet objet.
- **FR-009**: Les objets non calculables MUST NOT apparaître, et aucune valeur MUST NOT être inventée
  pour compléter un prix manquant (constitution, principe I).
- **FR-010**: La page MUST se recalculer quand le serveur actif ou le mode change.
- **FR-011**: La page MUST rester lisible sur un écran de téléphone, sans défilement horizontal.

### Key Entities *(include if feature involves data)*

- **Objet rentable (ligne)** : un objet craftable, son prix HDV, son coût de craft (« Auto ») et son
  bénéfice, pour le serveur et le mode actifs. Calculé, jamais saisi.
- **Prix existants** : prix HDV des objets et prix des ressources, selon le mode (carnet local ou
  prix partagés). Aucune nouvelle donnée saisie par cette page.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Pour 100 % des objets listés, le coût de craft et le bénéfice sont égaux à ceux de la
  page Recherche en « Auto » pour le même objet, serveur et mode.
- **SC-002**: Le joueur identifie l'objet le plus rentable du serveur en moins de 5 secondes après
  l'ouverture de la page (il est en tête de liste).
- **SC-003**: Aucun objet sans prix HDV ou avec une ressource sans prix (ni achat, ni craft
  calculable) n'apparaît dans la liste.
- **SC-004**: La liste s'affiche en moins de 3 secondes dans des conditions réseau normales pour le
  volume de prix du groupe.

## Assumptions

- Le public est un petit groupe fermé (10 à 20 joueurs) : le nombre d'objets ayant un prix HDV connu
  reste de l'ordre de quelques dizaines à quelques centaines par serveur.
- En Mode communautaire, le service communautaire devra pouvoir fournir la liste des objets ayant un
  prix HDV partagé et les prix partagés des ressources pour un serveur ; aujourd'hui, ces prix se
  lisent un par un. Le plan décidera comment (hors périmètre de la spec).
- Le bénéfice ne tient pas compte de la taxe de mise en vente de l'HDV ni du temps de craft, comme
  la comparaison de la page Recherche (confirmé le 2026-09-26).
- Le métier de craft du joueur n'est pas pris en compte.
- Les éventuels choix « Acheter » / « Crafter » faits sur la page Recherche ne changent pas la page
  Prix, qui reste en « Auto » pour pouvoir comparer tous les objets de la même façon.
