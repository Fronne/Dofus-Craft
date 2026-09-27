# Feature Specification: Page Familier — calculateur d'XP et ressources les moins chères

**Feature Branch**: `022-pet-xp-calculator`

**Created**: 2026-09-27

**Status**: Draft

**Input**: User description: « Je veux faire une page familier pour qu'on puisse calculer combien il
faut d'xp pour monter le familier au niveau indiqué, prendre en compte le niveau du familier actuel
et indiquer les meilleures ressources à utiliser pour payer le moins cher possible. » Données de
référence fournies par le porteur du projet : le tableau d'XP familier et le tableau des ressources
(nom de la ressource / XP donnée / quantité nécessaire) de
https://www.dofustool.com/tableau-xp-familier-dofus/.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Connaître l'XP nécessaire pour atteindre un niveau (Priority: P1)

Le joueur ouvre la page Familier, saisit le niveau actuel de son familier et le niveau qu'il veut
atteindre. La page affiche immédiatement l'XP à donner au familier pour y arriver.

**Why this priority**: c'est le calcul de base ; il est utile seul, même sans aucun prix connu.

**Independent Test**: saisir niveau actuel 1 et niveau cible 100, vérifier que la page affiche
196 158 XP (196 159 − 1).

**Acceptance Scenarios**:

1. **Given** la page Familier ouverte, **When** le joueur saisit niveau actuel 50 et niveau cible 60,
   **Then** la page affiche 3 141 XP (5 023 − 1 882).
2. **Given** niveau actuel 50 et 150 XP déjà gagnés dans ce niveau, **When** le niveau cible est 60,
   **Then** la page affiche 2 991 XP.
3. **Given** un niveau cible inférieur ou égal au niveau actuel, **When** le joueur le saisit,
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

---

### User Story 3 - Comprendre d'où viennent les chiffres (Priority: P2)

Le joueur voit la date et l'âge du prix utilisé pour chaque ressource, sait que les valeurs d'XP
viennent d'un tableau communautaire, et sait combien de ressources du tableau ont été écartées faute
de prix.

**Why this priority**: la constitution exige des recommandations explicables et des données
traçables ; sans ce contexte, un prix très ancien pourrait fausser le conseil sans que le joueur le
sache.

**Independent Test**: vérifier que chaque ligne montre la date de son prix et qu'un texte indique la
source des données d'XP et le nombre de ressources sans prix.

**Acceptance Scenarios**:

1. **Given** une ressource recommandée, **When** le joueur regarde sa ligne, **Then** il voit la date
   du prix utilisé, avec le même signalement des prix anciens que le reste de l'app.
2. **Given** des ressources du tableau sans prix connu, **When** la liste s'affiche, **Then** elles n'y
   figurent pas et la page indique combien ont été écartées.

---

### Edge Cases

- Aucune ressource du tableau n'a de prix connu : la page affiche l'XP nécessaire et un message
  expliquant qu'aucune recommandation n'est possible sans prix, avec un lien vers la saisie de prix.
- XP déjà gagnée dans le niveau supérieure ou égale à l'XP du niveau suivant : la saisie est refusée
  avec un message indiquant le maximum possible pour ce niveau.
- Niveau hors de 1 à 100 ou saisie non numérique : refusée avec un message.
- Ressource du tableau introuvable dans le catalogue de l'app (nom différent, doublon) : elle est
  ignorée ; elle ne doit jamais être rattachée à la mauvaise ressource.
- Ressource dont l'XP donnée est 0 ou la quantité inconnue (« ? », vide) : jamais recommandée.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: L'app MUST proposer une page Familier accessible depuis la navigation principale.
- **FR-002**: Le joueur MUST pouvoir saisir le niveau actuel (1 à 99), l'XP déjà gagnée dans ce
  niveau (facultative, 0 par défaut) et le niveau cible (2 à 100).
- **FR-003**: L'app MUST calculer l'XP nécessaire = XP totale du niveau cible − (XP totale du niveau
  actuel + XP déjà gagnée), à partir de la courbe d'XP familier de référence (niveaux 1 à 100).
- **FR-004**: L'app MUST connaître, pour chaque ressource du tableau de référence, l'XP donnée et la
  quantité nécessaire, et en déduire l'XP par unité (XP donnée ÷ quantité nécessaire).
- **FR-005**: L'app MUST rattacher chaque ressource du tableau à une ressource du catalogue de l'app
  par son nom, sans ambiguïté ; une ressource non rattachée de façon certaine est ignorée.
- **FR-006**: Pour chaque ressource rattachée qui a un prix connu sur le serveur actif et selon le
  mode de prix actif, l'app MUST calculer la quantité à donner (XP nécessaire ÷ XP par unité,
  arrondie à l'unité supérieure) et le coût total (quantité × prix unitaire).
- **FR-007**: L'app MUST afficher les 10 ressources au coût total le plus bas, triées par coût total
  croissant, avec pour chacune : nom, icône, XP par unité, prix unitaire et date de ce prix,
  quantité et coût total.
- **FR-008**: L'app MUST exclure les ressources sans prix connu et indiquer leur nombre.
- **FR-009**: L'app MUST indiquer la source des données d'XP (tableau communautaire de
  dofustool.com) et que ces valeurs peuvent être incomplètes.
- **FR-010**: Les résultats MUST se recalculer dès qu'un niveau, l'XP saisie, le serveur ou le mode
  de prix change.
- **FR-011**: L'app MUST conserver sur l'appareil les derniers niveaux saisis pour les retrouver à la
  prochaine visite.

### Key Entities

- **Courbe d'XP familier**: pour chaque niveau de 1 à 100, l'XP totale cumulée nécessaire pour
  l'atteindre (1 au niveau 1, 196 159 au niveau 100). Donnée fixe, avec sa source.
- **Ressource nourrissante**: une ressource du tableau de référence : nom, XP donnée, quantité
  nécessaire, XP par unité dérivée, et la ressource du catalogue à laquelle elle est rattachée.
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

- La courbe d'XP et le tableau des ressources de dofustool.com s'appliquent à la version actuelle
  du jeu ; ce sont des données communautaires, figées dans l'app avec leur source et leur date de
  relevé, et mises à jour à la main si besoin.
- Nourrir avec une seule ressource suffit : le coût étant proportionnel à la quantité, la ressource
  au coût par point d'XP le plus bas est la moins chère ; mélanger plusieurs ressources n'est pas
  proposé.
- Les prix utilisés sont ceux de l'app (prix saisis ou communautaires selon le mode actif, sur le
  serveur actif), comme sur la page Recherche ; aucune source de prix nouvelle n'est ajoutée.
- Les croquettes et autres aliments achetés en boutique (Kolizétons, Pépites) ne sont pas traités
  différemment : ils ne sont recommandés que s'ils ont un prix HDV connu comme toute ressource.
- Les bonus de caractéristiques gagnés par le familier selon son niveau sont hors périmètre.
