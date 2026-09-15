# Feature Specification: Gestion multi-serveurs des prix

**Feature Branch**: `[002-server-scoped-prices]`

**Created**: 2026-09-14

**Status**: Draft

**Input**: User description: "Gestion multi-serveurs pour les prix de ressources et les items épinglés. Lors de sa première arrivée sur l'application, l'utilisateur doit sélectionner son serveur Dofus. Le serveur sélectionné doit être mémorisé. L'utilisateur doit pouvoir changer de serveur par la suite. Les prix renseignés par l'utilisateur doivent être propres à chaque serveur : un même item peut avoir un prix différent sur chaque serveur. Lorsqu'on change de serveur, les prix affichés doivent correspondre au serveur sélectionné, et les prix d'un serveur doivent être conservés lorsqu'on y revient. Les items épinglés ne doivent PAS être séparés par serveur : la liste des items épinglés reste la même quel que soit le serveur sélectionné. En revanche, le prix enregistré pour chaque item épinglé doit être propre au serveur. Les données doivent rester persistantes après un rechargement de la page. L'architecture doit permettre d'ajouter facilement d'autres serveurs et éventuellement d'autres données dépendantes du serveur."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Choisir son serveur à la première visite (Priority: P1)

Un joueur ouvre Dofus Craft pour la première fois. Avant de pouvoir utiliser la comparaison de
craft, il doit indiquer sur quel serveur Dofus il joue, afin que les prix qu'il saisira ensuite
soient rattachés au bon serveur.

**Why this priority**: Sans serveur sélectionné, aucun prix saisi ne peut être correctement
rattaché : c'est le prérequis de toute la fonctionnalité et la première interaction du joueur
avec l'application.

**Independent Test**: Ouvrir l'application sans aucune préférence de serveur enregistrée ;
vérifier qu'un choix de serveur est proposé et qu'après sélection, le serveur choisi est
mémorisé et affiché.

**Acceptance Scenarios**:

1. **Given** un joueur ouvre l'application pour la première fois (aucun serveur mémorisé),
   **When** l'application se charge, **Then** un sélecteur de serveur lui est présenté et les
   autres fonctionnalités (recherche, comparaison) restent inaccessibles tant qu'aucun serveur
   n'est choisi.
2. **Given** le sélecteur de serveur affiché, **When** le joueur choisit un serveur dans la
   liste fermée des serveurs officiels proposés, **Then** ce serveur devient le serveur actif,
   son nom est visible dans l'application, et le reste de l'application devient accessible.
3. **Given** un serveur déjà sélectionné lors d'une visite précédente, **When** le joueur revient
   sur l'application, **Then** le sélecteur de première visite ne s'affiche plus et le serveur
   précédemment choisi est actif.

---

### User Story 2 - Changer de serveur et retrouver les prix de recette associés (Priority: P1)

Un joueur qui a déjà utilisé l'application sur un serveur veut basculer vers un autre serveur
(par exemple un deuxième personnage) et continuer à comparer des crafts avec des prix
correspondant à ce nouveau serveur, sans que les prix de l'ancien serveur n'interfèrent.

**Why this priority**: C'est la valeur centrale du besoin : sans changement de serveur fiable et
sans isolation des prix, la fonctionnalité n'apporte rien par rapport à l'existant.

**Independent Test**: Saisir un prix de ressource sur un serveur A, changer pour un serveur B,
saisir un prix différent pour la même ressource, puis revenir sur A et vérifier que le prix de A
est réaffiché intact.

**Acceptance Scenarios**:

1. **Given** un joueur actif sur le serveur A avec des prix de ressources déjà saisis pour une
   recette, **When** il sélectionne le serveur B, **Then** les champs de prix de cette recette
   n'affichent plus les valeurs saisies sur A (vides ou valeurs propres à B si déjà saisies).
2. **Given** un joueur sur le serveur B, **When** il saisit un prix pour une ressource, **Then**
   ce prix est enregistré comme appartenant au serveur B uniquement.
3. **Given** des prix saisis respectivement sur les serveurs A et B pour la même ressource,
   **When** le joueur revient sur le serveur A, **Then** le prix affiché est celui précédemment
   saisi sur A, inchangé par la saisie faite sur B.
4. **Given** l'application rechargée (rafraîchissement de page), **When** elle se recharge,
   **Then** le serveur actif avant le rechargement reste sélectionné et ses prix restent
   affichés.

---

### User Story 3 - Suivre un item épinglé avec un prix par serveur (Priority: P2)

Un joueur épingle un item pour le suivre facilement. Il veut que cet item reste dans sa liste
d'items épinglés quel que soit le serveur sur lequel il se trouve, mais que le prix de marché
qu'il renseigne pour cet item corresponde toujours au serveur actif.

**Why this priority**: Complète la fonctionnalité principale pour le cas d'usage des items
suivis dans la durée ; dépend de la sélection de serveur (US1) et de l'isolation des prix (US2)
déjà en place.

**Independent Test**: Épingler un item, renseigner un prix de marché sur le serveur A, changer
pour le serveur B, renseigner un prix différent, puis vérifier que l'item reste épinglé sur les
deux serveurs avec le bon prix affiché sur chacun.

**Acceptance Scenarios**:

1. **Given** un item épinglé alors que le serveur A est actif, **When** le joueur change pour le
   serveur B, **Then** l'item reste présent dans la liste des items épinglés.
2. **Given** un item épinglé avec un prix de marché de 500 000 kamas saisi sur le serveur
   Mikhal, **When** le joueur passe au serveur Dakal et saisit 750 000 kamas pour ce même item,
   **Then** le prix affiché pour cet item est 750 000 kamas sur Dakal et redevient 500 000
   kamas lorsqu'il revient sur Mikhal.
3. **Given** un item épinglé pour lequel aucun prix n'a encore été saisi sur le serveur
   actuellement actif, **When** le joueur consulte cet item, **Then** le champ de prix apparaît
   vide plutôt que de montrer le prix d'un autre serveur.
4. **Given** un item désépinglé, **When** le joueur consulte n'importe quel serveur, **Then**
   cet item n'apparaît plus dans la liste des items épinglés d'aucun serveur.

---

### Edge Cases

- Le sélecteur de serveur de première visite ne peut pas être contourné : il n'expose aucune
  action permettant d'accéder au reste de l'application tant qu'un serveur n'a pas été choisi.
- Si le stockage local du navigateur est vidé, désactivé (navigation privée) ou indisponible,
  aucune préférence de serveur n'y est détectable : le joueur revoit le sélecteur bloquant comme
  lors d'une toute première visite, et les prix déjà saisis restent inaccessibles tant que ce
  stockage ne l'est pas, sans être ni fabriqués ni supprimés activement par le système (FR-017).
- Lors de la mise à jour introduisant cette fonctionnalité, tout prix de marché d'item épinglé
  déjà enregistré (non rattaché à un serveur) est abandonné et le joueur en est averti ; il devra
  ressaisir ce prix pour chaque serveur pertinent.
- Que se passe-t-il si un joueur épingle le même item alors qu'il est déjà épinglé (sur un autre
  serveur que celui d'origine) ?
- Si le joueur change de serveur alors qu'une saisie de prix en cours n'a pas encore produit de
  valeur valide enregistrée, cette saisie non validée est abandonnée plutôt qu'appliquée au
  nouveau serveur actif (FR-018).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Le système DOIT présenter un sélecteur de serveur au joueur lors de sa toute
  première visite, c'est-à-dire lorsqu'aucun serveur n'est encore mémorisé pour lui.
- **FR-002**: Le système DOIT mémoriser durablement le serveur sélectionné par le joueur, de
  façon à le restituer automatiquement lors de ses visites suivantes, y compris après un
  rechargement complet de la page.
- **FR-003**: Le système DOIT permettre au joueur de changer de serveur actif à tout moment
  après le choix initial, depuis n'importe quel écran de l'application.
- **FR-004**: Le système DOIT indiquer de façon visible et permanente quel est le serveur
  actuellement actif pendant toute l'utilisation de l'application.
- **FR-005**: Le système DOIT associer chaque prix de ressource saisi par le joueur au serveur
  actif au moment de la saisie.
- **FR-006**: Lorsque le joueur consulte les prix de ressources d'une recette, le système DOIT
  afficher exclusivement les prix enregistrés pour le serveur actif, sans jamais afficher un
  prix enregistré pour un autre serveur.
- **FR-007**: Le système DOIT conserver les prix de ressources associés à un serveur indéfiniment
  après que le joueur est passé à un autre serveur, afin de les restituer intacts à son retour
  sur ce serveur.
- **FR-008**: La liste des items épinglés par le joueur DOIT être unique et commune à tous les
  serveurs : épingler ou désépingler un item depuis un serveur donné produit le même effet sur
  tous les autres serveurs.
- **FR-009**: Le système DOIT permettre d'enregistrer, pour un même item épinglé, un prix de
  marché distinct pour chaque serveur.
- **FR-010**: Lorsque le joueur change de serveur, le système DOIT afficher pour chaque item
  épinglé le prix de marché enregistré pour le serveur actif ; si aucun prix n'a été saisi pour
  ce serveur, le champ correspondant DOIT apparaître vide plutôt que de montrer le prix d'un
  autre serveur.
- **FR-011**: Le système DOIT restituer à l'identique, après un rechargement complet de la page,
  le serveur sélectionné ainsi que l'ensemble des prix de ressources et des prix de marché des
  items épinglés précédemment enregistrés pour chaque serveur.
- **FR-012**: Le système DOIT permettre d'ajouter un nouveau serveur à la liste proposée aux
  joueurs sans altérer ni perdre les prix déjà enregistrés pour les serveurs existants.
- **FR-013**: Le système DOIT être conçu de sorte qu'une future donnée supplémentaire dépendante
  du serveur puisse être ajoutée sans nécessiter de repenser la façon dont le serveur actif ou la
  liste des serveurs sont gérés.
- **FR-014**: Le système DOIT proposer au joueur une liste fermée et prédéfinie des serveurs
  officiels Dofus, maintenue par l'application ; le joueur choisit exclusivement parmi cette
  liste, sans possibilité de saisie libre.
- **FR-015**: Tant que le joueur n'a pas effectué son tout premier choix de serveur, le système
  DOIT bloquer l'accès aux autres fonctionnalités de l'application (recherche, comparaison) et
  ne présenter que le sélecteur de serveur, jusqu'à ce qu'un serveur soit choisi.
- **FR-016**: Lors de la mise en place de cette fonctionnalité, le système DOIT abandonner tout
  prix de marché d'item épinglé déjà enregistré avant l'introduction du rattachement par serveur
  (donnée non associée à un serveur), et DOIT avertir le joueur concerné que ces prix devront
  être ressaisis pour chaque serveur.
- **FR-017**: Le système DOIT traiter toute absence de préférence de serveur détectable en
  stockage local de façon identique, qu'il s'agisse d'une toute première visite, d'un stockage
  vidé, d'une navigation privée ou d'un stockage indisponible : présenter à nouveau le sélecteur
  de serveur bloquant, sans tenter de deviner ou de restaurer un serveur précédent. Les prix
  précédemment enregistrés pour un serveur restent inaccessibles tant que ce stockage n'est pas
  de nouveau disponible ; le système ne DOIT ni les fabriquer, ni les supprimer activement.
- **FR-018**: Si le joueur change de serveur actif alors qu'une saisie de prix en cours n'a pas
  encore produit de valeur valide enregistrée, le système DOIT abandonner cette saisie non
  validée plutôt que de l'appliquer au nouveau serveur actif ; le champ concerné DOIT ensuite
  refléter exclusivement l'état (vide ou prix enregistré) du serveur nouvellement actif.

### Key Entities *(include if feature involves data)*

- **Serveur**: représente un monde de jeu Dofus sur lequel les prix pratiqués par les joueurs
  peuvent différer. Possède un identifiant stable et un nom affiché au joueur.
- **Sélection de serveur active**: préférence mémorisée pour un joueur donné, indiquant quel
  serveur est actuellement utilisé pour l'affichage et la saisie des prix.
- **Prix de ressource par serveur**: association entre une ressource, un serveur et un prix
  unitaire en kamas saisi par le joueur pour ce serveur.
- **Item épinglé**: objet marqué comme suivi par le joueur ; une seule entrée par item,
  indépendante du serveur actif.
- **Prix de marché d'un item épinglé par serveur**: association entre un item épinglé, un
  serveur et le prix observé par le joueur à l'Hôtel des Ventes pour cet item sur ce serveur.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un nouveau joueur choisit son serveur en moins de 10 secondes lors de sa première
  visite, sans avoir besoin d'aide ou d'explication externe.
- **SC-002**: Dans 100% des cas testés, un prix (ressource ou item épinglé) saisi sur un serveur
  reste inchangé et correctement réaffiché après un aller-retour vers un autre serveur puis un
  retour au serveur d'origine.
- **SC-003**: Dans 100% des cas testés, le serveur actif et l'ensemble des prix précédemment
  saisis pour chaque serveur sont restitués à l'identique après un rechargement complet de la
  page.
- **SC-004**: Dans 100% des cas testés, la liste des items épinglés (mêmes items, même
  disponibilité) reste strictement identique quel que soit le serveur sélectionné.
- **SC-005**: L'ajout d'un nouveau serveur à la liste proposée ne provoque aucune perte ni
  altération des prix déjà enregistrés pour les serveurs existants, vérifiable sans aucune
  action corrective manuelle.

## Assumptions

- Le choix de serveur est une préférence individuelle liée au navigateur/appareil utilisé ;
  aucun compte utilisateur ni synchronisation multi-appareils n'est requis dans le périmètre de
  cette fonctionnalité.
- Aucune synchronisation en temps réel entre plusieurs onglets ouverts simultanément n'est
  requise ; un rechargement de page suffit pour qu'un onglet reflète un changement effectué dans
  un autre onglet.
- Le nombre de serveurs gérés reste de l'ordre de grandeur des serveurs officiels Dofus (quelques
  dizaines au maximum), sans exigence de performance particulière au-delà des standards actuels
  de l'application.
- Cette fonctionnalité s'appuie sur le catalogue d'items, de recettes et le calcul de
  comparaison existants (fonctionnalité 001-craft-profit-comparison) sans en modifier le
  périmètre fonctionnel.
- La liste fermée des serveurs officiels Dofus est maintenue par l'équipe du projet (mise à jour
  manuelle lors de la création/fermeture d'un serveur officiel) ; elle n'est pas récupérée
  dynamiquement depuis une source externe dans le périmètre de cette fonctionnalité.
- Les prix de marché d'items épinglés saisis avant l'introduction de cette fonctionnalité seront
  perdus lors de la migration et ne sont pas dans le périmètre d'une récupération automatique ;
  seule une notification informative au joueur est requise.
- Portée de l'exception au principe constitutionnel « Données utilisateur sûres » (FR-016) :
  elle couvre exclusivement l'ancien prix de marché non scopé des items épinglés existant avant
  cette fonctionnalité ; aucune autre donnée (liste d'items épinglés, prix de ressources,
  sélection de serveur) n'est concernée par un abandon sans confirmation. Cette exception sera
  levée dès qu'un mécanisme de confirmation explicite avant suppression sera disponible dans
  l'application (par exemple une boîte de dialogue de confirmation générique ou un compte
  utilisateur permettant une validation avant migration) ; jusque-là, l'avertissement informatif
  de FR-016 constitue la seule mesure de protection appliquée.
