# Feature Specification: Forgemagie privée — chacun ne voit que ses séances

**Révision (specs/049-fm-seances, 2026-10-12)** : le réglage de visibilité a désormais un effet : un profil public apparaît, avec la liste de ses séances, dans l'onglet au nom du groupe ; sessions, captures et runes restent privées.
Voir [specs/049-fm-seances](../049-fm-seances/spec.md).

**Feature Branch**: `030-private-fm-sessions`

**Created**: 2026-09-30

**Status**: Draft

**Input**: User description : « Pour Dofus Craft Forgemagie, je veux que les utilisateurs aient accès
seulement aux séances qui sont à eux. » Précisé ensuite : les profils des autres joueurs sont aussi
masqués ; une séance est « à lui » s'il l'a démarrée ; le réglage « profil public / privé » est
**gardé**, car le porteur du projet veut plus tard afficher publiquement le récap des sommes dépensées
par séance, ou d'autres choses.

## Contexte

Aujourd'hui (specs/025, 027, 028, 029), tout membre connecté à la page Forgemagie voit les séances de
tout le monde (liste, détail, montants, objets achetés), la liste des joueurs publics avec leur total
dépensé, et le profil public des autres joueurs (dépenses, objets en FM, salons, récaps d'objets). Un
joueur peut passer son profil en privé pour se cacher.

Le groupe ne fait pas de FM de groupe : chaque joueur paie la FM de ses propres objets. Les dépenses
de FM sont une affaire personnelle ; le porteur du projet veut que chacun ne voie que les siennes.

Cette spec **amende** :
- specs/025 : FR-006 et FR-014 (profil public par défaut et consultable par les autres), la user story
  « consulter le profil d'un autre joueur » et la liste des séances de tout le groupe ;
- specs/027 : FR-005 (qui peut rattacher une séance à un objet) et l'accès aux récaps d'objets ;
- specs/029 : l'affichage des salons d'un autre joueur sur son profil.

Le bot Discord n'est pas modifié. Les prix des runes (onglet Runes de l'HDV, prix communautaires) ne
sont pas concernés et restent partagés.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ne voir que ses propres séances (Priority: P1)

Cyril ouvre l'onglet Sessions de la page Forgemagie. Il n'y voit que les séances qu'il a démarrées
(par le bouton Discord, par `/fmstart` ou depuis le site), les plus récentes d'abord, avec leurs
montants. Les séances d'Alex n'y figurent pas. Si Cyril ouvre le lien direct d'une séance d'Alex, le
site lui répond « Séance introuvable », exactement comme pour une séance qui n'existe pas.

**Why this priority**: c'est la demande : les dépenses d'un joueur ne regardent que lui.

**Independent Test**: avec deux joueurs ayant chacun une séance, chacun ne voit que la sienne dans la
liste, et l'adresse de la séance de l'autre donne « Séance introuvable ».

**Acceptance Scenarios**:

1. **Given** Cyril a démarré 3 séances et Alex 2, **When** Cyril ouvre l'onglet Sessions, **Then** il
   voit ses 3 séances et aucune de celles d'Alex.
2. **Given** une séance d'Alex, **When** Cyril ouvre son adresse directe, **Then** le site affiche
   « Séance introuvable » et ne révèle ni son montant, ni son salon, ni son existence.
3. **Given** Cyril n'a encore démarré aucune séance, **When** il ouvre l'onglet Sessions, **Then** il
   voit un message qui explique comment en démarrer une (bouton Discord ou « Démarrer une séance »).
4. **Given** une séance de Cyril, **When** il en ouvre le détail, **Then** il voit tout ce qu'il voyait
   jusqu'ici : montant, objets achetés, salon, objet en FM rattaché, et peut l'arrêter, la rattacher
   ou la détacher comme avant.

---

### User Story 2 - Un profil que personne d'autre ne voit (Priority: P1)

L'onglet Profil ne montre plus que le profil de Cyril : ses dépenses, ses objets en FM avec leurs
récaps, ses salons, ses réglages, l'import de captures. La liste des autres joueurs disparaît. Si
Cyril ouvre l'adresse du profil d'Alex, ou le récap d'un objet d'Alex, le site répond « introuvable ».

**Why this priority**: masquer les séances ne sert à rien si le total dépensé et les récaps d'objets
d'un joueur restent visibles sur son profil.

**Independent Test**: avec deux joueurs, chacun ne voit que son profil ; l'adresse du profil ou du
récap d'objet de l'autre donne « introuvable ».

**Acceptance Scenarios**:

1. **Given** Cyril connecté, **When** il ouvre l'onglet Profil, **Then** il voit son propre profil et
   aucune liste ni lien vers d'autres joueurs.
2. **Given** Alex a un profil **public**, **When** Cyril ouvre l'adresse du profil d'Alex, **Then** le
   site répond « Profil introuvable » (public ou privé ne change rien).
3. **Given** un objet en FM d'Alex, **When** Cyril ouvre l'adresse de son récap, **Then** le site
   répond « introuvable ».
4. **Given** Cyril, **When** il regarde ses salons FM, **Then** il ne voit que les siens (specs/029).

---

### User Story 3 - Garder le réglage public / privé pour plus tard (Priority: P3)

Dans ses réglages, Cyril voit toujours le choix « profil public / privé ». Le texte lui dit
honnêtement qu'aujourd'hui personne d'autre ne voit ses séances ni son profil, et que ce réglage
servira quand un affichage public sera ajouté (par exemple le récap des sommes dépensées par séance).
Son choix est enregistré comme avant.

**Why this priority**: le porteur du projet veut rouvrir plus tard un affichage public ; garder le
choix de chacun évite de le redemander, mais rien n'en dépend aujourd'hui.

**Independent Test**: changer le réglage, recharger : le choix est conservé ; le texte n'annonce aucun
effet qui n'existe pas.

**Acceptance Scenarios**:

1. **Given** Cyril en public, **When** il passe en privé puis recharge la page, **Then** le réglage est
   toujours sur privé.
2. **Given** le réglage, **When** Cyril le lit, **Then** le texte ne prétend pas que d'autres joueurs
   voient son profil en public.

---

### Edge Cases

- **Séance sans propriétaire** (par exemple celles d'un joueur qui a supprimé son profil, specs/025
  FR-007) : visible par personne. Aucune séance de ce genre n'existe en production aujourd'hui.
- **Captures d'un autre joueur dans ma séance** (possible seulement dans un salon qui n'est pas un salon
  personnel) : le propriétaire de la séance voit la séance entière, captures comprises, comme avant.
  L'autre joueur, lui, ne voit pas cette séance (elle n'est pas à lui). L'affichage de son nom suit la
  règle existante de specs/025 FR-015 (« Joueur privé » s'il est en privé).
- **Import de captures depuis le site** : on ne peut toujours importer que dans ses propres séances
  ouvertes (specs/028), rien ne change.
- **Rattacher une séance à un objet** : seul le propriétaire de la séance peut la rattacher à l'un de
  ses objets en FM (il est le seul à la voir).
- **Liens déjà partagés** vers une séance ou un profil d'un autre joueur : ils donnent « introuvable ».
- **Déconnecté** : comme aujourd'hui, la page demande de se connecter avec Discord.

## Requirements *(mandatory)*

### Functional Requirements

**Séances**

- **FR-001**: La liste des séances MUST ne contenir que les séances dont le joueur connecté est le
  propriétaire (celui qui l'a démarrée : bouton Discord, `/fmstart` avec auteur, ou depuis le site).
- **FR-002**: Le détail d'une séance dont le joueur connecté n'est pas propriétaire MUST être refusé
  exactement comme une séance inexistante (même réponse, aucune information révélée).
- **FR-003**: Une séance sans propriétaire MUST n'être visible par personne.
- **FR-004**: Seul le propriétaire d'une séance MUST pouvoir la rattacher à l'un de ses objets en FM
  (amende specs/027 FR-005) ; l'arrêt, le renvoi à Discord et le détachement restent réservés au
  propriétaire comme aujourd'hui.

**Profils, objets et salons**

- **FR-005**: Un joueur connecté MUST ne pouvoir consulter que son propre profil ; la liste des autres
  joueurs MUST disparaître de la page.
- **FR-006**: Le profil d'un autre joueur MUST être refusé comme un profil inexistant, qu'il soit public
  ou privé (amende specs/025 FR-014).
- **FR-007**: Le récap d'un objet en FM d'un autre joueur MUST être refusé comme un objet inexistant.
- **FR-008**: Les salons FM d'un autre joueur MUST ne jamais être affichés (amende specs/029).

**Réglage public / privé**

- **FR-009**: Le réglage « profil public / privé » MUST rester disponible et enregistré comme
  aujourd'hui (amende specs/025 FR-006 : il n'a plus d'effet sur la visibilité du profil ni des
  séances).
- **FR-010**: Le texte du réglage MUST indiquer que personne d'autre ne voit aujourd'hui les séances ni
  le profil du joueur, et que le réglage servira à un futur affichage public ; il MUST NOT annoncer un
  effet qui n'existe pas.

**Ce qui ne change pas**

- **FR-011**: Les prix des runes (HDV et prix communautaires) MUST rester visibles par tous, comme
  aujourd'hui.
- **FR-012**: Les montants, les calculs et le contenu d'une séance vue par son propriétaire MUST rester
  identiques à aujourd'hui.

### Key Entities

- **Séance FM** : a un propriétaire (le joueur qui l'a démarrée) ; seule entité dont la visibilité
  change. Aucune nouvelle donnée n'est stockée.
- **Profil de joueur** : garde son réglage public / privé, désormais sans effet sur la visibilité.
- **Objet en FM, salon FM** : visibles par leur seul propriétaire.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Avec deux joueurs ayant chacun des séances, 0 séance, profil, récap d'objet ou salon de
  l'un n'est accessible à l'autre, que ce soit par la page ou par une adresse directe.
- **SC-002**: Un joueur retrouve 100 % de ses propres séances, avec les mêmes montants qu'avant le
  changement.
- **SC-003**: Une séance ou un profil d'un autre joueur et une séance ou un profil inexistant donnent
  une réponse impossible à distinguer.
- **SC-004**: Le choix public / privé d'un joueur est conservé à 100 % après le changement.

## Assumptions

- « Démarrer » une séance est la seule façon d'en être propriétaire ; le propriétaire est déjà connu
  pour toutes les séances existantes (5 en production, toutes avec un propriétaire).
- Pas de FM de groupe : une séance appartient à un seul joueur ; aucun partage de séance n'est prévu.
- Le futur affichage public (récap des sommes par séance ou autre) fera l'objet de sa propre spec ; il
  s'appuiera sur le réglage conservé ici.
- Le bot Discord et ses messages dans Discord ne changent pas : ce qui est posté dans un salon reste
  visible selon les permissions Discord.
