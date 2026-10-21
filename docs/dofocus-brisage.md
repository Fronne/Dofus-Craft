# Brisage sur DoFocus : compte rendu

Le site s'appelle **DoFocus** (dofocus.fr), pas « Ofocus ». Analyse en lecture seule : aucun fichier du projet modifié, aucun compte créé.

**Limites de l'analyse**
- Le détail d'un objet (jets, runes, focus) est derrière une connexion Google ou Discord. L'UI de brisage elle-même n'a pas été vue.
- Sources : bundle JS public (`/assets/index-Cu835TUz.js`) et pages publiques (guide, FAQ, liste HDV).
- L'API `/api/*` renvoie « Accès refusé » avec un avis interdisant la collecte automatisée sans accord. Elle a été abandonnée, rien n'a été moissonné.
- La liste HDV publique a une colonne « Brisage » vide (« — ») pour les non-connectés.

## Formules (confirmées, lues en clair dans le bundle)

Notations : `jet` = valeur de la stat, `niveau` = niveau de l'objet, `poids` et `valeur` = constantes de la rune.

```
Ml(jet, poids, niveau, valeur) =
    jet < 0 ? 3*jet / (200*valeur) + 1
            : 3*jet*poids*niveau / (200*valeur) + 1

Sans focus : runes(stat) = Ml(jet) × coef/100 / poids      (arrondi à 2 décimales)
```

**Focus sur une stat F**
- `total = Ml(F) + 0,5 × Σ Ml(autres stats qui ont une rune) + 0,5 × Σ Ml(exos)`
- `runes(F) = total × coef/100 / poids(F)`. Les autres stats ne produisent rien.
- Seules les stats à jet positif sont éligibles (pas les négatives, ni la stat « chasse » d'id 696969).

**Jets**
- Jet par défaut : `round((min+max)/2)`, avec presets min / moyen / max.
- Si `to < from` (cas positif), `to` est ramené à `from`.

**Runes**
- Seule la rune **basique** est utilisée. Les runes Pa et Ra sont exclues par regex (`/^Rune (Pa|Ra) /`).
- Par caractéristique, DoFocus prend la rune de plus petite `valeur`.
- Brisage « mélangé » (plusieurs objets) : seules les stats communes à tous les objets peuvent servir de focus.

**Kamas et gains**
- `kamas = runes × prix unitaire`, arrondi au kama.
- La valeur totale est calculée en BigInt avec des centimes (pas de flottants).
- Gain = valeur des runes − coût de l'objet.
- Le coût est en mode « auto » : le moins cher entre l'achat et le craft.
- Chaque ligne affiche les deux variantes (avec et sans focus), et le meilleur focus est choisi automatiquement par valeur kamas.
- Les exos s'ajoutent comme lignes séparées : jet par défaut 1, comptés à 50 % dans le focus.

**Coefficient**
- Plage 1 à 4000 %, 2 décimales maximum, effet linéaire.
- Il est **saisi par les joueurs** (avant et après chaque session) et partagé par serveur et par objet.
- Historique sur 60 jours, avec des points de contribution et un journal personnel de brisages.
- Aucune formule de décroissance dans le code. Un prix manquant n'est jamais traité comme 0.

**Poids des runes** (guide public, Basique / Pa / Ra)
- Vi, Fo, Ine, Cha, Age, Ini : 1 / 3 / 10.
- Sa : 3 / 9 / 30. Pui : 2 / 6 / 20. Pod : 2,5 / 7,5 / 25.
- Prospe : 3 / 9. Tac et Fui : 4 / 12. Do Pi : 5 / 15. Do Ren : 10 / 30.
- Do : 20. So et Cri : 10. Invo : 30. Po : 51. Ga Pme : 90. Ga Pa : 100.
- Ré Per : 6 (et Ré Pa, Ré Pme, Ret Pa, Ret Pme : 7 / 21).
- Pa = 3 × Basique et Ra = 10 × Basique, par fusion au Concasseur.
- Table affichée sur le site, non extraite du code. Les valeurs de rune utilisées par la formule viennent de l'API (non lue). Le guide cite seulement Vi = 1 et Ini = 10.

## Déduit ou incertain
- Le guide parle d'un « malus de génération de 50 % » en focus. Dans le code, ce malus apparaît seulement comme le facteur 0,5 sur les autres stats. Aucun autre malus n'est visible côté client.
- La formule est dite « identique à celle du jeu », mais aucun arrondi entier n'est appliqué : ce sont des espérances décimales.
- Dans `Ml`, la division par `valeur` n'est pas expliquée.
- Les paliers Pa/Ra ne sont pas calculés. Le site compte tout en runes basiques.
- Le gain est calculé avant frais d'HDV. La colonne « Revente » est présentée « avant frais ».

## Comparaison avec `src/features/brisage/` et `src/domain/brisage.ts`

**Identique**
- Base `0,015 × niveau × poids × jet + 1` (c'est le même 3/200).
- Focus à 100 % sur la cible et 50 % sur les autres.
- Coefficient jusqu'à 4000, jet moyen par défaut, avec ou sans focus, prix de runes par serveur.
- Pa/Ra à ×3 et ×10 dans les réglages.

**Différences**
- Nous arrondissons à des runes entières (`wholeRunes`, `Math.round`). DoFocus garde 2 décimales. Nos arrondis collent mieux au jeu mais biaisent une estimation de gain sur de petits nombres.
- Nous avons une formule de baisse du coefficient (`nextCoefficient`, empirique « Dorel »), la descente du coefficient sur les brisages successifs, et un coefficient de bascule du focus. DoFocus n'a rien de tout cela et mise sur des relevés communautaires.
- La division par `valeur` de rune de DoFocus n'a pas d'équivalent explicite chez nous. Vérifier l'équivalence sur Ini et Pod (`valeur` 10) avant de s'aligner.

## À envisager chez nous
1. Un mode « espérance » (2 décimales) à côté de l'arrondi entier.
2. Un coût d'objet « auto » (min achat/craft) et l'affichage des deux variantes focus / sans focus pour chaque stat.
3. Les exos comme lignes séparées, à 50 % dans le focus.
4. La liste des stats éligibles : exclure les jets négatifs et la stat chasse (696969).
5. Un historique des coefficients et un journal personnel de brisages. Le partage communautaire demanderait un backend, hors périmètre.
6. Vérifier nos poids `confirmed: false` (Force, Chance, PA, etc.) avec la table du guide.

## Exos et over dans Dofus Craft (specs/066-exo-brisage)

- **Exo** : ligne de stat que l'objet n'a pas de base. Ligne séparée, même formule de poids que les autres lignes. Sans focus, ses runes comptent au coefficient de l'objet ; en focus sur une autre ligne, il compte à `focusOtherShare` (50 %). Règle reprise de DoFocus : **estimation**, aucune source officielle.
- **Pas de focus sur un exo** : aucune option de focus n'est construite pour une ligne exo.
- **Plafond** : un exo pèse au plus 101 (valeur × poids de la stat, soit `floor(101 / poids)` : 101 pour un poids de 1, 1 pour PA).
- **Over** : une stat déjà présente sur l'objet ne s'ajoute pas en exo ; on tape un jet au-dessus du maximum de la ligne. Même plafond de 101, mais le maximum naturel de la ligne n'est jamais refusé.
- **Affichage** : les exos sont en tête du tableau, en bleu (`--exo`), le dernier ajouté en premier. Conservés par serveur et par objet (`craftcheck-brisage-exos`).

## Lignes négatives dans Dofus Craft (specs/067-brisage-lignes-negatives)

- **Règle retenue (Kama Master, kamamaster.fr)** : le poids d'une ligne négative suit la formule des lignes positives appliquée au jet négatif, `0,015 × niveau × poids de la stat × jet + 1`, ramené à 0 s'il est négatif. Le code de Kama Master calcule `3 × poids × jet × niveau / 200 + 1` pour tout jet et borne le résultat à 0.
- **Effets** : une ligne négative ne donne aucune rune, n'est jamais cible d'un focus et compte à `focusOtherShare` (50 %) dans le poids reporté sur la rune ciblée. Un objet qui n'a que des lignes négatives n'a aucune ligne exploitable.
- **Exemples** : niveau 200, Force −10 : `0,015×200×1×(−10)+1 = −29`, donc 0, aucun effet. Niveau 20, Force −1 : `0,7`, soit +0,35 au poids d'un focus ailleurs.
- **Écartée, DoFocus** : `3 × jet / (200 × valeur) + 1` pour un jet négatif (sans niveau ni poids de stat). La constante `valeur` vient d'une API non lisible, et la formule donne un poids positif à un malus.
- **Écartée, forgemagie** : en forgemagie, le poids d'un malus est divisé par 2. Kama Master ne reprend pas cette règle au brisage, et nous non plus.
- **Malus retourné par forgemagie** : le jet d'un malus accepte un entier positif (de 1 au plafond de poids de 101, comme un exo). La ligne est alors comptée comme un exo : runes au coefficient de l'objet, 50 % dans un focus, jamais cible de focus. Le prix de la rune s'affiche sur tous les malus, même négatifs, pour être connu au moment de la bascule.
- **Estimation, à confirmer par un relevé en jeu** : un focus sur un objet avec un malus, à coefficient connu, comparé au nombre de runes prévu. La règle est isolée dans `negativeLineWeight` (`src/domain/brisage.ts`).
- **Identifiants DofusDB** : un malus a son propre identifiant d'effet (« −Force » est 157, « −PA » 168, « −Initiative » 175…), avec une valeur négative. Le tableau `NEGATIVE_EFFECT_STAT` de `src/domain/brisage.ts` donne pour chacun la stat qu'il retire (157 → 118). Il couvre les 48 malus relevés sur les ~24 000 objets de DofusDB (octobre 2026) ; un malus absent de la table est ignoré et compté avec les lignes sans rune connue.
- **Affichage** : les malus sont en rouge après les lignes positives, avec le badge « Malus », sans prix ni rune. Leur jet reste modifiable dans l'étendue de la ligne. Les données viennent de `negativeRangesOf` (`src/data/catalogue-repository.ts`), à part de `effectRangesOf` que l'index de recherche utilise.

## Modèle de focus corrigé

- **Avant** : le focus ne dépendait pas du coefficient, et les autres lignes gardaient 50 % de leurs runes.
- **Maintenant (modèle DoFocus)** : `runes(F) = (poids(F) + 50 % × Σ poids des autres lignes, exos compris) × coef/100 / poids de la rune`. Les autres lignes ne donnent aucune rune. Raison : l'utilisateur a observé en jeu qu'un focus rend moins de runes quand le coefficient baisse.
- **Conséquence** : le sans-focus et le focus sont tous deux proportionnels au coefficient. Le meilleur des deux ne dépend donc plus du coefficient (il se décide aux prix des runes), et il n'y a plus de « coefficient de bascule ». Le prix de l'objet fixe seulement le coefficient en dessous duquel briser ne couvre plus l'objet : `100 × prix de l'objet ÷ valeur des runes à 100 %`.
- **Relevé de référence** (Cape du Chef Bwork, focus Dommages, coef 50 %) : 6 runes Do observées, le modèle en donne 4,9 en espérance (l'ancien modèle donnait 6,05). Une seule mesure, tirage aléatoire : à reconfirmer par d'autres relevés.

Sources : <https://dofocus.fr/guide/>, <https://dofocus.fr/faq/>.
