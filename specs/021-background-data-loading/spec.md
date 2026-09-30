# Feature Specification: Chargement des données en fond et cache persistant

**Feature Branch**: `021-background-data-loading`

**Created**: 2026-09-26

**Status**: Draft

**Input**: User description: « Pour les appels API et Cloudflare pour le chargement des données des
différentes pages, voir pour les charger en fond à l'ouverture du site si ce n'est pas déjà le cas,
ou proposer une solution plus efficace. » Choix du porteur du projet parmi les pistes proposées :
1) garder le catalogue du jeu dans le navigateur d'une visite à l'autre ; 2) préparer la liste de la
page Prix en fond dès l'ouverture du site ; 3) regrouper les lectures de prix communautaires et les
mettre brièvement en cache côté service partagé.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Catalogue disponible tout de suite dès la deuxième visite (Priority: P1)

Le joueur revient sur le site (nouvel onglet, rechargement, lendemain). La recherche d'objets, les
fiches d'objets et leurs recettes s'affichent immédiatement, sans attendre de téléchargement,
parce que le catalogue du jeu obtenu lors d'une visite précédente a été gardé sur l'appareil.

**Why this priority**: c'est le plus gros gain. Aujourd'hui le catalogue complet est retéléchargé à
chaque ouverture du site alors qu'il ne change presque jamais.

**Independent Test**: ouvrir le site une première fois, attendre que le catalogue soit prêt,
recharger la page hors connexion à la source du catalogue : la recherche, les fiches et les recettes
déjà consultées s'affichent quand même, sans indicateur de chargement.

**Acceptance Scenarios**:

1. **Given** un catalogue déjà obtenu lors d'une visite précédente, **When** le joueur rouvre le
   site, **Then** la recherche porte sur le catalogue complet dès l'affichage, sans nouveau
   téléchargement.
2. **Given** une fiche d'objet ou une recette déjà consultée, **When** le joueur la rouvre lors
   d'une visite ultérieure, **Then** elle s'affiche sans requête vers la source du catalogue.
3. **Given** un catalogue gardé depuis plus longtemps que la durée de fraîcheur, **When** le joueur
   ouvre le site, **Then** le catalogue gardé est affiché tout de suite et une mise à jour est
   récupérée en fond ; elle est utilisée à partir de l'affichage suivant (navigation ou recherche),
   sans faire clignoter la page en cours.
4. **Given** la source du catalogue injoignable, **When** le joueur ouvre le site avec un catalogue
   gardé, **Then** le site fonctionne avec ce catalogue, sans message d'erreur bloquant.
5. **Given** une première visite (rien de gardé), **When** le joueur ouvre le site, **Then** le
   comportement est celui d'aujourd'hui (chargement dès l'ouverture).

---

### User Story 2 - Page Prix déjà prête à l'arrivée (Priority: P2)

Le joueur ouvre le site sur n'importe quelle page. Pendant qu'il navigue, la liste de la page Prix
est préparée en fond pour le serveur et le mode de prix actifs. Quand il ouvre la page Prix, la liste
est déjà affichée, sans « Calcul en cours ».

**Why this priority**: la page Prix est la plus lente à remplir (un calcul par objet), mais elle
dépend du catalogue : elle profite pleinement de la User Story 1.

**Independent Test**: ouvrir le site sur l'Accueil, attendre quelques secondes sans interagir, puis
ouvrir la page Prix : la liste complète s'affiche immédiatement et correspond à celle obtenue en
ouvrant la page directement.

**Acceptance Scenarios**:

1. **Given** le site ouvert depuis quelques secondes sur une autre page, **When** le joueur ouvre la
   page Prix, **Then** la liste s'affiche aussitôt, identique à un calcul fait à l'ouverture de la
   page.
2. **Given** une préparation en fond en cours, **When** le joueur ouvre la page Prix, **Then** la
   page reprend ce calcul (progression affichée) au lieu d'en recommencer un.
3. **Given** le joueur qui change de serveur ou de mode de prix, **When** il ouvre ensuite la page
   Prix, **Then** la liste correspond au nouveau serveur et au nouveau mode.
4. **Given** le joueur qui saisit ou recherche pendant la préparation, **When** celle-ci tourne,
   **Then** l'interface reste fluide : la préparation ne démarre que quand le site est inactif et
   n'envoie pas plus de 2 requêtes simultanées tant que le joueur n'est pas sur la page Prix.

---

### User Story 3 - Prix communautaires chargés d'un coup (Priority: P3)

Quand une recette s'affiche en mode communautaire, les prix partagés de toutes ses ressources
arrivent ensemble, en une seule fois, au lieu de se remplir ressource par ressource. Les lectures
répétées sur une courte période ne sollicitent pas à nouveau la base partagée.

**Why this priority**: gain de confort et réduction de la charge du service partagé ; l'effet visible
est plus modeste que les deux premières histoires.

**Independent Test**: ouvrir un objet à 8 ressources en mode communautaire et constater une seule
demande de prix partagés pour les 8 ressources, avec des valeurs identiques à celles d'aujourd'hui.

**Acceptance Scenarios**:

1. **Given** une recette de N ressources en mode communautaire, **When** elle s'affiche, **Then** les
   prix partagés des N ressources sont obtenus en une seule demande.
2. **Given** un prix partagé que le joueur vient lui-même d'envoyer, **When** l'affichage se met à
   jour, **Then** le joueur voit la nouvelle valeur (sa contribution n'est pas masquée par le cache).
3. **Given** plusieurs joueurs lisant les mêmes prix dans la même minute, **When** ils les demandent,
   **Then** le service partagé ne relit pas la base à chaque demande.
4. **Given** le service partagé injoignable, **When** une recette s'affiche, **Then** le comportement
   est celui d'aujourd'hui (prix communautaires indisponibles, le reste de la page fonctionne).

### Edge Cases

- Catalogue gardé d'une ancienne version de l'application (format différent) : il est ignoré et
  retéléchargé, sans erreur.
- Espace de stockage du navigateur indisponible (navigation privée, stockage plein ou refusé) : le
  site fonctionne comme aujourd'hui, en mémoire seulement.
- Préparation en fond interrompue (fermeture de l'onglet, perte de réseau) : rien de partiel n'est
  gardé comme liste « terminée » ; la page Prix recalcule normalement.
- Aucun prix HDV connu en mode personnel : la préparation en fond se termine sans travail inutile.
- Plus d'une centaine de ressources demandées d'un coup : la demande regroupée est découpée si
  nécessaire, sans perte de valeur.
- Contribution envoyée par un autre joueur dans la dernière minute : elle peut apparaître avec au
  plus environ une minute de retard, ce qui est acceptable.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Le site DOIT garder sur l'appareil, d'une visite à l'autre, l'index complet des objets,
  les panoplies, les fiches d'objets et les recettes obtenus depuis la source du catalogue.
- **FR-002**: À l'ouverture du site, les données de catalogue gardées DOIVENT être utilisées
  immédiatement, avant toute requête réseau vers la source du catalogue.
- **FR-003**: Le catalogue gardé DOIT être considéré frais pendant 24 heures ; au-delà, il DOIT
  rester affiché et être mis à jour en fond, l'affichage ne changeant que si les données diffèrent.
- **FR-004**: Les données gardées DOIVENT porter une version de format ; des données d'une version
  incompatible DOIVENT être ignorées et remplacées.
- **FR-005**: En l'absence de stockage utilisable, le site DOIT fonctionner comme aujourd'hui.
- **FR-006**: Après l'ouverture du site, et seulement quand le site est inactif et le catalogue
  prêt, la liste de la page Prix DOIT être préparée en fond pour le serveur et le mode de prix actifs.
- **FR-007**: La page Prix DOIT afficher la liste préparée en fond si elle existe, ou reprendre la
  préparation en cours, sans lancer de second calcul identique.
- **FR-008**: La liste préparée en fond DOIT être identique à celle calculée à l'ouverture de la
  page (mêmes règles que la spec 019).
- **FR-009**: Un changement de serveur ou de mode de prix DOIT invalider la liste préparée pour
  l'ancien contexte.
- **FR-010**: Le service partagé DOIT permettre d'obtenir en une seule demande les prix
  communautaires de plusieurs ressources d'un même serveur, avec les mêmes valeurs (médiane,
  nombre, date) que la lecture ressource par ressource.
- **FR-011**: L'affichage d'une recette en mode communautaire DOIT utiliser cette demande regroupée.
- **FR-012**: Les réponses de lecture du service partagé (prix communautaires, prix des objets,
  historique) PEUVENT être servies depuis un cache d'au plus 60 secondes.
- **FR-013**: Une contribution envoyée par le joueur (prix d'une ressource ou prix HDV d'un objet)
  DOIT être visible pour lui immédiatement après l'envoi, sur la page où il l'a saisie comme sur la
  page Prix, sans attendre l'expiration du cache.
- **FR-014**: Les préférences et les prix saisis par le joueur ne DOIVENT pas être affectés par cette
  fonctionnalité ; seules des données publiques (catalogue, prix partagés) sont mises en cache.

### Key Entities

- **Catalogue gardé**: copie locale des données publiques du jeu (index des objets, panoplies,
  fiches, recettes), avec sa date d'obtention et sa version de format.
- **Liste Prix préparée**: résultat du calcul de la page Prix pour un couple (serveur, mode de
  prix), valable pour la visite en cours.
- **Lot de prix communautaires**: ensemble des prix partagés (médiane, nombre, date) d'une liste de
  ressources sur un serveur.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Dès la deuxième visite, la recherche sur le catalogue complet est utilisable en moins
  d'une seconde après l'ouverture du site.
- **SC-002**: Sur une visite où le catalogue gardé est frais, aucune requête n'est envoyée à la
  source du catalogue pour les objets déjà consultés.
- **SC-003**: En ouvrant la page Prix après au moins 10 secondes sur le site, la liste complète est
  affichée en moins d'une seconde.
- **SC-004**: L'affichage d'une recette en mode communautaire fait une seule demande de prix partagés
  quel que soit le nombre de ressources.
- **SC-005**: Aucune régression : les valeurs affichées (catalogue, coûts, bénéfices, prix partagés)
  sont identiques à celles d'avant la fonctionnalité.

## Assumptions

- Le catalogue DofusDB change très rarement (environ toutes les deux semaines) : une fraîcheur de
  24 heures avec mise à jour en fond est largement suffisante.
- Le public est un petit groupe fermé (10 à 20 joueurs) : un retard d'au plus une minute sur les
  contributions des autres joueurs est acceptable.
- La liste Prix préparée n'est pas gardée d'une visite à l'autre (comme aujourd'hui, spec 019) : une
  vieille liste affichée après un rechargement pourrait induire en erreur.
- La lecture ressource par ressource existante reste disponible pour la compatibilité.
- La saisie de prix, le mode personnel et les pages non citées ne changent pas de comportement.

## Révision (2026-09-30) : origine du dernier prix (specs/025-rune-purchase-import)

Chaque entrée de `GET /community-prices` gagne le champ optionnel `latestOrigin` (`manual`, `capture`
ou `bot`), l'origine de la contribution la plus récente. Le site le lit sans l'exiger : absent, il
vaut `manual`. Rien d'autre ne change dans la réponse.
