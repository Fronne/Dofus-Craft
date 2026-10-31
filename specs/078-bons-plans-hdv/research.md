# Research: Bons plans HDV

## R1 – Où calculer les bons plans

- **Decision**: côté site, dans `src/domain/good-deals.ts` ; le Worker sert les annonces fraîches brutes.
- **Rationale**: les effets possibles d'un objet (`brisage-items.json`, 1,1 Mo) et les poids de stats (`brisage.ts`) sont déjà dans le bundle du site ; les importer dans le Worker l'alourdirait. Le domaine pur se teste sans base.
- **Alternatives**: calcul dans le Worker à chaque lecture (rejeté : charge, doublon des données) ; calcul à l'écriture (rejeté : la référence change à chaque nouvelle annonce).

## R2 – Mesurer la « qualité » d'un jet

- **Decision**: qualité = somme, sur les lignes de jet, de `valeur × poids de la stat` (poids de `BRISAGE_STATS`, par `effectId`). Une stat inconnue pèse 0 et le dit (ligne ignorée, comptée dans `unknownLines`).
- **Rationale**: répond à « certaines stats ont plus de valeur » avec une donnée déjà documentée du projet, sans table de plus.
- **Alternatives**: comparer stat par stat (rejeté : pas d'ordre total) ; prix des runes (rejeté : dépend des prix du moment).
- **Limite assumée**: les poids de brisage sont une estimation (voir `brisage.ts`) ; la règle est regroupée en constantes pour être ajustée.

## R3 – Détecter un exo

- **Decision**: une ligne est un exo quand son `effectId` n'est pas dans les effets de l'objet (`brisage-items.json`). Son poids est multiplié par `EXO_FACTOR` (1,5, constante réglable).
- **Rationale**: le client n'envoie que ce que le jeu affiche ; les plages normales viennent des données statiques (le client ne les envoie pas, voir `CLAUDE.md` du client).
- **Alternatives**: marqueur d'exo dans le paquet (non vérifié, hors de portée).
- **À vérifier**: que le `effect` du client est bien l'`effectId` DofusDB (voir R7).

## R4 – Règle de comparaison

- **Decision**: pour un exemplaire `c`, voisins = autres exemplaires du même objet, serveur et même ensemble d'exos, dont la qualité est à ±25 % de celle de `c`. Au moins 3 voisins. Prix attendu = médiane des `prix_d × q_c / q_d`. Bon plan si `prix_c ≤ (1 − seuil) × attendu`. Économie = `attendu − prix_c`.
- **Rationale**: le ratio `q_c / q_d` règle d'un coup « jet proche » et « meilleur jet au même prix » (FR-006) ; la médiane et le minimum de 3 voisins résistent à un prix aberrant (FR-007).
- **Alternatives**: voisins stricts à ±10 % sans mise à l'échelle (rejeté : rate les jets supérieurs au même prix) ; régression prix/qualité (rejeté : trop peu d'annonces).
- **Constantes** (`NEIGHBOUR_RANGE = 0.25`, `MIN_NEIGHBOURS = 3`) à ajuster à l'usage ; testées aux bornes.

## R5 – Écritures D1 et plafond

- **Decision (révisée après analyse C1)**: les exemplaires ont leur **propre plafond quotidien** par clé (`COPY_DAILY_LIMIT = 20 000`, colonne `copies_written` de `sniffer_daily_usage`, migration 0028) ; le plafond existant de 5 000 ne compte que les observations, comme avant.
- **Ancienne décision (abandonnée)**: un exemplaire compte pour une ligne dans le plafond quotidien existant (5 000 par clé), ce qui limitait un ami à une centaine d'objets par jour. L'envoi des exemplaires d'un objet remplace ses annonces du serveur en un lot (mise à jour des vues, suppression des disparues). Le client n'envoie les exemplaires d'un objet qu'au rythme déjà en place (au plus une fois par heure par objet, si un prix a changé de plus de 2 %).
- **Rationale**: borne les écritures sans changer le plafond ; la durée de vie de 24 h tolère un relevé par heure.
- **Risque**: si le plafond bride trop les amis, le relever est une décision séparée (mesure : `sniffer_daily_usage`).
- **Alternatives**: plafond séparé pour les annonces (rejeté : complexité sans besoin démontré).

## R6 – Disparition des annonces

- **Decision**: à la réception des exemplaires d'un objet, les annonces du même objet et serveur absentes du lot sont supprimées ; les lectures ne servent que `last_seen_at ≥ maintenant − 24 h` ; la purge hebdomadaire existante supprime aussi les annonces de plus de 24 h.
- **Rationale**: FR-011 et le scénario 3 de la user story 3.
- **Alternatives**: marquer « vendu » (rejeté : aucun historique voulu).

## R7 – Format côté client

- **Decision**: `copies` optionnel dans l'observation, `lots` inchangé (prix le moins cher) pour la compatibilité (FR-014). Chaque copie : `listingId`, `price`, `stats[{effectId, value}]`.
- **Rationale**: les clients plus anciens continuent de marcher ; le Worker n'exige pas `copies`.
- **À vérifier au démarrage de l'implémentation**: sur une capture du client (`sniffer/testdata`), que `effect` correspond à un `effectId` DofusDB connu et que `listing_id` est stable entre deux relevés du même exemplaire. Si ce n'est pas le cas, repli : identifiant = empreinte (objet, prix, jet).

## R8 – Réglage du seuil et page

- **Decision**: seuil entier en pourcentage dans `site_settings` (clé `good_deal_threshold`, défaut 25, bornes 5–90), lu par `GET /bons-plans` ; la page est aussi un réglage de page (activable) comme les autres pages.
- **Rationale**: suit le modèle de `specs/050`/`053`/`071` ; `site_settings` ne stocke aujourd'hui que des `'0'/'1'` : la lecture du seuil est donc séparée de `readSiteSettings`.
- **Alternatives**: variable `wrangler.toml` (rejeté : exige une livraison).

## R9 – Où montrer la pastille

- **Decision**: une liste « Annonces à l'HDV » sur la fiche de comparaison d'un équipement (`ComparisonResult`), qui n'existe pas aujourd'hui ; chaque ligne porte jets, prix, âge et, si besoin, la pastille. La page « Bons plans » renvoie vers l'objet.
- **Rationale**: aucun écran n'affiche aujourd'hui les exemplaires ; c'est le point d'entrée naturel d'un objet.
- **À préciser en tâche**: emplacement visuel exact (proposition de maquette avant d'implémenter).
