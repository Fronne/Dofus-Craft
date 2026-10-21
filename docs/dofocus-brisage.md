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

Sources : <https://dofocus.fr/guide/>, <https://dofocus.fr/faq/>.
