# Feature Specification: Collections d'objets épinglés

**Feature Branch**: `005-pinned-item-collections`

**Created**: 2026-09-17

**Status**: Draft

**Input**: User description: "Pour les items épinglés, réfléchir à mettre en place un système peut-être
de collection avec des noms pour ranger les items par groupe de collection." Après recommandation
proposée puis validée avec le joueur : chaque objet épinglé peut appartenir à zéro ou une seule
collection nommée (pas un système de tags à appartenances multiples), la page Épinglés regroupe
l'affichage par nom de collection avec un groupe distinct « Sans collection » pour le reste, et les
objets déjà épinglés avant cette fonctionnalité doivent y apparaître automatiquement, sans perte ni
action requise du joueur.

## Terminologie affichée (révision 2026-09-24)

Les termes de cette spec sont les termes de conception d'origine. Dans l'interface, ils sont
désormais affichés ainsi, sans aucun changement de comportement ni de données stockées :

| Terme de la spec | Libellé affiché |
|---|---|
| page Épinglés | page **Suivis** (adresse `/suivis`, l'ancienne `/epingles` y redirige) |
| Épingler / Désépingler | **Suivre** / **Ne plus suivre** |
| objet épinglé | objet **suivi** |
| collection | **liste** (« + Nouvelle liste », « Renommer la liste … », « Supprimer la liste … ») |
| « Sans collection » | « **Sans liste** » |

Raison : « collection » évoque dans Dofus les panoplies ou les objets qu'on collectionne, et
« épinglé » ne disait pas ce que fait la page (surveiller le coût de craft et le prix HDV).

Le montant « Craft : … » des cartes suit les règles de specs/015-intermediate-craft-costs (coût
retenu des ingrédients craftables) : il est toujours identique au coût de craft de la fiche.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Organiser ses objets épinglés en collections nommées (Priority: P1)

Un joueur qui a plusieurs objets épinglés peut créer une collection avec un nom de son choix (par
exemple « Set PvP » ou « Ressources à surveiller ») et y assigner un ou plusieurs de ses objets déjà
épinglés, directement depuis la page Épinglés. Il retrouve ensuite ses objets regroupés visuellement
par collection sur cette page, avec un groupe « Sans collection » pour ceux qu'il n'a pas classés —
y compris tous les objets qu'il avait déjà épinglés avant l'apparition de cette fonctionnalité.

**Why this priority**: C'est la valeur centrale de la demande : sans ça, rien d'autre n'a de sens.
Une liste d'épinglés qui grandit devient vite difficile à parcourir ; pouvoir la ranger par thème
résout directement ce problème.

**Independent Test**: Avec plusieurs objets déjà épinglés, créer une collection depuis la page
Épinglés, y assigner deux d'entre eux, et constater que la page affiche désormais deux groupes
distincts (la nouvelle collection, et « Sans collection » pour le reste) sans qu'aucun objet ne
disparaisse.

**Acceptance Scenarios**:

1. **Given** un joueur a plusieurs objets épinglés sans aucune collection, **When** il consulte la
   page Épinglés, **Then** tous ses objets apparaissent dans un unique groupe « Sans collection »,
   exactement comme avant l'introduction de cette fonctionnalité.
2. **Given** la page Épinglés, **When** le joueur crée une nouvelle collection avec un nom de son
   choix et y assigne un objet épinglé, **Then** cet objet apparaît désormais dans un groupe portant
   ce nom, et disparaît du groupe « Sans collection ».
3. **Given** une collection existante contenant déjà un objet, **When** le joueur assigne un second
   objet épinglé à cette même collection, **Then** les deux objets apparaissent ensemble dans ce même
   groupe.
4. **Given** un objet déjà assigné à une collection, **When** le joueur l'assigne à une autre
   collection, **Then** il n'apparaît plus que dans la nouvelle, jamais dans les deux à la fois.
5. **Given** un objet épinglé avant l'introduction des collections, **When** le joueur consulte la
   page Épinglés pour la première fois après la mise à jour, **Then** cet objet apparaît dans
   « Sans collection » sans qu'aucune action de sa part n'ait été nécessaire, et sans qu'il ait perdu
   ses informations (prix, niveau, etc.).

---

### User Story 2 - Choisir une collection dès l'épinglage (Priority: P2)

Depuis la recherche, au moment même où il épingle un nouvel objet, un joueur peut directement choisir
une collection existante ou en créer une nouvelle, sans avoir besoin de repasser ensuite par la page
Épinglés pour le ranger.

**Why this priority**: C'est un raccourci de confort qui évite un aller-retour, mais la fonctionnalité
reste pleinement utilisable sans lui grâce à l'assignation a posteriori de la User Story 1.

**Independent Test**: Depuis la recherche, épingler un nouvel objet en choisissant une collection
existante au moment de l'épingler, puis constater sur la page Épinglés qu'il apparaît directement
dans le bon groupe, sans étape supplémentaire.

**Acceptance Scenarios**:

1. **Given** un joueur épingle un objet depuis la recherche, **When** il choisit une collection
   existante au moment de l'épingler, **Then** l'objet apparaît directement dans cette collection sur
   la page Épinglés, sans étape supplémentaire.
2. **Given** un joueur épingle un objet depuis la recherche, **When** il crée une nouvelle collection
   à ce moment-là plutôt que d'en choisir une existante, **Then** cette collection existe ensuite sur
   la page Épinglés avec cet objet dedans.
3. **Given** un joueur épingle un objet depuis la recherche, **When** il n'assigne aucune collection,
   **Then** l'objet apparaît dans « Sans collection », exactement comme le comportement actuel sans
   cette fonctionnalité.

---

### User Story 3 - Renommer ou supprimer une collection (Priority: P3)

Un joueur peut renommer une collection existante — ses objets restent groupés ensemble sous le
nouveau nom — ou la supprimer, auquel cas ses objets repassent dans « Sans collection » plutôt que
d'être désépinglés.

**Why this priority**: C'est une action de maintenance ponctuelle (corriger un nom, réorganiser),
utile mais moins fréquente que créer et consulter des collections.

**Independent Test**: Renommer une collection contenant des objets et vérifier qu'ils restent groupés
ensemble sous le nouveau nom ; supprimer une collection et vérifier que ses objets réapparaissent
dans « Sans collection » plutôt que de disparaître de la page.

**Acceptance Scenarios**:

1. **Given** une collection existante contenant des objets, **When** le joueur la renomme, **Then**
   tous ses objets restent groupés ensemble, désormais affichés sous le nouveau nom.
2. **Given** une collection existante contenant des objets, **When** le joueur la supprime, **Then**
   ces objets réapparaissent dans « Sans collection » et restent épinglés avec toutes leurs
   informations, et le groupe portant l'ancien nom n'apparaît plus.
3. **Given** deux collections distinctes, **When** le joueur renomme l'une avec le nom exact de
   l'autre, **Then** leurs objets se retrouvent ensemble dans un seul et même groupe portant ce nom,
   plutôt que de créer deux groupes visuellement identiques.

### Edge Cases

- Un nom de collection vide ou composé uniquement d'espaces n'est jamais accepté comme nom valide.
- Tenter de créer une collection avec un nom déjà utilisé par une collection existante (à la casse
  près, ex. « pvp » et « PvP ») rattache l'objet à cette collection existante plutôt que de créer un
  doublon visuel.
- Désépingler le dernier objet d'une collection fait disparaître ce groupe de la page Épinglés (une
  collection n'existe que tant qu'au moins un objet lui est assigné) ; le nom reste réutilisable pour
  une future collection.
- Désépingler un objet retire son assignation de collection en même temps que le reste de ses
  données, sans affecter les autres objets de cette même collection.
- Une collection contenant un très grand nombre d'objets ou un très grand nombre de collections au
  total reste consultable (défilement normal de la page), sans mécanisme de repli/dépliage requis
  dans cette version.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Le système MUST permettre à un joueur de créer une collection en lui donnant un nom
  libre, non vide.
- **FR-002**: Le système MUST permettre à un joueur d'assigner un objet déjà épinglé à une collection
  existante ou nouvellement créée, depuis la page Épinglés.
- **FR-003**: Le système MUST permettre à un joueur de choisir ou créer une collection au moment même
  où il épingle un nouvel objet depuis la recherche, sans exiger un passage ultérieur par la page
  Épinglés pour le ranger.
- **FR-004**: La page Épinglés MUST regrouper visuellement les objets affichés par collection, avec
  un groupe distinct « Sans collection » pour tout objet épinglé sans collection assignée.
- **FR-005**: Un objet épinglé avant l'introduction de cette fonctionnalité MUST apparaître
  automatiquement dans « Sans collection » dès la première consultation suivant la mise à jour, sans
  action du joueur et sans perte d'aucune de ses informations existantes (prix, niveau, etc.).
- **FR-006**: Le système MUST permettre à un joueur de renommer une collection existante ; ce
  renommage MUST préserver l'assignation de tous les objets qui en faisaient déjà partie.
- **FR-007**: Le système MUST permettre à un joueur de supprimer une collection ; les objets qui lui
  étaient assignés MUST rester épinglés et passer automatiquement dans « Sans collection », sans
  jamais être désépinglés par cette action.
- **FR-008**: Un objet épinglé MUST appartenir à au plus une collection à la fois ; l'assigner à une
  nouvelle collection MUST remplacer son assignation précédente plutôt que de s'y ajouter.
- **FR-009**: Le système MUST NOT permettre l'existence simultanée de deux collections dont le nom est
  identique à la casse près ; assigner un objet à un nom correspondant à une collection déjà
  existante MUST rattacher l'objet à cette collection plutôt que d'en créer une seconde.
- **FR-010**: Les collections et leurs assignations MUST être conservées localement sur l'appareil du
  joueur, selon le même mécanisme de persistance que les objets épinglés existants (pas de compte,
  pas de synchronisation entre appareils).
- **FR-011**: L'ordre d'affichage des groupes sur la page Épinglés MUST être déterministe (ordre
  alphabétique des noms de collection), avec le groupe « Sans collection » toujours affiché en
  dernier.
- **FR-012**: Désépingler un objet MUST retirer son assignation de collection en même temps que le
  reste de ses données, sans affecter les autres objets de cette collection ni supprimer la
  collection elle-même tant qu'elle contient encore au moins un autre objet.

### Key Entities *(include if feature involves data)*

- **Objet épinglé** *(existant, étendu)*: objet du catalogue suivi par le joueur (spec existante),
  auquel s'ajoute une assignation optionnelle à une collection par son nom.
- **Collection**: un nom choisi par le joueur, qui regroupe visuellement les objets épinglés qui lui
  sont assignés. Une collection n'existe, du point de vue du joueur, que tant qu'au moins un objet
  épinglé y est assigné — ce n'est pas une liste gérée indépendamment de ses objets.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Dans 100 % des cas testés, un joueur peut créer une collection et y assigner un objet
  déjà épinglé en 3 actions ou moins depuis la page Épinglés.
- **SC-002**: Dans 100 % des cas testés, tous les objets épinglés avant l'introduction de cette
  fonctionnalité apparaissent dans « Sans collection » après la mise à jour, sans qu'aucun ne
  disparaisse ni ne perde d'information.
- **SC-003**: Dans 100 % des cas testés, renommer une collection contenant des objets ne fait
  disparaître, dupliquer ni perdre aucun de ces objets.
- **SC-004**: Dans 100 % des cas testés, supprimer une collection ne désépingle jamais les objets qui
  lui étaient assignés.
- **SC-005**: Dans 100 % des cas testés, deux tentatives de nommer une collection avec le même nom (à
  la casse près) aboutissent à une seule collection contenant tous les objets concernés, jamais deux
  groupes distincts pour un même nom.
- **SC-006**: Un joueur testeur disposant d'au moins une dizaine d'objets épinglés répartis en
  plusieurs collections retrouve un objet précis plus rapidement qu'avec la liste plate actuelle,
  sans défiler l'ensemble de la page.

## Assumptions

- Un objet épinglé appartient à au plus une collection à la fois ; ce n'est pas un système de tags à
  appartenances multiples — décision actée avec le joueur pour rester simple à comprendre et à gérer
  vu le volume probablement restreint d'objets épinglés par joueur.
- Une collection n'a pas d'existence propre indépendante de ses objets : elle n'apparaît que tant
  qu'au moins un objet épinglé lui est assigné, et disparaît naturellement (sans action explicite de
  suppression nécessaire) une fois vide.
- La comparaison des noms de collection est insensible à la casse pour éviter les doublons visuels,
  mais l'affichage conserve la casse choisie lors de la première création du nom.
- Renommer une collection vers un nom déjà utilisé par une autre collection fusionne les deux,
  cohérent avec la règle d'unicité des noms (FR-009).
- L'ordre alphabétique est un choix par défaut raisonnable pour l'affichage des groupes ; aucun
  besoin exprimé de tri manuel ou personnalisé dans cette version.
- Aucune limite n'est imposée au nombre de collections ni au nombre d'objets par collection dans
  cette version.
- Le partage de collections entre joueurs, leur export/import, ou toute synchronisation entre
  appareils sont hors périmètre de cette fonctionnalité.
- Les modalités exactes de mise en œuvre technique (structure de stockage, composants d'interface)
  sont hors périmètre de cette spécification et seront définies lors du plan d'implémentation
  (`/speckit-plan`).
