# Feature Specification: Démarrer une session FM depuis le site, synchronisée avec Discord

**Feature Branch**: `028-site-started-sessions`

**Created**: 2026-09-30

**Status**: Draft

**Input**: User description: « Je veux que ça soit possible de démarrer une session à la fois sur le
Discord et sur le site. »

Choix faits par le porteur du projet avant la spec :
- **synchronisé des deux côtés** : démarrer ou arrêter sur le site ouvre ou ferme aussi la session
  dans Discord ; `/fmstart` et `/fmstop` continuent de fonctionner ;
- une session démarrée sur le site se remplit aussi avec les **captures collées sur le site** ;
- au démarrage sur le site, on peut **choisir un objet en FM** (specs/027), facultatif.

## Clarifications

### Session 2026-09-30

- Précision du porteur du projet : aujourd'hui, un joueur peut avoir **plusieurs sessions en cours**,
  et une session est **liée à un salon Discord**. → Pas de limite d'une session par joueur ; une
  session ouverte par salon, comme dans le bot.
- Q: Dans quel salon le bot ouvre-t-il une session démarrée sur le site ? → A: Le joueur choisit le
  salon à chaque démarrage, parmi les salons que le bot a déjà utilisés, sans session ouverte.

## Contexte

Aujourd'hui, une session FM ne s'ouvre que par `/fmstart` dans un salon Discord : le bot l'annonce,
lit les captures postées, et envoie tout au site (specs/025). Sur le site, on ne peut que consulter.
Les captures collées sur le site (specs/025 US5) sont enregistrées « hors session ».

Le groupe veut pouvoir lancer et arrêter sa séance de FM depuis le site aussi, sans que Discord et le
site se contredisent : une seule session, ouverte ou fermée des deux côtés.

**Contrainte** : le bot tourne dans un hébergement qui n'accepte pas de connexion entrante. Le site
ne peut donc pas le prévenir directement : c'est le bot qui vient demander au site, à intervalle
régulier, s'il y a des sessions à ouvrir ou à fermer, puis confirme ce qu'il a fait. Le bot doit être
modifié par son auteur.

Il n'y a pas de FM de groupe : une session appartient à un joueur.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Démarrer une session depuis le site (Priority: P1)

Un joueur connecté, sur la page Forgemagie, clique sur « Démarrer une session ». Il choisit le salon
Discord, et peut choisir un de ses objets en FM. La session apparaît aussitôt sur le site, en cours et à son nom, rattachée à l'objet
choisi. Quelques secondes plus tard, le bot l'ouvre dans Discord et l'annonce : les captures postées
ensuite dans ce salon s'y ajoutent, comme après `/fmstart`.

**Why this priority**: c'est la demande ; le reste en dépend.

**Independent Test**: démarrer une session sur le site en choisissant « Rtograf PA » : elle est
listée « En cours », rattachée à Rtograf PA ; le bot (ou sa simulation) récupère la demande, ouvre la
session dans le salon prévu et le confirme ; une capture postée dans ce salon apparaît dans la session.

**Acceptance Scenarios**:

1. **Given** un joueur connecté, **When** il démarre une session sur le site dans un salon sans
   session ouverte, **Then** la session est créée « En cours », à son nom, liée à ce salon, et indique
   qu'elle attend l'ouverture dans Discord.
2. **Given** un objet en FM choisi au démarrage, **When** la session est créée, **Then** elle est
   rattachée à cet objet (specs/027) sans autre action.
3. **Given** une session démarrée sur le site, **When** le bot récupère la demande et l'exécute,
   **Then** le bot l'annonce dans le salon, le site indique qu'elle est ouverte dans Discord, et les
   captures postées ensuite dans ce salon s'ajoutent à cette même session.
4. **Given** un joueur qui a déjà une session ouverte dans un salon, **When** il en démarre une autre
   dans un autre salon, **Then** les deux sessions sont en cours en même temps.
5. **Given** un salon qui a déjà une session ouverte (démarrée sur le site ou dans Discord), **When**
   le joueur veut y démarrer une session, **Then** ce salon n'est pas proposé, ou le démarrage est
   refusé avec un message clair, sans rien écraser.

---

### User Story 2 - Arrêter une session depuis le site (Priority: P1)

Le joueur arrête sa session en cours depuis le site. Elle passe « Terminée » sur le site, et le bot la
ferme dans Discord en publiant son résumé, comme après `/fmstop`.

**Why this priority**: sans arrêt synchronisé, la session resterait ouverte dans Discord et
continuerait de compter des captures.

**Independent Test**: arrêter sur le site une session ouverte : elle passe « Terminée » ; le bot
récupère la demande, publie le résumé dans le salon et confirme ; une capture postée ensuite n'est
plus comptée dans cette session.

**Acceptance Scenarios**:

1. **Given** une session ouverte du joueur (démarrée sur le site ou par `/fmstart`), **When** il
   l'arrête sur le site, **Then** elle passe « Terminée » sur le site aussitôt.
2. **Given** une session arrêtée sur le site, **When** le bot récupère la demande, **Then** il ferme
   la session dans Discord et publie son résumé.
3. **Given** une session arrêtée sur le site, **When** une capture est postée dans le salon avant que
   le bot ait récupéré la demande, **Then** cette capture n'est pas ajoutée à la session terminée.
4. **Given** une session d'un autre joueur, **When** le joueur la consulte, **Then** il ne peut pas
   l'arrêter.

---

### User Story 3 - Ajouter les captures du site à la session en cours (Priority: P2)

Pendant qu'une session du joueur est ouverte, les captures qu'il colle sur le site peuvent s'ajouter à
cette session, au lieu d'être « hors session ». S'il a plusieurs sessions ouvertes, il choisit
laquelle.

**Why this priority**: permet de faire toute une séance depuis le site ; secondaire, puisque les
captures de Discord remplissent déjà la session.

**Independent Test**: session ouverte, coller une capture sur le site et valider : l'achat apparaît
dans la session (total, détail) et dans le récap de son objet en FM.

**Acceptance Scenarios**:

1. **Given** une seule session ouverte du joueur, **When** il valide l'import d'une capture sur le
   site, **Then** les achats s'ajoutent à cette session, proposée par défaut et indiquée avant la
   validation.
3. **Given** plusieurs sessions ouvertes du joueur, **When** il importe une capture, **Then** il
   choisit la session (ou « hors session ») avant de valider.
2. **Given** aucune session ouverte du joueur, **When** il importe une capture, **Then** elle reste
   « hors session », comme aujourd'hui.

---

### User Story 4 - `/fmstart` et `/fmstop` inchangés (Priority: P1)

Dans Discord, `/fmstart` et `/fmstop` continuent de fonctionner comme aujourd'hui, et se reflètent sur
le site. Une session ouverte par `/fmstart` appartient au joueur qui a tapé la commande, et il peut
l'arrêter depuis le site.

**Why this priority**: « synchronisé des deux côtés » ; rien ne doit régresser pour ceux qui restent
dans Discord.

**Acceptance Scenarios**:

1. **Given** `/fmstart` tapé par un joueur, **When** le site reçoit l'événement, **Then** la session
   apparaît « En cours » à son nom, comme aujourd'hui.
2. **Given** une session démarrée sur le site et ouverte dans Discord, **When** le joueur tape
   `/fmstop` dans le salon, **Then** la session passe « Terminée » sur le site, sans que le bot ne
   reçoive ensuite une demande d'arrêt en double.

---

### Edge Cases

- **Bot éteint ou injoignable** : la session démarrée sur le site est utilisable tout de suite (les
  captures collées sur le site s'y ajoutent) ; elle reste marquée « en attente de Discord » tant que le
  bot n'a pas confirmé. Une demande non confirmée au bout de 10 minutes est affichée comme non
  transmise, et le joueur peut la relancer ou continuer sans Discord.
- **Arrêt demandé avant que le bot ait ouvert la session** : le bot ne l'ouvre pas du tout dans
  Discord (les deux demandes s'annulent) ; la session est terminée sur le site.
- **Demande récupérée deux fois** (le bot relance sa requête) : elle n'est exécutée qu'une fois ; le
  bot confirme par l'identifiant de la demande.
- **Échec du bot** (salon introuvable, droits manquants) : le bot le signale dans sa confirmation ; le
  site affiche que la session n'a pas pu être ouverte dans Discord, et elle reste utilisable depuis le
  site.
- **Remise à zéro** (`/fmreset`) d'une session démarrée sur le site : même effet qu'aujourd'hui.

## Requirements *(mandatory)*

### Functional Requirements

**Démarrer et arrêter depuis le site**

- **FR-001**: Un joueur connecté MUST pouvoir démarrer une session depuis la page Forgemagie, en
  choisissant facultativement un de ses objets en FM, auquel la session est alors rattachée
  (specs/027).
- **FR-002**: Un salon MUST avoir au plus une session ouverte (comme dans le bot) ; un joueur peut
  avoir plusieurs sessions ouvertes, dans des salons différents. Le démarrage dans un salon qui a déjà
  une session ouverte MUST être refusé.
- **FR-003**: Au démarrage sur le site, le joueur MUST choisir le salon Discord parmi les salons que
  le bot a déjà utilisés (connus par ses événements), en excluant ceux qui ont une session ouverte.
- **FR-004**: Le propriétaire d'une session ouverte MUST pouvoir l'arrêter depuis le site ; elle MUST
  passer « Terminée » sur le site immédiatement. Aucun autre joueur ne peut l'arrêter.
- **FR-005**: Une session a un **propriétaire** : le joueur qui l'a démarrée sur le site, ou celui qui
  a tapé `/fmstart`.

**Synchronisation avec le bot**

- **FR-006**: Le système MUST mettre à disposition du bot, protégées par sa clé (specs/025 FR-009),
  les demandes en attente : ouvrir une session (salon, joueur, objet éventuel) et fermer une session.
- **FR-007**: Le bot MUST confirmer chaque demande par son identifiant, avec le résultat (exécutée ou
  échouée, avec la raison) ; une demande confirmée MUST NOT être redonnée ; une même confirmation
  reçue deux fois MUST NOT avoir d'effet de plus.
- **FR-008**: Une ouverture exécutée par le bot MUST rattacher la session Discord à la session du site
  (même session, pas une seconde) : les captures postées ensuite dans le salon s'y ajoutent.
- **FR-009**: Une session fermée sur le site MUST NOT recevoir de nouvelles captures, même si le bot
  n'a pas encore exécuté la fermeture.
- **FR-010**: Une ouverture et une fermeture de la même session toutes deux en attente MUST s'annuler :
  le bot n'ouvre rien.
- **FR-011**: Le site MUST afficher l'état de synchronisation d'une session démarrée sur le site :
  « en attente de Discord », « ouverte dans Discord », « non transmise » (pas de confirmation après
  10 minutes) ou « échec » avec la raison donnée par le bot.
- **FR-012**: `/fmstart`, `/fmstop` et `/fmreset` MUST continuer de fonctionner comme dans specs/025 ;
  une fermeture par `/fmstop` d'une session démarrée sur le site MUST annuler toute demande de
  fermeture encore en attente pour elle.

**Captures du site**

- **FR-013**: Quand le joueur a au moins une session ouverte, l'import d'une capture sur le site
  (specs/025 US5) MUST lui proposer d'ajouter les achats à une de ses sessions ouvertes (la seule par
  défaut s'il n'y en a qu'une) ou de les garder « hors session » ; le choix MUST être visible avant la
  validation. Sans session ouverte, l'import reste « hors session ».

**Bot**

- **FR-014**: Le fonctionnement attendu du bot (récupérer les demandes à intervalle régulier, les
  exécuter, les confirmer, et envoyer le joueur de `/fmstart`) MUST être documenté pour son auteur,
  en complément du contrat de specs/025.

### Key Entities

- **Session FM** (specs/025) : gagne un **propriétaire** et une **origine** (site ou Discord), et,
  pour une session du site, un **état de synchronisation**.
- **Demande au bot** : ouvrir ou fermer une session ; identifiant, type, session, salon, date de
  création, état (en attente, exécutée, échouée, annulée), raison d'un échec, date de confirmation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Une session démarrée ou arrêtée sur le site est ouverte ou fermée dans Discord en moins
  de 30 secondes quand le bot fonctionne.
- **SC-002**: Aucune session n'est ouverte deux fois (une sur le site, une dans Discord) pour une même
  demande : 100 % des cas.
- **SC-003**: Aucune capture postée après un arrêt sur le site n'est comptée dans la session arrêtée.
- **SC-004**: Un joueur démarre une session depuis le site en moins de 15 secondes (deux clics, plus
  le choix facultatif d'un objet).

## Assumptions

- Le bot interroge le site toutes les 5 à 10 secondes ; il garde son propre état de session comme
  aujourd'hui (`data.json`) et l'aligne sur les demandes qu'il exécute.
- Le contrat du bot (specs/025, `contracts/fm-bot-api.md`) évolue sans rien casser : l'événement
  `session-start` gagne un champ `author` (le joueur qui a tapé `/fmstart`) ; un bot pas encore mis à
  jour continue de fonctionner, ses sessions n'ayant simplement pas de propriétaire.
- Un salon « connu » est un salon d'où le bot a déjà envoyé au moins un événement ; un nouveau salon
  s'utilise d'abord une fois avec `/fmstart`.
- Un joueur sans session ouverte n'a rien à arrêter ; les sessions sans propriétaire (anciennes, ou
  d'un bot non mis à jour) ne peuvent être arrêtées que depuis Discord.
- Pas de FM de groupe : le propriétaire d'une session est celui qui y fait sa FM.
