# Feature Specification: Dernier prix partagé pour les ressources

**Feature Branch**: `024-latest-community-price`

**Created**: 2026-09-28

**Status**: Draft

**Input**: User description: "En Mode communautaire, le prix affiché pour une ressource doit être le dernier prix partagé par le groupe (la contribution la plus récente pour cette ressource sur ce serveur), et non plus la médiane du groupe. La médiane continue d'être calculée et stockée mais n'est plus affichée nulle part. Le dernier prix partagé doit aussi remplacer le prix déjà gardé sur l'appareil quand il est plus récent. Concerne Recherche, HDV, Rentabilité, Suivis, XP Familier. Le Mode personnel ne change pas."

## Contexte

Aujourd'hui, en Mode communautaire, une ressource sans prix sur l'appareil est pré-remplie avec la
**médiane** des prix partagés par le groupe (specs/004, FR-001/FR-003). Une fois ce prix gardé sur
l'appareil, il n'est plus jamais remplacé (specs/004, FR-006). Conséquence observée le 2026-09-28 :
un joueur a partagé un nouveau prix pour la Queue de Blérom (1 848 kamas), mais un autre appareil
qui avait gardé 1 437 kamas six jours plus tôt continue d'afficher 1 437, même après un rechargement
forcé de la page.

Le groupe veut que le prix affiché pour une ressource soit simplement **le dernier prix relevé par
le groupe**, comme c'est déjà le cas pour le prix HDV d'un objet (specs/016, FR-001). La médiane
reste calculée et enregistrée avec chaque contribution, pour le suivi des prix aberrants, mais les
joueurs ne la voient plus.

Cette spec **amende** specs/004 (FR-001, FR-003, FR-006), specs/007 (FR-001 à FR-006, pour la
référence affichée), specs/021 et specs/022 sur la source du prix communautaire d'une ressource.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Voir le dernier prix relevé par le groupe (Priority: P1)

En Mode communautaire, quand un joueur ouvre la fiche d'un objet sur la page Recherche, chaque
ressource de la recette affiche le dernier prix partagé par le groupe pour cette ressource sur son
serveur, avec la date de ce relevé. Il ne voit plus de médiane.

**Why this priority**: c'est le cœur de la demande. Un prix récent reflète l'HDV du moment, alors
qu'une médiane mélange des relevés parfois vieux de plusieurs semaines.

**Independent Test**: sur un serveur où une ressource a reçu plusieurs prix (100, 200, puis 150
kamas, dans cet ordre), ouvrir une recette qui l'utilise sur un appareil sans prix gardé : la ligne
affiche 150 kamas et la date du dernier relevé.

**Acceptance Scenarios**:

1. **Given** une ressource dont les prix partagés sont 100, 200 puis 150 kamas (du plus ancien au
   plus récent), **When** le joueur ouvre une recette qui l'utilise, **Then** la ligne affiche
   150 kamas et « Dernière mise à jour » indique la date du relevé à 150.
2. **Given** une ressource sans aucun prix partagé sur le serveur, **When** le joueur ouvre la
   recette, **Then** le champ reste vide et saisissable, comme aujourd'hui.
3. **Given** le joueur en Mode communautaire, **When** il consulte n'importe quelle page, **Then**
   aucune valeur de médiane n'est affichée nulle part.

---

### User Story 2 - Un prix plus récent du groupe remplace celui gardé sur l'appareil (Priority: P1)

Quand le groupe a partagé un prix plus récent que celui gardé sur l'appareil pour une ressource,
c'est ce nouveau prix qui s'affiche et qui sert aux calculs, sans que le joueur ait à vider le champ
ni à recharger la page d'une façon particulière.

**Why this priority**: sans cela, un appareil garde indéfiniment un vieux prix, ce qui est
exactement le problème observé.

**Independent Test**: sur un appareil qui a gardé 1 437 kamas pour une ressource, partager depuis un
autre appareil 1 848 kamas pour la même ressource et le même serveur, puis rouvrir la recette sur le
premier appareil : la ligne affiche 1 848 kamas.

**Acceptance Scenarios**:

1. **Given** l'appareil a gardé 1 437 kamas (daté du 22/09) et le dernier prix partagé est 1 848
   kamas (daté du 28/09), **When** le joueur ouvre une recette qui utilise cette ressource, **Then**
   la ligne affiche 1 848 kamas et le calcul de coût de craft l'utilise.
2. **Given** l'appareil a gardé un prix plus récent que le dernier prix partagé connu, **When** le
   joueur ouvre la recette, **Then** le prix gardé sur l'appareil reste affiché.
3. **Given** le joueur est en train de modifier le prix d'une ressource, **When** un rafraîchissement
   du prix partagé arrive, **Then** la saisie en cours n'est pas écrasée.

---

### User Story 3 - Le même dernier prix partout (Priority: P2)

Les pages HDV, Rentabilité, Suivis et XP Familier utilisent, pour une ressource en Mode
communautaire, le même dernier prix partagé que la page Recherche.

**Why this priority**: un même coût de craft doit donner le même résultat quelle que soit la page ;
sinon la page Rentabilité peut annoncer un bénéfice que la fiche contredit.

**Independent Test**: pour une ressource dont le dernier prix partagé diffère de la médiane, vérifier
que le coût de craft d'un objet qui l'utilise est identique sur Recherche, Rentabilité et Suivis, et
que XP Familier classe les nourritures avec ce même prix.

**Acceptance Scenarios**:

1. **Given** une ressource dont la médiane est 200 kamas et le dernier prix 150 kamas, **When** le
   joueur compare le coût de craft d'un objet sur Recherche, Rentabilité et Suivis, **Then** les
   trois pages comptent 150 kamas pour cette ressource.
2. **Given** une nourriture de familier dont le dernier prix partagé est 30 kamas, **When** le
   joueur ouvre XP Familier, **Then** la nourriture est comptée et affichée à 30 kamas, sans la
   mention « Médiane ».
3. **Given** une ressource vendue à l'HDV, **When** le joueur ouvre la page HDV, **Then** le champ
   affiche le dernier prix partagé pour cette ressource.

---

### User Story 4 - Confirmation d'un prix très différent (Priority: P3)

Quand un joueur saisit un prix de ressource très éloigné de la médiane du groupe, l'appli lui
demande toujours de confirmer avant de partager ce prix, comme aujourd'hui (specs/007). La médiane
reste la référence du calcul, mais elle n'est plus montrée dans la confirmation.

**Why this priority**: protège le groupe contre une faute de frappe, mais existe déjà ; seul le
contenu de la confirmation change.

**Independent Test**: saisir un prix qui s'écarte de plus de 25 % de la médiane, vérifier que la
confirmation s'affiche avec le prix saisi, sans médiane ni pourcentage d'écart.

**Acceptance Scenarios**:

1. **Given** une ressource dont la médiane est 100 kamas et le dernier prix 110 kamas, **When** le
   joueur saisit 200 kamas, **Then** une confirmation s'affiche avant tout partage, indiquant
   200 kamas et que ce prix semble très différent des relevés du groupe, sans afficher 100 kamas ni
   d'écart en pourcentage.
2. **Given** la même ressource, **When** le joueur saisit 120 kamas (écart de 20 % avec la
   médiane), **Then** le prix est partagé sans confirmation, même s'il n'est pas identique au
   dernier prix affiché.
3. **Given** la confirmation affichée, **When** le joueur annule, **Then** rien n'est partagé et la date ne change pas (specs/007,
   FR-007, inchangé).

---

### Edge Cases

- **Service communautaire injoignable** : l'appareil affiche le dernier prix partagé qu'il connaît
  déjà (ou le prix qu'il a gardé), avec sa date, et le joueur peut saisir un prix localement, comme
  aujourd'hui (specs/004, FR-011).
- **Deux relevés à la même seconde** : le plus récemment enregistré par le service l'emporte.
- **Dernier prix très éloigné des précédents** (faute de frappe partagée malgré la confirmation) :
  il s'affiche tel quel, puisque c'est le dernier relevé ; le prochain relevé du groupe le
  remplacera. Le joueur voit sa date et peut le corriger.
- **Prix saisi hors ligne sur l'appareil, jamais partagé** : il reste affiché tant qu'aucun prix
  partagé plus récent n'existe.
- **Contributions anciennes** : seuls les prix encore conservés par le service (90 jours) comptent ;
  au-delà, la ressource n'a plus de prix partagé.
- **Prix du joueur lui-même** : quand le dernier relevé est celui que le joueur vient de partager,
  l'affichage ne change pas.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: En Mode communautaire, le prix partagé d'une ressource MUST être le prix de la
  contribution la plus récente pour cette ressource sur le serveur actif, et MUST NOT être une
  médiane ni une moyenne. *(amende specs/004 FR-001 et FR-003)*
- **FR-002**: Le système MUST afficher sous chaque ligne de ressource la date de ce dernier prix
  (« Dernière mise à jour : … »), ou la date du prix gardé sur l'appareil quand c'est lui qui est
  affiché.
- **FR-003**: Le système MUST NOT afficher de valeur de médiane, ni de mention « Médiane », sur
  aucune page ni dans aucune boîte de dialogue.
- **FR-004**: Quand le dernier prix partagé d'une ressource est plus récent que le prix gardé sur
  l'appareil pour cette ressource et ce serveur, le système MUST afficher et utiliser le dernier prix
  partagé, et MUST mettre à jour le prix gardé sur l'appareil avec cette valeur et sa date.
  *(remplace specs/004 FR-006)*
- **FR-005**: Quand le prix gardé sur l'appareil est aussi récent ou plus récent que le dernier prix
  partagé, le système MUST le conserver.
- **FR-006**: Une valeur que le joueur est en train de saisir MUST NOT être remplacée par un
  rafraîchissement du prix partagé.
- **FR-007**: Les pages Recherche, HDV, Rentabilité, Suivis et XP Familier MUST utiliser, pour une
  ressource en Mode communautaire, la même règle de prix (FR-001, FR-004, FR-005), afin que le coût
  de craft d'un objet soit identique sur toutes les pages.
- **FR-008**: Le service communautaire MUST continuer de calculer la médiane au moment de chaque
  contribution de ressource et de l'enregistrer avec l'écart correspondant, comme aujourd'hui
  (specs/007, FR-009), pour le suivi des prix aberrants.
- **FR-009**: Lorsque le prix de ressource saisi s'écarte de plus de 25 % de la médiane actuelle du
  groupe pour cette ressource et ce serveur, le système MUST demander une confirmation avant tout
  partage. La médiane sert au calcul mais MUST NOT être montrée : la confirmation indique le prix
  saisi et que ce prix semble très différent des relevés du groupe, sans valeur de médiane ni
  pourcentage d'écart. Sans médiane connue, aucune confirmation n'est demandée (specs/007 FR-008,
  inchangé). *(amende specs/007 FR-005)*
- **FR-010**: Si le service communautaire est injoignable, le système MUST afficher le dernier prix
  partagé déjà connu sur l'appareil, ou le prix gardé sur l'appareil, avec sa date, et MUST laisser
  le joueur saisir et utiliser un prix localement sans message bloquant.
- **FR-011**: En Mode personnel, le système MUST conserver exactement le comportement actuel et
  MUST NOT lire ni utiliser de prix partagé.
- **FR-012**: Le système MUST NOT afficher de nombre de contributions sur les lignes de prix des
  ressources (règle déjà en vigueur, rappelée ici).

### Key Entities

- **Contribution de prix de ressource** : un prix relevé par un joueur pour une ressource sur un
  serveur, à une date donnée, avec la médiane et l'écart calculés au moment de l'envoi (non
  affichés).
- **Dernier prix partagé** : la contribution la plus récente pour une ressource et un serveur (sa
  valeur et sa date).
- **Prix gardé sur l'appareil** : le prix d'une ressource enregistré localement pour un serveur en
  Mode communautaire, avec sa date ; remplacé par le dernier prix partagé quand celui-ci est plus
  récent.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Après qu'un joueur a partagé un nouveau prix de ressource, tout autre appareil du
  groupe affiche ce prix à sa prochaine ouverture d'une page qui l'utilise, au plus 1 minute après
  le partage, sans action particulière du joueur.
- **SC-002**: Pour un même objet et un même serveur, le coût de craft affiché est identique sur les
  pages Recherche, Rentabilité et Suivis dans 100 % des cas.
- **SC-003**: Aucune valeur de médiane n'est visible dans l'application, sur aucune page.
- **SC-004**: 100 % des contributions de ressources enregistrées après ce changement ont toujours
  leur médiane et leur écart calculés au moment de l'envoi (vides seulement quand aucun prix
  antérieur n'existait).

## Assumptions

- « Dernier prix » signifie la contribution la plus récente, sans filtrage des valeurs aberrantes :
  la confirmation à la saisie (FR-009) reste la protection contre les fautes de frappe.
- Un prix partagé par le joueur lui-même compte comme n'importe quel autre relevé.
- Le délai de rafraîchissement actuel (lecture au chargement de la page, puis toutes les 5 minutes
  sur la page Recherche, avec un cache de 60 secondes côté service) est conservé.
- Les pages qui utilisent les prix sans les afficher ligne par ligne (Rentabilité, Suivis) suivent
  la même règle que la page Recherche.
- Le prix HDV des objets (specs/016) n'est pas modifié : il est déjà le dernier prix partagé.
- La correction des données déjà en base (reclassement du 2026-09-28) est hors du périmètre de cette
  spec.
