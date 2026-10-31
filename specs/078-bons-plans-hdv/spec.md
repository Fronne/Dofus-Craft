# Feature Specification: Bons plans HDV

**Feature Branch**: `078-bons-plans-hdv`

**Created**: 2026-10-31

**Status**: Draft

**Input**: User description: "Repérer les « bons plans » de l'hôtel des ventes : les équipements en vente dont le prix est bien en dessous de celui d'exemplaires au jet identique ou très proche, avec une mise en évidence sur les annonces et une page récapitulative."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Voir qu'une annonce est un bon plan (Priority: P1)

Un joueur consulte un équipement dont plusieurs exemplaires sont en vente à l'HDV, chacun avec son propre jet et son propre prix. Les exemplaires nettement moins chers que les exemplaires de jet comparable portent une pastille « Bon plan », avec l'économie réalisée.

**Why this priority**: c'est le cœur de la demande : savoir d'un coup d'œil quelle annonce est une affaire, sans comparer les jets à la main.

**Independent Test**: avec un objet dont les annonces sont connues (plusieurs exemplaires de jets proches, un seul bien moins cher), l'annonce la moins chère porte la pastille et les autres non.

**Acceptance Scenarios**:

1. **Given** un objet avec des exemplaires de jet proche vendus autour de 1 000 000 k et un exemplaire à 700 000 k, **When** le joueur consulte l'objet, **Then** l'exemplaire à 700 000 k porte la pastille « Bon plan » et l'économie (–30 %, 300 000 k).
2. **Given** un exemplaire moins cher de seulement 10 % que les exemplaires comparables, **When** le joueur consulte l'objet, **Then** il ne porte aucune pastille.
3. **Given** un exemplaire au jet bien meilleur que les autres mais au même prix, **When** le joueur consulte l'objet, **Then** il est signalé comme bon plan, car il vaut plus pour le même prix.
4. **Given** un exemplaire sans aucun exemplaire de jet comparable en vente, **When** le joueur consulte l'objet, **Then** il n'est pas signalé : il n'y a rien à comparer.

---

### User Story 2 - Parcourir tous les bons plans (Priority: P1)

Une page « Bons plans » rassemble toutes les annonces repérées, tous objets confondus, pour le serveur choisi. Le joueur les trie par économie en kamas ou en pourcentage et filtre par exo ou par jet.

**Why this priority**: c'est le récapitulatif demandé ; il évite d'ouvrir les objets un par un.

**Independent Test**: avec plusieurs bons plans connus sur deux serveurs, la page n'affiche que ceux du serveur choisi, triés comme demandé, et les filtres retirent les annonces non concernées.

**Acceptance Scenarios**:

1. **Given** des bons plans sur plusieurs objets, **When** le joueur ouvre la page, **Then** il les voit tous, les plus grosses économies d'abord.
2. **Given** la page ouverte, **When** le joueur change le tri (kamas ↔ pourcentage), **Then** l'ordre change en conséquence.
3. **Given** la page ouverte, **When** le joueur filtre « exo uniquement », **Then** seules les annonces d'objets à exo restent.
4. **Given** la page ouverte, **When** le joueur choisit un autre serveur, **Then** seuls les bons plans de ce serveur s'affichent.
5. **Given** aucun bon plan en cours, **When** le joueur ouvre la page, **Then** un message clair l'indique.

---

### User Story 3 - Des bons plans toujours frais (Priority: P2)

Les annonces disparaissent de l'HDV quand elles sont vendues. Une annonce que personne n'a revue depuis plus de 24 h n'est plus proposée comme bon plan.

**Why this priority**: sans cela, la page se remplirait d'affaires déjà vendues et perdrait sa valeur.

**Independent Test**: une annonce vue il y a 25 h n'apparaît ni sur l'objet ni sur la page ; la même annonce revue à l'instant réapparaît.

**Acceptance Scenarios**:

1. **Given** une annonce bon plan vue il y a 23 h, **When** le joueur consulte la page, **Then** elle y est.
2. **Given** la même annonce non revue depuis 25 h, **When** le joueur consulte la page, **Then** elle n'y est plus.
3. **Given** une annonce qui n'apparaît plus dans l'HDV lors d'un nouveau relevé de l'objet, **When** le relevé est reçu, **Then** elle cesse d'être proposée sans attendre 24 h.

---

### User Story 4 - Régler le seuil (Priority: P3)

L'administrateur règle le pourcentage d'écart à partir duquel une annonce est un bon plan. Sa valeur par défaut est 25 %.

**Why this priority**: 25 % est une valeur de départ ; la régler sans modifier l'application permet d'ajuster selon l'expérience.

**Independent Test**: passer le seuil de 25 % à 40 % retire des bons plans les annonces dont l'économie est comprise entre 25 et 40 %.

**Acceptance Scenarios**:

1. **Given** le seuil par défaut, **When** aucun réglage n'a été fait, **Then** une annonce est un bon plan à partir de 25 % d'économie.
2. **Given** un seuil changé à 40 %, **When** le joueur consulte la page, **Then** seules les annonces à 40 % d'économie ou plus restent.

---

### Edge Cases

- Un seul exemplaire en vente pour un objet : aucune comparaison possible, pas de bon plan.
- Annonce au prix aberrant (erreur de saisie, prix quasi nul) : elle ne doit pas servir de référence aux autres ni les faire passer pour chers.
- Exemplaires de jets très différents : seuls les jets proches se comparent ; deux exemplaires lointains ne se jugent pas l'un par rapport à l'autre.
- Stats de valeur différente : un point sur une stat rare ou précieuse pèse plus qu'un point sur une stat courante.
- Exo : un objet portant une stat que son jet normal ne contient pas vaut davantage qu'un objet sans exo, à jet de base égal.
- Un exemplaire vendu entre deux relevés : il disparaît au relevé suivant.
- Données de jets absentes (ancien client, relevé incomplet) : l'annonce est ignorée pour les bons plans, sans erreur visible.
- Relevé reçu par plusieurs joueurs pour le même exemplaire : une seule annonce, pas de doublon.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Le système MUST enregistrer, pour les équipements en vente à l'HDV, chaque exemplaire individuellement avec son prix, son serveur, ses lignes de jet (effet et valeur) et la date à laquelle il a été vu pour la dernière fois.
- **FR-002**: Le système MUST comparer chaque exemplaire à ceux du même objet sur le même serveur dont le jet est identique ou très proche, et non à une égalité stricte.
- **FR-003**: La comparaison de jets MUST pondérer chaque stat selon sa valeur : un écart sur une stat précieuse compte plus qu'un écart sur une stat courante.
- **FR-004**: Un exo (stat absente du jet normal de l'objet) MUST compter comme une valeur ajoutée dans la comparaison.
- **FR-005**: Un exemplaire MUST être marqué « bon plan » quand son prix est inférieur d'au moins le seuil (25 % par défaut) à la référence d'exemplaires de jet comparable.
- **FR-006**: Un exemplaire de meilleur jet que ses comparables, vendu au même prix ou à peine plus cher, MUST pouvoir être marqué bon plan : la comparaison porte sur la valeur du jet, pas seulement sur le prix.
- **FR-007**: Un exemplaire sans comparable suffisant MUST NOT être marqué ; un prix aberrant MUST NOT servir de référence.
- **FR-008**: Le système MUST afficher une pastille « Bon plan » sur les annonces marquées, avec l'économie en kamas et en pourcentage, dans une liste « Annonces à l'HDV » sur la fiche d'un équipement.
- **FR-009**: Le système MUST proposer une page « Bons plans » listant toutes les annonces marquées du serveur choisi.
- **FR-010**: La page MUST permettre le tri par économie en kamas et par économie en pourcentage, et le filtrage par exo (« exo uniquement »), par jet (choix d'une stat : seules les annonces qui la portent restent) et par serveur.
- **FR-011**: Le système MUST ne proposer que les annonces revues depuis moins de 24 h, et MUST retirer dès le relevé suivant celles qui ne sont plus en vente.
- **FR-012**: Le seuil MUST être réglable par l'administrateur, 25 % par défaut.
- **FR-013**: Le client de relevé des prix MUST envoyer les exemplaires avec leurs jets (aujourd'hui il n'envoie que le prix le moins cher) : dépendance externe à ce dépôt, décrite dans les hypothèses.
- **FR-014**: Les envois existants de prix par lot MUST continuer de fonctionner sans changement pour les clients qui n'envoient pas les jets.

### Key Entities

- **Annonce d'équipement**: un exemplaire en vente ; objet, serveur, prix demandé, lignes de jet, date de dernière observation.
- **Ligne de jet**: un effet et sa valeur sur un exemplaire ; peut être un exo.
- **Bon plan**: une annonce dont le prix est au moins au seuil sous la référence de jets comparables ; porte son économie en kamas et en pourcentage.
- **Réglage de seuil**: pourcentage d'écart à partir duquel une annonce est un bon plan, 25 % par défaut.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un joueur repère les bons plans d'un objet en moins de 5 secondes, sans comparer les jets à la main.
- **SC-002**: Sur un jeu d'annonces de test connu, 100 % des exemplaires à 25 % ou plus sous leurs comparables sont marqués, et aucun exemplaire sans comparable ne l'est.
- **SC-003**: La page « Bons plans » affiche tous les bons plans d'un serveur en moins de 2 secondes.
- **SC-004**: Aucune annonce non revue depuis plus de 24 h n'apparaît parmi les bons plans.
- **SC-005**: Changer le seuil modifie la liste des bons plans au prochain affichage, sans nouvelle livraison de l'application.

## Assumptions

- « Équipement » couvre les objets dont chaque exemplaire a son propre jet ; les ressources, vendues par lots au même prix, sont hors périmètre.
- Les bons plans sont calculés par serveur, jamais d'un serveur à l'autre.
- Le seuil de 25 % est une valeur de départ, appliquée à tous les joueurs.
- « Jet très proche » signifie que la valeur pondérée des deux jets diffère peu ; la règle exacte de proximité et les poids des stats sont fixés au plan, à partir des données de jets disponibles.
- Le client de relevé (dépôt séparé `SniffSniffSquared`, dossier `sniffer`, en Rust) décode déjà une offre par exemplaire avec identifiant d'annonce et lignes de jet, mais n'envoie que le prix le moins cher. Le faire envoyer les exemplaires est une dépendance : la spec décrit ce qui doit être reçu, le changement du client est livré à part.
- Seuls les clients de relevé des amis envoient ces données ; sans relevé récent, il n'y a pas de bon plan, et la page l'indique.
- Les annonces sont conservées tant qu'elles sont fraîches (24 h) puis purgées ; aucun historique des bons plans n'est gardé.
- Pas d'alerte ni de notification dans cette version.
