# Feature Specification: Champs de prix à saisie directe

**Feature Branch**: `051-site-visual-refresh` (à la demande de l'utilisateur, cette fonctionnalité est
faite sur la branche du nouveau style, pas sur une branche à part)

**Created**: 2026-10-13

**Status**: Draft

**Input**: User description: "Pour les champs de saisie (prix unitaires, etc.), plus de bouton
Modifier : par défaut le prix avec le symbole kamas à droite. Quand on clique dedans, tout le texte
du champ est sélectionné, prêt à être remplacé. Dès qu'on en sort, avec Entrée ou avec la souris, ça
enregistre. Et s'il y a un rechargement de page pendant la saisie, prévoir aussi un enregistrement
s'il n'a pas déjà eu lieu."

> Cette spécification **remplace** la protection contre les frappes accidentelles du Mode
> communautaire : champ verrouillé dès qu'il contient un prix, bouton « Modifier » pour le
> déverrouiller (specs/004-community-price-sharing, specs/016-shared-item-prices FR-003). Le reste
> de ces specs est inchangé : partage à la sortie du champ, seulement si la valeur a changé
> (004 FR-017 à FR-020), confirmation d'un prix inhabituel (specs/007, 016 FR-006 à FR-008).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Remplacer un prix d'un clic (Priority: P1)

Le joueur relève un prix en jeu. Il clique dans le champ du prix : tout le montant est sélectionné.
Il tape le nouveau montant, qui remplace l'ancien, puis appuie sur Entrée ou clique ailleurs : le
prix est enregistré. Il n'y a plus de bouton « Modifier » à viser avant de pouvoir taper.

**Why this priority**: c'est le geste répété des dizaines de fois par séance ; chaque clic en moins
compte.

**Independent Test**: en Mode communautaire, sur une ressource qui a déjà un prix, cliquer dans le
champ, taper un montant, appuyer sur Entrée : le nouveau prix est affiché, partagé, et sa date est
« à l'instant ».

**Acceptance Scenarios**:

1. **Given** un champ de prix déjà rempli, dans l'un ou l'autre mode, **When** le joueur le regarde,
   **Then** il voit le montant et le symbole kamas à droite, sans bouton « Modifier ».
2. **Given** un champ de prix rempli, **When** le joueur clique dedans ou y arrive avec la touche
   Tab, **Then** tout le montant est sélectionné.
3. **Given** un montant sélectionné, **When** le joueur tape un nouveau montant puis appuie sur
   Entrée, clique ailleurs ou passe au champ suivant, **Then** le nouveau prix est enregistré : dans
   son carnet en Mode personnel, partagé au groupe en Mode communautaire.
4. **Given** un champ dans lequel le joueur a cliqué sans rien changer, **When** il en sort,
   **Then** rien n'est enregistré ni partagé, et la date du prix ne change pas.
5. **Given** un montant en cours de saisie, **When** le joueur appuie sur Échap, **Then** le champ
   reprend le prix qu'il avait en entrant, et rien n'est enregistré.
6. **Given** le Mode communautaire et un montant très éloigné du prix connu, **When** le joueur
   sort du champ, **Then** la confirmation de prix inhabituel s'affiche comme avant ; s'il annule,
   le prix précédent revient.

---

### User Story 2 - Ne pas perdre un prix tapé quand la page se recharge (Priority: P2)

Le joueur a tapé un montant et, sans être sorti du champ, recharge la page, la ferme ou change
d'onglet. Le montant tapé est enregistré à ce moment-là, s'il ne l'a pas déjà été.

**Why this priority**: sans cela, un prix relevé en jeu est perdu sans que le joueur s'en aperçoive.

**Independent Test**: taper un montant dans un champ, recharger la page sans quitter le champ : au
retour, le champ montre le montant tapé.

**Acceptance Scenarios**:

1. **Given** un montant tapé et pas encore enregistré, **When** la page est rechargée ou quittée,
   **Then** ce montant est enregistré, et il est affiché quand le joueur revient.
2. **Given** un montant déjà enregistré en sortant du champ, **When** la page est rechargée,
   **Then** il n'est pas enregistré une seconde fois.
3. **Given** le Mode communautaire et un montant tapé qui demanderait une confirmation de prix
   inhabituel, **When** la page est rechargée, **Then** ce montant n'est pas partagé.

---

### Edge Cases

- Champ vide où le joueur tape un premier prix : même comportement, le prix est enregistré à la
  sortie.
- Champ vidé puis quitté : en Mode personnel, le prix est retiré du carnet comme avant ; en Mode
  communautaire, rien n'est partagé (un prix vide ne se partage pas).
- Montant invalide (lettres, nombre négatif) : rien n'est enregistré, le message d'erreur habituel
  reste.
- Service de partage injoignable : comportement inchangé (le montant tapé reste affiché pour la
  visite).
- Prix arrivé du groupe pendant que le joueur tape : sa saisie n'est pas écrasée.
- Sur un écran tactile, toucher le champ sélectionne aussi tout le montant.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Les champs de prix (prix unitaire d'une ressource, prix HDV d'un objet) MUST être
  directement modifiables dans les deux modes, sur toutes les pages où ils apparaissent : aucun
  état verrouillé, aucun bouton « Modifier ».
- **FR-002**: Un champ de prix MUST toujours montrer le symbole kamas à sa droite ; il est atténué
  tant que le champ est vide.
- **FR-003**: Quand un champ de prix reçoit le focus (clic, toucher ou clavier), tout son contenu
  MUST être sélectionné.
- **FR-004**: Quand le joueur quitte un champ de prix (Entrée, clic ailleurs, tabulation) avec une
  valeur différente de celle qu'il avait en entrant, le prix MUST être enregistré : dans le carnet
  en Mode personnel, partagé au groupe en Mode communautaire.
- **FR-005**: Quitter un champ sans en avoir changé la valeur MUST NOT enregistrer, partager, ni
  changer la date du prix.
- **FR-006**: Échap MUST remettre le prix que le champ avait en entrant, sans rien enregistrer.
- **FR-007**: En Mode communautaire, la confirmation de prix inhabituel MUST continuer de
  s'appliquer à la sortie du champ ; une annulation MUST remettre le prix précédent.
- **FR-008**: Quand la page est rechargée, fermée ou mise en arrière-plan alors qu'un champ contient
  un montant valide, modifié et pas encore enregistré, ce montant MUST être enregistré à ce
  moment-là, une seule fois.
- **FR-009**: Dans le cas de FR-008, en Mode communautaire, un montant qui demanderait une
  confirmation de prix inhabituel MUST NOT être partagé.
- **FR-010**: Les calculs (coût de craft, verdict, rentabilité) MUST rester inchangés ; ils
  continuent de suivre le montant affiché pendant la saisie.

### Key Entities

- **Prix en cours de saisie** : le montant tapé dans un champ et pas encore enregistré, avec le prix
  que le champ avait à l'entrée (pour savoir s'il a changé, et pour Échap).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Remplacer un prix existant prend un clic et la frappe du montant, contre deux clics
  et l'effacement de l'ancien montant auparavant.
- **SC-002**: Aucun bouton « Modifier » n'apparaît plus sur un champ de prix du site.
- **SC-003**: Un montant tapé puis suivi d'un rechargement de page est retrouvé au retour dans
  tous les cas où il ne demandait pas de confirmation.
- **SC-004**: Entrer puis sortir d'un champ sans rien changer ne modifie jamais la date d'un prix.

## Assumptions

- La protection contre les frappes accidentelles par verrouillage est abandonnée à la demande de
  l'utilisateur ; la sélection du contenu au focus et la règle « rien n'est enregistré si rien n'a
  changé » la remplacent. La confirmation de prix inhabituel reste le garde-fou contre une erreur de
  frappe en Mode communautaire.
- « Tous les champs de prix » désigne les deux champs partagés par le site : celui du prix unitaire
  d'une ressource (pages Recherche et HDV) et celui du prix HDV d'un objet (page Recherche). Les
  autres champs numériques (Forgemagie, XP Familier, niveaux) ne sont pas concernés.
- Au rechargement, l'enregistrement se fait au mieux : le navigateur peut interrompre une page qui
  se ferme, mais le montant est envoyé avant.
- Le Mode personnel garde son enregistrement actuel du prix HDV à chaque frappe ; il n'a donc rien à
  rattraper au rechargement pour ce champ.
