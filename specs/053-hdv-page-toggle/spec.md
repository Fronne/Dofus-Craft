# Feature Specification: Activer ou désactiver la page HDV

**Feature Branch**: `053-hdv-page-toggle`

**Created**: 2026-10-14

**Status**: Draft

**Input**: User description: « J'aimerais que dans la page admin, tu rajoutes la possibilité
d'activer la page HDV. » Choix retenus : un interrupteur dans la page d'administration, sur le
modèle de celui de la page Forgemagie (specs/050) ; tant que le propriétaire n'y a pas touché, la
page HDV reste activée, de sorte que rien ne change au déploiement ; le réglage Forgemagie existant
n'est pas modifié.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Désactiver ou réactiver la page HDV depuis l'administration (Priority: P1)

Le propriétaire ouvre la page d'administration et voit, à côté du réglage de la page Forgemagie,
l'état de la page HDV (activée ou désactivée). Un seul clic change cet état. Les joueurs voient le
changement à leur prochaine visite ou au prochain rechargement, sans redéploiement.

**Why this priority**: c'est la demande ; sans elle, masquer la page HDV demanderait un
redéploiement.

**Independent Test**: dans l'administration, désactiver la page HDV puis recharger le site : le lien
« HDV » a disparu ; la réactiver : il est de retour.

**Acceptance Scenarios**:

1. **Given** la page HDV activée, **When** le propriétaire la désactive, **Then** l'administration
   affiche « désactivée » et, après rechargement du site, le lien « HDV » n'est plus dans la
   navigation.
2. **Given** la page HDV désactivée, **When** le propriétaire l'active, **Then** l'administration
   affiche « activée » et, après rechargement du site, le lien et la page HDV fonctionnent comme
   avant.
3. **Given** une personne qui n'est pas le propriétaire, **When** elle tente de changer le réglage,
   **Then** le changement est refusé.
4. **Given** l'enregistrement échoue (service indisponible), **When** le propriétaire clique,
   **Then** l'administration le dit et continue d'afficher l'état réellement enregistré.
5. **Given** les deux réglages (Forgemagie et HDV), **When** le propriétaire change l'un, **Then**
   l'autre garde sa valeur.

---

### User Story 2 - La page HDV est masquée aux joueurs quand elle est désactivée (Priority: P1)

Tant que la page HDV est désactivée, un joueur ne voit plus « HDV » dans la navigation. S'il ouvre
directement l'adresse de la page (favori, lien partagé), il lit un court message disant que la page
est momentanément indisponible, avec un lien vers la Recherche.

**Why this priority**: c'est l'effet attendu de l'interrupteur.

**Independent Test**: page désactivée, ouvrir le site : le lien « HDV » est absent et l'adresse de la
page affiche le message d'indisponibilité.

**Acceptance Scenarios**:

1. **Given** la page désactivée, **When** un joueur ouvre le site, **Then** la navigation ne contient
   pas de lien « HDV ».
2. **Given** la page désactivée, **When** un joueur ouvre l'adresse de la page HDV, **Then** il voit
   le message « HDV est momentanément indisponible » et un lien vers la Recherche, et aucun contenu
   de la page HDV.
3. **Given** aucun réglage HDV n'a jamais été enregistré, **When** un joueur ouvre le site, **Then**
   la page HDV est activée, comme aujourd'hui.

---

### User Story 3 - Le site reste cohérent quand le réglage ne peut pas être lu (Priority: P2)

Le site ne parvient pas à lire le réglage (hors ligne, service indisponible). Il applique le dernier
état connu sur cet appareil ; s'il n'en connaît aucun, il considère la page HDV activée.

**Why this priority**: évite que la page disparaisse au hasard d'une panne.

**Independent Test**: charger le site une fois avec la page HDV désactivée, couper le service,
recharger : la page reste masquée. Sur un appareil neuf sans service : la page est visible.

**Acceptance Scenarios**:

1. **Given** un appareil qui a déjà lu « désactivée », **When** le réglage ne peut pas être lu,
   **Then** la page HDV reste masquée.
2. **Given** un appareil qui n'a jamais lu le réglage, **When** il ne peut pas être lu, **Then** la
   page HDV est visible.

### Edge Cases

- Le joueur est sur la page HDV au moment où le propriétaire la désactive : il continue sa visite en
  cours ; la page est masquée à son prochain chargement du site.
- Pendant la lecture du réglage au chargement, le site applique le dernier état connu de l'appareil
  (activée à défaut), puis s'ajuste dès que la lecture aboutit.
- Un appareil qui a gardé en mémoire les réglages d'avant cette fonctionnalité (seulement
  Forgemagie) considère la page HDV activée.
- La page HDV désactivée, les prix restent saisissables et consultables ailleurs sur le site
  (Recherche, Suivis, Rentabilité) : seule la page HDV est masquée.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Le site DOIT connaître un réglage « page HDV activée », à deux valeurs (activée,
  désactivée), commun à tous les joueurs, distinct du réglage de la page Forgemagie.
- **FR-002**: Tant qu'aucune valeur n'a été enregistrée, la page HDV DOIT être considérée activée.
- **FR-003**: Page désactivée, la navigation du site NE DOIT PAS afficher le lien « HDV ».
- **FR-004**: Page désactivée, l'adresse de la page HDV DOIT afficher un message d'indisponibilité
  avec un lien vers la Recherche, et NE DOIT afficher aucun contenu de la page HDV.
- **FR-005**: Page activée, le lien et la page HDV DOIVENT se comporter exactement comme avant cette
  fonctionnalité.
- **FR-006**: La page d'administration DOIT afficher l'état actuel du réglage HDV et permettre de le
  changer en une action, sans redéploiement, à côté du réglage Forgemagie.
- **FR-007**: Seul le propriétaire, par l'administration protégée, DOIT pouvoir changer le réglage ;
  la lecture du réglage est publique.
- **FR-008**: Si l'enregistrement échoue, l'administration DOIT le signaler et afficher l'état
  réellement enregistré.
- **FR-009**: Si le site ne peut pas lire le réglage, il DOIT appliquer le dernier état lu sur cet
  appareil et, à défaut, considérer la page HDV activée.
- **FR-010**: Changer le réglage HDV NE DOIT pas modifier le réglage Forgemagie, et inversement.
- **FR-011**: Désactiver la page HDV NE DOIT supprimer ni modifier aucun prix enregistré.

### Key Entities

- **Réglage de la page HDV**: un état unique (activée ou désactivée) et la date de son dernier
  changement ; lu par tous, modifié par le propriétaire seulement. Il rejoint le réglage de la page
  Forgemagie parmi les réglages du site.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Le propriétaire change l'état de la page HDV en moins de 10 secondes depuis
  l'administration, en un seul clic.
- **SC-002**: Après un changement, 100 % des chargements suivants du site (service joignable)
  reflètent le nouvel état.
- **SC-003**: Page désactivée, aucun chemin du site (navigation ou adresse directe) n'affiche le
  contenu de la page HDV.
- **SC-004**: Au déploiement de la fonctionnalité, sans aucune action du propriétaire, la page HDV
  reste accessible à 100 % des joueurs.

## Assumptions

- Seule la page HDV est concernée : les prix, leur partage et leur historique continuent de
  fonctionner partout ailleurs pendant la désactivation.
- Le changement est vu au prochain chargement du site ; aucune mise à jour en direct des visites en
  cours n'est attendue.
- La désactivation est un masquage de confort, pas une mesure de sécurité.
- L'administration, sa protection d'accès et le mécanisme de réglages du site de specs/050 sont
  réutilisés ; le message d'indisponibilité suit celui de la page Forgemagie.
- La mise en service demande d'appliquer un changement de base et de redéployer le site, le service
  public et l'administration une fois ; ensuite plus aucun redéploiement n'est nécessaire.
