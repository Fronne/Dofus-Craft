# Modèle de données : Exos

## BrisageLine (domaine, étendu)

| Champ | Type | Règle |
|---|---|---|
| `effectId` | nombre | id DofusDB de la stat |
| `value` | nombre | jet utilisé dans le calcul |
| `exo` | booléen optionnel | vrai pour une ligne exo ; absent = ligne d'origine |

Règles :
- Une ligne exo n'engendre jamais d'option de focus (ni dans `analyzeBrisage`, ni dans `analyzeFocusAdvice`).
- Une ligne exo contribue comme une ligne d'origine : au coefficient en normal, à `focusOtherShare` quand un focus porte sur une autre ligne.
- La fusion des lignes de même stat (`usableLines`) conserve le drapeau `exo` ; en pratique un exo n'a jamais la stat d'une ligne d'origine (filtré par l'interface).

## Plafond de poids

| Élément | Définition |
|---|---|
| `MAX_LINE_WEIGHT` | 101 |
| `maxValueForWeight(weight)` | `floor(101 / weight + 1e-9)`, 0 si `weight` ≤ 0 |
| `lineValueLimit(effectId, settings, naturalMax?)` | `max(maxValueForWeight(poids), naturalMax ?? 0)` pour une ligne d'origine (over) ; `maxValueForWeight(poids)` pour un exo |
| `isRollAllowed(...)` | vrai si entier ≥ 1 (exo) ou nombre ≥ 0 (over) et ≤ limite |

## ExoLine (persistance)

| Champ | Type | Règle |
|---|---|---|
| `effectId` | entier | stat connue du brisage, avec rune |
| `value` | entier ≥ 1 | ≤ plafond de la stat |

Stockage : `craftcheck-brisage-exos` = `{ "<serverId>:<itemId>": ExoLine[] }`.
Lecture : tout champ de mauvais type ou hors plafond est écarté ; clé absente ou JSON invalide = aucun exo.

Transitions : ajout (stat libre, valeur valide) ; retrait ; changement d'objet (les exos de l'autre objet sont lus) ; changement de serveur (clé différente).
