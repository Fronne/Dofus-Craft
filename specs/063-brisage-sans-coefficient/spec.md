> **Révision** : le focus dépend du coefficient (voir `docs/dofocus-brisage.md`, « Modèle de focus corrigé »). Le « coefficient de bascule » décrit plus bas est remplacé par un conseil focus / sans focus indépendant du coefficient, plus le coefficient de rentabilité quand le prix de l'objet est connu.

# Spécification : Brisage sans coefficient connu (focus conseillé)

**Branche**: `063-brisage-sans-coefficient`

**Créée le**: 2026-10-20

**Statut**: Brouillon

**Entrée**: « Sur la page Brisage, même si on n'a pas d'infos sur le coefficient de brisage, afficher le tableau de base et indiquer sur quelle ligne le focus serait le plus intéressant, ou s'il vaut mieux ne pas faire de focus et briser normalement. »

Cette spec prolonge `specs/061-simplification-page-brisage` (le coefficient est relevé en jeu et mémorisé par objet) et `specs/062-prix-objet-brisage` (prix de l'objet HDV ou craft). Aujourd'hui, tant que le coefficient est inconnu, la page n'affiche que « Indiquez le coefficient de l'objet pour voir le résultat » et aucun tableau.

## Principe de calcul (estimation)

Dans le modèle de la page Brisage (`specs/060-page-brisage`), le brisage normal rend une part des runes proportionnelle au coefficient, alors que le focus rend une quantité qui ne dépend pas du coefficient. Les deux options se comparent donc par un **coefficient de bascule** : en dessous, le meilleur focus rapporte plus que le brisage normal ; au-dessus, le brisage normal rapporte plus. Le prix de l'objet s'annule dans cette comparaison : il n'est pas nécessaire pour savoir s'il faut focus.

## Scénarios utilisateur et tests *(obligatoire)*

### User Story 1 - Voir le tableau et la ligne à focus sans connaître le coefficient (Priorité : P1)

Le joueur ouvre un objet qu'il n'a jamais brisé (aucun coefficient mémorisé, rien de saisi). La page affiche malgré tout le tableau des lignes : rune, jet, prix unitaire de la rune, runes obtenues en focus sur chaque ligne et gain correspondant. La ligne où le focus rapporte le plus est mise en évidence (« Meilleur focus »).

**Pourquoi cette priorité** : c'est le cœur de la demande ; le joueur peut préparer son brisage avant même d'avoir un premier relevé de coefficient.

**Test indépendant** : ouvrir un objet sans coefficient mémorisé, dont les runes ont un prix, et vérifier que le tableau apparaît avec une ligne « Meilleur focus ».

**Scénarios d'acceptation** :

1. **Étant donné** un objet sans coefficient connu et dont les runes ont un prix, **quand** le joueur l'ouvre, **alors** le tableau des lignes s'affiche et la ligne au meilleur focus est mise en évidence.
2. **Étant donné** ce même état, **quand** le joueur modifie un jet, **alors** les runes, les gains et la ligne conseillée se recalculent.
3. **Étant donné** que le joueur saisit ensuite un coefficient, **quand** il le valide, **alors** la page repasse à l'affichage complet actuel (verdict, colonne « Sans focus », gains selon le coefficient).

---

### User Story 2 - Savoir s'il vaut mieux focus ou briser normalement (Priorité : P1)

Sans coefficient, la page donne le coefficient de bascule du meilleur focus : « Focus {rune} tant que le coefficient est inférieur à X % ; au-dessus, brisez sans focus. » Le joueur peut ainsi trancher dès qu'il lit le coefficient en jeu.

**Pourquoi cette priorité** : sans ce seuil, le joueur sait quelle ligne focus mais pas si le focus vaut mieux que briser normalement.

**Test indépendant** : avec des prix de runes connus, vérifier que le seuil affiché est cohérent avec les gains calculés une fois un coefficient saisi juste au-dessus et juste au-dessous du seuil.

**Scénarios d'acceptation** :

1. **Étant donné** un objet sans coefficient, **quand** le tableau s'affiche, **alors** un bloc « Conseil » indique la ligne à focus et le coefficient de bascule en %.
2. **Étant donné** un coefficient saisi juste en dessous du seuil, **quand** le résultat complet s'affiche, **alors** le verdict recommande le focus ; juste au-dessus, il recommande de briser sans focus.
3. **Étant donné** un coefficient de bascule supérieur à 100 % (focus quasi toujours meilleur pour cet objet), **quand** le conseil s'affiche, **alors** il reste lisible et dit que le focus est conseillé sur les coefficients courants.

---

### User Story 3 - Colonne « Sans focus » honnête sans coefficient (Priorité : P2)

Tant que le coefficient est inconnu, la colonne « Sans focus » ne présente pas de valeur inventée : elle affiche la valeur de référence à 100 % clairement étiquetée, ou est masquée.

**Pourquoi cette priorité** : la constitution interdit de présenter une valeur devinée comme réelle.

**Test indépendant** : ouvrir un objet sans coefficient et vérifier que toute valeur « Sans focus » est étiquetée « à 100 % » ou absente.

**Scénarios d'acceptation** :

1. **Étant donné** un coefficient inconnu, **quand** le tableau s'affiche, **alors** la colonne « Sans focus » est étiquetée « à 100 % (référence) » et aucun verdict « Rentable / Pas rentable » n'est présenté comme définitif.
2. **Étant donné** un coefficient connu, **quand** le tableau s'affiche, **alors** la colonne reste telle qu'aujourd'hui.

---

### Cas limites

- Aucune rune de l'objet n'a de prix : le tableau s'affiche avec « prix manquant », aucun conseil de focus n'est donné, et la page nomme les runes dont le prix manque (comportement actuel).
- Le prix de l'objet est inconnu : le conseil focus / sans focus reste affiché (le prix s'annule), les gains en kamas sont remplacés par la valeur des runes et la page invite à saisir le prix.
- Une seule ligne exploitable : le « meilleur focus » est cette ligne ; le conseil compare toujours avec le brisage normal.
- Le brisage normal à 100 % vaut 0 (aucun prix de rune) : pas de coefficient de bascule affiché.
- Égalité entre deux lignes : la première dans l'ordre du tableau est mise en évidence.
- Coefficient saisi puis effacé : la page revient à l'affichage sans coefficient.

## Exigences *(obligatoire)*

### Exigences fonctionnelles

- **FR-001** : Quand le coefficient est inconnu, la page MUST afficher le tableau des lignes (rune, jet, prix unitaire, runes et gain en focus) au lieu du seul message d'invitation.
- **FR-002** : Dans ce cas, la page MUST mettre en évidence la ligne où le focus a la plus grande valeur en runes.
- **FR-003** : La page MUST afficher le coefficient de bascule entre le meilleur focus et le brisage normal, calculé comme la valeur du meilleur focus divisée par la valeur du brisage normal à 100 %, en %.
- **FR-004** : La page MUST formuler le conseil : focus sur la ligne indiquée quand le coefficient est sous le seuil, brisage sans focus au-dessus.
- **FR-005** : La colonne « Sans focus » MUST afficher, sans coefficient, la valeur de référence à 100 % clairement étiquetée comme telle ; aucune valeur ne MUST être présentée comme issue d'un coefficient inconnu.
- **FR-006** : Sans coefficient, la page MUST NOT présenter de verdict « Rentable » ou « Pas rentable » définitif ni de cartes « gain selon le coefficient ».
- **FR-007** : Dès qu'un coefficient est connu (mémorisé ou saisi), la page MUST retrouver l'affichage actuel, sans changement.
- **FR-008** : Le conseil focus / sans focus MUST rester affiché quand le prix de l'objet est inconnu ; les gains en kamas MUST alors être remplacés par la valeur des runes.
- **FR-009** : Si le prix d'une rune manque, la page MUST le dire, MUST NOT inventer de prix et MUST NOT donner de conseil qui en dépende.
- **FR-010** : Le calcul du meilleur focus et du coefficient de bascule MUST être couvert par des tests automatisés (cas de base, prix manquant, égalité, une seule ligne, cohérence avec le résultat complet autour du seuil).

### Entités clés

- **Coefficient de bascule** : coefficient en dessous duquel le meilleur focus rapporte plus que le brisage normal ; dérivé des prix des runes et des jets, indépendant du prix de l'objet.
- **Meilleur focus** : la ligne dont le focus produit la plus grande valeur de runes.
- **Valeur de référence à 100 %** : valeur du brisage normal pour un coefficient de 100 %, servant de base de comparaison.

## Critères de réussite *(obligatoire)*

### Résultats mesurables

- **SC-001** : Pour un objet sans coefficient dont les runes ont un prix, le joueur voit le tableau et la ligne à focus dès l'ouverture, sans aucune saisie.
- **SC-002** : Pour tout jeu de prix, le coefficient de bascule affiché correspond à celui où le résultat complet (avec coefficient) change de recommandation, à l'arrondi près.
- **SC-003** : Dans 100 % des cas sans coefficient, aucune valeur « Sans focus » n'est affichée sans mention « à 100 % ».
- **SC-004** : Avec un coefficient connu, l'affichage est strictement identique à celui d'avant la fonctionnalité.

## Hypothèses

- **Révisé par `docs/dofocus-brisage.md` (« Modèle de focus corrigé »)** : le focus dépend lui aussi du coefficient (observé en jeu). Il n'y a donc plus de coefficient de bascule : le meilleur choix focus / sans focus ne dépend que des prix des runes, et le conseil ajoute, quand le prix de l'objet est connu, le coefficient sous lequel briser ne couvre plus l'objet.
- La valeur de référence « à 100 % » est le brisage normal calculé comme si le coefficient valait 100 %.
- Le meilleur focus se détermine sur la valeur en kamas des runes obtenues ; il ne dépend que des prix des runes et des jets.
- Le seuil est affiché arrondi à l'unité ou à une décimale, comme les autres coefficients de la page.
- La saisie et la mémorisation du coefficient ne changent pas.
- Les pages Recherche, Épingles et Prix ne changent pas.
