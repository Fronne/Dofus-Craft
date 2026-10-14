# Feature Specification: Refonte de la page XP Familier

**Feature Branch**: `055-refonte-xp-familier`

**Created**: 2026-10-15

**Status**: Draft

**Input**: User description: "Refonte de la disposition de la page XP Familier (specs/022-pet-xp-calculator) selon la planche validée « Page XP Familier — proposition » (canevas https://claude.ai/artifact/Uv5f1SQ9rodZjd2qN8hpXK, fichier XP-Familier.dc.html), inspirée de https://dafous.app/pet-xp. Style visuel actuel du site (spec 051) conservé. Quatre blocs : 1) bandeau objectif : niveau actuel → niveau visé, ou XP totale du familier ; barre de progression vers le niveau 100 avec repère ; « XP à donner » en grand ; interrupteur Almanax du 23 juillet dans ce bandeau. 2) podium des 3 ressources les moins chères pour l'objectif, en grandes cartes : image, nom, coût total en grand, quantité, prix unitaire, XP par unité, âge du prix ; la 2e et la 3e affichent leur écart en kamas avec la 1re. 3) « Viser une ressource précise » : recherche d'une ressource, puis fiche : XP par unité, rang parmi les moins chères, quantité, prix unitaire, coût total, écart en % avec la 1re, part de l'objectif apportée par 1 unité. 4) tableau complet des ressources à partir de la 4e, avec rang, filtre, quantité max, tris actuels et affichage progressif. Pas d'astuces ni de FAQ. Aucun changement des calculs ni des données."

**Maquette de référence** : canevas « Dofus Craft — pistes de charte graphique »
(<https://claude.ai/artifact/Uv5f1SQ9rodZjd2qN8hpXK>), planche « Page XP Familier — proposition »,
validée par l'utilisateur le 2026-10-15. La maquette fixe la disposition ; les couleurs, polices et
composants restent ceux du site (spec 051), en thème sombre comme en thème clair.

**Périmètre** : cette spec ne change que la présentation de la page XP Familier. Les règles de
calcul, la courbe d'XP, la liste des ressources, les prix et leur provenance, la mémorisation des
saisies et l'Almanax restent ceux de `specs/022-pet-xp-calculator` (FR-002 à FR-012), sauf mention
contraire ci-dessous.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Voir d'un coup d'œil où en est le familier et ce qu'il reste à donner (Priority: P1)

Le joueur ouvre la page XP Familier. En haut, un bandeau « objectif » réunit ses saisies (niveau
actuel → niveau visé, ou XP totale du familier), une barre de progression qui montre où en est le
familier sur le chemin du niveau 100, et l'« XP à donner » en grand. L'interrupteur Almanax est dans
ce bandeau.

**Why this priority**: c'est le point de départ de toute la page ; sans lui, aucun autre bloc n'a de
sens.

**Independent Test**: saisir niveau actuel 85 et niveau visé 100 : la barre est remplie à 26,2 %, le
repère indique « Niveau 85 · 47 003 XP », et « XP à donner » affiche 132 589.

**Acceptance Scenarios**:

1. **Given** un familier au niveau 85 visant le niveau 100, **When** la page s'affiche, **Then** le
   bandeau montre 132 589 XP à donner, une barre remplie à 26,2 % et les bornes « Niveau 85 ·
   47 003 XP » et « Niveau 100 · 179 592 XP ».
2. **Given** le bandeau affiché, **When** le joueur change son XP totale, **Then** le niveau actuel,
   la barre et l'XP à donner se mettent à jour aussitôt.
3. **Given** un niveau visé déjà atteint, **When** la page s'affiche, **Then** le bandeau indique
   qu'il n'y a plus d'XP à donner et les blocs 2 à 4 ne s'affichent pas.
4. **Given** le bandeau affiché, **When** le joueur active l'Almanax, **Then** les blocs suivants
   sont recalculés avec +50 % d'XP par ressource, sans que l'XP à donner change.

---

### User Story 2 - Voir les 3 ressources les moins chères mises en avant (Priority: P1)

Sous le bandeau, un podium présente les 3 ressources dont le coût total est le plus bas pour
l'objectif, en grandes cartes : image, nom, coût total en grand, quantité, prix unitaire, XP par
unité et âge du prix. La 1re est mise en valeur ; la 2e et la 3e affichent leur écart en kamas avec
la 1re.

**Why this priority**: c'est la réponse que le joueur vient chercher ; elle doit se lire sans
parcourir un tableau.

**Independent Test**: avec des prix connus, le podium affiche les 3 ressources de plus faible coût
total, dans l'ordre, et l'écart affiché pour la 2e et la 3e égale leur coût total moins celui de la
1re.

**Acceptance Scenarios**:

1. **Given** au moins 3 ressources avec un prix sous le plafond « Quantité max », **When** la page
   s'affiche, **Then** le podium montre les 3 de plus faible coût total, de la moins chère à la plus
   chère, avec pour la 2e et la 3e « +N kamas » par rapport à la 1re.
2. **Given** un prix relevé il y a longtemps, **When** sa carte s'affiche, **Then** l'âge du prix
   est signalé comme sur les autres pages (ambre ou corail selon l'ancienneté).
3. **Given** seulement 1 ou 2 ressources avec un prix, **When** la page s'affiche, **Then** le podium
   n'en montre que 1 ou 2.
4. **Given** un filtre par nom saisi dans le tableau (bloc 4), **When** le podium s'affiche, **Then**
   il n'en tient pas compte : il montre toujours les 3 moins chères.

---

### User Story 3 - Voir ce que coûterait une ressource précise (Priority: P2)

Le joueur a déjà une ressource en tête ou en stock. Dans le bloc « Viser une ressource précise », il
cherche son nom et choisit la ressource : une fiche montre son XP par unité, son rang parmi les
moins chères, la quantité à donner, le prix unitaire, le coût total, l'écart en % avec la 1re du
podium et la part de l'objectif apportée par une unité.

**Why this priority**: utile mais secondaire ; le podium et le tableau répondent déjà à la question
principale.

**Independent Test**: chercher « Kamatrix » (24,846 XP par unité, 597 kamas) pour 132 589 XP à
donner : la fiche affiche 5 337 unités, 3 186 189 kamas, et 0,019 % de l'objectif par unité.

**Acceptance Scenarios**:

1. **Given** l'objectif saisi, **When** le joueur tape au moins 2 lettres d'un nom, **Then** une
   liste de ressources correspondantes (sans tenir compte des accents ni de la casse) s'affiche ; il
   en choisit une à la souris ou au clavier.
2. **Given** une ressource choisie qui a un prix, **When** la fiche s'affiche, **Then** elle montre
   XP par unité, rang (« 10e la moins chère »), quantité, prix unitaire, coût total, écart en % avec
   la 1re et part de l'objectif apportée par une unité.
3. **Given** une ressource choisie sans prix connu, **When** la fiche s'affiche, **Then** elle montre
   l'XP par unité, la quantité et la part de l'objectif, et indique que le prix est inconnu à la place
   du prix, du coût, du rang et de l'écart.
4. **Given** une ressource choisie au-delà du plafond « Quantité max », **When** la fiche s'affiche,
   **Then** elle montre tous ses chiffres et indique qu'elle n'est pas classée car elle demande plus
   d'unités que le plafond.
5. **Given** une fiche affichée, **When** l'objectif, l'Almanax, le serveur ou le mode de prix
   change, **Then** la fiche se recalcule pour la même ressource.

---

### User Story 4 - Parcourir toutes les autres ressources (Priority: P2)

Sous ces blocs, le tableau « Toutes les ressources » liste les ressources avec un prix qui ne sont
pas sur le podium, avec leur rang, et garde les outils actuels : filtre par nom, quantité max, tri
par colonne et affichage progressif par 25.

**Why this priority**: indispensable pour comparer au-delà des 3 premières, mais déjà présent
aujourd'hui sous une autre forme.

**Independent Test**: avec 10 ressources avec un prix, le tableau commence à la 4e, chaque ligne
porte son rang (4 à 10), et un tri par XP par unité réordonne les lignes sans changer leurs rangs.

**Acceptance Scenarios**:

1. **Given** plus de 3 ressources avec un prix, **When** le tableau s'affiche, **Then** il commence
   à la 4e moins chère, chaque ligne affichant son rang, son icône, son nom, l'âge du prix, l'XP par
   unité, le prix unitaire, la quantité et le coût total.
2. **Given** le tableau, **When** le joueur trie par une autre colonne, **Then** les lignes se
   réordonnent selon les règles actuelles (022 FR-007) et chaque ligne garde le rang de son coût
   total.
3. **Given** le tableau, **When** le joueur filtre par nom, **Then** seules les lignes
   correspondantes restent, et le message actuel s'affiche si aucune ne correspond.
4. **Given** 3 ressources avec un prix ou moins, **When** la page s'affiche, **Then** le tableau
   n'apparaît pas.

---

### Edge Cases

- XP à donner indisponible (saisie invalide) : le bandeau montre « — » et les blocs 2 à 4 ne
  s'affichent pas, comme aujourd'hui.
- Aucun serveur choisi, prix en cours de chargement, service des prix partagés indisponible, aucun
  prix connu : les messages et actions actuels (022) s'affichent à la place des blocs 2 et 4 ; le
  bloc 3 reste disponible et ses fiches indiquent alors « prix inconnu ».
- Toutes les ressources dépassent le plafond « Quantité max » : le podium et le tableau sont
  remplacés par le message actuel invitant à augmenter ou vider le plafond.
- Recherche du bloc 3 sans résultat : la liste l'indique (« Aucune ressource ne correspond »).
- Ressource choisie dans le bloc 3 qui est sur le podium : la fiche s'affiche normalement (rang 1 à
  3, écart 0 % pour la 1re).
- Familier au niveau 0 ou au niveau 100 : la barre est vide ou pleine, son repère reste visible.
- Écran étroit (téléphone) : les blocs s'empilent, les cartes du podium passent l'une sous l'autre et
  le tableau défile horizontalement dans son cadre, sans défilement horizontal de la page.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La page MUST s'organiser en quatre blocs, de haut en bas : bandeau objectif, podium,
  « Viser une ressource précise », « Toutes les ressources ». Elle ne contient ni astuces ni FAQ.
- **FR-002**: Le bandeau objectif MUST contenir les champs actuels (niveau actuel, niveau visé, XP
  totale du familier ; 022 FR-002), l'XP à donner en grand, et l'interrupteur Almanax (022 FR-012).
- **FR-003**: Le bandeau MUST afficher une barre de progression égale à XP totale du familier ÷ XP
  du niveau 100, en pourcentage à une décimale, avec un repère à cette position et deux bornes :
  « Niveau N · X XP » (niveau actuel et XP totale) et « Niveau 100 · 179 592 XP ». Elle est
  accessible comme une barre de progression (valeur lisible par un lecteur d'écran).
- **FR-004**: Le podium MUST montrer les 3 ressources de plus faible coût total parmi celles qui ont
  un prix et respectent le plafond « Quantité max » (022 FR-008b), Almanax compris, quels que soient
  le filtre et le tri du tableau. Moins de 3 : il en montre autant qu'il y en a.
- **FR-005**: Chaque carte du podium MUST afficher : rang, image, nom, coût total en grand, quantité,
  prix unitaire, XP par unité (Almanax compris) et âge du prix avec le même signalement d'ancienneté
  que le reste du site. La 1re porte la mention « la moins chère » et une mise en valeur ; la 2e et la
  3e affichent « +N kamas », N = leur coût total − celui de la 1re.
- **FR-006**: Le bloc « Viser une ressource précise » MUST proposer un champ de recherche parmi
  toutes les ressources nourrissantes rattachées (avec ou sans prix), insensible aux accents et à la
  casse, à partir de 2 caractères, avec une liste de suggestions utilisable à la souris et au
  clavier.
- **FR-007**: La fiche de la ressource choisie MUST afficher : image, nom, XP par unité (Almanax
  compris), quantité à donner, part de l'objectif apportée par une unité (XP par unité ÷ XP à
  donner, en pourcentage arrondi à 2 chiffres significatifs, ex. 0,019 %), et, si un prix est connu, prix
  unitaire, coût total, rang parmi les ressources classées (FR-004) et écart en % avec la 1re
  ((coût − coût de la 1re) ÷ coût de la 1re, une décimale). Sans prix : « Prix inconnu » à la place
  de ces quatre valeurs. Au-delà du plafond : « Non classée (plus de N unités) » à la place du rang.
- **FR-008**: La ressource choisie MUST rester choisie quand l'objectif, l'Almanax, le serveur ou le
  mode de prix change, et sa fiche se recalculer. Elle n'est pas mémorisée d'une visite à l'autre.
- **FR-009**: Le tableau « Toutes les ressources » MUST lister les ressources classées (FR-004) sauf
  celles du podium, avec en première colonne leur rang par coût total ; il garde le filtre par nom
  (022 FR-007b), le plafond « Quantité max » et son message (022 FR-008b), le tri par colonne et
  l'affichage progressif par 25 avec le bouton « Revenir en haut » (022 FR-007). Le rang d'une ligne
  ne change ni avec le tri ni avec le filtre. Il n'apparaît pas quand le podium contient toutes les
  ressources classées.
- **FR-010**: Les calculs (XP à donner, quantité, coût total, Almanax, plafond) et les données
  (courbe, ressources, prix) MUST rester ceux de la spec 022 ; seule leur présentation change.
- **FR-011**: La page MUST rester utilisable à la largeur d'un téléphone : blocs empilés, cartes du
  podium en colonne, tableau défilant dans son cadre, cibles tactiles d'au moins 44 px.

### Key Entities

- **Objectif**: niveau actuel, XP totale, niveau visé et XP à donner (022), plus la progression vers
  le niveau 100.
- **Ressource classée**: une recommandation (022) avec prix, sous le plafond, et son rang par coût
  total croissant.
- **Ressource visée**: la ressource choisie dans le bloc 3, classée ou non, avec ou sans prix.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Le joueur lit la ressource la moins chère et son coût total sans faire défiler la page,
  sur un écran d'ordinateur de 1 280 × 800 px, une fois ses niveaux saisis.
- **SC-002**: Pour 100 % des cas testés, les chiffres du podium, de la fiche et du tableau sont
  identiques à ceux calculés par la page actuelle pour la même saisie.
- **SC-003**: Le joueur obtient la fiche d'une ressource précise en moins de 10 secondes (taper le
  nom, choisir la suggestion).
- **SC-004**: À 375 px de large, aucun défilement horizontal de la page et aucun texte coupé.

## Assumptions

- Le podium et le classement respectent le plafond « Quantité max » : une ressource demandant
  50 000 unités ou plus n'est pas une recommandation réaliste.
- Le filtre par nom reste un outil du tableau seulement ; le podium montre toujours les 3 moins
  chères.
- La recherche du bloc 3 et le filtre du tableau sont deux champs distincts, comme sur la maquette.
- Les images des ressources sont celles déjà affichées aujourd'hui ; la maquette ne montre que des
  emplacements.
- Les textes de la maquette (titres de blocs, intitulés) servent de base et peuvent être ajustés à
  la marge pendant la réalisation.
- Les éléments actuels non cités (messages d'état, lien vers la page HDV, mentions du serveur et du
  mode de prix) sont conservés et replacés dans le bloc le plus proche.
