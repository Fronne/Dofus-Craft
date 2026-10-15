# Spécification : envoi des prix HDV par les amis (sniffer) — côté API

**Branche** : `056-sniffer-batch-prices`

**Créée** : 2026-10-15

**Statut** : Draft

**Entrée** : phase 2 du plan « Envoi des prix par les amis »
(`SniffSniffSquared/docs/superpowers/plans/2026-10-15-friends-price-upload.md`, sections Décisions,
Règle du prix unitaire, Contrat d'échange, Phase 2). Toutes les décisions de ce plan ont déjà été
tranchées avec le propriétaire ; cette spec les reprend pour la seule API de prix communautaires.

## Contexte

Quelques amis du propriétaire lancent, à côté de Dofus 3, un outil Windows qui lit passivement les
prix de l'hôtel de vente (HDV) : pour chaque ressource consultée, le prix d'un lot de 1, 10, 100 et
1000 (un « ladder »). L'outil envoie ces ladders à l'API de prix communautaires du site. L'API en
déduit un prix unitaire par ressource et l'enregistre comme une contribution communautaire, que le
site affiche comme n'importe quel prix partagé. L'outil lui-même (phases 4-5) et les pages
d'administration des clés et du mapping (phase 3) sont hors de cette spec ; cette spec livre le
contrat sur lequel ils s'appuient.

## Scénarios utilisateur et tests *(obligatoire)*

### Histoire 1 — Un ami envoie un lot de prix relevés à l'HDV (Priorité : P1)

L'outil d'un ami envoie, avec sa clé personnelle, un lot d'observations (ressource, date, ladder)
pour son serveur. L'API calcule un prix unitaire par observation, l'enregistre comme contribution
communautaire d'origine « sniffer » et répond combien d'observations ont été acceptées et,
pour chaque observation refusée, son rang et la raison.

**Pourquoi P1** : c'est la valeur de toute la fonctionnalité — des prix frais sans saisie à la main.

**Test indépendant** : avec une clé valide créée en base, envoyer un lot de 3 observations (deux
ressources connues, un équipement) ; vérifier la réponse `accepted: 2` et un refus
`not_an_ingredient` au rang 2, et deux contributions `origin = 'sniffer'` en base.

**Scénarios d'acceptation** :

1. **Étant donné** une clé valide et un mapping actif pour le build, **quand** l'outil envoie un lot
   de ressources connues sur un serveur de la liste, **alors** chaque observation devient une
   contribution de ressource, d'origine « sniffer », rattachée à la clé, avec la médiane connue au
   moment de l'envoi et l'écart à cette médiane remplis comme pour une saisie manuelle.
2. **Étant donné** une observation dont l'identifiant n'est pas une ressource connue du site,
   **quand** le lot est envoyé, **alors** elle est refusée avec la raison `not_an_ingredient` et les
   autres observations du lot sont acceptées.
3. **Étant donné** un prix très éloigné de la médiane communautaire, **quand** il est envoyé,
   **alors** il est enregistré quand même (l'écart est seulement mesuré, jamais un motif de refus).
4. **Étant donné** une clé inconnue ou révoquée, **quand** un lot est envoyé, **alors** l'API répond
   « non autorisé » (401) et n'enregistre rien.
5. **Étant donné** un serveur absent de la liste des serveurs, **quand** un lot est envoyé, **alors**
   le lot entier est refusé (400) et rien n'est enregistré.

---

### Histoire 2 — Le prix unitaire retenu reflète un prix réellement disponible (Priorité : P1)

À partir du ladder, l'API retient un seul prix unitaire, selon la « Règle du prix unitaire » : on
écarte un lot aberrant par rapport aux autres lots du même ladder, puis on prend le plus gros lot
dont le prix unitaire ne dépasse pas la médiane des lots restants. Un prix est toujours retenu.

**Pourquoi P1** : un prix unitaire faux pollue la médiane affichée à tous les joueurs.

**Test indépendant** : table de cas de la fonction de calcul, sans base ni réseau.

**Scénarios d'acceptation** :

1. **Étant donné** un seul lot en vente, **alors** son prix unitaire est retenu.
2. **Étant donné** deux lots à moins d'un facteur 3 l'un de l'autre, **alors** on applique la
   sélection du plus gros lot (étape 5 de la règle).
3. **Étant donné** deux lots en désaccord (facteur 3 ou plus), **alors** on garde celui le plus
   proche de la médiane communautaire si elle existe, sinon le plus gros lot.
4. **Étant donné** trois ou quatre lots dont un est plus de 3 fois (ou moins du tiers de) la médiane
   des autres, **alors** ce lot est écarté avant la sélection (cas « x1 aberrant, x10 et x100
   proches »).
5. **Étant donné** que tous les lots ont doublé ensemble par rapport à la médiane communautaire,
   **alors** le nouveau prix est retenu (vrai mouvement de prix), la médiane communautaire n'étant
   pas consultée avec trois lots ou plus.
6. **Étant donné** que le plus gros lot restant a un prix unitaire plus de 10 % au-dessus de la
   médiane des lots restants, **alors** on descend au lot plus petit suivant et on reteste.
7. **Étant donné** un lot isolé moins cher que les autres qui s'accordent (ladder observé
   100 / 2 680 / 26 989 / 269 900), **alors** le plus gros lot du consensus est retenu (269,9 au lot
   de 1000, pas 100). Un gros lot moins cher que la médiane est toujours retenu ; un gros lot plus
   cher qu'elle ne l'est pas (200 / 200 / 200 / 400 par unité : le lot de 100).

---

### Histoire 3 — L'outil récupère sa configuration (Priorité : P2)

Au démarrage puis régulièrement, l'outil demande sa configuration : version minimale acceptée de
l'outil, lien de téléchargement, liste des serveurs, et le mapping de décodage publié pour la
version du client de jeu qu'il voit (ou rien s'il n'y en a pas).

**Pourquoi P2** : sans elle l'outil ne sait pas s'il peut envoyer ; mais l'outil a une copie de
secours du mapping.

**Test indépendant** : avec une clé valide et un mapping actif pour le build `3.7.10.10`, demander la
configuration pour ce build ; vérifier les quatre champs. Pour un build sans mapping, `mapping` vaut
`null`.

**Scénarios d'acceptation** :

1. **Étant donné** un mapping actif pour le build demandé, **alors** la configuration le renvoie avec
   son identifiant, son build et ses deux documents.
2. **Étant donné** aucun mapping actif pour ce build, **alors** `mapping` vaut `null`.
3. **Étant donné** une clé inconnue ou révoquée, **alors** 401.
4. **Étant donné** que la version minimale et le lien de téléchargement changent dans la
   configuration du service, **alors** la réponse suit sans changement de code.

---

### Histoire 4 — Garde-fous : version, mapping, quota (Priorité : P2)

L'API refuse un lot d'un outil trop ancien (426), un lot décodé avec un mapping qui n'est plus
l'actif pour ce build (409, l'outil recharge sa configuration), et un lot qui dépasserait le
plafond journalier de la clé (429).

**Pourquoi P2** : protège la qualité des données et le quota d'écriture gratuit de la base.

**Test indépendant** : un appel par code, chacun sans écriture de contribution.

**Scénarios d'acceptation** :

1. **Étant donné** un outil de version inférieure à la version minimale, **alors** 426.
2. **Étant donné** un `mappingId` qui n'est pas le mapping actif du build envoyé, **alors** 409.
3. **Étant donné** une clé ayant déjà enregistré son plafond du jour, **alors** 429 et rien n'est
   enregistré.

### Cas limites

- Un ladder sans aucun lot en vente (tous à 0 ou absents) : observation refusée (`no_price`).
- Une observation mal formée (identifiant vide, lot négatif ou non numérique, date illisible) :
  refusée (`invalid`) sans bloquer le reste du lot.
- Un lot qui dépasserait le plafond en cours de route : le lot entier est refusé (429), rien n'est
  enregistré partiellement.
- Un lot vide : réponse 200 avec `accepted: 0`.
- Un lot trop gros (plus d'observations que le maximum par envoi) : refusé (400).
- La même ressource deux fois dans un lot : chaque observation est enregistrée ; la médiane de
  référence est celle connue au début du lot.
- Le formulaire de saisie manuelle du site n'est pas touché : il accepte toujours n'importe quel
  identifiant de serveur, comme avant.

## Exigences *(obligatoire)*

### Exigences fonctionnelles

- **FR-001** : L'API DOIT authentifier l'outil par une clé personnelle par ami, jamais par la clé
  publique de l'application ; la clé n'est jamais stockée en clair (seulement son empreinte).
- **FR-002** : Une clé révoquée DOIT être refusée (401) sur les deux routes ; chaque appel accepté
  DOIT mettre à jour la date de dernière activité de la clé.
- **FR-003** : Chaque contribution issue de l'outil DOIT porter l'identifiant de la clé comme
  identifiant d'appareil, le type « ressource » et l'origine « sniffer ».
- **FR-004** : La route de configuration DOIT renvoyer la version minimale, le lien de
  téléchargement, la liste des serveurs et le mapping actif du build demandé (ou `null`).
- **FR-005** : La version minimale et le lien de téléchargement DOIVENT être réglables dans la
  configuration du service, sans modifier le code.
- **FR-006** : Au plus un mapping DOIT être actif par build.
- **FR-007** : La route d'envoi DOIT refuser : 401 (clé), 426 (outil trop ancien), 409 (mapping qui
  n'est plus l'actif du build), 429 (plafond journalier), 400 (corps illisible, serveur inconnu, lot
  trop gros).
- **FR-008** : La route d'envoi DOIT répondre `{accepted, rejected: [{index, reason}]}`, `index`
  étant le rang de l'observation dans le lot (à partir de 0) et `reason` l'une de
  `not_an_ingredient`, `no_price`, `invalid`.
- **FR-009** : Seules les ressources connues du site (ingrédients des recettes, nourritures de
  familier, runes et autres ressources dont le site affiche le prix) DOIVENT être acceptées.
- **FR-010** : Le prix unitaire DOIT suivre exactement la « Règle du prix unitaire » ; le facteur 3
  et le seuil de 10 % sont des constantes nommées, documentées comme à recalibrer.
- **FR-011** : La médiane connue avant l'envoi et l'écart à celle-ci DOIVENT être calculés et
  stockés comme pour une saisie manuelle ; un écart ne DOIT jamais faire refuser un prix.
- **FR-012** : Chaque clé DOIT être plafonnée à 5000 contributions enregistrées par jour (UTC).
- **FR-013** : La liste des 13 serveurs DOIT être définie à un seul endroit, partagé par la lecture
  des prix Huzounet et par la nouvelle route ; seule la route d'envoi contrôle le serveur.
- **FR-014** : Aucune colonne ne DOIT être ajoutée aux contributions ; les prix de l'outil sont lus
  par le site exactement comme les autres contributions.

### Entités clés

- **Clé sniffer** : une clé par ami — libellé, empreinte de la clé, date de création, date de
  révocation (vide si active), date de dernière activité.
- **Mapping sniffer** : documents de décodage publiés pour une version du client de jeu — build,
  deux documents, date de dépôt, actif ou non. Historique conservé pour revenir en arrière.
- **Compteur journalier** : nombre de contributions enregistrées par une clé un jour donné.
- **Contribution communautaire** (existante) : gagne seulement la valeur d'origine « sniffer ».

## Critères de succès *(obligatoire)*

- **SC-001** : Un lot de ressources connues envoyé par un ami apparaît dans le prix communautaire
  affiché par le site sans autre action.
- **SC-002** : 100 % des cas de la table de la règle du prix unitaire donnent le prix attendu, dont
  « tous les lots ont doublé » et « x1 aberrant, x10 et x100 proches ».
- **SC-003** : Aucune clé ne peut faire enregistrer plus de 5000 contributions sur un jour.
- **SC-004** : Une clé révoquée n'enregistre plus rien dès sa révocation.
- **SC-005** : Aucun équipement ni identifiant inconnu n'entre dans les prix communautaires par cette
  voie.

## Hypothèses

- Les clés et les mappings sont créés par les pages d'administration de la phase 3 ; d'ici là, en
  local, par des requêtes SQL à la main.
- Les versions d'outil sont de la forme `X.Y.Z` (numériques) ; une version illisible est traitée
  comme trop ancienne (426).
- La date `seenAt` de l'observation est contrôlée pour sa forme mais n'est pas stockée : la date de la
  contribution est celle de son enregistrement, comme pour une saisie manuelle (aucune nouvelle
  colonne).
- Le catalogue des ressources connues est celui que l'API embarque déjà pour la lecture des prix
  Huzounet ; il couvre toutes les ressources de la page HDV du site, plus les runes.
- Le plafond par envoi (nombre d'observations) est fixé par le plan technique, assez bas pour tenir
  dans les limites d'exécution du plan gratuit.
- Rien n'est appliqué sur la base de production ni déployé dans cette fonctionnalité sans accord
  explicite du propriétaire.
