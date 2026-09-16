# Feature Specification: Comparaison rentabilité craft

**Feature Branch**: `001-craft-profit-comparison`

**Created**: 2026-09-13

**Status**: Draft

**Input**: User description: "Créer une application web Dofus Craft pour comparer le coût de fabrication d'un objet à son prix à l'hôtel des ventes."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Comparer un objet (Priority: P1)

Un joueur recherche un objet Dofus, le sélectionne, renseigne les prix de ses ressources et le
prix observé à l'hôtel des ventes (HDV), puis obtient immédiatement le coût de fabrication et
l'option la plus rentable.

**Why this priority**: Cette comparaison est la proposition de valeur centrale de Dofus Craft.

**Independent Test**: Le parcours est validé avec un objet disposant d'une recette, des prix de
ressources et d'un prix HDV connus ; le résultat affiche un coût de craft, une différence et une
recommandation vérifiable manuellement.

**Acceptance Scenarios**:

1. **Given** un joueur consulte le catalogue, **When** il recherche le nom d'un objet et le
   sélectionne, **Then** l'application affiche son visuel lorsqu'il est disponible, sa catégorie,
   sa recette et les quantités requises.
2. **Given** une recette complète, **When** le joueur saisit un prix unitaire pour chaque
   ressource et un prix HDV pour l'objet, **Then** l'application affiche le coût total du craft,
   l'option la plus rentable, l'écart en kamas et le pourcentage pertinent.
3. **Given** le coût de craft est égal au prix HDV, **When** le calcul est affiché, **Then**
   l'application indique qu'aucune option n'offre d'économie plutôt que de recommander un choix.
4. **Given** le joueur vient de saisir ou modifier le prix HDV, **When** le résultat se met à jour,
   **Then** la recommandation, le coût de craft et l'économie réalisée apparaissent immédiatement à
   proximité du champ de saisie, sans action de défilement supplémentaire pour les consulter.
5. **Given** une recommandation définitive (fabriquer ou acheter est plus rentable), **When** le
   joueur consulte le résultat, **Then** celui-ci est visuellement distingué d'un résultat non
   conclusif (égalité ou données insuffisantes), de façon à identifier immédiatement s'il s'agit
   d'une recommandation exploitable ou non.

---

### User Story 2 - Réutiliser les prix de ressources (Priority: P2)

Un joueur qui a déjà renseigné le prix d'une ressource retrouve automatiquement ce prix lorsqu'il
consulte une autre recette utilisant la même ressource. Il peut le corriger à tout moment et voit
sa date de dernière mise à jour.

**Why this priority**: La réutilisation évite les saisies répétitives et rend les comparaisons
utiles sur une durée réelle de jeu.

**Independent Test**: Après avoir enregistré le prix d'une ressource dans une première recette,
le joueur ouvre une seconde recette contenant cette ressource et constate que le prix et sa date
sont réutilisés ; il les modifie et le nouveau prix est appliqué au calcul.

**Acceptance Scenarios**:

1. **Given** un prix de ressource enregistré, **When** le joueur ouvre une recette utilisant la
   même ressource, **Then** le prix enregistré et sa date de dernière modification sont affichés.
2. **Given** un prix de ressource affiché, **When** le joueur le modifie et confirme la valeur,
   **Then** le coût de craft est recalculé et la date de dernière modification est actualisée.
3. **Given** une ressource sans prix enregistré, **When** le joueur consulte la recette,
   **Then** l'application la signale comme manquante et exclut toute recommandation de
   rentabilité définitive.

---

### User Story 3 - Explorer le catalogue sur tout écran (Priority: P3)

Un joueur explore les objets par catégorie ou par recherche, puis utilise la comparaison sans
perdre en lisibilité sur ordinateur ou mobile.

**Why this priority**: Le catalogue et l'interface responsive rendent la fonction centrale
accessible et rapide à utiliser dans les contextes de jeu courants.

**Independent Test**: Un joueur filtre une catégorie, sélectionne un objet et termine la
comparaison sur un écran de bureau puis sur un téléphone, sans action inaccessible ni information
masquée.

**Acceptance Scenarios**:

1. **Given** le catalogue d'objets, **When** le joueur choisit une catégorie telle qu'amulette,
   anneau, cape, coiffe, ceinture, bottes, arme, trophée ou bouclier, **Then** seuls les objets
   de cette catégorie sont proposés.
2. **Given** l'écran de comparaison sur mobile, **When** le joueur consulte la recette et saisit
   des prix, **Then** les champs, le résultat et l'action de modification restent utilisables sans
   défilement horizontal.

### Edge Cases

- Une recherche sans résultat affiche un état explicite et permet au joueur de modifier sa
  recherche ou son filtre.
- Un objet sans recette disponible est identifiable comme tel et ne présente pas de comparaison
  de craft.
- Un objet ou une ressource sans visuel reste identifiable par son nom et sa catégorie.
- Les prix vides, négatifs, non numériques ou non entiers en kamas sont refusés avec une
  explication ; un prix nul est accepté lorsqu'il est explicitement saisi.
- Une recette contenant une ou plusieurs ressources sans prix affiche le coût partiel connu mais
  ne conclut pas sur la rentabilité.
- Les calculs d'écart et de pourcentage gèrent un prix HDV nul ou absent sans division par zéro ni
  pourcentage trompeur.
- Lorsque le résultat n'est pas conclusif faute de données (prix de ressource ou prix HDV manquant),
  le détail de ce qui manque reste consultable par le joueur sur ordinateur comme sur mobile/tactile,
  et pas uniquement via une interaction impossible à reproduire au doigt (ex. survol souris seul).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Le système MUST permettre au joueur de rechercher un objet par son nom et de le
  sélectionner dans le catalogue Dofus disponible.
- **FR-002**: Le système MUST permettre au joueur de parcourir les objets par catégorie, dont au
  minimum amulette, anneau, cape, coiffe, ceinture, bottes, arme, trophée et bouclier lorsque ces
  catégories sont présentes dans le catalogue.
- **FR-003**: Le système MUST afficher le visuel d'un objet lorsque celui-ci est disponible et
  conserver une identification claire de l'objet lorsqu'il ne l'est pas.
- **FR-004**: Pour un objet sélectionné avec recette, le système MUST afficher chaque ressource
  requise et sa quantité.
- **FR-005**: Le système MUST permettre au joueur de saisir, enregistrer et modifier le prix
  unitaire en kamas de chaque ressource.
- **FR-006**: Le système MUST réutiliser automatiquement un prix de ressource enregistré dans
  toute recette contenant la même ressource.
- **FR-007**: Le système MUST conserver et afficher la date de dernière modification de chaque
  prix de ressource.
- **FR-008**: Le système MUST permettre au joueur de saisir et modifier le prix HDV observé pour
  l'objet sélectionné.
- **FR-009**: Le système MUST calculer le coût total du craft en multipliant la quantité requise
  de chaque ressource par son prix unitaire enregistré, puis en additionnant les montants.
- **FR-010**: Lorsque tous les prix nécessaires et le prix HDV sont renseignés, le système MUST
  comparer les deux montants et indiquer clairement s'il est plus rentable de fabriquer,
  d'acheter, ou si les deux options sont équivalentes. Une recommandation définitive (fabriquer ou
  acheter) MUST être visuellement distinguée d'un résultat non conclusif (égalité ou données
  insuffisantes).
- **FR-011**: Le système MUST afficher l'écart en kamas et, lorsque le calcul est défini, le
  pourcentage d'économie ou de rentabilité avec son point de comparaison explicite.
- **FR-012**: Le système MUST signaler les données manquantes, incertaines ou indisponibles et
  MUST NOT présenter une recommandation définitive fondée sur un coût incomplet. Le détail de ce
  qui manque MUST rester consultable par le joueur sur ordinateur comme sur mobile/tactile, que ce
  signalement soit permanent ou accessible à la demande.
- **FR-016**: Le système MUST afficher le résultat de la comparaison (recommandation, coût de
  craft, économie réalisée) à proximité immédiate du champ de saisie du prix HDV, sans nécessiter
  de défilement supplémentaire pour le consulter.
- **FR-013**: Le système MUST identifier la source et la version des données d'objets et de
  recettes affichées lorsque ces informations sont disponibles.
- **FR-014**: Le système MUST offrir une expérience utilisable sur écrans de bureau et mobiles,
  avec les informations essentielles et les actions de saisie accessibles sur chaque format.
- **FR-015**: Le système MUST préserver les prix de ressources et leurs dates de modification
  entre les consultations successives du même joueur sur son appareil.

### Key Entities *(include if feature involves data)*

- **Objet Dofus**: Élément sélectionnable du catalogue ; comprend son nom, sa catégorie, son
  visuel éventuel, sa recette éventuelle et l'information de provenance de ses données.
- **Catégorie d'objet**: Regroupement navigable d'objets, par exemple amulette, arme ou bouclier.
- **Recette**: Composition d'un objet fabriquable ; relie l'objet aux ressources requises et à
  leurs quantités.
- **Ressource**: Ingrédient identifiable réutilisable dans une ou plusieurs recettes.
- **Prix de ressource**: Prix unitaire en kamas saisi par le joueur pour une ressource, accompagné
  de sa date de dernière modification.
- **Prix HDV**: Prix observé en kamas auquel l'objet sélectionné est disponible à l'hôtel des
  ventes.
- **Comparaison de rentabilité**: Résultat calculé associant le coût de craft, le prix HDV, leur
  écart, le pourcentage applicable et la recommandation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Au moins 90 % des joueurs testeurs peuvent rechercher un objet, saisir les prix
  nécessaires et comprendre la recommandation craft ou achat en moins de 2 minutes, sans aide.
- **SC-002**: Pour 100 recettes de référence dont les prix sont complets, le coût de craft, l'écart
  et la recommandation correspondent à un calcul manuel dans 100 % des cas.
- **SC-003**: Au moins 95 % des comparaisons avec des données déjà disponibles s'affichent au
  joueur en moins de 2 secondes après la sélection de l'objet ou la modification d'un prix.
- **SC-004**: Dans un test avec deux recettes partageant une ressource, 100 % des prix enregistrés
  sont réutilisés avec leur date de modification correcte dans la seconde recette.
- **SC-005**: Au moins 90 % des joueurs testeurs peuvent réaliser le parcours principal sur un
  mobile et sur un écran de bureau sans rencontrer d'action inaccessible ou de défilement
  horizontal nécessaire.

## Assumptions

- La première version est destinée à un joueur individuel sans compte utilisateur ; les prix sont
  persistés pour son profil local sur l'appareil utilisé.
- Le catalogue, les recettes, les catégories et les visuels disponibles sont fournis par une source
  de données dont la provenance et la version peuvent être communiquées dans l'application.
- Les prix HDV sont saisis manuellement et représentent le prix observé par le joueur au moment de
  la comparaison ; aucune collecte automatique de prix n'est incluse dans cette version.
- Les prix sont exprimés en kamas entiers et concernent une unité de ressource ou un exemplaire de
  l'objet, sans frais de mise en vente, taxes ni coût de temps de jeu dans le calcul initial.
- Les favoris, l'historique des comparaisons, la détection d'opportunités et la synchronisation ou
  récupération automatique des prix sont hors périmètre de cette fonctionnalité initiale, mais les
  données et parcours pourront être étendus ultérieurement.
