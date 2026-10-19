# Spécification : utilisation Cloudflare dans l'administration

**Branche** : `058-admin-cloudflare-usage`

**Créée** : 2026-10-19

**Statut** : Draft

**Entrée** : « Section "Utilisation Cloudflare" dans la page admin : consommation du jour face aux
limites du plan gratuit, plus un historique 7 ou 30 jours (petit graphique). » Le propriétaire a
validé le principe et le choix d'un historique avec bascule 7 / 30 jours.

## Contexte

Le site tourne sur le plan gratuit de Cloudflare : les requêtes Workers, les lectures de lignes D1
et les écritures de lignes D1 y sont plafonnées chaque jour (remise à zéro à minuit UTC). Dépasser
un plafond coupe l'API des prix communautaires jusqu'au lendemain. Aujourd'hui, le propriétaire ne
voit sa consommation que dans le tableau de bord Cloudflare ; rien dans l'administration ne
l'avertit qu'il approche d'une limite. Cette spec ajoute une section à la page d'administration
existante (réservée au propriétaire par Cloudflare Access).

Limites quotidiennes du plan gratuit suivies :

| Métrique | Limite par jour |
|---|---|
| Requêtes Workers | 100 000 |
| Lectures de lignes D1 | 5 000 000 |
| Écritures de lignes D1 | 100 000 |

## Scénarios utilisateur et tests *(obligatoire)*

### Histoire 1 — Le propriétaire voit sa consommation du jour (Priorité : P1)

En ouvrant la section « Utilisation Cloudflare », le propriétaire voit, pour chacune des trois
métriques : le consommé du jour (UTC), la limite, le pourcentage atteint et une barre de
progression. Une barre change d'aspect quand le seuil d'alerte est atteint (80 %) puis dépassé
(100 %).

**Pourquoi P1** : c'est la raison d'être de la section ; savoir où l'on en est évite une coupure
surprise de l'API.

**Test indépendant** : avec 50 000 requêtes Workers consommées, la ligne « Requêtes Workers »
affiche « 50 000 / 100 000 » et « 50 % » avec une barre à moitié pleine.

**Scénarios d'acceptation** :

1. **Étant donné** des consommations du jour connues, **quand** le propriétaire ouvre la page,
   **alors** chaque métrique montre consommé, limite et pourcentage (arrondi à l'entier), avec une
   barre proportionnelle.
2. **Étant donné** une métrique à 80 % ou plus, **alors** sa barre est en alerte ; à 100 % ou plus,
   en dépassement, et le pourcentage réel reste affiché (ex. « 112 % »), la barre étant pleine.
3. **Étant donné** une consommation nulle, **alors** « 0 / limite » et « 0 % » sont affichés, sans
   erreur.
4. **Étant donné** que la section est ouverte, **quand** le propriétaire clique sur « Actualiser »,
   **alors** les chiffres sont relus et l'heure de la dernière lecture est affichée.

---

### Histoire 2 — Le propriétaire consulte l'historique (Priorité : P2)

Sous les barres, un petit graphique montre la consommation jour par jour sur 7 jours, avec un
bouton pour passer à 30 jours. Le graphique montre les trois métriques en pourcentage de leur
limite quotidienne, pour repérer les jours de pic.

**Pourquoi P2** : utile pour comprendre une tendance, mais la photographie du jour (histoire 1)
suffit déjà à éviter la coupure.

**Test indépendant** : demander 7 jours ; le graphique contient 7 points, un par jour UTC, le
dernier étant aujourd'hui. Passer à 30 : 30 points.

**Scénarios d'acceptation** :

1. **Étant donné** la section ouverte, **alors** le graphique montre par défaut les 7 derniers jours
   (aujourd'hui compris), un point par jour UTC.
2. **Étant donné** le graphique en 7 jours, **quand** le propriétaire choisit 30 jours, **alors** le
   graphique montre 30 jours sans recharger la page.
3. **Étant donné** un jour sans aucune consommation, **alors** il apparaît à 0, pas comme un trou.
4. **Étant donné** que le propriétaire survole ou sélectionne un jour du graphique, **alors** la
   date et les valeurs exactes de ce jour sont lisibles.
5. **Étant donné** que le graphique est affiché, **alors** ses valeurs restent accessibles en texte
   (pas de lecture par la couleur seule).

---

### Histoire 3 — La source n'est pas configurée ou ne répond pas (Priorité : P1)

Tant que le jeton d'accès à l'API d'analyse de Cloudflare et l'identifiant de compte ne sont pas
configurés, la section l'explique clairement (et comment les configurer) au lieu d'afficher une
erreur. Si Cloudflare est configuré mais ne répond pas ou refuse le jeton, la section affiche un
message d'erreur compréhensible, sans casser le reste de l'administration.

**Pourquoi P1** : le déploiement initial n'a pas de jeton ; la page d'administration existante ne
doit jamais être dégradée par cette section.

**Test indépendant** : sans jeton configuré, la section affiche « Jeton Cloudflare non configuré »
avec la marche à suivre ; les autres sections de la page fonctionnent normalement.

**Scénarios d'acceptation** :

1. **Étant donné** que le jeton ou l'identifiant de compte manque, **quand** la section se charge,
   **alors** un message dit lequel manque et comment le configurer ; aucune requête n'est envoyée à
   Cloudflare et aucune erreur n'apparaît dans la page.
2. **Étant donné** un jeton refusé par Cloudflare (invalide, permission insuffisante), **alors** la
   section affiche « jeton refusé » avec un bouton « Réessayer ».
3. **Étant donné** que Cloudflare est injoignable ou répond en erreur, **alors** la section affiche
   un message d'indisponibilité avec « Réessayer », et le reste de la page reste utilisable.
4. **Étant donné** une réponse d'erreur de Cloudflare, **alors** le jeton et le détail brut de la
   réponse ne sont jamais renvoyés au navigateur.

---

### Cas limites

- Le « jour » est le jour UTC, comme le plafond de Cloudflare : à minuit UTC les barres repartent de
  zéro.
- Les chiffres de la journée en cours sont partiels et peuvent avoir quelques minutes de retard côté
  Cloudflare ; la section l'indique par l'heure de lecture.
- Un jour de l'historique absent de la réponse de Cloudflare est montré à 0.
- Un pourcentage au-dessus de 100 % est affiché tel quel ; la barre est plafonnée à pleine largeur.
- Les métriques D1 portent sur la base des prix communautaires (la seule base du projet) ; les
  requêtes Workers incluent tous les Workers du compte (prix communautaires et administration),
  parce que le plafond du plan gratuit s'applique au compte entier.
- Toute requête de quelqu'un d'autre que le propriétaire est refusée comme pour les sections
  existantes.

## Exigences *(obligatoire)*

### Exigences fonctionnelles

- **FR-001** : La section et sa source de données DOIVENT être réservées au propriétaire, avec la
  même vérification Cloudflare Access que le reste de l'administration.
- **FR-002** : La section DOIT montrer, pour les requêtes Workers, les lectures de lignes D1 et les
  écritures de lignes D1 : le consommé du jour UTC, la limite quotidienne du plan gratuit (100 000 /
  5 000 000 / 100 000), le pourcentage et une barre de progression.
- **FR-003** : Le pourcentage DOIT être arrondi à l'entier le plus proche, non plafonné ; la barre
  DOIT être plafonnée à pleine largeur ; l'état « alerte » DOIT commencer à 80 % et l'état
  « dépassement » à 100 %. L'état DOIT aussi être exprimé en texte, pas seulement par la couleur.
- **FR-004** : La section DOIT proposer un historique jour par jour sur 7 jours (par défaut) ou 30
  jours (bascule), aujourd'hui compris, un point par jour UTC, les jours sans consommation à 0.
- **FR-005** : Les données DOIVENT être lues dans l'API d'analyse de Cloudflare, côté serveur de
  l'administration ; le navigateur ne DOIT jamais appeler Cloudflare ni recevoir le jeton.
- **FR-006** : Le jeton (permission en lecture seule sur l'analyse du compte) et l'identifiant de
  compte DOIVENT être des secrets du Worker d'administration, jamais écrits dans le dépôt, la
  configuration versionnée, les journaux ou les réponses. Leur création DOIT être documentée.
- **FR-007** : Si le jeton ou l'identifiant de compte manque, la section DOIT l'indiquer clairement
  avec la marche à suivre, sans erreur HTTP côté navigateur et sans appel à Cloudflare.
- **FR-008** : Si Cloudflare refuse le jeton, est injoignable ou répond de façon inattendue, la
  section DOIT afficher un message lisible et un moyen de réessayer, sans affecter les autres
  sections de la page ; aucune valeur ne DOIT être inventée.
- **FR-009** : La section DOIT afficher l'heure de la dernière lecture et proposer une actualisation
  manuelle ; il n'y a pas d'actualisation automatique.
- **FR-010** : Aucune table, colonne ni migration ne DOIT être ajoutée : l'historique vient de
  Cloudflare, pas d'une copie locale.
- **FR-011** : Le chargement de la section ne DOIT ni retarder ni empêcher l'affichage des autres
  sections de la page.

### Entités clés

- **Métrique d'utilisation** : un des trois compteurs suivis, avec sa limite quotidienne du plan
  gratuit.
- **Relevé journalier** : consommation de chaque métrique pour un jour UTC.
- **État de la source** : lisible, non configurée (jeton ou compte manquant), refusée, ou
  indisponible.

## Critères de succès *(obligatoire)*

- **SC-001** : Le propriétaire connaît, en ouvrant la page, la part du plafond journalier consommée
  pour chacune des trois métriques, sans quitter l'administration.
- **SC-002** : Le pourcentage affiché est exact à ±1 point près par rapport aux valeurs de
  Cloudflare au moment de la lecture.
- **SC-003** : Passer de 7 à 30 jours prend un seul clic et ne recharge pas la page.
- **SC-004** : Sans jeton configuré, 100 % des ouvertures de la page affichent la marche à suivre et
  aucune erreur ; les autres sections restent pleinement utilisables.
- **SC-005** : Le jeton n'apparaît dans aucune réponse reçue par le navigateur ni dans le dépôt.
- **SC-006** : Une approche ou un dépassement de limite est reconnaissable d'un coup d'œil (état en
  texte et visuel) sans lire les chiffres.

## Hypothèses

- Le propriétaire est le seul utilisateur de l'administration ; aucune notion de rôle.
- Le projet reste sur le plan gratuit ; les limites sont des constantes du code (à modifier à la
  main si Cloudflare les change), pas un réglage de la page.
- Les trois métriques sont celles qui risquent de couper le service ; les autres quotas (KV, R2…)
  sont hors périmètre, le projet ne les utilise pas.
- Les relevés viennent d'une API en lecture seule : cette fonctionnalité n'écrit rien chez
  Cloudflare ni en base.
- Aucune alerte par e-mail ni notification : seulement l'affichage dans la page.
- Seuil d'alerte à 80 % (choix par défaut, facile à changer).
