# Research: Calcul des bons plans selon la valeur de marché

## R1 – Mêmes défauts ou même nombre de défauts

- **Decision**: exiger exactement les mêmes défauts (FR-011).
- **Rationale**: un défaut de Vitalité et un défaut de Dommages Neutre ne valent pas la même chose.
- **Alternatives considered**: même nombre de défauts, qui juge 1642 annonces au lieu de 1474 sur l'instantané, avec 119 bons plans au lieu de 109, mais compare des jets de valeur différente.

## R2 – Où ranger les règles

- **Decision**: constantes dans `src/domain/good-deals.ts`, à côté de `EXO_FACTOR`.
- **Rationale**: seuls les bons plans s'en servent, et `brisage.ts` ne doit pas changer (FR-007).
- **Alternatives considered**: réglage dans l'admin, écarté : aucun besoin actuel (constitution IV).

## R3 – Poids du palier

- **Decision**: le palier utilise le poids du brisage, sans coefficient d'importance.
- **Rationale**: il mesure la difficulté de fabrication, pas l'intérêt pour les joueurs. Un exo Sagesse à 10 pèse 30.

## R4 – Effets sans poids

- **Decision**: rester ignorés, comme en 078.
- **Rationale**: lus sur DofusDB le 2026-11-02, neuf des dix plus fréquents sont des malus (`754` −Fuite, `116` −Portée, `421` −Résistance Critiques, `162` −Esquive PA, `163` −Esquive PM, `171` −Critique, `755` −Tacle, `175` −Initiative, `101` −PA). `2825` est « Empêche les futures forgemagies ».
- **Alternatives considered**: séparer les annonces portant `2825`, hors du périmètre de cette spec. À traiter à part si le propriétaire juge que ça change le prix.

## R5 – Maximum d'une stat

- **Decision**: le maximum vaut le plus grand de `from` et `to`. Une stat aux bornes inconnues ne produit pas de défaut.
- **Rationale**: même lecture que `theoreticalRange`, et une borne absente ne doit pas inventer un défaut.

## R6 – Effet sur les tests existants

- **Decision**: revoir les jeux d'essai de `tests/unit/good-deals.test.ts` : leurs jets s'écartent du maximum et produisent maintenant des défauts.
- **Rationale**: une annonce écartée d'un jeu d'essai changerait le sens du test sans le dire.
