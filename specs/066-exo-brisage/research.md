# Recherche : Exos sur la page Brisage

## D1 – Règle de calcul d'un exo

- **Décision** : un exo est une ligne séparée, même formule de poids (`lineWeight`) ; sans focus il produit ses runes comme une ligne normale au coefficient de l'objet ; en focus sur une autre ligne il reçoit la part « autres lignes » (`focusOtherShare`, 50 %).
- **Justification** : lecture du bundle DoFocus (`docs/dofocus-brisage.md` : `total = Ml(F) + 0,5 × Σ Ml(autres) + 0,5 × Σ Ml(exos)`). Recherche web : aucune source officielle ne donne de formule d'exo au brisage. À signaler comme estimation.
- **Alternatives** : exo non réduit par le coefficient (rejeté : aucune source) ; exo ignoré en focus (rejeté : DoFocus le compte à 50 %).

## D2 – Pas de focus sur un exo

- **Décision** : l'analyse ne construit aucune option de focus pour une ligne exo (demande de l'utilisateur). L'exo reste dans `usableLines`, avec son drapeau conservé.
- **Justification** : règle du jeu connue de l'utilisateur.

## D3 – Plafond de poids 101

- **Décision** : `MAX_LINE_WEIGHT = 101` ; valeur maximale d'un exo = `floor(101 / poids de la stat)`, avec un petit epsilon pour les poids décimaux (0,2 → 505, 0,25 → 404). Le poids utilisé est celui des réglages (`settings.stats[effectId].weight`).
- **Justification** : demande de l'utilisateur ; s'applique à chaque exo, pas à la somme.

## D4 – Over sur une ligne d'origine

- **Décision** : le jet tapé d'une ligne d'origine est déjà libre au-dessus du maximum dans l'interface actuelle ; on ajoute le plafond de poids 101. Le plafond effectif d'une ligne est `max(floor(101 / poids), maximum de la ligne)` pour ne jamais refuser un jet naturel de l'objet (ex. Sagesse 60 × 3 = 180).
- **Justification** : l'utilisateur dit « poids max 101 pour l'over » ; refuser un jet que l'objet peut avoir naturellement serait absurde. À confirmer par l'utilisateur.
- **Comportement hors plafond** : jet refusé, jet moyen utilisé (comme un jet invalide aujourd'hui), message « maximum N ».

## D5 – Stats proposées en exo

- **Décision** : toute stat de `BRISAGE_STATS` qui a une rune (`runeForStat`) moins celles présentes dans les lignes de l'objet (même celles ignorées faute de rune) moins celles déjà en exo.
- **Justification** : un exo est une stat absente de base (spec FR-002).

## D6 – Persistance

- **Décision** : module `brisage-exos.ts`, clé `craftcheck-brisage-exos`, table `"<serveur>:<objet>" → [{effectId, value}]`. Valeurs invalides ignorées à la lecture ; absence de clé = aucun exo.
- **Justification** : la session existante ne garde qu'un objet ; la spec veut des exos par objet (US4 scénario 2). Une session sans exos continue de fonctionner (FR-012).
- **Alternative** : champ `exos` dans la session (rejeté : perdu en changeant d'objet).

## D7 – Valeur d'un exo entier et décimal

- **Décision** : entier strictement positif seulement (cas limites de la spec).
