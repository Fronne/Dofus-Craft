# Spécification : Graphiques sur le tableau de bord de l'administration

**Branche** : `070-admin-dashboard-graphiques`

**Créée le** : 2026-10-22

**Statut** : Brouillon

**Demande** : « Sur la page d'administration, enrichir le tableau de bord existant (068-admin-dashboard)
avec des graphiques pour avoir un visuel rapide de toutes les fonctionnalités : par exemple un graphe
de la consommation Cloudflare, et un graphe des ajouts de données par les utilisateurs via les clés de
l'outil de prix HDV que l'administrateur leur a données, avec le nombre de lignes ajoutées sur le mois,
par clé/utilisateur, etc. »

## Contexte

Le tableau de bord de l'administration (spec 068) est une grille de cartes : chaque carte donne un
résumé en texte (« 3 clés actives », « 42 % ») et ouvre sa section. Il manque un visuel : pour voir
comment la consommation Cloudflare évolue ou qui alimente les prix de l'HDV, l'administrateur doit
ouvrir une section, voire ne le voit nulle part.

Deux données existent déjà et ne sont pas exploitées sur l'accueil :

- la consommation Cloudflare (spec 058), visible seulement dans sa section, alors que les plafonds du
  plan gratuit sont journaliers et repartent de zéro à minuit UTC : c'est donc la journée en cours
  qui compte, pas une moyenne sur plusieurs jours ;
- le nombre de lignes de prix enregistrées chaque jour par chacune des clés données aux amis (spec
  057, aujourd'hui seulement « aujourd'hui » et « dernier envoi » dans la liste des clés).

## Scénarios utilisateur et tests *(obligatoire)*

### Parcours 1 - Voir la courbe de la journée Cloudflare depuis l'accueil (Priorité : P1)

Sur le tableau de bord, la carte « Consommation Cloudflare » affiche, en plus du pourcentage actuel,
un graphique de la **journée UTC en cours** : l'évolution heure par heure, depuis minuit UTC, du
cumul consommé pour chacune des trois métriques (requêtes Workers, lectures D1, écritures D1), en
pourcentage de leur limite quotidienne. La ligne des 100 % est visible. L'administrateur voit si la
journée monte vite, et à quelle heure un pic a eu lieu, sans ouvrir la section.

**Pourquoi cette priorité** : le plafond est journalier et sa remise à zéro est à minuit UTC. Une
coupure de l'API des prix survient si la limite est atteinte avant la fin de la journée : seule la
courbe du jour permet de l'anticiper.

**Test indépendant** : ouvrir l'accueil de l'administration à un moment de la journée et vérifier que
la carte Cloudflare contient un graphique allant de 00:00 UTC à l'heure actuelle, dont le dernier
point correspond au pourcentage affiché sur la carte.

**Scénarios d'acceptation** :

1. **Étant donné** des données horaires disponibles, **quand** le tableau de bord s'affiche, **alors**
   la carte Cloudflare montre le cumul de la journée UTC en cours, heure par heure, pour les trois
   métriques, avec la ligne des 100 %.
2. **Étant donné** une heure sans consommation, **alors** le cumul reste à son niveau précédent (ou à 0
   en début de journée) et n'apparaît pas comme un trou.
3. **Étant donné** que le dernier point du graphique est l'heure en cours, **alors** il est identifié
   comme partiel, avec l'heure de lecture.
4. **Étant donné** qu'une métrique atteint 80 % puis 100 % dans la journée, **alors** le moment où
   chaque seuil est franchi est repérable (repère visuel ET texte, par exemple « 80 % franchi à 14 h
   UTC »).
5. **Étant donné** que l'administrateur survole ou sélectionne une heure, **alors** l'heure et les
   valeurs exactes de cette heure s'affichent.
6. **Étant donné** qu'il est peu après minuit UTC, **alors** le graphique repart de zéro (journée
   nouvelle) sans reprendre les valeurs de la veille.
7. **Étant donné** que Cloudflare n'est pas configuré ou ne répond pas, **alors** la carte indique
   « indisponible » à la place du graphique, sans valeur inventée et sans bloquer les autres cartes.

---

### Parcours 2 - Voir qui alimente les prix, clé par clé, sur le mois (Priorité : P1)

Sur le tableau de bord, la carte des clés de l'outil de prix HDV affiche le total de lignes de prix
ajoutées sur le mois en cours, et un graphique répartissant ces lignes par clé (donc par ami, grâce
au libellé de chaque clé). L'administrateur voit d'un coup d'œil combien de lignes ont été ajoutées
ce mois-ci et qui contribue le plus.

**Pourquoi cette priorité** : c'est la demande explicite principale : mesurer l'apport de chaque ami
à qui une clé a été donnée.

**Test indépendant** : avec deux clés ayant enregistré respectivement 120 et 30 lignes ce mois-ci,
l'accueil indique 150 lignes au total sur le mois, et le graphique montre Alice à 120 et Bob à 30.

**Scénarios d'acceptation** :

1. **Étant donné** des clés ayant enregistré des lignes ce mois-ci (mois civil, jours UTC), **quand**
   le tableau de bord s'affiche, **alors** la carte indique le total de lignes du mois et un
   graphique par clé, avec le libellé de chaque clé et son nombre de lignes.
2. **Étant donné** une clé sans aucune ligne ce mois-ci, **alors** elle apparaît à 0 (ou est
   regroupée explicitement comme « sans envoi ») plutôt que d'être oubliée sans explication.
3. **Étant donné** une clé révoquée qui a envoyé des lignes ce mois-ci, **alors** ses lignes restent
   comptées et la clé est signalée comme révoquée.
4. **Étant donné** qu'aucune ligne n'a été ajoutée ce mois-ci, **alors** la carte l'indique
   clairement (« 0 ligne ce mois-ci ») au lieu d'un graphique vide.
5. **Étant donné** que l'administrateur survole ou sélectionne une clé, **alors** son libellé et son
   nombre exact de lignes s'affichent, et les valeurs sont aussi disponibles en texte.

---

### Parcours 3 - Évolution des ajouts jour par jour et mois précédents (Priorité : P2)

Depuis la carte des clés, l'administrateur peut voir l'évolution jour par jour des lignes ajoutées
sur le mois, et passer à un mois précédent pour comparer.

**Pourquoi cette priorité** : donne du recul (le mois est-il plus actif que le précédent ?), mais le
total et la répartition par clé du Parcours 2 suffisent déjà à répondre à la demande.

**Test indépendant** : choisir le mois précédent et vérifier que total, répartition par clé et
évolution quotidienne correspondent aux données de ce mois-là.

**Scénarios d'acceptation** :

1. **Étant donné** le mois en cours, **quand** l'administrateur consulte l'évolution, **alors** il voit
   un point par jour du mois, les jours sans ajout à 0, et les jours à venir non tracés.
2. **Étant donné** la carte des clés, **quand** l'administrateur choisit un mois précédent, **alors**
   le total, la répartition par clé et l'évolution quotidienne se mettent à jour pour ce mois, sans
   recharger la page.
3. **Étant donné** un mois sans donnée, **alors** il est indiqué comme vide plutôt que masqué.

---

### Parcours 4 - Un visuel utile sur les autres cartes (Priorité : P3)

Les autres cartes reçoivent un visuel quand une donnée historique existe déjà et qu'elle répond à une
vraie question de l'administrateur. Chaque visuel complète le résumé en texte, sans le remplacer.

| Carte | Visuel | Question à laquelle il répond |
|---|---|---|
| Clés de l'outil de prix HDV | Nombre de lignes par jour sur le mois (Parcours 3) et ancienneté du dernier envoi de chaque clé | Quelle clé est active, laquelle est endormie ? |
| Correspondances de l'outil de prix HDV | « Dernière publication il y a N jours », version du jeu de la correspondance active, historique des dernières publications | Les correspondances sont-elles à jour après une mise à jour du jeu ? |
| Prix communautaires (nouvelle carte) | Lignes de prix ajoutées par jour sur 30 jours, ventilées par origine (manuel, capture, bot, outil des amis) | D'où viennent les prix ? La communauté contribue-t-elle encore ? |
| Visites (nouvelle carte) | Visiteurs anonymes par jour sur 30 jours | Le site est-il fréquenté, et à quel rythme ? |
| Compteurs | Barres comparant la valeur des compteurs entre joueurs | Quels sont les compteurs les plus élevés ? |
| Bandeau d'information | Compte à rebours avant sa fin programmée, s'il en a une | Dans combien de temps sera-t-il retiré ? |
| Pages du site | Aucun graphique (état actif / masqué conservé) | Pas d'historique : le résumé texte suffit |

**Pourquoi cette priorité** : la demande cite des exemples (« etc. ») ; Cloudflare et les clés en sont
le cœur. Ces visuels étendent le même principe en n'utilisant que des données déjà enregistrées.

**Test indépendant** : vérifier, carte par carte, que le visuel du tableau ci-dessus s'affiche avec
les mêmes valeurs que le texte, et que la carte « Pages du site » reste inchangée.

**Scénarios d'acceptation** :

1. **Étant donné** des lignes de prix ajoutées sur les 30 derniers jours, **quand** le tableau de bord
   s'affiche, **alors** la carte « Prix communautaires » montre un graphique par jour et par origine,
   avec le total sur la période.
2. **Étant donné** des visites anonymes enregistrées, **alors** la carte « Visites » montre le nombre de
   visiteurs uniques par jour sur 30 jours, et la valeur d'aujourd'hui.
3. **Étant donné** une correspondance active, **alors** la carte correspondante indique la date et
   l'ancienneté de sa publication ; si elle a plus de 30 jours, ce retard est signalé en texte (pas
   seulement par la couleur).
4. **Étant donné** des clés dont certaines n'ont rien envoyé depuis longtemps, **alors** la carte des
   clés distingue les clés actives récemment des clés endormies (jamais utilisée, ou aucun envoi depuis
   plus de 30 jours).
5. **Étant donné** un bandeau affiché avec une date de fin, **alors** la carte indique le temps restant ;
   sans date de fin, elle l'indique (« sans fin programmée »).
6. **Étant donné** une carte dont la donnée est indisponible ou vide, **alors** elle suit les mêmes règles
   que les Parcours 1 et 2 (« indisponible » ou « aucune donnée », rien d'inventé).

---

### Cas limites

- Chargement lent ou échec de la source d'un graphique : la carte affiche « chargement » puis
  « indisponible », les autres cartes et leurs résumés restent utilisables, et la section s'ouvre
  malgré tout (comportement de la spec 068 conservé).
- Un graphique n'est jamais tracé avec des valeurs inventées : une donnée absente est indiquée comme
  telle, et une valeur à zéro réelle est tracée à zéro.
- Le « jour » et le « mois » sont ceux de l'UTC, comme les plafonds Cloudflare et les compteurs
  journaliers des clés ; la carte l'indique.
- Beaucoup de clés : le graphique reste lisible (les plus actives d'abord, les autres regroupées ou
  accessibles par défilement) et le total du mois reste exact.
- Libellés de clés très longs : ils sont tronqués à l'affichage, le libellé complet restant lisible au
  survol ou en texte.
- Écran étroit (téléphone) : les graphiques se réduisent à la largeur de la carte, sans défilement
  horizontal de la page.
- Navigation au clavier et lecteur d'écran : chaque graphique a un équivalent texte (tableau ou
  liste de valeurs) atteignable au clavier.
- Thème clair / sombre : les graphiques restent lisibles dans les deux.
- Les clés en clair ne sont jamais affichées ni transmises pour construire les graphiques : seuls les
  libellés et les nombres de lignes le sont.

## Exigences *(obligatoire)*

### Exigences fonctionnelles

- **FR-001** : La carte « Consommation Cloudflare » du tableau de bord DOIT afficher un graphique de la
  journée UTC en cours : le cumul heure par heure depuis 00:00 UTC des trois métriques suivies,
  exprimé en pourcentage de leur limite quotidienne, avec la ligne des 100 %. Il NE DOIT PAS montrer
  les jours précédents.
- **FR-002** : Ce graphique DOIT rendre repérable le moment où une métrique franchit le seuil
  d'avertissement (80 %) puis la limite (100 %), par un repère visuel ET par un texte ; l'heure en
  cours DOIT être identifiée comme partielle, avec l'heure de lecture.
- **FR-003** : La carte des clés de l'outil de prix HDV DOIT afficher le total de lignes de prix
  ajoutées sur le mois en cours (mois civil, jours UTC) et un graphique de la répartition de ces
  lignes par clé, avec le libellé de chaque clé.
- **FR-004** : Les lignes d'une clé révoquée DOIVENT rester comptées dans le mois où elles ont été
  ajoutées ; la clé DOIT être signalée comme révoquée.
- **FR-005** : L'administrateur DOIT pouvoir consulter l'évolution jour par jour des lignes ajoutées
  sur un mois et choisir un mois précédent ; total, répartition par clé et évolution quotidienne
  DOIVENT se mettre à jour ensemble, sans recharger la page.
- **FR-006** : Chaque graphique DOIT avoir un équivalent texte (valeurs exactes) lisible par lecteur
  d'écran et au clavier ; aucune information NE DOIT reposer sur la couleur seule.
- **FR-007** : Chaque graphique DOIT afficher la date (ou la clé) et les valeurs exactes au survol ou à
  la sélection.
- **FR-008** : Si la source d'un graphique est indisponible (Cloudflare non configuré ou en erreur,
  lecture des clés en échec), la carte DOIT l'indiquer explicitement, sans valeur inventée, rester
  cliquable, et NE DOIT PAS bloquer les autres cartes.
- **FR-009** : Une donnée absente DOIT se distinguer d'une valeur réellement nulle : un jour sans
  consommation ou sans ajout est tracé à 0 ; un jour dont la donnée n'a pas pu être lue n'est pas
  tracé comme 0.
- **FR-010** : Les résumés en texte existants du tableau de bord (spec 068) DOIVENT être conservés ;
  les graphiques s'y ajoutent sans retirer ni modifier le comportement des sections.
- **FR-011** : Les graphiques DOIVENT s'adapter à la largeur de l'écran (téléphone compris), reprendre
  l'apparence du site (thème clair et sombre) et rester dans le périmètre de la page d'administration,
  réservée à l'administrateur comme aujourd'hui.
- **FR-012** : Aucune clé en clair ni empreinte de clé NE DOIT être transmise au navigateur pour
  construire les graphiques ; seuls libellés, états (active / révoquée) et nombres de lignes le sont.
- **FR-013** : L'ouverture du tableau de bord NE DOIT PAS devenir sensiblement plus lente à cause des
  graphiques : les cartes déjà prêtes s'affichent sans attendre celles dont la source est lente.
- **FR-014** : Les cartes décrites au Parcours 4 DOIVENT recevoir le visuel indiqué dans son tableau :
  prix communautaires par jour et par origine, visites par jour, ancienneté des correspondances,
  envois récents par clé, comparaison des compteurs, temps restant du bandeau. La carte « Pages du
  site » et toute carte sans historique exploitable DOIVENT garder leur résumé texte actuel, sans
  graphique fabriqué.
- **FR-015** : Les cartes « Prix communautaires » et « Visites » sont ajoutées au tableau de bord ;
  elles DOIVENT être en lecture seule (pas de nouvelle section d'édition) et ne collecter aucune
  nouvelle donnée.
- **FR-016** : Les visites et les contributions de prix DOIVENT rester anonymes dans l'affichage :
  seuls des totaux par jour (et par origine pour les prix) sont montrés, jamais d'identifiant
  d'appareil.

### Entités clés

- **Point horaire Cloudflare** : une heure de la journée UTC en cours ; attributs : heure, cumul de
  chaque métrique depuis minuit en pourcentage de sa limite, indicateur « partiel » pour l'heure en
  cours.
- **Série journalière** : pour une carte (prix communautaires, visites), une valeur par jour UTC sur
  30 jours ; les prix sont ventilés par origine.
- **Apport d'une clé sur un mois** : pour une clé (libellé, état actif / révoqué) et un mois, le
  nombre de lignes de prix ajoutées, ventilé par jour UTC.
- **Mois consulté** : le mois civil dont les graphiques des clés affichent les données (mois en cours
  par défaut).

## Critères de réussite *(obligatoire)*

### Résultats mesurables

- **SC-001** : Depuis l'accueil de l'administration, sans ouvrir de section, l'administrateur voit la
  courbe Cloudflare de la journée en cours et le total de lignes ajoutées sur le mois.
- **SC-002** : L'administrateur identifie en moins de 10 secondes la clé qui a ajouté le plus de
  lignes ce mois-ci.
- **SC-003** : Les totaux affichés (lignes du mois par clé, total du mois) correspondent à 100 % aux
  nombres de lignes réellement enregistrés pour ces clés et ce mois.
- **SC-004** : Le franchissement de 80 % ou de 100 % d'une limite Cloudflare dans la journée est
  repérable dans le graphique, avec son heure, y compris sans percevoir les couleurs.
- **SC-005** : Une source indisponible n'empêche jamais l'affichage des autres cartes : 100 % des
  cartes dont la source répond restent affichées.
- **SC-006** : 100 % des fonctions d'édition des sections restent utilisables comme avant (aucune
  régression sur la spec 068).
- **SC-007** : Les graphiques sont lisibles et sans défilement horizontal de la page sur un écran de
  téléphone, en thème clair comme sombre.

## Hypothèses

- L'administrateur est la seule personne concernée ; l'accès à la page reste protégé comme
  aujourd'hui, sans changement d'authentification.
- « Ajouts de données par les utilisateurs via les clés » désigne les lignes de prix de l'HDV
  enregistrées par les clés de l'outil de prix (spec 057), comptées par clé et par jour UTC.
- Un « utilisateur » est identifié par le libellé de sa clé (le nom donné à l'ami à la création) ; il
  n'y a pas d'autre notion de compte.
- Les nombres de lignes par clé et par jour déjà enregistrés servent de source : aucun historique
  antérieur à ces données n'est reconstitué, et les mois sans donnée apparaissent vides.
- Les données Cloudflare viennent de la même source que la section Cloudflare existante, avec le même
  fonctionnement quand le jeton n'est pas configuré ou refusé. On suppose que cette source permet un
  découpage par heure pour la journée en cours ; si ce n'était pas possible, la carte montrerait
  seulement le pourcentage actuel (à vérifier lors de la planification).
- La section Cloudflare existante garde son historique 7 / 30 jours ; l'accueil ne montre que la
  journée en cours.
- « Etc. » de la demande est couvert par le Parcours 4, qui s'appuie sur des données déjà enregistrées
  (prix communautaires datés avec leur origine, visites anonymes par jour, date de publication des
  correspondances, dernier envoi de chaque clé, valeurs des compteurs, date de fin du bandeau).
  Aucune nouvelle collecte de données n'est ajoutée.
- Les visites et les contributions plus anciennes que ce que la base conserve ne sont pas
  reconstituées ; les jours sans donnée apparaissent vides.
- Le mois est le mois civil en UTC (cohérent avec les compteurs journaliers des clés).
- Hors périmètre : projections (« limite atteinte à telle heure »), modifier les limites, les clés ou les sections elles-mêmes ; exporter les
  données ; alertes par e-mail ou notification ; graphiques pour la partie publique du site.
