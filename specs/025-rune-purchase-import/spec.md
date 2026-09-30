# Feature Specification: Page Forgemagie — profils Discord, sessions FM et prix des runes

**Feature Branch**: `025-rune-purchase-import`

**Created**: 2026-09-29

**Revised**: 2026-09-30 (réécriture après lecture du bot Discord du groupe)

**Status**: Draft

**Input**: User description (2026-09-29) : « Page Forgemagie alimentée par les achats de runes
relevés dans le chat du jeu. Dans Dofus, après un achat à l'HDV, le chat affiche des lignes comme
« 10 x [Rune Do Air] (15 868 kamas) ». Deux sources d'import : le bot Discord d'un ami du groupe, et
une capture d'écran collée sur le site. […] Hors périmètre : calcul de brisage (explicitement non
voulu), simulateur de FM. »

Révision (2026-09-30) : « Voici le projet du bot Discord qui permet actuellement de faire des
sessions pour récupérer les prix des screens (https://github.com/jamingaetan1-blip/Botomouxv2). Pour
la page Forgemagie, je veux un système de profil, avec une connexion Discord : si des utilisateurs
utilisent le bot Discord, les données sont poussées vers le service de l'app et accessibles sur le
site. »

## Contexte

### Le bot Discord du groupe (Botomoux)

Un ami du groupe a écrit un bot Discord qui sert à suivre les **dépenses d'une séance de
forgemagie** :

- `/fmstart` ouvre une session dans un salon Discord ; `/fmstop` la ferme et affiche le résumé ;
  `/fmtotal` affiche l'état en cours ; `/fmreset` la remet à zéro.
- Pendant une session, chaque joueur poste des captures du chat du jeu. Le bot les lit et cumule,
  pour la session : **ce que chaque joueur a dépensé** (identifié par son compte Discord), et pour
  **chaque rune** la quantité achetée, le total payé et le prix moyen par unité.
- Les lignes lues sont celles que le jeu affiche après un achat à l'HDV :
  `10 x [Rune Do Air] (15 868 kamas)` (quantité du lot, nom de l'objet, total payé).
- Les données restent sur la machine qui héberge le bot, et **une session fermée est supprimée** :
  il n'en reste que le message de résumé dans Discord.

### Ce que veut le groupe

Garder ces sessions et les consulter sur le site, sur une page Forgemagie. Chaque joueur a un
**profil**, auquel il accède en se connectant avec son compte Discord. Comme le bot connaît déjà le
compte Discord de chaque joueur qui poste une capture, les achats envoyés par le bot se rattachent
d'eux-mêmes au bon profil, sans liaison manuelle.

Les achats relevés servent aussi à connaître le **prix des runes**, que l'app ne connaît pas
aujourd'hui : l'HDV Runes n'est couvert par aucune page (la page HDV, specs/023, couvre les HDV
Ressources, Consommables et Créatures).

### Changement de principe

Jusqu'ici, l'app est **entièrement anonyme** (un identifiant par appareil, aucun compte). Cette
fonctionnalité introduit pour la première fois une identité de joueur, **limitée à la page
Forgemagie** : le reste du site reste anonyme et utilisable sans connexion.

Le porteur du projet a explicitement écarté tout calcul de brisage.

## Clarifications

### Session 2026-09-30

- Q: Qui peut voir les dépenses de forgemagie d'un joueur ? → A: Tout le groupe par défaut, avec
  la possibilité pour chaque joueur de passer son profil en privé.
- Q: Que contient la page Forgemagie ? → A: L'historique des sessions FM, les dépenses FM du joueur
  sur son profil, le prix des runes, et l'import d'une capture directement sur le site.
- Q: La connexion Discord est-elle obligatoire ? → A: Seulement pour la page Forgemagie ; le reste
  du site reste anonyme.
- Q: Qui peut se connecter ? → A: Seulement les membres du serveur Discord du groupe.
- Q: Comment savoir sur quel serveur Dofus un achat envoyé par le bot a été fait ? → A: Par le
  serveur Dofus choisi sur le profil du joueur (déduit de la réponse sur les profils ; remplace
  la question 3 de la première version de cette spec).
- Q: Que faire d'un achat envoyé par le bot dont le prix unitaire est très éloigné des relevés du
  groupe ? → A: Il compte dans les dépenses, mais il est exclu des prix des runes.
- Q: Un achat qui n'est pas une rune met-il à jour le prix de cet objet ? → A: Oui, s'il s'agit
  d'une ressource du catalogue au nom exact ; jamais pour un équipement.
- Q: Combien de temps garder les sessions FM et les achats ? → A: Indéfiniment, jusqu'à ce que le
  joueur supprime son profil ; les prix qui en sont tirés suivent la règle actuelle des 90 jours.
- Q: Peut-on corriger ou supprimer sur le site un achat mal lu par le bot ? → A: Non ; le site
  affiche exactement ce que le bot a compté, et une erreur se corrige dans Discord (`/fmreset`).
- Q: Sur la page Forgemagie, quel serveur sert à afficher le prix des runes ? → A: Le sélecteur de
  serveur du site, comme les autres pages ; le serveur du profil ne sert qu'à ranger les achats
  envoyés par le bot, et il est pré-rempli avec celui du sélecteur à la première connexion.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Se connecter avec Discord et avoir un profil (Priority: P1)

Un joueur ouvre la page Forgemagie. Il n'est pas connecté : la page lui propose de se connecter
avec Discord. Après connexion, il arrive sur la page avec son profil : pseudo et avatar Discord,
serveur Dofus (qu'il choisit une fois), et réglage de visibilité (public ou privé). S'il n'est pas
membre du serveur Discord du groupe, la connexion est refusée avec un message clair.

**Why this priority**: tout le reste (sessions, dépenses, import) se rattache à un profil.

**Independent Test**: se connecter avec un compte Discord membre du serveur du groupe : le profil
affiche son pseudo et son avatar, et le joueur peut choisir son serveur Dofus. Refaire l'essai
avec un compte qui n'est pas membre : la connexion est refusée et aucun profil n'est créé.

**Acceptance Scenarios**:

1. **Given** un joueur non connecté, **When** il ouvre la page Forgemagie, **Then** il voit un
   bouton « Se connecter avec Discord » et une courte explication de ce que la page apporte.
2. **Given** un membre du serveur Discord du groupe, **When** il se connecte, **Then** son profil
   est créé (ou retrouvé) avec son pseudo et son avatar Discord, et il reste connecté lors de ses
   visites suivantes sur le même appareil.
3. **Given** un compte Discord qui n'est pas membre du serveur du groupe, **When** il tente de se
   connecter, **Then** la connexion est refusée avec un message clair et rien n'est enregistré.
4. **Given** un joueur connecté, **When** il choisit son serveur Dofus sur son profil, **Then** ce
   serveur sert pour tous ses achats envoyés par le bot et importés sur le site.
5. **Given** un joueur connecté, **When** il se déconnecte, **Then** la page Forgemagie redemande
   une connexion, et les autres pages du site fonctionnent comme avant.
6. **Given** un joueur non connecté, **When** il utilise les pages Recherche, HDV, Rentabilité,
   Suivis ou XP Familier, **Then** rien ne change pour lui : aucune connexion n'est demandée.

---

### User Story 2 - Retrouver les sessions FM du bot sur le site (Priority: P1)

Un joueur fait une session FM dans Discord avec le bot, comme aujourd'hui. Pendant et après la
session, il la retrouve sur la page Forgemagie : date, salon, état (en cours ou terminée), total
dépensé, dépense de chaque joueur, et détail par rune (quantité, total, prix moyen par unité). Les
sessions ne sont plus perdues quand elles sont fermées dans Discord.

**Why this priority**: c'est le besoin qui motive la connexion Discord : garder et consulter ce que
le bot calcule déjà.

**Independent Test**: dans Discord, `/fmstart`, poster la capture d'exemple
(`10 x [Rune Do Air] (15 868 kamas)`), puis `/fmstop` ; sur le site, la session apparaît, terminée,
avec le joueur et ses 15 868 kamas, et la ligne Rune Do Air : 10, 15 868 kamas, 1 587 kamas/u.

**Acceptance Scenarios**:

1. **Given** une session ouverte dans Discord, **When** un joueur y poste une capture lue par le
   bot, **Then** la session apparaît sur le site comme « en cours » avec les achats de cette
   capture.
2. **Given** une session fermée par `/fmstop`, **When** un joueur ouvre la page Forgemagie,
   **Then** la session est affichée comme terminée, avec les mêmes totaux que le résumé du bot.
3. **Given** une session remise à zéro par `/fmreset`, **When** un joueur l'ouvre sur le site,
   **Then** elle reflète la remise à zéro, comme dans Discord.
4. **Given** la même capture reçue deux fois par le site (renvoi du bot), **When** la session est
   affichée, **Then** ses achats ne sont comptés qu'une fois.
5. **Given** un joueur qui poste dans une session sans s'être jamais connecté au site, **When** la
   session est affichée, **Then** sa dépense apparaît sous son pseudo Discord ; quand il se
   connecte plus tard, ces achats sont déjà sur son profil.
6. **Given** un joueur dont le profil est privé, **When** un autre joueur ouvre une session à
   laquelle il a participé, **Then** la ligne de ce joueur est affichée sans son nom ni son avatar
   (« Joueur privé »), et son montant reste compté dans le total de la session.

---

### User Story 3 - Voir ses dépenses de forgemagie (Priority: P2)

Sur son profil, un joueur voit ce qu'il a dépensé en forgemagie : au total, par session, et par
rune. Les autres membres du groupe peuvent consulter le profil d'un joueur public ; un profil privé
n'est visible que par son propriétaire.

**Why this priority**: c'est le récapitulatif personnel que le bot ne peut pas donner, puisqu'il
oublie les sessions fermées ; utile mais secondaire par rapport à l'historique.

**Independent Test**: après deux sessions où le joueur a dépensé 100 000 puis 50 000 kamas, son
profil affiche 150 000 kamas au total et les deux sessions avec leur montant.

**Acceptance Scenarios**:

1. **Given** un joueur connecté avec deux sessions, **When** il ouvre son profil, **Then** il voit
   son total dépensé, la liste de ses sessions avec son montant dans chacune, et le détail par rune.
2. **Given** un joueur public, **When** un autre membre ouvre son profil, **Then** il voit les mêmes
   informations.
3. **Given** un joueur privé, **When** un autre membre cherche à ouvrir son profil, **Then** le
   profil n'est pas accessible et le joueur n'apparaît pas dans la liste des profils.
4. **Given** un joueur qui passe son profil de privé à public (ou l'inverse), **When** un autre
   membre recharge la page, **Then** la visibilité suit immédiatement le nouveau réglage, y compris
   sur les sessions passées.
5. **Given** un joueur connecté, **When** il demande la suppression de son profil et confirme,
   **Then** son profil et ses achats sont supprimés ; dans les sessions partagées, sa ligne
   disparaît et les totaux sont recalculés.

---

### User Story 4 - Consulter le prix des runes (Priority: P2)

La page Forgemagie liste les runes avec leur dernier prix unitaire sur le serveur du joueur, la date
de ce prix et son origine (bot Discord, capture sur le site, saisie manuelle). Les prix viennent
des achats relevés par le bot et par les captures ; le joueur peut aussi saisir un prix à la main.
Il peut chercher une rune par son nom et filtrer par stat.

**Why this priority**: sous-produit des achats relevés, précieux avant d'acheter ; il dépend des
stories 2 et 5 pour être alimenté.

**Independent Test**: après la session d'exemple (joueur dont le serveur de profil est le serveur
S), avec le serveur S choisi dans le sélecteur du site, la liste des runes affiche Rune Do Air à 1 587 kamas, avec la date et l'origine
« Bot Discord ».

**Acceptance Scenarios**:

1. **Given** une rune achetée pendant une session, **When** un joueur ouvre la liste des runes avec
   ce serveur choisi dans le sélecteur du site, **Then** la rune affiche le prix unitaire de cet achat, sa date et son origine.
2. **Given** une rune sans aucun prix, **When** le joueur ouvre la liste, **Then** la ligne est
   affichée sans valeur, jamais avec un prix estimé.
3. **Given** une rune dont le prix date trop, **When** le joueur ouvre la liste, **Then** elle est
   signalée comme périmée, avec la même règle que les autres pages (specs/008).
4. **Given** le joueur saisit un prix à la main, **When** il valide, **Then** le prix est enregistré
   avec l'origine « Saisie manuelle » et suit les règles de partage et de confirmation des autres
   pages (specs/007, specs/024).
5. **Given** un achat du bot par un joueur qui n'a pas encore choisi de serveur Dofus, **When**
   l'achat arrive, **Then** il compte dans ses dépenses mais ne crée aucun prix de rune, faute de
   serveur connu.

---

### User Story 5 - Importer une capture sur le site (Priority: P3)

Un joueur connecté colle (ou dépose) une capture d'écran du chat du jeu sur la page Forgemagie.
L'app lit les lignes d'achat et affiche ce qu'elle a compris : rune, quantité, total, prix unitaire.
Le joueur corrige ce qui est faux, écarte ce qu'il ne veut pas garder, puis valide. Les achats
validés s'ajoutent à ses dépenses et aux prix des runes, avec l'origine « Capture ».

**Why this priority**: permet d'utiliser la page sans passer par Discord, mais le bot couvre déjà
l'usage principal.

**Independent Test**: coller la capture d'exemple : l'app propose Rune Do Air, quantité 10,
total 15 868, prix unitaire 1 587, et n'enregistre rien avant validation ; après validation, la
dépense apparaît sur le profil et le prix dans la liste des runes.

**Acceptance Scenarios**:

1. **Given** une capture contenant `10 x [Rune Do Air] (15 868 kamas)`, **When** le joueur la
   colle, **Then** l'app propose : Rune Do Air, 10, 15 868 kamas, 1 587 kamas/u.
2. **Given** une ligne dont le total a été mal lu, **When** le joueur le corrige, **Then** le prix
   unitaire est recalculé avant validation.
3. **Given** une ligne dont le nom ne correspond à aucune rune connue, **When** l'app l'affiche,
   **Then** elle est signalée comme non reconnue et n'est enregistrable qu'après que le joueur a
   choisi la rune ou l'a écartée.
4. **Given** une capture sans aucune ligne d'achat lisible, **When** le joueur la colle, **Then**
   l'app l'indique et n'enregistre rien.
5. **Given** un prix unitaire très éloigné des relevés du groupe, **When** le joueur valide,
   **Then** la même confirmation que pour une saisie manuelle (specs/007) est demandée.

---

### Edge Cases

- **Lot de 1, 10 ou 100** : le prix unitaire est le total divisé par la quantité lue, arrondi à
  l'unité la plus proche (15 868 / 10 = 1 586,8 → 1 587 kamas) ; l'arrondi est indiqué.
- **Même capture postée deux fois dans Discord** (deux messages distincts) : le bot la compte deux
  fois, comme aujourd'hui ; le site reflète ce que le bot a compté. Seul un **renvoi** du même
  message est ignoré (FR-020).
- **Prix très éloigné des relevés du groupe envoyé par le bot** (écart de plus de 25 % avec la
  médiane du groupe, par exemple une erreur de lecture « 158 680 » au lieu de « 15 868 ») : l'achat
  compte dans les dépenses de la session, mais il ne crée pas de prix de rune (FR-019). Sans médiane
  connue pour la rune, l'achat crée un prix normalement.
- **Achat d'un objet qui n'est pas une rune** (même format de ligne, par exemple
  `10 x [Bois de Frêne] (2 400 kamas)`) : il compte dans les dépenses de la session, comme dans le
  bot aujourd'hui. S'il s'agit d'une ressource du catalogue au nom exact, il crée aussi un prix de
  cette ressource, avec les mêmes règles qu'une rune (FR-019). Un achat d'équipement ne crée aucun
  prix : ses jets varient d'un exemplaire à l'autre.
- **Achat mal lu par le bot** (quantité ou total faux) : le site l'affiche tel que le bot l'a compté,
  sans possibilité de le corriger ni de le supprimer sur le site ; la correction se fait dans
  Discord, en remettant la session à zéro (`/fmreset`) puis en repostant les captures. Un prix de
  ressource faux qui en découlerait est remplacé par le relevé suivant du groupe, comme tout prix
  partagé (specs/024).
- **Nom de rune mal lu par le bot** (« Rune Do Alr ») : l'achat compte dans les dépenses sous ce nom,
  mais ne crée aucun prix de rune, faute de correspondance exacte avec le catalogue.
- **Joueur qui quitte le serveur Discord du groupe** : il ne peut plus se connecter ; son profil et
  ses achats restent visibles selon son réglage de visibilité, jusqu'à ce qu'il en demande la
  suppression.
- **Joueur qui change de serveur Dofus sur son profil** : les achats déjà reçus gardent le serveur
  qu'ils avaient ; seuls les suivants utilisent le nouveau.
- **Service injoignable pour le bot** : le bot continue de fonctionner dans Discord comme
  aujourd'hui ; les captures traitées pendant la panne ne sont pas sur le site (le bot peut les
  renvoyer plus tard, sans double comptage grâce à FR-020).
- **Capture illisible ou qui n'est pas une image** : message clair, rien n'est enregistré.
- **Session très longue ou avec beaucoup de runes** : toutes les runes sont listées, sans limite
  d'affichage (le bot, lui, découpe en blocs de 25).

## Requirements *(mandatory)*

### Functional Requirements

**Connexion et profil**

- **FR-001**: Le système MUST proposer une page « Forgemagie » accessible depuis la navigation
  principale ; la page MUST demander une connexion Discord pour afficher son contenu.
- **FR-002**: Le système MUST permettre de se connecter avec un compte Discord, et MUST refuser la
  connexion d'un compte qui n'est pas membre du serveur Discord du groupe.
- **FR-003**: Les autres pages du site MUST rester utilisables sans connexion, avec leur
  comportement actuel.
- **FR-004**: Le profil MUST contenir uniquement : l'identifiant Discord, le pseudo et l'avatar
  Discord, le serveur Dofus choisi et le réglage de visibilité. Le système MUST NOT demander ni
  garder d'autre information Discord (adresse e-mail, liste d'amis, messages…).
- **FR-005**: Le joueur MUST pouvoir choisir et changer son serveur Dofus sur son profil. Ce serveur
  MUST servir uniquement à ranger les achats envoyés par le bot et importés sur le site ; il MUST
  être pré-rempli avec le serveur actif du sélecteur du site à la première connexion. L'affichage
  des prix MUST suivre le sélecteur du site.
- **FR-006**: Le profil MUST être public par défaut ; le joueur MUST pouvoir le passer en privé et
  revenir en public à tout moment.
- **FR-007**: Le joueur MUST pouvoir se déconnecter, et MUST pouvoir supprimer son profil et tous
  ses achats après une confirmation explicite.

**Sessions FM reçues du bot**

- **FR-008**: Le système MUST recevoir du bot les événements de session : ouverture, capture
  traitée (achats lus et joueur Discord qui l'a postée), remise à zéro, fermeture.
- **FR-009**: Le système MUST refuser tout envoi qui ne présente pas la clé secrète du bot. La clé
  MUST pouvoir être changée sans modifier l'application et MUST NOT apparaître dans le code publié ni
  dans ce que voit un joueur.
- **FR-010**: Pour chaque session, le système MUST afficher : date d'ouverture et de fermeture,
  salon Discord, état (en cours, terminée), total, dépense de chaque joueur, et pour chaque rune la
  quantité, le total et le prix moyen par unité.
- **FR-011**: Les totaux affichés MUST être identiques à ceux que le bot affiche dans Discord pour
  la même session.
- **FR-012**: Le système MUST conserver les sessions terminées et les achats sans limite de durée,
  jusqu'à la suppression du profil du joueur (FR-007) ; une remise à zéro MUST effacer les achats
  de la session, comme dans le bot. Les prix de ressource tirés de ces achats MUST suivre la règle
  de conservation actuelle des prix partagés (90 jours), indépendamment des achats.
- **FR-012b**: Le site MUST NOT permettre de modifier ni de supprimer un achat reçu du bot, en dehors
  de la suppression complète du profil (FR-007) ; il MUST afficher exactement ce que le bot a compté.
- **FR-013**: Un achat d'un joueur Discord qui n'a pas de profil sur le site MUST être conservé et
  rattaché à son identifiant Discord, puis apparaître sur son profil dès sa première connexion.

**Visibilité**

- **FR-014**: Un profil public MUST être consultable par tout membre connecté ; un profil privé
  MUST être consultable uniquement par son propriétaire.
- **FR-015**: Dans une session, la ligne d'un joueur privé MUST être affichée sans nom ni avatar
  (« Joueur privé ») pour les autres membres, et son montant MUST rester compté dans le total.

**Dépenses**

- **FR-016**: Le profil MUST afficher le total dépensé par le joueur, sa dépense par session et
  son détail par rune (quantité, total, prix moyen), en incluant les achats importés sur le site.

**Prix des runes**

- **FR-017**: La page MUST lister les runes de forgemagie du catalogue, avec l'icône du jeu, le nom,
  le dernier prix unitaire sur le serveur actif du sélecteur du site (comme les autres pages), sa
  date et son origine
  (« Bot Discord », « Capture », « Saisie manuelle »). Elle MUST permettre de chercher par nom et de
  filtrer par stat.
- **FR-018**: Le prix d'une rune MUST être un prix de ressource ordinaire, partagé avec le groupe et
  soumis aux règles existantes : dernier prix (specs/024), prix périmés (specs/008), historique
  (specs/017, specs/018), confirmation d'un prix très différent pour une saisie sur le site
  (specs/007). Il MUST être utilisé par les autres pages qui en ont besoin.
- **FR-019**: Un achat MUST créer un prix de ressource seulement si son nom correspond exactement à
  une ressource du catalogue (rune ou autre ressource) et si le serveur Dofus du joueur est connu.
  Un achat d'équipement MUST NOT créer de prix. Un achat envoyé par le bot dont le prix unitaire
  s'écarte de plus de 25 % de la médiane du groupe pour cette ressource et ce serveur (même seuil
  que specs/007) MUST NOT créer de prix, mais MUST rester compté dans les dépenses. Le système
  MUST NOT inventer ni estimer de prix.
- **FR-020**: Un même événement envoyé plusieurs fois par le bot (même message Discord) MUST NOT
  être compté plusieurs fois, ni dans les dépenses ni dans les prix.
- **FR-021**: Le système MUST NOT afficher de nombre de contributions sur les lignes de prix (règle
  déjà en vigueur).

**Lecture d'une ligne d'achat et import sur le site**

- **FR-022**: Le système MUST reconnaître une ligne d'achat de la forme
  `<quantité> x [<nom de l'objet>] (<total> kamas)`, avec espaces possibles comme séparateurs de
  milliers ; le prix unitaire MUST être le total divisé par la quantité, arrondi à l'unité. Une
  quantité ou un total nul, négatif ou illisible MUST rendre la ligne invalide.
- **FR-023**: Un joueur connecté MUST pouvoir coller ou déposer une capture sur la page ; le système
  MUST afficher chaque achat lu avant tout enregistrement, et le joueur MUST pouvoir corriger la
  rune, la quantité et le total, écarter une ligne, puis valider.
- **FR-024**: Le système MUST NOT enregistrer une ligne importée dont la ressource (rune ou autre
  ressource) n'est pas identifiée par un nom exact ou par un choix du joueur.
- **FR-025**: La capture MUST être lue sur l'appareil du joueur et MUST NOT être envoyée ni
  conservée ; seuls les achats validés sont enregistrés, au nom du joueur connecté.

### Key Entities

- **Profil** : un joueur du groupe identifié par son compte Discord ; pseudo, avatar, serveur Dofus,
  visibilité (public ou privé).
- **Session FM** : une séance de forgemagie ouverte dans un salon Discord ; dates d'ouverture et de
  fermeture, état, achats.
- **Achat** : une ligne d'achat relevée (nom de l'objet, quantité, total, prix unitaire), rattachée
  à un joueur Discord, à une session (ou à un import sur le site), à une origine et à la capture ou
  au message dont elle vient.
- **Rune** : une ressource du catalogue de type « Rune de forgemagie », avec la stat qu'elle modifie.
- **Prix de rune** : contribution de prix de ressource existante (specs/004, specs/024), enrichie de
  son origine.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Une capture traitée par le bot pendant une session est visible sur le site en moins
  d'une minute.
- **SC-002**: Pour 100 % des sessions reçues, le total et la dépense de chaque joueur affichés sur
  le site sont identiques au résumé `/fmstop` du bot.
- **SC-003**: Aucun compte Discord extérieur au serveur du groupe ne peut se connecter, et aucun
  envoi sans clé valide n'est accepté (100 % des cas).
- **SC-004**: Aucune information sur un joueur privé (nom, avatar, profil) n'est visible par un
  autre membre.
- **SC-005**: Un joueur relève les prix de 10 runes à partir d'une seule capture collée sur le site
  en moins d'une minute.
- **SC-006**: Les pages existantes du site restent utilisables sans connexion, sans changement de
  comportement.

## Assumptions

- **Le bot est modifié par son auteur** pour envoyer les événements de session au service de
  l'app ; l'app fournit la clé secrète et un format d'envoi documenté. Le bot garde son
  fonctionnement actuel dans Discord et sa propre lecture des captures ; l'app ne lit pas Discord.
- La connexion au site utilise l'application Discord du bot (ou une application Discord du groupe),
  ce qui permet de vérifier l'appartenance au serveur Discord du groupe.
- Le groupe est petit et fermé (~10-20 joueurs) : une clé unique pour le bot suffit.
- La dépense d'un joueur est celle que calcule le bot (somme des montants en kamas lus sur ses
  captures pendant la session), pour que le site et Discord affichent les mêmes chiffres.
- Un joueur est dans un seul serveur Dofus à la fois pour ses achats ; les sessions ne portent pas
  de serveur propre.
- Le format de ligne d'achat est celui du client Dofus en français.
- Les achats importés sur le site ne sont rattachés à aucune session Discord.
- Hors périmètre : calcul de brisage, simulateur de forgemagie, coût par point de stat, connexion
  obligatoire sur les autres pages, modification du code du bot (fait par son auteur).
