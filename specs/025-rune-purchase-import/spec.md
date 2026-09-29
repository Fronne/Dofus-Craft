# Feature Specification: Page Forgemagie — prix des runes relevés depuis les achats en jeu

**Feature Branch**: `025-rune-purchase-import`

**Created**: 2026-09-29

**Status**: Draft

**Input**: User description: « Page Forgemagie alimentée par les achats de runes relevés dans le
chat du jeu. Dans Dofus, après un achat à l'HDV, le chat affiche des lignes comme « 10 x [Rune Do
Air] (15 868 kamas) » (quantité du lot, nom de la rune, prix total payé). Deux sources d'import
doivent alimenter les prix communautaires des runes (serveur choisi) : (A) le bot Discord d'un ami
du groupe, qui lit déjà les captures d'écran postées par les joueurs, envoie les achats lus à
l'application via une route dédiée protégée par une clé secrète ; (B) sur le site, un joueur peut
coller ou déposer une capture d'écran du chat : le texte est lu, les lignes reconnues sont affichées
pour validation/correction avant enregistrement (la lecture d'image peut se tromper). Le prix
unitaire est toujours dérivé de la quantité affichée (lots de 1, 10, 100 : 15 868 / 10 = 1 587 k).
Chaque prix importé garde son origine (bot Discord, capture, saisie manuelle) pour la traçabilité.
Une nouvelle page Forgemagie liste les runes avec leur dernier prix unitaire partagé, sa date et son
origine, en réutilisant l'historique de prix et le signalement des prix périmés existants. Hors
périmètre : calcul de brisage (explicitement non voulu), simulateur de FM, coût par point de stat et
suivi des dépenses FM (fonctionnalités futures). »

## Contexte

Les runes de forgemagie s'achètent à l'HDV Runes, qu'aucune page de l'app ne couvre aujourd'hui :
la page HDV (specs/023) liste les HDV Ressources, Consommables et Créatures. Relever à la main le
prix de dizaines de runes serait fastidieux, et personne ne le ferait.

Or, après chaque achat à l'HDV, le chat du jeu affiche une ligne qui contient déjà tout le
nécessaire : quantité du lot, nom de l'objet et prix total payé, par exemple
`10 x [Rune Do Air] (15 868 kamas)`. Ce sont des prix **réellement payés**, plus fiables qu'un prix
recopié. Un ami du groupe a déjà un bot Discord qui lit les captures d'écran de ces lignes postées
par les joueurs.

Cette fonctionnalité fait entrer ces achats dans les prix partagés du groupe, par deux chemins
(le bot, et une capture collée directement sur le site), et ajoute une page Forgemagie qui affiche
les prix des runes. Le porteur du projet a explicitement écarté tout calcul de brisage.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consulter le prix des runes (Priority: P1)

Un joueur ouvre la page Forgemagie depuis la navigation principale. Il voit la liste des runes,
chacune avec son icône, son nom, son dernier prix unitaire partagé sur son serveur, la date de ce
prix et son origine (bot Discord, capture, saisie manuelle). Il peut chercher une rune par son nom
et filtrer par stat. Il peut aussi saisir ou corriger un prix à la main, comme sur la page HDV.

**Why this priority**: c'est la page que le joueur consulte avant d'acheter ses runes ; sans elle,
les prix importés ne sont visibles nulle part. Elle est utile seule, avec des prix saisis à la main.

**Independent Test**: sur un serveur où la Rune Do Air a un prix partagé de 1 587 kamas relevé
par le bot le 29/09, ouvrir la page Forgemagie : la ligne Rune Do Air affiche 1 587 kamas, la date
du 29/09 et l'origine « Bot Discord ».

**Acceptance Scenarios**:

1. **Given** une rune avec un prix partagé, **When** le joueur ouvre la page Forgemagie, **Then**
   la ligne affiche le prix unitaire, sa date et son origine.
2. **Given** une rune sans aucun prix, **When** le joueur ouvre la page, **Then** la ligne est
   listée avec un champ vide et saisissable, sans valeur inventée.
3. **Given** le joueur tape « Do Air » dans la recherche, **When** la liste se met à jour,
   **Then** seules les runes dont le nom contient ce texte restent affichées.
4. **Given** une rune dont le prix date trop, **When** le joueur ouvre la page, **Then** la ligne
   est signalée comme périmée, avec la même règle que les autres pages (specs/008).
5. **Given** le joueur saisit à la main 1 600 kamas pour une rune, **When** il valide, **Then** le
   prix est enregistré avec l'origine « Saisie manuelle » et suit les règles de partage et de
   confirmation des autres pages.

---

### User Story 2 - Importer une capture du chat sur le site (Priority: P1)

Un joueur vient d'acheter des runes. Il fait une capture d'écran du chat du jeu et la colle
(ou la dépose) sur la page Forgemagie. L'app lit les lignes d'achat, et affiche pour chacune ce
qu'elle a compris : rune reconnue, quantité du lot, prix total et prix unitaire calculé. Le joueur
corrige ce qui est faux, décoche ce qu'il ne veut pas garder, puis valide. Les prix validés sont
enregistrés comme des prix de la rune sur son serveur, avec l'origine « Capture ».

**Why this priority**: c'est la façon la plus rapide de relever plusieurs prix d'un coup, sans
dépendre du bot ; elle rend la page utile dès le premier jour.

**Independent Test**: coller la capture fournie en exemple (quatre lignes
`10 x [Rune Do Air] (15 868 kamas)`) : l'app propose une ligne Rune Do Air, lot de 10, total
15 868, prix unitaire 1 587 ; après validation, la page affiche 1 587 kamas pour la Rune Do Air,
origine « Capture ».

**Acceptance Scenarios**:

1. **Given** une capture contenant `10 x [Rune Do Air] (15 868 kamas)`, **When** le joueur la
   colle, **Then** l'app propose : Rune Do Air, quantité 10, total 15 868 kamas, prix unitaire
   1 587 kamas, et n'enregistre rien avant validation.
2. **Given** la même ligne répétée quatre fois sur la capture, **When** l'app la lit, **Then** elle
   propose un seul prix pour la Rune Do Air (les achats identiques ne multiplient pas les relevés).
3. **Given** une ligne proposée dont le prix a été mal lu, **When** le joueur corrige le total ou la
   quantité, **Then** le prix unitaire est recalculé avant validation.
4. **Given** une ligne dont le nom ne correspond à aucune rune connue, **When** l'app l'affiche,
   **Then** elle est signalée comme non reconnue, n'est pas enregistrable telle quelle, et le joueur
   peut choisir la rune à la main ou l'écarter.
5. **Given** une capture sans aucune ligne d'achat lisible, **When** le joueur la colle, **Then**
   l'app l'indique clairement et n'enregistre rien.
6. **Given** un prix unitaire proposé très éloigné des relevés du groupe, **When** le joueur valide,
   **Then** la même confirmation que pour une saisie manuelle (specs/007) est demandée pour ce prix.

---

### User Story 3 - Recevoir les achats lus par le bot Discord (Priority: P2)

Un joueur poste une capture de ses achats dans le salon Discord du groupe, comme il le fait déjà.
Le bot la lit et envoie les achats à l'app. Sans autre action, les prix apparaissent sur la page
Forgemagie de tous les membres du groupe, avec l'origine « Bot Discord ».

**Why this priority**: c'est le chemin sans effort, mais il dépend d'une modification du bot par
son auteur ; la page et l'import par capture restent utiles sans lui.

**Independent Test**: envoyer à l'app, avec la clé secrète du bot, un achat « 10 x Rune Do Air,
15 868 kamas » pour le serveur du groupe, puis ouvrir la page Forgemagie : la Rune Do Air affiche
1 587 kamas, origine « Bot Discord ». Le même envoi sans clé, ou avec une mauvaise clé, est refusé
et ne change aucun prix.

**Acceptance Scenarios**:

1. **Given** un envoi du bot avec une clé valide et un achat d'une rune connue, **When** l'app le
   reçoit, **Then** elle enregistre le prix unitaire pour cette rune et ce serveur, avec l'origine
   « Bot Discord », et répond au bot quels achats ont été acceptés.
2. **Given** un envoi sans clé ou avec une clé invalide, **When** l'app le reçoit, **Then** elle le
   refuse et n'enregistre rien.
3. **Given** un envoi dont un achat nomme un objet inconnu, ou a une quantité ou un total
   invalide (nul, négatif, non numérique), **When** l'app le reçoit, **Then** cet achat est rejeté
   avec sa raison, et les autres achats valides du même envoi sont enregistrés.
4. **Given** le bot renvoie deux fois le même achat (même capture reçue deux fois), **When** l'app
   reçoit le second envoi, **Then** aucun second relevé n'est créé.
5. **Given** un achat envoyé par le bot dont le prix unitaire est très éloigné des relevés du
   groupe, **When** l'app le reçoit, **Then** [NEEDS CLARIFICATION: le bot ne peut pas faire
   confirmer le prix — l'achat est-il enregistré quand même (tracé comme aberrant), rejeté, ou mis
   de côté pour qu'un joueur le confirme sur le site ?]

---

### Edge Cases

- **Lot de 1, 10 ou 100** : le prix unitaire est toujours le total divisé par la quantité lue, arrondi
  à l'unité la plus proche (15 868 / 10 = 1 586,8 → 1 587 kamas). L'arrondi est indiqué.
- **Même rune achetée plusieurs fois à des prix différents sur une capture** : chaque prix unitaire
  distinct est proposé ; le plus récent enregistré devient le dernier prix, comme pour toute
  contribution.
- **Lignes du chat qui ne sont pas des achats** (messages de joueurs, ventes, autres infos) : elles
  sont ignorées.
- **Achat d'un objet qui n'est pas une rune** sur la capture : [NEEDS CLARIFICATION: ignoré, ou
  enregistré comme prix de cet objet s'il est connu du catalogue ?]
- **Nom de rune proche mais pas exact** (faute de lecture de l'image, par exemple « Rune Do Alr ») :
  l'app peut proposer la rune la plus proche, mais c'est le joueur qui valide ; rien n'est
  enregistré automatiquement sur une correspondance approximative venant d'une capture sur le site.
  Pour le bot, seule une correspondance exacte du nom est acceptée.
- **Capture illisible, trop petite ou qui n'est pas une image** : message clair, rien n'est enregistré.
- **Service communautaire injoignable** : la page affiche les derniers prix connus sur l'appareil ;
  l'import par capture enregistre les prix localement et le signale, comme une saisie manuelle
  (specs/004, FR-011).
- **Mode personnel** : l'import par capture et la saisie manuelle enregistrent les prix sur
  l'appareil seulement, rien n'est partagé ; la page affiche les prix de l'appareil. Les prix envoyés
  par le bot sont des prix partagés et ne sont donc pas visibles en Mode personnel.
- **Rune ajoutée au jeu après la dernière mise à jour du catalogue** : elle n'est pas reconnue
  tant que le catalogue n'est pas rafraîchi ; l'achat est rejeté (bot) ou signalé non reconnu
  (capture).

## Requirements *(mandatory)*

### Functional Requirements

**Page Forgemagie**

- **FR-001**: Le système MUST proposer une page « Forgemagie » accessible depuis la navigation
  principale.
- **FR-002**: La page MUST lister les runes de forgemagie du catalogue, avec l'icône du jeu, le nom,
  le dernier prix unitaire connu sur le serveur actif, sa date et son origine.
- **FR-003**: La page MUST permettre de chercher une rune par son nom et de filtrer les runes par
  stat.
- **FR-004**: La page MUST permettre de saisir ou corriger le prix unitaire d'une rune avec le même
  comportement que les autres champs de prix de ressource (serveur actif, date de mise à jour,
  Mode personnel ou communautaire, confirmation d'un prix très différent — specs/007, specs/024).
- **FR-005**: La page MUST signaler les prix périmés avec la même règle que les autres pages
  (specs/008) et MUST donner accès à l'historique des prix d'une rune (specs/017, specs/018).
- **FR-006**: Une rune sans prix MUST être affichée sans valeur ; le système MUST NOT inventer ni
  estimer de prix.
- **FR-007**: Le prix d'une rune MUST être un prix de ressource ordinaire : il est aussi utilisé
  par les autres pages de l'app qui en ont besoin (par exemple une recette qui contient une rune).
- **FR-008**: Le système MUST NOT afficher de nombre de contributions sur les lignes de prix
  (règle déjà en vigueur).

**Lecture d'une ligne d'achat (commune aux deux sources)**

- **FR-009**: Le système MUST reconnaître une ligne d'achat de la forme
  `<quantité> x [<nom de l'objet>] (<total> kamas)`, où le total peut contenir des espaces comme
  séparateurs de milliers.
- **FR-010**: Le prix unitaire MUST être calculé comme le total divisé par la quantité, arrondi à
  l'unité la plus proche. Une quantité ou un total nul, négatif ou illisible MUST rendre la ligne
  invalide.
- **FR-011**: Chaque prix enregistré MUST garder son origine : « Saisie manuelle », « Capture » ou
  « Bot Discord ». Les prix déjà enregistrés avant cette fonctionnalité sont d'origine
  « Saisie manuelle ».
- **FR-012**: Le dernier prix d'une rune MUST suivre la règle de specs/024 : la contribution la plus
  récente sur le serveur, quelle que soit son origine.

**Import par capture sur le site**

- **FR-013**: La page Forgemagie MUST permettre de coller ou de déposer une capture d'écran.
- **FR-014**: Le système MUST afficher, avant tout enregistrement, chaque achat lu : rune reconnue,
  quantité, total et prix unitaire calculé.
- **FR-015**: Le joueur MUST pouvoir corriger la rune, la quantité et le total d'une ligne
  (le prix unitaire se recalcule), écarter une ligne, puis valider l'ensemble.
- **FR-016**: Le système MUST NOT enregistrer une ligne dont la rune n'est pas identifiée avec
  certitude, soit par un nom exact, soit par un choix du joueur.
- **FR-017**: Plusieurs lignes identiques (même rune, même quantité, même total) sur une même
  capture MUST donner un seul relevé.
- **FR-018**: La capture MUST être lue sur l'appareil du joueur et MUST NOT être envoyée ni conservée
  par le service ; seuls les prix validés sont enregistrés.

**Import par le bot Discord**

- **FR-019**: Le système MUST accepter des achats envoyés par le bot du groupe, chaque achat indiquant
  au moins le nom de l'objet, la quantité, le total et le serveur.
- **FR-020**: Le système MUST refuser tout envoi qui ne présente pas la clé secrète du bot. La clé
  MUST pouvoir être changée sans modifier l'application, et MUST NOT apparaître dans le code publié
  ni dans ce que voit un joueur.
- **FR-021**: Le système MUST valider chaque achat séparément : un achat invalide (objet inconnu, nom
  non exact, quantité ou total invalide, serveur inconnu) est rejeté avec sa raison, sans empêcher
  l'enregistrement des achats valides du même envoi.
- **FR-022**: Le système MUST répondre au bot, pour chaque achat, s'il a été accepté ou rejeté et
  pourquoi, pour que le bot puisse le signaler dans Discord.
- **FR-023**: Un achat déjà reçu (même objet, quantité, total, serveur et même identifiant d'envoi
  fourni par le bot) MUST NOT créer un second relevé.
- **FR-024**: Le serveur d'un achat envoyé par le bot MUST être déterminé ainsi :
  [NEEDS CLARIFICATION: tout le groupe joue-t-il sur un seul serveur (fixé une fois pour le bot),
  ou le bot doit-il savoir sur quel serveur chaque joueur a acheté (par salon Discord, par joueur,
  ou précisé dans le message) ?]
- **FR-025**: Les prix envoyés par le bot MUST être traités comme des prix partagés du groupe
  (Mode communautaire), avec le même calcul de médiane et d'écart à l'enregistrement
  (specs/007, FR-009).

### Key Entities

- **Rune** : une ressource du catalogue de type « Rune de forgemagie », avec son nom, son icône et la
  stat qu'elle modifie.
- **Ligne d'achat** : ce qui est lu dans le chat — nom de l'objet, quantité du lot, total payé — et
  le prix unitaire qui en est calculé.
- **Contribution de prix** : un prix unitaire relevé pour une ressource sur un serveur à une date,
  existant déjà (specs/004, specs/024), enrichi de son **origine** (Saisie manuelle, Capture, Bot
  Discord).
- **Envoi du bot** : un lot d'achats transmis par le bot, avec un identifiant qui permet d'ignorer
  un renvoi, et la réponse achat par achat (accepté ou rejeté, raison).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un joueur relève les prix de 10 runes à partir d'une seule capture du chat en moins
  d'une minute, contre une saisie rune par rune aujourd'hui.
- **SC-002**: Sur une capture nette du chat du jeu, au moins 9 lignes d'achat sur 10 sont proposées
  avec la bonne rune, la bonne quantité et le bon total, sans correction.
- **SC-003**: Aucun prix n'est enregistré à partir d'une capture sans validation du joueur, et aucun
  achat du bot n'est enregistré sans clé valide (100 % des cas).
- **SC-004**: Un prix envoyé par le bot est visible sur la page Forgemagie de tout membre du groupe
  au plus 1 minute après sa réception.
- **SC-005**: Pour chaque prix affiché sur la page Forgemagie, le joueur peut dire d'où il vient
  (origine) et de quand il date.

## Assumptions

- Les runes sont toutes les ressources du catalogue de type « Rune de forgemagie » ; la stat de
  chaque rune est déduite de ses données de catalogue.
- Le format de la ligne d'achat est celui du client Dofus en français (`x`, crochets, « kamas ») ;
  les autres langues sont hors périmètre.
- Le bot est modifié par son auteur pour appeler l'app ; l'app fournit la clé secrète et un format
  d'envoi documenté. Le bot garde sa propre lecture des captures : l'app ne lit pas le contenu de
  Discord.
- Le groupe est petit et fermé (~10-20 joueurs) : une clé unique pour le bot suffit, sans compte
  par joueur.
- L'origine est une information de traçabilité : elle est affichée sur la page Forgemagie ; les
  autres pages ne sont pas modifiées pour l'afficher.
- Hors périmètre : calcul de brisage, simulateur de forgemagie, coût par point de stat, suivi des
  dépenses de forgemagie, import d'autres types de lignes du chat (ventes, messages).
