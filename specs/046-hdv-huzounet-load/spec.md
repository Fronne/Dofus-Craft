# Feature Specification: Charger les prix d'un onglet HDV depuis Huzounet

**Feature Branch**: `046-hdv-huzounet-load`

**Created**: 2026-10-12

**Status**: Draft

**Input**: User description: "Sur la page HDV, ajouter pour chaque onglet (Ressources, Consommables, Créatures, Runes) un bouton qui charge les prix de l'onglet depuis le site Huzounet, par tranches successives, avec une progression visible, un arrêt possible et des messages clairs. Les prix chargés s'affichent ensuite dans l'onglet comme les autres prix du mode communautaire. Le site du dépôt ne connaît pas encore les prix externes que l'API renvoie déjà ; la fonctionnalité inclut ce qu'il faut pour les lire et les afficher sur la page HDV."

## Contexte

L'API du site relit chaque nuit les prix publiés par Huzounet (huzounet.fr, lecture autorisée par son
auteur) pour le serveur Mikhal, et sait aussi les relire à la demande (fonctionnalité 045). La page HDV du
dépôt, elle, date d'avant ces prix : elle ne sait ni les demander ni dire d'où ils viennent.

Aujourd'hui, pour avoir un prix plus frais que celui de la nuit, le joueur n'a que le bouton
d'actualisation de la page Recherche, recette par recette. Sur la page HDV, où il passe en revue des
centaines d'objets, il veut pouvoir demander en une fois les prix de l'onglet qu'il regarde.

Tailles des onglets au 12 octobre 2026 : Ressources 2 537 objets, Consommables 128, Créatures 35,
Runes 105.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Charger les prix de l'onglet affiché (Priority: P1)

En Mode communautaire, sur le serveur Mikhal, le joueur ouvre un onglet de la page HDV et clique sur
« Charger depuis Huzounet ». Le site demande les prix des objets de l'onglet par tranches, montre où il en
est, puis affiche les prix reçus dans la liste, sans que le joueur ait à recharger la page.

**Why this priority**: c'est la demande elle-même ; sans elle rien d'autre n'a d'intérêt.

**Independent Test**: avec une API simulée, ouvrir l'onglet Consommables (128 objets), cliquer sur le
bouton, et vérifier que les objets sont demandés en deux tranches, que la progression s'affiche, et que
les prix reçus apparaissent dans la liste et dans le compteur « N objets sur M ont un prix ».

**Acceptance Scenarios**:

1. **Given** l'onglet Consommables en Mode communautaire sur Mikhal, **When** le joueur clique sur
   « Charger depuis Huzounet », **Then** les 128 objets sont demandés en tranches de 90 au plus, l'une
   après l'autre, et jamais deux en même temps.
2. **Given** un chargement en cours, **When** une tranche se termine, **Then** la progression affichée
   avance (objets traités sur objets à traiter) et les prix de cette tranche sont visibles dans la liste
   sans attendre la fin.
3. **Given** un chargement terminé où des prix ont changé, **When** il s'achève, **Then** le joueur lit
   combien de prix ont été chargés, et le compteur et les filtres « Sans prix » / « Prix ancien » de
   l'onglet tiennent compte des nouveaux prix.
4. **Given** un chargement terminé où rien n'a changé (tout a été lu il y a moins de deux minutes),
   **When** il s'achève, **Then** le joueur lit que les prix sont déjà à jour.
5. **Given** un filtre actif (recherche, type ou stat, « Sans prix », « Prix ancien »), **When** le joueur
   clique sur le bouton, **Then** seuls les objets que le filtre retient sont demandés, et le libellé du
   bouton annonce ce nombre avant le clic.
6. **Given** chacun des quatre onglets, **When** le joueur l'ouvre, **Then** le bouton y est présent et
   porte sur les objets de cet onglet uniquement.

---

### User Story 2 - Savoir d'où vient un prix (Priority: P1)

Dans la liste, un prix venu de Huzounet se reconnaît : il porte la mention « Huzounet », et une mention de
plus quand sa source le dit provisoire ou ancien. Un prix que le groupe a partagé plus récemment reste
celui affiché.

**Why this priority**: principe III de la constitution — le joueur doit pouvoir expliquer le prix sur
lequel il décide. Sans cette mention, un prix chargé serait pris pour un prix saisi par le groupe.

**Independent Test**: avec une API simulée renvoyant un prix Huzounet seul, un prix Huzounet plus récent
qu'un prix partagé, et un prix partagé plus récent qu'un prix Huzounet, vérifier le montant et la mention
de chaque ligne.

**Acceptance Scenarios**:

1. **Given** un objet que seul Huzounet tarifie, **When** la liste s'affiche en Mode communautaire,
   **Then** la ligne montre ce prix avec la mention « Huzounet », et l'objet compte parmi ceux qui ont un
   prix.
2. **Given** un objet dont le prix Huzounet est plus récent que le dernier prix partagé, **When** la
   liste s'affiche, **Then** la ligne montre le prix Huzounet et sa mention.
3. **Given** un objet dont le dernier prix partagé est plus récent que le prix Huzounet, **When** la
   liste s'affiche, **Then** la ligne montre le prix partagé, sans mention « Huzounet ».
4. **Given** un prix Huzounet que sa source dit provisoire, ou ancien, **When** la ligne s'affiche,
   **Then** elle porte en plus la mention « provisoire », ou « ancien ».
5. **Given** un prix Huzounet affiché, **When** le joueur saisit son propre prix sur la ligne, **Then**
   son prix est partagé comme aujourd'hui et devient celui affiché.

---

### User Story 3 - Arrêter, et comprendre un chargement qui n'aboutit pas (Priority: P2)

Le chargement de l'onglet Ressources dure plusieurs minutes. Le joueur peut l'arrêter, changer d'onglet,
ou se heurter à une source indisponible : dans tous les cas il sait ce qui a été chargé et pourquoi le
reste ne l'a pas été.

**Why this priority**: sans arrêt possible ni message, un chargement long ou en échec laisse le joueur
devant un bouton qui ne répond pas — le défaut même qui a lancé ce chantier sur la page Recherche.

**Independent Test**: avec une API simulée, lancer un chargement de plusieurs tranches, l'arrêter après
la première, et vérifier que la deuxième n'est jamais demandée et que les prix de la première restent
affichés ; puis rejouer avec chaque réponse d'échec et vérifier le message.

**Acceptance Scenarios**:

1. **Given** un chargement en cours, **When** le joueur clique sur « Arrêter », **Then** aucune tranche
   de plus n'est demandée, les prix déjà chargés restent affichés, et le joueur lit combien l'ont été.
2. **Given** un chargement en cours, **When** le joueur change d'onglet, de serveur, de mode ou quitte la
   page, **Then** le chargement s'arrête de la même façon.
3. **Given** une tranche refusée parce qu'une lecture vient d'avoir lieu, **When** le site reçoit ce
   refus, **Then** il attend puis redemande la même tranche, sans intervention du joueur, trois fois au
   plus ; au-delà il s'arrête et propose de réessayer dans quelques secondes.
4. **Given** Huzounet qui ne répond pas, **When** une tranche échoue, **Then** le chargement s'arrête, le
   joueur lit « Huzounet ne répond pas pour le moment » et combien de prix ont été chargés avant.
5. **Given** la lecture de Huzounet désactivée côté API, **When** le joueur clique sur le bouton,
   **Then** il lit que le chargement est indisponible, et rien d'autre ne change sur la page.
6. **Given** le joueur hors ligne ou l'API injoignable, **When** une tranche échoue, **Then** le
   chargement s'arrête avec un message d'échec, et les prix déjà affichés sont conservés.
7. **Given** un chargement arrêté ou en échec, **When** le joueur clique de nouveau sur le bouton,
   **Then** un nouveau chargement démarre ; les objets lus il y a moins de deux minutes ne sont pas
   redemandés à Huzounet.

---

### User Story 4 - Ne proposer le bouton que là où il sert (Priority: P2)

Le bouton n'agit qu'en Mode communautaire et sur un serveur que l'API relit. Ailleurs, le joueur comprend
pourquoi il ne peut pas s'en servir, au lieu de cliquer pour rien.

**Why this priority**: Huzounet n'est relu que pour Mikhal, et les prix chargés sont des prix du mode
communautaire ; un bouton actif partout produirait surtout des refus.

**Independent Test**: afficher la page en Mode personnel, puis en Mode communautaire sur un autre serveur
que Mikhal, et vérifier l'état du bouton et l'explication donnée, sans aucun appel à l'API.

**Acceptance Scenarios**:

1. **Given** le Mode personnel, **When** la page s'affiche, **Then** le bouton est inactif et indique que
   les prix Huzounet se chargent en Mode communautaire ; aucun prix du carnet personnel n'est modifié.
2. **Given** le Mode communautaire sur un serveur autre que Mikhal, **When** la page s'affiche, **Then**
   le bouton est inactif et indique que les prix de ce serveur ne sont pas relus.
3. **Given** un serveur que le site croit relu mais que l'API refuse, **When** le joueur clique,
   **Then** il lit « Les prix de ce serveur ne sont pas relus » et le chargement s'arrête à la première
   tranche.
4. **Given** aucun objet retenu par les filtres, **When** la page s'affiche, **Then** le bouton est
   inactif.

### Edge Cases

- Un objet de l'onglet que Huzounet ne connaît pas : il reste sans prix, sans message d'erreur ; il compte
  dans la progression comme traité.
- Un prix que Huzounet ne soutient plus (contesté, exclu) : l'API retire le prix qu'elle gardait ; la ligne
  retombe sur le dernier prix partagé, ou sur « sans prix ».
- Le joueur clique deux fois de suite sur le bouton : un seul chargement tourne à la fois.
- Deux joueurs chargent le même onglet au même moment : chacun peut recevoir le refus « lecture trop
  récente » ; l'attente puis la reprise automatique de la User Story 3 s'appliquent.
- Le joueur saisit un prix sur une ligne pendant le chargement : sa saisie n'est ni perdue ni écrasée par
  l'arrivée d'une tranche.
- L'onglet Créatures (35 objets) tient en une seule tranche : la progression passe directement à la fin.
- Le filtre change pendant un chargement : le chargement continue sur les objets retenus au moment du
  clic.
- La liste des objets de l'onglet n'a pas pu être chargée (état déjà géré par la page) : le bouton n'est
  pas proposé.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La page HDV DOIT proposer, dans chacun de ses quatre onglets, une action « Charger depuis
  Huzounet » portant sur les objets de l'onglet que les filtres actifs retiennent.
- **FR-002**: Le libellé de l'action DOIT annoncer avant le clic le nombre d'objets concernés.
- **FR-003**: Le chargement DOIT demander les objets par tranches de 90 au plus, l'une après l'autre, en
  laissant au moins cinq secondes entre deux demandes.
- **FR-004**: Pendant un chargement, la page DOIT afficher une progression (objets traités sur objets à
  traiter) et proposer une action « Arrêter ».
- **FR-005**: Les prix d'une tranche DOIVENT apparaître dans la liste, le compteur et les filtres de prix
  dès la fin de cette tranche.
- **FR-006**: À la fin d'un chargement, la page DOIT dire combien de prix ont été chargés, ou que les
  prix sont déjà à jour quand aucun n'a changé.
- **FR-007**: Un arrêt demandé par le joueur, un changement d'onglet, de serveur ou de mode, ou la sortie
  de la page DOIVENT empêcher toute demande supplémentaire, et conserver les prix déjà chargés.
- **FR-008**: Un refus pour lecture trop récente DOIT être suivi d'une attente puis d'une nouvelle
  demande de la même tranche, trois fois au plus par tranche ; au-delà le chargement s'arrête avec le
  message « Réessaie dans quelques secondes ».
- **FR-009**: Tout autre échec (source indisponible, lecture désactivée, serveur non relu, API
  injoignable) DOIT arrêter le chargement avec un message propre à sa cause, sans redemande automatique.
- **FR-010**: Un seul chargement DOIT pouvoir tourner à la fois sur la page.
- **FR-011**: L'action DOIT être inactive, avec la raison lisible, en Mode personnel, sur un serveur non
  relu, et quand aucun objet n'est retenu ; dans ces cas aucune demande n'est envoyée.
- **FR-012**: En Mode communautaire, le prix affiché d'un objet DOIT être le plus récent entre le dernier
  prix partagé par le groupe et le prix lu sur Huzounet, y compris pour un objet que seul Huzounet
  tarifie.
- **FR-013**: Une ligne dont le prix affiché vient de Huzounet DOIT le dire (« Huzounet »), et dire en
  plus « provisoire » ou « ancien » quand la source le signale.
- **FR-014**: Le chargement NE DOIT PAS modifier le carnet du Mode personnel, ni créer de prix partagé au
  nom du joueur.
- **FR-015**: Une saisie en cours sur une ligne NE DOIT PAS être perdue quand une tranche arrive.
- **FR-016**: La fonctionnalité NE DOIT PAS changer les règles de lecture de l'API (taille des tranches
  acceptées, délais, serveurs relus) : elle s'y conforme.

### Key Entities

- **Chargement** : une demande du joueur pour un onglet ; il a une liste d'objets figée au clic, un
  avancement, un nombre de prix chargés et un état (en cours, terminé, arrêté, en échec avec sa cause).
- **Tranche** : un groupe de 90 objets au plus demandés ensemble ; elle réussit, est refusée pour lecture
  trop récente, ou échoue.
- **Prix affiché** : pour un objet et un serveur, le montant montré au joueur, sa date et son origine
  (saisie, capture, bot, ou Huzounet avec une éventuelle mention provisoire ou ancien).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Le joueur charge les prix des onglets Consommables, Créatures et Runes en moins de
  15 secondes chacun, en un seul clic.
- **SC-002**: Le joueur charge les 2 537 objets de l'onglet Ressources en un seul clic et en moins de
  4 minutes, en voyant la progression avancer au moins toutes les 10 secondes.
- **SC-003**: Après un clic sur « Arrêter », plus aucune demande ne part, et 100 % des prix déjà chargés
  restent affichés.
- **SC-004**: Chacune des cinq causes d'échec (lecture trop récente, source indisponible, lecture
  désactivée, serveur non relu, API injoignable) donne un message distinct ; aucune ne laisse le bouton
  sans réponse.
- **SC-005**: Pour 100 % des lignes dont le prix affiché vient de Huzounet, la mention d'origine est
  visible sans action du joueur.
- **SC-006**: En Mode personnel ou sur un serveur non relu, aucune demande de chargement n'est envoyée,
  quel que soit le nombre de clics.
- **SC-007**: Un chargement ne dépasse jamais une demande toutes les cinq secondes vers l'API.

## Assumptions

- Le bouton n'agit qu'en Mode communautaire : les prix de Huzounet sont des prix du groupe, pas des prix
  du carnet personnel. Copier ces prix dans le carnet personnel n'est pas demandé.
- Seul le serveur Mikhal est relu aujourd'hui ; la liste des serveurs relus est connue du site et se
  change au même endroit que dans l'API.
- Charger « l'onglet » signifie charger les objets que les filtres actifs retiennent ; sans filtre, tout
  l'onglet. Cela limite le nombre de lectures faites chez Huzounet à ce que le joueur regarde.
- L'onglet Ressources entier représente environ 29 demandes à l'API et 57 lectures chez Huzounet par
  clic. C'est dans les limites que l'API applique déjà (fonctionnalité 045), mais c'est plus qu'un passage
  de nuit complet : si l'auteur de Huzounet le juge trop lourd, le remède est de plafonner le nombre
  d'objets par chargement, sans changer le reste.
- Les autres écrans perdus (fonctionnalités 032 à 044), dont le bouton d'actualisation de la page
  Recherche, sont hors périmètre ; ce qui est écrit ici pour lire les prix externes est fait pour leur
  resservir.
- Aucun déploiement ne fait partie de la fonctionnalité. Le site en ligne est aujourd'hui une copie de la
  version du 2 octobre : déployer le site du dépôt retirerait les écrans perdus tant qu'ils ne sont pas
  réécrits. La mise en ligne de ce bouton se décidera à part.
