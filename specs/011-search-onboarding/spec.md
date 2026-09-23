# Feature Specification: Onboarding de la page Recherche

**Feature Branch**: `011-search-onboarding`

**Created**: 2026-09-23

**Status**: Draft

## Clarifications

### Session 2026-09-23

- Q: Quel format pour l'onboarding ? → A: Visite guidée qui met en surbrillance chaque zone de la page, avec une bulle d'explication (FR-002).
- Q: Dans quel ordre présenter les étapes ? → A: Recherche, Prix HDV, Crafter ou acheter, fiche de l'objet, prix des ressources, mode de prix (FR-003, révisé après une première implémentation).
- Q: Les bulles sont lourdes à lire, quel format ? → A: Une phrase courte + une liste courte de termes de la page en gras avec quelques mots d'explication (FR-004).

**Input**: User description: "Ajouter un petit onboarding sur la page Recherche pour expliquer le fonctionnement de la page aux joueurs (recherche d'un objet, saisie des prix des ressources, prix HDV, comparaison craft vs achat, mode communautaire/personnel, dernière mise à jour et contributions)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Découvrir la page à la première visite (Priority: P1)

Un joueur qui arrive pour la première fois sur la page Recherche ne sait pas comment elle
fonctionne. Un court onboarding lui présente, dans l'ordre d'usage, les éléments clés de la page :
chercher un objet, lire sa recette, renseigner le prix des ressources, renseigner le prix HDV, puis
lire la recommandation (crafter ou acheter).

**Why this priority**: c'est la valeur principale de la fonctionnalité — sans elle, un nouveau
joueur du groupe ne comprend pas à quoi sert la page ni dans quel ordre la remplir.

**Independent Test**: ouvrir la page Recherche sur un appareil qui ne l'a jamais visitée, vérifier
que l'onboarding s'affiche, le parcourir jusqu'au bout, et vérifier qu'il explique chaque étape.

**Acceptance Scenarios**:

1. **Given** un joueur qui n'a jamais vu l'onboarding sur cet appareil, **When** il ouvre la page
   Recherche, **Then** l'onboarding s'affiche automatiquement à sa première étape.
2. **Given** l'onboarding affiché, **When** le joueur passe à l'étape suivante ou revient à la
   précédente, **Then** l'étape correspondante s'affiche et indique sa position (ex. « 2 / 6 »).
3. **Given** l'onboarding affiché, **When** le joueur le termine ou le ferme à n'importe quelle
   étape, **Then** il disparaît et ne se réaffiche plus automatiquement sur cet appareil.
4. **Given** l'onboarding affiché, **When** le joueur appuie sur Échap, **Then** l'onboarding se
   ferme comme s'il avait cliqué sur « Passer ».

---

### User Story 2 - Revoir l'onboarding à la demande (Priority: P2)

Un joueur qui a fermé l'onboarding trop vite, ou qui a oublié une explication, peut le relancer
depuis la page Recherche.

**Why this priority**: sans relance possible, un « Passer » accidentel fait perdre l'explication
pour de bon.

**Independent Test**: après avoir fermé l'onboarding, cliquer sur le bouton d'aide de la page
Recherche et vérifier que l'onboarding redémarre à la première étape.

**Acceptance Scenarios**:

1. **Given** un joueur ayant déjà vu ou fermé l'onboarding, **When** il clique sur le bouton d'aide
   de la page Recherche, **Then** l'onboarding redémarre à sa première étape.

---

### User Story 3 - Comprendre les informations de prix affichées (Priority: P3)

L'onboarding explique aussi les informations secondaires affichées sous chaque ressource et le choix
du mode de prix : ce que signifient « Dernière mise à jour », le nombre de contributions, le
surlignage d'un prix ancien, et la différence entre Mode communautaire (prix partagés par le groupe)
et Mode personnel (prix gardés uniquement sur l'appareil).

**Why this priority**: utile pour faire confiance aux prix, mais un joueur peut déjà utiliser la
page sans ces détails.

**Independent Test**: parcourir l'onboarding et vérifier qu'une étape couvre ces informations.

**Acceptance Scenarios**:

1. **Given** l'onboarding en cours, **When** le joueur atteint l'étape sur les prix des ressources,
   **Then** elle explique « Dernière mise à jour », le nombre de contributions et le surlignage d'un
   prix ancien.
2. **Given** l'onboarding en cours, **When** le joueur atteint l'étape sur le mode de prix, **Then**
   elle explique la différence entre Mode communautaire et Mode personnel.

---

### Edge Cases

- La page n'a encore aucun objet sélectionné : les éléments liés à un objet (recette, prix des
  ressources, prix HDV, recommandation) ne sont pas visibles. L'onboarding doit rester
  compréhensible dans ce cas au lieu d'afficher une étape vide ou pointant vers rien.
- Le stockage local de l'appareil est indisponible (navigation privée, stockage bloqué) :
  l'onboarding peut se réafficher à chaque visite, mais la page doit rester utilisable et
  l'onboarding toujours fermable.
- Écran de téléphone : chaque étape doit rester lisible sans défilement horizontal et ses boutons
  accessibles.
- Le joueur navigue vers une autre page pendant l'onboarding : l'onboarding se ferme sans bloquer la
  navigation.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La page Recherche MUST afficher automatiquement l'onboarding à la première visite d'un
  appareil, et plus ensuite une fois qu'il a été terminé ou fermé.
- **FR-002**: L'onboarding MUST se présenter sous forme de visite guidée : chaque étape met en
  surbrillance la zone de la page qu'elle explique, assombrit le reste de la page, et affiche à côté
  une bulle d'explication.
- **FR-003**: L'onboarding MUST couvrir, dans cet ordre : (1) la recherche et les filtres d'objets,
  (2) le prix HDV, (3) la recommandation crafter/acheter et le coût de craft (y compris la mention
  « partiel »), (4) la fiche de l'objet et sa recette, (5) la saisie des prix des ressources, avec la
  signification de « Dernière mise à jour », du nombre de contributions et du surlignage d'un prix
  ancien, (6) le mode de prix communautaire/personnel.
- **FR-004**: Chaque étape MUST tenir en un titre court, une seule phrase courte et au plus trois
  puces « terme de la page : explication de quelques mots ».
- **FR-005**: Le joueur MUST pouvoir passer à l'étape suivante, revenir à la précédente, et quitter
  l'onboarding à tout moment (bouton « Passer » et touche Échap).
- **FR-006**: Chaque étape MUST indiquer sa position dans l'onboarding (ex. « 3 / 6 »).
- **FR-007**: La page Recherche MUST proposer un bouton d'aide toujours visible qui relance
  l'onboarding depuis la première étape.
- **FR-008**: Quand la zone d'une étape n'est pas affichée (par exemple aucun objet sélectionné, donc
  pas de prix des ressources ni de prix HDV), l'étape MUST s'afficher quand même sous forme de bulle
  centrée, sans surbrillance, en précisant que cette zone apparaît après avoir choisi un objet.
  L'onboarding MUST NOT sélectionner un objet à la place du joueur.
- **FR-009**: L'onboarding MUST NOT modifier les données de la page : recherche, prix saisis, prix
  HDV, carnet et contributions communautaires restent inchangés à l'ouverture, pendant et après
  l'onboarding.
- **FR-010**: Le fait d'avoir vu l'onboarding MUST être mémorisé uniquement sur l'appareil, sans
  aucune donnée envoyée au serveur.
- **FR-011**: L'onboarding MUST être utilisable au clavier et lisible sur un écran de téléphone.
- **FR-012**: Les textes de l'onboarding MUST être en français et utiliser les mêmes libellés que la
  page (« Prix HDV », « Prix des ressources », « Mode communautaire », « Mode personnel »,
  « Dernière mise à jour »).

### Key Entities

- **Étape d'onboarding**: titre, texte explicatif court, zone de la page concernée, position dans la
  séquence.
- **État « onboarding vu »**: indicateur local à l'appareil indiquant que le joueur a terminé ou
  fermé l'onboarding.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un nouveau joueur peut parcourir tout l'onboarding en moins d'une minute.
- **SC-002**: Après l'onboarding, un nouveau joueur du groupe sait obtenir une recommandation
  crafter/acheter pour un objet sans aide extérieure.
- **SC-003**: Un joueur qui a fermé l'onboarding ne le revoit jamais automatiquement sur le même
  appareil, et peut le relancer en un clic.
- **SC-004**: Aucune donnée de prix ni de recherche n'est modifiée par l'onboarding.

## Assumptions

- Le public est le petit groupe fermé de joueurs de l'application (une dizaine à une vingtaine) ;
  aucun suivi d'usage de l'onboarding n'est nécessaire.
- « Première visite » est évaluée par appareil et navigateur, pas par joueur (il n'y a pas de
  compte).
- Le mode de prix se choisit dans la page Paramètres, pas sur la page Recherche : l'étape sur le
  mode de prix n'a donc pas de zone à mettre en surbrillance et s'affiche en bulle centrée (FR-008),
  en indiquant le mode actuellement actif et où le changer.
- Les autres pages (collections épinglées, etc.) sont hors du périmètre.
- Un joueur existant verra aussi l'onboarding une fois après le déploiement, puisqu'il ne l'a
  jamais fermé.
