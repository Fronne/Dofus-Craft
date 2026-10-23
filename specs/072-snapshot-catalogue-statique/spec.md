# Feature Specification: Catalogue du jeu servi en snapshot statique

**Feature Branch**: `072-snapshot-catalogue-statique`

**Created**: 2026-10-23

**Status**: Draft

**Input**: User description : « Servir le catalogue DofusDB sous forme de snapshot statique déployé
avec le site, au lieu du crawl paginé au lancement. » Constat (audit Lighthouse) : à la première
visite, le site télécharge tout le catalogue (objets et panoplies) en 60 à 120 requêtes paginées,
5 à 8 Mo, avec un temps avant interactivité de 20,7 s sur mobile. Décisions du porteur du projet :
le snapshot est régénéré à chaque déploiement, et le site vérifie discrètement en arrière-plan si la
source a changé, pour ne retélécharger qu'en cas d'écart. Prolonge
`specs/021-background-data-loading` (SC-001 : recherche complète dès l'ouverture).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Première visite rapide avec recherche complète (Priority: P1)

Un joueur ouvre le site pour la première fois (rien de gardé sur son appareil, souvent sur mobile).
Le catalogue complet des objets et des panoplies arrive sous la forme d'un petit paquet livré avec
le site, au lieu de plusieurs dizaines de requêtes vers la source du jeu. La recherche porte sur le
catalogue entier dès l'ouverture.

**Why this priority**: c'est le coût dominant de l'ouverture du site (poids et temps avant
interactivité) et le cas où le joueur attend le plus.

**Independent Test**: vider les données du site, bloquer l'accès à la source du jeu, ouvrir le site :
la recherche trouve des objets de toutes les catégories et les panoplies sont reconnues, sans aucune
requête vers la source du jeu.

**Acceptance Scenarios**:

1. **Given** une première visite, **When** le joueur ouvre le site, **Then** le catalogue complet est
   chargé en au plus 2 téléchargements de données (plus un fichier de description de quelques octets) depuis le site lui-même, pour un poids total d'environ 1 Mo ou
   moins, sans requête paginée vers la source du jeu.
2. **Given** le catalogue chargé, **When** le joueur recherche un objet, filtre par catégorie ou
   consulte une panoplie, **Then** les résultats sont identiques à ceux obtenus avec le catalogue
   téléchargé directement depuis la source du jeu.
3. **Given** la source du jeu injoignable, **When** le joueur ouvre le site pour la première fois,
   **Then** la recherche est complète quand même.

---

### User Story 2 - Snapshot à jour à chaque mise en ligne (Priority: P1)

Le porteur du projet met le site en ligne. Le catalogue livré avec cette version est reconstruit
automatiquement à partir de la source du jeu au moment de la préparation de la version : il n'y a
aucune étape manuelle et le catalogue livré n'est jamais plus vieux que la dernière mise en ligne.

**Why this priority**: sans cette génération automatique, le snapshot vieillirait en silence.

**Independent Test**: lancer la préparation de la version : le snapshot est produit, contient des
objets et des panoplies, et est inclus dans la version prête à être mise en ligne.

**Acceptance Scenarios**:

1. **Given** la source du jeu joignable, **When** la version du site est préparée, **Then** un
   snapshot compressé est généré et inclus, avec la date de génération et le nombre d'objets et de
   panoplies qu'il contient.
2. **Given** la source du jeu injoignable ou renvoyant un catalogue manifestement incomplet (par
   exemple vide), **When** la version du site est préparée, **Then** la préparation échoue avec un
   message clair plutôt que de livrer un snapshot vide ou tronqué ; un snapshot valide déjà présent
   n'est pas écrasé.
3. **Given** la préparation de la version, **When** elle est relancée, **Then** le snapshot est
   régénéré (pas de résultat périmé conservé d'une exécution précédente).

---

### User Story 3 - Rafraîchissement discret quand le jeu a changé (Priority: P2)

Le catalogue du jeu évolue entre deux mises en ligne du site (nouveaux objets après une mise à jour
du jeu). En arrière-plan, sans gêner le joueur, le site compare une valeur légère de la source du jeu
(par exemple le nombre d'objets et de panoplies) à celle du snapshot. Seulement en cas d'écart, il
retélécharge le catalogue, le garde sur l'appareil et l'utilise à partir de l'affichage suivant.

**Why this priority**: garde le catalogue exact entre deux mises en ligne, mais le snapshot suffit
déjà à rendre le site utilisable ; l'impact sur le joueur est moindre.

**Independent Test**: simuler une source du jeu dont le nombre d'objets diffère du snapshot : le
site retélécharge et utilise le catalogue mis à jour. Avec une source identique, une seule requête
légère part et rien n'est retéléchargé.

**Acceptance Scenarios**:

1. **Given** une source du jeu dont la valeur de contrôle est identique à celle du snapshot,
   **When** le joueur ouvre le site, **Then** au plus une requête légère part vers la source du jeu
   et aucun téléchargement du catalogue n'a lieu.
2. **Given** une valeur de contrôle différente, **When** le contrôle a lieu, **Then** le catalogue
   est retéléchargé en arrière-plan, gardé sur l'appareil, et utilisé à partir de l'affichage suivant
   sans faire clignoter la page en cours.
3. **Given** un catalogue rafraîchi déjà gardé sur l'appareil, **When** le joueur rouvre le site,
   **Then** ce catalogue est utilisé tout de suite à la place du snapshot s'il est plus récent, et
   un snapshot livré plus récent que le catalogue gardé le remplace.
4. **Given** la source du jeu injoignable ou en erreur pendant le contrôle ou le retéléchargement,
   **When** le rafraîchissement échoue, **Then** le joueur ne voit aucun message d'erreur et continue
   avec le catalogue déjà disponible.
5. **Given** plusieurs ouvertures du site rapprochées, **When** un contrôle a déjà eu lieu
   récemment, **Then** aucun nouveau contrôle ne part avant l'expiration d'un délai minimal.

---

### Edge Cases

- Snapshot absent ou illisible (livraison cassée, corruption) : le site retombe sur le chargement
  complet depuis la source du jeu, comme avant cette fonctionnalité, sans erreur bloquante.
- Navigateur sans stockage local disponible (navigation privée) : le snapshot est utilisé à chaque
  ouverture ; le rafraîchissement fonctionne en mémoire pour la session.
- Retéléchargement interrompu en cours (onglet fermé) : le catalogue gardé n'est jamais remplacé par
  un contenu partiel.
- Joueur déjà équipé d'un catalogue gardé par la spec 021 : il continue de fonctionner et n'est pas
  perdu ; il est comparé au snapshot livré et le plus récent est retenu.
- Le nombre d'objets est identique mais le contenu a changé (objet modifié sans ajout) : toléré
  jusqu'à la prochaine mise en ligne, qui régénère le snapshot.
- Un joueur garde l'onglet ouvert pendant une nouvelle mise en ligne : son catalogue en mémoire reste
  cohérent jusqu'au prochain rechargement.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La préparation de chaque version du site MUST générer automatiquement un snapshot
  compressé du catalogue (objets et panoplies, avec les mêmes informations que celles utilisées
  aujourd'hui par la recherche et les fiches), en 1 à 2 fichiers, sans étape manuelle.
- **FR-002**: Le snapshot MUST être livré avec le site comme fichier statique, sans appel à un
  service dynamique pour le lire.
- **FR-003**: Le snapshot MUST porter sa date de génération et sa valeur de contrôle (nombre d'objets
  et de panoplies de la source au moment de la génération).
- **FR-004**: La génération MUST échouer avec un message explicite si la source du jeu est
  injoignable ou si le catalogue obtenu est vide ou sous un seuil de cohérence, et MUST NOT écraser
  ni livrer un snapshot invalide.
- **FR-005**: À l'ouverture du site, le catalogue d'objets et les panoplies MUST être chargés depuis
  le catalogue gardé sur l'appareil s'il est plus récent, sinon depuis le snapshot livré, sans
  requête paginée vers la source du jeu.
- **FR-006**: Le catalogue MUST rester complet dès l'ouverture : les résultats de recherche, filtres
  par catégorie et rattachements aux panoplies MUST être identiques à ceux d'un chargement direct
  depuis la source du jeu.
- **FR-007**: En arrière-plan, le site MUST comparer la valeur de contrôle de la source du jeu à
  celle du catalogue utilisé, via une requête légère unique.
- **FR-008**: Le site MUST retélécharger le catalogue depuis la source du jeu uniquement si la
  valeur de contrôle diffère, puis le garder sur l'appareil et l'utiliser à partir de l'affichage
  suivant, sans faire clignoter la page en cours.
- **FR-009**: Le contrôle MUST être espacé d'un délai minimal entre deux contrôles sur un même
  appareil, pour que les appels à la source du jeu restent rares.
- **FR-010**: Toute erreur du contrôle ou du retéléchargement MUST rester silencieuse pour le joueur
  et MUST NOT remplacer ni corrompre le catalogue déjà disponible.
- **FR-011**: Si le snapshot est absent ou illisible, le site MUST retomber sur le chargement complet
  depuis la source du jeu (comportement actuel), sans erreur bloquante.
- **FR-012**: Le catalogue gardé sur l'appareil MUST rester remplaçable de façon atomique : jamais de
  contenu partiel visible.
- **FR-013**: Le site MUST conserver l'origine et la date du catalogue utilisé (snapshot, rafraîchi
  depuis la source du jeu), afin de rester traçable et de pouvoir signaler un catalogue ancien.

### Key Entities

- **Snapshot du catalogue**: copie compressée des objets et des panoplies à un instant donné, avec
  date de génération et valeur de contrôle ; produite à chaque préparation de version.
- **Valeur de contrôle**: information légère (nombre d'objets et de panoplies) comparée entre la
  source du jeu et le catalogue utilisé pour décider d'un retéléchargement.
- **Catalogue gardé sur l'appareil**: copie du catalogue conservée entre deux visites, avec sa date
  et son origine (snapshot ou rafraîchi).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: À la première visite, le nombre de requêtes de chargement du catalogue passe de 60-120
  à 2 au plus, et le poids transféré du catalogue de 5-8 Mo à environ 1 Mo ou moins.
- **SC-002**: Le temps avant interactivité sur mobile (mesure Lighthouse, même protocole que l'audit
  initial) passe de 20,7 s à moins de 8 s.
- **SC-003**: La recherche porte sur le catalogue complet dès l'affichage de la page, y compris à la
  première visite et avec la source du jeu injoignable (aucune requête paginée observée).
- **SC-004**: Lors d'une ouverture normale du site, la source du jeu reçoit au plus 1 requête légère
  (contrôle), et au plus 1 contrôle par appareil dans le délai minimal défini.
- **SC-005**: Après une mise à jour du catalogue du jeu, 100 % des joueurs qui rouvrent le site
  obtiennent le catalogue à jour à partir de la visite suivant le contrôle, sans message d'erreur ni
  clignotement.
- **SC-006**: Aucune différence de résultat de recherche (même jeu de requêtes de référence) entre le
  catalogue issu du snapshot et celui téléchargé directement depuis la source du jeu.

## Assumptions

- La source du jeu (DofusDB) reste accessible depuis la machine qui prépare les versions ; sinon la
  mise en ligne est bloquée (FR-004), ce qui est préférable à un catalogue vide.
- Le contrôle de fraîcheur se limite à une valeur légère (comptage) : un changement de contenu sans
  changement de comptage attend la prochaine mise en ligne (accepté par le porteur du projet).
- Délai minimal entre deux contrôles : 6 heures par appareil, valeur ajustable.
- Seuil de cohérence à la génération : le catalogue doit contenir au moins la moitié des objets et
  panoplies du snapshot précédent connu, à défaut d'un seuil absolu.
- Hors périmètre : prix, recettes détaillées, effets et autres données non incluses aujourd'hui dans
  les index d'objets et de panoplies (elles gardent leur chargement actuel à la demande).
- S'appuie sur le catalogue gardé sur l'appareil de `specs/021-background-data-loading` et sur le
  dossier de livraison statique du site (Cloudflare) ; coordination avec la session d'audit de
  performance qui diffère le crawl au même endroit du code de chargement du catalogue.
