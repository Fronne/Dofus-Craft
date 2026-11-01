# Feature Specification: Calcul des bons plans selon la valeur de marché

**Feature Branch**: `079-calcul-bons-plans`

**Created**: 2026-11-02

**Status**: Draft

**Input**: Refonte du calcul de la page Bons plans (suite de `specs/078-bons-plans-hdv`) à partir des règles de marché données par le propriétaire du site : palier d'exo à 30 de poids, importance des stats, écart au maximum de l'objet.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ne plus voir de faux bons plans sur les exos (Priority: P1)

Un joueur consulte la page Bons plans. Un objet avec un exo modeste (1 % Dommages aux sorts) n'y apparaît plus comme une affaire à −84 % parce qu'il a été comparé à des exemplaires avec un exo bien plus rare (2 %).

**Why this priority**: c'est l'erreur la plus visible du calcul actuel. Sur les annonces réelles, un Capchalot exo 1 % vaut 3,33 M en médiane et un exo 2 % vaut 26 M.

**Independent Test**: comparer des exemplaires d'un même objet avec le même exo à 15 et à 30 de poids : ils ne sont plus comparables entre eux.

**Acceptance Scenarios**:

1. **Given** un objet avec des exemplaires exo 1 % Dommages aux sorts et d'autres exo 2 %, **When** un exemplaire 1 % est jugé, **Then** seuls les exemplaires 1 % servent à sa référence.
2. **Given** deux exemplaires exo +2 Critique et +3 Critique, **When** ils sont jugés, **Then** ils ne sont pas comparables : 20 de poids est sous le palier, 30 est au palier.
3. **Given** deux exemplaires exo 2 % et 3 % Dommages aux sorts, **When** ils sont jugés, **Then** ils restent comparables : tous deux sont au palier ou au-dessus.

---

### User Story 2 - Ne comparer que des jets de même niveau (Priority: P2)

Un exemplaire presque parfait n'est plus comparé à un exemplaire qui a décroché sur une stat qui compte, comme 20 de Force de moins que le maximum. Le joueur peut se fier à la référence affichée.

**Why this priority**: un jet décroché vaut nettement moins, et la moyenne pondérée des stats ne suffit pas à le voir.

**Independent Test**: juger un exemplaire sans défaut parmi des exemplaires qui ont tous un défaut : il n'est pas jugé, faute de comparables.

**Acceptance Scenarios**:

1. **Given** un exemplaire à 5 de Force sous le maximum, **When** ses défauts sont calculés, **Then** il n'a pas de défaut de Force.
2. **Given** un exemplaire à 6 de Force sous le maximum, **When** ses défauts sont calculés, **Then** il a un défaut de Force.
3. **Given** deux exemplaires, l'un avec un défaut de Vitalité et l'autre avec un défaut de Force, **When** ils sont jugés, **Then** ils ne sont pas comparables.
4. **Given** un exemplaire au-dessus du maximum de l'objet, **When** ses défauts sont calculés, **Then** cette ligne n'est pas un défaut.

---

### User Story 3 - Noter un jet selon ce que paient les joueurs (Priority: P3)

Un excellent objet sans Sagesse reste noté comme excellent, et un objet médiocre avec beaucoup de Sagesse n'est plus surévalué.

**Why this priority**: les poids actuels mesurent le rendement en runes, pas la valeur aux yeux des joueurs. L'effet mesuré sur le nombre de bons plans est faible, mais la règle est plus juste.

**Independent Test**: deux jets identiques sauf sur la Sagesse ont des qualités proches, alors que deux jets identiques sauf sur la Force restent éloignés.

**Acceptance Scenarios**:

1. **Given** deux jets qui ne diffèrent que par 40 de Sagesse, **When** leur qualité est calculée, **Then** la différence vaut un quart de ce que compte la Sagesse dans le brisage.
2. **Given** un jet avec des Dommages Renvoyés, **When** sa qualité est calculée, **Then** cette ligne ne compte pas.
3. **Given** la page Brisage, **When** elle calcule un rendement, **Then** ses résultats sont identiques à avant.

---

### Edge Cases

- Une ligne prévue par l'objet et absente de l'annonce vaut 0 pour le calcul des défauts.
- Une stat à valeur fixe sur l'objet (PA 1-1) : une annonce sans cette ligne a un défaut.
- Une stat d'importance nulle en exo : sa ligne ne compte pas dans la qualité, mais l'exo compte dans la comparaison, avec son palier calculé sur le poids du brisage.
- Un exo de poids exactement 30 est au palier. Un maximum de Dommages Critiques exactement égal à 20 accepte 1 d'écart.
- Une stat sans poids connu reste ignorée, comme aujourd'hui, et ne provoque ni exo ni défaut.
- Une annonce dont la qualité tombe à 0 ou moins n'est pas jugée.

## Requirements *(mandatory)*

### Functional Requirements

**Palier d'exo**

- **FR-001**: Le poids d'un exo DOIT valoir sa valeur multipliée par le poids de la stat dans le brisage, sans coefficient d'importance.
- **FR-002**: Un exo DOIT être classé « au palier » quand son poids est supérieur ou égal à 30, sinon « sous le palier », pour toutes les stats.
- **FR-003**: Deux annonces ne DOIVENT être comparables que si elles ont les mêmes stats en exo, chacune du même côté du palier.

**Importance des stats**

- **FR-004**: La qualité d'un jet DOIT multiplier le poids de chaque ligne par le coefficient d'importance de sa stat, en plus du facteur exo existant :

  | Importance | Coefficient | Stats |
  |---|---|---|
  | Primordiale | 1,5 | PA, PM, Portée, Invocations, Critique |
  | Très importante | 1 | Force, Intelligence, Chance, Agilité, Puissance, Vitalité, Dommages, Dommages Terre, Feu, Eau, Air et Neutre, Dommages Critiques, Dommages mêlée, distance, d'armes et aux sorts, Résistances en % (élémentaires, mêlée, distance) |
  | Moyenne | 0,5 | Fuite, Tacle, Esquive PA, Esquive PM, Retrait PA, Retrait PM, Dommages Poussée |
  | Faible | 0,25 | Sagesse, Prospection, Pods, Initiative, Soins, Résistances fixes élémentaires, Résistances Critiques, Résistances Poussée |
  | Aucune | 0 | Dommages Renvoyés, Dommages Pièges, Puissance Pièges, Arme de chasse |

- **FR-005**: Une stat connue absente de ce tableau DOIT garder le coefficient 1.
- **FR-006**: Les coefficients DOIVENT être regroupés à un seul endroit, pour pouvoir les ajuster sans toucher à la règle.
- **FR-007**: Les poids et les résultats de la page Brisage NE DOIVENT PAS changer.

**Écart au maximum**

- **FR-008**: Une ligne prévue par l'objet DOIT être un défaut quand sa valeur est strictement inférieure à `maximum de l'objet − écart accepté`.
- **FR-009**: Les écarts acceptés DOIVENT être :

  | Stat | Écart accepté |
  |---|---|
  | Force, Intelligence, Chance, Agilité, Puissance, Dommages Neutre | 5 |
  | Dommages, Dommages Terre, Feu, Eau et Air, Dommages mêlée, distance, d'armes et aux sorts, Résistances en % | 1 |
  | Dommages Critiques | 2 si le maximum de l'objet dépasse 20, sinon 1 |
  | Critique, PA, PM, Portée, Invocations | 0 |
  | Vitalité | 7,5 % du maximum de l'objet, au moins 12 |

- **FR-010**: Les autres stats, dont Dommages Poussée, NE DOIVENT JAMAIS produire de défaut.
- **FR-011**: Deux annonces ne DOIVENT être comparables que si elles ont exactement les mêmes défauts.

**Ce qui ne change pas**

- **FR-012**: Le reste de la règle de 078 DOIT rester identique : qualité à ±25 %, au moins 3 comparables, référence égale à la médiane des prix ramenés au jet, seuil réglable (25 % par défaut), annonces vues depuis moins de 24 h.
- **FR-013**: Le service de lecture des annonces NE DOIT PAS changer : le jugement reste fait par le site.
- **FR-014**: Les jets théoriques, les filtres, le tri et l'affichage de la page DOIVENT rester identiques.

### Key Entities

- **Palier d'exo** : côté du seuil de 30 de poids où se trouve un exo.
- **Importance d'une stat** : coefficient qui dit ce que la stat compte pour les joueurs, distinct de son poids dans le brisage.
- **Écart accepté** : marge sous le maximum de l'objet sans perte nette de valeur.
- **Défaut** : ligne qui dépasse son écart accepté. L'ensemble des défauts d'une annonce fait partie de ce qui la rend comparable.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Aucun bon plan n'a de référence calculée avec un exemplaire dont un exo est de l'autre côté du palier.
- **SC-002**: Sur l'instantané de 2935 annonces de Mikhal, les six Capchalot exo 1 % affichés entre −78 % et −84 % ne sont plus des bons plans.
- **SC-003**: Sur ce même instantané, le calcul juge environ 1474 annonces et donne environ 109 bons plans, contre 2320 et 173 aujourd'hui. Les 54 nouveaux bons plans et les 118 retirés restent à examiner par le propriétaire sur un échantillon.
- **SC-004**: Les résultats de la page Brisage sont identiques avant et après.

## Assumptions

- Les coefficients d'importance sont un point de départ proposé, à ajuster sur des exemples réels. Les écarts acceptés et le palier viennent du propriétaire du site.
- La formule de la Vitalité reprend ses repères : 30 d'écart sur 400, 10 à 15 sur 100.
- Les prix restent des prix demandés à l'HDV, pas des prix vendus.
- Une stat dont l'importance dépend de l'objet (Sagesse, Prospection dans des cas exceptionnels) reste mal estimée : le site ne sait pas pour quoi un objet est joué. Limite acceptée.
- Moins d'annonces sont jugées, environ 40 % de moins sur l'instantané. Limite acceptée : un faux bon plan coûte plus cher qu'un exemplaire non jugé.
- Les effets sans poids restent ignorés. Neuf des dix plus fréquents sont des malus (−PA, −Portée, −Fuite…). `2825` (739 lignes) signifie « Empêche les futures forgemagies » : son effet sur le prix n'est pas traité par cette spec.
