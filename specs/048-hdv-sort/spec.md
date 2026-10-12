# Feature Specification: Trier la page HDV et onglets à icônes

**Feature Branch**: `048-hdv-sort`

**Created**: 2026-10-12

**Status**: Draft

**Input**: User description: "Réécrire dans le dépôt l'état de la page HDV du site en ligne, perdu du code source : un menu « Trier » (par nom ou par stat, prix le plus élevé, prix le plus bas, mis à jour récemment, mis à jour il y a longtemps) qui remplace les boutons « Tous / Sans prix / Prix ancien », et des onglets portant chacun une icône. Garder le bouton « Charger depuis Huzounet » et les mentions d'origine de la fonctionnalité 046."

## Contexte

La page HDV du site en ligne diffère de celle du dépôt sur deux points, relevés dans la sauvegarde
`backups/production-2026-10-12/` :

- la barre d'outils porte un menu « Trier » ; les trois boutons « Tous », « Sans prix », « Prix ancien »
  de la fonctionnalité 023 n'y sont plus ;
- chaque onglet (Ressources, Consommables, Créatures, Runes) porte une icône, et sur un écran étroit
  l'icône passe au-dessus du libellé.

Le code source de ces changements a été perdu (voir specs/045). Cette fonctionnalité les réécrit pour
qu'un déploiement du dépôt ne change pas la page que les joueurs connaissent.

**Révision de specs/023** : le récit 4 de la fonctionnalité 023 (« n'afficher que les objets sans prix ou
au prix ancien ») est remplacé par le tri : « Mis à jour il y a longtemps » remonte les prix les plus
anciens, et tout tri par prix ou par date range les objets sans prix à la fin. Le compteur « N objets sur
M ont un prix » est conservé.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Trier la liste d'un onglet (Priority: P1)

Le joueur choisit dans le menu « Trier » l'ordre de la liste : l'ordre habituel (par nom, ou par stat pour
les runes), du prix le plus élevé au plus bas ou l'inverse, ou de la mise à jour la plus récente à la plus
ancienne ou l'inverse.

**Why this priority**: c'est l'écart visible entre le dépôt et le site en ligne ; c'est aussi ce qui
permet de repérer les prix à relever.

**Independent Test**: dans un onglet où trois objets ont des prix et des dates différents, choisir chaque
tri et vérifier l'ordre des lignes.

**Acceptance Scenarios**:

1. **Given** un onglet d'objets, **When** la page s'affiche, **Then** le menu « Trier » montre « Tri par
   nom » ; dans l'onglet Runes, il montre « Tri par stat ».
2. **Given** des objets avec un prix, **When** le joueur choisit « Prix le plus élevé », **Then** ils sont
   rangés du plus cher au moins cher ; « Prix le plus bas » donne l'ordre inverse.
3. **Given** des objets avec un prix, **When** le joueur choisit « Mis à jour récemment », **Then** ils
   sont rangés de la mise à jour la plus récente à la plus ancienne ; « Mis à jour il y a longtemps » donne
   l'ordre inverse.
4. **Given** un tri par prix ou par date, **When** la liste s'affiche, **Then** les objets sans prix
   viennent après tous ceux qui en ont un, dans l'ordre habituel de l'onglet.
5. **Given** deux objets de même prix (ou de même date), **When** un tri s'applique, **Then** ils gardent
   entre eux l'ordre habituel de l'onglet.
6. **Given** un tri choisi, **When** le joueur cherche par nom ou filtre par type ou par stat, **Then** le
   tri s'applique aux objets retenus.
7. **Given** un tri choisi, **When** le joueur change d'onglet, **Then** le tri reste celui choisi.
8. **Given** la barre d'outils, **When** elle s'affiche, **Then** les boutons « Tous », « Sans prix » et
   « Prix ancien » n'y sont plus.

---

### User Story 2 - Reconnaître un onglet à son icône (Priority: P2)

Chaque onglet porte une icône devant son libellé : un colis pour Ressources, une potion pour Consommables,
une patte pour Créatures, une rune pour Runes.

**Why this priority**: confort de lecture, surtout sur téléphone où les quatre onglets tiennent sur une
ligne ; identique au site en ligne.

**Independent Test**: afficher la page et vérifier que chaque onglet contient une icône et son libellé,
et que le nom accessible de l'onglet reste son libellé.

**Acceptance Scenarios**:

1. **Given** la page HDV, **When** elle s'affiche, **Then** chacun des quatre onglets montre son icône et
   son libellé.
2. **Given** un lecteur d'écran, **When** il lit un onglet, **Then** il annonce le libellé seul (l'icône
   est décorative).
3. **Given** un écran étroit, **When** la page s'affiche, **Then** les quatre onglets tiennent sur une
   ligne, l'icône au-dessus du libellé.

### Edge Cases

- Onglet sans aucun prix : tout tri par prix ou par date laisse la liste dans son ordre habituel.
- Prix sans date lisible : compté comme le plus ancien.
- Valeur de tri inconnue : traitée comme l'ordre habituel.
- Chargement depuis Huzounet pendant qu'un tri par prix est actif : la liste se réordonne quand les prix
  arrivent ; une valeur en cours de saisie n'est pas perdue.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La barre d'outils de chaque onglet MUST porter un menu nommé « Trier » avec, dans cet ordre :
  l'ordre habituel (« Tri par nom », ou « Tri par stat » dans l'onglet Runes), « Prix le plus élevé »,
  « Prix le plus bas », « Mis à jour récemment », « Mis à jour il y a longtemps ».
- **FR-002**: L'ordre habituel MUST être celui de l'onglet aujourd'hui (par nom ; par stat pour les runes).
- **FR-003**: Un tri par prix MUST ranger les objets qui ont un prix par prix unitaire, décroissant ou
  croissant ; un tri par date MUST les ranger par date de mise à jour, de la plus récente ou de la plus
  ancienne.
- **FR-004**: Dans tout tri par prix ou par date, les objets sans prix MUST venir après les autres, dans
  l'ordre habituel ; à égalité, deux objets MUST garder l'ordre habituel.
- **FR-005**: Le tri MUST utiliser les prix du mode et du serveur actifs, les mêmes que le compteur.
- **FR-006**: Le tri MUST se combiner avec la recherche et les filtres par type ou par stat, et MUST
  rester celui choisi quand le joueur change d'onglet.
- **FR-007**: Les boutons « Tous », « Sans prix » et « Prix ancien » MUST être retirés ; le compteur
  « N objets sur M ont un prix » MUST rester.
- **FR-008**: Chaque onglet MUST montrer une icône décorative devant son libellé ; le nom accessible de
  l'onglet MUST rester son libellé.
- **FR-009**: Le bouton « Charger depuis Huzounet », sa limite et les mentions d'origine (specs/046)
  MUST rester inchangés.

### Key Entities

- **Tri** : ordre habituel, prix décroissant, prix croissant, mise à jour récente, mise à jour ancienne.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Les cinq choix du menu et leurs libellés sont identiques à ceux du site en ligne.
- **SC-002**: Pour chaque tri, l'ordre affiché est celui que donne le site en ligne avec les mêmes prix.
- **SC-003**: Changer de tri réordonne la liste en moins d'une seconde dans l'onglet Ressources
  (2 537 objets).
- **SC-004**: Aucun test existant ne régresse en dehors de ceux qui portaient sur les boutons retirés,
  remplacés par des tests du tri.

## Assumptions

- Le comportement de référence est celui du site en ligne au 12 octobre 2026.
- Le tri choisi n'est pas mémorisé d'une visite à l'autre (comme en ligne).
- La mention d'origine d'un prix Huzounet sur une ligne de rune, que le site en ligne ne montre pas, est
  gardée : elle a été décidée dans specs/046, après la version en ligne.
- Aucun déploiement dans cette fonctionnalité.
