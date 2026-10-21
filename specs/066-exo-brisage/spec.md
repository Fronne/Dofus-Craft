# Spécification : Exos sur les lignes de l'objet, page Brisage

**Branche**: `066-exo-brisage`

**Créée le**: 2026-10-21

**Statut**: Brouillon

**Entrée**: « Page Brisage : pouvoir ajouter un exo sur les lignes de l'objet, et que l'exo soit compté dans le brisage, avec tout ce qui va avec. N'importe quelle ligne peut être exo, un exo ne peut pas dépasser 101 de poids, et un même objet peut porter plusieurs exos (ex. 5 de Force + 1 % Dommages aux sorts). »

Cette spec prolonge `specs/060-page-brisage` (modèle de calcul), `specs/061`, `specs/063-brisage-sans-coefficient` et `specs/065-refonte-page-brisage`. Elle ajoute une notion (la ligne exo) mais ne change aucune règle de calcul des lignes existantes.

## Principe

Un **exo** est une ligne de stat qu'un forgemage a ajoutée à un objet alors que l'objet ne l'a pas de base (ex. +1 PA, +5 Force). Au brisage, cette ligne donne des runes comme les autres. Aujourd'hui la page ne connaît que les lignes d'origine de l'objet : un joueur qui veut briser un objet exo ne peut pas le représenter, et son gain est sous-estimé.

Règle de calcul retenue, d'après l'analyse de DoFocus (`docs/dofocus-brisage.md`) : un exo est une **ligne séparée** à part entière.
- Poids de la ligne : même formule que les autres lignes.
- Sans focus : l'exo produit ses runes comme n'importe quelle ligne, au coefficient de l'objet.
- Focus sur une ligne d'origine : l'exo compte à 50 %, comme les autres lignes non ciblées.
- Pas de focus sur un exo : on ne peut pas focaliser une ligne exo, elle n'est jamais proposée comme cible.
- Une stat déjà présente sur l'objet n'est pas un exo mais un **over** : on ne l'ajoute pas comme exo, on règle le jet de la ligne d'origine au-delà de son maximum (voir User Story 5).

Cette règle vient d'une lecture du site DoFocus, pas d'une règle officielle : elle reste une estimation, comme le reste du modèle.

## Scénarios utilisateur et tests *(obligatoire)*

### User Story 1 - Ajouter un exo à l'objet choisi (Priorité : P1)

Sous le tableau des lignes de l'objet choisi, le joueur a une action « Ajouter un exo ». Il choisit la stat parmi toutes celles que le brisage connaît **et que l'objet n'a pas déjà**, et indique sa valeur. Une ligne exo apparaît dans le tableau, repérée comme « exo », avec ses runes, son prix et ses runes obtenues. Il peut ajouter plusieurs exos sur le même objet, et en retirer un.

**Pourquoi cette priorité** : sans pouvoir saisir l'exo, rien d'autre n'existe.

**Test indépendant** : choisir un objet, ajouter un exo de 5 Force et un exo de 1 % Dommages aux sorts, vérifier que deux lignes « exo » apparaissent et que les runes correspondantes sont listées.

**Scénarios d'acceptation** :

1. **Étant donné** un objet choisi, **quand** le joueur ajoute un exo de Force à 5, **alors** une ligne exo Force 5 apparaît dans le tableau, distincte des lignes d'origine.
2. **Étant donné** un exo déjà ajouté, **quand** le joueur en ajoute un second sur une autre stat, **alors** les deux lignes coexistent.
3. **Étant donné** une ligne exo, **quand** le joueur la retire, **alors** elle disparaît et les totaux reviennent à ce qu'ils étaient sans elle.
4. **Étant donné** un objet qui a déjà la stat (ex. Force) en ligne d'origine, **quand** le joueur ouvre la liste des stats d'un exo, **alors** cette stat n'y figure pas : pour la dépasser, il règle le jet de la ligne d'origine (over).
5. **Étant donné** aucun objet choisi, **quand** la page s'affiche, **alors** l'action d'ajout n'est pas proposée.

---

### User Story 2 - L'exo est compté dans le brisage (Priorité : P1)

Une fois un exo saisi, tout ce que la page calcule le prend en compte : runes obtenues sans focus et avec focus, valeur en kamas, gain par rapport au prix de l'objet, meilleure option, coefficient minimal rentable, nombre d'objets à briser en descendant le coefficient, et le conseil de focus quand le coefficient est inconnu.

**Pourquoi cette priorité** : c'est la raison d'être de la fonction.

**Test indépendant** : sur un même objet, noter le gain sans exo, ajouter un exo, vérifier que les runes de cette stat apparaissent et que le gain augmente du prix de ces runes.

**Scénarios d'acceptation** :

1. **Étant donné** un exo, **quand** le brisage est sans focus, **alors** ses runes s'ajoutent à celles des autres lignes, au coefficient de l'objet.
2. **Étant donné** un exo, **quand** un focus porte sur une autre ligne, **alors** l'exo participe à 50 % comme les autres lignes non ciblées.
3. **Étant donné** un exo, **quand** le joueur compare les focus, **alors** aucun focus n'est proposé sur la ligne exo ; seules les lignes d'origine sont des cibles, et l'exo y contribue à 50 %.
4. **Étant donné** un exo, **quand** le coefficient est connu, **alors** le seuil de rentabilité et la descente d'objets tiennent compte de la valeur des runes de l'exo.
5. **Étant donné** un exo, **quand** le coefficient est inconnu, **alors** le conseil de focus et le coefficient de bascule tiennent compte de l'exo.
6. **Étant donné** un exo dont la rune n'a pas de prix, **quand** le tableau s'affiche, **alors** le prix manquant est signalé comme pour toute autre ligne, sans être traité comme 0.

---

### User Story 3 - Limite de poids d'un exo (Priorité : P2)

Le poids d'un exo (sa valeur multipliée par le poids de la stat) ne peut pas dépasser 101. Le joueur est empêché de saisir un exo au-delà, avec un message qui dit pourquoi et quelle valeur maximale est possible pour cette stat.

**Test indépendant** : choisir une stat de poids 1 (Force), saisir 150 : la saisie est refusée ou ramenée à 101 avec un message ; choisir PA (poids 100) : seule la valeur 1 est possible.

**Scénarios d'acceptation** :

1. **Étant donné** une stat de poids 1, **quand** la valeur saisie fait un poids supérieur à 101, **alors** elle est refusée et la valeur maximale pour cette stat est indiquée.
2. **Étant donné** une stat de poids 100 (PA), **quand** le joueur la choisit, **alors** la valeur maximale est 1.
3. **Étant donné** une valeur nulle, négative ou vide, **quand** le joueur valide, **alors** aucune ligne exo n'est ajoutée et le champ est signalé.
4. **Étant donné** plusieurs exos sur l'objet, **quand** la limite est contrôlée, **alors** elle s'applique à chaque exo séparément et non à leur somme.

---

### User Story 4 - Les exos sont conservés avec la session (Priorité : P2)

Les exos saisis sur un objet sont gardés avec le reste de la saisie de la page, comme le sont déjà le jet des lignes ou le mode de prix. En revenant sur la page, ou en reprenant le même objet, le joueur retrouve ses exos.

**Test indépendant** : ajouter un exo, recharger la page, choisir le même objet : l'exo est toujours là.

**Scénarios d'acceptation** :

1. **Étant donné** un exo saisi sur un objet, **quand** le joueur recharge la page puis choisit cet objet, **alors** l'exo est restauré.
2. **Étant donné** deux objets différents, **quand** le joueur passe de l'un à l'autre, **alors** chaque objet garde ses propres exos.
3. **Étant donné** des données de session sans exos (enregistrées avant cette fonction), **quand** la page s'ouvre, **alors** elle fonctionne normalement, sans exo.

---

### User Story 5 - Over : dépasser le maximum d'une ligne d'origine (Priorité : P2)

Une stat que l'objet a déjà ne s'ajoute pas en exo : c'est un **over**. Le joueur règle alors le jet de la ligne d'origine au-delà de son maximum habituel, en tapant la valeur, et le brisage en tient compte.

**Test indépendant** : sur un objet dont la ligne Force va de 21 à 30, saisir 33 : la valeur est acceptée et les runes de la ligne augmentent en conséquence.

**Scénarios d'acceptation** :

1. **Étant donné** une ligne d'origine de maximum 30, **quand** le joueur saisit 33, **alors** le jet 33 est accepté, indiqué comme over, et utilisé dans tous les calculs.
2. **Étant donné** un jet en over, **quand** le joueur repasse sur Min / Moyen / Max, **alors** le jet revient dans la plage normale.

## Cas limites

- Stat sans rune connue : l'exo est refusé ou signalé comme non comptable, comme les effets ignorés des lignes d'origine.
- Valeur décimale : refusée, les jets sont entiers.
- Stat à valeur négative (ex. malus) : hors périmètre, seules les valeurs positives sont acceptées.
- Changement de niveau de l'objet ou de taille de rune dans les réglages : les poids se recalculent, la limite de 101 est revérifiée.
- Même stat en exo plusieurs fois : refusé, une stat n'a qu'un exo ; une fois ajoutée, elle disparaît de la liste.
- Stat ajoutée en exo puis présente sur un autre objet choisi : les exos sont propres à chaque objet.

## Exigences fonctionnelles

- **FR-001** : Le joueur peut ajouter à l'objet choisi une ou plusieurs lignes exo, chacune avec une stat et une valeur entière positive.
- **FR-002** : Toute stat connue du brisage et ayant une rune peut être choisie en exo, sauf une stat que l'objet a déjà (ligne d'origine) ou qui est déjà en exo sur cet objet.
- **FR-003** : Le poids d'un exo (valeur × poids de la stat) ne dépasse pas 101 ; au-delà la saisie est refusée avec la valeur maximale indiquée.
- **FR-004** : Une ligne exo est affichée dans le tableau, repérée comme exo, et peut être retirée.
- **FR-005** : Un exo est une ligne séparée des lignes d'origine ; il n'y a jamais d'exo sur une stat déjà présente sur l'objet.
- **FR-006** : Sans focus, un exo produit des runes comme une ligne normale, au coefficient de l'objet.
- **FR-007** : En focus sur une ligne d'origine, un exo compte à la même part que les autres lignes non ciblées (50 % par défaut, réglable dans les réglages existants).
- **FR-008** : Un exo ne peut pas être focalisé : aucune option de focus n'est proposée ni calculée pour une ligne exo.
- **FR-013** : Le jet d'une ligne d'origine peut être réglé au-delà de son maximum (over) en tapant la valeur ; ce jet est utilisé dans tous les calculs et se réinitialise avec Min / Moyen / Max.
- **FR-009** : Les exos entrent dans les runes obtenues, la valeur en kamas, le gain, la meilleure option, le coefficient minimal rentable, la descente d'objets et le conseil de focus sans coefficient.
- **FR-010** : Un prix de rune manquant pour un exo est signalé, jamais traité comme 0.
- **FR-011** : Les exos d'un objet sont conservés avec la saisie de la page, par objet, et restaurés à la reprise de l'objet.
- **FR-012** : Une session enregistrée sans exos continue de fonctionner.

## Entités clés

- **Ligne exo** : stat que l'objet n'a pas, valeur entière, rattachée à un objet ; participe au calcul comme une ligne séparée, jamais comme cible de focus.
- **Over** : jet d'une ligne d'origine réglé au-dessus de son maximum ; ce n'est pas un exo.
- **Objet choisi** : objet du catalogue avec ses lignes d'origine et, en plus, ses lignes exo.

## Hypothèses

- La règle de calcul de l'exo est celle observée sur DoFocus (ligne séparée, même formule, 50 % en focus non ciblé). Aucune source officielle ne la confirme ; elle reste une estimation, signalée comme telle comme le reste du modèle.
- Le « poids » limité à 101 est la valeur de l'exo multipliée par le poids de la stat tel que défini dans les réglages de brisage.
- Les chances de réussite d'un exo en forgemagie ne sont pas modélisées : la page calcule le brisage d'un objet déjà exo.
- Les exos sont propres à l'objet choisi sur l'appareil du joueur ; aucun partage.

## Critères de réussite

- **SC-001** : En moins de 15 secondes, un joueur ajoute un exo à un objet et voit ses runes et le gain mis à jour.
- **SC-002** : Pour tout objet, le gain avec exo moins le gain sans exo est égal à la valeur des runes de l'exo calculées par la même formule que les autres lignes.
- **SC-003** : 100 % des saisies d'exo de poids supérieur à 101 sont refusées avec un message qui indique la valeur maximale.
- **SC-004** : Les exos saisis sont retrouvés à l'identique après rechargement de la page dans 100 % des cas.
- **SC-005** : Aucun résultat existant ne change pour un objet sans exo.
