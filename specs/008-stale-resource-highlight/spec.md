# Feature Specification: Mise en évidence des prix de ressources obsolètes

**Feature Branch**: `008-stale-resource-highlight`

**Created**: 2026-09-21

**Status**: Draft

**Input**: User description: "Mettre en évidence les ressources qui n'ont pas été mises à jour depuis longtemps en affichant leur ligne en orange/rouge"

## Clarifications

### Session 2026-09-21

- Q: Quels seuils d'ancienneté doivent déclencher la coloration orange puis rouge d'une ligne de ressource ? → A: Orange entre 3 et 7 jours, rouge à partir de 7 jours (marché volatil)

### Session 2026-09-21 (résync post-implémentation)

- Retour utilisateur : la mise en évidence ne doit colorer que le texte « Dernière mise à jour :
  ... », pas le fond ni la bordure de toute la ligne (spec et FR-002/FR-003/FR-009 mis à jour en
  conséquence après un premier déploiement trop appuyé visuellement).
- Nouvelle demande : ajouter une indication au survol de la ligne expliquant que le prix affiché
  peut différer du prix en jeu, faute de mise à jour récente (voir User Story 3 ci-dessous).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Repérer un prix de ressource périmé (Priority: P1)

En tant qu'utilisateur qui compare le coût de craft d'un objet, je veux voir immédiatement quelles lignes de ressources ont un prix renseigné il y a longtemps, afin de savoir si je dois vérifier ou remettre ce prix à jour avant de me fier à la comparaison.

**Why this priority**: C'est la valeur centrale de la fonctionnalité : sans ce signal visuel, l'utilisateur peut prendre une décision de craft/achat basée sur un prix ancien sans le savoir.

**Independent Test**: Peut être testé en ouvrant une comparaison contenant une ressource dont le prix a été saisi il y a plus du seuil "ancien" et en vérifiant que son texte « Dernière mise à jour : ... » s'affiche en couleur d'alerte (orange), alors qu'une ressource récemment mise à jour reste affichée normalement.

**Acceptance Scenarios**:

1. **Given** une ressource dont le prix a été mis à jour il y a plus de 3 jours (mais moins de 7), **When** l'utilisateur consulte le tableau de comparaison, **Then** le texte « Dernière mise à jour : ... » de cette ressource s'affiche en orange, indiquant un prix qui commence à dater.
2. **Given** une ressource dont le prix a été mis à jour il y a 7 jours ou plus, **When** l'utilisateur consulte le tableau de comparaison, **Then** le texte « Dernière mise à jour : ... » de cette ressource s'affiche en rouge, indiquant un prix très probablement obsolète.
3. **Given** une ressource dont le prix a été mis à jour récemment (moins de 3 jours), **When** l'utilisateur consulte le tableau, **Then** la ligne s'affiche sans coloration d'alerte.

---

### User Story 2 - Comprendre pourquoi une ligne est signalée (Priority: P2)

En tant qu'utilisateur, je veux comprendre pourquoi ce texte est coloré en orange ou rouge, afin de ne pas confondre ce signal avec une erreur ou une autre alerte existante (ex : détection d'anomalie de prix).

**Why this priority**: La lisibilité de l'alerte est nécessaire pour que l'utilisateur agisse correctement (mettre à jour le prix) plutôt que d'ignorer ou de mal interpréter la couleur.

**Independent Test**: Peut être testé en consultant une ressource au prix ancien et en vérifiant que seul le texte « Dernière mise à jour : ... » change de couleur, sans affecter le reste de la ligne.

**Acceptance Scenarios**:

1. **Given** un texte « Dernière mise à jour : ... » coloré en orange ou rouge, **When** l'utilisateur regarde la ligne, **Then** le reste de la ligne (icône, quantité, prix) garde son apparence normale — seul ce texte change de couleur.
2. **Given** une ressource sans aucun prix renseigné, **When** l'utilisateur consulte le tableau, **Then** aucun texte n'est coloré par cette fonctionnalité (l'absence de prix est un état distinct de l'obsolescence d'un prix existant).

---

### User Story 3 - Être averti d'un possible écart avec le prix en jeu (Priority: P2)

En tant qu'utilisateur, je veux qu'un survol de la ligne d'une ressource au prix ancien m'indique explicitement que ce prix peut différer du prix réellement pratiqué en jeu, afin de ne pas me fier aveuglément à un chiffre qui n'est peut-être plus d'actualité.

**Why this priority**: La couleur seule (orange/rouge) signale qu'il faut faire attention, mais ne dit pas explicitement *pourquoi* ni *quel risque* cela représente ; une explication au survol rend le signal actionnable même pour un utilisateur qui ne connaît pas encore la convention de couleur.

**Independent Test**: Survoler la ligne d'une ressource dont le prix a 3 jours ou plus et vérifier qu'une info-bulle apparaît avec un texte expliquant que le prix peut être différent du prix en jeu ; vérifier qu'aucune info-bulle de ce type n'apparaît pour une ressource au prix récent ou sans prix connu.

**Acceptance Scenarios**:

1. **Given** une ressource dont le prix a 3 jours ou plus (orange ou rouge), **When** l'utilisateur survole sa ligne, **Then** une info-bulle apparaît indiquant que le prix affiché peut être différent du prix actuel en jeu car il n'a pas été mis à jour depuis un certain temps.
2. **Given** une ressource dont le prix a moins de 3 jours, **When** l'utilisateur survole sa ligne, **Then** aucune info-bulle de ce type n'apparaît.
3. **Given** une ressource sans prix connu, **When** l'utilisateur survole sa ligne, **Then** aucune info-bulle de ce type n'apparaît (cohérent avec l'absence de coloration, FR-005).

---

### Edge Cases

- Une ressource sans prix renseigné (`updatedAt` absent) n'est pas traitée comme "ancienne" : elle garde son état actuel (aucun prix connu), distinct de l'alerte d'ancienneté.
- Une ressource dont le prix vient d'être modifié à l'instant repasse immédiatement à l'état normal (non coloré), sans nécessiter de rechargement de page.
- Le seuil s'applique à toutes les lignes de ressources affichées dans les tableaux de comparaison/prix, y compris en mode communautaire, sur la base de la date de dernière mise à jour du prix affiché pour cette ligne.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Le système DOIT calculer l'ancienneté du prix d'une ressource à partir de sa date de dernière mise à jour (`updatedAt`).
- **FR-002**: Le système DOIT afficher le texte « Dernière mise à jour : ... » d'une ressource en orange lorsque le prix a été mis à jour il y a plus de 3 jours et moins de 7 jours.
- **FR-003**: Le système DOIT afficher le texte « Dernière mise à jour : ... » d'une ressource en rouge lorsque le prix a été mis à jour il y a 7 jours ou plus.
- **FR-004**: Le système NE DOIT PAS colorer ce texte pour une ressource dont le prix a été mis à jour il y a moins de 3 jours.
- **FR-005**: Le système NE DOIT PAS appliquer cette coloration à une ressource dont le prix est totalement absent (aucune valeur `updatedAt` connue) : ce cas reste géré par l'affichage existant de "prix manquant".
- **FR-009**: Seul le texte « Dernière mise à jour : ... » change de couleur ; le reste de la ligne (icône, quantité, montant) garde son apparence habituelle, pour un signal ciblé plutôt qu'une ligne entière mise en évidence.
- **FR-006**: L'information textuelle existante de dernière mise à jour ("Dernière mise à jour : ...") DOIT rester visible et lisible une fois colorée.
- **FR-007**: La mise en évidence DOIT se recalculer sans intervention manuelle chaque fois que le prix d'une ressource change (ex : après une saisie ou une synchronisation communautaire).
- **FR-008**: La coloration DOIT rester visuellement distincte des autres indicateurs déjà existants dans le tableau (ex : indicateur d'anomalie de prix communautaire), pour éviter toute confusion entre "prix ancien" et "prix suspect".
- **FR-010**: Le système DOIT afficher, uniquement au survol à la souris du texte « Dernière mise à jour : ... » d'une ressource dont le prix a 3 jours ou plus (pas au survol du reste de la ligne, pas au focus clavier), une info-bulle stylisée selon le design de l'application (et non l'info-bulle par défaut du navigateur), avec un texte expliquant que le prix affiché peut être différent du prix actuellement pratiqué en jeu car il n'a pas été mis à jour récemment.
- **FR-011**: Le système NE DOIT PAS afficher cette info-bulle pour une ressource au prix récent (< 3 jours) ou sans prix connu (mêmes conditions que FR-004/FR-005).

### Key Entities

- **ResourcePrice**: Prix unitaire d'une ressource et date de sa dernière mise à jour (`updatedAt`). C'est l'attribut central utilisé pour déterminer l'ancienneté à afficher.
- **Seuil d'ancienneté**: Deux paliers de temps (3 jours, 7 jours) qui déterminent l'état visuel d'une ligne (normal / orange / rouge).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un utilisateur peut identifier visuellement, en moins de 3 secondes, toutes les ressources dont le prix a 7 jours ou plus dans un tableau de comparaison.
- **SC-002**: 100% des lignes de ressources dont le prix a un `updatedAt` connu affichent une coloration cohérente avec leur ancienneté réelle (normal / orange / rouge) selon les seuils définis.
- **SC-003**: Aucune ligne sans prix connu n'est faussement signalée comme "ancienne".

## Assumptions

- Seuils retenus (validés en clarification) : orange entre 3 et 7 jours d'ancienneté, rouge à partir de 7 jours, adaptés à un marché de ressources considéré comme volatil.
- La coloration s'applique aux tableaux existants qui affichent déjà `updatedAt` par ligne de ressource (comparaison de craft, saisie de prix), sans introduire de nouvel écran.
- Cette fonctionnalité est purement visuelle/informative : elle ne bloque aucune action (craft, achat, saisie) et ne modifie pas les calculs de comparaison existants.
- Le mode communautaire et le mode personnel utilisent la même logique d'ancienneté, basée sur le `updatedAt` du prix réellement affiché pour l'utilisateur.
