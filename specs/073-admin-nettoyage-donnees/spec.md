# Spécification : Nettoyage des données depuis la page d'administration

**Branche** : `073-admin-nettoyage-donnees`

**Créée le** : 2026-10-23

**Statut** : Brouillon

**Demande** : « Pouvoir supprimer facilement certaines lignes de la base de données, des lignes récentes
par exemple, ou les derniers coefficients qui ont été ajoutés ou d'autres choses comme ça. »

## Contexte

Des données erronées ou de test peuvent entrer dans la base : coefficients de brisage mal saisis, prix
envoyés par erreur, prix importés par un outil mal réglé. Aujourd'hui, les retirer demande d'écrire des
requêtes à la main sur la base de production. L'administrateur veut le faire depuis la page
d'administration, simplement et sans risque de supprimer plus que prévu.

## Scénarios utilisateur et tests *(obligatoire)*

### Parcours 1 - Voir et supprimer les dernières lignes d'une table (Priorité : P1)

Dans un nouvel onglet « Données » de la page d'administration, l'administrateur choisit une table
(coefficients de brisage, prix de la communauté, prix externes). Il voit ses lignes les plus récentes,
de la plus récente à la plus ancienne, avec les informations utiles pour les reconnaître (date, serveur,
objet ou ressource, valeur, origine). Il coche les lignes à retirer et clique sur « Supprimer la
sélection ». Une confirmation indique le nombre de lignes concernées ; une fois validée, elles disparaissent.

**Pourquoi cette priorité** : c'est le besoin exprimé, le plus simple et le plus sûr : on voit ce qu'on
supprime.

**Test indépendant** : ajouter trois coefficients de test, ouvrir « Données », choisir les coefficients de
brisage, cocher les deux plus récents, confirmer ; seuls ces deux disparaissent de la liste et de la base.

**Scénarios d'acceptation** :

1. **Étant donné** l'onglet « Données », **quand** l'administrateur choisit une table, **alors** ses lignes
   les plus récentes s'affichent, la plus récente en premier.
2. **Étant donné** des lignes cochées, **quand** il clique sur « Supprimer la sélection » puis confirme,
   **alors** exactement ces lignes sont supprimées et la liste se met à jour.
3. **Étant donné** des lignes cochées, **quand** il annule à la confirmation, **alors** rien n'est supprimé.
4. **Étant donné** la table des prix de la communauté, **quand** il filtre par origine (manuel, capture,
   bot, outil HDV) ou par serveur, **alors** seules les lignes correspondantes sont listées.

---

### Parcours 2 - Supprimer tout ce qui est récent d'un coup (Priorité : P2)

L'administrateur veut annuler un lot récent (un import raté, une rafale de prix faux). Il choisit une
table, éventuellement un filtre, puis une durée prédéfinie : 10 minutes, 1 heure ou 24 heures. Le site
lui indique d'abord combien de lignes seraient supprimées ; il confirme ou renonce.

**Pourquoi cette priorité** : très pratique après un incident, mais le parcours 1 suffit déjà à nettoyer.

**Test indépendant** : avec des lignes d'âges variés, choisir « 1 heure » ; l'aperçu annonce le nombre de
lignes de la dernière heure ; après confirmation, seules celles-ci sont supprimées.

**Scénarios d'acceptation** :

1. **Étant donné** une table, un filtre et une durée choisis, **quand** l'administrateur demande la
   suppression, **alors** un aperçu affiche le nombre exact de lignes concernées avant tout effacement.
2. **Étant donné** cet aperçu, **quand** il confirme, **alors** toutes les lignes correspondantes (et
   seulement elles) sont supprimées.
3. **Étant donné** un aperçu dépassant 500 lignes, **quand** il confirme, **alors** la suppression est
   refusée avec un message qui l'invite à affiner (durée plus courte ou filtre) ; rien n'est supprimé.

---

### Parcours 3 - Garder une trace des suppressions (Priorité : P3)

Chaque suppression est enregistrée : quand, quelle table, combien de lignes, quel mode (sélection ou
durée) et quel filtre. L'administrateur peut relire les dernières suppressions dans l'onglet « Données ».

**Pourquoi cette priorité** : utile pour comprendre ce qui s'est passé, mais n'empêche pas de nettoyer.

**Test indépendant** : supprimer des lignes, puis vérifier qu'une entrée de trace apparaît avec la table,
le nombre de lignes et l'heure.

**Scénarios d'acceptation** :

1. **Étant donné** une suppression réussie, **quand** l'administrateur relit la trace, **alors** une entrée
   indique l'heure, la table, le nombre de lignes, le mode et le filtre.
2. **Étant donné** une suppression refusée ou annulée, **alors** aucune entrée n'est ajoutée.

### Cas limites

- Une ligne cochée a déjà été supprimée entre-temps (autre onglet, autre administrateur) : elle est
  ignorée ; le message annonce le nombre de lignes réellement supprimées.
- Une table vide ou un filtre sans résultat : un message « Aucune ligne » s'affiche, aucune action de
  suppression n'est proposée.
- Une table inconnue ou non autorisée est demandée directement à l'API : la requête est refusée.
- Aucune ligne cochée : le bouton de suppression est désactivé.
- Une personne non autorisée à administrer le site ne peut ni lister ni supprimer.
- Les prix de la communauté sont anonymes : l'identifiant d'appareil n'est jamais affiché.

## Exigences *(obligatoire)*

### Exigences fonctionnelles

- **FR-001** : la page d'administration MUST proposer un onglet « Données » listant les tables
  nettoyables : coefficients de brisage, prix de la communauté, prix externes.
- **FR-002** : pour la table choisie, le système MUST afficher ses 50 lignes les plus récentes, de la plus
  récente à la plus ancienne, avec de quoi les reconnaître (date, serveur, objet ou ressource, valeur,
  origine quand elle existe).
- **FR-003** : pour les prix de la communauté, l'administrateur MUST pouvoir filtrer par origine et par
  serveur ; pour les coefficients et les prix externes, par serveur.
- **FR-004** : l'administrateur MUST pouvoir supprimer des lignes cochées, après une confirmation qui
  affiche leur nombre.
- **FR-005** : l'administrateur MUST pouvoir supprimer toutes les lignes de la table (et du filtre)
  plus récentes que 10 minutes, 1 heure ou 24 heures, après un aperçu indiquant le nombre exact de lignes.
- **FR-006** : une seule suppression MUST porter sur 500 lignes au plus ; au-delà, elle est refusée avec
  un message, sans rien supprimer.
- **FR-007** : seules les tables de la liste ci-dessus MUST être accessibles ; aucune requête libre n'est
  possible, et une table hors liste est refusée.
- **FR-008** : toute suppression MUST être précédée d'une confirmation explicite ; sans confirmation,
  aucune donnée n'est modifiée.
- **FR-009** : chaque suppression réussie MUST être tracée (date, table, nombre de lignes, mode, filtre) et
  les dernières traces MUST être consultables dans l'onglet « Données ».
- **FR-010** : lister et supprimer MUST être réservés aux administrateurs, comme le reste de la page
  d'administration.
- **FR-011** : l'identifiant d'appareil des contributions MUST ne jamais être renvoyé ni affiché.
- **FR-012** : après une suppression, les moyennes et valeurs de référence du site public MUST se
  recalculer sans la donnée retirée, sans autre action.

### Entités clés

- **Table nettoyable** : une des collections de données autorisées ; porte un nom lisible, les colonnes
  affichées, les filtres disponibles et la date servant à l'ordre et aux durées.
- **Ligne** : un enregistrement d'une table nettoyable, identifié de façon unique.
- **Trace de suppression** : date, table, nombre de lignes supprimées, mode (sélection ou durée), filtre
  utilisé.

## Critères de réussite *(obligatoire)*

### Résultats mesurables

- **SC-001** : l'administrateur retire les deux derniers coefficients ajoutés en moins de 30 secondes,
  sans écrire de requête.
- **SC-002** : annuler un lot récent (dernière heure) prend moins de 1 minute, aperçu et confirmation
  compris.
- **SC-003** : 100 % des suppressions sont précédées d'une confirmation et du nombre exact de lignes.
- **SC-004** : aucune suppression ne dépasse 500 lignes ni ne touche une table hors liste.
- **SC-005** : 100 % des suppressions réussies apparaissent dans la trace.

## Hypothèses

- Seules trois tables sont concernées dans cette version ; ajouter une table plus tard reste un petit
  changement.
- Les suppressions sont définitives : pas de corbeille ni d'annulation (la confirmation avec aperçu en
  tient lieu).
- Les 50 lignes affichées suffisent ; pas de pagination dans cette version.
- Il n'y a pas de table de journal d'activité des actions admin aujourd'hui (l'« activité » existante
  est un graphique de prix et de visiteurs) : une trace dédiée aux suppressions est créée.
- L'accès réservé aux administrateurs est celui déjà en place sur la page d'administration.
