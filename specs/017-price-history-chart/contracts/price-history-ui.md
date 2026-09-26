# Contrat : bouton, popover et courbe d'historique (application)

## Déclencheur

- Un bouton-icône (icône « chart »), `aria-label="Historique du prix"`, `aria-expanded`,
  `aria-haspopup="dialog"`.
- **Mode communautaire seulement** (FR-001). Il apparaît :
  - sur chaque ligne de ressource de la fiche (`ResourcePriceInput`, emplacement `history`), avec
    `kind: 'resource'` ;
  - à côté du champ « Prix HDV » (`MarketPriceInput`, emplacement `history`), avec `kind: 'item'`.
- Le clic appelle `preventDefault` (il est dans un `<label>`) et ouvre ou ferme le popover. Il ne
  donne jamais le focus au champ de prix.
- En Mode personnel, l'emplacement n'est pas rempli : aucun bouton ne s'affiche.

## Popover

- `role="dialog"`, `aria-label="Historique du prix de <nom>"`. Il est rendu dans `document.body` et
  positionné sous le déclencheur (ou au-dessus s'il manque de place), et repositionné au défilement
  ou au redimensionnement. Sous 480 px de large, il s'affiche en panneau fixe en bas de l'écran,
  sur la largeur de l'écran moins 16 px de chaque côté, sans défilement horizontal (FR-015).
- En-tête : nom de la ressource ou de l'objet, serveur actif, bouton « Fermer ».
- Sélecteur de regroupement : groupe de 3 boutons `Jour` / `Semaine` / `Mois` (`aria-pressed`). La
  valeur initiale vient de la préférence (`'week'` par défaut), et chaque changement l'enregistre
  (FR-007).
  (FR-005).
- Fermeture : Échap, clic hors du déclencheur et du panneau, « Fermer », changement de serveur ou
  de mode (démontage). Le défilement ne le ferme pas. Un seul popover est
  ouvert à la fois. À la fermeture par Échap ou « Fermer », le focus revient au déclencheur.

## États

| État | Contenu |
|---|---|
| chargement | squelette de la taille de la courbe, sans valeur |
| `unavailable` | « Historique indisponible pour le moment » (FR-013) |
| 0 point | « Pas encore d'historique pour ce serveur » |
| 1 point | « Pas assez d'historique » + « <période> : <médiane> kamas (<n> prix) », et « Essayez le regroupement <plus fin> » quand un regroupement plus fin a au moins 2 points |
| ≥ 2 points | courbe |

## Courbe (`PriceHistoryChart`)

- Un point par `HistoryPoint`, reliés par une ligne. L'abscisse est proportionnelle à
  `periodStart` : un trou dans le temps reste visible (FR-010). Aucun point à zéro, aucun point
  interpolé.
- Ordonnée : de la médiane minimale à la maximale, avec une marge, et 3 graduations en kamas
  abrégés (`formatKamas`). Abscisse : première et dernière période, et quelques repères
  intermédiaires si la largeur le permet.
- Info-bulle au survol, au focus clavier (chaque point est atteignable avec Tab) ou au toucher :
  période (« 21 sept. », « semaine du 14 sept. », « sept. 2026 »), « <médiane> kamas », « <n> prix ».
  Les points à 1 prix ont un marqueur visuel distinct (creux) et le texte « 1 prix ».
- Lisible en thème clair et sombre (couleurs par variables de thème) ; styles dans
  `comparison.css`, suivant la skill `dataviz`.

## Tests obligatoires

- Mode communautaire : bouton présent sur chaque ligne de ressource et sur « Prix HDV » ; Mode
  personnel : absent ;
- le clic ouvre le popover et ne donne pas le focus au champ ; Échap, clic extérieur et « Fermer »
  le ferment ; l'ouverture d'un second popover ferme le premier ;
- 0 point, 1 point (avec et sans invitation) et `unavailable` : aucune courbe ;
- ≥ 2 points : autant de points que de périodes ; un trou de 3 semaines produit un écart
  proportionnel ;
- le changement de regroupement redessine la courbe sans nouvelle requête et est retenu à la
  réouverture ;
- le changement de serveur ferme le popover ;
- le prix du champ et la comparaison sont identiques avant et après l'ouverture (FR-014).
