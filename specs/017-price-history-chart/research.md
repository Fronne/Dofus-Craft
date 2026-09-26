# Research : Graphe d'historique des prix HDV

Aucun point du contexte technique n'était marqué NEEDS CLARIFICATION. La profondeur d'historique a été
tranchée dans la spec (90 jours, rétention inchangée). Les décisions ci-dessous fixent les choix de
conception.

## 1. Où calculer les points : dans le Worker

- **Décision** : le Worker calcule les points. L'application ne reçoit que
  `{ periodStart, medianAmountKamas, sampleSize }`.
- **Raison** : FR-006 interdit d'exposer un prix individuel. Aujourd'hui déjà, aucune route ne renvoie
  une contribution brute (schema.sql, specs/004). Calculer côté client obligerait à envoyer les lignes
  brutes.
- **Alternatives écartées** : renvoyer les contributions et regrouper côté client (viole FR-006) ;
  stocker des agrégats précalculés par un cron (ajoute une table et une tâche pour quelques centaines
  de lignes, contraire au principe IV).

## 2. Une réponse avec les trois regroupements

- **Décision** : `GET /price-history` renvoie `day`, `week` et `month` en une seule réponse.
- **Raison** : la réponse reste minuscule (au plus 91 + 14 + 4 points). Changer de regroupement ne
  refait aucune requête. L'application sait aussi si un regroupement plus fin a au moins 2 périodes,
  ce qui sert l'invitation de l'état « pas assez d'historique » (US4 scénario 2).
- **Alternatives écartées** : un paramètre `grouping` (une requête à chaque changement, et on ne sait
  pas à l'avance si un regroupement plus fin est utile).

## 3. Règle de calcul d'un point

- **Décision**, dans cet ordre :
  1. prendre les contributions du `kind` demandé (`'resource'` ou `'item'`), de l'identifiant et du
     serveur, dont `created_at` tombe dans les 90 derniers jours (`retentionCutoff()`) ;
  2. attribuer chaque contribution à sa période, en heure de Paris ;
  3. garder toutes les contributions de la période, sans dédoublonner par appareil (révision du
     2026-09-26 : chaque prix partagé compte) ;
  4. calculer les bornes des valeurs aberrantes (`outlierBounds`, écart interquartile, sans effet
     sous 4 valeurs) **sur l'ensemble des lignes gardées à l'étape 3 pour ce regroupement**, puis
     écarter les lignes hors bornes ;
  5. pour chaque période restante : médiane (`percentileCont(0.5)`, arrondie) et nombre de lignes
     gardées ; une période vidée par le filtre disparaît.
- **Raison** : on reprend les règles du prix communautaire actuel (FR-004). Filtrer sur toute la
  fenêtre (hypothèse de la spec) est plus fiable qu'un filtre période par période, qui n'aurait
  presque jamais 4 valeurs. Dédoublonner par période plutôt que sur toute la fenêtre garde la
  variation d'un joueur qui relève le prix chaque semaine, sans qu'une correction faite dans la même
  journée compte deux fois.
- **Alternatives écartées** : filtre par période (inopérant avec peu de données) ; dédoublonnage sur
  toute la fenêtre (effacerait l'historique d'un joueur qui relève régulièrement les prix).
- **Conséquence connue** : la médiane de la période la plus récente peut différer du prix
  communautaire affiché dans le champ, car celui-ci porte sur 90 jours. Ce sont deux mesures
  différentes, et le popover le dit (« médiane par période »).

## 4. Courbe : SVG dessiné à la main

- **Décision** : un composant `PriceHistoryChart` en SVG en ligne. Il affiche une ligne et des points,
  un axe du temps proportionnel (FR-010), des graduations de prix en kamas abrégés et une info-bulle
  au survol, au focus ou au toucher. La mise en forme (couleurs, contraste en thème clair et sombre,
  taille des cibles) suivra la skill `dataviz` à l'implémentation.
- **Raison** : le projet n'a aucune bibliothèque de graphiques. Une seule série de moins de 100
  points ne justifie pas d'en ajouter une (principe IV, poids du bundle).
- **Alternatives écartées** : Recharts, Chart.js (nouvelle dépendance pour un seul graphe).

## 5. Popover : portail hors du `<label>`

- **Décision** : `PriceHistoryButton` rend un bouton déclencheur et, une fois ouvert, un panneau via
  `createPortal` dans `document.body`. Le panneau est positionné par rapport au déclencheur
  (`getBoundingClientRect`). Il se ferme avec Échap, par un clic hors du déclencheur et du panneau,
  ou avec « Fermer ». Au défilement ou au redimensionnement, il est **repositionné** (il suit le
  déclencheur) plutôt que fermé : sur téléphone, il faut souvent faire défiler pour le voir en entier.
  Sous 480 px, il s'affiche en panneau fixe en bas de l'écran (pleine largeur moins 16 px de chaque
  côté), ce qui évite tout calcul de position.
- **Raison** : `ResourcePriceInput` est un `<label>`. Un clic dans un panneau placé à l'intérieur
  donnerait le focus au champ de prix. Le comportement de fermeture reprend `DungeonCounterBubble`,
  et un seul popover reste ouvert à la fois (un clic sur un autre déclencheur est un clic « à
  l'extérieur »). Le déclencheur appelle `preventDefault` comme le bouton crayon.
- **Alternatives écartées** : panneau dans le label (conflit de focus) ; `<dialog>` modal (la spec
  demande un popover qui laisse voir la page) ; fermeture au défilement (sur téléphone, le popover se
  fermerait dès qu'on fait défiler pour le voir).

## 6. Chargement et cache

- **Décision** : `usePriceHistory` charge l'historique à l'ouverture du popover. Le résultat est
  gardé dans une `Map` en mémoire par `kind:id:serverId` pour la visite. Il n'y a pas de cache
  `localStorage`. Service injoignable : état `unavailable` et message de FR-013.
- **Raison** : l'historique est une information consultée ponctuellement. Afficher un vieil historique
  sans le dire tromperait (principe I), et 5 minutes d'écart ne changent rien à une tendance sur
  90 jours.
- **Alternatives écartées** : cache persistant comme le prix communautaire (utile pour afficher le
  prix au chargement de la fiche, pas pour un popover ouvert à la demande).

## 7. Heure de Paris dans le Worker

- **Décision** : la date locale de chaque contribution est obtenue avec
  `Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' })` (format `AAAA-MM-JJ`), disponible dans
  le runtime Workers. La semaine est identifiée par la date de son lundi, et le mois par son premier
  jour. `periodStart` est une date civile `AAAA-MM-JJ`, sans heure.
- **Raison** : FR-008. Calculer sur la date civile évite les décalages au changement d'heure : une
  contribution à 00:30 heure de Paris le 26 octobre appartient au 26.
- **Alternatives écartées** : jours UTC (une contribution faite entre minuit et 2 h heure de Paris
  tomberait sur la veille) ; fuseau de l'appareil (deux joueurs verraient des points différents).

## 8. Visibilité et sources

- **Décision** : le bouton n'est passé qu'en Mode communautaire. Pour une ressource, il est passé par
  la branche communautaire de `RecherchePage` (celle qui rend `ResourcePriceInput` avec
  `lockWhenFilled`), avec `kind: 'resource'`. Pour l'objet, il est passé à côté de `MarketPriceInput`
  quand `community` est vrai, avec `kind: 'item'`. Au changement de serveur ou de mode, le
  déclencheur est démonté ou reçoit un autre `serverId`, et le popover se ferme.
- **Raison** : FR-001 et les cas limites « changement de serveur / de mode ». Fermer est plus simple
  que mettre à jour et ne mélange jamais deux serveurs.

## 9. Rétention

- **Décision** : aucun changement. La dernière contribution d'un objet de plus de 90 jours, gardée
  pour `/latest-price`, est exclue de l'historique par la même borne `retentionCutoff()`.
- **Raison** : clarification de la spec (option A) et FR-011/FR-012.
