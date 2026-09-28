# Feature Specification: Page Saisie HDV — relever les prix par hôtel des ventes

**Feature Branch**: `023-hdv-price-entry`

**Created**: 2026-09-28

**Status**: Draft

**Input**: User description: « Page « Saisie HDV » : permettre de saisir les prix des objets par
hôtel des ventes (HDV) du jeu, avec un onglet par HDV — Ressources, Consommables, Animaux
(croquettes pour nourrir les familiers, etc.). Aujourd'hui, un prix de ressource ne peut être saisi
que depuis la page Recherche, dans la recette d'un objet : les ressources qui n'entrent dans aucune
recette consultée (notamment les croquettes de l'HDV Animaux et les objets de l'HDV Consommables)
n'ont jamais de prix, ce qui limite la page Familier (qui masque les ressources sans prix). Chaque
onglet liste les objets de cet HDV avec recherche par nom et filtre par type, et un champ de prix
par ligne réutilisant le comportement de saisie existant (date de mise à jour, serveur actif, mode
personnel / communautaire avec partage). Les prix saisis alimentent automatiquement les pages
Recherche, Prix et Familier. Le but est de reproduire le geste en jeu : aller à un HDV et relever
ses prix d'un coup. »

Contexte donné par le porteur du projet : jusqu'ici, seuls les prix des objets de l'HDV Ressources
ont été relevés ; le reste des ressources se vend à l'HDV Consommables, et les croquettes qui
nourrissent les familiers à l'HDV Animaux.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Relever les prix d'un HDV d'un seul passage (Priority: P1)

Le joueur est devant un HDV en jeu. Il ouvre la page Saisie HDV, choisit l'onglet de cet HDV
(Ressources, Consommables ou Animaux) et voit la liste des objets vendus à cet HDV. Il saisit les
prix qu'il lit en jeu, ligne après ligne, sans quitter la page ni ouvrir la recette d'un objet.

**Why this priority**: c'est le besoin exprimé : des objets n'ont aujourd'hui aucun moyen d'avoir
un prix, faute d'apparaître dans une recette.

**Independent Test**: ouvrir l'onglet Animaux, saisir le prix d'une croquette, puis vérifier que ce
prix est enregistré avec sa date sur le serveur actif et qu'il est toujours là après rechargement.

**Acceptance Scenarios**:

1. **Given** la page Saisie HDV ouverte, **When** le joueur choisit l'onglet Animaux, **Then** la
   liste montre les objets vendus à l'HDV Animaux dont l'app peut utiliser le prix, dont les
   croquettes, chacun avec son nom, son icône et un champ de prix.
2. **Given** un objet sans prix connu, **When** le joueur saisit un prix valide et quitte le champ,
   **Then** le prix est enregistré pour le serveur actif et le mode de prix actif, et la ligne
   affiche « Dernière mise à jour : à l'instant ».
3. **Given** un objet qui a déjà un prix, **When** la liste s'affiche, **Then** son champ montre ce
   prix et sa date, avec le même signalement des prix anciens que la page Recherche.
4. **Given** le joueur saisit des prix sur plusieurs lignes à la suite, **When** il passe d'un champ
   au suivant, **Then** chaque prix est enregistré sans action supplémentaire.

---

### User Story 2 - Retrouver vite un objet dans un HDV (Priority: P1)

Dans un onglet, le joueur filtre la liste par nom et par type d'objet (par exemple « Potion »,
« Nourriture pour familier »), comme il le ferait dans l'interface de l'HDV en jeu.

**Why this priority**: un HDV contient des centaines d'objets ; sans recherche ni filtre, la saisie
n'est pas praticable.

**Independent Test**: dans l'onglet Consommables, choisir le type « Potion » puis taper une partie
d'un nom ; vérifier que seuls les objets de ce type dont le nom correspond restent affichés.

**Acceptance Scenarios**:

1. **Given** l'onglet Consommables, **When** le joueur tape « pot » dans la recherche, **Then**
   seuls les objets de cet HDV dont le nom contient « pot » (sans tenir compte des accents ni de la
   casse) restent affichés.
2. **Given** un onglet, **When** le joueur choisit un type dans le filtre, **Then** seuls les objets
   de ce type restent affichés ; le filtre ne propose que les types présents dans cet HDV.
3. **Given** aucun objet ne correspond, **When** la liste se met à jour, **Then** la page l'indique
   clairement.

---

### User Story 3 - Les prix relevés servent partout dans l'app (Priority: P1)

Un prix saisi sur la page Saisie HDV est le même prix que celui de la page Recherche pour cet objet :
il est utilisé par le coût de craft (Recherche), la liste des bénéfices (Prix) et les
recommandations de la page Familier.

**Why this priority**: sans cela, la saisie ne sert à rien ; c'est ce qui débloque la page Familier.

**Independent Test**: saisir le prix d'une croquette sur la page Saisie HDV, ouvrir la page
Familier et vérifier que cette croquette apparaît dans les ressources avec ce prix.

**Acceptance Scenarios**:

1. **Given** un prix saisi sur la page Saisie HDV, **When** le joueur ouvre la recette d'un objet
   qui utilise cet objet comme ingrédient sur la page Recherche, **Then** le même prix et la même
   date y apparaissent.
2. **Given** un prix modifié sur la page Recherche, **When** le joueur revient sur la page Saisie
   HDV, **Then** il y voit le prix modifié.
3. **Given** le prix d'une nourriture pour familier saisi sur la page Saisie HDV, **When** le joueur
   ouvre la page Familier, **Then** cette nourriture est prise en compte dans les recommandations.

---

### User Story 4 - Voir où il reste des prix à relever (Priority: P3)

Le joueur voit, pour l'onglet ouvert, combien d'objets ont un prix et peut n'afficher que ceux qui
n'en ont pas, ou dont le prix est ancien, pour cibler son prochain passage à l'HDV.

**Why this priority**: confort ; la saisie fonctionne sans, mais cela évite de relire des centaines
de lignes déjà à jour.

**Independent Test**: dans un onglet où certains objets ont un prix, activer « Sans prix » et
vérifier que seuls les objets sans prix connu restent affichés, avec le bon décompte.

**Acceptance Scenarios**:

1. **Given** un onglet ouvert, **When** la liste s'affiche, **Then** la page indique « N objets sur
   M ont un prix » pour cet HDV, sur le serveur et le mode actifs.
2. **Given** le filtre « Sans prix » activé, **When** la liste se met à jour, **Then** seuls les
   objets sans prix connu restent affichés.
3. **Given** le filtre « Prix ancien » activé, **When** la liste se met à jour, **Then** seuls les
   objets dont le prix est signalé comme ancien (même règle que la page Recherche) restent affichés.

---

### Edge Cases

- Objet non échangeable (lié au compte, introuvable à l'HDV) : jamais listé.
- Objet dont le type n'est rattaché à aucun des trois HDV : jamais listé ; il n'est pas deviné.
- Un même objet ne doit apparaître que dans un seul onglet : celui de l'HDV où il se vend en jeu.
- Saisie invalide (texte, nombre négatif, zéro) : refusée avec le même message que la page
  Recherche ; aucun prix n'est enregistré.
- Champ vidé : même comportement que la page Recherche pour un prix effacé.
- Aucun serveur choisi : la page invite à choisir un serveur, comme les autres pages.
- Catalogue des objets indisponible (hors ligne, source injoignable) : la page l'indique ; les prix
  déjà saisis ne sont pas perdus.
- Changement de serveur ou de mode de prix pendant la saisie : la liste affiche aussitôt les prix du
  nouveau serveur ou mode ; un prix déjà saisi reste enregistré sur l'ancien.
- Mode communautaire, prix très éloigné des prix connus : même demande de confirmation que la page
  Recherche avant partage.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: L'app MUST proposer une page Saisie HDV accessible depuis la navigation principale.
- **FR-002**: La page MUST proposer trois onglets, un par HDV du jeu : Ressources, Consommables,
  Animaux. L'onglet ouvert est mémorisé sur l'appareil pour la visite suivante.
- **FR-003**: Chaque onglet MUST lister les objets échangeables vendus à cet HDV en jeu, d'après une
  correspondance entre types d'objets et HDV tirée des données du jeu, dont la source est
  documentée. Un objet apparaît dans un seul onglet.
- **FR-004**: Les onglets MUST exclure les objets dont l'app n'utilise pas le prix d'une ressource
  (familiers, montures, certificats de monture et autres équipements vendus à l'HDV Animaux).
- **FR-005**: Chaque ligne MUST afficher le nom et l'icône de l'objet, son type, et un champ de prix
  unitaire avec la date de dernière mise à jour.
- **FR-006**: Le champ de prix MUST se comporter exactement comme celui des ingrédients de la page
  Recherche : même validation, même enregistrement (serveur actif, mode de prix actif), même
  signalement des prix anciens, même verrouillage et même partage en mode communautaire, même
  demande de confirmation d'un prix inhabituel, même accès à l'historique des prix.
- **FR-007**: Un prix saisi sur la page Saisie HDV MUST être le même prix que celui de cet objet
  partout ailleurs dans l'app (Recherche, Prix, Familier), dans les deux sens.
- **FR-008**: Le joueur MUST pouvoir filtrer la liste d'un onglet par nom (sans tenir compte des
  accents ni de la casse) et par type d'objet ; le filtre de type ne propose que les types de cet
  HDV.
- **FR-009**: La liste MUST être triée par nom par défaut et rester fluide avec plusieurs centaines
  d'objets (chargement progressif au défilement, comme la page Prix).
- **FR-010**: La page MUST indiquer, pour l'onglet ouvert, combien d'objets ont un prix sur le
  serveur et le mode actifs, et permettre de n'afficher que les objets sans prix ou avec un prix
  ancien.
- **FR-011**: Quand le catalogue d'un HDV ne peut pas être chargé, la page MUST l'indiquer sans
  afficher de liste partielle présentée comme complète.

### Key Entities

- **HDV**: un hôtel des ventes du jeu (Ressources, Consommables, Animaux) : son nom et les types
  d'objets qu'il vend.
- **Correspondance type → HDV**: pour chaque type d'objet vendu, l'HDV où il se vend en jeu ; donnée
  fixe tirée du jeu, avec sa source et sa date de relevé.
- **Objet d'HDV**: un objet échangeable d'un type rattaché à un HDV : nom, icône, type.
- **Prix relevé**: le prix unitaire existant de l'app (par objet, serveur et mode, avec sa date) ;
  aucune nouvelle sorte de prix n'est créée.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un joueur relève 20 prix d'un même HDV en moins de 3 minutes, sans quitter la page.
- **SC-002**: 100 % des objets vendus aux trois HDV en jeu et utilisables par l'app sont trouvables
  dans le bon onglet ; aucun objet n'apparaît dans un onglet où il ne se vend pas.
- **SC-003**: Un prix saisi sur la page Saisie HDV est visible avec la même valeur et la même date
  sur les pages Recherche, Prix et Familier, sans action supplémentaire.
- **SC-004**: Après la saisie des prix de l'HDV Animaux, la page Familier recommande des nourritures
  qu'elle écartait auparavant faute de prix.
- **SC-005**: Filtrer ou rechercher dans un onglet met la liste à jour sans délai perceptible (moins
  d'une seconde).

## Assumptions

- Les trois HDV couverts sont Ressources, Consommables et Animaux. Les HDV d'équipements, d'armes et
  les autres HDV sont hors périmètre : le prix HDV d'un objet craftable se saisit déjà depuis la
  page Recherche.
- La catégorie d'objet donnée par la source actuelle du catalogue ne suffit pas à trouver l'HDV : la
  nourriture pour familier y est classée en « Ressources » alors qu'elle se vend à l'HDV Animaux. La
  correspondance type → HDV vient donc des données du jeu (fichiers du client installé du porteur du
  projet si besoin) ; le plan vérifiera où la trouver.
- Le prix saisi est un prix unitaire, comme partout dans l'app ; le joueur fait lui-même la division
  quand l'HDV affiche un lot de 10 ou de 100.
- Le prix est enregistré dans le même carnet que les prix d'ingrédients, par serveur et par mode ;
  en mode communautaire, il est partagé avec le groupe comme une saisie de la page Recherche.
- La liste des objets d'un HDV change très rarement ; elle peut être gardée en cache comme le reste
  du catalogue.
- Le groupe d'utilisateurs est petit (une dizaine à une vingtaine de joueurs) ; aucune contrainte de
  volume particulière.
