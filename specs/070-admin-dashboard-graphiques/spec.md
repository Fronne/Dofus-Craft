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

- la consommation Cloudflare jour par jour (historique 7 / 30 jours de la spec 058, visible
  seulement dans sa section) ;
- le nombre de lignes de prix enregistrées chaque jour par chacune des clés données aux amis (spec
  057, aujourd'hui seulement « aujourd'hui » et « dernier envoi » dans la liste des clés).

## Scénarios utilisateur et tests *(obligatoire)*

### Parcours 1 - Voir la tendance de consommation Cloudflare depuis l'accueil (Priorité : P1)

Sur le tableau de bord, la carte « Consommation Cloudflare » affiche, en plus du pourcentage actuel,
un petit graphique de l'évolution jour par jour des trois métriques suivies (requêtes Workers,
lectures D1, écritures D1) en pourcentage de leur limite quotidienne. L'administrateur repère un pic
ou une pente dangereuse sans ouvrir la section.

**Pourquoi cette priorité** : une coupure de l'API des prix à cause d'un plafond atteint est le
risque le plus concret ; voir la tendance permet de l'anticiper.

**Test indépendant** : ouvrir l'accueil de l'administration et vérifier que la carte Cloudflare
contient un graphique de 7 jours, un point par jour UTC, aujourd'hui compris.

**Scénarios d'acceptation** :

1. **Étant donné** un historique Cloudflare disponible, **quand** le tableau de bord s'affiche,
   **alors** la carte Cloudflare montre un graphique des 7 derniers jours pour les trois métriques.
2. **Étant donné** un jour sans consommation, **alors** il apparaît à 0 et non comme un trou.
3. **Étant donné** une métrique au-dessus de 80 % ou de 100 % un jour donné, **alors** ce jour est
   repérable dans le graphique (marque ou ligne de seuil) et la valeur est aussi lisible en texte.
4. **Étant donné** que l'administrateur survole ou sélectionne un jour, **alors** la date et les
   valeurs exactes de ce jour s'affichent.
5. **Étant donné** que Cloudflare n'est pas configuré ou ne répond pas, **alors** la carte indique
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

### Parcours 4 - Un visuel pour chaque domaine qui s'y prête (Priorité : P3)

Les autres cartes du tableau de bord (compteurs, pages du site, bandeau d'information, correspondances
de l'outil de prix HDV) restent lisibles en texte. Seules celles dont l'historique existe déjà et dont
un visuel apporte quelque chose reçoivent un petit graphique, sur le même modèle que les deux
premiers parcours (« etc. » de la demande).

**Pourquoi cette priorité** : la demande cite des exemples ; les deux parcours précédents en sont le
cœur. Cette étape étend le même principe sans créer de nouvelle collecte de données.

**Test indépendant** : vérifier que chaque carte conserve son résumé en texte, et que toute carte
dotée d'un graphique l'accompagne des mêmes valeurs en texte.

**Scénarios d'acceptation** :

1. **Étant donné** une carte dont les données historiques n'existent pas aujourd'hui, **alors** elle
   garde son résumé actuel, sans graphique ni valeur fabriquée.
2. **Étant donné** une carte qui reçoit un graphique, **alors** ce graphique suit les mêmes règles
   d'accessibilité et d'indisponibilité que les Parcours 1 et 2.

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

- **FR-001** : La carte « Consommation Cloudflare » du tableau de bord DOIT afficher un graphique de
  l'évolution jour par jour (7 derniers jours, aujourd'hui compris, un point par jour UTC) des trois
  métriques suivies, exprimées en pourcentage de leur limite quotidienne.
- **FR-002** : Ce graphique DOIT rendre repérables les jours où une métrique atteint le seuil
  d'avertissement (80 %) ou la limite (100 %), par un repère visuel ET par un texte.
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
- **FR-014** : Les cartes qui n'ont pas d'historique exploitable (voir Hypothèses) DOIVENT garder leur
  résumé texte actuel, sans graphique fabriqué.

### Entités clés

- **Point d'historique Cloudflare** : un jour UTC ; attributs : date, consommation de chaque métrique
  en pourcentage de sa limite (déjà fournis par la section Cloudflare existante).
- **Apport d'une clé sur un mois** : pour une clé (libellé, état actif / révoqué) et un mois, le
  nombre de lignes de prix ajoutées, ventilé par jour UTC.
- **Mois consulté** : le mois civil dont les graphiques des clés affichent les données (mois en cours
  par défaut).

## Critères de réussite *(obligatoire)*

### Résultats mesurables

- **SC-001** : Depuis l'accueil de l'administration, sans ouvrir de section, l'administrateur voit
  l'évolution Cloudflare des 7 derniers jours et le total de lignes ajoutées sur le mois.
- **SC-002** : L'administrateur identifie en moins de 10 secondes la clé qui a ajouté le plus de
  lignes ce mois-ci.
- **SC-003** : Les totaux affichés (lignes du mois par clé, total du mois) correspondent à 100 % aux
  nombres de lignes réellement enregistrés pour ces clés et ce mois.
- **SC-004** : Un jour de dépassement ou d'approche de limite Cloudflare est repérable dans le
  graphique, y compris sans percevoir les couleurs.
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
- L'historique Cloudflare vient de la source déjà utilisée par la section Cloudflare existante, avec
  le même fonctionnement quand le jeton n'est pas configuré ou refusé.
- Le graphique Cloudflare de l'accueil montre 7 jours (comme la vue par défaut de la section) ; la
  bascule 7 / 30 jours reste dans la section.
- « Etc. » de la demande est couvert par le Parcours 4 : seules les cartes disposant déjà d'un
  historique exploitable reçoivent un graphique ; aucune nouvelle collecte de données (visites,
  compteurs, etc.) n'est ajoutée par cette fonctionnalité.
- Le mois est le mois civil en UTC (cohérent avec les compteurs journaliers des clés).
- Hors périmètre : modifier les limites, les clés ou les sections elles-mêmes ; exporter les
  données ; alertes par e-mail ou notification ; graphiques pour la partie publique du site.
