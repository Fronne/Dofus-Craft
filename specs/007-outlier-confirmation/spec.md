# Feature Specification: Confirmation des valeurs de coût de craft aberrantes

**Feature Branch**: `007-outlier-confirmation`

**Created**: 2026-09-21

**Status**: Draft

**Input**: User description: "Protéger la qualité des données de coût de craft en mode communautaire
en demandant une confirmation quand une valeur saisie s'éloigne trop de la médiane stockée dans
Cloudflare. Lorsqu'un utilisateur en mode communautaire rentre un montant pour le coût de craft
d'un item : comparer ce montant avec la médiane communautaire existante, et si l'écart dépasse un
seuil défini (proposé : 25 %), afficher une confirmation avant d'enregistrer la valeur. Tracker les
valeurs aberrantes confirmées pour modération future."

## Clarifications

### Session 2026-09-21

- Q: La médiane communautaire est calculée séparément par serveur ; la confirmation d'écart et la
  trace des valeurs aberrantes doivent-elles aussi être distinguées par serveur ? → A: Oui, par
  ressource + serveur — cohérent avec le reste du système communautaire (specs/002, 003, 004).
- Q: Si une ressource n'a qu'une ou deux contributions jusqu'ici, sa médiane est peu fiable ;
  faut-il quand même déclencher la confirmation dans ce cas, ou attendre un nombre minimal de
  contributions ? → A: Toujours comparer dès la 1ʳᵉ médiane disponible, sans seuil d'échantillon
  supplémentaire.
- Q: La trace des valeurs aberrantes doit-elle inclure l'identifiant anonyme d'appareil déjà utilisé
  pour les contributions communautaires (specs/004) ? → A: Oui, pour repérer les patterns répétés
  depuis un même appareil lors d'une revue de modération.

### Session 2026-09-21 (révision)

- Q: Après qu'un joueur a saisi et transmis avec succès un prix (confirmé ou non), le champ doit-il
  afficher la médiane communautaire recalculée, ou la valeur que le joueur vient lui-même de saisir ?
  → A: La valeur saisie par le joueur. Elle représente le prix exact qu'il vient de constater en jeu
  et doit rester la source de vérité affichée et utilisée pour son propre calcul de craft, jusqu'à ce
  qu'il la modifie lui-même. La médiane communautaire ne sert qu'au préremplissage initial du champ
  (absence de valeur locale) et à la détection d'écart déclenchant la confirmation ; elle ne doit plus
  jamais écraser une valeur déjà saisie par le joueur.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Confirmation avant enregistrement d'une valeur très différente de la médiane (Priority: P1)

Un joueur en Mode communautaire saisit, pour une ressource, un montant qui s'écarte fortement de la
médiane communautaire déjà connue pour cette ressource (par exemple une faute de frappe ajoutant un
zéro, ou une confusion d'unité). Avant que cette valeur ne soit transmise et intégrée au calcul
communautaire, le joueur voit une demande de confirmation qui lui indique la médiane actuelle, la
valeur qu'il vient de saisir, et l'écart entre les deux. S'il confirme, la valeur est enregistrée
normalement. S'il annule, la valeur n'est pas transmise et le champ revient à son état précédent
(médiane communautaire déjà affichée, ou champ vide si aucune contribution n'existait).

**Why this priority**: C'est le cœur de la fonctionnalité — sans cette confirmation, une saisie
erronée s'intègre silencieusement à la médiane partagée et dégrade la donnée vue par tous les
joueurs du groupe. C'est aussi la seule story qui, à elle seule, apporte déjà toute la valeur
métier demandée.

**Independent Test**: Peut être testée entièrement en saisissant, en Mode communautaire, une valeur
dont l'écart avec la médiane existante dépasse le seuil, et en vérifiant qu'une confirmation
s'affiche avant tout envoi, avec la médiane, la valeur saisie et l'écart affichés.

**Acceptance Scenarios**:

1. **Given** une ressource a déjà une médiane communautaire de 1000 kamas, **When** le joueur perd
   le focus du champ après avoir saisi 1300 kamas (écart de 30 %, au-dessus du seuil de 25 %),
   **Then** une confirmation s'affiche indiquant la médiane (1000), la valeur saisie (1300) et
   l'écart (30 %), et la valeur n'est pas encore enregistrée.
2. **Given** cette confirmation est affichée, **When** le joueur confirme vouloir enregistrer malgré
   l'écart, **Then** la valeur est transmise normalement, comme n'importe quelle contribution, et le
   champ continue d'afficher la valeur que le joueur vient de saisir (elle n'est pas remplacée par la
   médiane communautaire recalculée).
3. **Given** cette confirmation est affichée, **When** le joueur l'annule, **Then** la valeur n'est
   pas transmise, aucune contribution n'est enregistrée, et le champ revient à la valeur qu'il
   affichait avant la saisie.
4. **Given** une ressource a déjà une médiane communautaire de 1000 kamas, **When** le joueur perd le
   focus du champ après avoir saisi 1150 kamas (écart de 15 %, sous le seuil de 25 %), **Then** la
   valeur est transmise directement, sans confirmation, exactement comme aujourd'hui, et le champ
   continue d'afficher 1150 (pas la médiane recalculée).

---

### User Story 2 - Historique des valeurs aberrantes confirmées pour modération future (Priority: P2)

Après qu'un joueur a confirmé vouloir enregistrer une valeur au-delà du seuil d'écart, cette
confirmation est conservée séparément des contributions ordinaires, avec la médiane au moment de la
saisie, la valeur saisie et l'écart calculé, afin qu'un membre du groupe puisse ultérieurement
repérer et examiner ces cas pour évaluer si la donnée communautaire reste fiable.

**Why this priority**: Cette story ne bloque ni ne modifie le parcours de saisie du joueur — elle
ajoute une trace exploitable a posteriori. Elle apporte de la valeur seulement une fois la story 1 en
place, et peut être livrée juste après sans revoir l'expérience de saisie.

**Independent Test**: Peut être testée en confirmant une valeur aberrante via la story 1, puis en
vérifiant que cette confirmation apparaît dans la liste des valeurs aberrantes suivies, avec la
médiane, la valeur saisie et l'écart au moment de la confirmation.

**Acceptance Scenarios**:

1. **Given** un joueur a confirmé l'enregistrement d'une valeur avec un écart de 30 % par rapport à
   la médiane, **When** l'enregistrement réussit, **Then** cette confirmation est ajoutée à la trace
   des valeurs aberrantes, avec la médiane, la valeur saisie et l'écart en pourcentage.
2. **Given** un joueur enregistre une valeur sous le seuil d'écart (pas de confirmation demandée),
   **When** l'enregistrement réussit, **Then** rien n'est ajouté à la trace des valeurs aberrantes.

---

### Edge Cases

- Aucune médiane n'existe encore pour cette ressource (première contribution) : aucune comparaison
  n'est possible, la valeur est enregistrée directement sans confirmation, comme aujourd'hui.
- Le joueur confirme puis l'envoi échoue (ex. connexion perdue) : le comportement suit celui déjà en
  place pour un échec de transmission (la valeur locale reste intacte, sans blocage) ; la
  confirmation ayant eu lieu, l'échec d'envoi n'ajoute pas d'entrée dans la trace des valeurs
  aberrantes puisque rien n'a été enregistré côté communautaire.
- Le joueur modifie encore la valeur après avoir vu la confirmation mais avant de répondre : la
  confirmation affichée devient obsolète ; à la perte de focus suivante, l'écart est recalculé sur la
  base de la nouvelle valeur saisie.
- La médiane communautaire elle-même évolue entre l'instant où le champ a été pré-rempli et l'instant
  de la saisie : le seuil est comparé à la médiane la plus récente disponible au moment de la perte de
  focus, pas à celle affichée lors du chargement de la page.
- Un écart exactement égal au seuil (25 %) : traité comme sous le seuil, donc pas de confirmation
  (le seuil déclenche une confirmation seulement au-delà, pas à l'égalité).
- L'application est rechargée après qu'un joueur a déjà saisi une valeur locale pour une ressource :
  cette valeur locale reste affichée telle quelle (elle n'est pas remplacée par la médiane
  communautaire recalculée depuis sa saisie) ; le préremplissage par la médiane ne s'applique que
  lorsqu'aucune valeur locale n'existe pour cette ressource.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: En Mode communautaire, lorsqu'un joueur modifie le prix d'une ressource et qu'une
  médiane communautaire existe déjà pour cette ressource sur le serveur actif du joueur, le système
  DOIT comparer la valeur saisie à cette médiane avant toute transmission, quel que soit le nombre de
  contributions ayant déjà servi à calculer cette médiane (y compris une médiane issue d'une seule
  contribution antérieure).
- **FR-002**: Le système DOIT calculer l'écart entre la valeur saisie et la médiane comme un
  pourcentage de la médiane : `|valeur_saisie − médiane| / médiane × 100`.
- **FR-003**: Le système DOIT considérer qu'une valeur est aberrante lorsque cet écart dépasse 25 %,
  et ne rien changer au comportement actuel (transmission directe, sans confirmation) en dessous de
  ce seuil.
- **FR-004**: Lorsque l'écart dépasse le seuil, le système DOIT afficher une demande de confirmation
  avant toute transmission de la valeur, empêchant tout enregistrement tant que le joueur n'a pas
  répondu.
- **FR-005**: Cette demande de confirmation DOIT indiquer clairement au joueur trois informations : la
  médiane communautaire actuelle, la valeur qu'il vient de saisir, et l'écart entre les deux exprimé
  en pourcentage.
- **FR-006**: Si le joueur confirme, le système DOIT transmettre la valeur exactement comme une
  contribution normale (mêmes règles d'intégration au calcul de la médiane), mais l'affichage du champ
  DOIT continuer de montrer la valeur saisie par le joueur, sans être remplacé par la médiane
  communautaire recalculée après la transmission.
- **FR-007**: Si le joueur annule la confirmation, le système DOIT NE PAS transmettre la valeur, et le
  champ DOIT revenir à l'état qu'il affichait avant la saisie (sa propre valeur déjà enregistrée
  localement pour cette ressource, la médiane communautaire s'il n'avait pas encore de valeur locale,
  ou champ vide en l'absence de toute contribution antérieure et de médiane).
- **FR-008**: Lorsqu'aucune médiane communautaire n'existe encore pour la ressource concernée, le
  système DOIT enregistrer la valeur directement, sans comparaison ni confirmation.
- **FR-012**: Ce comportement de non-écrasement après transmission réussie (avec ou sans confirmation
  préalable) est celui déjà requis par specs/004-community-price-sharing (FR-018, amendée révision 6) :
  il s'applique donc aussi bien au chemin direct qu'au chemin passant par la confirmation d'écart de
  cette spécification, sans aucune distinction entre les deux.
- **FR-009**: Chaque confirmation acceptée par un joueur DOIT être conservée dans une trace des
  valeurs aberrantes, distincte des contributions ordinaires, incluant au minimum la ressource et le
  serveur concernés, la médiane au moment de la saisie, la valeur saisie, l'écart en pourcentage, et
  l'identifiant anonyme d'appareil déjà utilisé pour les contributions communautaires (specs/004).
- **FR-010**: Cette trace des valeurs aberrantes ne DOIT modifier ni le calcul ni l'affichage de la
  médiane communautaire : elle sert uniquement à un examen ultérieur, pas au filtrage automatique des
  contributions.
- **FR-011**: Ce mécanisme de confirmation DOIT rester strictement limité au Mode communautaire ; le
  Mode personnel n'est pas concerné et continue de fonctionner sans aucune comparaison ni
  confirmation.

### Key Entities

- **Écart à la médiane**: Résultat du calcul comparant une valeur saisie à la médiane communautaire
  d'une ressource au moment de la saisie ; comprend la médiane de référence, la valeur saisie et
  l'écart en pourcentage. Sert à décider si une confirmation est nécessaire.
- **Entrée de trace des valeurs aberrantes**: Enregistrement conservé après qu'un joueur a confirmé
  une valeur dont l'écart dépassait le seuil ; comprend la ressource et le serveur concernés, la
  médiane au moment de la saisie, la valeur saisie, l'écart en pourcentage, et l'identifiant anonyme
  d'appareil ayant confirmé (même identifiant que celui des contributions communautaires ordinaires,
  specs/004). Ne participe pas au calcul de la médiane.
- **Valeur locale du joueur**: Dernier prix qu'un joueur a lui-même saisi et transmis avec succès pour
  une ressource donnée, sur son serveur actif. Reste affichée et sert de source de vérité pour ses
  propres calculs de craft tant qu'il ne la modifie pas à nouveau, indépendamment de l'évolution
  ultérieure de la médiane communautaire. Distincte de la médiane, qui n'intervient que pour le
  préremplissage initial (absence de valeur locale) et la détection d'écart.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Une saisie dont l'écart à la médiane communautaire dépasse 25 % ne peut jamais être
  transmise sans qu'une confirmation explicite n'ait été affichée et acceptée par le joueur.
- **SC-002**: Une saisie dont l'écart est de 25 % ou moins continue de se transmettre exactement comme
  avant cette fonctionnalité, sans confirmation additionnelle ni changement de délai perceptible.
- **SC-003**: 100 % des valeurs confirmées malgré un écart au-delà du seuil sont retrouvables a
  posteriori dans la trace des valeurs aberrantes, avec la médiane, la valeur saisie et l'écart
  associés.
- **SC-004**: Un joueur qui annule une confirmation retrouve exactement l'état de son champ
  d'avant saisie, sans qu'aucune donnée n'ait été transmise entre-temps.

## Assumptions

- Le seuil de déclenchement est fixé à 25 % d'écart, conformément à la proposition du besoin ; il
  n'est pas configurable par l'utilisateur dans cette révision.
- La modération automatique des écarts très importants (par exemple au-delà de 50 %), évoquée comme
  piste dans le besoin initial, est explicitement hors périmètre de cette révision : seule la
  confirmation manuelle et la conservation d'une trace pour examen humain ultérieur sont couvertes.
  Le groupe de joueurs concerné étant restreint (dizaine de joueurs), une revue manuelle occasionnelle
  de la trace suffit sans automatisation.
- La consultation de la trace des valeurs aberrantes par un membre du groupe (interface de
  modération) n'est pas spécifiée ici en détail ; cette révision garantit uniquement que la donnée est
  conservée de façon exploitable. L'interface de consultation pourra faire l'objet d'une révision
  ultérieure si le besoin s'en fait sentir.
- Le mécanisme de calcul de la médiane communautaire elle-même (fenêtre de rétention, filtrage des
  valeurs déjà aberrantes à l'agrégation) reste celui déjà en place et n'est pas modifié par cette
  fonctionnalité.
- Depuis la révision du 2026-09-21, la médiane communautaire ne sert plus jamais à écraser une valeur
  déjà saisie localement par le joueur : elle reste uniquement un repère de préremplissage (absence de
  valeur locale) et de détection d'écart. Chaque joueur voit et utilise pour son calcul de craft le
  dernier prix qu'il a lui-même constaté en jeu, pas un consensus recalculé après coup.

## Révision (2026-09-28) : médiane non affichée

Amendée par [specs/024-latest-community-price](../024-latest-community-price/spec.md) (FR-009).

- La détection est inchangée : écart à la médiane communautaire de plus de 25 %, pas de
  confirmation sans médiane connue.
- **FR-005 (amendée)** : pour une ressource, la confirmation n'affiche plus la médiane ni l'écart en
  pourcentage ; elle indique le prix saisi et que ce prix semble très différent des relevés du
  groupe. La confirmation d'un prix HDV d'objet (specs/016) garde son affichage.
- Le prix affiché dans le champ est désormais le dernier prix partagé (specs/024), plus la médiane.
