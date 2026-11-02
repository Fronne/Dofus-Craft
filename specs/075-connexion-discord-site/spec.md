# Spécification : Connexion Discord pour tout le site

**Branche** : `075-connexion-discord-site`

**Créée le** : 2026-11-02

**Statut** : Brouillon

**Entrée** : « Connexion Discord pour tout le site (sans mot de passe). Aujourd'hui la connexion Discord n'existe que pour la Forgemagie et exige d'être membre du serveur Discord de la communauté. Généraliser la connexion à tout le site, lever l'obligation d'être membre du serveur pour la connexion générale (la garder là où elle est utile), ajouter une icône de classe Dofus au profil, et permettre à la page du bot et aux autres fonctionnalités de s'appuyer sur ce même profil. »

## Scénarios utilisateur et tests *(obligatoire)*

### User Story 1 - Se connecter depuis n'importe quelle page (Priorité : P1)

Un visiteur voit, dans la barre de navigation de n'importe quelle page, un bouton « Se connecter avec Discord ». Il clique, autorise l'accès sur Discord, puis revient sur la page où il se trouvait. Il est alors identifié : son pseudo et son avatar Discord apparaissent dans la barre de navigation. Aucun mot de passe n'est demandé sur le site. N'importe quel utilisateur Discord peut se connecter, qu'il soit ou non membre du serveur de la communauté.

**Pourquoi cette priorité** : c'est le cœur de la demande. Sans elle, aucune autre fonctionnalité ne peut s'appuyer sur une identité.

**Test indépendant** : depuis une page quelconque (hors Forgemagie), un utilisateur Discord non membre du serveur de la communauté se connecte et voit son pseudo et son avatar dans la barre de navigation, sur cette page puis sur les autres.

**Scénarios d'acceptation** :

1. **Étant donné** un visiteur non connecté sur une page du site, **quand** il clique sur « Se connecter avec Discord » et autorise l'accès, **alors** il revient sur la même page, connecté, avec son pseudo et son avatar Discord dans la barre de navigation.
2. **Étant donné** un utilisateur Discord qui n'est pas membre du serveur de la communauté, **quand** il se connecte depuis une page générale, **alors** la connexion réussit sans message d'erreur.
3. **Étant donné** un utilisateur connecté, **quand** il change de page ou recharge le site, **alors** il reste connecté.
4. **Étant donné** un visiteur qui refuse l'autorisation sur Discord, **quand** il revient sur le site, **alors** il reste non connecté et un message clair lui indique que la connexion a été annulée, sans perdre la page où il se trouvait.

---

### User Story 2 - Menu profil et déconnexion (Priorité : P1)

Une fois connecté, l'utilisateur ouvre un menu depuis son pseudo/avatar dans la barre de navigation. Il y trouve un accès à son profil et un bouton de déconnexion. Après déconnexion, le site le traite à nouveau comme un visiteur.

**Pourquoi cette priorité** : une connexion sans moyen de se déconnecter n'est pas acceptable, notamment sur un ordinateur partagé.

**Test indépendant** : un utilisateur connecté ouvre le menu, se déconnecte, et le bouton « Se connecter avec Discord » réapparaît ; recharger la page ne le reconnecte pas.

**Scénarios d'acceptation** :

1. **Étant donné** un utilisateur connecté, **quand** il ouvre le menu de son pseudo, **alors** il voit au minimum « Mon profil » et « Se déconnecter ».
2. **Étant donné** un utilisateur connecté, **quand** il clique sur « Se déconnecter », **alors** le site le traite comme un visiteur sur toutes les pages, y compris après rechargement.
3. **Étant donné** un utilisateur connecté en petit écran, **quand** il consulte la barre de navigation, **alors** le bouton de connexion, l'avatar et le menu restent accessibles sans casser la mise en page.

---

### User Story 3 - Choisir son icône de classe (Priorité : P2)

Dans son profil, l'utilisateur choisit une icône parmi les classes Dofus. Cette icône est enregistrée avec son profil et affichée à côté de son pseudo (barre de navigation, profil), en complément de son avatar Discord. Il peut la changer ou la retirer à tout moment.

**Pourquoi cette priorité** : c'est la personnalisation voulue, mais elle n'est utile qu'une fois la connexion en place.

**Test indépendant** : un utilisateur connecté choisit une classe, recharge la page, se reconnecte depuis un autre navigateur, et retrouve la même icône.

**Scénarios d'acceptation** :

1. **Étant donné** un utilisateur connecté sans icône choisie, **quand** il ouvre son profil, **alors** il voit la liste des classes disponibles et peut en choisir une.
2. **Étant donné** un utilisateur qui a choisi une classe, **quand** il recharge le site ou se connecte depuis un autre appareil, **alors** son icône de classe est toujours affichée.
3. **Étant donné** un utilisateur qui a une icône, **quand** il la retire, **alors** seul son avatar Discord est affiché.

---

### User Story 4 - Un seul profil pour toutes les fonctionnalités (Priorité : P2)

La page du bot Discord et les fonctionnalités du site qui ont besoin d'une identité (dont la Forgemagie) utilisent la même connexion et le même profil. L'utilisateur ne se connecte qu'une seule fois pour tout le site. Les fonctionnalités réservées aux membres du serveur de la communauté (comme la Forgemagie) continuent de vérifier l'appartenance au serveur ; un utilisateur connecté mais non membre y voit une explication claire plutôt qu'une erreur de connexion.

**Pourquoi cette priorité** : elle évite de multiplier les connexions, mais dépend des deux premières histoires.

**Test indépendant** : un utilisateur connecté depuis la page d'accueil ouvre la Forgemagie sans devoir se reconnecter ; un utilisateur connecté non membre y voit le message d'accès réservé.

**Scénarios d'acceptation** :

1. **Étant donné** un utilisateur connecté et membre du serveur de la communauté, **quand** il ouvre la Forgemagie, **alors** il y accède sans nouvelle connexion.
2. **Étant donné** un utilisateur connecté mais non membre du serveur, **quand** il ouvre la Forgemagie, **alors** il voit un message expliquant que cette fonctionnalité est réservée aux membres du serveur, avec le moyen de le rejoindre si disponible.
3. **Étant donné** un utilisateur qui s'était connecté via la Forgemagie avant cette évolution, **quand** il revient sur le site, **alors** il est toujours connecté, son profil et ses séances sont intacts.
4. **Étant donné** la page du bot Discord, **quand** un utilisateur connecté l'ouvre, **alors** elle le reconnaît via le même profil sans lui redemander de se connecter.

---

### Cas limites

- Le service Discord est indisponible ou lent pendant la connexion : le visiteur revient sur le site avec un message d'échec compréhensible et peut réessayer ; le site reste utilisable sans connexion.
- Le jeton de session est expiré ou révoqué : l'utilisateur est traité comme un visiteur et le bouton de connexion réapparaît, sans message d'erreur bloquant.
- L'utilisateur change de pseudo ou d'avatar sur Discord : le site affiche les valeurs à jour après sa prochaine connexion.
- L'utilisateur est connecté dans deux onglets et se déconnecte dans l'un : l'autre onglet cesse d'être connecté au plus tard à sa prochaine action ou à son prochain chargement.
- L'utilisateur supprime son profil (déjà possible pour la Forgemagie) : la connexion, l'icône et ses données de profil sont supprimées pour tout le site, après confirmation.
- Un compte Discord sans avatar : un avatar par défaut est affiché.
- Un utilisateur quitte le serveur de la communauté après s'être connecté : il reste connecté au site mais perd l'accès aux fonctionnalités réservées aux membres.

## Exigences *(obligatoire)*

### Exigences fonctionnelles

- **FR-001** : Le site MUST afficher dans la barre de navigation, sur toutes les pages, un bouton « Se connecter avec Discord » pour un visiteur non connecté.
- **FR-002** : La connexion MUST se faire uniquement via Discord ; le site MUST NOT demander ni stocker de mot de passe.
- **FR-003** : Après la connexion, l'utilisateur MUST revenir sur la page d'où il est parti.
- **FR-004** : La connexion générale MUST être ouverte à tout utilisateur Discord, sans exiger d'être membre du serveur de la communauté.
- **FR-005** : Les fonctionnalités réservées aux membres du serveur (dont la Forgemagie) MUST continuer de vérifier l'appartenance au serveur et MUST expliquer clairement l'accès refusé à un utilisateur connecté non membre.
- **FR-006** : Une fois connecté, le site MUST afficher le pseudo et l'avatar Discord de l'utilisateur dans la barre de navigation, avec l'icône de classe si elle est choisie.
- **FR-007** : Le site MUST proposer un menu pour l'utilisateur connecté donnant accès au profil et à la déconnexion.
- **FR-008** : La déconnexion MUST mettre fin à la session pour l'ensemble du site.
- **FR-009** : L'état de connexion MUST être partagé par toutes les pages et fonctionnalités : une seule connexion suffit.
- **FR-010** : L'utilisateur MUST pouvoir choisir, changer et retirer une icône de classe Dofus dans son profil, parmi la liste des classes du jeu.
- **FR-011** : L'icône de classe choisie MUST être conservée avec le profil et retrouvée sur tout appareil où l'utilisateur se connecte.
- **FR-012** : La page du bot Discord et les autres fonctionnalités nécessitant une identité MUST utiliser le même profil que la connexion générale.
- **FR-013** : Les utilisateurs déjà connectés via la Forgemagie MUST rester connectés, et leurs données de profil et de séances MUST être conservées.
- **FR-014** : Le site MUST rester entièrement utilisable sans connexion pour les fonctionnalités qui n'exigent pas d'identité.
- **FR-015** : En cas d'échec ou d'annulation de la connexion, le site MUST afficher un message clair, distinguer « refus/annulation » de « service indisponible », et permettre de réessayer.
- **FR-016** : Le site MUST ne conserver que les informations de profil nécessaires (identifiant Discord, pseudo, avatar, icône de classe, préférences existantes) et MUST permettre à l'utilisateur de supprimer son profil après confirmation.
- **FR-017** : Les secrets de connexion et les jetons MUST NOT apparaître dans l'adresse affichée, l'historique du navigateur ni les journaux visibles côté client.

### Entités clés

- **Profil utilisateur** : identité d'une personne connectée. Contient l'identifiant Discord, le pseudo, l'avatar, l'icône de classe choisie, le serveur de jeu actif et la préférence de confidentialité déjà existante. Il est unique par compte Discord et partagé par toutes les fonctionnalités.
- **Session** : preuve de connexion d'un navigateur donné, liée à un profil, révocable par la déconnexion ou la suppression du profil.
- **Classe Dofus** : élément de la liste fermée des classes du jeu, avec un nom et une icône ; le profil en référence au plus une.
- **Appartenance au serveur communautaire** : information distincte de la connexion, vérifiée seulement par les fonctionnalités qui l'exigent.

## Critères de réussite *(obligatoire)*

### Résultats mesurables

- **SC-001** : Un visiteur peut se connecter depuis n'importe quelle page en moins de 30 secondes (hors saisie des identifiants Discord) et revient sur la page de départ dans 100 % des cas.
- **SC-002** : 100 % des utilisateurs Discord, membres ou non du serveur de la communauté, peuvent se connecter depuis une page générale.
- **SC-003** : 100 % des utilisateurs déjà connectés à la Forgemagie avant la mise en ligne restent connectés, avec leurs séances et préférences intactes.
- **SC-004** : Un utilisateur connecté n'a jamais à se reconnecter pour passer d'une fonctionnalité à une autre pendant la durée de sa session.
- **SC-005** : Un utilisateur choisit son icône de classe en moins de 20 secondes depuis l'ouverture du profil et la retrouve après rechargement et sur un autre appareil.
- **SC-006** : Après déconnexion, aucune page du site ne traite plus l'utilisateur comme connecté, y compris après rechargement.
- **SC-007** : La barre de navigation reste lisible et utilisable sur mobile comme sur ordinateur, avec ou sans connexion.

## Hypothèses

- La connexion Discord existante pour la Forgemagie (flux d'autorisation, sessions, profil) est la base de départ et est généralisée plutôt que remplacée.
- Seules les informations publiques d'identité Discord (identifiant, pseudo, avatar) sont nécessaires pour la connexion générale ; la vérification d'appartenance au serveur reste une étape distincte, demandée uniquement aux fonctionnalités qui l'exigent.
- Le serveur Discord de la communauté reste unique et unique référence pour les accès réservés aux membres.
- La liste des classes Dofus et leurs icônes proviennent des données de jeu déjà disponibles dans le projet ; si une icône manque pour une classe, elle est signalée comme indisponible et non inventée.
- La page du bot Discord commencée par l'utilisateur est intégrée à ce profil dans cette fonctionnalité uniquement pour la reconnaissance de la connexion ; son contenu propre reste hors périmètre.
- Les nouvelles fonctionnalités qui s'appuieront sur le profil (favoris, signalements de prix, etc.) sont hors périmètre ; cette fonctionnalité ne fournit que la base d'identité.
- Les sessions n'ont pas de durée imposée plus courte que celle de la Forgemagie actuelle.
- L'utilisateur est identifié par son compte Discord ; le pseudo affiché est celui de Discord, non modifiable sur le site.
