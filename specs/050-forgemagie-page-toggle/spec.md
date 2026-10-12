# Feature Specification: Activer ou désactiver la page Forgemagie

**Feature Branch**: `050-forgemagie-page-toggle`

**Created**: 2026-10-12

**Status**: Draft

**Input**: User description: « Pour la page Forgemagie, la désactiver pour le moment et, dans la
page administration, mettre quelque chose pour pouvoir la réactiver simplement ou la désactiver. »
Choix retenus : un interrupteur dans la page d'administration privée existante (specs/014), sans
redéploiement ; la page est désactivée tant que le propriétaire ne l'a pas activée ; seule la page
du site est masquée, les données et le bot Discord ne sont pas touchés.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - La page Forgemagie est masquée aux joueurs (Priority: P1)

Tant que la page est désactivée, un joueur qui ouvre le site ne voit plus « Forgemagie » dans la
navigation. S'il ouvre directement l'adresse de la page (favori, lien partagé), il lit un court
message disant que la page est momentanément indisponible, avec un lien vers la Recherche.

**Why this priority**: c'est la demande immédiate — la page doit être désactivée dès maintenant.

**Independent Test**: sans avoir rien activé dans l'administration, ouvrir le site : le lien
« Forgemagie » est absent et l'adresse de la page affiche le message d'indisponibilité.

**Acceptance Scenarios**:

1. **Given** la page désactivée, **When** un joueur ouvre le site, **Then** la navigation ne contient
   pas de lien « Forgemagie ».
2. **Given** la page désactivée, **When** un joueur ouvre l'adresse de la page Forgemagie, **Then** il
   voit le message « Forgemagie est momentanément indisponible » et un lien vers la Recherche, et
   aucun contenu de la page Forgemagie.
3. **Given** aucun réglage n'a jamais été enregistré, **When** un joueur ouvre le site, **Then** la
   page est considérée comme désactivée.

---

### User Story 2 - Réactiver ou désactiver depuis l'administration (Priority: P1)

Le propriétaire ouvre la page d'administration et voit l'état de la page Forgemagie (activée ou
désactivée). Un seul clic change cet état. Les joueurs voient le changement à leur prochaine visite
ou au prochain rechargement, sans redéploiement.

**Why this priority**: sans cela, la désactivation ne pourrait être levée que par un redéploiement.

**Independent Test**: activer la page dans l'administration, recharger le site : le lien et la page
sont de retour ; la désactiver : ils disparaissent de nouveau.

**Acceptance Scenarios**:

1. **Given** la page désactivée, **When** le propriétaire l'active, **Then** l'administration affiche
   « activée » et, après rechargement du site, le lien « Forgemagie » et la page fonctionnent comme
   avant.
2. **Given** la page activée, **When** le propriétaire la désactive, **Then** l'administration affiche
   « désactivée » et, après rechargement du site, le lien et la page ne sont plus accessibles.
3. **Given** une personne qui n'est pas le propriétaire, **When** elle tente de changer le réglage,
   **Then** le changement est refusé.
4. **Given** l'enregistrement échoue (service indisponible), **When** le propriétaire clique,
   **Then** l'administration le dit et continue d'afficher l'état réellement enregistré.

---

### User Story 3 - Le site reste cohérent quand le réglage ne peut pas être lu (Priority: P2)

Le site ne parvient pas à lire le réglage (hors ligne, service indisponible). Il applique le dernier
état connu sur cet appareil ; s'il n'en connaît aucun, il considère la page désactivée.

**Why this priority**: évite que la page réapparaisse ou disparaisse au hasard d'une panne.

**Independent Test**: charger le site une fois avec la page activée, couper le service, recharger :
la page reste accessible. Sur un appareil neuf sans service : la page est masquée.

**Acceptance Scenarios**:

1. **Given** un appareil qui a déjà lu « activée », **When** le réglage ne peut pas être lu, **Then**
   la page reste accessible.
2. **Given** un appareil qui n'a jamais lu le réglage, **When** il ne peut pas être lu, **Then** la
   page est masquée.

### Edge Cases

- Le joueur est sur la page Forgemagie au moment où le propriétaire la désactive : il continue sa
  visite en cours ; la page est masquée à son prochain chargement du site.
- Pendant la lecture du réglage au chargement, le site applique le dernier état connu de l'appareil
  (désactivée à défaut), puis s'ajuste dès que la lecture aboutit, sans afficher la page Forgemagie
  par erreur entre-temps.
- Réactivation après une longue désactivation : séances, profils, captures et connexion du joueur
  sont retrouvés tels qu'ils étaient.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Le site DOIT connaître un réglage « page Forgemagie activée », à deux valeurs
  (activée, désactivée), commun à tous les joueurs.
- **FR-002**: Tant qu'aucune valeur n'a été enregistrée, la page DOIT être considérée désactivée.
- **FR-003**: Page désactivée, la navigation du site NE DOIT PAS afficher le lien « Forgemagie ».
- **FR-004**: Page désactivée, l'adresse de la page DOIT afficher un message d'indisponibilité avec
  un lien vers la Recherche, et NE DOIT charger aucun contenu de la page Forgemagie.
- **FR-005**: Page activée, le lien et la page DOIVENT se comporter exactement comme avant cette
  fonctionnalité.
- **FR-006**: La page d'administration DOIT afficher l'état actuel du réglage et permettre de le
  changer en une action, sans redéploiement.
- **FR-007**: Seul le propriétaire, par l'administration protégée, DOIT pouvoir changer le réglage ;
  la lecture du réglage est publique.
- **FR-008**: Si l'enregistrement échoue, l'administration DOIT le signaler et afficher l'état
  réellement enregistré.
- **FR-009**: Si le site ne peut pas lire le réglage, il DOIT appliquer le dernier état lu sur cet
  appareil et, à défaut, considérer la page désactivée.
- **FR-010**: Désactiver la page NE DOIT supprimer ni modifier aucune donnée de Forgemagie.

### Key Entities

- **Réglage de la page Forgemagie**: un état unique (activée ou désactivée) et la date de son
  dernier changement ; lu par tous, modifié par le propriétaire seulement.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Le propriétaire change l'état de la page en moins de 10 secondes depuis
  l'administration, en un seul clic.
- **SC-002**: Après un changement, 100 % des chargements suivants du site (service joignable)
  reflètent le nouvel état.
- **SC-003**: Page désactivée, aucun chemin du site (navigation ou adresse directe) n'affiche le
  contenu de la page Forgemagie.
- **SC-004**: Après une désactivation puis une réactivation, aucune donnée Forgemagie n'est perdue.

## Assumptions

- Seule la page du site est concernée : le service Forgemagie et le bot Discord continuent de
  fonctionner et d'enregistrer pendant la désactivation.
- Le changement est vu au prochain chargement du site ; aucune mise à jour en direct des visites en
  cours n'est attendue.
- La désactivation est un masquage de confort, pas une mesure de sécurité : les données Forgemagie
  restent protégées par leurs règles d'accès existantes.
- L'administration et sa protection d'accès existantes (specs/014) sont réutilisées, ainsi que la
  base du message d'information (specs/020).
- La mise en service demande d'appliquer un changement de base et de redéployer le site, le service
  public et l'administration une fois ; ensuite plus aucun redéploiement n'est nécessaire.
