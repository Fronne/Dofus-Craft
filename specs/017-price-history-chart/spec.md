# Feature Specification: Graphe d'historique des prix HDV

**Feature Branch**: `017-price-history-chart`

**Created**: 2026-09-25

**Status**: Draft

**Input**: User description: "Graphe d'historique des prix HDV en Mode communautaire, affiché dans un
popover ouvert depuis la ligne d'une ressource ou d'un objet. Périmètre : ressources ET objets (pour
les objets, cela implique de réviser la règle de rétention de la spec 016 qui ne garde aujourd'hui
que la dernière contribution par objet et serveur). Le joueur peut choisir le regroupement : par
jour, par semaine ou par mois ; chaque point est une valeur agrégée (médiane de la période, après
filtrage des valeurs aberrantes comme la médiane actuelle) accompagnée du nombre de prix qui la
composent. Jamais de contribution individuelle exposée (anonymat, petit groupe de 10-20 joueurs).
Données limitées au serveur sélectionné. Quand l'historique est trop maigre, afficher un état « pas
assez d'historique » plutôt qu'une courbe trompeuse. Mode personnel hors périmètre (le carnet local
ne garde pas d'historique)."

## Clarifications

### Session 2026-09-25

- Q: Quelle profondeur d'historique ? → A: Garder la fenêtre actuelle de 90 jours, sans allonger la
  conservation.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Voir l'évolution du prix d'une ressource (Priority: P1)

En Mode communautaire, sur la fiche d'un objet, le joueur clique sur un bouton « historique » placé
sur la ligne d'une ressource de la recette. Un popover s'ouvre à côté de la ligne et montre une
courbe de l'évolution du prix HDV de cette ressource sur le serveur actif. Chaque point est le prix
médian d'une période ; au survol (ou au toucher), le joueur voit la période, le prix médian et le
nombre de prix partagés qui le composent. Il ferme le popover en cliquant à l'extérieur, avec la
touche Échap ou avec un bouton de fermeture.

**Why this priority**: C'est la valeur même de la fonctionnalité : savoir si une ressource est en
hausse ou en baisse aide à choisir quand l'acheter ou quand crafter.

**Independent Test**: Avec des prix partagés pour une ressource sur plusieurs semaines, ouvrir le
popover de cette ressource : la courbe affiche un point par semaine contenant des prix, avec la
médiane et le nombre de prix de chaque semaine.

**Acceptance Scenarios**:

1. **Given** des prix partagés pour une ressource sur au moins deux périodes, **When** le joueur
   clique sur le bouton historique de sa ligne, **Then** un popover s'ouvre avec une courbe d'un
   point par période contenant des prix.
2. **Given** le popover ouvert, **When** le joueur survole ou touche un point, **Then** il voit la
   période (par exemple « semaine du 14 sept. »), le prix médian en kamas et le nombre de prix
   (« 4 prix »).
3. **Given** des prix partagés sur un autre serveur uniquement, **When** le joueur ouvre le popover
   sur son serveur, **Then** ces prix ne comptent pas.
4. **Given** le popover ouvert, **When** le joueur clique à l'extérieur, appuie sur Échap ou sur le
   bouton de fermeture, **Then** le popover se ferme.

---

### User Story 2 - Choisir le regroupement : jour, semaine ou mois (Priority: P1)

Dans le popover, le joueur choisit comment regrouper les prix : par jour, par semaine ou par mois.
La courbe se redessine avec un point par période du regroupement choisi. Le choix est retenu sur
l'appareil pour les prochains popovers.

**Why this priority**: Avec peu de joueurs, les données sont clairsemées : le bon regroupement dépend
de la ressource (un regroupement au jour pour une ressource très échangée, au mois pour une ressource
rare).

**Independent Test**: Ouvrir un popover, passer de « Semaine » à « Jour » puis à « Mois » : le nombre
de points change en conséquence ; fermer puis rouvrir un autre popover : le dernier choix est
conservé.

**Acceptance Scenarios**:

1. **Given** le popover ouvert en regroupement « Semaine », **When** le joueur choisit « Jour »,
   **Then** la courbe affiche un point par jour contenant des prix.
2. **Given** le joueur a choisi « Mois », **When** il ouvre plus tard le popover d'une autre
   ressource ou d'un objet, **Then** le regroupement « Mois » est déjà sélectionné.
3. **Given** un premier usage sur l'appareil, **When** le joueur ouvre un popover, **Then** le
   regroupement « Semaine » est sélectionné par défaut.

---

### User Story 3 - Voir l'évolution du prix HDV d'un objet (Priority: P2)

En Mode communautaire, sur la fiche d'un objet, le joueur ouvre le même popover depuis le champ
« Prix HDV » de l'objet. Il voit l'évolution des prix HDV partagés pour cet objet sur le serveur
actif, avec les mêmes regroupements et le même détail par point.

**Why this priority**: Complète la comparaison craft / HDV : savoir si le prix de vente d'un objet
monte ou baisse aide à décider de crafter maintenant ou plus tard. Passe après les ressources car les
prix d'objets sont moins nombreux.

**Independent Test**: Avec plusieurs prix HDV partagés pour un objet sur plusieurs semaines, ouvrir
le popover depuis le champ « Prix HDV » : la courbe affiche la médiane de chaque semaine.

**Acceptance Scenarios**:

1. **Given** des prix HDV partagés pour un objet sur au moins deux périodes, **When** le joueur
   ouvre le popover depuis le champ « Prix HDV », **Then** il voit une courbe d'un point par période,
   chaque point étant la médiane des prix de la période.
2. **Given** le champ « Prix HDV » qui affiche le prix le plus récent (specs/016), **When** le joueur
   ouvre l'historique, **Then** ce prix affiché dans le champ reste inchangé : l'historique est une
   information en plus, il ne remplace pas le prix utilisé par la comparaison.

---

### User Story 4 - Historique trop maigre (Priority: P2)

Quand il n'y a pas assez de prix pour tracer une courbe utile, le popover le dit clairement au lieu
d'afficher une courbe trompeuse.

**Why this priority**: Dans un petit groupe, c'est la situation la plus fréquente ; une courbe à un
seul point, ou vide, laisserait croire à une tendance qui n'existe pas (constitution, principe I).

**Independent Test**: Ouvrir le popover d'une ressource sans aucun prix partagé, puis d'une ressource
avec des prix sur une seule période : les deux affichent l'état « pas assez d'historique ».

**Acceptance Scenarios**:

1. **Given** aucun prix partagé pour la ressource sur ce serveur, **When** le joueur ouvre le
   popover, **Then** il voit « Pas encore d'historique pour ce serveur », sans courbe.
2. **Given** des prix sur une seule période pour le regroupement choisi, **When** le joueur ouvre le
   popover, **Then** il voit « Pas assez d'historique », avec le prix médian et le nombre de prix de
   cette période, et une invitation à essayer un regroupement plus fin si celui-ci compte au moins
   deux périodes avec des prix.
3. **Given** des prix sur une seule période au mois mais plusieurs au jour, **When** le joueur passe
   au regroupement « Jour », **Then** la courbe s'affiche.

---

### Edge Cases

- **Mode personnel** : le bouton historique n'apparaît pas ; le carnet local ne garde qu'un prix par
  ressource et ne produit aucun historique.
- **Service communautaire injoignable** : le popover affiche « Historique indisponible pour le
  moment », sans courbe ni valeur inventée ; le reste de la fiche fonctionne normalement.
- **Périodes sans prix entre deux périodes qui en ont** : aucun point n'est placé pour ces périodes ;
  la courbe relie les points existants en montrant l'écart de temps réel sur l'axe (jamais un point
  à zéro).
- **Point composé d'un seul prix** : il est affiché, avec la mention « 1 prix », pour que le joueur
  sache que ce point est peu fiable.
- **Valeurs aberrantes** : elles sont écartées avant le calcul des médianes, comme pour le prix
  communautaire actuel (specs/004 FR-012) ; le nombre de prix d'un point ne compte que les prix
  retenus.
- **Période en cours** (jour, semaine ou mois pas encore terminé) : elle est affichée comme les
  autres, son nombre de prix indiquant qu'elle peut encore évoluer.
- **Changement de serveur popover ouvert** : le popover se ferme ; il n'affiche jamais un mélange de
  deux serveurs.
- **Défilement de la page popover ouvert** : le popover suit l'élément d'où il a été ouvert au lieu
  de se fermer ; sur un écran étroit, il s'affiche en panneau fixe en bas de l'écran.
- **Changement de mode vers le Mode personnel popover ouvert** : le popover se ferme.
- **Écran étroit (téléphone)** : le popover reste lisible dans la largeur de l'écran, sans défilement
  horizontal de la page.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: En Mode communautaire, le système MUST proposer un bouton d'historique sur chaque ligne
  de ressource de la fiche d'un objet et sur le champ « Prix HDV » de l'objet ; en Mode personnel, ce
  bouton MUST NOT apparaître.
- **FR-002**: Ce bouton MUST ouvrir un popover ancré à l'élément d'où il est ouvert, qui se ferme par
  un clic à l'extérieur, la touche Échap ou un bouton de fermeture ; un seul popover d'historique est
  ouvert à la fois.
- **FR-003**: Le popover MUST afficher une courbe dont chaque point correspond à une période
  contenant au moins un prix partagé pour cette ressource ou cet objet, sur le serveur actif
  uniquement.
- **FR-004**: La valeur d'un point MUST être la médiane des prix partagés de la période, avec la même
  formule que le prix communautaire actuel des ressources (specs/004 FR-003), après avoir écarté les
  valeurs aberrantes selon la même règle (specs/004 FR-012). Contrairement au prix actuel
  (specs/004 FR-023), **tous les prix partagés comptent**, y compris plusieurs prix d'un même
  appareil dans une période (révision du 2026-09-26, à la demande du porteur du projet). Cela vaut aussi pour les objets, même si le champ « Prix HDV » affiche le prix le plus
  récent et non une médiane (specs/016 FR-001).
- **FR-005**: Chaque point MUST indiquer, au survol ou au toucher, la période, le prix médian en
  kamas et le nombre de prix retenus qui le composent. Ce nombre compte tous les prix partagés de la
  période après le filtre des valeurs aberrantes (mention retirée du popover le 2026-09-26).
- **FR-006**: Le système MUST NOT exposer de prix individuel ni aucune information permettant de
  relier un prix à un appareil ou à un joueur ; seules les valeurs agrégées par période (médiane et
  nombre de prix) sortent du service communautaire.
- **FR-007**: Le joueur MUST pouvoir choisir le regroupement parmi « Jour », « Semaine » et « Mois » ;
  « Semaine » est le choix par défaut, et le dernier choix MUST être retenu sur l'appareil.
- **FR-008**: Les périodes MUST suivre le calendrier de l'heure de Paris : jours de minuit à minuit,
  semaines du lundi au dimanche, mois civils.
- **FR-009**: Lorsque moins de deux périodes contiennent des prix pour le regroupement choisi, le
  système MUST NOT tracer de courbe et MUST afficher un état explicite : « Pas encore d'historique
  pour ce serveur » s'il n'y a aucun prix, ou « Pas assez d'historique » avec la médiane et le nombre
  de prix de l'unique période s'il y en a une.
- **FR-010**: Les périodes sans prix MUST NOT être représentées par une valeur (ni zéro, ni
  interpolation affichée comme un point) ; l'axe du temps MUST refléter l'écart réel entre les
  périodes.
- **FR-011**: Les prix HDV des objets MUST être conservés aussi longtemps que ceux des ressources
  (c'est déjà le cas pour 90 jours : la suppression hebdomadaire ne retire que les contributions plus
  anciennes, en épargnant la plus récente de chaque objet, specs/016) ; la contribution la plus
  récente de chaque objet reste épargnée. Aucune règle de rétention n'est modifiée.
- **FR-012**: L'historique affiché MUST couvrir les 90 derniers jours glissants, soit la fenêtre de
  conservation actuelle des contributions (specs/004 FR-013), sans l'allonger : au regroupement
  « Mois », l'historique compte donc au plus 4 points.
- **FR-013**: Si le service communautaire est injoignable, le popover MUST afficher « Historique
  indisponible pour le moment » sans courbe ni valeur, et le reste de la fiche MUST continuer de
  fonctionner.
- **FR-014**: Le prix utilisé par la comparaison craft / HDV MUST rester celui défini par les specs
  existantes (médiane pour les ressources, prix le plus récent pour les objets) : l'historique ne
  change aucun calcul.
- **FR-015**: Le popover MUST rester lisible sur un écran de téléphone, sans défilement horizontal de
  la page.

### Key Entities *(include if feature involves data)*

- **Contribution de prix (existante)** : un prix partagé pour une ressource ou un objet sur un
  serveur, avec sa date et un identifiant anonyme d'appareil (specs/004, specs/016). Jamais exposée
  individuellement.
- **Point d'historique** : pour une ressource ou un objet, un serveur, un regroupement et une période
  donnés, la médiane des prix retenus de la période et leur nombre. Calculé à la demande, jamais
  saisi.
- **Préférence de regroupement** : le dernier regroupement choisi (jour, semaine ou mois), propre à
  l'appareil.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Depuis la fiche d'un objet, le joueur voit l'évolution du prix d'une ressource ou de
  l'objet en un seul clic.
- **SC-002**: Pour un jeu de prix connu, la médiane et le nombre de prix de chaque point sont égaux
  dans 100 % des cas aux valeurs calculées à la main pour la période.
- **SC-003**: Aucun prix individuel n'est lisible depuis l'application ou le service communautaire :
  toutes les valeurs d'historique renvoyées sont des agrégats par période.
- **SC-004**: Une ressource ou un objet ayant des prix sur moins de deux périodes n'affiche jamais de
  courbe, dans 100 % des cas.
- **SC-005**: Le popover s'affiche avec ses données en moins de 2 secondes dans des conditions
  réseau normales.
- **SC-006**: Aucun historique n'apparaît en Mode personnel.

## Assumptions

- Le public est un petit groupe fermé (une dizaine à une vingtaine de joueurs) : les données sont
  clairsemées, d'où le choix du regroupement, l'affichage du nombre de prix par point et l'état
  « pas assez d'historique ».
- Un point composé d'un seul prix révèle la valeur de ce prix, mais sans date précise ni lien avec
  un appareil ; c'est accepté, comme l'est déjà la médiane calculée sur un seul prix (specs/004) et
  le prix HDV le plus récent d'un objet (specs/016).
- Le seuil de deux périodes (FR-009) suffit pour une tendance minimale ; il pourra être relevé plus
  tard sans changer le reste de la fonctionnalité.
- Le filtrage des valeurs aberrantes s'applique, pour chaque regroupement, à tous les prix gardés sur
  la fenêtre de 90 jours (ressource ou objet, serveur), puis la médiane est calculée période par
  période : un filtre période par période n'aurait presque jamais assez de valeurs pour agir. Comme
  un appareil compte une fois par période, les prix gardés — donc les bornes du filtre — peuvent
  légèrement différer d'un regroupement à l'autre ; c'est accepté.
- La période en cours (jour, semaine ou mois pas terminé) est calculée comme les autres.
- La contribution la plus récente d'un objet, conservée au-delà de 90 jours pour le champ « Prix
  HDV » (specs/016), n'entre pas dans l'historique si elle a plus de 90 jours.
- La page Suivis n'a pas de bouton historique dans cette version.
- Le Mode personnel est hors périmètre.
