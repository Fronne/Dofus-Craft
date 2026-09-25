# Feature Specification: Coût de craft des ressources intermédiaires

**Feature Branch**: `015-intermediate-craft-costs`

**Created**: 2026-09-25

**Status**: Draft

**Input**: User description: "Prendre en compte les ressources intermédiaires craftables dans le coût
de craft. Aujourd'hui chaque ingrédient d'une recette est traité comme une ressource achetée au prix
du carnet. Or certains ingrédients se craftent eux-mêmes (planches, alliages, teintures…) et sont
souvent bien plus chers à l'HDV que si on les craftait soi-même." Décisions déjà prises avec le
joueur : choix automatique du moins cher (acheter ou crafter) avec possibilité de forcer ; toute la
chaîne de craft est suivie, aussi loin qu'elle existe ; le prix d'achat d'une ressource
intermédiaire reste son prix du carnet, le coût de sa recette est calculé et jamais stocké comme
prix ; la page Suivis utilise exactement le même calcul que la fiche.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Un coût de craft qui tient compte des ingrédients craftables (Priority: P1)

Le joueur consulte la fiche d'un objet dont la recette contient un ingrédient qui se crafte lui-même
(par exemple une planche). Pour cet ingrédient, l'application connaît deux prix possibles : son prix
d'achat (celui du carnet) et le coût de sa propre recette, calculé à partir des prix de ses
sous-ressources. Elle retient automatiquement le moins cher des deux pour calculer le coût de craft
de l'objet, et indique sur la ligne de l'ingrédient lequel a été retenu (« acheter » ou
« crafter ») avec les deux montants.

**Why this priority**: C'est la valeur même de la fonctionnalité : sans elle, le coût de craft est
surestimé dès qu'un ingrédient coûte plus cher à l'HDV qu'à fabriquer, et la recommandation
craft/achat peut être fausse.

**Independent Test**: Avec un objet dont un ingrédient est craftable, renseigner le prix d'achat de
cet ingrédient et les prix de ses sous-ressources de façon que sa recette soit moins chère : le coût
de craft de l'objet utilise le coût de la recette, et la ligne indique « crafter ». Inverser les prix
: le coût utilise le prix d'achat et la ligne indique « acheter ».

**Acceptance Scenarios**:

1. **Given** un ingrédient craftable acheté 12 000 kamas l'unité et dont la recette coûte 4 300
   kamas, **When** le joueur consulte la fiche, **Then** le coût de craft de l'objet compte cet
   ingrédient à 4 300 kamas l'unité, et sa ligne indique « crafter » avec les deux montants.
2. **Given** le même ingrédient dont la recette coûte 15 000 kamas, **When** le joueur consulte la
   fiche, **Then** l'ingrédient est compté à 12 000 kamas (« acheter »).
3. **Given** un ingrédient craftable sans prix d'achat renseigné mais dont tous les prix de
   sous-ressources sont connus, **When** le joueur consulte la fiche, **Then** l'ingrédient est
   compté au coût de sa recette.
4. **Given** un ingrédient craftable avec un prix d'achat mais dont la recette a au moins une
   sous-ressource sans prix, **When** le joueur consulte la fiche, **Then** l'ingrédient est compté
   à son prix d'achat.
5. **Given** un ingrédient dont ni le prix d'achat ni le coût complet de la recette n'est connu,
   **When** le joueur consulte la fiche, **Then** l'ingrédient est signalé comme prix manquant et le
   coût de craft de l'objet est partiel, comme aujourd'hui pour une ressource sans prix.
6. **Given** un ingrédient qui ne se crafte pas, **When** le joueur consulte la fiche, **Then** il
   se comporte exactement comme aujourd'hui (prix du carnet uniquement).

---

### User Story 2 - Déplier la recette d'un ingrédient et saisir ses sous-ressources (Priority: P1)

Sur la fiche, une ligne d'ingrédient craftable peut se déplier pour montrer sa recette : chaque
sous-ressource avec sa quantité, son prix et son sous-total, dans la même présentation que les
ressources de premier niveau. Le joueur y saisit ou modifie les prix des sous-ressources comme pour
n'importe quelle ressource. Une sous-ressource elle-même craftable peut à son tour se déplier, aussi
loin que la chaîne de craft existe.

**Why this priority**: Sans moyen de voir et de renseigner les sous-ressources, le coût d'une
recette intermédiaire ne peut jamais être calculé : la User Story 1 serait inutilisable.

**Independent Test**: Déplier un ingrédient craftable, saisir les prix de ses sous-ressources, et
constater que son coût de recette puis le coût de craft de l'objet se mettent à jour ; déplier une
sous-ressource craftable et constater qu'elle affiche à son tour sa recette.

**Acceptance Scenarios**:

1. **Given** un ingrédient craftable replié, **When** le joueur le déplie, **Then** sa recette
   s'affiche avec, pour chaque sous-ressource, la quantité nécessaire pour la quantité d'ingrédient
   demandée par l'objet.
2. **Given** une sous-ressource dépliée, **When** le joueur saisit son prix, **Then** ce prix est
   enregistré dans le carnet comme n'importe quel prix de ressource (même date de mise à jour, même
   partage en Mode communautaire) et est réutilisé partout où cette ressource apparaît.
3. **Given** une sous-ressource elle-même craftable, **When** le joueur la déplie, **Then** sa
   propre recette s'affiche, et son coût retenu (acheter ou crafter) remonte dans le coût de
   l'ingrédient parent.
4. **Given** un ingrédient qui ne se crafte pas, **When** le joueur consulte la fiche, **Then**
   aucune commande de dépliage n'apparaît sur sa ligne.

---

### User Story 3 - Forcer « acheter » ou « crafter » pour un ingrédient (Priority: P2)

Le joueur peut préférer acheter un ingrédient même s'il revient moins cher à crafter (pour gagner
du temps, par exemple), ou l'inverse. Il peut forcer le choix « acheter » ou « crafter » sur un ingrédient ; le
calcul utilise alors ce choix au lieu du moins cher, et la ligne indique que le choix est forcé. Il
peut revenir au choix automatique à tout moment.

**Why this priority**: Le choix automatique suffit dans la majorité des cas ; forcer est un
correctif pour les situations où le moins cher n'est pas faisable pour ce joueur.

**Independent Test**: Sur un ingrédient où « crafter » est automatiquement retenu, forcer
« acheter » : le coût de craft de l'objet utilise le prix d'achat et la ligne affiche le choix
forcé ; revenir en automatique : le coût repasse au moins cher.

**Acceptance Scenarios**:

1. **Given** un ingrédient où « crafter » est retenu automatiquement, **When** le joueur force
   « acheter », **Then** l'ingrédient est compté à son prix d'achat et sa ligne indique que le choix
   est forcé.
2. **Given** un choix forcé sur un ingrédient, **When** le joueur ouvre une autre fiche qui utilise
   le même ingrédient, **Then** le même choix forcé s'y applique.
3. **Given** un choix forcé dont la valeur correspondante est inconnue (par exemple « acheter » sans
   prix d'achat), **When** le joueur consulte la fiche, **Then** l'ingrédient est signalé comme prix
   manquant plutôt que de basculer silencieusement sur l'autre valeur.
4. **Given** un choix forcé, **When** le joueur revient au choix automatique, **Then** le moins cher
   des deux est de nouveau retenu.

---

### User Story 4 - La page Suivis affiche le même coût que la fiche (Priority: P2)

Sur la page Suivis, le montant « Craft : … » de chaque carte est calculé avec exactement les mêmes
règles que la fiche de l'objet : même choix acheter/crafter pour chaque ingrédient, mêmes choix
forcés, même profondeur. Le joueur ne voit jamais deux coûts de craft différents pour le même objet.

**Why this priority**: Un écart entre la fiche et la page Suivis a déjà été constaté et corrigé
une fois ; la nouvelle règle de calcul ne doit pas le réintroduire.

**Independent Test**: Pour un objet suivi dont un ingrédient est retenu en « crafter », comparer le
coût de craft affiché sur sa carte et sur sa fiche : ils sont identiques.

**Acceptance Scenarios**:

1. **Given** un objet suivi dont un ingrédient craftable est moins cher à crafter, **When** le
   joueur ouvre la page Suivis, **Then** la carte affiche le même coût de craft que la fiche.
2. **Given** un choix forcé sur un ingrédient, **When** le joueur ouvre la page Suivis, **Then** la
   carte en tient compte.

---

### Edge Cases

- **Recette cyclique** : si une chaîne de recettes revient sur une ressource déjà présente plus haut
  dans la même branche, cette occurrence est traitée comme non craftable (prix d'achat uniquement),
  pour que le calcul se termine toujours.
- **Plusieurs recettes pour une même ressource** : la première recette fournie par la source de
  données est utilisée, comme c'est déjà le cas pour l'objet lui-même.
- **Recette indisponible** (source de données injoignable ou incomplète pour un ingrédient) :
  l'ingrédient est traité comme non craftable pour ce calcul et reste compté à son prix d'achat ; il
  n'est jamais inventé de coût.
- **Chaîne profonde ou large** : l'affichage de la fiche et le coût de craft de premier niveau ne
  doivent pas attendre le chargement des recettes profondes ; les coûts se complètent au fur et à
  mesure.
- **Égalité** entre prix d'achat et coût de recette : « acheter » est retenu (pas de craft pour un
  gain nul).
- **Quantités** : la quantité d'une sous-ressource affichée et comptée est la quantité par unité
  d'ingrédient multipliée par la quantité d'ingrédient demandée par son parent, à chaque niveau.
- **Mode communautaire** : les sous-ressources se comportent comme les ressources de premier niveau
  (pré-remplissage par la médiane communautaire, verrouillage d'un prix déjà enregistré, partage à
  la saisie).
- **Changement de serveur** : les prix pris en compte à tous les niveaux sont ceux du serveur
  actif, comme aujourd'hui.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Pour chaque ingrédient d'une recette, le système MUST déterminer si cet ingrédient
  possède lui-même une recette, et faire de même pour chacune de ses sous-ressources, sur toute la
  profondeur de la chaîne de craft.
- **FR-002**: Pour un ingrédient craftable, le système MUST calculer le coût de sa recette comme la
  somme, pour chaque sous-ressource, de sa quantité multipliée par son coût retenu (lui-même issu de
  cette règle si la sous-ressource est craftable). Ce coût n'est complet que si toutes les
  sous-ressources ont un coût retenu connu.
- **FR-003**: En choix automatique, le système MUST retenir pour un ingrédient craftable le moins
  cher entre son prix d'achat (carnet) et le coût complet de sa recette ; si une seule des deux
  valeurs est connue, celle-ci ; si aucune ne l'est, l'ingrédient est un prix manquant. En cas
  d'égalité, le prix d'achat est retenu.
- **FR-004**: Le coût de craft de l'objet et la recommandation craft/achat existante MUST utiliser,
  pour chaque ingrédient, son coût retenu à la place de son seul prix du carnet.
- **FR-005**: Le système MUST afficher, sur la ligne d'un ingrédient craftable, l'option retenue
  (« acheter » ou « crafter »), le prix d'achat et le coût de la recette quand ils sont connus, et
  si le choix est automatique ou forcé.
- **FR-006**: Le système MUST permettre de déplier et replier la recette d'un ingrédient craftable
  sur la fiche, à chaque niveau de la chaîne, et MUST n'offrir cette commande que pour les
  ingrédients craftables.
- **FR-007**: Le système MUST permettre de saisir et modifier le prix d'une sous-ressource depuis la
  recette dépliée, avec exactement le même comportement que pour une ressource de premier niveau
  (enregistrement dans le carnet du serveur actif, date de mise à jour, règles du Mode
  communautaire).
- **FR-008**: Le système MUST NOT enregistrer le coût calculé d'une recette comme prix de la
  ressource : le carnet ne contient que des prix saisis ou pré-remplis.
- **FR-009**: Le système MUST permettre de forcer « acheter » ou « crafter » sur un ingrédient
  craftable, et de revenir au choix automatique. Un choix forcé s'applique à cette ressource partout
  où elle apparaît, et MUST être conservé sur l'appareil d'une visite à l'autre.
- **FR-010**: Si l'option forcée n'a pas de valeur connue, le système MUST signaler l'ingrédient
  comme prix manquant et MUST NOT basculer sur l'autre option.
- **FR-011**: La page Suivis MUST calculer le coût de craft de chaque objet avec les mêmes règles
  (FR-002 à FR-004, FR-009, FR-010) et les mêmes données que la fiche de l'objet.
- **FR-012**: Le système MUST traiter comme non craftable toute occurrence d'une ressource déjà
  présente plus haut dans la même branche de la chaîne, ainsi que tout ingrédient dont la recette
  n'a pas pu être obtenue, et MUST NOT inventer de coût pour ces cas.
- **FR-013**: L'affichage de la fiche MUST rester utilisable pendant le chargement des recettes
  intermédiaires : les lignes et coûts déjà connus s'affichent immédiatement et se complètent quand
  les recettes arrivent.

### Key Entities *(include if feature involves data)*

- **Recette intermédiaire** : la recette d'une ressource utilisée comme ingrédient ; liste de
  sous-ressources avec leurs quantités par unité produite. Provient de la même source de données que
  les recettes d'objets.
- **Coût retenu d'un ingrédient** : valeur calculée (jamais enregistrée) pour un ingrédient à un
  endroit de la chaîne : option retenue (acheter / crafter / manquant), prix d'achat, coût de
  recette, caractère automatique ou forcé.
- **Choix forcé** : préférence du joueur pour une ressource donnée (« acheter » ou « crafter »),
  conservée sur l'appareil ; son absence signifie choix automatique.
- **Prix de ressource (existant)** : prix du carnet par serveur, inchangé ; sert de prix d'achat à
  tous les niveaux.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Pour un objet dont un ingrédient est moins cher à crafter qu'à acheter, le coût de
  craft affiché est égal au calcul manuel « ingrédient compté au coût de sa recette », au kama près.
- **SC-002**: Pour 100 % des objets suivis, le coût de craft affiché sur la page Suivis est
  identique à celui de leur fiche.
- **SC-003**: Le joueur peut renseigner les prix d'une chaîne de craft à deux niveaux (objet →
  ingrédient → sous-ressources) sans quitter la fiche de l'objet.
- **SC-004**: Les ressources de premier niveau et le coût de craft déjà calculable restent affichés
  aussi vite qu'aujourd'hui ; les coûts intermédiaires se complètent en moins de 3 secondes sur une
  connexion ordinaire pour une chaîne de trois niveaux.
- **SC-005**: Aucun coût de recette n'apparaît jamais dans le carnet (page Prix) comme prix d'une
  ressource.

## Assumptions

- Une recette produit une seule unité de la ressource ; le coût d'une unité d'ingrédient est donc
  le coût total de sa recette. C'est le cas des recettes de ressources de Dofus.
- Le choix forcé est un réglage personnel de l'appareil, par ressource et non par objet (une
  préférence pour une ressource vaut partout où elle apparaît) ; il n'est pas partagé en Mode
  communautaire.
- Le prix d'achat d'une ressource intermédiaire est son prix du carnet (spec 001, FR-005 à FR-007),
  partagé en Mode communautaire comme toute ressource (specs 003 et 004) ; aucun nouveau type de
  prix n'est introduit.
- Le prix HDV de l'objet final et la recommandation craft/achat (spec 001, FR-010 et FR-011) sont
  inchangés ; seul le coût de craft qui leur est comparé change.
- Les recettes intermédiaires viennent de la même source que les recettes d'objets (DofusDB) et
  suivent les mêmes règles de cache et de traçabilité de la source.
- Le coût du temps de craft et des échecs de craft n'est pas pris en compte ; le choix forcé
  couvre le cas où le joueur préfère l'autre option. Avoir ou non le métier n'entre pas en ligne de
  compte.
