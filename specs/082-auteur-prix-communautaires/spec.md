# Spécification : Auteur et date des prix communautaires

**Branche** : `082-auteur-prix-communautaires`

**Créée le** : 2026-11-02

**Statut** : Brouillon

**Entrée** : « Auteur et date des prix communautaires. Aujourd'hui les prix communautaires sont anonymes. Quand un utilisateur connecté met à jour un prix communautaire, enregistrer qui l'a saisi et quand, et l'afficher sur les prix sous la forme « par Pseudo · il y a 2 h ». Le pseudo est celui de Discord, partagé par défaut. Les visiteurs non connectés saisissent toujours des prix de façon anonyme. Les anciens prix restent sans auteur. Un profil privé n'affiche pas son nom. Section « Mes contributions » dans Mon profil. La suppression du profil rend les prix anonymes. Ni classement des contributeurs ni limitation par compte. »

## Scénarios utilisateur et tests *(obligatoire)*

### User Story 1 - Voir qui a mis un prix à jour, et quand (Priorité : P1)

Quand un utilisateur consulte un prix communautaire (prix d'une ressource ou d'un objet dans la rentabilité, l'HDV, la recherche ou les autres pages qui en affichent), il voit à côté du prix la mention « par Pseudo · il y a 2 h » lorsque la dernière personne ayant mis ce prix à jour était connectée et n'a pas choisi de rester anonyme. Si le prix a été saisi par un visiteur anonyme, ou par un profil privé, ou s'il date d'avant cette fonctionnalité, seule la date est affichée (« il y a 2 h »), sans nom.

**Pourquoi cette priorité** : c'est la demande. Savoir qui a saisi un prix, et depuis combien de temps, permet de juger s'il est frais et fiable.

**Test indépendant** : un utilisateur connecté saisit un prix ; une autre personne ouvre la page de ce prix et voit « par Pseudo · il y a quelques instants » ; un visiteur anonyme saisit ensuite un autre prix et la mention du nom disparaît, remplacée par la seule date.

**Scénarios d'acceptation** :

1. **Étant donné** un utilisateur connecté, public, qui saisit un prix communautaire, **quand** n'importe qui consulte ce prix, **alors** la mention « par <pseudo Discord> · il y a <durée> » est affichée à côté du prix.
2. **Étant donné** un visiteur non connecté qui saisit un prix, **quand** n'importe qui consulte ce prix, **alors** seule la durée est affichée, sans nom.
3. **Étant donné** un prix saisi avant la mise en ligne de la fonctionnalité, **quand** il est consulté, **alors** il s'affiche comme avant, avec sa date si elle est connue et sans nom.
4. **Étant donné** un prix mis à jour successivement par deux personnes, **quand** il est consulté, **alors** la mention désigne la dernière personne qui l'a mis à jour et la date de cette mise à jour.
5. **Étant donné** que le prix affiché est une valeur calculée à partir de plusieurs saisies (une médiane), **quand** il est consulté, **alors** la mention désigne l'auteur et la date de la saisie la plus récente prise en compte.

---

### User Story 2 - Rester anonyme avec un profil privé (Priorité : P1)

Un utilisateur connecté dont le profil est réglé sur « privé » (réglage existant) saisit des prix comme les autres, mais son nom n'est jamais affiché sur ses prix : seule la date apparaît. Il peut changer ce réglage depuis Mon profil. Le choix s'applique à l'affichage, y compris pour les prix saisis avant le changement.

**Pourquoi cette priorité** : afficher un pseudo sans consentement serait un recul pour la vie privée ; le réglage existant doit être respecté dès le premier jour.

**Test indépendant** : un utilisateur passe son profil en privé, saisit un prix, et un autre visiteur ne voit que la durée ; il repasse en public et le même prix affiche à nouveau son pseudo.

**Scénarios d'acceptation** :

1. **Étant donné** un utilisateur au profil privé, **quand** il saisit un prix et que quelqu'un le consulte, **alors** aucun nom n'est affiché, seulement la durée.
2. **Étant donné** un utilisateur qui passe de public à privé, **quand** quelqu'un consulte ses prix déjà saisis, **alors** son nom n'est plus affiché.
3. **Étant donné** un utilisateur qui passe de privé à public, **quand** quelqu'un consulte ses prix, **alors** son pseudo est affiché.
4. **Étant donné** la page Mon profil, **quand** l'utilisateur ouvre le réglage de confidentialité, **alors** une phrase lui dit que ce réglage décide de l'affichage de son pseudo sur les prix qu'il saisit.

---

### User Story 3 - Mes contributions dans Mon profil (Priorité : P2)

La page Mon profil contient une section « Mes contributions » : le nombre de prix que l'utilisateur a saisis et qui sont encore conservés (les prix sont supprimés après 90 jours), et la liste de ses derniers prix (nom de la ressource ou de l'objet, serveur, montant, date). Cela lui permet de retrouver ce qu'il a saisi.

**Pourquoi cette priorité** : c'est un retour direct pour l'utilisateur, utile mais non indispensable pour la valeur principale (US1).

**Test indépendant** : un utilisateur connecté saisit trois prix ; sa page Mon profil indique trois contributions et liste ces prix du plus récent au plus ancien.

**Scénarios d'acceptation** :

1. **Étant donné** un utilisateur connecté qui a saisi des prix, **quand** il ouvre Mon profil, **alors** il voit le nombre de ses contributions et la liste de ses derniers prix, du plus récent au plus ancien.
2. **Étant donné** un utilisateur connecté qui n'a rien saisi, **quand** il ouvre Mon profil, **alors** la section indique qu'il n'a encore saisi aucun prix.
3. **Étant donné** un utilisateur au profil privé, **quand** il consulte ses contributions, **alors** il les voit toutes ; la confidentialité ne limite que l'affichage aux autres.
4. **Étant donné** un visiteur non connecté, **quand** il ouvre Mon profil, **alors** il voit l'invitation à se connecter, sans section de contributions.

---

### User Story 4 - Suppression du profil (Priorité : P2)

Quand l'utilisateur supprime son profil, ses prix restent dans la base commune (ils servent au groupe) mais perdent leur auteur : ils s'affichent désormais comme des prix anonymes avec leur date. Plus rien dans le système ne relie ces prix à la personne.

**Pourquoi cette priorité** : la suppression existe déjà ; elle doit couvrir cette nouvelle donnée pour rester honnête.

**Test indépendant** : un utilisateur saisit un prix, supprime son profil ; le prix est toujours affiché, mais sans nom.

**Scénarios d'acceptation** :

1. **Étant donné** un utilisateur qui a saisi des prix, **quand** il supprime son profil après confirmation, **alors** ses prix restent consultables mais ne montrent plus aucun nom.
2. **Étant donné** un utilisateur qui supprime son profil puis se reconnecte avec le même compte Discord, **quand** il consulte ses anciens prix, **alors** ils ne lui sont pas rattachés de nouveau.

---

### Cas limites

- Un visiteur non connecté saisit un prix : il reste possible, sans compte, et le prix est anonyme.
- Un utilisateur dont la session a expiré saisit un prix : le prix est enregistré de façon anonyme, sans erreur bloquante, et la page lui indique qu'il n'est plus connecté s'il le faut.
- Le service de connexion ou la base du profil ne répond pas au moment de la saisie : le prix est quand même enregistré, sans auteur, plutôt que refusé.
- Un utilisateur change de pseudo sur Discord : les prix affichent le nouveau pseudo après sa prochaine connexion.
- Une durée très courte ou très longue : « il y a quelques instants » en dessous d'une minute ; en jours au-delà de 24 h ; la date complète est disponible au survol.
- Un prix qui provient du bot Discord, du programme HDV des amis ou d'une capture importée avant cette fonctionnalité : il n'affiche pas d'auteur de cette fonctionnalité.
- Un prix très ancien, hors de la période de conservation : il disparaît comme aujourd'hui et ne laisse aucune trace de l'auteur.
- Un utilisateur connecté qui corrige un prix saisi par erreur : sa nouvelle saisie devient la dernière et remplace la mention.
- Un utilisateur non membre du serveur de la communauté : il peut saisir des prix avec son nom comme n'importe quel utilisateur connecté.

## Exigences *(obligatoire)*

### Exigences fonctionnelles

- **FR-001** : Quand un utilisateur connecté saisit un prix communautaire depuis le site, le système MUST enregistrer qui l'a saisi et quand.
- **FR-002** : Quand un visiteur non connecté saisit un prix, le système MUST l'enregistrer sans auteur et MUST NOT refuser la saisie.
- **FR-003** : Les prix enregistrés avant cette fonctionnalité MUST rester inchangés et sans auteur.
- **FR-004** : Partout où le site affiche un prix communautaire (rentabilité, HDV, recherche, autres pages concernées), il MUST afficher à côté du prix la durée écoulée depuis la dernière saisie, et le pseudo Discord de son auteur quand il existe et que son profil est public.
- **FR-005** : La mention MUST prendre la forme « par <pseudo> · il y a <durée> » avec auteur, et « il y a <durée> » sans auteur ; la date complète MUST être consultable au survol ou au toucher.
- **FR-006** : Quand le prix affiché résulte de plusieurs saisies, la mention MUST désigner l'auteur et la date de la saisie la plus récente prise en compte.
- **FR-007** : Le pseudo affiché MUST être celui de Discord, à jour de la dernière connexion de l'utilisateur.
- **FR-008** : Si le profil de l'auteur est privé, le prix MUST s'afficher sans nom, avec la durée seulement ; ce choix MUST s'appliquer à tous les prix de l'utilisateur, passés et futurs, dès qu'il le change.
- **FR-009** : L'utilisateur MUST pouvoir changer la confidentialité de son profil depuis Mon profil, avec une phrase expliquant qu'elle décide de l'affichage de son nom sur ses prix.
- **FR-010** : Mon profil MUST contenir une section « Mes contributions » indiquant le nombre de prix saisis par l'utilisateur et la liste de ses derniers prix (nom, serveur, montant, date), du plus récent au plus ancien, avec un état vide explicite.
- **FR-011** : La suppression du profil MUST retirer tout lien entre l'utilisateur et ses prix ; les prix MUST rester consultables comme des prix anonymes avec leur date.
- **FR-012** : Une saisie dont la session de l'utilisateur est expirée ou invalide MUST être enregistrée comme anonyme et MUST NOT échouer à cause de cela.
- **FR-013** : Le système MUST NOT afficher ni exposer l'identifiant Discord d'un auteur : seul le pseudo public (ou rien) est visible des autres utilisateurs.
- **FR-014** : La fonctionnalité MUST NOT ajouter de classement des contributeurs ni de limitation du nombre de saisies par compte.
- **FR-015** : L'ajout de l'auteur et de la date MUST NOT changer le calcul des prix (médiane, valeurs aberrantes, derniers prix) ni les prix affichés.

### Entités clés

- **Prix communautaire** : montant saisi pour une ressource ou un objet sur un serveur de jeu, avec sa date de saisie et son origine (saisie manuelle sur le site, capture importée, bot, programme HDV des amis). Il peut avoir un auteur.
- **Auteur d'un prix** : lien optionnel entre un prix et un profil utilisateur, établi à la saisie par un utilisateur connecté. Il est rompu par la suppression du profil.
- **Profil utilisateur** : défini par la spec 075 ; fournit le pseudo Discord et le réglage de confidentialité (public ou privé) qui décide de l'affichage du nom.
- **Mention de mise à jour** : texte affiché à côté d'un prix, « par <pseudo> · il y a <durée> » ou « il y a <durée> ».

## Critères de réussite *(obligatoire)*

### Résultats mesurables

- **SC-001** : 100 % des prix saisis par un utilisateur connecté au profil public affichent son pseudo et une durée correcte sur chaque page qui montre ce prix.
- **SC-002** : 0 prix de visiteur anonyme, de profil privé, de profil supprimé ou antérieur à la fonctionnalité n'affiche de nom.
- **SC-003** : Un visiteur identifie en moins de 5 secondes, sans cliquer, qui a mis un prix à jour et depuis quand.
- **SC-004** : La saisie d'un prix ne demande aucune action supplémentaire : le temps pour saisir un prix reste identique à celui d'aujourd'hui, connecté ou non.
- **SC-005** : Après un changement de confidentialité, la mention de tous les prix de l'utilisateur est à jour au plus tard une minute après le changement, au rechargement de la page.
- **SC-006** : Après suppression d'un profil, 0 prix reste rattaché à cette personne, et 100 % de ses prix restent consultables.
- **SC-007** : Les prix et leurs valeurs affichés avant et après la mise en ligne sont identiques ; seule la mention s'ajoute.
- **SC-008** : La mention reste lisible, sans casser la mise en page, sur mobile comme sur ordinateur.

## Hypothèses

- Seuls les prix saisis depuis le site par un utilisateur connecté (saisie manuelle et capture importée par une personne connectée) reçoivent un auteur. Les prix envoyés par le bot Discord ou par le programme HDV des amis, qui ont leur propre mécanisme, restent sans auteur dans cette fonctionnalité.
- Le réglage « privé » est celui qui existe déjà dans le profil (spec 025/030 pour la Forgemagie, repris par la spec 075) ; il décide désormais aussi de l'affichage du nom sur les prix, sans nouveau réglage.
- Le pseudo est « partagé par défaut » : un profil est public tant que l'utilisateur n'a pas choisi « privé ».
- Les prix gardent leur durée de conservation actuelle ; l'auteur disparaît avec le prix.
- Le prix qu'un utilisateur connecté a saisi avant le déploiement n'a pas d'auteur : on ne peut pas le reconstituer et on n'invente rien.
- La mention reprend le format des durées déjà utilisées ailleurs sur le site, en français.
- La limitation par compte, le classement des contributeurs, les badges et la modération par auteur sont hors périmètre ; cette fonctionnalité pose seulement l'information.
- L'identifiant d'appareil anonyme existant continue d'être enregistré avec chaque prix, comme aujourd'hui ; il ne sert pas à identifier une personne.
