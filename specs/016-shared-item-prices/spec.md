# Feature Specification: Prix HDV des objets partagé en Mode communautaire

**Feature Branch**: `016-shared-item-prices`

**Created**: 2026-09-25

**Status**: Draft

**Input**: User description: "Pour le prix des équipements je veux finalement qu'il soit partagé en
mode communautaire avec tous les utilisateurs." Précisions du joueur : pas de médiane pour les
objets, juste le prix le plus frais ; une confirmation si le prix saisi est vraiment très différent
du dernier prix affiché ; pas de nombre de contributions, uniquement la date de mise à jour. Et,
d'après la proposition validée : champ pré-rempli et verrouillé comme les prix de ressources, page
Suivis alignée, Mode personnel inchangé.

## Clarifications

### Session 2026-09-25

- Q: À partir de quel écart avec le dernier prix affiché demander une confirmation ? → A: 50 %.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Voir le dernier prix HDV partagé par le groupe (Priority: P1)

En Mode communautaire, le joueur ouvre la fiche d'un objet : le champ « Prix HDV » est déjà rempli
avec le prix le plus récent qu'un joueur du groupe a partagé pour cet objet sur le serveur actif, et
la date de cette dernière mise à jour s'affiche sous le champ. La comparaison craft / HDV utilise
directement ce prix, sans que le joueur ait à le saisir.

**Why this priority**: C'est la valeur même de la fonctionnalité : un prix HDV relevé par un joueur
profite immédiatement à tout le groupe.

**Independent Test**: Un premier appareil partage un prix HDV pour un objet ; sur un second appareil
en Mode communautaire, sur le même serveur, ouvrir l'objet : le champ affiche ce prix et sa date.

**Acceptance Scenarios**:

1. **Given** un prix HDV partagé à 6 000 kamas pour un objet sur le serveur actif, **When** un joueur
   en Mode communautaire ouvre cet objet, **Then** le champ « Prix HDV » affiche 6 000, verrouillé,
   avec la date de ce partage, et la comparaison l'utilise.
2. **Given** plusieurs prix partagés successivement (5 000 puis 6 000), **When** le joueur ouvre
   l'objet, **Then** c'est le plus récent (6 000) qui s'affiche, pas une moyenne ni une médiane.
3. **Given** aucun prix partagé pour cet objet sur ce serveur, **When** le joueur ouvre l'objet,
   **Then** le champ est vide et directement saisissable, comme aujourd'hui.
4. **Given** un prix partagé sur un autre serveur uniquement, **When** le joueur ouvre l'objet sur
   son serveur, **Then** ce prix n'est pas repris.

---

### User Story 2 - Partager un prix HDV relevé en jeu (Priority: P1)

Le joueur relève un prix à l'HDV. Il déverrouille le champ avec le crayon (ou le remplit directement
s'il est vide), saisit le prix et valide en quittant le champ : ce prix est partagé anonymement et
devient le prix le plus récent pour tout le groupe sur ce serveur.

**Why this priority**: Sans partage, rien n'alimente la User Story 1.

**Independent Test**: Saisir un prix sur un objet puis, sur un autre appareil, constater qu'il
s'affiche avec la date du jour.

**Acceptance Scenarios**:

1. **Given** un champ « Prix HDV » vide, **When** le joueur saisit 7 000 et quitte le champ, **Then**
   le prix est partagé et la date de mise à jour indique « maintenant ».
2. **Given** un champ rempli et verrouillé, **When** le joueur clique sur le crayon, modifie le prix
   et quitte le champ, **Then** le nouveau prix est partagé.
3. **Given** un champ déverrouillé puis quitté sans modification, **When** le focus sort du champ,
   **Then** rien n'est partagé et la date ne change pas.
4. **Given** le service communautaire injoignable, **When** le joueur valide un prix, **Then** le
   prix reste affiché et utilisé localement, sans message bloquant, comme pour les ressources.

---

### User Story 3 - Confirmer un prix très différent du dernier prix affiché (Priority: P2)

Si le prix saisi s'écarte très fortement du dernier prix partagé affiché, une fenêtre de
confirmation rappelle le dernier prix, le prix saisi et l'écart, avant tout partage. Le joueur
confirme (le prix est partagé) ou annule (rien n'est partagé et le champ revient au dernier prix).

**Why this priority**: Protège le groupe contre une faute de frappe (un zéro de trop), sans gêner
les mises à jour normales.

**Independent Test**: Avec un dernier prix de 6 000, saisir 60 000 : la confirmation apparaît ;
annuler : rien n'est partagé et le champ revient à 6 000 ; confirmer : 60 000 est partagé.

**Acceptance Scenarios**:

1. **Given** un dernier prix affiché de 6 000, **When** le joueur saisit un prix dont l'écart dépasse
   le seuil, **Then** la confirmation s'affiche avec le dernier prix, le prix saisi et l'écart.
2. **Given** la confirmation affichée, **When** le joueur annule, **Then** rien n'est partagé, la
   date ne change pas et le champ revient au dernier prix.
3. **Given** la confirmation affichée, **When** le joueur confirme, **Then** le prix est partagé.
4. **Given** aucun prix partagé encore pour cet objet, **When** le joueur saisit un premier prix,
   **Then** aucune confirmation n'est demandée.

---

### User Story 4 - La page Suivis affiche le prix partagé (Priority: P2)

En Mode communautaire, le montant « HDV : … » des cartes de la page Suivis est le même prix partagé
le plus récent que la fiche de l'objet, et la comparaison des cartes l'utilise.

**Why this priority**: Évite deux prix HDV différents pour le même objet entre la fiche et Suivis.

**Independent Test**: Suivre un objet dont un prix a été partagé par un autre appareil : la carte
affiche ce prix sans ouvrir la fiche.

**Acceptance Scenarios**:

1. **Given** un objet suivi avec un prix partagé à 6 000, **When** le joueur ouvre la page Suivis en
   Mode communautaire, **Then** la carte affiche « HDV : 6 000 kamas ».

---

### Edge Cases

- **Mode personnel** : strictement inchangé ; le prix HDV reste propre à l'appareil et n'est jamais
  partagé ni remplacé par un prix partagé.
- **Prix HDV saisis localement avant cette fonctionnalité** : ils restent dans le carnet du Mode
  personnel ; en Mode communautaire, c'est le prix partagé qui s'affiche (ou un champ vide).
- **Service injoignable à l'ouverture** : le dernier prix partagé déjà vu sur cet appareil pour cet
  objet et ce serveur s'affiche, avec sa date ; à défaut, le champ est vide et saisissable.
- **Prix partagé ancien** : il reste affiché tant qu'aucun prix plus récent n'existe ; sa date le
  signale, avec le même surlignage de prix ancien que les ressources (specs/008 : « ancien » à partir
  de 3 jours, « expiré » à partir de 7 jours).
- **Saisie pendant que le service est injoignable** : elle reste affichée et utilisée pour la visite
  en cours, mais n'est pas renvoyée automatiquement plus tard ; après un rechargement, le champ
  affiche de nouveau le dernier prix partagé connu — même comportement que les prix de ressources.
- **Deux joueurs partagent presque en même temps** : le dernier enregistré devient le prix le plus
  récent.
- **Prix à 0** : un prix de 0 saisi volontairement est un prix valide et se partage ; un champ vide
  n'est jamais partagé.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: En Mode communautaire, le système MUST pré-remplir le champ « Prix HDV » d'un objet avec
  le prix le plus récent partagé pour cet objet sur le serveur actif, et MUST NOT utiliser de médiane
  ni de moyenne pour les objets.
- **FR-002**: Le système MUST afficher sous le champ la date de ce dernier prix (« Dernière mise à
  jour : … ») et MUST NOT afficher de nombre de contributions pour les objets.
- **FR-003**: Le champ MUST être verrouillé dès qu'il contient un prix, avec un bouton pour le
  déverrouiller, et se reverrouiller à la sortie du champ — même comportement que les prix de
  ressources en Mode communautaire.
- **FR-004**: Une saisie validée (sortie du champ après une modification réelle) MUST être partagée
  anonymement, sans aucune donnée identifiant le joueur, et devenir le prix le plus récent pour cet
  objet et ce serveur.
- **FR-005**: Une sortie du champ sans modification MUST NOT partager de prix ni changer la date.
- **FR-006**: Lorsque le prix saisi s'écarte du dernier prix affiché de plus de
  50 % (écart calculé par rapport au dernier prix affiché ; plus large que les 25 % des ressources,
  les prix d'équipements variant davantage),
  le système MUST demander une confirmation indiquant le dernier prix, le prix saisi et l'écart,
  avant tout partage.
- **FR-007**: Si le joueur annule la confirmation, le système MUST NOT partager le prix, MUST
  conserver la date et MUST remettre le champ au dernier prix affiché.
- **FR-008**: Sans prix partagé existant pour l'objet sur ce serveur, le système MUST NOT demander de
  confirmation.
- **FR-009**: La page Suivis MUST afficher, en Mode communautaire, le même prix partagé le plus récent
  que la fiche et l'utiliser dans la comparaison de chaque carte.
- **FR-010**: En Mode personnel, le système MUST conserver exactement le comportement actuel du prix
  HDV (local à l'appareil, par serveur) et MUST NOT le partager.
- **FR-011**: Si le service communautaire est injoignable, le système MUST afficher le dernier prix
  partagé déjà connu sur l'appareil pour cet objet et ce serveur (avec sa date), ou un champ vide, et
  MUST laisser le joueur saisir et utiliser un prix localement sans message bloquant ; cette saisie
  vaut pour la visite en cours et n'est pas renvoyée automatiquement plus tard.
- **FR-012**: Chaque confirmation acceptée (FR-006) MUST être tracée comme les confirmations d'écart
  des ressources (specs/007, FR-009), sans donnée identifiant le joueur.

### Key Entities *(include if feature involves data)*

- **Contribution de prix HDV** : un prix partagé pour un objet sur un serveur, avec sa date et un
  identifiant anonyme d'appareil ; même nature qu'une contribution de prix de ressource.
- **Prix HDV partagé le plus récent** : la contribution la plus récente d'un objet sur un serveur —
  son montant et sa date sont ce que voient les joueurs.
- **Prix HDV local (existant)** : le prix saisi en Mode personnel, par objet et par serveur,
  inchangé.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un prix HDV partagé depuis un appareil est visible sur la fiche de l'objet d'un autre
  appareil du groupe (même serveur, Mode communautaire) dès son ouverture suivante.
- **SC-002**: Le prix affiché est toujours le plus récent partagé, jamais un calcul sur plusieurs
  prix : pour une suite de partages, l'affichage est égal au dernier dans 100 % des cas.
- **SC-003**: Une saisie avec un zéro de trop par rapport au dernier prix déclenche la confirmation
  dans 100 % des cas ; une variation courante de prix n'en déclenche aucune.
- **SC-004**: Pour 100 % des objets suivis, le prix HDV de la carte Suivis est identique à celui de
  la fiche.
- **SC-005**: Aucun prix HDV n'est partagé depuis le Mode personnel.

## Assumptions

- L'API communautaire existante (specs/004) enregistre déjà des contributions par identifiant d'objet
  DofusDB et par serveur ; les objets et les ressources partagent le même espace d'identifiants sans
  collision. Il faut seulement pouvoir lire la contribution la plus récente d'un objet, en plus de la
  médiane utilisée pour les ressources.
- Le prix le plus récent est pris sans limite d'ancienneté : un vieux prix reste affiché, avec sa
  date, tant qu'aucun plus récent n'existe. Pour cela, seule la contribution la plus récente de chaque
  objet et serveur échappe à la suppression des contributions de plus de 90 jours (specs/004 FR-013) ;
  les prix de ressources gardent exactement la règle des 90 jours.
- Les prix de ressources gardent leur fonctionnement actuel (médiane, nombre de contributions).
- Le Mode communautaire concerne un petit groupe fermé de joueurs (une dizaine à une vingtaine) ;
  aucune modération au-delà de la confirmation d'écart n'est prévue.
- La fenêtre de confirmation reprend celle des ressources (specs/007), avec « dernier prix » à la
  place de « médiane communautaire ».

## Révision (2026-09-25) : historique des prix (specs/017-price-history-chart)

- Le champ « Prix HDV » gagne en Mode communautaire un bouton d'historique : la médiane par période
  des prix HDV partagés pour l'objet sur 90 jours. Le champ continue d'afficher le prix le plus
  récent (FR-001 inchangé) et la comparaison l'utilise toujours ; l'historique ne change aucun calcul.
- La rétention ne change pas : la contribution la plus récente d'un objet reste gardée au-delà de
  90 jours pour ce champ, mais n'entre pas dans l'historique une fois plus ancienne que 90 jours.
