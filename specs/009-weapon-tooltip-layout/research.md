# Phase 0 Research: Fiche d'arme façon tooltip du jeu

## 1. Détection d'une arme

**Decision**: Une arme est un objet d'équipement dont le super-type DofusDB (`item.type.superType.id`)
vaut `2` ("Arme"). Cette valeur est déjà utilisée par `CRAFTCHECK_EQUIPMENT_SUPER_TYPE_IDS` dans
`src/services/dofusdb-mappers.ts` — le super-type "Arme" y est déjà traité comme un type
d'équipement, il suffit de le distinguer des autres pour ce nouvel affichage.

**Rationale**: C'est la même donnée que celle déjà utilisée pour classer l'objet en équipement
(`isEquipment`/`getDofusDbItemKind`), donc aucune nouvelle requête réseau n'est nécessaire ; on
évite une détection ad hoc basée sur le nom de catégorie affiché (fragile aux traductions).

**Alternatives considered**: Détecter une arme via la présence des champs `apCost`/`range` sur
l'objet. Rejeté : ces champs peuvent être absents de la réponse DofusDB pour un objet qui n'est
pas une arme (valeur `undefined`) mais rien ne garantit qu'ils ne soient jamais présents ailleurs ;
le super-type est la donnée canonique déjà utilisée pour classer les objets dans ce projet.

## 2. Origine des informations de combat de l'arme

**Decision**: `GET /items/{id}` (déjà appelé par `getDofusDbItem`) renvoie directement, pour les
armes, les champs `apCost`, `range`, `minRange`, `criticalHitProbability`, `criticalHitBonus` et
`maxCastPerTurn`. Vérifié sur un exemple réel ("Masse Étacée", id 30949) :

```text
apCost: 5
range: 1
minRange: 1
criticalHitProbability: 15
criticalHitBonus: 9
maxCastPerTurn: 1
```

**Rationale**: Aucune requête supplémentaire n'est nécessaire ; `getItemDetail` charge déjà
l'objet complet via `getDofusDbItem`. Il suffit d'étendre le type `DofusDbItem` (actuellement
limité à `id`, `level`, `name`, `img`, `type`, `hasRecipe`, `itemSetId`, `effects`) avec ces
champs optionnels et de les faire transiter jusqu'à la vue.

**Alternatives considered**: Un appel dédié à un endpoint "armes". Rejeté : DofusDB n'expose pas
un tel endpoint séparé ; les données sont déjà dans la réponse `/items/{id}`.

## 3. Distinction "dommages/vol de l'arme" vs "bonus de caractéristique"

**Decision**: Chaque entrée de `item.effects` porte déjà un champ `category` (vérifié sur
plusieurs objets : `category: 2` pour les dommages et le vol, `category: 1` pour les résistances,
`category: 0` pour les bonus de caractéristiques classiques). Un effet appartient à la section
"Effets de l'arme" quand `category === 2`, et à la section "Effets" sinon.

**Rationale**: Cette donnée est déjà récupérée par `mapItemStats` (`src/data/catalogue-repository.ts`)
via `item.effects`, sans appel réseau supplémentaire. Elle est plus fiable qu'un filtrage par
identifiant d'effet (`effectId`), qui obligerait à maintenir une liste exhaustive des ids de
dommages/vol.

**Alternatives considered**: Filtrer par plage d'`effectId` connue pour les dommages/vol (ex.
80-101). Rejeté : liste fragile et non exhaustive (cf. la correction précédente sur les icônes,
où nous avons déjà dû découvrir des identifiants au cas par cas) ; le champ `category` déjà présent
dans la donnée source est une distinction officielle plus robuste.

## 4. Libellé de la zone d'effet

**Decision (scope réduit pour cette itération)**: La zone d'effet est décrite dans
`item.possibleEffects[].zoneDescr` (`shape`, `param1` = taille, `param2`) mais DofusDB n'expose
aucune table publique faisant correspondre un identifiant `shape` à un nom ("croix", "cercle",
"ligne", ...). Cet identifiant est un enroulement interne du client de jeu (valeur observée :
`67` pour une croix de taille 1 sur "Masse Étacée"), pas un petit enum documenté.

Pour cette itération, seules les formes explicitement vérifiées contre le tooltip du jeu sont
traduites en texte (à ce stade : `shape 67` → "croix"). Une forme non reconnue fait que la ligne
"Zone" est simplement omise du bloc d'informations, conformément à l'exigence de ne jamais
fabriquer une donnée (Constitution, Principe I ; FR-008 du spec). Compléter la table à partir des
fichiers du client Dofus local (déjà la source utilisée pour les icônes de caractéristiques dans
`src/domain/characteristic-icons.ts`) est noté comme amélioration future plutôt que bloquant pour
cette fonctionnalité.

**Rationale**: Respecte la contrainte constitutionnelle de ne jamais afficher une valeur inventée.
Le bloc d'informations reste utile (PA, portée, critique) même quand la zone n'est pas encore
mappée pour une arme donnée.

**Alternatives considered**: Deviner un nom générique ("zone spéciale") pour toute forme non
reconnue. Rejeté : induirait le joueur en erreur en laissant croire à une information vérifiée.

## 5. Portée fixe vs portée variable

**Decision**: Comparer `minRange` et `range` : si égaux, afficher une valeur unique ("Portée : 1") ;
sinon, afficher un intervalle ("Portée : 1 à 2"), à l'image du gabarit déjà utilisé par
`getDisplayedEffectValues`/`formatEffectDescription` pour les effets à valeur fixe ou variable.

**Rationale**: Réutilise un principe déjà appliqué ailleurs dans le code (`getDisplayedEffectValues`)
pour l'affichage min/max, garantissant une cohérence visuelle avec le reste de la fiche.
