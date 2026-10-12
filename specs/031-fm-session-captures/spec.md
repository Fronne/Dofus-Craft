# Feature Specification: Captures d'une séance FM et rattachement d'objet par son nom

**Révision (specs/049-fm-seances, 2026-10-12)** : les captures sont rangées par session dans le détail de la séance, peuvent être corrigées, et l'objet se choisit par son nom au niveau de la séance.
Voir [specs/049-fm-seances](../049-fm-seances/spec.md).

**Feature Branch**: `031-fm-session-captures` (développée sur `claude/charming-goodall-wv8us5`)

**Created**: 2026-09-30

**Status**: Draft

**Input**: User description : « Pour la page forgemagie, pour chaque session il faut mettre l'ocr
dedans avec le récap des runes pour chaque ocr. On peut rattacher un objet directement dans la
session en tapant son nom. »

## Contexte

Le détail d'une séance FM (specs/025, 027, 028, 030) affiche aujourd'hui le total, la dépense par
joueur et un tableau **« Achats »** qui cumule toutes les runes de la séance. Mais une séance est
faite de plusieurs **captures** du chat du jeu, lues par OCR : celles postées dans Discord et lues
par le bot, et celles importées sur le site. Le site garde déjà, pour chaque capture, les lignes
d'achat lues (objet, quantité, total), mais ne les montre pas : impossible de savoir quelle capture a
apporté quelles runes, ni de repérer une capture mal lue.

Par ailleurs, pour rattacher une séance à un objet (specs/027), il faut d'abord créer l'objet en FM
sur son profil, puis revenir au détail de la séance et le choisir dans une liste déroulante. Le
porteur du projet veut pouvoir rattacher l'objet **directement depuis la séance, en tapant son nom**.

Cette spec **amende** specs/027 (FR-005 à FR-007 : la manière de rattacher une séance) et complète le
détail de séance de specs/025 (US2). Le bot Discord n'est pas modifié. Les règles de visibilité de
specs/030 (chacun ne voit que ses séances) s'appliquent inchangées.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Voir chaque capture de la séance avec le récap de ses runes (Priority: P1)

Cyril ouvre le détail d'une de ses séances. Sous le récap global, une section **« Captures »** liste
chaque capture lue pendant la séance, de la plus ancienne à la plus récente : sa date et heure, qui
l'a postée, sa provenance (Discord ou site), son montant, et le récap de ce qu'elle contient — pour
chaque rune (ou autre objet) lue : la quantité, le total payé et le prix unitaire.

**Why this priority**: c'est la première demande ; elle rend chaque montant de la séance traçable
jusqu'à la capture qui l'a apporté.

**Independent Test**: une séance avec deux captures, l'une avec « 10 x [Rune Do Air] (15 868 kamas) »
et l'autre avec « 5 x [Rune Pa Ga] (40 000 kamas) » : le détail affiche deux captures, chacune avec sa
ligne, et le récap global cumule les deux.

**Acceptance Scenarios**:

1. **Given** une séance avec 3 captures, **When** Cyril ouvre son détail, **Then** il voit les
   3 captures, dans l'ordre où elles ont été lues, chacune avec sa date et heure, son auteur, sa
   provenance (« Discord » ou « Site ») et son montant.
2. **Given** une capture qui contient « 10 x [Rune Do Air] (15 868 kamas) » et « 1 x [Rune Pa Ga]
   (8 000 kamas) », **When** son récap est affiché, **Then** il montre deux lignes : Rune Do Air, 10,
   15 868 kamas, 1 587 kamas/u ; Rune Pa Ga, 1, 8 000 kamas, 8 000 kamas/u.
3. **Given** une capture qui contient deux fois la même rune (deux lots achetés), **When** son récap
   est affiché, **Then** la rune apparaît sur une seule ligne, avec la somme des quantités et des
   totaux, et le prix moyen (total ÷ quantité, arrondi au kama).
4. **Given** une séance, **When** on additionne les montants de ses captures, **Then** on obtient le
   total de la séance, et la somme des récaps des captures donne le tableau « Achats » global.
5. **Given** une séance sans aucune capture, **When** Cyril ouvre son détail, **Then** la section
   « Captures » indique qu'aucune capture n'a encore été lue.
6. **Given** une séance ouverte, **When** le bot y ajoute une capture, **Then** elle apparaît dans le
   détail à sa prochaine ouverture (ou au prochain rafraîchissement déjà prévu par specs/028).

---

### User Story 2 - Rattacher un objet à la séance en tapant son nom (Priority: P1)

Dans le détail d'une séance non rattachée, Cyril tape « rtog » dans un champ de recherche. Le site lui
propose d'abord ses objets en FM qui correspondent (« Rtograf PA »), puis les équipements du
catalogue qui correspondent (« Anneau Rtograf »). S'il choisit un de ses objets, la séance y est
rattachée. S'il choisit un équipement du catalogue, le site crée l'objet en FM correspondant sur son
profil et y rattache la séance, en une seule action.

**Why this priority**: seconde demande ; supprime l'aller-retour obligatoire par le profil.

**Independent Test**: sans aucun objet en FM, ouvrir une séance, taper « Anneau Rtograf », choisir
l'équipement : la séance indique « Objet : Anneau Rtograf », et le profil liste désormais cet objet
avec 1 séance.

**Acceptance Scenarios**:

1. **Given** Cyril a l'objet en FM « Rtograf PA » (Anneau Rtograf), **When** il tape « rtog » dans le
   détail d'une séance non rattachée, **Then** « Rtograf PA » est proposé en premier, puis l'équipement
   « Anneau Rtograf » du catalogue.
2. **Given** la proposition « Rtograf PA », **When** Cyril la choisit, **Then** la séance est rattachée
   à cet objet, sans créer de nouvel objet.
3. **Given** aucun objet en FM ne correspond, **When** Cyril choisit l'équipement « Coiffe Bouftou »
   du catalogue, **Then** un objet en FM « Coiffe Bouftou » est créé sur son profil et la séance y est
   rattachée ; le détail l'indique.
4. **Given** moins de 2 caractères tapés, **When** Cyril tape, **Then** aucune proposition n'est
   affichée.
5. **Given** un nom qui ne correspond à rien, **When** Cyril tape, **Then** le site indique qu'aucun
   objet ne correspond.
6. **Given** une séance déjà rattachée, **When** Cyril ouvre son détail, **Then** le champ de recherche
   n'est pas proposé ; il peut la détacher comme avant, puis en rattacher une autre.
7. **Given** le rattachement échoue (service indisponible, séance rattachée entre-temps), **When**
   Cyril choisit un objet, **Then** un message l'explique, et aucun objet en FM n'est créé sans que la
   séance y soit rattachée.

---

### Edge Cases

- Une capture dont une ligne désigne un objet que le site n'a pas reconnu (nom inconnu) : la ligne est
  affichée telle que lue, avec sa quantité et son total, comme dans le récap global.
- Une capture qui ne contient aucune ligne détaillée (par exemple un montant sans lignes) : elle est
  listée avec son montant et la mention « Aucun achat détaillé ».
- Une capture postée par un autre joueur dans le salon de Cyril : elle apparaît avec le nom de ce
  joueur ; s'il a un profil privé, l'auteur est affiché « Joueur privé », comme dans « Dépense par
  joueur ».
- Une séance avec beaucoup de captures (plusieurs dizaines) : la section reste lisible ; chaque
  capture se replie pour n'afficher que sa ligne de résumé (date, auteur, montant), et se déplie pour
  montrer son récap.
- Une séance remise à zéro dans Discord (`/fmreset`) : ses captures disparaissent aussi du détail,
  comme ses montants aujourd'hui.
- Deux exemplaires du même équipement : le choix d'un équipement du catalogue crée toujours un nouvel
  objet ; pour réutiliser un objet existant, on choisit l'objet proposé (qui apparaît en premier).
- Le catalogue n'est pas disponible : les objets en FM du joueur restent proposés, et un message
  indique que le catalogue est indisponible.

## Requirements *(mandatory)*

### Functional Requirements

**Captures d'une séance**

- **FR-001**: Le détail d'une séance MUST lister toutes les captures qui lui sont rattachées, qu'elles
  viennent du bot Discord ou d'un import sur le site, de la plus ancienne à la plus récente.
- **FR-002**: Pour chaque capture, le détail MUST afficher : sa date et heure, son auteur (nom affiché
  du joueur, ou « Joueur privé »), sa provenance (« Discord » ou « Site ») et son montant.
- **FR-003**: Pour chaque capture, le détail MUST afficher le récap de ses lignes d'achat, regroupées
  par objet : nom de l'objet, quantité, total payé et prix moyen (total ÷ quantité, arrondi au kama le
  plus proche), avec les mêmes règles que le tableau « Achats » global.
- **FR-004**: La somme des montants des captures MUST être égale au total de la séance, et le récap
  global « Achats » MUST rester affiché, inchangé.
- **FR-005**: Chaque capture MUST pouvoir être repliée ou dépliée ; par défaut, les captures sont
  repliées dès que la séance en compte plus de 5, et dépliées sinon.
- **FR-006**: Les captures MUST être affichées exactement comme elles ont été enregistrées ; le site ne
  permet pas de les modifier ni de les supprimer (règle inchangée de specs/025).
- **FR-007**: Les captures d'une séance MUST être visibles uniquement par ceux qui peuvent voir la
  séance (specs/030).

**Rattachement par le nom**

- **FR-008**: Le détail d'une séance que le joueur peut rattacher (règle de specs/027, inchangée) MUST
  proposer un champ de recherche d'objet à la place de la liste déroulante actuelle.
- **FR-009**: À partir de 2 caractères tapés, le site MUST proposer, dans cet ordre : les objets en FM
  du joueur dont le nom affiché ou le nom de l'équipement contient le texte tapé (sans tenir compte des
  majuscules ni des accents), puis au plus 10 équipements du catalogue dont le nom correspond (même
  recherche que pour créer un objet en FM).
- **FR-010**: Choisir un objet en FM existant MUST rattacher la séance à cet objet.
- **FR-011**: Choisir un équipement du catalogue MUST créer un objet en FM pour cet équipement sur le
  profil du joueur (sans nom libre) et y rattacher la séance, en une seule action vue du joueur.
- **FR-012**: Si le rattachement échoue, aucun objet en FM créé pour l'occasion MUST rester sans
  séance ; le joueur voit un message d'erreur et peut réessayer.
- **FR-013**: Le détachement et l'affichage de l'objet rattaché (y compris « via le salon »,
  specs/029) MUST rester inchangés.

### Key Entities *(include if feature involves data)*

- **Capture** (existante) : une lecture OCR d'une capture du chat du jeu, rattachée à une séance ; son
  auteur, sa provenance (bot ou site), sa date, son montant.
- **Ligne d'achat** (existante) : une ligne lue sur une capture ; nom de l'objet, quantité, total payé,
  prix unitaire.
- **Objet en FM** (existant, specs/027) : l'exemplaire d'un équipement qu'un joueur forgemage ; il peut
  désormais être créé depuis le détail d'une séance.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Pour 100 % des séances, la somme des montants affichés par capture est égale au total de
  la séance.
- **SC-002**: Un joueur retrouve la capture qui a apporté une rune donnée en moins de 30 secondes à
  partir du détail de la séance.
- **SC-003**: Un joueur sans objet en FM rattache une séance à un nouvel objet en moins de 30 secondes,
  sans quitter le détail de la séance.
- **SC-004**: Rattacher une séance à un objet existant demande au plus 3 actions (cliquer dans le
  champ, taper, choisir).

## Assumptions

- « OCR » désigne la lecture d'une capture d'écran du chat : le site n'a pas l'image elle-même (elle
  reste dans Discord ou sur l'appareil du joueur, specs/025 FR-025) ; il affiche ce qui en a été lu.
- Les lignes d'achat de chaque capture sont déjà enregistrées par le service (bot et imports du site) :
  aucune donnée nouvelle n'est demandée au bot.
- Le récap d'une capture montre toutes les lignes lues (runes et autres objets), comme le tableau
  « Achats » global, même si la demande parle de « runes » : dans une séance FM, ce sont presque
  toujours des runes.
- Un objet en FM créé depuis une séance n'a pas de nom libre ; le joueur peut le renommer ensuite
  depuis son profil (specs/027).
- La page de création d'un objet en FM sur le profil reste disponible.
