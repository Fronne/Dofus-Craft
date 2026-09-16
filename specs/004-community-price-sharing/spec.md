# Feature Specification: Partage communautaire des prix

**Feature Branch**: `004-community-price-sharing`

**Created**: 2026-09-16

**Status**: Draft

**Input**: User description: "Construire l'infrastructure de partage communautaire des prix pour Dofus Craft, l'itération explicitement différée par la spec 003-community-price-mode. Objectif : quand un joueur active le mode communautaire (déjà existant), il doit pouvoir réellement consulter un prix communautaire pour une ressource/objet sur son serveur actif, et contribuer son propre prix personnel à la communauté s'il le souhaite — ce qui n'est aujourd'hui qu'un message 'à venir'. Contraintes déjà actées : contribution entièrement anonyme (aucun compte, aucun identifiant, aucune traçabilité, même technique) ; agrégation par médiane des contributions récentes pour la même ressource/serveur ; consentement explicite et distinct requis avant tout envoi réel d'un prix personnel ; priorité d'affichage au prix personnel quand les deux coexistent, sans jamais les fusionner ; aucun prix personnel envoyé sans ce consentement. Points laissés ouverts à trancher : modération/détection des prix aberrants, fréquence de rafraîchissement, durée de conservation et anonymisation, comportement hors-ligne, conformité réglementaire si des données techniques s'avéraient nécessaires pour la détection d'abus (en tension avec l'anonymat total), effet du retrait futur d'un consentement sur des contributions déjà envoyées."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consulter un prix communautaire réel (Priority: P1)

Un joueur en mode communautaire consulte une ressource ou un objet sur son serveur actif et voit,
pour la première fois, un prix réellement issu des contributions d'autres joueurs plutôt que le
message « à venir » actuel.

**Why this priority**: C'est la moitié « consultation » de la promesse du mode communautaire,
restée un message d'attente depuis 003-community-price-mode ; sans elle, activer le mode
communautaire n'apporte toujours aucune valeur concrète.

**Independent Test**: Avec des contributions déjà connues pour une ressource sur un serveur,
un joueur en mode communautaire consulte cette ressource et voit un prix communautaire cohérent
avec ces contributions, distinct de son propre prix personnel s'il en a saisi un.

**Acceptance Scenarios**:

1. **Given** un joueur en mode communautaire consulte une ressource pour laquelle des contributions
   existent sur son serveur actif, **When** la page se charge, **Then** un prix communautaire est
   affiché, clairement identifié comme tel et distinct de tout prix personnel déjà saisi.
2. **Given** une ressource sans aucune contribution communautaire sur ce serveur, **When** le
   joueur la consulte, **Then** l'application indique explicitement qu'aucun prix communautaire
   n'est encore disponible pour cette ressource, plutôt que d'afficher un prix fabriqué ou un état
   vide ambigu.
3. **Given** le joueur change de serveur actif, **When** il consulte à nouveau la même ressource,
   **Then** le prix communautaire affiché correspond au nouveau serveur actif, jamais à celui
   précédemment consulté.

---

### User Story 2 - Contribuer son prix personnel après consentement explicite (Priority: P1)

Un joueur en mode communautaire, qui a déjà saisi des prix personnels, choisit de les partager
avec la communauté. Il doit donner un consentement explicite et distinct de la simple activation
du mode communautaire avant qu'aucun de ses prix ne soit réellement transmis.

**Why this priority**: C'est la moitié « contribution » de la promesse du mode communautaire, et
la garantie de confidentialité actée en 003-community-price-mode (consentement distinct requis)
doit être au cœur de cette itération dès sa première implémentation, pas ajoutée après coup.

**Independent Test**: Un joueur active le mode communautaire sans donner son consentement de
partage : aucun de ses prix personnels n'est transmis. Il donne ensuite ce consentement
explicitement : ses prix personnels commencent alors à être transmis en tant que contributions
anonymes.

**Acceptance Scenarios**:

1. **Given** un joueur vient d'activer le mode communautaire, **When** il consulte ou saisit des
   prix personnels sans avoir donné son consentement de partage, **Then** aucun de ces prix n'est
   transmis à la communauté.
2. **Given** le mode communautaire actif, **When** le joueur donne explicitement son consentement
   de partage, **Then** l'application le confirme clairement et ses prix personnels existants et
   futurs pour le serveur actif deviennent éligibles à la contribution anonyme.
3. **Given** un consentement de partage donné, **When** une contribution est envoyée, **Then**
   elle ne contient aucune information permettant d'identifier ou de relier le joueur à cette
   contribution.

---

### User Story 3 - Le prix personnel reste toujours la référence (Priority: P1)

Un joueur qui a à la fois un prix personnel et un prix communautaire pour la même ressource sur le
même serveur doit toujours voir son prix personnel utilisé pour l'affichage principal et les
calculs de rentabilité, le prix communautaire restant consultable séparément.

**Why this priority**: C'est une garantie de confiance déjà actée en 003-community-price-mode ;
tant qu'elle n'était pas vérifiable faute de données communautaires réelles, elle restait
théorique. Cette itération la rend concrètement testable pour la première fois.

**Independent Test**: Pour une ressource avec un prix personnel et un prix communautaire tous deux
connus et différents, le calcul de rentabilité et l'affichage principal utilisent le prix
personnel ; le prix communautaire reste visible mais n'est jamais utilisé dans le calcul ni fondu
avec le prix personnel.

**Acceptance Scenarios**:

1. **Given** un prix personnel et un prix communautaire différents existent pour la même
   ressource/serveur, **When** le joueur consulte cette ressource, **Then** le prix personnel est
   utilisé pour tout calcul de coût de craft et reste l'affichage principal.
2. **Given** cette même situation, **When** le joueur consulte le prix communautaire, **Then** il
   le voit affiché séparément, sans qu'aucun des deux prix ne soit moyenné, remplacé ou masqué par
   l'autre.

---

### User Story 4 - Retirer son consentement de partage, y compris rétroactivement (Priority: P2)

Un joueur qui a donné son consentement de partage change d'avis et le retire. Aucune nouvelle
contribution ne doit alors être transmise, et il peut aussi demander le retrait de ce qu'il a déjà
partagé.

**Why this priority**: Sans ce contrôle, le consentement donné en User Story 2 ne serait pas
réellement réversible ; c'est une garantie de confiance nécessaire mais moins bloquante pour la
première consultation/contribution que les User Stories 1 à 3.

**Independent Test**: Un joueur ayant donné son consentement le retire depuis les paramètres ;
aucune contribution n'est plus transmise ensuite, même s'il continue à saisir ou modifier des prix
personnels ; il peut en plus demander le retrait de ses contributions déjà envoyées, et celles-ci
cessent d'être prises en compte dans le calcul du prix communautaire.

**Acceptance Scenarios**:

1. **Given** un consentement de partage actif, **When** le joueur le retire, **Then**
   l'application le confirme clairement et aucune nouvelle contribution n'est transmise à partir
   de ce moment.
2. **Given** un consentement retiré, **When** le joueur modifie un prix personnel, **Then** cette
   modification n'est jamais transmise à la communauté tant que le consentement n'est pas redonné.
3. **Given** des contributions déjà envoyées par le joueur, **When** il demande leur retrait
   rétroactif, **Then** elles cessent d'être prises en compte dans le calcul du prix communautaire,
   sans que cette demande ne révèle à quiconque le lien entre le joueur et ces contributions.

---

### User Story 5 - Consultation communautaire résiliente en cas d'indisponibilité (Priority: P3)

Un joueur en mode communautaire perd sa connexion ou rencontre un service communautaire
indisponible. Il doit continuer à utiliser l'application normalement, avec un état clair sur les
prix communautaires plutôt qu'une erreur bloquante.

**Why this priority**: Confirme que le mode communautaire dégrade proprement plutôt que de casser
le parcours principal (personnel), déjà garanti par construction en 003-community-price-mode ;
cette itération doit préserver cette garantie une fois de vrais appels réseau introduits.

**Independent Test**: Le service communautaire est simulé indisponible ; le joueur consulte une
ressource et voit un état explicite d'indisponibilité pour le prix communautaire, tandis que son
prix personnel et les calculs associés restent pleinement utilisables.

**Acceptance Scenarios**:

1. **Given** le service de prix communautaires est indisponible, **When** le joueur consulte une
   ressource, **Then** un message explicite indique que le prix communautaire n'a pas pu être
   récupéré, sans bloquer la consultation ni la saisie du prix personnel.
2. **Given** cette indisponibilité, **When** le joueur consulte le calcul de rentabilité, **Then**
   celui-ci reste identique à son comportement en mode personnel, fondé uniquement sur le prix
   personnel.

### Edge Cases

- Une ressource pour laquelle une seule contribution communautaire existe affiche cette valeur
  unique comme prix communautaire, sans laisser croire à une moyenne représentative de plusieurs
  joueurs.
- Une contribution manifestement aberrante (valeur nulle, négative ou extrême) ne doit pas, à elle
  seule, déformer de façon disproportionnée le prix communautaire affiché aux autres joueurs.
- Un joueur qui n'a jamais saisi aucun prix personnel peut tout de même consulter les prix
  communautaires sans que le partage ne lui soit imposé.
- Le retrait du consentement de partage n'affecte jamais la disponibilité ni l'usage du prix
  personnel du joueur lui-même.
- Un changement de serveur actif pendant la consultation communautaire met à jour le prix
  communautaire affiché pour correspondre au nouveau serveur, comme c'est déjà le cas pour les prix
  personnels (cf. 002-server-scoped-prices).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: En mode communautaire, le système MUST afficher un prix communautaire pour une
  ressource ou un objet du serveur actif lorsque des contributions existent pour celle-ci.
- **FR-002**: Le système MUST indiquer explicitement qu'aucun prix communautaire n'est disponible
  pour une ressource donnée plutôt que d'afficher un prix fabriqué, une valeur par défaut ou un
  état vide ambigu.
- **FR-003**: Le prix communautaire affiché MUST être calculé comme la médiane des contributions
  récentes pour la même ressource et le même serveur (cf. décision actée en
  003-community-price-mode).
- **FR-004**: Le système NE DOIT transmettre aucun prix personnel d'un joueur à la communauté sans
  un consentement de partage explicite et distinct de la simple activation du mode communautaire.
- **FR-005**: Le système MUST permettre au joueur de donner ce consentement de partage à tout
  moment depuis les paramètres, et de confirmer clairement quand il est actif.
- **FR-006**: Le système MUST permettre au joueur de retirer ce consentement à tout moment, avec
  effet immédiat sur toute nouvelle contribution.
- **FR-007**: Une contribution envoyée à la communauté NE DOIT contenir aucune information
  permettant d'identifier ou de relier le joueur à cette contribution, y compris de façon
  technique (cf. décision actée en 003-community-price-mode).
- **FR-008**: Lorsqu'un prix personnel et un prix communautaire existent pour la même
  ressource/serveur, le système MUST toujours utiliser le prix personnel pour l'affichage
  principal et pour tout calcul de rentabilité ; le prix communautaire MUST rester consultable
  séparément, sans jamais être fusionné, moyenné ou substitué au prix personnel.
- **FR-009**: Le système MUST rester pleinement utilisable en mode personnel (saisie et calculs
  fondés sur le prix personnel) lorsque le service de prix communautaires est indisponible ou
  inaccessible, et MUST l'indiquer clairement au joueur plutôt que de présenter une erreur
  bloquante.
- **FR-010**: Le système MUST écarter du calcul du prix communautaire toute contribution
  manifestement aberrante (valeur nulle, négative ou statistiquement extrême) par un filtrage
  purement statistique côté agrégation (ex. bornes ou écart-type sur les contributions récentes),
  sans introduire ni conserver aucune donnée technique identifiant le contributeur.
- **FR-011**: Le système MUST conserver les contributions individuelles pendant 90 jours glissants,
  au-delà desquels elles ne sont plus prises en compte dans le calcul du prix communautaire
  affiché. Cette fenêtre plus longue que la valeur par défaut habituelle est un choix délibéré :
  le public visé par cette fonctionnalité est un groupe restreint (de l'ordre de 10 à 20 joueurs),
  et une fenêtre courte risquerait de laisser trop peu de contributions pour produire une médiane
  représentative.
- **FR-012**: Chaque contribution de prix MUST recevoir un identifiant opaque connu uniquement de
  l'appareil du joueur qui l'a envoyée, jamais transmis ni stocké ailleurs que localement. Le
  retrait du consentement de partage (User Story 4) MUST permettre au joueur de demander le retrait
  rétroactif de ses contributions déjà envoyées grâce à cet identifiant, sans que cela ne révèle ni
  ne reconstitue à aucun moment son identité ou un lien entre ses contributions.
- **FR-013**: Le système MUST récupérer un prix communautaire à jour à chaque nouvelle consultation
  d'une ressource (chargement de la page, changement de ressource ou de serveur), et MUST le
  rafraîchir automatiquement toutes les 5 minutes si le joueur reste sur la même ressource, sans
  dépasser cette fréquence.
- **FR-014**: Le système MUST continuer à respecter, sans exception, la règle déjà actée selon
  laquelle aucune donnée n'est jamais transmise en mode personnel, quel que soit l'état du
  consentement de partage.

### Key Entities *(include if feature involves data)*

- **Contribution de prix communautaire**: Valeur en kamas soumise anonymement pour une ressource
  et un serveur donnés, horodatée, sans aucune information reliant la contribution à un joueur.
- **Prix communautaire agrégé**: Médiane des contributions récentes valides pour une ressource et
  un serveur donnés ; c'est cette valeur, et non les contributions individuelles, qui est
  consultable par les joueurs.
- **Consentement de partage**: État individuel (donné / retiré), horodaté, déterminant si les prix
  personnels du joueur sont éligibles à devenir des contributions anonymes ; distinct du choix de
  mode de gestion des prix (003-community-price-mode).
- **Prix personnel** *(existant, inchangé)*: continue de prévaloir à l'affichage et dans les
  calculs même lorsqu'un prix communautaire coexiste pour la même ressource/serveur.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Dans 100 % des cas testés, un joueur en mode communautaire voit soit un prix
  communautaire, soit un état « pas encore de données » explicite pour toute ressource consultée
  sur son serveur actif — jamais un état vide ambigu ou un prix fabriqué.
- **SC-002**: Dans 100 % des cas testés, aucun prix personnel n'est transmis à la communauté sans
  un consentement de partage explicite et distinct préalablement donné.
- **SC-003**: Dans 100 % des cas testés où un prix personnel et un prix communautaire coexistent
  pour la même ressource/serveur, le calcul de rentabilité et l'affichage principal utilisent
  exclusivement le prix personnel.
- **SC-004**: Un joueur peut retirer son consentement de partage en moins de 10 secondes depuis les
  paramètres, avec confirmation immédiate et visible que le retrait est effectif.
- **SC-005**: Dans un test avec plusieurs contributions dont une valeur extrême isolée, le prix
  communautaire affiché reste proche de la valeur typique des autres contributions plutôt que
  d'être entraîné vers cette valeur extrême.
- **SC-006**: Dans 100 % des cas testés, l'indisponibilité du service de prix communautaires ne
  dégrade ni la disponibilité ni l'exactitude des prix personnels et de leurs calculs.

## Assumptions

- Le rafraîchissement du prix communautaire affiché se fait à la consultation de chaque
  ressource/objet, avec une actualisation périodique raisonnable si le joueur reste sur le même
  écran, plutôt qu'un flux temps réel ; ce point pourra être révisé lors du plan technique si les
  contraintes réelles l'exigent.
- En cas d'indisponibilité du service communautaire, l'application affiche le dernier prix
  communautaire connu localement le cas échéant, clairement marqué comme potentiellement daté,
  plutôt que de ne rien afficher.
- Cette fonctionnalité s'appuie sur le mode communautaire déjà existant (003-community-price-mode)
  et sur le système de serveurs existant (002-server-scoped-prices) sans en modifier le périmètre
  fonctionnel.
- Aucun compte utilisateur n'est introduit par cette fonctionnalité ; le consentement de partage
  est une préférence locale à l'appareil, comme les autres préférences déjà existantes.
- Les modalités de mise en œuvre technique de l'infrastructure de partage (choix de fournisseur,
  d'architecture, de transport) sont hors périmètre de cette spécification et seront définies lors
  du plan d'implémentation (`/speckit-plan`).
- Le public visé par le mode communautaire est un groupe restreint et non anonyme entre eux dans
  la vraie vie (de l'ordre de 10 à 20 joueurs), pas un public large et inconnu ; cette échelle a
  directement motivé le choix d'une fenêtre de conservation plus longue (FR-011) pour garantir
  suffisamment de contributions, et pourra aussi simplifier les choix d'infrastructure et de coût
  lors du plan technique.
