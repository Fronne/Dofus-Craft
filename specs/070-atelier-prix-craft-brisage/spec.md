# Spécification : Atelier des prix du craft sur la page Brisage

**Branche**: `070-atelier-prix-craft-brisage`

**Créée le**: 2026-10-22

**Statut**: Brouillon

**Entrée**: « Atelier des prix du craft sur la page Brisage. Un bouton « Modifier les prix » dans l'en-tête de l'objet (à côté du prix « Craft ») ouvre une fenêtre en forme d'atelier : une ligne par ressource avec son nom, sa quantité et son prix unitaire modifiable, y compris les ressources des sous-recettes (composants eux-mêmes craftables). Saisie rapide au clavier (Entrée passe à la ligne suivante), enregistrement de chaque prix comme sur la page Recherche (même mécanisme de prix partagé), total du craft mis à jour en direct, et recalcul automatique du coût de craft sur Brisage à la fermeture, sans passer par la page Recherche. »

Cette spec prolonge `specs/062-prix-objet-brisage` (le prix « Craft » de l'objet vient de la chaîne de craft chiffrée avec les prix de ressources déjà notés) et s'appuie sur le panneau « Prix des ressources » de la page Recherche, seul endroit où ces prix s'éditent aujourd'hui.

## Scénarios utilisateur et tests *(obligatoire)*

### User Story 1 - Mettre à jour les prix du craft sans quitter Brisage (Priorité : P1)

Sur la page Brisage, une fois un objet choisi, un bouton « Modifier les prix » est proposé dans l'en-tête de l'objet, à côté du prix « Craft ». Il ouvre une fenêtre qui liste toutes les ressources nécessaires pour fabriquer l'objet, avec pour chacune son nom, la quantité requise et son prix unitaire dans un champ modifiable. Le joueur corrige les prix qui ont changé, ferme la fenêtre, et le prix « Craft » de l'objet ainsi que le verdict de brisage sont immédiatement recalculés. Il n'a plus besoin d'aller sur la page Recherche pour cela.

**Pourquoi cette priorité** : c'est le cœur de la demande. Aujourd'hui, un joueur qui voit un prix de craft périmé ou incomplet sur Brisage doit changer de page, retrouver l'objet, mettre à jour ses ressources, puis revenir.

**Test indépendant** : ouvrir un objet dont la recette a au moins trois ressources, ouvrir la fenêtre, modifier le prix d'une ressource, fermer, et vérifier que le prix « Craft » et le verdict ont changé en conséquence.

**Scénarios d'acceptation** :

1. **Étant donné** un objet choisi sur Brisage, **quand** la page s'affiche, **alors** un bouton « Modifier les prix » est visible dans l'en-tête de l'objet, à côté du prix « Craft ».
2. **Étant donné** un objet qui a une recette, **quand** le joueur clique sur « Modifier les prix », **alors** une fenêtre s'ouvre avec une ligne par ressource : son nom, la quantité nécessaire pour un craft de l'objet et son prix unitaire dans un champ modifiable.
3. **Étant donné** la fenêtre ouverte, **quand** le joueur modifie le prix unitaire d'une ressource, **alors** le sous-total de la ligne et le total du craft affichés dans la fenêtre se mettent à jour pendant la saisie.
4. **Étant donné** que le joueur a modifié un ou plusieurs prix, **quand** il ferme la fenêtre, **alors** le prix « Craft » de l'objet, le verdict, les gains et les cartes de la page Brisage sont recalculés avec les nouveaux prix, sans rechargement de page.
5. **Étant donné** un prix modifié dans la fenêtre, **quand** le joueur ouvre ensuite la page Recherche sur le même objet, **alors** il y retrouve ce même prix de ressource : c'est la même information, pas une copie séparée.
6. **Étant donné** un objet sans recette, **quand** la page s'affiche, **alors** le bouton « Modifier les prix » n'est pas proposé (ou est désactivé avec une mention qu'aucun craft n'existe), sans fenêtre vide.

---

### User Story 2 - Saisie rapide au clavier (Priorité : P2)

Dans la fenêtre, le joueur enchaîne les prix sans toucher la souris : à l'ouverture, le premier champ de prix est actif, la touche Entrée enregistre le prix saisi et passe à la ligne suivante, et sur la dernière ligne elle reste sur place ou ferme la fenêtre. La touche Échap ferme la fenêtre. Le contenu d'un champ est sélectionné quand il devient actif, pour pouvoir le remplacer en tapant directement.

**Pourquoi cette priorité** : une recette peut avoir une dizaine de ressources ; sans saisie fluide, l'atelier ne serait pas plus rapide que la page Recherche.

**Test indépendant** : ouvrir la fenêtre sur une recette de huit ressources, saisir huit prix à la suite uniquement au clavier, et vérifier qu'ils sont tous pris en compte.

**Scénarios d'acceptation** :

1. **Étant donné** la fenêtre qui vient de s'ouvrir, **quand** elle s'affiche, **alors** le premier champ de prix est actif et son contenu est sélectionné.
2. **Étant donné** un champ de prix actif, **quand** le joueur tape un montant puis appuie sur Entrée, **alors** le prix est enregistré et le champ de la ligne suivante devient actif.
3. **Étant donné** la fenêtre ouverte, **quand** le joueur appuie sur Échap, **alors** la fenêtre se ferme et le prix « Craft » de la page est recalculé comme à la fermeture normale.
4. **Étant donné** un champ de prix actif, **quand** le joueur passe à un autre champ avec la touche Tab ou la souris, **alors** le prix saisi est enregistré, comme avec Entrée.
5. **Étant donné** que la fenêtre est ouverte, **quand** le joueur navigue au clavier, **alors** le focus reste dans la fenêtre jusqu'à sa fermeture, et revient au bouton « Modifier les prix » à la fermeture.

---

### User Story 3 - Ressources des sous-recettes (Priorité : P1)

Quand un ingrédient de la recette est lui-même craftable (un composant fabriqué à partir d'autres ressources), la fenêtre permet de chiffrer ce composant au choix : soit en saisissant son prix d'achat, soit en saisissant les prix de ses propres ressources. Les ressources des sous-recettes sont donc présentes dans la fenêtre, regroupées sous leur composant, avec leur nom, leur quantité (déjà multipliée par la quantité du composant dans la recette de l'objet) et leur prix unitaire modifiable.

**Pourquoi cette priorité** : beaucoup d'objets à briser ont des recettes à plusieurs niveaux ; sans les sous-recettes, l'atelier ne couvrirait qu'une partie du coût réel et le joueur devrait quand même retourner sur Recherche.

**Test indépendant** : ouvrir un objet dont la recette contient un composant craftable, modifier le prix d'une ressource de ce composant, et vérifier que le total du craft de l'objet change comme sur la page Recherche pour le même choix de recette.

**Scénarios d'acceptation** :

1. **Étant donné** une recette dont un ingrédient est craftable, **quand** la fenêtre s'ouvre, **alors** les ressources de cet ingrédient sont listées sous lui, avec leurs quantités totales pour un craft de l'objet.
2. **Étant donné** un composant craftable, **quand** le joueur choisit de le chiffrer par ses ressources, **alors** son prix devient la somme de ses ressources chiffrées, et le total du craft de l'objet en tient compte ; le choix (acheter ou crafter le composant) est le même que celui déjà mémorisé sur les pages Recherche et Épingles.
3. **Étant donné** un composant craftable que le joueur chiffre par son prix d'achat, **quand** il saisit ce prix, **alors** ses sous-ressources ne comptent pas dans le total, et la fenêtre l'indique clairement.
4. **Étant donné** une ressource présente à plusieurs endroits de la chaîne (par exemple dans la recette de l'objet et dans celle d'un composant), **quand** le joueur modifie son prix, **alors** toutes ses occurrences se mettent à jour, car c'est le même prix de ressource.
5. **Étant donné** un composant dont une des ressources n'a pas de prix, **quand** la fenêtre s'affiche, **alors** cette ressource est signalée comme sans prix et le total du craft est présenté comme incomplet, sans montant partiel donné pour complet.

---

### User Story 4 - Comprendre l'état des prix (Priorité : P3)

Dans la fenêtre, chaque ligne indique, comme sur la page Recherche, si son prix est ancien (« Dernière mise à jour : il y a N jours ») ou absent, pour que le joueur sache quels prix mérite d'être refaits en premier. Les lignes dont le prix manque sont mises en évidence et placées de façon à être vues sans défiler.

**Pourquoi cette priorité** : c'est un confort qui rend l'atelier plus utile, mais la mise à jour fonctionne sans.

**Test indépendant** : ouvrir un objet dont certains prix sont anciens et d'autres absents, et vérifier les mentions de chaque ligne.

**Scénarios d'acceptation** :

1. **Étant donné** une ressource dont le prix a une date de mise à jour, **quand** la fenêtre s'affiche, **alors** la ligne indique depuis quand le prix a été mis à jour.
2. **Étant donné** une ressource sans prix, **quand** la fenêtre s'affiche, **alors** la ligne le dit et son champ est vide, prêt à être rempli.
3. **Étant donné** que le joueur vient d'enregistrer un prix, **quand** la ligne se met à jour, **alors** elle indique que le prix vient d'être mis à jour.

---

### Cas limites

- Prix saisi négatif, décimal ou non numérique : il n'est pas enregistré, l'ancien prix reste en place et le champ signale la saisie refusée, sans effacer silencieusement le prix existant. Un champ vidé retire le prix, comme sur Recherche.
- Échap pendant une saisie : le champ reprend le prix qu'il avait à son entrée (comportement des champs de prix du site), puis la fenêtre se ferme.
- Prix très élevé : accepté dans les mêmes limites que sur la page Recherche ; au-delà, il est refusé avec un message clair.
- Enregistrement impossible (hors ligne, partage indisponible) : le prix reste conservé sur l'appareil comme sur la page Recherche, et le joueur est averti si le partage a échoué, sans perdre sa saisie.
- Mode de prix actif (personnel ou communautaire) : les prix de la fenêtre sont ceux du mode actif, comme partout ailleurs sur le site ; modifier un prix l'enregistre dans ce mode.
- Changement d'objet ou de page pendant que la fenêtre est ouverte : la fenêtre se ferme proprement après avoir enregistré les saisies terminées.
- Objet dont la recette change selon plusieurs recettes possibles : la fenêtre présente la recette retenue par le joueur, avec son choix habituel conservé.
- Recette très longue (nombreuses ressources et sous-recettes) : la liste défile dans la fenêtre sans que le total ni les boutons de fermeture disparaissent.
- Petit écran : la fenêtre reste utilisable, en occupant la largeur de l'écran, avec des champs de saisie assez grands pour être touchés.
- Prix déjà noté à l'identique : enregistrer la même valeur ne la présente pas comme une mise à jour.

## Exigences *(obligatoire)*

### Exigences fonctionnelles

- **FR-001** : la page Brisage MUST proposer, dans l'en-tête de l'objet choisi et à côté du prix « Craft », un bouton « Modifier les prix » qui ouvre la fenêtre de l'atelier.
- **FR-002** : la fenêtre MUST lister toutes les ressources de la chaîne de craft de l'objet, avec pour chacune son nom, la quantité nécessaire pour un craft de l'objet et son prix unitaire modifiable.
- **FR-003** : pour chaque ingrédient lui-même craftable, la fenêtre MUST présenter ses ressources regroupées sous lui, avec leurs quantités totales pour un craft de l'objet, et permettre de le chiffrer soit par son prix d'achat, soit par les prix de ses ressources, selon le choix déjà utilisé par les pages Recherche et Épingles.
- **FR-004** : le prix modifié d'une ressource MUST être enregistré par le même mécanisme et à la même place que sur la page Recherche (y compris le partage avec les autres joueurs selon le mode de prix actif) : une modification faite dans l'atelier MUST se retrouver sur Recherche et Épingles, et inversement.
- **FR-005** : la fenêtre MUST afficher le sous-total de chaque ligne et le total du craft, et les mettre à jour pendant la saisie, avant même la fermeture.
- **FR-006** : à la fermeture de la fenêtre, la page Brisage MUST recalculer le prix « Craft », le verdict, les gains et les cartes avec les prix modifiés, sans rechargement de page.
- **FR-007** : la saisie MUST pouvoir se faire entièrement au clavier : focus sur le premier champ à l'ouverture, Entrée qui enregistre et passe à la ligne suivante, Échap qui ferme, focus rendu au bouton d'ouverture à la fermeture.
- **FR-008** : un prix qui n'est pas un nombre entier de kamas (lettres, négatif, décimal) MUST être refusé avec un message clair, sans remplacer ni effacer le prix déjà en place ; comme sur la page Recherche, zéro est un prix valide et un champ vidé volontairement retire le prix.
- **FR-009** : la fenêtre MUST signaler les ressources dont le prix manque, et le total du craft MUST être présenté comme incomplet tant qu'un prix nécessaire manque ; elle MUST NOT inventer ni estimer un prix.
- **FR-010** : chaque ligne MUST indiquer l'ancienneté de son prix ou son absence, avec la même formulation que la page Recherche.
- **FR-011** : la fenêtre MUST distinguer ce que le joueur a saisi de ce qui est calculé (sous-totaux, totaux, prix d'un composant déduit de ses ressources).
- **FR-012** : si l'objet n'a pas de recette, le bouton « Modifier les prix » MUST NOT ouvrir de fenêtre vide : il est absent ou désactivé avec une explication.
- **FR-013** : la fenêtre MUST rester utilisable sur petit écran et avec de longues recettes, sans masquer le total ni les commandes de fermeture.
- **FR-014** : la fenêtre MUST respecter les conventions d'accessibilité d'une boîte de dialogue (titre annoncé, focus piégé dans la fenêtre pendant qu'elle est ouverte, fermeture au clavier).
- **FR-015** : la fenêtre MUST NOT modifier l'objet choisi, le coefficient de brisage ni les autres réglages de la session Brisage : elle ne change que des prix de ressources.

### Entités clés

- **Ressource de la chaîne de craft** : une ressource nécessaire, directement ou par un composant, pour fabriquer l'objet. Attributs : nom, quantité totale pour un craft de l'objet, prix unitaire courant, date de dernière mise à jour du prix.
- **Composant craftable** : un ingrédient de la recette qui se fabrique lui-même à partir d'autres ressources. Il porte un choix (acheter ou crafter) et regroupe ses propres ressources.
- **Prix de ressource** : le prix unitaire noté pour une ressource dans le mode de prix actif ; partagé entre Brisage, Recherche et Épingles.
- **Total du craft** : la somme chiffrée de la chaîne selon les choix de recette et d'achat retenus ; marqué incomplet si un prix nécessaire manque.

## Critères de réussite *(obligatoire)*

### Résultats mesurables

- **SC-001** : un joueur met à jour les prix de huit ressources d'une recette et retrouve son verdict de brisage recalculé en moins de 45 secondes, sans quitter la page Brisage, là où le même parcours par la page Recherche demande de changer de page deux fois.
- **SC-002** : 100 % des prix modifiés dans l'atelier se retrouvent identiques sur la page Recherche pour le même objet, et inversement.
- **SC-003** : le total du craft affiché dans l'atelier est identique à celui de la page Recherche et au prix « Craft » de Brisage pour les mêmes prix et les mêmes choix de recette, sur tous les objets testés, sous-recettes comprises.
- **SC-004** : un joueur saisit les prix de toutes les ressources d'une recette uniquement au clavier, sans toucher la souris.
- **SC-005** : à aucun moment un prix manquant n'est présenté comme un total complet ; un prix invalide n'efface jamais un prix existant.
- **SC-006** : la fenêtre reste entièrement utilisable (lecture, saisie, fermeture) sur un écran de téléphone, y compris pour une recette de plus de quinze lignes.

## Hypothèses

- Les joueurs concernés sont ceux de la page Brisage, qui veulent juger la rentabilité de briser un objet qu'ils fabriquent, et dont le prix de craft dépend de prix de ressources qui bougent souvent.
- Le prix « Craft » de l'objet, les choix de recette, les choix « acheter ou crafter » d'un composant et les prix de ressources existent déjà et sont partagés entre les pages ; cette fonctionnalité les réutilise sans les redéfinir.
- La fenêtre est un panneau modal ouvert depuis l'en-tête de l'objet : elle ne remplace ni la page Recherche ni son panneau « Prix des ressources », qui restent disponibles.
- Les quantités affichées sont celles d'un seul craft de l'objet, sous-recettes comprises ; le prix par lot (ressources vendues par 10 ou 100) suit le comportement déjà en place sur Recherche.
- Hors périmètre : modifier la recette elle-même, changer l'objet choisi, éditer le prix de l'objet fini ou le coefficient de brisage, et l'historique ou le graphique des prix d'une ressource depuis la fenêtre.
- Le lien du nom de l'objet vers la page Recherche est un travail séparé (worktree `brisage-lien-recherche`) ; il n'est pas un prérequis de cette fonctionnalité.
