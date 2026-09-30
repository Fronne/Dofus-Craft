# Feature Specification: Propriétaire d'un salon Discord sur le site

**Feature Branch**: `029-channel-ownership`

**Created**: 2026-09-30

**Status**: Draft

**Input**: User description: « Je ne veux pas que quelqu'un puisse rentrer des infos de prix dans mon
salon. »

Choix faits par le porteur du projet avant la spec :
- un salon appartient au **premier joueur qui l'a utilisé** ;
- les captures postées **dans Discord** par d'autres joueurs continuent de compter comme aujourd'hui :
  qui peut poster dans un salon se règle avec les permissions Discord.

## Contexte

Depuis specs/028, un joueur peut démarrer une session depuis le site dans n'importe quel salon que le
bot a déjà utilisé, s'il est libre. Il en devient le propriétaire. Un autre membre peut donc :

1. démarrer depuis le site une session dans le salon d'un joueur ;
2. y importer ses propres captures depuis le site ;
3. la rattacher, dès le démarrage, à un de ses objets en FM (specs/027) — si le joueur habituel du
   salon poste ensuite ses captures dans Discord, ses dépenses finissent dans le récap de l'objet d'un
   autre.

Il n'y a pas de FM de groupe : chaque joueur fait sa FM dans ses propres sessions. Le site doit donc
réserver le démarrage depuis le site au joueur à qui le salon appartient.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Seul le propriétaire d'un salon y démarre une session depuis le site (Priority: P1)

Cyril fait sa FM dans le salon `#fm-cyril`, qu'il a été le premier à utiliser. Quand Bob démarre une
session depuis le site, `#fm-cyril` ne lui est pas proposé, et une tentative directe est refusée.
Cyril, lui, peut toujours y démarrer ses sessions depuis le site.

**Why this priority**: c'est la demande : personne d'autre ne peut ouvrir de session depuis le site
dans le salon d'un joueur, donc ni y importer ses captures ni y rattacher son objet.

**Independent Test**: `#fm-cyril` a été utilisé d'abord par Cyril ; avec le compte de Bob, la liste
des salons au démarrage ne contient pas `#fm-cyril`, et un démarrage forcé dans ce salon est refusé ;
avec le compte de Cyril, le démarrage réussit.

**Acceptance Scenarios**:

1. **Given** un salon qui appartient à Cyril, **When** Bob ouvre le formulaire de démarrage, **Then**
   ce salon n'est pas proposé.
2. **Given** le même salon, **When** Bob tente quand même d'y démarrer une session, **Then** le site
   refuse avec un message clair (« Ce salon appartient à un autre joueur ») et rien n'est créé : ni
   session, ni demande au bot.
3. **Given** le même salon, **When** Cyril y démarre une session depuis le site, **Then** elle est
   créée comme dans specs/028.
4. **Given** un salon connu qui n'appartient encore à personne, **When** un joueur y démarre une
   session depuis le site, **Then** le salon lui appartient désormais.
5. **Given** la liste des salons au démarrage, **When** un joueur l'ouvre, **Then** elle ne montre que
   ses salons et les salons sans propriétaire, et indique lesquels sont à lui.

---

### User Story 2 - Le propriétaire d'un salon est le premier à l'avoir utilisé (Priority: P1)

Le premier joueur qui lance une session dans un salon — par `/fmstart` (quand le bot indique qui a
tapé la commande) ou depuis le site — en devient le propriétaire, sans rien régler. Pour les salons
déjà utilisés avant cette fonctionnalité, le site retrouve ce premier joueur à partir de l'historique.

**Why this priority**: sans propriétaire, la règle d'US1 ne s'applique à rien.

**Independent Test**: dans un salon jamais utilisé, Cyril tape `/fmstart` : le salon est à lui ; Bob
tape ensuite `/fmstart` dans le même salon : le salon reste à Cyril.

**Acceptance Scenarios**:

1. **Given** un salon jamais utilisé, **When** Cyril y lance la première session (Discord ou site),
   **Then** le salon lui appartient.
2. **Given** un salon qui appartient à Cyril, **When** Bob tape `/fmstart` dans ce salon, **Then** la
   session de Bob fonctionne comme aujourd'hui dans Discord, mais le salon reste à Cyril.
3. **Given** un salon utilisé avant cette fonctionnalité, **When** le site détermine son propriétaire,
   **Then** c'est le joueur de la première session qui avait un propriétaire, sinon le premier joueur
   à y avoir posté une capture ; à défaut, le salon n'a pas de propriétaire.
4. **Given** un salon sans aucune session connue d'un joueur (anciennes sessions sans auteur ni
   capture), **When** un joueur y démarre une session depuis le site, **Then** il en devient le
   propriétaire (US1, scénario 4).

---

### Edge Cases

- **Le propriétaire supprime son profil** (specs/025, FR-007) : ses salons n'appartiennent plus à
  personne ; le prochain joueur qui y démarre une session depuis le site ou y lance la première
  session par `/fmstart` en devient propriétaire.
- **Session en cours dans le salon d'un autre, démarrée avant cette fonctionnalité** : elle continue
  normalement ; seules les nouvelles sessions démarrées depuis le site sont concernées.
- **Captures postées dans Discord par un autre joueur** dans mon salon : elles comptent comme
  aujourd'hui, à son nom (choix du porteur du projet) ; les permissions Discord du salon règlent qui
  peut y poster.
- **Rattacher une session à un objet** (specs/027) : la règle actuelle suffit (seul un joueur qui a
  dépensé dans la session peut la rattacher à ses objets) ; le rattachement au démarrage (specs/028)
  n'est possible que dans ses propres salons, donc pour ses propres sessions.
- **Deux joueurs démarrent en même temps dans un salon sans propriétaire** : le premier enregistré
  l'emporte ; l'autre reçoit le refus d'US1, scénario 2.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Chaque salon connu MUST avoir au plus un propriétaire : le premier joueur qui y a lancé
  une session dont on connaît le joueur (par `/fmstart` avec auteur, ou depuis le site), ou, tant
  qu'aucun ne l'a fait, le premier joueur à y avoir posté une capture. Une fois fixé, il ne change
  plus (sauf FR-007).
- **FR-002**: Le propriétaire d'un salon MUST NOT changer quand un autre joueur y lance une session
  par `/fmstart`.
- **FR-003**: Pour les salons utilisés avant cette fonctionnalité, le propriétaire MUST être déduit de
  l'historique : joueur de la première session qui a un propriétaire, sinon premier joueur ayant posté
  une capture dans ce salon ; sinon aucun.
- **FR-004**: Le démarrage d'une session depuis le site (specs/028) MUST être refusé dans un salon qui
  appartient à un autre joueur, sans créer de session ni de demande au bot. *(amende specs/028 FR-001,
  FR-003)*
- **FR-005**: Un démarrage depuis le site dans un salon sans propriétaire MUST en faire le propriétaire
  du joueur qui démarre.
- **FR-006**: La liste des salons proposée au démarrage MUST ne contenir que les salons du joueur et
  les salons sans propriétaire, en distinguant les deux. *(amende specs/028 FR-003)*
- **FR-007**: La suppression d'un profil (specs/025, FR-007) MUST rendre ses salons sans propriétaire.
- **FR-008**: `/fmstart`, `/fmstop`, `/fmreset` et les captures postées dans Discord MUST continuer de
  fonctionner comme aujourd'hui, quel que soit le propriétaire du salon.

### Key Entities

- **Salon** : un salon Discord connu du site (déjà utilisé par le bot), avec son nom et, désormais,
  son **propriétaire** (un joueur, ou personne).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100 % des tentatives de démarrer depuis le site une session dans le salon d'un autre
  joueur sont refusées, sans aucune trace (ni session, ni demande au bot).
- **SC-002**: Un joueur voit dans la liste de démarrage tous ses salons, et aucun salon d'un autre
  joueur.
- **SC-003**: Après la mise en ligne, chaque salon déjà utilisé a le propriétaire attendu d'après
  l'historique (vérifiable sur la base actuelle).

## Assumptions

- Pas de FM de groupe : un salon sert à un seul joueur ; le partage ou le transfert d'un salon est
  hors périmètre (un joueur peut supprimer son profil pour libérer ses salons, cas limite).
- Aucun réglage manuel des salons n'est ajouté (réclamer, libérer, renommer) : hors périmètre.
- Aucun changement du bot n'est nécessaire au-delà de specs/028 (auteur de `/fmstart`) ; sans cet
  auteur, un salon utilisé seulement par `/fmstart` prend comme propriétaire le premier joueur qui y
  poste une capture.
