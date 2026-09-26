# Feature Specification: Bandeau d'information

**Feature Branch**: `020-info-banner`

**Created**: 2026-09-26

**Status**: Draft

**Input**: User description: « J'aimerais mettre un bandeau d'information pour faire passer des
messages de temps en temps. » Choix du porteur du projet : message publié et retiré depuis la page
d'administration privée existante (specs/014), sans redéploiement ; le joueur peut fermer le bandeau
pour ce message ; deux styles, Info et Important ; date de fin optionnelle.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Publier un message visible par tous (Priority: P1)

Le propriétaire ouvre la page d'administration, écrit « Maintenance du jeu mardi : les prix HDV
peuvent bouger », choisit le style « Important » et publie. Les joueurs voient le bandeau en haut du
site à leur prochaine visite ou au prochain changement de page, sans aucun redéploiement.

**Why this priority**: c'est la raison d'être de la fonctionnalité.

**Independent Test**: publier un message depuis l'administration, puis ouvrir le site sur un autre
appareil et vérifier que le bandeau affiche le texte et le style choisis.

**Acceptance Scenarios**:

1. **Given** aucun message publié, **When** un joueur ouvre le site, **Then** aucun bandeau ne
   s'affiche.
2. **Given** le propriétaire publie un message « Info », **When** un joueur ouvre le site, **Then**
   un bandeau au style information affiche ce texte, sur toutes les pages.
3. **Given** un message « Important », **When** il s'affiche, **Then** son style le distingue
   clairement d'un message « Info » (couleur d'avertissement).
4. **Given** un message publié, **When** le propriétaire le modifie et publie de nouveau, **Then** les
   joueurs voient le nouveau texte.

---

### User Story 2 - Fermer le bandeau (Priority: P1)

Le joueur a lu le message ; il clique sur la croix du bandeau, qui disparaît et ne revient pas sur
cet appareil pour ce message. Si le propriétaire publie un nouveau message, le bandeau réapparaît.

**Why this priority**: un bandeau qu'on ne peut pas fermer gêne à chaque visite.

**Independent Test**: fermer le bandeau, recharger le site (il reste fermé), publier un autre
message (il réapparaît).

**Acceptance Scenarios**:

1. **Given** un bandeau affiché, **When** le joueur clique sur « Fermer », **Then** il disparaît et
   ne réapparaît pas après un rechargement, pour ce message.
2. **Given** un bandeau fermé, **When** le propriétaire publie un nouveau message ou modifie le
   texte du message, **Then** le bandeau réapparaît.

---

### User Story 3 - Retirer un message ou le faire expirer (Priority: P2)

Le propriétaire retire le message depuis l'administration, ou lui fixe une date de fin : après cette
date, le bandeau disparaît pour tous sans autre action.

**Why this priority**: évite qu'un message périmé reste affiché ; le retrait manuel suffit en
attendant.

**Independent Test**: publier un message avec une date de fin passée de quelques minutes et vérifier
qu'il ne s'affiche plus ; retirer un message et vérifier qu'il disparaît.

**Acceptance Scenarios**:

1. **Given** un message publié, **When** le propriétaire le retire, **Then** plus aucun bandeau ne
   s'affiche pour les joueurs.
2. **Given** un message avec une date de fin, **When** cette date est passée, **Then** le bandeau ne
   s'affiche plus, sans intervention.
3. **Given** un message sans date de fin, **When** le temps passe, **Then** il reste affiché jusqu'à
   ce qu'il soit retiré.

---

### Edge Cases

- Service injoignable : aucun bandeau, le reste du site fonctionne normalement (jamais d'erreur
  affichée à la place du bandeau).
- Texte long : le bandeau passe sur plusieurs lignes, sans défilement horizontal, y compris sur
  téléphone.
- Texte vide : la publication est refusée par l'administration.
- Date de fin dans le passé à la publication : refusée par l'administration.
- Un seul message à la fois : publier remplace le message en cours.
- Le texte est affiché tel quel (pas de mise en forme ni de lien actif), pour éviter tout contenu
  inattendu.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Le propriétaire MUST pouvoir, depuis la page d'administration privée (specs/014),
  écrire un message (1 à 280 caractères), choisir son style (« Info » ou « Important »), fixer
  optionnellement une date et heure de fin, publier, modifier et retirer le message.
- **FR-002**: Seul le propriétaire, reconnu comme pour les compteurs (specs/014), MUST pouvoir publier,
  modifier ou retirer un message ; la lecture du message publié est ouverte à tous.
- **FR-003**: Tant qu'un message est publié et non expiré, le site MUST afficher un bandeau en haut de
  toutes les pages, avec le texte et le style du message ; sinon, aucun bandeau.
- **FR-004**: Le bandeau MUST proposer un bouton « Fermer » ; une fois fermé, ce message MUST rester
  masqué sur cet appareil, y compris après rechargement.
- **FR-005**: Un nouveau message, ou une modification de son texte ou de son style, MUST réafficher le
  bandeau même s'il avait été fermé.
- **FR-006**: Après sa date de fin, le message MUST ne plus s'afficher, pour tous, sans action du
  propriétaire.
- **FR-007**: Un message publié, modifié ou retiré MUST être visible des joueurs au plus tard à leur
  prochain chargement du site, sans redéploiement.
- **FR-008**: Si le message ne peut pas être chargé, le site MUST fonctionner normalement sans
  bandeau.
- **FR-009**: Le texte MUST être affiché comme du texte brut ; le bandeau MUST rester lisible sur
  téléphone, sans défilement horizontal, et accessible (rôle d'annonce, bouton « Fermer » nommé).

### Key Entities

- **Message d'information** : texte (1 à 280 caractères), style (Info ou Important), date de fin
  optionnelle, date de publication. Un seul à la fois.
- **Fermeture** : sur l'appareil du joueur, l'identité du dernier message fermé.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Le propriétaire publie un message en moins d'une minute depuis la page d'administration,
  sans redéploiement.
- **SC-002**: 100 % des joueurs qui chargent le site après la publication voient le bandeau (sauf
  s'ils l'ont fermé pour ce message).
- **SC-003**: Un bandeau fermé ne réapparaît jamais pour le même message sur le même appareil, et
  réapparaît toujours pour un nouveau message.
- **SC-004**: Aucun bandeau ne s'affiche après la date de fin d'un message.
- **SC-005**: Le chargement du bandeau ne retarde pas l'affichage du reste du site.

## Assumptions

- Public : petit groupe fermé (10 à 20 joueurs) ; un seul message à la fois suffit.
- La page d'administration et la connexion du propriétaire existent déjà (specs/014) et accueillent
  ce nouveau réglage, comme prévu par sa clarification « d'autres réglages plus tard ».
- Les dates sont saisies et affichées en heure de Paris.
- Aucune statistique de lecture n'est collectée.
