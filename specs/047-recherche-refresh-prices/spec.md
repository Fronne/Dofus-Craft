# Feature Specification: Actualiser les prix d'une recette sur la page Recherche

**Feature Branch**: `047-recherche-refresh-prices`

**Created**: 2026-10-12

**Status**: Draft

**Input**: User description: "Réécrire dans le dépôt le bouton « Actualiser les prix » de la page Recherche, présent sur le site en ligne et perdu du code source : en Mode communautaire, il demande à l'API de relire sur Huzounet le prix de l'objet affiché et de toutes les ressources de sa recette, puis affiche les prix reçus. Reprendre les libellés et le comportement du site en ligne, y compris la mention « peu de relevés » / « relevé ancien » à côté de la date d'un prix de ressource."

## Contexte

Le site en ligne a, sur la page Recherche, un bouton « Actualiser les prix » au-dessus de la liste
« Prix des ressources ». Son code source a été perdu (voir specs/045) : le dépôt est resté à l'état de la
fonctionnalité 031 pour cette page. Déployer le dépôt tel quel ferait donc disparaître ce bouton.

Cette fonctionnalité le réécrit à l'identique de ce que fait le site en ligne, relevé dans la sauvegarde
`backups/production-2026-10-12/` : mêmes libellés, mêmes messages, même demande à l'API. L'API n'est pas
modifiée : la route `POST /external-prices/refresh` existe déjà (specs/045, specs/046).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Actualiser les prix de la recette affichée (Priority: P1)

En Mode communautaire, le joueur regarde un objet et sa recette. Il clique sur « Actualiser les prix » :
le site demande une relecture du prix de l'objet et de toutes les ressources de sa recette, sous-recettes
comprises, puis affiche les prix reçus sans que le joueur recharge la page.

**Why this priority**: c'est le bouton que le site en ligne offre aujourd'hui ; sans lui, un déploiement
du dépôt retire une fonction aux joueurs.

**Independent Test**: avec une API simulée, afficher un objet à recette en Mode communautaire, cliquer sur
le bouton, vérifier la demande envoyée (serveur, objet, identifiants), le message affiché et les nouveaux
prix dans les lignes.

**Acceptance Scenarios**:

1. **Given** un objet avec une recette en Mode communautaire, **When** la page s'affiche, **Then** le
   bouton « Actualiser les prix » est visible à droite du titre « Prix des ressources ».
2. **Given** ce bouton, **When** le joueur clique, **Then** une seule demande part, pour le serveur actif,
   avec l'objet affiché en premier puis les ressources de toute sa chaîne de fabrication, sans doublon,
   90 identifiants au plus.
3. **Given** une demande en cours, **When** le joueur regarde le bouton, **Then** il lit
   « Actualisation… », l'icône tourne et le bouton est inactif.
4. **Given** une demande réussie où des prix ont été relus, **When** elle se termine, **Then** le joueur
   lit « Prix actualisés. », et le prix HDV de l'objet comme les prix des ressources, lignes repliées
   comprises, sont relus et affichés avec leur nouvelle date.
5. **Given** une demande réussie où rien n'a été relu (tout l'a été il y a moins de deux minutes),
   **When** elle se termine, **Then** le joueur lit « Les prix sont déjà à jour. ».
6. **Given** un prix en cours de saisie dans une ligne, **When** l'actualisation se termine, **Then** la
   valeur tapée n'est pas remplacée.

---

### User Story 2 - Comprendre un refus ou un échec (Priority: P1)

Quand l'actualisation n'a pas pu se faire, le joueur lit pourquoi et les prix affichés restent ceux
d'avant.

**Why this priority**: constitution, « échec sûr » : jamais de prix inventé, jamais d'échec muet.

**Independent Test**: avec une API simulée répondant tour à tour 429, 404, 502 et une panne réseau,
vérifier le message et l'absence de changement des prix.

**Acceptance Scenarios**:

1. **Given** une relecture demandée trop tôt après la précédente, **When** l'API refuse, **Then** le
   joueur lit « Réessaie dans quelques secondes. ».
2. **Given** un serveur dont les prix ne sont pas relus, **When** l'API le dit, **Then** le joueur lit
   « Les prix de ce serveur ne sont pas relus. ».
3. **Given** toute autre réponse, une réponse illisible ou une panne réseau, **When** elle survient,
   **Then** le joueur lit « Actualisation impossible pour le moment. ».
4. **Given** un message affiché, **When** le joueur passe à un autre objet ou un autre serveur, **Then**
   le message disparaît.

---

### User Story 3 - Reconnaître un prix fragile (Priority: P2)

Sur une ligne de ressource dont le prix affiché vient de Huzounet et que sa source dit provisoire ou
ancien, le joueur lit, après « Dernière mise à jour : … », la mention « peu de relevés » ou « relevé
ancien ».

**Why this priority**: principe III — le joueur doit savoir sur quel prix il décide ; c'est aussi ce
qu'affiche le site en ligne.

**Independent Test**: avec une API simulée renvoyant un prix Huzounet provisoire, vérifier la mention ;
puis vérifier son absence pour un prix partagé, pour un prix du carnet d'une autre date, et pendant une
saisie.

**Acceptance Scenarios**:

1. **Given** un prix Huzounet marqué provisoire, affiché sur la ligne, **When** la ligne s'affiche,
   **Then** elle porte « · peu de relevés » après la date.
2. **Given** un prix Huzounet marqué ancien, **When** la ligne s'affiche, **Then** elle porte
   « · relevé ancien ».
3. **Given** un prix du carnet d'une autre date que celui de Huzounet, ou une saisie en cours, **When**
   la ligne s'affiche, **Then** elle ne porte aucune mention.
4. **Given** un prix déjà vu (gardé sur l'appareil), **When** la ligne s'affiche sans réseau, **Then** la
   mention est celle qui accompagnait ce prix.

### Edge Cases

- Mode personnel : le bouton n'existe pas (le carnet personnel n'est jamais rempli par le site).
- Objet sans recette : la section « Prix des ressources » n'existe pas, donc le bouton non plus.
- Chaîne de fabrication de plus de 89 ressources : seuls l'objet et les 89 premières ressources sont
  demandés ; les autres gardent leur prix.
- Identifiant non numérique (données de test, objets hors catalogue) : écarté de la demande.
- Double clic : le bouton est inactif pendant la demande, une seule part.
- Le joueur change d'objet pendant la demande : le message de l'ancien objet n'est pas affiché sur le
  nouveau.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: En Mode communautaire, quand un objet avec recette est affiché et qu'un serveur est choisi,
  la page Recherche MUST montrer un bouton « Actualiser les prix » dans l'en-tête de « Prix des
  ressources ». Il MUST être absent en Mode personnel.
- **FR-002**: Un clic MUST envoyer une seule demande de relecture portant le serveur actif, l'objet
  affiché et la liste des identifiants : l'objet d'abord, puis les ressources de toute la chaîne de
  fabrication, sans doublon, identifiants numériques seulement, 90 au plus.
- **FR-003**: Pendant la demande, le bouton MUST être inactif et afficher « Actualisation… ».
- **FR-004**: Après une réponse réussie, la page MUST relire le prix HDV partagé de l'objet et les prix
  de toutes les ressources de la chaîne (lignes affichées et repliées), et les écrire dans le carnet du
  Mode communautaire selon la règle existante « le plus récent gagne ».
- **FR-005**: Le message MUST être : « Prix actualisés. » si au moins un prix a été relu ; « Les prix
  sont déjà à jour. » si aucun ; « Réessaie dans quelques secondes. » après un refus pour demande trop
  rapprochée ; « Les prix de ce serveur ne sont pas relus. » pour un serveur non relu ; « Actualisation
  impossible pour le moment. » dans tous les autres cas.
- **FR-006**: Le message MUST être annoncé aux lecteurs d'écran (zone de statut) et MUST disparaître au
  changement d'objet ou de serveur.
- **FR-007**: Une actualisation MUST NOT remplacer une valeur en cours de saisie, ni modifier le carnet
  du Mode personnel, ni partager un prix au nom du joueur.
- **FR-008**: Une ligne de ressource MUST porter « peu de relevés » ou « relevé ancien » après sa date
  quand le prix affiché est le dernier prix connu de l'API, qu'il vient de Huzounet et que sa source le
  marque ainsi ; elle MUST NOT la porter pendant une saisie ni quand le carnet garde un prix d'une autre
  date.
- **FR-009**: Le dernier prix gardé sur l'appareil pour l'usage hors connexion MUST conserver son origine
  et sa mention.
- **FR-010**: L'API MUST NOT être modifiée.

### Key Entities

- **Demande d'actualisation** : serveur, objet affiché, identifiants à relire (objet + ressources).
- **Résultat** : réussi avec le nombre de prix relus, trop tôt, serveur non relu, indisponible.
- **Mention de fragilité** : « peu de relevés » (provisoire) ou « relevé ancien », portée par un prix
  Huzounet.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un clic donne un message lisible en moins de 10 secondes dans tous les cas (réussite, refus,
  panne).
- **SC-002**: Après une actualisation réussie, 100 % des prix relus sont visibles sans recharger la page.
- **SC-003**: Un clic produit exactement une demande de relecture.
- **SC-004**: Les libellés du bouton et les cinq messages sont identiques, au caractère près, à ceux du
  site en ligne.
- **SC-005**: Aucun test existant ne régresse ; les règles nouvelles ont leurs tests.

## Assumptions

- Le comportement de référence est celui du site en ligne au 12 octobre 2026 (sauvegarde du dépôt).
- La limite horaire de la fonctionnalité 046 ne concerne que les chargements d'onglets HDV ; une
  actualisation de recette garde les règles d'origine de l'API (2 minutes par objet, 5 secondes entre
  deux lectures d'un serveur).
- Le bouton reste visible sur un serveur non relu, comme en ligne : c'est l'API qui répond que le
  serveur ne l'est pas.
- Aucun déploiement dans cette fonctionnalité.
