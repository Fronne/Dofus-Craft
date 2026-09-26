# Research: Historique des prix par fenêtre de temps

## §1 Forme de la réponse : trois listes déjà filtrées

- **Décision** : `GET /price-history` renvoie `{ day, week, month }`, chaque liste contenant les prix
  de sa fenêtre, valeurs aberrantes écartées sur cette fenêtre, triés par date croissante.
- **Raison** : FR-004 calcule les bornes des aberrants par fenêtre ; les calculer dans le Worker
  garde la règle au même endroit que pour le prix communautaire (`outlierBounds` de `median.ts`) et
  laisse une seule requête par ouverture. Les listes se recoupent (un prix de l'heure passée est dans
  les trois), ce qui reste minuscule pour ce volume.
- **Alternatives** : une seule liste sur 30 jours filtrée par l'application — duplique la règle des
  aberrants côté client ; une requête par fenêtre — trois allers-retours au lieu d'un.

## §2 Horodatage exposé

- **Décision** : `sharedAt` en ISO 8601 UTC, **arrondi à la minute inférieure** (secondes et
  millisecondes à zéro). Aucun autre champ de la contribution (ni `device_id`, ni `id`).
- **Raison** : la minute suffit à l'info-bulle (FR-005) ; retirer les secondes rend plus difficile
  de relier un prix à une saisie observée à la seconde près.
- **Alternatives** : horodatage brut — plus précis que nécessaire ; à l'heure — deux prix de la
  même heure se superposeraient sur l'axe de 24 h.

## §3 Fenêtres

- **Décision** : bornes `now − 24 h`, `now − 7 × 24 h`, `now − 30 × 24 h`, incluses ; `now` est
  l'instant de la requête côté Worker. Durées fixes, indépendantes du changement d'heure.
- **Raison** : spec, Edge Cases. Une seule requête SQL lit les 30 derniers jours, les trois fenêtres
  sont découpées en mémoire.
- **Alternatives** : jours civils en heure de Paris (« aujourd'hui ») — ne correspond pas à « les
  dernières 24 h » retenu par le porteur du projet.

## §4 Règle d'affichage côté application

- **Décision** : pour la fenêtre choisie : ≥ 2 prix → courbe ; 1 prix → ce prix, sa date et son
  heure ; 0 prix → « Pas encore d'historique pour ce serveur » si `month` est vide, sinon « Aucun prix
  partagé sur cette période » et une invitation vers la plus petite fenêtre **plus longue** ayant
  au moins 2 prix, s'il y en a une. Avec 1 prix, l'invitation vers une fenêtre plus longue ayant au
  moins 2 prix est aussi proposée.
- **Raison** : FR-007. Les fenêtres étant emboîtées, seule une fenêtre plus longue peut contenir plus
  de prix (l'inverse de la spec 017, qui renvoyait vers un regroupement plus fin).

## §5 Courbe

- **Décision** : même composant SVG. L'axe horizontal va de `début de fenêtre` à `instant du
  chargement`, ce qui place les prix à leur écart réel (FR-008). Étiquettes d'axe : heures pour
  « Jour » (ex. « 14 h »), jours pour « Semaine » et « Mois » (ex. « 22 sept. »). Info-bulle : prix,
  puis date et heure en heure de Paris (« 24 sept. à 14:05 »). Le style « prix unique » de la spec
  017 (`--single`) disparaît : tous les points sont des prix uniques.
- **Raison** : FR-005, FR-008 ; réutiliser le composant garde le comportement tactile et accessible
  déjà testé (réticule, table cachée pour les lecteurs d'écran).

## §6 Déploiement

- **Décision** : déployer le Worker puis le site dans la foulée. Entre les deux, l'ancien site lit
  une réponse qu'il ne reconnaît pas et affiche « Historique indisponible pour le moment » (repli
  existant de `getPriceHistory`), sans erreur.
- **Alternatives** : versionner la route — inutile pour un petit groupe et quelques secondes d'écart.
