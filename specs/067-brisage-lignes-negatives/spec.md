# Spécification : Lignes à jet négatif, page Brisage

**Branche**: `067-brisage-lignes-negatives`

**Créée le**: 2026-10-21

**Statut**: Brouillon

**Entrée**: « Page Brisage : seules les valeurs positives sont ajoutées dans les stats, mais certains objets ont aussi des lignes négatives (malus) et il faut les prendre en compte dans le calcul. Utiliser la logique de Kama Master. »

Cette spec prolonge `specs/060-page-brisage` (modèle de calcul), `specs/065-refonte-page-brisage` et `specs/066-exo-brisage`. Elle ne change aucune règle de calcul des lignes à jet positif.

## Principe

Un objet peut porter des **lignes négatives** (ex. −10 Force, −2 PO). Aujourd'hui la page les ignore complètement : elles n'apparaissent pas dans le tableau et ne pèsent pas dans le calcul du focus. Un joueur ne voit donc pas l'objet tel qu'il est en jeu.

Règle retenue, d'après le fonctionnement de Kama Master (kamamaster.fr) :
- **Poids de la ligne** : même formule que les lignes positives, appliquée au jet négatif, c'est-à-dire `0,015 × niveau × poids de la stat × jet + 1`. Le résultat est ramené à 0 s'il est négatif.
- **Brisage normal** : une ligne négative ne donne aucune rune.
- **Focus** : une ligne négative n'est jamais une cible. Elle compte à 50 % dans le poids reporté sur la rune ciblée, comme les autres lignes non ciblées. Comme son poids est souvent ramené à 0, elle n'apporte en général rien.

DoFocus utilise une autre formule pour les négatifs (`3 × jet / (200 × valeur) + 1`, sans niveau ni poids de stat) : elle n'est pas retenue. Comme le reste du modèle, cette règle est une **estimation**, pas une règle officielle.

## Scénarios utilisateur et tests *(obligatoire)*

### User Story 1 - Voir les lignes négatives de l'objet (Priorité : P1)

Quand le joueur choisit un objet qui a des lignes négatives, elles apparaissent dans le tableau avec les autres lignes, en rouge, avec leur jet négatif. Elles sont repérables d'un coup d'œil et ne proposent pas de focus.

**Pourquoi cette priorité** : sans les données et l'affichage, rien d'autre n'existe.

**Test indépendant** : choisir un objet qui a une ligne négative et vérifier qu'elle apparaît en rouge avec son jet.

**Scénarios d'acceptation** :

1. **Étant donné** un objet avec une ligne −10 Force, **quand** le joueur le choisit, **alors** une ligne Force à −10 apparaît, en rouge, distincte des lignes positives.
2. **Étant donné** une ligne négative, **quand** le tableau s'affiche, **alors** aucune action de focus n'est proposée sur cette ligne et aucune rune n'est attendue.
3. **Étant donné** un objet qui a la même stat en positif et en négatif, **quand** il s'affiche, **alors** les deux lignes restent distinctes (la ligne négative n'est pas fusionnée avec la positive).
4. **Étant donné** un objet sans ligne négative, **quand** il s'affiche, **alors** rien ne change par rapport à aujourd'hui.

---

### User Story 2 - La ligne négative est comptée dans le calcul (Priorité : P1)

Les runes obtenues, la valeur en kamas, le gain, le seuil de rentabilité, la descente d'objets et le conseil de focus tiennent compte des lignes négatives selon la règle ci-dessus.

**Pourquoi cette priorité** : c'est la raison d'être de la fonction.

**Test indépendant** : sur un objet de niveau 200 avec une ligne −10 Force (poids 1) : le poids vaut `0,015 × 200 × 1 × (−10) + 1 = −29`, ramené à 0. Le brisage normal ne change pas, et un focus sur une autre ligne ne gagne rien de cette ligne.

**Scénarios d'acceptation** :

1. **Étant donné** une ligne négative, **quand** le brisage est sans focus, **alors** elle ne donne aucune rune et le total des runes est celui des seules lignes positives.
2. **Étant donné** une ligne négative dont le poids calculé est positif (petit jet négatif sur un objet de bas niveau), **quand** un focus porte sur une autre ligne, **alors** ce poids compte à 50 % dans le total reporté sur la rune ciblée.
3. **Étant donné** une ligne négative dont le poids calculé est négatif, **quand** un focus porte sur une autre ligne, **alors** elle compte pour 0 (le total du focus n'est jamais réduit).
4. **Étant donné** un objet qui n'a que des lignes négatives, **quand** il est choisi, **alors** la page signale qu'il n'a aucune ligne exploitable, comme pour un objet sans ligne.
5. **Étant donné** le coefficient inconnu, **quand** le conseil de focus est calculé, **alors** il applique la même règle.

---

### User Story 3 - Saisir ou corriger un jet négatif (Priorité : P3)

Le joueur peut régler le jet d'une ligne négative dans l'étendue de l'objet (ex. entre −15 et −10), comme pour une ligne positive. Le jet par défaut est le milieu de l'étendue.

**Pourquoi cette priorité** : confort ; le résultat change peu, car la ligne pèse souvent 0.

**Test indépendant** : régler une ligne négative sur sa valeur minimale puis maximale et vérifier que le tableau suit.

**Scénarios d'acceptation** :

1. **Étant donné** une ligne négative avec une étendue −15 à −10, **quand** la page s'ouvre, **alors** le jet par défaut est le milieu de l'étendue, arrondi à l'entier inférieur (−13).
2. **Étant donné** une ligne négative, **quand** le joueur modifie le jet, **alors** il ne peut saisir qu'un nombre négatif dans l'étendue de l'objet.

---

### Cas limites

- Stat négative sans rune connue : ignorée comme une stat positive sans rune, et signalée de la même façon.
- Objet déjà mémorisé par la session de brisage (ancien format sans lignes négatives) : il se rouvre sans erreur, les lignes négatives sont ajoutées.
- Jet négatif très grand : le poids est ramené à 0, jamais de valeur négative dans les totaux.
- Étendue qui contient 0 (ex. −5 à +5) : hors périmètre, voir Hypothèses.

## Exigences *(obligatoire)*

### Exigences fonctionnelles

- **FR-001** : Le système DOIT conserver les lignes à jet négatif des objets et les proposer sur la page de brisage.
- **FR-002** : Le système DOIT afficher une ligne négative en rouge, avec son jet signé, et sans action de focus.
- **FR-003** : Le système DOIT calculer le poids d'une ligne négative avec la formule des lignes positives appliquée au jet négatif, puis le ramener à 0 s'il est négatif.
- **FR-004** : Une ligne négative NE DOIT donner aucune rune au brisage normal.
- **FR-005** : Une ligne négative NE DOIT jamais être proposée comme cible de focus.
- **FR-006** : Dans un focus, une ligne négative DOIT contribuer à 50 % de son poids borné, comme les autres lignes non ciblées.
- **FR-007** : Le système DOIT garder séparées les lignes positive et négative d'une même stat.
- **FR-008** : Le résultat DOIT valoir pour les deux modes : coefficient connu, et coefficient inconnu (conseil de focus).
- **FR-009** : Un objet qui n'a que des lignes négatives DOIT être signalé comme sans ligne exploitable.
- **FR-010** : Les objets et la session déjà mémorisés avant cette fonction DOIVENT rester lisibles.
- **FR-011** : La règle DOIT être présentée comme une estimation, avec ses sources (Kama Master retenu, DoFocus écarté), dans la documentation du projet.

### Entités clés

- **Ligne négative** : ligne d'objet à jet inférieur à zéro. Pas de rune, pas de focus, poids borné à 0.
- **Poids borné** : poids d'une ligne négative, jamais inférieur à 0.

## Critères de réussite *(obligatoire)*

### Résultats mesurables

- **SC-001** : Sur tout objet qui a des lignes négatives, 100 % de ces lignes sont visibles dans le tableau.
- **SC-002** : Pour un objet sans ligne négative, tous les résultats sont identiques à ceux d'avant la fonction.
- **SC-003** : Aucun total (runes, kamas, gain, seuils) n'est jamais plus petit à cause d'une ligne négative.
- **SC-004** : Un exemple chiffré de la règle (objet niveau 200, −10 Force → poids 0) est vérifiable à la main par le joueur à partir de la documentation.

## Hypothèses

- La règle de Kama Master est celle de référence, car elle réutilise la formule déjà en place. La règle de forgemagie « poids divisé par 2 pour un malus » n'est pas reprise : Kama Master ne l'applique pas au brisage.
- Aucun relevé en jeu n'a encore confirmé le comportement. Un relevé futur pourra faire changer la règle.
- Le jet par défaut d'une ligne négative est le milieu de son étendue arrondi à l'entier inférieur (même règle que les lignes positives, `Math.floor`).
- Une étendue qui change de signe (−5 à +5) n'existe pas sur les objets du catalogue ; elle n'est pas gérée.
- Dans DofusDB, un malus porte son propre identifiant d'effet (« −Force », « −PA »…) : une correspondance vers la stat retirée est nécessaire. Un malus sans correspondance connue est ignoré.
- Les exos restent positifs : on ne peut pas ajouter d'exo négatif.
- Le maximum de poids de 101 ne s'applique pas aux lignes négatives.
