# Feature Specification: Récap de forgemagie par objet

**Feature Branch**: `027-fm-item-recap`

**Created**: 2026-09-30

**Status**: Draft

**Input**: User description: « Je veux que le calcul d'une session soit associé à un item : quand je
vais FM par exemple mon anneau Rtograf, je vais peut-être faire une ou plusieurs sessions, et je veux
un récap de prix par rapport à cet item. »

Choix faits par le porteur du projet avant la spec :
- l'association se fait **sur le site**, dans le détail d'une session (aucun changement du bot) ;
- le récap porte sur **un exemplaire** appartenant à un joueur (son Anneau Rtograf, distinct de celui
  d'un autre joueur), pas sur le modèle d'objet ;
- une session concerne **un seul objet** ;
- le récap contient le **total dépensé**, la **liste des sessions** et le **détail par rune**, sans
  part par joueur.

## Contexte

La page Forgemagie (specs/025) garde les sessions FM du bot Discord : pour chacune, la dépense de
chaque joueur et le détail des runes. Mais forgemager un objet prend souvent plusieurs séances, et
rien ne relie aujourd'hui les sessions entre elles : impossible de savoir combien a coûté, au total,
l'Anneau Rtograf de Cyril.

Cette fonctionnalité ajoute les **objets en FM** : un joueur déclare les objets qu'il forgemage, y
rattache les sessions correspondantes, et obtient un récap de coût par objet.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Déclarer un objet en FM et y rattacher des sessions (Priority: P1)

Un joueur connecté crée un objet en FM : il choisit l'équipement dans le catalogue (Anneau Rtograf) et
peut lui donner un nom libre (« mon Rtograf PA »). Ensuite, depuis le détail d'une session, il la
rattache à cet objet. Il peut rattacher des sessions passées comme la session en cours, et détacher
une session rattachée par erreur.

**Why this priority**: sans rattachement, pas de récap ; c'est le cœur de la demande.

**Independent Test**: créer l'objet « Anneau Rtograf », ouvrir une session terminée et la rattacher à
cet objet : le détail de la session indique « Objet : Anneau Rtograf (Cyril) ». La détacher : la
mention disparaît.

**Acceptance Scenarios**:

1. **Given** un joueur connecté, **When** il crée un objet en FM en choisissant « Anneau Rtograf »
   dans le catalogue, **Then** l'objet apparaît dans la liste de ses objets en FM, avec l'icône et le
   nom de l'équipement.
2. **Given** deux objets du même modèle, **When** le joueur leur donne des noms différents
   (« Rtograf PA », « Rtograf PO »), **Then** il les distingue partout où ils sont listés.
3. **Given** le détail d'une session non rattachée, **When** le joueur choisit un de ses objets en FM,
   **Then** la session est rattachée à cet objet et le détail l'indique.
4. **Given** une session rattachée à un objet du joueur, **When** il la détache, **Then** elle n'est
   plus rattachée à aucun objet et ne compte plus dans le récap.
5. **Given** une session déjà rattachée à l'objet d'un autre joueur, **When** le joueur ouvre son
   détail, **Then** il voit à quel objet elle est rattachée, mais ne peut ni la détacher ni la
   rattacher à un de ses objets.
6. **Given** un joueur sans objet en FM, **When** il ouvre le détail d'une session, **Then** on lui
   propose de créer un objet en FM pour pouvoir rattacher la session.

---

### User Story 2 - Voir le récap de coût d'un objet (Priority: P1)

Un joueur ouvre un de ses objets en FM et voit : le total dépensé sur cet objet, la liste des sessions
rattachées (date, salon, montant) et le détail par rune sur l'ensemble de ces sessions (quantité,
total, prix moyen).

**Why this priority**: c'est le résultat attendu ; utile dès la première session rattachée.

**Independent Test**: rattacher deux sessions de 100 000 et 50 000 kamas à l'Anneau Rtograf : son
récap affiche 150 000 kamas, les deux sessions avec leur montant, et chaque rune avec la somme des
quantités et des totaux des deux sessions.

**Acceptance Scenarios**:

1. **Given** deux sessions rattachées de 100 000 et 50 000 kamas, **When** le joueur ouvre le récap
   de l'objet, **Then** le total est 150 000 kamas.
2. **Given** une session rattachée où deux joueurs ont dépensé 60 000 et 40 000 kamas, **When** le
   récap est affiché, **Then** la session compte pour 100 000 kamas, sans part par joueur.
3. **Given** la Rune Do Air achetée 20 fois pour 31 736 kamas dans une session et 10 fois pour
   16 000 kamas dans une autre, **When** le récap est affiché, **Then** la ligne Rune Do Air indique
   30, 47 736 kamas et un prix moyen de 1 591 kamas (arrondi).
4. **Given** une session rattachée encore en cours, **When** le bot y ajoute un achat, **Then** le
   récap de l'objet en tient compte à sa prochaine ouverture.
5. **Given** un objet sans session rattachée, **When** le joueur ouvre son récap, **Then** il voit un
   total de 0 kamas et une invitation à rattacher une session.
6. **Given** la liste des sessions du récap, **When** le joueur clique sur une session, **Then** son
   détail s'ouvre.

---

### User Story 3 - Consulter les objets en FM d'un membre (Priority: P2)

Depuis le profil d'un joueur, on voit la liste de ses objets en FM avec le total de chacun, et on peut
ouvrir leur récap. La visibilité suit celle du profil : les objets d'un profil privé ne sont visibles
que par leur propriétaire.

**Why this priority**: prolonge le récap au groupe ; secondaire par rapport au récap personnel.

**Independent Test**: sur le profil public de Bob, voir « Coiffe Bouftou — 80 000 kamas » et ouvrir son
récap ; passer le profil de Bob en privé : ses objets ne sont plus visibles par les autres.

**Acceptance Scenarios**:

1. **Given** un profil public avec deux objets en FM, **When** un autre membre ouvre ce profil,
   **Then** il voit les deux objets et leur total, et peut ouvrir leur récap (sans pouvoir les
   modifier).
2. **Given** un profil privé, **When** un autre membre ouvre le détail d'une session rattachée à un de
   ses objets, **Then** il voit seulement « Rattachée à l'objet d'un joueur privé », sans nom
   d'objet ni lien.
3. **Given** le propriétaire, **When** il ouvre son propre profil, **Then** il voit tous ses objets
   et peut les renommer ou les supprimer.

---

### Edge Cases

- **Supprimer un objet en FM** : après confirmation, l'objet disparaît ; ses sessions ne sont pas
  supprimées, elles redeviennent non rattachées.
- **Supprimer son profil** (specs/025, FR-007) : ses objets en FM sont supprimés et leurs sessions
  redeviennent non rattachées.
- **Session remise à zéro** (`/fmreset`) alors qu'elle est rattachée : elle reste rattachée, avec les
  nouveaux montants (0 kamas jusqu'aux captures suivantes).
- **Session sans achat** (ouverte puis fermée sans capture) : elle peut être rattachée, et compte pour
  0 kamas.
- **Achat d'un joueur qui a supprimé son profil** : il a disparu de la session (specs/025) et ne
  compte donc plus dans le récap.
- **Captures importées sur le site** (hors session, specs/025 US5) : elles ne sont pas rattachables à
  un objet et n'entrent pas dans les récaps.
- **Équipement retiré du catalogue** plus tard : l'objet garde le nom et l'icône enregistrés à sa
  création.
- **Deux joueurs qui veulent la même session** : le premier qui la rattache l'emporte ; l'autre voit à
  quel objet elle est rattachée, et doit demander au propriétaire de la détacher.

## Requirements *(mandatory)*

### Functional Requirements

**Objets en FM**

- **FR-001**: Un joueur connecté MUST pouvoir créer un objet en FM en choisissant un équipement dans
  le catalogue (recherche par nom), avec un nom libre facultatif de 1 à 40 caractères.
- **FR-002**: Un objet en FM MUST appartenir au joueur qui l'a créé. Seul ce joueur MUST pouvoir le
  renommer, le supprimer, et y rattacher ou en détacher des sessions.
- **FR-003**: Un objet en FM MUST garder le nom et l'icône de l'équipement choisis à sa création.
- **FR-004**: La suppression d'un objet en FM MUST demander une confirmation, et MUST laisser ses
  sessions en place, non rattachées.

**Rattachement**

- **FR-005**: Depuis le détail d'une session non rattachée, un joueur connecté MUST pouvoir la
  rattacher à un de ses objets en FM, que la session soit en cours ou terminée, et qu'il y ait
  participé ou non.
- **FR-006**: Une session MUST être rattachée à au plus un objet en FM. Tenter de rattacher une
  session déjà rattachée MUST échouer avec un message qui indique qu'elle l'est déjà.
- **FR-007**: Le propriétaire de l'objet MUST pouvoir détacher une session de cet objet.
- **FR-008**: Le détail d'une session et la liste des sessions MUST indiquer l'objet auquel elle est
  rattachée (nom de l'objet et propriétaire), ou « Rattachée à l'objet d'un joueur privé » quand le
  propriétaire est privé et n'est pas le joueur connecté.

**Récap**

- **FR-009**: Le récap d'un objet en FM MUST afficher le total dépensé : la somme des dépenses de
  toutes les sessions rattachées, tous joueurs confondus, calculée comme le total d'une session
  (specs/025, FR-011 : ce que le bot a compté).
- **FR-010**: Le récap MUST lister les sessions rattachées, de la plus récente à la plus ancienne,
  avec leur salon, leur date d'ouverture, leur état et leur montant ; chacune MUST ouvrir le détail
  de la session.
- **FR-011**: Le récap MUST détailler, pour l'ensemble des sessions rattachées, chaque objet acheté :
  quantité totale, total payé et prix moyen arrondi au kama (même calcul que le détail d'une session).
- **FR-012**: Le récap MUST NOT afficher de part par joueur.
- **FR-013**: Les totaux MUST être calculés à chaque lecture, pour refléter les captures ajoutées,
  les remises à zéro et les suppressions de profil sans action du joueur.

**Visibilité**

- **FR-014**: Le profil d'un joueur MUST lister ses objets en FM avec le total de chacun ; les objets
  d'un profil privé MUST être visibles uniquement par leur propriétaire (même règle que specs/025,
  FR-014).
- **FR-015**: La suppression d'un profil (specs/025, FR-007) MUST supprimer ses objets en FM et
  détacher leurs sessions.

### Key Entities

- **Objet en FM** : un exemplaire d'équipement qu'un joueur forgemage ; propriétaire (joueur
  Discord), équipement du catalogue (identifiant, nom, icône au moment de la création), nom libre
  facultatif, date de création.
- **Rattachement** : le lien d'une session FM (specs/025) vers au plus un objet en FM.
- **Récap** : valeurs calculées pour un objet — total, sessions rattachées, détail par objet acheté.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un joueur crée un objet en FM et y rattache une session en moins d'une minute.
- **SC-002**: Pour 100 % des objets, le total du récap est égal à la somme des totaux des sessions
  rattachées, tels qu'ils sont affichés dans leur détail.
- **SC-003**: Aucune information sur les objets d'un joueur privé (nom, équipement, total) n'est
  visible par un autre membre.
- **SC-004**: Un achat envoyé par le bot dans une session rattachée apparaît dans le récap de l'objet
  à la prochaine ouverture du récap.

## Assumptions

- N'importe quel membre connecté peut rattacher une session non rattachée à **ses** objets, même
  s'il n'y a pas dépensé : dans une FM de groupe, les autres paient souvent pour l'objet d'un seul.
- Le catalogue d'équipements est celui de la page Recherche (DofusDB) ; seuls les équipements
  (pas les ressources) peuvent devenir un objet en FM.
- Pas d'état « terminé » pour un objet en FM, ni de jets ou de stats obtenus : hors périmètre.
- Aucun changement du bot Discord : le rattachement se fait uniquement sur le site.
- Les objets en FM sont gardés tant que le propriétaire ne les supprime pas (même règle que les
  sessions, specs/025 FR-012).
