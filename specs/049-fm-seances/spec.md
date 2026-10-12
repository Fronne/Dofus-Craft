# Feature Specification: Page Forgemagie en séances de FM

**Feature Branch**: `049-fm-seances`

**Created**: 2026-10-12

**Status**: Draft

**Input**: User description: "Réécrire dans le dépôt la page Forgemagie du site en ligne, perdue du code source : elle est organisée en « séances de FM » (un salon Discord privé par séance, avec ses sessions et leurs captures), avec trois onglets — Séances de FM, joueurs du groupe, Profil —, la correction des lignes d'une capture, les lignes non comptées (pas une rune) et l'archivage d'une séance. Reprendre les libellés et le comportement du site en ligne ; l'API du dépôt a déjà les routes."

## Contexte

La page Forgemagie du dépôt est restée au modèle des fonctionnalités 027 à 031 : liste de sessions,
« salons FM », « objets en FM » gérés depuis le profil. Le site en ligne l'a remplacée par un modèle plus
simple, dont le code source a été perdu (voir specs/045) :

- une **séance de FM** est un salon Discord privé du joueur ; elle porte un nom, éventuellement l'objet
  forgemagé, un état (en cours, en pause, archivée) et l'historique de ses **sessions** ;
- chaque session contient les **captures** lues, et chaque capture ses lignes d'achat de runes ;
- l'onglet du groupe montre ce que la forgemagie a coûté à chaque joueur au profil public ;
- le profil garde les réglages, les dépenses et la suppression.

L'API du dépôt sait déjà tout cela (fonctionnalité 045). Cette fonctionnalité réécrit l'écran, à
l'identique du site en ligne relevé dans `backups/production-2026-10-12/`.

**Révision des specs 027 à 031** : la gestion des « objets en FM » et des « salons FM » depuis le profil,
le récapitulatif d'un objet, la liste paginée des sessions et l'import d'une capture depuis le profil
disparaissent de l'écran, remplacés par ce qui suit. L'objet en FM se choisit, se renomme ou se retire
depuis la séance.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Retrouver ses séances de FM (Priority: P1)

Le joueur connecté voit la liste de ses séances de FM — nom ou objet, état, nombre de sessions, dernière
activité, total dépensé — et ouvre une séance pour en voir le détail : total, runes achetées, sessions,
captures, et ses achats par rune.

**Why this priority**: c'est l'écran d'accueil de la page en ligne ; sans lui, un déploiement du dépôt
retire aux joueurs l'accès à leurs séances.

**Independent Test**: avec une API simulée renvoyant deux séances, vérifier la liste, puis le détail de
l'une : tuiles de chiffres, tableau des achats, sessions dépliables et leurs captures.

**Acceptance Scenarios**:

1. **Given** un joueur connecté avec des séances, **When** il ouvre la page, **Then** l'onglet « Séances de
   FM » liste chaque séance avec son nom (ou son objet, le nom du salon en dessous), son état (« En
   cours », « En pause », « Archivée »), « N session(s) · dernière activité le … » et son total.
2. **Given** aucune séance, **When** la liste s'affiche, **Then** le joueur lit « Aucune séance de FM pour
   l'instant » et comment en créer une.
3. **Given** une séance, **When** le joueur l'ouvre, **Then** il voit son nom, son état, ses dates, quatre
   chiffres (« Total dépensé », « Runes achetées » ou « Objets achetés », « Sessions », « Captures »), le
   tableau « Achats » et la liste « Sessions (N) ».
4. **Given** une session de la séance, **When** le joueur la déplie, **Then** il voit chaque capture avec
   sa date, son origine (« Discord » ou « Site »), son montant et, dépliée, ses lignes.
5. **Given** une capture contenant des lignes qui ne sont pas des runes, **When** elle est dépliée,
   **Then** elles sont listées à part : « Non compté (pas une rune) : … ».
6. **Given** une séance en cours, **When** la page reste ouverte, **Then** la liste et le détail se
   remettent à jour seuls, sans action du joueur.
7. **Given** le détail d'une séance, **When** le joueur clique sur « Toutes les séances de FM », **Then**
   il revient à la liste.

---

### User Story 2 - Créer et conduire une séance de FM (Priority: P1)

Le joueur crée une séance depuis le site (nom, objet facultatif) : le bot crée le salon Discord et ouvre
une première session. Depuis la séance, il arrête la session, en reprend une, relance une demande non
transmise, archive la séance ou la rouvre, et importe une capture dans la session ouverte.

**Why this priority**: sans ces actions, la page ne sert qu'à lire.

**Independent Test**: avec une API simulée, créer une séance et vérifier l'attente puis l'ouverture du
détail ; puis vérifier chaque bouton d'action selon l'état renvoyé par l'API.

**Acceptance Scenarios**:

1. **Given** la liste, **When** le joueur clique sur « Nouvelle séance de FM », saisit un nom et valide
   « Créer la séance », **Then** il lit « Création du salon dans Discord… », puis la séance s'ouvre dès que
   le bot a créé le salon.
2. **Given** cinq séances non archivées, **When** il en crée une sixième, **Then** il lit qu'il doit en
   archiver une d'abord.
3. **Given** le bot ne répond pas en deux minutes, **When** l'attente s'arrête, **Then** le joueur lit que
   la séance apparaîtra dans la liste quand le bot sera disponible.
4. **Given** une session ouverte, **When** le joueur clique « Arrêter la session », **Then** elle s'arrête
   et la séance passe en pause ; « Reprendre » en ouvre une nouvelle.
5. **Given** une session dont la demande n'a pas été transmise à Discord ou a échoué, **When** la séance
   s'affiche, **Then** le bouton « Relancer » est proposé.
6. **Given** une séance active, **When** le joueur clique « Archiver la séance » et confirme, **Then** la
   séance est archivée ; « Rouvrir » la remet en service.
7. **Given** une session ouverte, **When** le joueur colle ou dépose une capture du chat et valide,
   **Then** les achats sont enregistrés dans cette session, les lignes qui ne sont pas des runes étant
   signalées comme non comptées.
8. **Given** une séance, **When** le joueur choisit, change, renomme ou retire son objet en FM, **Then**
   l'objet affiché suit.

---

### User Story 3 - Corriger une capture mal lue (Priority: P2)

Sur une capture, le joueur clique « Corriger », modifie la quantité ou le total d'une ligne et enregistre.
La dépense de la séance suit ; la valeur lue reste visible et peut être rétablie.

**Why this priority**: la lecture d'une capture se trompe parfois d'un chiffre ; sans correction, le total
d'une séance est faux pour toujours.

**Independent Test**: avec une API simulée, corriger une ligne et vérifier la demande envoyée (seules les
lignes modifiées), la marque « corrigé » et le message quand le prix corrigé n'est pas partagé.

**Acceptance Scenarios**:

1. **Given** une capture avec des lignes, **When** le joueur clique « Corriger », **Then** chaque ligne
   offre sa quantité et son total, et montre le prix unitaire recalculé.
2. **Given** une ligne modifiée, **When** il enregistre, **Then** seules les lignes modifiées sont
   envoyées, et la capture porte « corrigée ».
3. **Given** une ligne déjà corrigée, **When** la correction est rouverte, **Then** la valeur lue est
   rappelée (« lu : … ») avec « Rétablir la valeur lue ».
4. **Given** une quantité ou un total vide ou nul, **When** le joueur veut enregistrer, **Then** le bouton
   est inactif et un message dit ce qui est attendu.
5. **Given** un prix corrigé trop éloigné des relevés du groupe, **When** la correction est enregistrée,
   **Then** le joueur lit que la dépense est corrigée mais que le prix n'est pas partagé.

---

### User Story 4 - Voir ce que la FM a coûté au groupe (Priority: P2)

Le deuxième onglet, au nom du serveur Discord du groupe (ou « Joueurs »), liste les joueurs au profil
public avec leur total dépensé ; un clic sur un joueur montre ses séances (nom, objet, état, total).

**Independent Test**: avec une API simulée renvoyant trois joueurs dont un sans séance et le joueur
lui-même en privé, vérifier la liste, la marque « toi », la mention de profil privé et le dépliage.

**Acceptance Scenarios**:

1. **Given** des joueurs, **When** l'onglet s'ouvre, **Then** chacun montre son pseudo, « N séance(s) »,
   sa dernière activité et son total.
2. **Given** un joueur avec des séances, **When** on clique sur sa ligne, **Then** ses séances
   apparaissent, sans lien vers leur détail.
3. **Given** la ligne du joueur connecté, **When** elle s'affiche, **Then** elle porte « toi », et
   « profil privé : visible de toi seul » si son profil est privé.
4. **Given** personne n'a fait de FM, **When** l'onglet s'ouvre, **Then** un message le dit.

---

### User Story 5 - Régler son profil (Priority: P3)

L'onglet « Profil » montre le serveur Dofus (celui choisi pour tout le site), le choix Public / Privé avec
ce que les autres voient, les dépenses par séance et par objet acheté, et la suppression du profil.

**Acceptance Scenarios**:

1. **Given** le profil, **When** il s'affiche, **Then** le serveur Dofus est celui du site, sans menu pour
   le changer ici.
2. **Given** le joueur change de serveur avec le sélecteur du site, **When** il revient sur la page,
   **Then** le serveur de son profil suit.
3. **Given** le choix de visibilité, **When** le joueur clique « Privé » ou « Public », **Then** le réglage
   est enregistré et le texte dit ce que les autres membres voient.
4. **Given** des dépenses, **When** le profil s'affiche, **Then** elles sont rangées « Par séance de FM »
   (une ligne par séance, cliquable si elle est à lui) et « Par objet acheté ».
5. **Given** le bouton « Supprimer mon profil », **When** le joueur confirme, **Then** le profil est
   supprimé et il est déconnecté.

### Edge Cases

- API injoignable : chaque onglet dit que le service ne répond pas ; le reste du site fonctionne.
- Session expirée : le joueur revient à l'écran de connexion.
- Séance d'un autre joueur ou supprimée : « Séance de FM introuvable ».
- Archivage ou réouverture en attente, non transmis ou en échec dans Discord : un message le dit sous le
  titre de la séance.
- Capture importée pendant que la session vient d'être arrêtée : rien n'est enregistré et le message le
  dit.
- Serveur Dofus du profil non enregistré : l'import l'explique et renvoie au sélecteur du site.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La page MUST garder l'écran de connexion Discord, et dire que Discord demande l'accès à la
  liste des serveurs du joueur, dont seul le nom de celui du groupe est lu.
- **FR-002**: Connecté, le joueur MUST voir trois onglets à icône : « Séances de FM », le nom du serveur
  Discord du groupe (à défaut « Joueurs ») et « Profil ».
- **FR-003**: L'onglet Séances MUST lister les séances du joueur avec nom ou objet, état, nombre de
  sessions, dernière activité et total, et MUST se relire seul toutes les 10 secondes tant qu'une séance
  est en cours et que la page est visible.
- **FR-004**: Le détail d'une séance MUST montrer son nom, son état, ses dates, les quatre chiffres, les
  achats par objet avec leur total, et ses sessions avec leurs captures.
- **FR-005**: Les actions MUST être offertes selon ce que l'API permet : relancer, arrêter la session,
  reprendre, archiver (après confirmation), rouvrir. Un refus de l'API MUST donner un message précis
  (limite de 5 séances non archivées, session déjà ouverte, session déjà arrêtée).
- **FR-006**: La création d'une séance MUST demander un nom (30 caractères au plus) et permettre de
  choisir un objet parmi ceux du joueur ou dans le catalogue des équipements ; elle MUST attendre le bot
  en interrogeant l'API toutes les 3 secondes, 2 minutes au plus.
- **FR-007**: L'objet d'une séance MUST pouvoir être choisi, changé, renommé (40 caractères au plus) ou
  retiré depuis la séance.
- **FR-008**: L'import d'une capture MUST n'être offert que dans une séance dont une session est ouverte,
  et MUST enregistrer les achats dans cette session ; rien n'est enregistré avant « Valider ».
- **FR-009**: Une capture MUST pouvoir être corrigée ligne par ligne (quantité et total d'au moins 1) ;
  seules les lignes modifiées sont envoyées ; la valeur lue MUST rester visible et rétablissable.
- **FR-010**: Les lignes qui ne sont pas des runes MUST être montrées comme non comptées, à l'import comme
  dans la capture.
- **FR-011**: L'onglet du groupe MUST lister les joueurs que l'API renvoie, avec leurs séances
  dépliables, sans lien vers le détail d'une séance d'un autre joueur.
- **FR-012**: Le profil MUST montrer le serveur Dofus du site, le choix de visibilité et son explication,
  les dépenses par séance et par objet, et la suppression du profil après confirmation.
- **FR-013**: Le serveur du profil MUST suivre le serveur actif du site.
- **FR-014**: Tous les libellés MUST être ceux du site en ligne.
- **FR-015**: L'API MUST NOT être modifiée.

### Key Entities

- **Séance de FM** : salon Discord privé d'un joueur — nom, état, objet facultatif, totaux, dates.
- **Session** : période d'achats dans une séance — ouverte ou arrêtée, avec ses captures.
- **Capture** : une lecture du chat — origine, montant, lignes comptées, lignes non comptées.
- **Ligne d'achat** : rune, quantité, total ; valeur lue d'origine si elle a été corrigée.
- **Joueur du groupe** : pseudo, total, séances visibles.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Chaque écran de la page (connexion, trois onglets, détail d'une séance) présente les mêmes
  libellés et les mêmes actions que le site en ligne.
- **SC-002**: Créer une séance puis y importer une capture se fait sans quitter la page.
- **SC-003**: Une correction de capture met à jour le total affiché sans rechargement.
- **SC-004**: Aucune route de l'API retirée de l'écran n'est encore appelée par le site.
- **SC-005**: Les tests de la page couvrent chacun des cinq récits ; le reste de la suite ne régresse pas.

## Assumptions

- Le comportement de référence est celui du site en ligne au 12 octobre 2026.
- L'adresse de l'API reste celle de la configuration du site (`handy-apps`), pas celle figée dans la
  sauvegarde.
- Les routes de l'API que l'écran n'utilise plus (liste des sessions, objets en FM, salons) restent dans
  l'API : le bot Discord et d'anciens navigateurs peuvent encore s'en servir.
- Aucun déploiement dans cette fonctionnalité.
