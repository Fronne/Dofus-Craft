# Spécification : Tableau de bord de l'administration

**Branche** : `068-admin-dashboard`

**Créée le** : 2026-10-21

**Statut** : Brouillon

**Demande** : « Pour la page administration, fais-moi un dashboard avec tout de réuni et quelque chose de clair, on a un accès rapide à tout. »

## Scénarios utilisateur et tests *(obligatoire)*

### Parcours 1 - Voir l'état de tout le site d'un coup d'œil (Priorité : P1)

L'administrateur ouvre la page d'administration et arrive sur un tableau de bord : une grille de cartes, une par domaine administrable (pages du site, bandeau d'information, compteurs, clés de l'outil de prix HDV, correspondances de l'outil de prix HDV, consommation Cloudflare). Chaque carte donne un résumé de l'état courant, sans qu'il ait à ouvrir quoi que ce soit.

**Pourquoi cette priorité** : c'est le cœur de la demande : « tout de réuni » et « clair ». Aujourd'hui l'administrateur doit faire défiler une longue pile de six sections pour savoir où en est le site.

**Test indépendant** : ouvrir la page d'administration et vérifier que les six cartes sont visibles avec leur résumé, sans défilement long ni ouverture de section.

**Scénarios d'acceptation** :

1. **Étant donné** que l'administrateur ouvre la page, **quand** elle est chargée, **alors** il voit le tableau de bord avec une carte par section, chacune avec son titre et son résumé.
2. **Étant donné** que le bandeau d'information est affiché au public, **quand** le tableau de bord s'affiche, **alors** la carte « Bandeau d'information » indique qu'il est affiché (et sinon qu'il est masqué).
3. **Étant donné** que la consommation Cloudflare approche ou dépasse la limite quotidienne, **quand** le tableau de bord s'affiche, **alors** la carte « Consommation Cloudflare » le signale visuellement (avertissement puis alerte) en plus du pourcentage.
4. **Étant donné** que le résumé d'une carte ne peut pas être obtenu, **quand** le tableau de bord s'affiche, **alors** cette carte indique que l'information est indisponible, sans bloquer les autres cartes ni fabriquer de valeur.

---

### Parcours 2 - Accéder en un clic à une section (Priorité : P1)

L'administrateur clique sur une carte : la section correspondante s'ouvre seule, à la place du tableau de bord, avec un bouton clair pour revenir au tableau de bord.

**Pourquoi cette priorité** : c'est « l'accès rapide à tout ». Sans elle, le tableau de bord ne serait qu'un affichage.

**Test indépendant** : cliquer sur chaque carte, vérifier que seule la section choisie est affichée et qu'elle fonctionne comme avant, puis revenir au tableau de bord.

**Scénarios d'acceptation** :

1. **Étant donné** le tableau de bord, **quand** l'administrateur clique sur une carte, **alors** seule la section correspondante est affichée, avec un titre et un bouton « Retour au tableau de bord ».
2. **Étant donné** une section ouverte, **quand** l'administrateur clique sur « Retour au tableau de bord », **alors** le tableau de bord réapparaît.
3. **Étant donné** une section ouverte, **quand** l'administrateur modifie une valeur puis enregistre, **alors** le comportement est identique à celui d'aujourd'hui (même enregistrement, mêmes messages).
4. **Étant donné** une section ouverte, **quand** l'administrateur revient au tableau de bord après une modification, **alors** la carte reflète le nouvel état.

---

### Parcours 3 - Navigation par le navigateur et liens directs (Priorité : P2)

Chaque section a une adresse propre (ancre dans l'URL). Le bouton « précédent » du navigateur ramène de la section au tableau de bord, et une adresse de section peut être mise en favori ou partagée.

**Pourquoi cette priorité** : confort et naturel d'usage (réflexe du bouton précédent), mais le tableau de bord fonctionne sans.

**Test indépendant** : ouvrir une section, utiliser « précédent », puis « suivant », puis charger directement l'adresse d'une section.

**Scénarios d'acceptation** :

1. **Étant donné** une section ouverte depuis le tableau de bord, **quand** l'administrateur utilise « précédent », **alors** il revient au tableau de bord (et non hors de l'administration).
2. **Étant donné** l'adresse d'une section, **quand** elle est chargée directement, **alors** cette section s'ouvre.
3. **Étant donné** une ancre inconnue dans l'adresse, **quand** la page est chargée, **alors** le tableau de bord s'affiche.

---

### Cas limites

- Chargement lent ou échec d'une source de résumé : la carte concernée affiche un état « chargement » puis « indisponible », les autres cartes restent utilisables, et on peut ouvrir la section malgré tout.
- Aucun compteur, aucune clé active : la carte l'indique clairement (« 0 », « aucun ») plutôt que de rester vide.
- Écran étroit (téléphone) : les cartes passent en une colonne, tout reste cliquable.
- Navigation au clavier : chaque carte est atteignable et activable au clavier, avec un focus visible.
- Modification non enregistrée dans une section : le comportement de départ ne change pas (aucune nouvelle perte de données n'est introduite par le retour au tableau de bord).

## Exigences *(obligatoire)*

### Exigences fonctionnelles

- **FR-001** : La page d'administration DOIT s'ouvrir par défaut sur un tableau de bord présentant une carte par section existante : pages du site, bandeau d'information, compteurs, clés de l'outil de prix HDV, correspondances de l'outil de prix HDV, consommation Cloudflare.
- **FR-002** : Chaque carte DOIT afficher un titre et un résumé de l'état courant :
  - pages du site : nombre de pages actives sur le total ;
  - bandeau d'information : affiché ou masqué ;
  - compteurs : nombre de compteurs ;
  - clés de l'outil de prix HDV : nombre de clés actives ;
  - correspondances de l'outil de prix HDV : nombre de correspondances ;
  - consommation Cloudflare : niveau le plus élevé parmi les limites suivies, avec un état visuel normal / avertissement / dépassé.
- **FR-003** : Un clic (ou activation au clavier) sur une carte DOIT ouvrir la section correspondante, seule, à la place du tableau de bord.
- **FR-004** : Une section ouverte DOIT proposer un retour clair au tableau de bord.
- **FR-005** : Chaque section DOIT conserver exactement son fonctionnement actuel : aucune fonctionnalité supprimée ni modifiée.
- **FR-006** : Chaque section DOIT avoir une ancre d'adresse propre ; le bouton « précédent » du navigateur DOIT revenir de la section au tableau de bord ; une ancre inconnue DOIT afficher le tableau de bord.
- **FR-007** : Les résumés DOIT refléter l'état réel : après une modification dans une section, la carte correspondante DOIT être à jour au retour sur le tableau de bord.
- **FR-008** : Si un résumé est indisponible, la carte DOIT l'indiquer explicitement, sans valeur inventée, et DOIT rester cliquable.
- **FR-009** : L'état d'une carte (avertissement, dépassement, indisponible) NE DOIT PAS reposer sur la couleur seule : un texte l'accompagne.
- **FR-010** : Le tableau de bord DOIT être utilisable sur téléphone et au clavier, et reprendre l'apparence existante du site (thème clair/sombre inclus), sans nouvelle dépendance.
- **FR-011** : L'e-mail de l'administrateur connecté DOIT rester affiché dans l'en-tête.

### Entités clés

- **Carte de section** : une entrée du tableau de bord ; attributs : titre, résumé, état (normal, avertissement, dépassé, indisponible), section cible.
- **Section** : l'un des six écrans d'édition existants ; identifiée par une ancre d'adresse.

## Critères de réussite *(obligatoire)*

### Résultats mesurables

- **SC-001** : Depuis l'ouverture de la page, l'administrateur voit l'état des six domaines sans défiler plus d'un écran de téléphone.
- **SC-002** : Toute section est atteignable en un seul clic depuis le tableau de bord.
- **SC-003** : 100 % des actions d'édition possibles avant la fonctionnalité le restent après (aucune régression).
- **SC-004** : Un dépassement ou une approche de limite Cloudflare est repérable sur le tableau de bord sans ouvrir la section, y compris sans percevoir les couleurs.
- **SC-005** : Le bouton « précédent » du navigateur ramène au tableau de bord dans 100 % des cas après l'ouverture d'une section.

## Hypothèses

- L'administrateur est la seule personne concernée ; l'accès à la page reste protégé comme aujourd'hui, sans changement d'authentification.
- Un seul panneau est affiché à la fois (choix de simplicité d'usage) : cartes sur l'accueil, section isolée ensuite.
- Les résumés utilisent les données déjà fournies par l'administration actuelle ; aucune nouvelle donnée n'est collectée ni stockée.
- La navigation se fait par ancre d'adresse (pas de nouvelle page ni de nouvelle route côté serveur).
- Seuil d'avertissement de la consommation : celui déjà utilisé par la section Cloudflare existante.
- Hors périmètre : modifier le contenu des sections, ajouter de nouveaux réglages, historiques ou graphiques sur l'accueil.
