# Feature Specification: Bulle « donjons sans drop » de Le-Lanceurdeglyphe

**Feature Branch**: `013-dungeon-drop-counter`

**Created**: 2026-09-24

**Status**: Draft

**Input**: User description: "Ajouter une bulle flottante humoristique « compteur de donjons sans drop » : un petit portrait rond d'un Féca (illustration officielle extraite du client Dofus installé) dans un coin de l'écran, qui s'ouvre au clic pour afficher le pseudo « Le-Lanceurdeglyphe », le nombre de donjons faits sans obtenir la ressource « Parangon de puissance » (nom et icône officiels récupérés via DofusDB, id 21189), et la ressource concernée. Le compteur est partagé : tous les joueurs voient le même chiffre, mais seul le propriétaire de l'application peut le modifier (+1, correction, remise à zéro quand la ressource tombe enfin), après s'être identifié avec un code sur son appareil. [Révisé : chiffre en dur dans le code, voir Clarifications.] Visible sur toutes les pages, dans les deux designs (Classique et Nouveau), sur ordinateur et mobile, sans gêner l'utilisation de l'application."

## Clarifications

### Session 2026-09-24

- Q: Qui peut faire avancer le compteur ? → A: Seulement le propriétaire de l'application ; tout le monde le voit.
- Q: Où l'afficher ? → A: Une bulle flottante avec le portrait du Féca, qui s'ouvre au clic.
- Q: Quelle image de Féca ? → A: L'illustration officielle, extraite du client Dofus installé.
- Q: Quelle ressource ? → A: « Parangon de puissance », avec son nom et son icône officiels (DofusDB).
- Q: Féca homme ou femme ? → A: Féca homme.
- Q: Faut-il un code pour modifier le compteur ? → A: Non. **Révision** : le chiffre est écrit en dur
  dans le code de l'application ; pas de base de données, pas de code, pas de bouton de
  modification. Pour le changer, le propriétaire demande la modification du chiffre et un
  redéploiement. Remplace la User Story 2 et les exigences FR-005 à FR-011 d'origine.

### Session 2026-09-24 (révision 2 : deuxième compteur)

- Q: Ajouter un autre compteur ? → A: Oui : « 150 tentatives de FM sur l'Amulette du Strigide » pour
  Nicomoux, Sadida homme, sur le même modèle (chiffre en dur dans le code).
- Q: Placement des deux portraits ? → A: L'un au-dessus de l'autre, en bas à droite.
- Q: Classe de Nicomoux ? → A: Pandawa (homme), à la place du Sadida initialement demandé.
- Q: Affichage du compteur du Féca ? → A: « 150+ » (au moins 150), dans la bulle et le badge.

Les exigences ci-dessous s'appliquent à chaque compteur. Compteurs actuels :

| Joueur | Classe (portrait) | Chiffre | Libellé | Objet visé (DofusDB) |
|--------|-------------------|---------|---------|----------------------|
| Le-Lanceurdeglyphe | Féca homme (`Head_10`) | 150+ | donjons sans drop | Parangon de puissance (21189) |
| Nicomoux | Pandawa homme (`Head_120`) | 157 | tentatives de FM | Amulette du Strigide (14094) |

- **FR-015**: Chaque compteur MUST avoir son propre portrait, son propre libellé (« Compteur de
  donjons de Le-Lanceurdeglyphe », « Compteur de tentatives de FM de Nicomoux ») et sa propre bulle ;
  une seule bulle est ouverte à la fois.
- **FR-016**: Les portraits MUST être empilés verticalement en bas à droite, au-dessus de la barre
  d'onglets sur mobile.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Voir le compteur (Priority: P1)

Un joueur du groupe voit, dans un coin de l'écran, le petit portrait rond d'un Féca. En cliquant
dessus, une bulle s'ouvre : « Le-Lanceurdeglyphe », le nombre de donjons faits sans obtenir le
« Parangon de puissance », et l'icône de cette ressource. Il referme la bulle et continue à
utiliser l'application.

**Why this priority**: c'est ce que tout le groupe verra ; sans affichage, le compteur n'existe pas.

**Independent Test**: ouvrir l'application sur n'importe quelle page, cliquer sur le portrait,
vérifier le pseudo, le compteur, le nom et l'icône de la ressource, puis refermer.

**Acceptance Scenarios**:

1. **Given** un joueur sur n'importe quelle page de l'application, **When** il regarde l'écran,
   **Then** le portrait du Féca est visible dans un coin, sans cacher de contenu ni de bouton.
2. **Given** la bulle fermée, **When** le joueur clique sur le portrait, **Then** la bulle s'ouvre
   et affiche « Le-Lanceurdeglyphe », le nombre actuel de donjons sans drop, le nom « Parangon de
   puissance » et son icône.
3. **Given** la bulle ouverte, **When** le joueur clique sur le bouton de fermeture, appuie sur
   Échap ou clique ailleurs, **Then** la bulle se referme et seul le portrait reste visible.
4. **Given** deux joueurs sur deux appareils différents, **When** ils ouvrent la bulle, **Then** ils
   voient le même nombre.

---

### User Story 2 - Changer le chiffre (Priority: P2)

Quand Le-Lanceurdeglyphe refait un donjon (ou quand la ressource tombe enfin), le propriétaire de
l'application change le chiffre écrit dans le code et redéploie. Tous les joueurs voient le nouveau
chiffre à leur prochaine visite.

**Why this priority**: indispensable pour que le compteur vive, mais rare et fait hors de
l'application.

**Independent Test**: changer le chiffre dans le code, redéployer, recharger l'application : la
bulle et le badge affichent le nouveau chiffre.

**Acceptance Scenarios**:

1. **Given** le chiffre changé dans le code et l'application redéployée, **When** un joueur recharge
   l'application, **Then** la bulle affiche le nouveau chiffre.
2. **Given** n'importe quel joueur, **When** il ouvre la bulle, **Then** aucune commande ni aucun
   champ ne permet de modifier le chiffre.

---

### Edge Cases

- Pas de réseau : le chiffre fait partie de l'application, il s'affiche quand même.
- Petits écrans : le portrait se place au-dessus de la barre d'onglets du bas sans la chevaucher,
  et la bulle ouverte tient dans la largeur de l'écran.
- Visite guidée de la page Recherche ou dialogue de confirmation ouverts : ils passent au-dessus du
  portrait et de la bulle.
- Écran de choix du serveur : le portrait n'y apparaît pas (l'application n'est pas encore
  accessible).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: L'application MUST afficher, sur toutes ses pages une fois le serveur choisi, un
  portrait rond d'un Féca (illustration officielle du jeu), petit et fixe dans un coin de l'écran.
- **FR-002**: Le portrait MUST être accessible au clavier et annoncé comme « Compteur de donjons de
  Le-Lanceurdeglyphe ».
- **FR-003**: Un clic sur le portrait MUST ouvrir une bulle affichant : le pseudo
  « Le-Lanceurdeglyphe », le nombre de donjons faits sans obtenir la ressource, une phrase
  indiquant de quoi il s'agit (par exemple « donjons sans drop »), le nom « Parangon de puissance »
  et son icône officielle.
- **FR-004**: La bulle MUST se refermer par un bouton de fermeture, la touche Échap ou un clic en
  dehors ; elle est fermée à chaque arrivée sur l'application.
- **FR-005**: Le chiffre MUST être défini dans le code de l'application, identique pour tous les
  joueurs d'une même version déployée ; il MUST aussi apparaître en petit badge sur le portrait.
- **FR-006**: L'application MUST n'offrir aucun moyen de modifier le chiffre (ni bouton, ni champ,
  ni code) ; le changer passe par une modification du code et un redéploiement.
- **FR-012**: Le portrait et la bulle MUST ne jamais recouvrir la barre d'onglets mobile, et MUST
  passer sous la visite guidée et les dialogues de confirmation.
- **FR-013**: Le portrait et la bulle MUST fonctionner dans les designs « Classique » et « Nouveau »,
  en thème clair et sombre, sur ordinateur et mobile, sans défilement horizontal.
- **FR-014**: Aucune donnée MUST être stockée ni envoyée pour ce compteur.

### Key Entities

- **Compteur de donjons sans drop** : un nombre entier positif ou nul, écrit dans le code de
  l'application.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: N'importe quel joueur voit le compteur en un clic depuis n'importe quelle page.
- **SC-002**: Un changement de chiffre est visible par tous les joueurs après un seul redéploiement.
- **SC-003**: Aucun joueur ne peut modifier le chiffre depuis l'application.
- **SC-005**: Sur un écran de téléphone, le portrait ne cache aucun bouton ni onglet de
  l'application.

## Assumptions

- Le joueur Le-Lanceurdeglyphe est d'accord pour que son pseudo apparaisse dans l'application du
  groupe ; le ton est humoristique.
- Un seul compteur, sans historique ; il change rarement, à la demande du propriétaire.
- La ressource est « Parangon de puissance » (DofusDB, id 21189), retenue par le propriétaire même si
  DofusDB la classe en objet de quête ; le compteur n'est relié à aucun calcul de prix.
- Le portrait apparaît en bas à droite sur ordinateur, et au-dessus de la barre d'onglets sur
  mobile.
