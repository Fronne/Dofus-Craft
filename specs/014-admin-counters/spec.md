# Feature Specification: Administration des compteurs de joueurs

**Feature Branch**: `014-admin-counters`

**Created**: 2026-09-24

**Status**: Draft

**Input**: User description: "Mode administrateur pour gérer les compteurs humoristiques des joueurs (bulles « donjons sans drop », « tentatives de FM »…) directement depuis le site, sans redéploiement. Seul le propriétaire du site peut y accéder, en se connectant avec son adresse e-mail via Cloudflare Access (code reçu par e-mail, session conservée plusieurs semaines) ; aucun mot de passe à gérer dans l'application. Depuis une page d'administration, il peut modifier le chiffre d'un compteur (dont l'affichage « au moins », ex. 150+), ajouter un compteur (joueur, classe et sexe du personnage pour le portrait officiel, ce qui est compté, objet ou ressource visé choisi dans le catalogue du jeu) et en supprimer un. Les compteurs actuels (Le-Lanceurdeglyphe, Nicomoux) sont repris tels quels. Les changements sont visibles par tous les joueurs à leur prochaine visite. Les joueurs non connectés ne voient aucun élément d'administration. La page d'administration est conçue pour accueillir plus tard d'autres réglages du site."

## Clarifications

### Session 2026-09-24

- Q: Comment reconnaître le propriétaire ? → A: Connexion par adresse e-mail avec un code reçu par
  e-mail, gérée par l'hébergeur du site (Cloudflare Access) ; session conservée plusieurs semaines.
- Q: Que peut-on modifier ? → A: Les compteurs (chiffre, ajout, suppression) ; la page
  d'administration pourra accueillir d'autres réglages plus tard (hypothèse retenue faute de
  précision, à confirmer).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Changer le chiffre d'un compteur (Priority: P1)

Après une soirée de donjons, le propriétaire ouvre la page d'administration depuis son téléphone,
change « 150+ » en « 162 » pour Le-Lanceurdeglyphe, et enregistre. Les autres joueurs voient 162
à leur prochaine visite, sans aucun redéploiement.

**Why this priority**: c'est le besoin qui a motivé la demande : ne plus passer par un
redéploiement pour changer un chiffre.

**Independent Test**: se connecter à la page d'administration, changer un chiffre, enregistrer,
puis ouvrir le site sur un autre appareil : la bulle affiche le nouveau chiffre.

**Acceptance Scenarios**:

1. **Given** le propriétaire connecté sur la page d'administration, **When** il change le chiffre
   d'un compteur et enregistre, **Then** un message confirme l'enregistrement et la liste affiche
   la nouvelle valeur.
2. **Given** un compteur affiché « 150+ », **When** le propriétaire décoche « au moins » et
   enregistre, **Then** les joueurs voient « 150 » sans le « + ».
3. **Given** un chiffre enregistré, **When** un joueur ouvre ou recharge le site, **Then** la bulle
   et son badge affichent la nouvelle valeur.
4. **Given** une valeur invalide (vide, négative, non entière), **When** le propriétaire tente
   d'enregistrer, **Then** l'enregistrement est refusé avec un message, et rien ne change.

---

### User Story 2 - Accès réservé au propriétaire (Priority: P1)

Seul le propriétaire, connecté avec son adresse e-mail, peut ouvrir la page d'administration et
enregistrer des changements. Les joueurs n'en voient aucune trace sur le site.

**Why this priority**: sans cette protection, n'importe qui pourrait changer les compteurs.

**Independent Test**: ouvrir l'adresse de la page d'administration dans une fenêtre privée : la
connexion est demandée ; une autre adresse e-mail que celle du propriétaire est refusée ; une
modification envoyée sans être connecté est refusée.

**Acceptance Scenarios**:

1. **Given** un visiteur non connecté, **When** il ouvre l'adresse de la page d'administration,
   **Then** une connexion par e-mail lui est demandée avant tout affichage.
2. **Given** une adresse e-mail autre que celle du propriétaire, **When** elle tente de se
   connecter, **Then** l'accès est refusé.
3. **Given** le propriétaire connecté une fois, **When** il revient dans les semaines suivantes sur
   le même appareil, **Then** il accède directement à la page sans se reconnecter.
4. **Given** n'importe quel joueur sur le site, **When** il le parcourt, **Then** il ne voit aucun
   lien, bouton ou champ d'administration.
5. **Given** une modification envoyée sans connexion valide, par quelque moyen que ce soit,
   **When** elle arrive au service, **Then** elle est refusée et rien ne change.

---

### User Story 3 - Ajouter un compteur (Priority: P2)

Le propriétaire veut un nouveau compteur pour un autre joueur : il saisit le pseudo, choisit la
classe et le sexe du personnage (le portrait officiel s'affiche), décrit ce qui est compté (au
singulier et au pluriel, par exemple « tentative de FM » / « tentatives de FM »), cherche l'objet
ou la ressource visé dans le catalogue du jeu, fixe le chiffre de départ et enregistre. Une nouvelle
bulle apparaît pour tous les joueurs.

**Why this priority**: utile, mais plus rare que la mise à jour d'un chiffre.

**Independent Test**: créer un compteur complet, puis vérifier sur le site qu'une nouvelle bulle
affiche le bon portrait, pseudo, chiffre, libellé et objet.

**Acceptance Scenarios**:

1. **Given** le formulaire d'ajout, **When** le propriétaire choisit une classe et un sexe,
   **Then** l'aperçu du portrait officiel correspondant s'affiche.
2. **Given** le champ de recherche de l'objet visé, **When** il tape une partie du nom, **Then** des
   objets et ressources du jeu correspondants sont proposés, avec leur icône.
3. **Given** tous les champs remplis, **When** il enregistre, **Then** le compteur apparaît dans la
   liste et, sur le site, une nouvelle bulle s'empile au-dessus des autres.
4. **Given** un champ obligatoire manquant (pseudo, classe, libellés, objet visé ou chiffre),
   **When** il enregistre, **Then** l'enregistrement est refusé avec l'indication du champ manquant.

---

### User Story 4 - Supprimer un compteur (Priority: P3)

Un défi est terminé : le propriétaire supprime le compteur correspondant, après confirmation. La
bulle disparaît pour tous les joueurs.

**Why this priority**: occasionnel.

**Independent Test**: supprimer un compteur, confirmer, vérifier qu'il disparaît de la liste et du
site ; annuler une suppression, vérifier que rien ne change.

**Acceptance Scenarios**:

1. **Given** un compteur dans la liste, **When** le propriétaire demande sa suppression, **Then**
   une confirmation nommant le joueur et le compteur est demandée.
2. **Given** la confirmation acceptée, **Then** le compteur disparaît de la liste et du site.
3. **Given** la confirmation refusée, **Then** rien ne change.

---

### Edge Cases

- Service des compteurs injoignable côté joueurs : le site affiche les derniers compteurs connus
  sur l'appareil ; s'il n'en connaît aucun, il n'affiche aucune bulle (jamais de compteur inventé).
- Service injoignable côté administration : l'enregistrement échoue avec un message, les valeurs
  saisies restent dans le formulaire.
- Aucun compteur : aucune bulle sur le site ; la page d'administration invite à en créer un.
- Catalogue du jeu injoignable pendant la recherche d'objet : un message l'indique ; l'ajout reste
  impossible tant qu'aucun objet n'est choisi.
- Deux onglets d'administration ouverts : le dernier enregistrement l'emporte ; la liste se
  recharge après chaque enregistrement.
- Session de connexion expirée : la connexion par e-mail est redemandée ; rien n'est perdu côté
  serveur.
- Beaucoup de compteurs : la pile de bulles ne doit ni sortir de l'écran ni recouvrir la barre
  d'onglets (au-delà de 4 compteurs, la limite est à revoir).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Les compteurs MUST être stockés côté serveur et partagés : tous les joueurs voient les
  mêmes compteurs, et un changement est visible à leur prochaine visite, sans redéploiement.
- **FR-002**: Les deux compteurs actuels (Le-Lanceurdeglyphe : Féca homme, 150+ donjons sans drop,
  Parangon de puissance ; Nicomoux : Pandawa homme, 157 tentatives de FM, Amulette du Strigide)
  MUST être repris à l'identique.
- **FR-003**: Le site MUST afficher les bulles à partir des compteurs stockés, avec le même rendu
  qu'aujourd'hui (specs/013), dans l'ordre de création.
- **FR-004**: Le site MUST garder sur l'appareil les derniers compteurs reçus et les afficher si le
  service est injoignable ; sans compteurs connus, aucune bulle.
- **FR-005**: Une page d'administration MUST être accessible à sa propre adresse, et seulement après
  une connexion par adresse e-mail et code reçu par e-mail ; seule l'adresse du propriétaire MUST
  être acceptée.
- **FR-006**: La session de connexion MUST durer plusieurs semaines sur un même appareil.
- **FR-007**: Toute modification des compteurs MUST être vérifiée par le service : sans connexion
  valide du propriétaire, elle est refusée.
- **FR-008**: Le site public MUST n'afficher aucun lien, bouton ni champ d'administration.
- **FR-009**: La page d'administration MUST lister les compteurs (portrait, pseudo, classe, chiffre,
  libellé, objet visé) et permettre de modifier le chiffre et l'option « au moins » de chacun.
- **FR-010**: La page d'administration MUST permettre d'ajouter un compteur avec : pseudo, classe et
  sexe du personnage (portrait officiel du jeu, avec aperçu), libellé de ce qui est compté au
  singulier et au pluriel, objet ou ressource visé choisi par recherche dans le catalogue du jeu
  (nom et icône officiels), chiffre de départ et option « au moins ».
- **FR-011**: La page d'administration MUST permettre de supprimer un compteur après une
  confirmation qui nomme le joueur et le compteur.
- **FR-012**: Les chiffres MUST être des entiers positifs ou nuls ; tout champ obligatoire manquant
  ou invalide MUST être refusé avec un message qui l'indique.
- **FR-013**: Chaque enregistrement MUST être confirmé par un message, et chaque échec signalé sans
  perdre les valeurs saisies.
- **FR-014**: La page d'administration MUST être utilisable sur téléphone et sur ordinateur.
- **FR-015**: La page d'administration MUST être organisée en sections pour pouvoir accueillir
  d'autres réglages plus tard ; seule la section « Compteurs » est livrée.
- **FR-016**: Aucune donnée sur les joueurs qui consultent les compteurs MUST être collectée ; seule
  l'adresse du propriétaire est connue du système de connexion.

### Key Entities

- **Compteur** : pseudo du joueur, classe et sexe du personnage, chiffre (entier ≥ 0), option « au
  moins », libellé singulier et pluriel de ce qui est compté, objet visé (identifiant, nom, icône),
  ordre d'affichage (ordre de création).
- **Propriétaire** : la seule adresse e-mail autorisée à se connecter à l'administration.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Changer le chiffre d'un compteur prend moins de 30 secondes depuis un téléphone déjà
  connecté.
- **SC-002**: Un changement est visible par un autre joueur dès qu'il recharge le site, sans aucun
  redéploiement.
- **SC-003**: Aucune tentative de modification sans la connexion du propriétaire ne change un
  compteur.
- **SC-004**: Ajouter un compteur complet prend moins de 2 minutes.
- **SC-005**: Les deux compteurs actuels s'affichent à l'identique après la mise en place.

## Assumptions

- Le propriétaire configure une fois, avec accompagnement, la connexion par e-mail dans son compte
  d'hébergement (Cloudflare Access), avec son adresse e-mail comme seule adresse autorisée.
- La page d'administration est ouverte en la gardant en favori ; le site n'y fait aucun lien.
- Les portraits de classe proviennent des fichiers du jeu (comme en specs/013), pour toutes les
  classes et les deux sexes ; les objets visés viennent du catalogue du jeu déjà utilisé par le
  site.
- L'ordre des compteurs est l'ordre de création ; le réordonnancement est hors périmètre.
- Aucun historique des changements n'est conservé.
- Au-delà de 4 compteurs, l'empilement des bulles pourra nécessiter une autre présentation (hors
  périmètre).
