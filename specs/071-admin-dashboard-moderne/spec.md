# Spécification : Tableau de bord d'administration moderne et activation de toutes les pages

**Branche** : `071-admin-dashboard-moderne`

**Créée le** : 2026-10-23

**Statut** : Brouillon

**Demande** : « J'aimerais un tableau de bord plus moderne à l'image de celui-ci [capture « Vision UI »] et,
pour les pages à activer / désactiver, rajoute toutes les pages du site. »

## Contexte

Le tableau de bord de l'administration (specs 068 et 070) est fonctionnel mais sobre : une grille de cartes
de même poids, sans hiérarchie. La capture fournie montre le style attendu : fond sombre aux dégradés
bleu-vert, une rangée de petites cartes de chiffres clés en haut, de grandes cartes arrondies pour les
graphiques, des panneaux aérés et lisibles.

Par ailleurs, la section « Pages du site » ne permet aujourd'hui d'activer ou désactiver que deux pages
(Forgemagie et HDV) sur les sept de la navigation : Recherche, Suivis, Rentabilité, HDV, XP Familier,
Forgemagie et Brisage. Le propriétaire veut pouvoir couper n'importe laquelle.

## Scénarios utilisateur et tests *(obligatoire)*

### Parcours 1 - Activer ou désactiver n'importe quelle page du site (Priorité : P1)

Dans la section « Pages du site », l'administrateur voit la liste des sept pages, chacune avec son état
(activée / désactivée) et un bouton pour la changer. Une page désactivée disparaît de la navigation du
site public ; si quelqu'un ouvre son adresse, il voit une page « momentanément indisponible » au lieu de
son contenu. Les données des visiteurs liées à la page (suivis, séances, prix) sont conservées.

**Pourquoi cette priorité** : c'est une fonction de contrôle réelle (couper une page cassée ou en
chantier) et la demande la plus concrète. Elle est indépendante du changement visuel.

**Test indépendant** : désactiver « Brisage » ; son lien disparaît de la navigation publique et son
adresse affiche « indisponible » ; la réactiver la rend à nouveau accessible, avec ses données intactes.

**Scénarios d'acceptation** :

1. **Étant donné** la section « Pages du site », **quand** elle s'ouvre, **alors** les sept pages sont listées
   avec leur état actuel, en texte et pas seulement par une couleur.
2. **Étant donné** une page activée, **quand** l'administrateur la désactive, **alors** son lien disparaît de
   la navigation publique et son adresse affiche une page « indisponible » avec un lien de retour vers une
   page encore active.
3. **Étant donné** une page désactivée, **quand** l'administrateur la réactive, **alors** elle réapparaît dans
   la navigation et retrouve ses données.
4. **Étant donné** que Forgemagie et HDV ont déjà un état enregistré, **alors** ces deux états sont conservés
   tels quels (Forgemagie désactivée et HDV activée par défaut tant que rien n'a été enregistré), et les
   cinq autres pages sont activées par défaut.
5. **Étant donné** que l'enregistrement d'un changement échoue, **alors** un message l'indique et l'état
   affiché reste celui réellement enregistré.
6. **Étant donné** que l'administrateur désactive la dernière page encore active, **alors** il est averti
   avant de confirmer, et le site public indique qu'aucune page n'est disponible plutôt que de rester vide.

---

### Parcours 2 - Un tableau de bord moderne, lisible d'un coup d'œil (Priorité : P1)

L'administrateur ouvre la page et voit un tableau de bord dans l'esprit de la capture : en haut, une rangée
de cartes de chiffres clés (par exemple pages actives, lignes ajoutées ce mois-ci, visiteurs du jour,
consommation Cloudflare du jour) ; dessous, de grandes cartes arrondies pour les graphiques (courbe
Cloudflare, lignes par clé, prix communautaires, visites) ; puis les autres cartes en plus petit. L'ensemble
est aéré, avec des dégradés et une lueur discrète autour des cartes.

**Pourquoi cette priorité** : c'est le cœur de la demande visuelle ; sans elle le tableau de bord reste tel
qu'il est.

**Test indépendant** : ouvrir la page et vérifier la rangée de chiffres clés en haut, les grandes cartes de
graphiques puis les cartes secondaires, chaque carte ouvrant sa section comme avant.

**Scénarios d'acceptation** :

1. **Étant donné** que la page s'ouvre, **alors** une rangée de chiffres clés apparaît en haut, suivie des
   grandes cartes de graphiques, puis des cartes secondaires.
2. **Étant donné** un chiffre clé dont la source est indisponible, **alors** il l'indique (« Indisponible »)
   sans valeur inventée et sans bloquer les autres.
3. **Étant donné** un chiffre clé lié à une section (par exemple pages actives), **quand** l'administrateur
   clique dessus, **alors** la section correspondante s'ouvre comme aujourd'hui.
4. **Étant donné** un état d'alerte (consommation Cloudflare proche ou au-dessus de la limite), **alors** il
   reste signalé en texte en plus de la couleur et de la lueur.
5. **Étant donné** que l'administrateur choisit le thème clair, **alors** le tableau de bord reste lisible et
   cohérent (le style sombre de la capture est le thème par défaut).

---

### Parcours 3 - Aucune perte de fonctionnalité, sur ordinateur comme sur téléphone (Priorité : P2)

Tout ce que faisait le tableau de bord avant continue de fonctionner : cartes cliquables vers leurs
sections, graphiques et tableaux de valeurs, sélecteur de mois, navigation par l'adresse et bouton
« précédent », focus au clavier. La mise en page s'adapte : plusieurs colonnes sur grand écran, une seule sur
téléphone, sans défilement horizontal.

**Pourquoi cette priorité** : protège les specs 068 et 070 pendant la refonte.

**Test indépendant** : parcourir chaque section, utiliser « précédent », naviguer au clavier et ouvrir la page
à 375 px de large.

**Scénarios d'acceptation** :

1. **Étant donné** la refonte, **quand** l'administrateur utilise chaque carte, graphique et section, **alors**
   le comportement est identique à celui des specs 068 et 070.
2. **Étant donné** un écran de téléphone, **alors** les cartes passent en une colonne, sans défilement
   horizontal de la page.
3. **Étant donné** la navigation au clavier, **alors** chaque carte et chaque contrôle est atteignable avec un
   focus visible.

---

### Cas limites

- Réglage jamais enregistré pour une page : sa valeur par défaut s'applique (activée, sauf Forgemagie).
- Désactiver la page par défaut du site : l'adresse d'accueil et les liens « retour » orientent vers une page
  encore active ; si aucune ne l'est, un message dédié s'affiche.
- Un visiteur qui a une page ouverte quand elle est désactivée la voit devenir indisponible à son prochain
  chargement ; ses données locales ne sont pas effacées.
- La page Paramètres du site n'est pas concernée : elle reste toujours accessible.
- Une page désactivée n'apparaît plus dans les titres d'onglet, liens internes ni suggestions de navigation.
- Chiffre clé à zéro : affiché « 0 », pas masqué.
- Écran étroit, thème clair, lecteur d'écran : voir Parcours 3 et Parcours 2, scénario 5.

## Exigences *(obligatoire)*

### Exigences fonctionnelles

- **FR-001** : La section « Pages du site » DOIT lister les sept pages du site (Recherche, Suivis,
  Rentabilité, HDV, XP Familier, Forgemagie, Brisage) avec leur état en texte et un moyen de l'activer ou de
  la désactiver.
- **FR-002** : Une page désactivée DOIT disparaître de la navigation du site public, et son adresse DOIT
  afficher une page « momentanément indisponible » avec un lien vers une page encore active.
- **FR-003** : Désactiver une page NE DOIT supprimer aucune donnée des visiteurs ; la réactiver DOIT la
  rendre telle qu'avant.
- **FR-004** : Les états déjà enregistrés pour Forgemagie et HDV DOIVENT être conservés ; sans état enregistré,
  Forgemagie est désactivée et les six autres pages sont activées.
- **FR-005** : Un changement d'état DOIT être pris en compte par le site public sans redéploiement, avec le
  même délai de prise en compte que les réglages actuels.
- **FR-006** : Désactiver la dernière page active DOIT demander une confirmation, et le site public DOIT alors
  afficher un message clair plutôt qu'un écran vide.
- **FR-007** : La page d'accueil du site DOIT mener à la première page encore active quand la page de
  recherche est désactivée.
- **FR-008** : Le tableau de bord DOIT présenter, du haut vers le bas, une rangée de chiffres clés, de
  grandes cartes de graphiques, puis les cartes secondaires, dans un style sombre à dégradés bleu-vert, cartes
  arrondies et lueur discrète, inspiré de la capture fournie.
- **FR-009** : La rangée de chiffres clés DOIT afficher au moins : pages actives sur le total, lignes de prix
  ajoutées ce mois-ci par les clés, visiteurs du jour, et niveau de consommation Cloudflare du jour.
- **FR-010** : Chaque chiffre clé DOIT indiquer « Indisponible » si sa source l'est, sans valeur inventée, et
  DOIT mener à la section correspondante quand il en existe une.
- **FR-011** : Les graphiques, tableaux de valeurs, cartes et sections des specs 068 et 070 DOIVENT être
  conservés avec le même comportement (aucune régression).
- **FR-012** : Aucun état NE DOIT reposer sur la couleur seule : un texte accompagne les alertes, les états
  activée / désactivée et les valeurs indisponibles.
- **FR-013** : Le tableau de bord DOIT rester lisible en thème clair et en thème sombre, sur téléphone (une
  colonne, sans défilement horizontal) et au clavier avec un focus visible.
- **FR-014** : La refonte NE DOIT PAS ajouter de dépendance de bibliothèque d'interface et NE DOIT PAS
  ralentir sensiblement l'ouverture de la page : les cartes déjà prêtes s'affichent sans attendre les autres.

### Entités clés

- **Page du site** : l'une des sept pages de la navigation ; attributs : nom, adresse, état (activée ou
  désactivée), état par défaut.
- **Chiffre clé** : une carte de la rangée supérieure ; attributs : titre, valeur, état (normal,
  avertissement, dépassé, indisponible), section cible éventuelle.
- **Réglage des pages** : ensemble des états des sept pages, enregistré par le propriétaire.

## Critères de réussite *(obligatoire)*

### Résultats mesurables

- **SC-001** : L'administrateur active ou désactive n'importe laquelle des sept pages en moins de 10 secondes
  depuis l'ouverture de la section, et le site public reflète le changement dès le chargement suivant.
- **SC-002** : 100 % des pages désactivées sont absentes de la navigation publique et affichent « indisponible »
  à leur adresse ; 0 donnée de visiteur n'est perdue.
- **SC-003** : Depuis l'ouverture de la page, l'administrateur voit les quatre chiffres clés et les grandes
  cartes de graphiques sans ouvrir de section.
- **SC-004** : 100 % des fonctions des specs 068 et 070 restent utilisables après la refonte.
- **SC-005** : Aucun défilement horizontal de la page à 375 px de large, en thème clair comme sombre.
- **SC-006** : Une alerte (limite Cloudflare, source indisponible) est repérable sans percevoir les couleurs.

## Hypothèses

- L'administrateur est la seule personne concernée ; l'accès à la page reste protégé comme aujourd'hui.
- Les « sept pages » sont celles de la navigation actuelle ; la page Paramètres reste toujours accessible et
  n'est pas désactivable.
- Les cinq pages nouvellement désactivables sont activées par défaut ; Forgemagie reste désactivée par
  défaut et HDV activée, comme aujourd'hui.
- Le style visé est celui de la capture (sombre, dégradés bleu-vert, lueur) ; le thème clair existant est
  adapté pour rester cohérent, sans refonte propre.
- Les chiffres clés réutilisent des données déjà lues par le tableau de bord ; aucune nouvelle collecte.
- Les graphiques existants gardent leur contenu ; seule leur mise en page et leur habillage changent.
- Hors périmètre : refonte de la partie publique du site, édition du contenu des pages, nouveaux graphiques,
  menu latéral façon capture (la navigation par cartes et sections reste celle de la spec 068).
