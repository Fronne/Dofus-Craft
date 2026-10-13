# Feature Specification: Nouveau style visuel pour tout le site

**Feature Branch**: `051-site-visual-refresh`

**Created**: 2026-10-13

**Status**: Draft

**Input**: User description: "Refonte visuelle de tout le site Dofus Craft selon la maquette validée « Version 3 — couleurs plus vivantes » : menu en barre flottante en haut sur écran large, nouvelle palette bleu-vert avec une couleur par rôle (vert pour l'action, or pour les kamas, turquoise pour les liens, ambre et corail pour l'ancienneté des prix), thème clair décliné dans le même esprit, page Recherche à 6 résultats avec bloc verdict mis en valeur et effets colorés par élément. Aucun changement de comportement ni de calcul."

**Maquette de référence** : canevas « Dofus Craft — pistes de charte graphique »
(<https://claude.ai/artifact/Uv5f1SQ9rodZjd2qN8hpXK>), planches « Version 3 — couleurs plus
vivantes » et « Version 3 — filtres ouverts ». La maquette ne montre que le thème sombre de la page
Recherche ; les autres pages et le thème clair s'en déduisent.

## Clarifications

### Session 2026-10-13

- Q: Que devient le réglage « Design » (Classique / Nouveau) ? → A: Le nouveau style remplace les
  deux designs ; le réglage disparaît.
- Q: Que devient le choix de la couleur d'accent (bleu, rouge, vert, violet, orange) ? → A: Il est
  supprimé ; les couleurs sont celles de la maquette pour tout le monde.
- Q: Le style s'applique-t-il à la seule page Recherche ? → A: Non, à tout le site ; la page
  Recherche n'était qu'un essai.
- Q: Et le thème clair ? → A: À décliner dans le même esprit, au jugement de la réalisation.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Un site aux couleurs plus vivantes, partout (Priority: P1)

Le joueur ouvre n'importe quelle page du site en thème sombre et retrouve la même ambiance que la
maquette : fond bleu-vert profond éclairé par des halos de lumière, panneaux teintés légèrement
translucides, titres dans la police d'affichage, et une couleur par rôle — vert pour l'action
principale et l'élément sélectionné, or pour les kamas, turquoise pour les liens et les actions
secondaires, ambre pour un prix qui vieillit, corail pour un prix périmé. Chaque page garde son
organisation et tout ce qu'on peut y faire.

**Why this priority**: c'est le cœur de la demande — le style actuel est jugé terne, et le nouveau
doit s'appliquer à tout le site, pas à une seule page.

**Independent Test**: en thème sombre, parcourir chaque page du site (y compris Paramètres,
l'administration, le choix du serveur et les dialogues) : toutes ont le nouveau style, aucune ne
garde un morceau de l'ancien, et tous les parcours fonctionnent comme avant.

**Acceptance Scenarios**:

1. **Given** le thème sombre, **When** le joueur ouvre une page quelconque, **Then** le fond, les
   panneaux, les champs, les boutons et les textes suivent la palette de la maquette.
2. **Given** une page qui affiche des kamas, des liens, une action principale et des prix anciens,
   **When** le joueur la regarde, **Then** chaque rôle porte toujours la même couleur d'une page à
   l'autre.
3. **Given** le nouveau style, **When** le joueur utilise n'importe quel parcours (recherche,
   saisie de prix, suivi, collections, changement de serveur, visite guidée, calculs),
   **Then** les résultats et les comportements sont identiques à ceux d'avant.
4. **Given** un prix vieillissant ou périmé, **When** il est affiché, **Then** son état est signalé
   par une icône (horloge ou alerte) et un texte, pas seulement par sa couleur.

---

### User Story 2 - Le menu en haut de l'écran (Priority: P1)

Sur un écran large, le joueur trouve la navigation dans une barre flottante en haut de la page :
le logo à gauche, les rubriques au milieu, puis le serveur actif, les paramètres et la bascule de
thème à droite. La rubrique où il se trouve est mise en évidence et marquée d'un losange vert. La
colonne de gauche disparaît et le contenu gagne toute la largeur.

**Why this priority**: c'est la disposition retenue par l'utilisateur, et elle change le cadre de
toutes les pages.

**Independent Test**: sur un écran large, ouvrir chaque rubrique depuis la barre du haut : la
rubrique active est marquée, le contenu occupe la largeur libérée ; sur un petit écran, la
navigation du bas est toujours là, comme avant.

**Acceptance Scenarios**:

1. **Given** un écran large, **When** le joueur ouvre le site, **Then** la navigation est une barre
   en haut de page et il n'y a plus de colonne de menu à gauche.
2. **Given** la barre du haut, **When** le joueur change de rubrique, **Then** la rubrique active
   est mise en évidence et porte le losange vert.
3. **Given** une page longue, **When** le joueur fait défiler le contenu, **Then** la barre reste
   accessible en haut et le contenu qui passe dessous reste deviné sans gêner la lecture de la barre.
4. **Given** un écran étroit (moins de 960 px de large), **When** le joueur ouvre le site, **Then**
   la navigation en bas d'écran est celle d'aujourd'hui, aux nouvelles couleurs.
5. **Given** une rubrique désactivée par l'administration (Forgemagie), **When** le joueur ouvre le
   site, **Then** elle n'apparaît pas dans la barre, comme aujourd'hui dans le menu.

---

### User Story 3 - La page Recherche de la maquette (Priority: P2)

Sur la page Recherche, le joueur voit 6 résultats au lieu de 12, le bouton Filtres à droite du
champ de recherche, et, filtres repliés, les filtres actifs sous forme de pastilles qu'il retire
d'un clic. Quand un objet est sélectionné, la réponse — crafter ou acheter — est mise en valeur
dans un bloc teinté, avec l'économie en or. Dans les effets de l'objet, chaque ligne porte un
losange de la couleur de sa caractéristique.

**Why this priority**: c'est la page qui a servi d'essai et dont chaque détail a été validé ; elle
dépend du nouveau style (histoires 1 et 2) pour prendre tout son sens.

**Independent Test**: chercher une catégorie d'objets, vérifier le nombre de résultats affichés,
retirer un filtre par sa pastille, sélectionner un objet et comparer le bloc verdict, le tableau
des ressources et les effets à la maquette.

**Acceptance Scenarios**:

1. **Given** une recherche qui renvoie plus de 6 objets, **When** les résultats s'affichent,
   **Then** 6 objets sont montrés, avec le total trouvé et le moyen d'en afficher davantage.
2. **Given** des filtres actifs et le panneau replié, **When** le joueur regarde la page, **Then**
   chaque filtre actif apparaît en pastille, et un clic sur une pastille retire ce filtre.
3. **Given** un objet sélectionné dont les prix sont connus, **When** le verdict s'affiche,
   **Then** le choix le plus rentable est mis en valeur dans un bloc teinté, l'économie est en or,
   et les deux montants comparés restent visibles avec leurs barres.
4. **Given** un objet qui a des effets, **When** le joueur lit le bloc Effets, **Then** chaque
   ligne porte un losange de la couleur de sa caractéristique, et le nom de la caractéristique
   reste écrit.
5. **Given** le tableau des ressources, **When** il s'affiche, **Then** la part de chaque ressource
   dans le coût est montrée par une barre turquoise, et les mentions « acheté » et « crafté » se
   distinguent par leur teinte en plus de leur texte.

---

### User Story 4 - Un thème clair dans le même esprit (Priority: P2)

Le joueur qui préfère le thème clair bascule et retrouve le même style : mêmes polices, mêmes
formes, mêmes rôles de couleur, sur un fond clair légèrement teinté de bleu-vert. Tout reste
lisible.

**Why this priority**: le thème clair existe déjà et doit rester utilisable ; l'utilisateur a
laissé sa déclinaison au jugement de la réalisation.

**Independent Test**: basculer en thème clair et parcourir chaque page : même style que le thème
sombre, aucun texte ni icône difficile à lire.

**Acceptance Scenarios**:

1. **Given** le thème sombre, **When** le joueur bascule en thème clair, **Then** toutes les pages
   passent à la version claire du même style, sans rechargement.
2. **Given** le thème clair, **When** le joueur regarde une action principale, des kamas, un lien
   et un prix ancien, **Then** chacun garde la couleur de son rôle, dans une nuance lisible sur
   fond clair.

---

### User Story 5 - Plus de réglages de design ni d'accent (Priority: P3)

Dans Paramètres, le joueur ne trouve plus le choix du design ni celui de la couleur d'accent : le
site a un seul style. Celui qui avait choisi un design ou un accent retrouve simplement le nouveau
style, sans erreur.

**Why this priority**: conséquence des deux décisions de cadrage ; nécessaire pour ne pas laisser
de réglage sans effet, mais sans valeur propre pour le joueur.

**Independent Test**: ouvrir Paramètres après avoir, dans l'ancienne version, choisi le design
« Classique » et l'accent rouge : les deux réglages ont disparu, le site s'affiche dans le nouveau
style, les autres réglages sont intacts.

**Acceptance Scenarios**:

1. **Given** la page Paramètres, **When** le joueur la parcourt, **Then** il n'y a plus de réglage
   « Design » ni de réglage de couleur d'accent, et les autres réglages sont inchangés.
2. **Given** un appareil qui avait mémorisé un design ou un accent, **When** le joueur ouvre le
   site, **Then** le nouveau style s'applique sans erreur et sans trace de l'ancien choix.

---

### Edge Cases

- Fenêtre de largeur intermédiaire, où toutes les rubriques ne tiennent pas sur une ligne à côté du
  logo et des réglages : la barre passe sur deux lignes sans rien masquer ni faire défiler la page
  horizontalement.
- Écran de choix du serveur, affiché avant tout accès au menu : il suit le nouveau style.
- Dialogues, menus déroulants, bulles d'aide et visite guidée : fond opaque ou presque, pour que le
  contenu derrière ne gêne pas la lecture.
- Éléments qui reproduisent le jeu (images d'objets et de ressources, icônes de catégorie et de
  caractéristiques) : leurs couleurs restent celles du jeu.
- Objet ou ressource sans image : la case vide garde la forme et la teinte prévues, sans casser
  l'alignement.
- Effet dont la caractéristique n'a pas de couleur attribuée : le losange prend une teinte neutre.
- Joueur qui demande à réduire les animations (réglage du système) : aucune animation décorative.
- Appareil sur lequel l'effet de translucidité n'est pas disponible : la barre et les panneaux
  restent lisibles, sur un fond opaque.
- Graphiques d'historique de prix : leurs courbes et repères suivent la nouvelle palette et restent
  lisibles dans les deux thèmes.

## Requirements *(mandatory)*

### Functional Requirements

**Style commun**

- **FR-001**: Toutes les pages et tous les composants du site (pages de contenu, Paramètres,
  administration, choix du serveur, dialogues, menus, bulles, visite guidée, bandeaux
  d'information, états de chargement, états vides et messages d'erreur) MUST adopter le nouveau
  style ; aucun élément ne garde l'ancienne palette.
- **FR-002**: En thème sombre, le site MUST reprendre la palette de la maquette : fond bleu-vert
  très sombre avec halos de lumière, panneaux bleu-vert légèrement translucides, champs et zones en
  creux plus sombres que les panneaux.
- **FR-003**: Chaque couleur MUST garder le même rôle sur tout le site : vert pour l'action
  principale, l'état sélectionné et le choix le plus rentable ; or pour les montants en kamas mis en
  avant et le symbole des kamas ; turquoise pour les liens, les actions secondaires et les barres de
  répartition ; ambre pour un avertissement ou un prix vieillissant ; corail pour une erreur, une
  action destructive ou un prix périmé.
- **FR-004**: Les titres MUST utiliser la police d'affichage de la maquette et les textes la police
  de lecture de la maquette, avec des chiffres alignés en colonnes partout où des montants se
  comparent.
- **FR-005**: Le motif du losange MUST servir de marqueur commun (rubrique active, puces, cases
  vides, pastille du verdict), comme dans la maquette.
- **FR-006**: Une information portée par une couleur (ancienneté d'un prix, choix gagnant, élément
  sélectionné, mention « acheté » / « crafté », élément d'un effet) MUST aussi être portée par un
  texte, une icône ou une forme.
- **FR-007**: Dans les deux thèmes, tout texte MUST avoir un contraste d'au moins 4,5:1 avec son
  fond, et toute icône porteuse de sens ou tout contour de champ un contraste d'au moins 3:1.
- **FR-008**: Tout élément cliquable MUST offrir une zone d'au moins 44 px de côté et un indicateur
  de focus visible au clavier.
- **FR-009**: Les éléments qui reproduisent le jeu (images d'objets et de ressources, icônes de
  catégorie et de caractéristiques) MUST garder leurs couleurs d'origine.
- **FR-010**: Le site MUST NOT utiliser de visuels appartenant à l'éditeur du jeu au-delà des
  images d'objets et d'icônes déjà affichées aujourd'hui.
- **FR-011**: Les animations décoratives MUST être supprimées quand le joueur a demandé à réduire
  les animations.

**Navigation**

- **FR-012**: Sur un écran d'au moins 960 px de large, la navigation MUST être une barre en haut de
  page contenant, dans cet ordre, le logo, les rubriques, puis le serveur actif, l'accès aux
  paramètres et la bascule de thème ; la colonne de menu à gauche MUST disparaître.
- **FR-013**: La barre MUST proposer exactement les rubriques et les accès que le menu propose
  aujourd'hui, y compris la règle d'affichage des rubriques activables par l'administration.
- **FR-014**: La rubrique active MUST être mise en évidence par sa couleur, son fond et un losange
  vert.
- **FR-015**: La barre MUST rester accessible pendant le défilement de la page et rester lisible
  quel que soit le contenu qui passe dessous.
- **FR-016**: Sous 960 px de large, la navigation en bas d'écran MUST garder son organisation
  actuelle et adopter les nouvelles couleurs.
- **FR-017**: Quelle que soit la largeur, la page MUST NOT défiler horizontalement ni masquer une
  rubrique.

**Thème clair**

- **FR-018**: Le thème clair MUST décliner le même style : mêmes polices, mêmes formes, mêmes rôles
  de couleur, dans des nuances adaptées à un fond clair.
- **FR-019**: La bascule entre thème clair et thème sombre MUST continuer de s'appliquer
  immédiatement et d'être mémorisée sur l'appareil, comme aujourd'hui.

**Page Recherche**

- **FR-020**: La page Recherche MUST afficher 6 résultats par défaut, avec le nombre total trouvé
  et le moyen d'en afficher davantage.
- **FR-021**: Le bouton Filtres MUST se trouver à droite du champ de recherche et indiquer le
  nombre de filtres actifs ; les filtres MUST être repliés par défaut.
- **FR-022**: Les filtres actifs MUST rester visibles, panneau replié, sous forme de pastilles
  retirables d'un clic, accompagnées d'une action pour tout réinitialiser.
- **FR-023**: Le verdict MUST être présenté dans un bloc teinté de la couleur du choix gagnant,
  avec l'économie en or et les deux montants comparés par des barres.
- **FR-024**: Dans le tableau des ressources, la part de chaque ressource dans le coût MUST être
  montrée par une barre, et l'ancienneté de chaque prix par une icône (horloge ou alerte) et un
  texte.
- **FR-025**: Dans le bloc Effets, chaque ligne MUST porter un losange de la couleur de sa
  caractéristique ; une caractéristique sans couleur attribuée MUST prendre une teinte neutre.

**Réglages et continuité**

- **FR-026**: Le réglage « Design » et le réglage de couleur d'accent MUST disparaître de
  Paramètres ; les deux anciens designs MUST être retirés du site.
- **FR-027**: Un choix de design ou d'accent mémorisé sur un appareil MUST être ignoré sans erreur.
- **FR-028**: Les calculs, les données affichées, les parcours et les textes d'explication
  MUST rester identiques, à l'exception du nombre de résultats affichés
  par défaut sur la page Recherche et de la disparition des deux réglages.
- **FR-029**: Le document de règles visuelles du projet MUST décrire le nouveau style et ne plus
  décrire les anciens designs ni les accents.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100 % des pages et des dialogues du site sont dans le nouveau style dans les deux
  thèmes ; une revue page par page ne trouve aucun élément resté dans l'ancienne palette.
- **SC-002**: Sur la page Recherche en thème sombre, à 1440 px de large, une comparaison côte à
  côte avec la maquette ne montre aucun écart de disposition, de couleur ou de police sur les blocs
  validés (barre de menu, recherche et pastilles, résultats, verdict, ressources, effets).
- **SC-003**: Dans les deux thèmes, aucun texte n'a un contraste inférieur à 4,5:1 et aucune icône
  porteuse de sens un contraste inférieur à 3:1.
- **SC-004**: De 320 px à 1920 px de large, aucune page ne défile horizontalement et toutes les
  rubriques restent atteignables.
- **SC-005**: Tous les tests automatisés existants passent sans qu'aucune attente portant sur un
  calcul ou une donnée n'ait été modifiée.
- **SC-006**: Sur écran large, le contenu de chaque page dispose d'au moins 200 px de largeur de
  plus qu'avec la colonne de menu.
- **SC-007**: L'utilisateur, en parcourant le site réalisé, confirme qu'il retrouve la maquette
  qu'il a validée et ne le juge plus terne.

## Assumptions

- La maquette validée fait foi pour la page Recherche en thème sombre ; pour les autres pages, on
  applique les mêmes couleurs, polices et composants communs sans changer leur mise en page.
- Le seuil de 960 px entre la barre du haut et la navigation du bas est celui qu'utilise déjà le
  site pour passer du menu latéral à la navigation du bas.
- Le thème clair n'a pas été maquetté ; il est conçu pendant la réalisation et soumis à
  l'utilisateur avant la fusion.
- La suppression des deux anciens designs est conforme à ce que prévoyait déjà la spec
  `012-modern-design` (« le design non retenu sera supprimé »).
- Le lien « Afficher 12 de plus » de la maquette est conservé tel quel : on affiche 6 résultats,
  puis 12 de plus à chaque demande.
- Les couleurs par caractéristique du bloc Effets sont celles de la maquette (Vitalité, Force,
  Intelligence, Sagesse, Critique, Portée, résistances Feu / Eau / Air) ; les caractéristiques non
  montrées (Chance, Agilité, Terre, Neutre…) reçoivent une couleur cohérente avec leur élément.
- Les polices de la maquette sont libres de droits et peuvent être servies par le site.
- Le thème du site suit le choix du joueur mémorisé sur l'appareil, comme aujourd'hui ; ce
  mécanisme n'est pas modifié.
