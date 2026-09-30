# Feature Specification: Salons FM personnels créés par le bot

**Feature Branch**: `029-channel-ownership`

**Created**: 2026-09-30

**Revised**: 2026-09-30 — remplace la première version (« le salon appartient au premier joueur qui
l'a utilisé »), jamais implémentée, par la deuxième solution proposée par le porteur du projet.

**Status**: Draft

**Input**: User description : « Je ne veux pas que quelqu'un puisse rentrer des infos de prix dans mon
salon. » Puis, deuxième solution : « Mettre un salon accessible à tous qui permettra de démarrer une
nouvelle séance de forgemagie : ça crée automatiquement un salon textuel accessible uniquement au bot
et à la personne qui l'a créé. Dedans, l'utilisateur pourra faire ses /fmstart, /fmstop, etc., avec une
limite de 5 salons par utilisateur pour éviter l'abus. »

## Clarifications

### Session 2026-09-30

- Le joueur **nomme son salon librement** (pas un nom d'objet : une faute de frappe ne correspondrait
  à rien sur le site).
- La création d'un salon **démarre automatiquement une session**.
- Un salon se clôture avec **`/fmarchive`** : il est archivé (lecture seule), pas supprimé ; la limite
  de **5** porte sur les salons actifs ; archivage automatique après une période d'inactivité.
- Le salon d'accueil est **en lecture seule**, avec un **bouton** « Nouvelle séance de FM » au lieu
  d'une commande ; le bot répond par un **message éphémère** (visible par le seul joueur).
- Le site est branché : « Démarrer une séance » y crée aussi un salon ; le bot indique au site qui a
  créé chaque salon.
- Un **salon entier peut être rattaché à un objet en FM** sur le site : toutes ses sessions, passées et
  futures, comptent alors pour cet objet.

## Contexte

Aujourd'hui (specs/025, 027, 028), les sessions FM vivent dans des salons Discord ordinaires : n'importe
qui peut y poster, et depuis le site n'importe quel membre peut démarrer une session dans le salon d'un
autre, y importer ses captures ou la rattacher à son objet. Il n'y a pas de FM de groupe : chaque joueur
fait sa FM seul.

Avec des **salons personnels**, créés par le bot et visibles seulement par leur propriétaire et le bot,
les permissions Discord empêchent quiconque d'y poster, et le site sait à qui appartient chaque salon.

Cette spec **remplace** la règle de specs/028 FR-003 (choisir un salon connu au démarrage) et
**étend** specs/027 (rattachement par salon). Les modifications du bot sont faites par son auteur.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Créer son salon FM depuis Discord (Priority: P1)

Dans le salon d'accueil (lecture seule), Cyril clique sur « ➕ Nouvelle séance de FM ». Une petite
fenêtre lui demande le nom du salon ; il tape « mon rtograf ». Le bot crée `#fm-cyril-mon-rtograf` dans
la catégorie Forgemagie, visible seulement par Cyril et le bot, y démarre une session, et répond à Cyril
par un message éphémère avec le lien. Cyril y poste ses captures ; `/fmstop`, `/fmstart`, `/fmreset`,
`/fmtotal` y fonctionnent comme aujourd'hui.

**Why this priority**: c'est le cœur de la solution : un salon à soi, protégé par Discord.

**Independent Test**: cliquer sur le bouton, saisir un nom : le salon est créé, invisible pour un autre
membre, une session y est ouverte, et la session apparaît sur le site au nom de Cyril.

**Acceptance Scenarios**:

1. **Given** le salon d'accueil, **When** un membre veut y écrire, **Then** il ne peut pas : seul le
   bouton est utilisable.
2. **Given** un joueur qui a moins de 5 salons FM actifs, **When** il clique sur le bouton et saisit un
   nom, **Then** le bot crée le salon (nom nettoyé, préfixé par son pseudo), lui en donne l'accès à lui
   seul (et au bot), y ouvre une session et lui répond par un message éphémère avec le lien.
3. **Given** un autre membre du serveur, **When** il parcourt les salons, **Then** il ne voit pas le
   salon de Cyril.
4. **Given** un joueur qui a déjà 5 salons actifs, **When** il clique sur le bouton, **Then** le bot lui
   répond par un message éphémère qu'il a atteint la limite et qu'il peut en archiver un avec
   `/fmarchive`.
5. **Given** un nom vide ou trop long (plus de 30 caractères), **When** le joueur valide, **Then** le
   bot le refuse avec un message éphémère, sans rien créer.
6. **Given** le bot redémarre, **When** un joueur clique sur le bouton, **Then** le bouton fonctionne
   toujours.

---

### User Story 2 - Archiver un salon (Priority: P1)

Quand la FM d'un objet est finie, Cyril tape `/fmarchive` dans son salon. La session en cours est
fermée (avec son résumé), le salon passe en lecture seule dans la catégorie « Archives FM », et une
place se libère.

**Why this priority**: sans archivage, la limite de 5 bloque vite le joueur.

**Acceptance Scenarios**:

1. **Given** un salon actif de Cyril avec une session ouverte, **When** il tape `/fmarchive`, **Then**
   la session est fermée comme par `/fmstop`, le salon devient lecture seule pour lui, part dans les
   archives, et ne compte plus dans sa limite.
2. **Given** un salon sans activité (ni capture ni commande) depuis 14 jours, **When** le bot le
   constate, **Then** il l'archive de la même façon et le signale dans le salon.
3. **Given** un salon archivé, **When** le site l'affiche, **Then** ses sessions restent consultables et
   comptent toujours dans les récaps.
4. **Given** `/fmarchive` tapé ailleurs que dans un salon FM personnel, ou par quelqu'un d'autre que son
   propriétaire, **When** le bot le reçoit, **Then** il refuse sans rien faire.

---

### User Story 3 - Créer son salon depuis le site (Priority: P2)

Sur la page Forgemagie, « Démarrer une séance » demande un nom de salon (et, facultativement, un objet
en FM). Le site transmet la demande au bot, qui crée le salon comme depuis Discord et y ouvre la
session ; le site l'affiche aussitôt « en attente de Discord », puis « ouverte dans Discord ».

**Why this priority**: « synchronisé des deux côtés » (specs/028) ; remplace le choix d'un salon existant.

**Acceptance Scenarios**:

1. **Given** un joueur connecté avec moins de 5 salons actifs, **When** il démarre une séance depuis le
   site en nommant son salon, **Then** la session apparaît sur le site, et le bot crée le salon et y
   ouvre la session dans les secondes qui suivent.
2. **Given** un joueur avec déjà 5 salons actifs, **When** il démarre une séance depuis le site, **Then**
   le site refuse avec le même message que le bot.
3. **Given** un de ses salons actifs, **When** le joueur démarre une session depuis le site dans ce salon
   (au lieu d'en créer un), **Then** cela fonctionne comme dans specs/028 ; les salons des autres ne lui
   sont jamais proposés.

---

### User Story 4 - Rattacher un salon entier à un objet en FM (Priority: P2)

Sur le site, Cyril rattache son salon `#fm-cyril-mon-rtograf` à son objet « Rtograf PA » (choisi dans sa
liste, donc sans faute). Toutes les sessions de ce salon, passées et futures, comptent alors pour cet
objet, y compris celles lancées par `/fmstart`.

**Why this priority**: évite de rattacher chaque session à la main (le salon ne porte pas le nom de
l'objet, choix du porteur du projet).

**Acceptance Scenarios**:

1. **Given** un salon de Cyril avec deux sessions non rattachées, **When** il rattache le salon à
   « Rtograf PA », **Then** les deux sessions comptent pour cet objet, et son récap les liste.
2. **Given** un salon rattaché, **When** une nouvelle session y est ouverte (Discord ou site), **Then**
   elle compte pour l'objet sans action.
3. **Given** un salon rattaché, **When** Cyril le détache, **Then** ses sessions ne comptent plus pour
   l'objet (sauf celles rattachées une à une, qui restent rattachées).
4. **Given** le salon d'un autre joueur, **When** Cyril consulte le site, **Then** il ne peut pas le
   rattacher.

---

### Edge Cases

- **Joueur qui quitte le serveur Discord** : ses salons actifs sont archivés.
- **Salon supprimé à la main dans Discord** : le bot le signale au site ; ses sessions restent sur le
  site ; il ne compte plus dans la limite.
- **Anciens salons ordinaires** (avant cette fonctionnalité) : leurs sessions restent sur le site ; ils
  n'ont pas de propriétaire et ne sont plus proposés au démarrage depuis le site.
- **Deux clics rapides sur le bouton** : un seul salon est créé par saisie validée ; la limite reste
  respectée.
- **Nom déjà pris par un autre salon du joueur** : le bot ajoute un numéro (`-2`).
- **Nom avec caractères interdits** : nettoyés (minuscules, espaces → tirets, accents retirés si besoin,
  caractères non autorisés supprimés) ; un nom vide après nettoyage est refusé.
- **Administrateurs du serveur** : ils voient les salons FM selon leurs droits Discord habituels ; le bot
  ne leur retire rien.

## Requirements *(mandatory)*

### Functional Requirements

**Discord (bot, modifié par son auteur)**

- **FR-001**: Le bot MUST publier dans un salon d'accueil en lecture seule un message fixe avec un bouton
  « Nouvelle séance de FM », qui reste fonctionnel après un redémarrage du bot.
- **FR-002**: Le bouton MUST ouvrir une fenêtre demandant le nom du salon (1 à 30 caractères) ; à la
  validation, le bot MUST créer un salon textuel dans la catégorie Forgemagie, nommé d'après la saisie
  nettoyée et le pseudo du joueur, visible et utilisable uniquement par le joueur et le bot, y ouvrir une
  session, et répondre au joueur par un message éphémère contenant le lien.
- **FR-003**: Un joueur MUST avoir au plus 5 salons FM actifs ; au-delà, la création MUST être refusée
  avec un message indiquant `/fmarchive`.
- **FR-004**: `/fmarchive`, tapé par le propriétaire dans son salon, MUST fermer la session ouverte (comme
  `/fmstop`), rendre le salon lecture seule, le déplacer dans « Archives FM » et le retirer du décompte.
- **FR-005**: Un salon actif sans capture ni commande depuis 14 jours MUST être archivé automatiquement
  de la même façon, avec un message dans le salon.
- **FR-006**: `/fmstart`, `/fmstop`, `/fmreset`, `/fmtotal` et les captures MUST fonctionner dans un salon
  FM personnel comme aujourd'hui.
- **FR-007**: Le bot MUST informer le site de la création d'un salon (identifiant, nom, propriétaire), de
  son archivage et de sa suppression.

**Site**

- **FR-008**: Le site MUST connaître pour chaque salon FM personnel son propriétaire et son état (actif,
  archivé, supprimé).
- **FR-009**: « Démarrer une séance » sur le site MUST permettre soit de créer un nouveau salon (nom
  libre, 1 à 30 caractères), soit de démarrer une session dans un de ses salons actifs ; la création
  MUST respecter la limite de 5 salons actifs. *(remplace specs/028 FR-003)*
- **FR-010**: Le site MUST NOT proposer ni accepter un démarrage de session dans le salon d'un autre
  joueur, ni dans un salon archivé ou ancien (sans propriétaire).
- **FR-011**: Le propriétaire d'un salon MUST pouvoir le rattacher à un de ses objets en FM et l'en
  détacher ; les sessions d'un salon rattaché comptent pour cet objet, passées et futures, dans le récap
  (specs/027). *(étend specs/027)*
- **FR-012**: Une session rattachée à la main à un objet (specs/027) MUST garder ce rattachement même si
  son salon est rattaché à un autre objet ou détaché.
- **FR-013**: Le site MUST afficher, dans le Profil, les salons FM du joueur (actifs et archivés), avec
  l'objet auquel chacun est rattaché.

### Key Entities

- **Salon FM personnel** : identifiant Discord, nom, propriétaire, état (actif, archivé, supprimé),
  objet en FM rattaché (facultatif), date de création, date de dernière activité.
- **Demande au bot** (specs/028) : gagne le type « créer un salon » (nom demandé, joueur, objet
  facultatif).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un joueur crée son salon FM et commence à y poster en moins de 30 secondes.
- **SC-002**: Aucun autre membre ne peut voir ni écrire dans le salon FM d'un joueur (hors
  administrateurs du serveur selon leurs droits Discord).
- **SC-003**: Aucun joueur ne dépasse 5 salons FM actifs.
- **SC-004**: Après le rattachement d'un salon à un objet, 100 % de ses sessions comptent dans le récap
  de cet objet.

## Assumptions

- Le bot a le droit « Gérer les salons » sur le serveur, et l'administrateur a créé (ou laisse le bot
  créer) les catégories « Forgemagie » et « Archives FM » et le salon d'accueil.
- Le délai d'archivage automatique est de 14 jours, réglable côté bot.
- Pas de FM de groupe : un salon FM personnel n'est jamais partagé.
- La première version de cette spec (propriétaire = premier joueur à utiliser un salon) est abandonnée.
