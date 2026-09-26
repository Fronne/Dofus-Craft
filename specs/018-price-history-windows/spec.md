# Feature Specification: Historique des prix par fenêtre de temps

**Feature Branch**: `018-price-history-windows`

**Created**: 2026-09-26

**Status**: Draft

**Input**: User description: « Le graphe en mode Jour affiche plus que les prix d'une seule journée et
n'affiche rien sur la semaine ou le mois. » Choix retenu : Jour = les dernières 24 h, Semaine = les
7 derniers jours, Mois = les 30 derniers jours, et chaque prix partagé est un point de la courbe.

Cette fonctionnalité **révise la spec 017** (historique des prix HDV) : les boutons « Jour »,
« Semaine » et « Mois » ne choisissent plus un regroupement (un point médian par jour, semaine ou
mois sur 90 jours) mais une **fenêtre de temps**, et la courbe montre chaque prix partagé au lieu de
médianes par période. Tout ce que la spec 017 ne mentionne pas ci-dessous reste inchangé (bouton en
Mode communautaire seulement, popover, serveur actif, états vide et indisponible, lisibilité mobile,
aucun effet sur la comparaison craft / HDV).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Voir les prix de la période choisie (Priority: P1)

En Mode communautaire, le joueur ouvre l'historique d'une ressource ou d'un objet. Il choisit
« Jour », « Semaine » ou « Mois » et voit, sur une courbe, chaque prix partagé pendant les dernières
24 heures, les 7 derniers jours ou les 30 derniers jours, placé à son heure réelle.

**Why this priority**: c'est ce que le joueur attend en lisant « Jour / Semaine / Mois » ; le
comportement actuel (regroupement) laisse Semaine et Mois vides tant que les prix tiennent dans une
seule semaine.

**Independent Test**: avec des prix partagés il y a 2 heures, 3 jours et 20 jours, vérifier que
« Jour » montre 1 point, « Semaine » 2 points et « Mois » 3 points.

**Acceptance Scenarios**:

1. **Given** des prix partagés il y a 2 h, 3 jours et 20 jours, **When** le joueur choisit « Jour »,
   **Then** la courbe ne contient que le prix d'il y a 2 h.
2. **Given** les mêmes prix, **When** il choisit « Semaine », **Then** la courbe contient les prix
   d'il y a 2 h et 3 jours ; **When** il choisit « Mois », **Then** elle contient les trois.
3. **Given** trois prix partagés le même jour par le même appareil, **When** il choisit « Jour »,
   **Then** la courbe contient trois points.
4. **Given** un point de la courbe, **When** le joueur le survole ou le touche, **Then** il voit la
   date, l'heure et le prix en kamas de ce prix partagé.

---

### User Story 2 - Période sans assez de prix (Priority: P2)

Le joueur choisit une fenêtre qui contient zéro ou un seul prix.

**Why this priority**: les données sont clairsemées (petit groupe de joueurs) ; ce cas est fréquent
et ne doit pas afficher une courbe trompeuse.

**Independent Test**: avec un seul prix dans les 30 derniers jours, vérifier les trois fenêtres.

**Acceptance Scenarios**:

1. **Given** aucun prix dans la fenêtre choisie, **When** le popover s'affiche, **Then** il indique
   « Aucun prix partagé sur cette période » et, si une fenêtre plus longue contient des prix, invite
   à la choisir.
2. **Given** un seul prix dans la fenêtre, **When** le popover s'affiche, **Then** il montre ce prix
   avec sa date et son heure, sans courbe.
3. **Given** aucun prix sur les 30 derniers jours, **When** le popover s'affiche, **Then** il indique
   « Pas encore d'historique pour ce serveur ».

---

### Edge Cases

- Un prix partagé il y a exactement 24 h, 7 jours ou 30 jours : il est inclus dans la fenêtre (borne
  incluse).
- Plusieurs prix à la même minute : chacun reste un point distinct, aucun n'est fusionné.
- Une valeur aberrante (règle de specs/004 FR-012, appliquée aux prix de la fenêtre) n'est pas
  affichée ; sous 4 prix, le filtre n'écarte rien, comme aujourd'hui.
- Changement d'heure : les fenêtres sont des durées glissantes (24 h, 7 × 24 h, 30 × 24 h) à partir de
  l'instant présent ; les dates et heures affichées suivent l'heure de Paris.
- Le joueur change de fenêtre pendant que le popover est ouvert : la courbe se met à jour sans
  refermer le popover.
- Service communautaire injoignable : « Historique indisponible pour le moment », comme dans la spec
  017.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Le popover d'historique MUST proposer trois fenêtres : « Jour » (dernières 24 heures),
  « Semaine » (7 derniers jours) et « Mois » (30 derniers jours), glissantes à partir de l'instant
  présent. Remplace les regroupements de la spec 017 (FR-007, FR-008, FR-012).
- **FR-002**: « Semaine » MUST rester le choix par défaut, et le dernier choix MUST rester retenu sur
  l'appareil (spec 017 FR-007).
- **FR-003**: Chaque prix partagé dans la fenêtre, pour la ressource ou l'objet et le serveur actif,
  MUST apparaître comme un point distinct, placé à sa date et son heure réelles ; aucun
  dédoublonnage par appareil ni regroupement n'est appliqué. Remplace spec 017 FR-003 et FR-004.
- **FR-004**: Les valeurs aberrantes MUST être écartées selon la règle de specs/004 FR-012, calculée
  sur les prix de la fenêtre affichée.
- **FR-005**: Chaque point MUST indiquer, au survol ou au toucher, la date, l'heure (heure de Paris)
  et le prix en kamas. Remplace spec 017 FR-005.
- **FR-006**: Le service communautaire MUST exposer, pour l'historique, chaque prix partagé avec sa
  date et son heure, mais MUST NOT exposer l'identifiant d'appareil ni aucune autre information
  associée à la contribution. Révise spec 017 FR-006, qui interdisait tout prix individuel : cette
  levée est un choix assumé du porteur du projet pour un petit groupe fermé de joueurs.
- **FR-007**: Avec moins de deux prix dans la fenêtre, le système MUST NOT tracer de courbe : sans
  prix, il affiche « Aucun prix partagé sur cette période » (ou « Pas encore d'historique pour ce
  serveur » s'il n'y a aucun prix sur 30 jours) et propose la plus petite fenêtre plus longue qui
  contient au moins deux prix, s'il en existe une ; avec un seul prix, il affiche ce prix, sa date et
  son heure. Remplace spec 017 FR-009.
- **FR-008**: L'axe du temps MUST couvrir la fenêtre choisie et refléter l'écart réel entre les
  prix ; aucune valeur n'est inventée entre deux prix.
- **FR-009**: Les autres exigences de la spec 017 restent en vigueur : bouton en Mode communautaire
  seulement (FR-001), popover (FR-002), rétention inchangée (FR-011), état indisponible (FR-013),
  aucun effet sur la comparaison (FR-014), lisibilité sur téléphone (FR-015).

### Key Entities *(include if feature involves data)*

- **Contribution de prix (existante)** : un prix partagé pour une ressource ou un objet sur un
  serveur, avec sa date et un identifiant anonyme d'appareil. Pour l'historique, seuls le prix et la
  date sortent du service.
- **Fenêtre d'historique** : Jour (24 h), Semaine (7 jours) ou Mois (30 jours), glissante ; remplace
  la préférence de regroupement de la spec 017, en gardant le même choix retenu sur l'appareil.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Pour un jeu de prix connu, le nombre de points affichés dans chaque fenêtre est égal
  dans 100 % des cas au nombre de prix partagés dans cette fenêtre, valeurs aberrantes exclues.
- **SC-002**: Dès que deux prix ont été partagés dans les 7 derniers jours, « Semaine » affiche une
  courbe (fin du cas « Semaine vide » observé aujourd'hui).
- **SC-003**: Aucune réponse du service d'historique ne contient d'identifiant d'appareil.
- **SC-004**: Le popover s'affiche avec ses données en moins de 2 secondes dans des conditions
  réseau normales.
- **SC-005**: Aucun historique n'apparaît en Mode personnel.

## Assumptions

- Le public est un petit groupe fermé (une dizaine à une vingtaine de joueurs) : le nombre de prix
  par fenêtre reste faible, afficher chaque prix est lisible et ne pose pas de problème de volume.
- La fenêtre « Mois » (30 jours) reste dans la conservation de 90 jours : aucune règle de rétention
  ne change.
- Les prix d'un même appareil ne sont plus dédoublonnés dans l'historique, dans la continuité de la
  révision du 2026-09-26 de la spec 017 ; le prix communautaire actuel (specs/004 FR-023) garde son
  dédoublonnage.
- Le choix de regroupement déjà retenu sur l'appareil (jour, semaine, mois) est repris tel quel comme
  choix de fenêtre.
