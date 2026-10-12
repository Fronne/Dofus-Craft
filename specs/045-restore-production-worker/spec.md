# Feature Specification: Remettre dans le dépôt le Worker de l'API tel qu'il tourne en production

**Feature Branch**: `045-restore-production-worker`

**Created**: 2026-10-12

**Status**: Draft

**Input**: User description: "Reconstituer dans le dépôt le code déjà en service en production mais dont la source a été perdue (jamais commitée). La référence est le comportement de la version actuellement en ligne : aucun changement de comportement, seulement la remise du code et de ses tests dans le dépôt."

## Contexte

Entre le 1er et le 2 octobre 2026, treize fonctionnalités (numérotées 032 à 044 dans les commentaires du
code en ligne) ont été développées dans une session distante, déployées, puis la session a été supprimée
sans que le code soit envoyé sur le dépôt. Le dépôt s'arrête à la fonctionnalité 031. Tout déploiement
fait depuis le dépôt supprimerait donc en production ce que les joueurs utilisent aujourd'hui.

Deux éléments de production ont été sauvegardés le 12 octobre 2026 dans
`backups/production-2026-10-12/` : le code lisible du Worker de l'API, et la copie du site (minifiée).

Cette fonctionnalité ne couvre que le **Worker de l'API** (prix partagés et Forgemagie), qui se récupère
presque à l'identique. Le site, minifié, sera réécrit écran par écran dans des fonctionnalités
suivantes ; d'ici là il reste servi depuis la copie sauvegardée.

Les numéros 032 à 044 sont réservés aux fonctionnalités perdues : le code remis dans le dépôt garde ses
commentaires d'origine qui les citent. La branche locale `032-visual-redesign`, sans rapport, garde son
nom.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Déployer l'API depuis le dépôt sans rien retirer aux joueurs (Priority: P1)

Le propriétaire du site déploie le Worker de l'API depuis le dépôt. Après ce déploiement, tout ce que le
site en ligne demande à l'API continue de répondre exactement comme avant.

**Why this priority**: c'est le risque à lever. Tant que le dépôt est en retard, aucun correctif ni
aucune nouveauté côté API ne peut être déployé sans casser la production.

**Independent Test**: construire le Worker depuis le dépôt et comparer le résultat, ligne à ligne, à la
sauvegarde du Worker en ligne ; les seules différences admises sont celles listées dans les exigences.

**Acceptance Scenarios**:

1. **Given** le dépôt après cette fonctionnalité, **When** on construit le Worker et qu'on le compare à
   la sauvegarde de production, **Then** le code exécuté est le même, à l'exception de l'adresse du site
   citée dans l'identifiant envoyé à Huzounet.
2. **Given** le Worker construit depuis le dépôt, **When** le site en ligne appelle chacune des routes
   qu'il utilise aujourd'hui, **Then** chaque route existe et répond avec la même forme de réponse.
3. **Given** une base de données neuve, **When** on applique le schéma et les migrations du dépôt,
   **Then** elle contient les mêmes tables et colonnes que la base de production.

---

### User Story 2 - Prix lus sur Huzounet (Priority: P1)

Pour le serveur Mikhal, l'API relit régulièrement les prix du site Huzounet (lecture autorisée par son
auteur), les garde à côté des prix partagés par les joueurs, et les sert au site quand ils sont plus
récents. Un joueur peut aussi demander l'actualisation immédiate des prix d'une recette.

**Why this priority**: c'est la fonctionnalité dont dépendent le bouton d'actualisation de la page
Recherche, déjà en ligne, et le futur chargement par onglet de la page HDV.

**Independent Test**: avec une source Huzounet simulée, lancer une lecture planifiée puis une
actualisation à la demande, et vérifier les prix servis par les routes de lecture.

**Acceptance Scenarios**:

1. **Given** la lecture activée et le serveur Mikhal utilisé, **When** le passage planifié s'exécute,
   **Then** les prix sont lus par paquets de 50 objets, une requête par seconde au plus, 12 requêtes au
   plus par passage, et le passage suivant reprend là où le précédent s'est arrêté.
2. **Given** un prix Huzounet plus récent que la dernière contribution d'un joueur, **When** le site lit
   le prix de cet objet, **Then** c'est le prix Huzounet qui est donné comme dernier prix, marqué
   d'origine externe, avec la mention « provisoire » ou « ancien » si la source le dit.
3. **Given** une contribution de joueur plus récente que le prix Huzounet, **When** le site lit le prix,
   **Then** la contribution du joueur reste le dernier prix.
4. **Given** une demande d'actualisation pour 90 objets au plus sur Mikhal, **When** aucun de ces prix
   n'a été relu depuis deux minutes, **Then** ils sont relus et la réponse indique combien ont été
   actualisés.
5. **Given** des prix tous relus depuis moins de deux minutes, **When** on demande l'actualisation,
   **Then** aucune lecture n'est faite et la réponse indique zéro prix actualisé.
6. **Given** une actualisation faite il y a moins de cinq secondes sur le même serveur, **When** on en
   demande une autre qui nécessite une lecture, **Then** elle est refusée avec « trop tôt ».
7. **Given** un serveur qui n'est pas relu, **When** on demande l'actualisation, **Then** la réponse
   indique que ce serveur n'est pas relu.
8. **Given** la lecture désactivée par configuration, **When** on demande l'actualisation ou que le
   passage planifié s'exécute, **Then** rien n'est lu et l'actualisation répond « indisponible ».
9. **Given** Huzounet qui répond par une erreur ou une réponse inattendue, **When** une lecture est en
   cours, **Then** elle s'arrête sans rien écrire de faux, et l'erreur est consignée.

---

### User Story 3 - Séances de Forgemagie (Priority: P2)

Un joueur connecté retrouve ses « séances de FM » : une séance regroupe toutes les sessions tenues dans
un même salon Discord. Il voit leur état (en cours, en pause, archivée), leur total dépensé, leur objet,
le détail de chaque capture, et peut archiver une séance, la rouvrir, ou choisir, changer et retirer son
objet.

**Why this priority**: les écrans Forgemagie en ligne s'appuient dessus ; sans ces routes la page
Forgemagie actuelle ne s'affiche plus.

**Independent Test**: avec une base de test contenant salons, sessions et captures, lire la liste et le
détail, puis archiver, rouvrir et changer l'objet d'une séance.

**Acceptance Scenarios**:

1. **Given** un joueur avec des sessions dans plusieurs salons, **When** il lit ses séances, **Then** il
   obtient une séance par salon, triées par état (en cours, en pause, archivées) puis par activité la
   plus récente, 200 au plus.
2. **Given** une séance dont le salon est actif, **When** il l'archive, **Then** ses sessions ouvertes
   sont fermées, le salon passe à archivé et une demande d'archivage est adressée au bot Discord.
3. **Given** une séance archivée et un joueur sous sa limite de salons actifs, **When** il la rouvre,
   **Then** le salon redevient actif, une nouvelle session y est ouverte, et le bot reçoit dans l'ordre
   la demande de réouverture puis la demande d'ouverture.
4. **Given** un joueur déjà à sa limite de salons actifs, **When** il rouvre une séance, **Then** la
   demande est refusée pour cause de limite atteinte.
5. **Given** une séance, **When** le joueur choisit un objet existant ou en crée un nouveau, **Then**
   l'objet devient celui de la séance ; il peut le changer ou le retirer à tout moment.
6. **Given** une séance d'un autre joueur, **When** un joueur tente de la lire ou de la modifier,
   **Then** la réponse est « introuvable ».
7. **Given** le démarrage d'une session ou la demande d'un salon, **When** le joueur fournit un nouvel
   objet au lieu d'un objet existant, **Then** l'objet est créé dans la même opération.

---

### User Story 4 - Captures : runes seules, noms rattrapés, lignes corrigées (Priority: P2)

Dans une capture d'achats, seules les lignes de runes comptent dans la dépense ; les autres lignes sont
gardées mais ignorées. Un nom d'objet mal lu (accent manquant, crochet lu comme une lettre) est rattrapé
quand il n'y a qu'un candidat. Le joueur peut corriger la quantité et le total d'une ligne ; la dépense
de la capture et le prix partagé sont alors ajustés.

**Why this priority**: ces règles changent les montants affichés aux joueurs ; les perdre fausserait
leurs dépenses.

**Independent Test**: envoyer une capture mêlant runes et autres objets, avec un nom mal lu, puis
corriger une ligne et relire la séance.

**Acceptance Scenarios**:

1. **Given** une capture envoyée par le bot avec des runes et d'autres objets, **When** elle est
   enregistrée, **Then** la dépense retenue est celle comptée par le bot, moins les lignes qui ne sont
   pas des runes et dépassent 1 000 kamas.
2. **Given** une capture importée depuis le site, **When** elle est enregistrée, **Then** la dépense est
   la somme des seules lignes de runes.
3. **Given** un nom lu sans ses accents ou avec un crochet parasite en début ou fin, **When** un seul
   objet correspond, **Then** la ligne est rattachée à cet objet et le nom lu à l'origine est conservé.
4. **Given** une ligne comptée d'une capture du joueur, **When** il corrige sa quantité ou son total,
   **Then** la ligne garde ses valeurs d'origine, est marquée corrigée, la dépense de la capture est
   ajustée de la différence, et le prix partagé correspondant est mis à jour, ou retiré s'il devient
   aberrant.
5. **Given** une correction qui redonne les valeurs d'origine, **When** elle est enregistrée, **Then**
   la ligne n'est plus marquée corrigée.
6. **Given** une correction visant une ligne d'une autre capture, ou une quantité ou un total inférieur
   à 1, **When** elle est envoyée, **Then** elle est refusée sans rien modifier.

---

### User Story 5 - Joueurs, serveur Discord et connexion en local (Priority: P3)

La liste des joueurs montre tous les joueurs publics ayant une activité, avec leur total et leurs
séances. Le profil indique le nom du serveur Discord du groupe. Un développeur peut se connecter avec
Discord depuis un site lancé en local et y être renvoyé.

**Why this priority**: compléments utiles mais non bloquants pour les écrans principaux.

**Independent Test**: lire la liste des joueurs avec un joueur public et un joueur privé ; lire son
profil après connexion ; lancer une connexion avec une adresse de retour locale.

**Acceptance Scenarios**:

1. **Given** des joueurs publics et privés, **When** un joueur lit la liste, **Then** il voit les
   joueurs publics et lui-même, seulement ceux qui ont une dépense ou une séance, triés par total
   décroissant puis par nom.
2. **Given** une connexion Discord réussie, **When** le joueur lit son profil, **Then** le nom du
   serveur Discord du groupe y figure.
3. **Given** une connexion lancée avec une adresse de retour `http://localhost` ou `http://127.0.0.1`,
   **When** elle aboutit ou échoue, **Then** le joueur est renvoyé vers cette adresse locale.
4. **Given** une adresse de retour qui n'est pas locale, **When** la connexion est lancée, **Then** elle
   est ignorée et le joueur est renvoyé vers le site officiel.
5. **Given** le bot qui signale qu'un salon a été rouvert, **When** l'événement est reçu, **Then** le
   salon archivé redevient actif.

### Edge Cases

- Un prix Huzounet marqué contesté ou exclu par sa source, ou supérieur à 2 milliards de kamas, est
  retiré plutôt qu'enregistré.
- Un prix Huzounet inconnu (sans valeur) est ignoré sans effacer le prix déjà connu.
- Le lundi, le passage planifié relit aussi la liste complète des objets connus pour découvrir de
  nouveaux prix ; les autres jours il ne relit que les objets déjà tarifés.
- Un serveur que personne n'utilise n'est pas relu.
- Les prix Huzounet qui n'ont pas été relus depuis 90 jours sont supprimés lors de la purge
  hebdomadaire.
- Un nom mal lu qui correspond à plusieurs objets après rattrapage reste « inconnu ».
- Une séance sans salon connu (salon ordinaire) porte son objet sur ses sessions.
- Une demande au bot restée sans réponse trop longtemps apparaît comme « non transmise ».

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Le dépôt MUST contenir le code source du Worker de l'API correspondant à la version en
  production sauvegardée le 12 octobre 2026.
- **FR-002**: Le Worker construit depuis le dépôt MUST être identique à cette sauvegarde, à la seule
  exception de FR-004 ; l'écart est vérifié par une comparaison ligne à ligne consignée dans le dossier
  de la fonctionnalité.
- **FR-003**: Le dépôt MUST contenir le schéma et les migrations qui amènent une base neuve à la
  structure de la base de production (tables et colonnes des prix externes, de leur suivi de lecture, du
  nom du serveur Discord, des lignes de capture corrigées, ignorées et renommées, et toute autre
  différence constatée).
- **FR-004**: L'identifiant envoyé à Huzounet MUST citer l'adresse actuelle du site
  (`dofus-craft.handy-apps.workers.dev`).
- **FR-005**: La lecture Huzounet MUST respecter les limites en production : serveur Mikhal seul,
  paquets de 50 objets, une seconde entre deux requêtes, 12 requêtes au plus par passage planifié,
  reprise par curseur.
- **FR-006**: L'actualisation à la demande MUST accepter de 1 à 90 identifiants d'objets, ne relire que
  ceux qui n'ont pas été relus depuis deux minutes, refuser deux lectures à moins de cinq secondes sur
  un même serveur, et être limitée en fréquence par adresse comme les contributions.
- **FR-007**: La lecture planifiée et l'actualisation à la demande MUST pouvoir être désactivées par une
  seule variable de configuration, déclarée dans la configuration du Worker avec la valeur en
  production.
- **FR-008**: Les lectures de prix existantes (prix d'un objet, prix de plusieurs objets, dernier prix,
  prix des objets équipables) MUST tenir compte des prix externes selon la règle « le plus récent
  l'emporte ».
- **FR-009**: Le déclenchement planifié de la lecture Huzounet MUST être déclaré dans la configuration
  du Worker, à côté de la purge hebdomadaire, avec la fréquence en production.
- **FR-010**: Les routes des séances (liste, détail, archivage, réouverture, choix et retrait de
  l'objet) et la route de correction des lignes d'une capture MUST exister avec le comportement en
  production.
- **FR-011**: Les règles de comptage des captures (runes seules, rattrapage des noms, conservation du
  nom lu) MUST être celles en production.
- **FR-012**: La liste des joueurs, le nom du serveur Discord dans le profil, le retour vers un site
  local après connexion et l'événement de réouverture d'un salon MUST se comporter comme en production.
- **FR-013**: Chaque comportement remis dans le dépôt MUST être couvert par des tests automatisés,
  écrits à partir du code en production puisque les tests d'origine sont perdus.
- **FR-014**: Les tests existants du Worker MUST continuer de passer, adaptés seulement là où le
  comportement en production diffère de celui du dépôt.
- **FR-015**: Cette fonctionnalité MUST NOT déployer quoi que ce soit ; le déploiement reste une
  décision du propriétaire, une fois la comparaison validée.
- **FR-016**: Le code du site dans le dépôt MUST NOT être modifié par cette fonctionnalité, hormis les
  corrections d'adresse déjà en attente (README, configuration, documents de specs).

### Key Entities

- **Prix externe** : prix unitaire d'un objet sur un serveur, lu sur une source extérieure (Huzounet),
  avec sa date d'observation, son niveau de confiance (provisoire, ancien), la date de sa dernière
  lecture et l'indication qu'il s'agit d'un objet équipable.
- **Suivi de lecture** : pour une source et un serveur, le jour du dernier passage, le point de reprise,
  la date de fin et la dernière erreur ; sert aussi à espacer les actualisations à la demande.
- **Listes d'objets relus** : ressources tarifables de la Forgemagie, compléments, objets équipables.
- **Séance de FM** : regroupement des sessions d'un joueur dans un même salon Discord, avec état, objet,
  total, nombre de sessions et de captures, dernière activité.
- **Ligne d'achat** : ligne d'une capture, avec le nom lu à l'origine s'il a été rattrapé, l'indication
  qu'elle compte ou non dans la dépense, et ses valeurs d'origine si elle a été corrigée.
- **Serveur Discord du groupe** : son nom, relevé à chaque connexion.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: La comparaison entre le Worker construit depuis le dépôt et la sauvegarde de production ne
  montre aucune différence de comportement, hors l'adresse du site citée à Huzounet.
- **SC-002**: 100 % des routes de l'API appelées par le site en ligne existent dans le Worker construit
  depuis le dépôt.
- **SC-003**: Une base neuve créée depuis le dépôt a la même structure que la base de production,
  vérifiée table par table.
- **SC-004**: Tous les tests automatisés du projet passent, y compris ceux ajoutés pour les
  comportements remis.
- **SC-005**: Après un déploiement fait depuis le dépôt, aucun joueur ne perd une fonction de l'API
  qu'il avait la veille.

## Assumptions

- La session distante qui contenait le code d'origine est supprimée et irrécupérable ; la sauvegarde de
  production est la seule référence.
- Le code en ligne du Worker n'est pas minifié et garde ses commentaires ; les types et les noms de
  fichiers sont rétablis à partir de lui et des conventions du dépôt.
- Le bot Discord (dépôt séparé) sait déjà traiter les demandes de réouverture et envoyer l'événement de
  salon rouvert ; il n'est pas modifié ici.
- La structure de la base de production est lue en lecture seule pour écrire les migrations ; aucune
  donnée de production n'est modifiée.
- Les valeurs de configuration en production qui ne figurent pas dans le code (activation de la lecture
  Huzounet, fréquence du passage planifié) sont relevées sur Cloudflare ou confirmées par le
  propriétaire.
- Les specs, plans et tâches d'origine des fonctionnalités 032 à 044 ne sont pas réécrits ; cette spec
  en tient lieu pour la partie Worker.
- Le site reste servi depuis la copie sauvegardée tant que ses écrans ne sont pas réécrits ; la
  réécriture du site et le bouton de chargement par onglet de la page HDV sont hors périmètre.
