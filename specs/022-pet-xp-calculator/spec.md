# Feature Specification: Page Familier — calculateur d'XP et ressources les moins chères

**Feature Branch**: `022-pet-xp-calculator`

**Created**: 2026-09-27

**Status**: Draft

**Input**: User description: « Je veux faire une page familier pour qu'on puisse calculer combien il
faut d'xp pour monter le familier au niveau indiqué, prendre en compte le niveau du familier actuel
et indiquer les meilleures ressources à utiliser pour payer le moins cher possible. » Données de
référence fournies par le porteur du projet : le tableau d'XP familier et le tableau des ressources
(nom de la ressource / XP donnée / quantité nécessaire) de
https://www.dofustool.com/tableau-xp-familier-dofus/ — **remplacées le 2026-09-27** (voir Revisions).

## Revisions

- 2026-09-28 : à la demande du porteur du projet, la liste n'est plus limitée à 10 ressources : elle
  affiche toutes les ressources ayant un prix, 25 lignes à la fois, les suivantes apparaissant quand
  le bas de la liste arrive à l'écran, avec un bouton « Revenir en haut » — comme la page
  Rentabilité (specs/019 FR-007 révisée). FR-007, FR-007b et le scénario US3-5 sont amendés.
- 2026-09-28 : à la demande du porteur du projet, les informations en bas de la liste sont retirées
  (nombre de ressources sans prix, source des données d'XP, avertissement « prix communautaires
  indisponibles ») : FR-008 ne demande plus d'indiquer le nombre, FR-009 est retirée. Exception à
  la constitution (principes I et III) acceptée par le porteur du projet pour ce petit groupe de
  joueurs ; la source reste tracée dans `src/data/pet-xp-data.json` et dans research.md.
- 2026-09-28 : le niveau actuel et l'**XP totale** du familier (celle du tableau de référence, 0 à
  179 592) sont deux champs liés, l'XP totale sous le niveau, à la place de l'« XP déjà gagnée dans
  ce niveau » : saisir un niveau remplit l'XP totale avec l'XP cumulée de ce niveau ; saisir une XP
  totale met le niveau à jour. Le calcul part de l'XP totale (FR-002, FR-003, FR-011).
- 2026-09-28 : interrupteur « Almanax du 23 juillet » (FR-012). Chaque jour de l'année a un Almanax
  fixe, identique d'une année à l'autre ; celui du 23 juillet augmente de 50 % l'XP gagnée par les
  familiers. Quand l'interrupteur est activé, chaque ressource donne 1,5 fois son XP par unité.
- 2026-09-27 : recherche par nom de ressource (FR-007b).
- 2026-09-27 : tri de la liste au clic sur l'en-tête d'une colonne (FR-007), comme sur la page Prix.
- 2026-09-27 : à la demande du porteur du projet, les données Dofus Tool sont entièrement abandonnées.
  L'XP par ressource vient de l'onglet « XP COMPLET » de son fichier EXCEL FAMILIER (colonne XP = XP
  donnée par 1 unité, données de https://dafous.app/pet-xp, 2 118 ressources) ; la courbe par niveau
  vient des fichiers du jeu (niveaux 0 à 100, 179 592 XP au total, total identique à celui de l'Excel).
  Un familier commence au niveau 0.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Connaître l'XP nécessaire pour atteindre un niveau (Priority: P1)

Le joueur ouvre la page Familier, saisit le niveau actuel de son familier (ou son XP totale exacte)
et le niveau qu'il veut atteindre. La page affiche immédiatement l'XP à lui donner pour arriver au
niveau visé.

**Why this priority**: c'est le calcul de base ; il est utile seul, même sans aucun prix connu.

**Independent Test**: saisir niveau actuel 0 et niveau cible 100, vérifier que l'XP totale affiche 0
et la page 179 592 XP.

**Acceptance Scenarios**:

1. **Given** la page Familier ouverte, **When** le joueur saisit niveau actuel 50 et niveau cible 60,
   **Then** l'XP totale affiche 1 703 et la page 2 859 XP (4 562 − 1 703).
2. **Given** niveau actuel 50, **When** le joueur remplace l'XP totale par 1 853, **Then** le niveau
   reste 50 et la page affiche 2 709 XP.
3. **Given** la page ouverte, **When** le joueur saisit XP totale 261, **Then** le niveau actuel
   affiche 32 (256 ≤ 261 < 286).
4. **Given** un niveau cible inférieur ou égal au niveau déduit, **When** le joueur le saisit,
   **Then** la page indique qu'il n'y a pas d'XP à donner et n'affiche pas de recommandation.

---

### User Story 2 - Voir les ressources les moins chères pour monter le familier (Priority: P1)

Sous l'XP nécessaire, la page liste les ressources qui permettent d'atteindre ce niveau pour le
moins de kamas, sur le serveur actif et selon le mode de prix actif (comme la page Recherche). Pour
chaque ressource : son nom et son icône, l'XP qu'elle donne par unité, son prix unitaire, la
quantité à donner et le coût total.

**Why this priority**: c'est la raison d'être de la page (« payer le moins cher possible »).

**Independent Test**: avec des prix connus pour quelques ressources du tableau, vérifier que la
ressource affichée en tête est celle dont le coût par point d'XP est le plus bas, et que sa quantité
et son coût total sont justes.

**Acceptance Scenarios**:

1. **Given** 1 000 XP à donner et une ressource qui donne 1 XP pour 4 unités à 10 kamas l'unité,
   **When** la liste s'affiche, **Then** cette ressource indique 4 000 unités et 40 000 kamas.
2. **Given** plusieurs ressources avec un prix connu, **When** la liste s'affiche, **Then** elles sont
   triées par coût total croissant (la moins chère en premier).
3. **Given** une quantité non entière (ex. 1 000 XP avec une ressource à 1,25 XP), **When** la
   quantité est calculée, **Then** elle est arrondie à l'unité supérieure (800 ici ; 801 si 1 001 XP)
   et le coût total utilise cette quantité arrondie.
4. **Given** le joueur change de niveau cible, de serveur ou de mode de prix, **When** la page se met
   à jour, **Then** la liste et les coûts sont recalculés.
5. **Given** la liste affichée, **When** le joueur clique sur l'en-tête « XP par unité », **Then** les
   ressources ayant un prix s'affichent de celle qui donne le plus d'XP par unité à la plus faible
   (25 d'abord, les suivantes en descendant) ; un second clic inverse l'ordre.
6. **Given** 1 000 XP à donner et une ressource à 2 XP par unité, **When** le joueur active
   l'interrupteur « Almanax du 23 juillet (+50 % d'XP) », **Then** la ressource affiche 3 XP par
   unité et 334 unités (1 000 ÷ 3, arrondi à l'unité supérieure) au lieu de 500, et son coût total
   est recalculé ; l'XP nécessaire affichée ne change pas.

---

### User Story 3 - Comprendre d'où viennent les chiffres (Priority: P2)

Le joueur voit la date et l'âge du prix utilisé pour chaque ressource. (Depuis le 2026-09-28, la
source des valeurs d'XP et le nombre de ressources écartées faute de prix ne sont plus affichés.)

**Why this priority**: la constitution exige des recommandations explicables et des données
traçables ; sans ce contexte, un prix très ancien pourrait fausser le conseil sans que le joueur le
sache.

**Independent Test**: vérifier que chaque ligne montre la date de son prix.

**Acceptance Scenarios**:

1. **Given** une ressource recommandée, **When** le joueur regarde sa ligne, **Then** il voit la date
   du prix utilisé, avec le même signalement des prix anciens que le reste de l'app.
2. **Given** des ressources du tableau sans prix connu, **When** la liste s'affiche, **Then** elles n'y
   figurent pas.

---

### Edge Cases

- Aucune ressource du tableau n'a de prix connu : la page affiche l'XP nécessaire et un message
  expliquant qu'aucune recommandation n'est possible sans prix, avec un lien vers la saisie de prix.
- XP totale saisie au-dessus de 179 592, niveau actuel ou niveau visé au-dessus de 100 : ramenés
  aussitôt à ce maximum. XP totale au maximum : niveau actuel 100, plus rien à donner.
- XP négative, niveau visé inférieur à 1, nombre non entier ou saisie non numérique : refusé avec un
  message.
- Ressource du tableau introuvable dans le catalogue de l'app (nom différent, doublon) : elle est
  ignorée ; elle ne doit jamais être rattachée à la mauvaise ressource.
- Ressource dont l'XP par unité est 0, absente ou illisible : jamais recommandée.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: L'app MUST proposer une page Familier accessible depuis la navigation principale.
- **FR-002**: Le joueur MUST pouvoir saisir le niveau actuel (0 à 100), l'XP totale de son familier
  (entier de 0 à 179 592), dans un champ sous le niveau, et le niveau cible (1 à 100). Les deux
  premiers sont liés : saisir un niveau valide remplit l'XP totale avec l'XP cumulée de ce niveau ;
  saisir une XP totale valide remplace le niveau par celui qu'elle donne = le plus haut niveau dont
  l'XP cumulée est inférieure ou égale à cette XP.
- **FR-003**: L'app MUST calculer l'XP nécessaire = XP totale cumulée du niveau cible − XP totale
  saisie (0 si négative), à partir de la courbe d'XP familier de référence (niveaux 0 à 100).
- **FR-004**: L'app MUST connaître, pour chaque ressource du tableau de référence, l'XP donnée
  par une unité.
- **FR-005**: L'app MUST rattacher chaque ressource du tableau à une ressource du catalogue de l'app
  par son nom, sans ambiguïté ; une ressource non rattachée de façon certaine est ignorée.
- **FR-006**: Pour chaque ressource rattachée qui a un prix connu sur le serveur actif et selon le
  mode de prix actif, l'app MUST calculer la quantité à donner (XP nécessaire ÷ XP par unité,
  arrondie à l'unité supérieure) et le coût total (quantité × prix unitaire).
- **FR-007** *(révisée le 2026-09-28)*: L'app MUST afficher toutes les ressources ayant un prix,
  par défaut triées par coût total croissant, avec pour chacune : nom, icône, XP par unité, prix
  unitaire et date de ce prix, quantité et coût total. Les 25 premières lignes s'affichent d'abord ;
  les 25 suivantes apparaissent chaque fois que le bas de la liste arrive à l'écran, et un bouton
  « Revenir en haut » apparaît une fois la page descendue, comme sur la page Rentabilité. Un clic sur
  l'en-tête d'une colonne trie toutes les ressources ayant un prix selon cette colonne (premier clic :
  nom A → Z, XP par unité décroissante, prix / quantité / coût croissants ; second clic : sens
  inverse ; égalités départagées par coût total puis nom) et revient aux 25 premières lignes. Le tri
  n'est pas mémorisé.
- **FR-007b**: Le joueur MUST pouvoir filtrer la liste par nom de ressource (sans tenir compte des
  accents ni de la casse) ; le filtre s'applique avant le tri et revient aux 25 premières lignes. Si aucune
  ressource avec un prix ne correspond, la page le dit et indique combien correspondent sans prix.
- **FR-008**: L'app MUST exclure les ressources sans prix connu.
- **FR-009**: *(retirée le 2026-09-28)*
- **FR-010**: Les résultats MUST se recalculer dès que l'XP totale, le niveau visé, le serveur ou le
  mode de prix change.
- **FR-011**: L'app MUST conserver sur l'appareil la dernière XP totale et le dernier niveau visé
  saisis pour les retrouver à la prochaine visite ; une saisie enregistrée dans l'ancien format
  (niveau actuel + XP dans ce niveau) est convertie en XP totale.
- **FR-012**: La page MUST proposer un interrupteur « Almanax du 23 juillet (+50 % d'XP) ». Activé,
  l'XP par unité de chaque ressource est multipliée par 1,5 pour le calcul de la quantité, du coût
  total et du tri, et la colonne XP affiche cette valeur augmentée. L'interrupteur est activé
  d'office le 23 juillet (date de l'appareil) et désactivé les autres jours ; le joueur peut le
  changer à tout moment, sans que ce choix soit conservé d'une visite à l'autre.

### Key Entities

- **Courbe d'XP familier**: pour chaque niveau de 0 à 100, l'XP totale cumulée nécessaire pour
  l'atteindre (0 au niveau 0, 179 592 au niveau 100). Donnée fixe, avec sa source.
- **Ressource nourrissante**: une ressource du tableau de référence : nom, XP donnée par unité, et la ressource du catalogue à laquelle elle est rattachée.
- **Recommandation**: une ressource nourrissante avec prix connu, sa quantité à donner et son coût
  total pour l'XP demandée.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un joueur obtient l'XP nécessaire et la ressource la moins chère en moins de
  30 secondes après avoir ouvert la page.
- **SC-002**: Pour 100 % des couples de niveaux testés, l'XP affichée correspond au tableau de
  référence.
- **SC-003**: La ressource affichée en premier a toujours le coût total le plus bas parmi les
  ressources rattachées ayant un prix connu.
- **SC-004**: Aucune ressource n'est rattachée à une ressource du catalogue dont le nom ne
  correspond pas exactement.
- **SC-005**: Les résultats se mettent à jour sans délai perceptible (moins d'une seconde) après un
  changement de saisie.

## Assumptions

- L'XP par ressource (Dafous, via l'Excel du porteur du projet) et la courbe du jeu s'appliquent à
  la version actuelle ; elles sont figées dans l'app avec leur source et leur date de relevé, et
  mises à jour à la main si besoin.
- Nourrir avec une seule ressource suffit : le coût étant proportionnel à la quantité, la ressource
  au coût par point d'XP le plus bas est la moins chère ; mélanger plusieurs ressources n'est pas
  proposé.
- Les prix utilisés sont ceux de l'app (prix saisis ou communautaires selon le mode actif, sur le
  serveur actif), comme sur la page Recherche ; aucune source de prix nouvelle n'est ajoutée.
- Les croquettes et autres aliments achetés en boutique (Kolizétons, Pépites) ne sont pas traités
  différemment : ils ne sont recommandés que s'ils ont un prix HDV connu comme toute ressource.
- Les bonus de caractéristiques gagnés par le familier selon son niveau sont hors périmètre.
- Bonus Almanax : + 50 % s'applique à l'XP de chaque unité donnée, sans arrondi par unité (même
  hypothèse que les valeurs décimales du tableau). Les autres Almanax n'ont pas d'effet sur l'XP des
  familiers et ne sont pas pris en compte.
