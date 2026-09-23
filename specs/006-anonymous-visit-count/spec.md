# Feature Specification: Comptage anonyme des visites

**Feature Branch**: `006-anonymous-visit-count`

**Created**: 2026-09-18

**Status**: Draft

**Input**: User description: "Compter le nombre de joueurs uniques utilisant l'application, y
compris en Mode personnel. Le Web Analytics Cloudflare déjà installé est peu fiable (bloqué par Do
Not Track et les bloqueurs de publicité, sous-estime fortement le vrai nombre de joueurs). Solution :
au chargement de l'application, un identifiant d'appareil anonyme (généré et conservé localement,
distinct de celui utilisé pour les contributions de prix communautaires) est envoyé une fois par jour
à un nouvel endpoint du Worker Cloudflare déjà existant (même base D1 que
specs/004-community-price-sharing), qui enregistre une ligne (identifiant d'appareil, date du jour)
sans doublon. Cela permet de calculer le nombre de joueurs uniques sur une période donnée via une
requête D1 manuelle, sans exposer cette donnée publiquement ni l'afficher dans l'application
elle-même. Cette fonctionnalité amende FR-015 de specs/004-community-price-sharing, qui interdisait
jusqu'ici toute transmission de données en Mode personnel : cette interdiction reste valable pour les
données de prix, mais admet désormais cette unique exception, limitée à un signal de présence
anonyme et quotidien, sans aucune donnée de prix ni information permettant d'identifier
personnellement le joueur."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Connaître le nombre réel de joueurs actifs (Priority: P1)

Le mainteneur de l'application veut savoir combien de joueurs distincts l'utilisent réellement sur
une période donnée, y compris ceux qui n'utilisent que le Mode personnel — ce que l'outil
d'analytics déjà en place (Web Analytics Cloudflare) ne mesure que très imparfaitement, car son
signal est fréquemment bloqué par les réglages de vie privée du navigateur (Do Not Track) ou par des
bloqueurs de publicité qui reconnaissent son domaine tiers.

**Why this priority**: Sans cette mesure, il est impossible de savoir si l'application est
réellement utilisée par le petit groupe de joueurs visé, ou d'évaluer l'effet de futurs changements
sur son adoption — une information de base pour la suite du projet.

**Independent Test**: Ouvrir l'application depuis un appareil, consulter les données stockées :
une ligne existe pour cet appareil et la date du jour. Ouvrir l'application une seconde fois le même
jour depuis le même appareil : aucune ligne supplémentaire n'est créée. Ouvrir l'application depuis
un appareil différent : une ligne distincte apparaît, avec un identifiant différent.

**Acceptance Scenarios**:

1. **Given** un appareil qui n'a jamais ouvert l'application, **When** il la charge pour la première
   fois, **Then** un identifiant d'appareil anonyme est généré, conservé localement, et une ligne de
   présence est enregistrée pour cet appareil et la date du jour.
2. **Given** un appareil ayant déjà une ligne de présence enregistrée pour la date du jour, **When**
   il recharge ou rouvre l'application plusieurs fois le même jour, **Then** aucune ligne
   supplémentaire n'est créée pour ce jour et cet appareil.
3. **Given** le lendemain, **When** ce même appareil rouvre l'application, **Then** une nouvelle
   ligne de présence est enregistrée pour cette nouvelle date, distincte de celle de la veille.
4. **Given** deux appareils différents, **When** chacun ouvre l'application, **Then** deux lignes de
   présence distinctes sont enregistrées, avec deux identifiants différents.
5. **Given** un joueur en Mode personnel (aucune donnée de prix jamais transmise), **When** il ouvre
   l'application, **Then** le signal de présence est envoyé normalement, indépendamment du mode de
   prix actif ou de la disponibilité du Mode communautaire.

### Edge Cases

- Un appareil dont les données locales sont effacées (ou un nouvel appareil du même joueur) génère
  un nouvel identifiant : il est compté comme un appareil distinct, sans lien possible avec
  l'historique précédent — une sous-estimation du nombre réel de personnes est possible et assumée,
  au bénéfice de l'anonymat.
- Un ordinateur partagé par plusieurs joueurs ne compte que pour un seul appareil — même limite déjà
  assumée par l'absence de compte utilisateur dans toute l'application.
- Si l'envoi du signal échoue (service indisponible, réseau coupé), le chargement de l'application
  n'est ni bloqué ni ralenti de façon perceptible, et aucune erreur n'est visible pour le joueur.
- Le signal de présence ne contient et ne doit jamais contenir de prix, de ressource, de serveur, ni
  aucune information permettant d'identifier personnellement le joueur.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Le système MUST envoyer, au chargement de l'application, un signal de présence
  anonyme composé uniquement d'un identifiant d'appareil et de la date du jour.
- **FR-002**: Le système MUST générer et conserver localement, sur l'appareil, un identifiant
  aléatoire dédié à ce signal de présence, distinct de l'identifiant d'appareil utilisé pour les
  contributions de prix communautaires (specs/004-community-price-sharing, FR-021), afin que les
  deux mécanismes restent indépendants l'un de l'autre.
- **FR-003**: Ce signal MUST être envoyé indépendamment du mode de prix actif (Mode personnel ou
  Mode communautaire) et indépendamment de la disponibilité du Mode communautaire. Ceci amende
  FR-015 de specs/004-community-price-sharing (« aucune donnée n'est jamais transmise en Mode
  personnel ») : cette interdiction reste pleinement applicable aux données de prix, mais admet
  désormais cette unique exception, strictement limitée à ce signal de présence anonyme.
- **FR-004**: Le système NE DOIT jamais inclure, dans ce signal, une donnée de prix, de ressource,
  de serveur, ou toute information permettant d'identifier personnellement le joueur.
- **FR-005**: Le système MUST éviter d'enregistrer plus d'une fois le même appareil pour une même
  journée, quel que soit le nombre de chargements de l'application ce jour-là.
- **FR-006**: Le système NE DOIT ni afficher cette donnée dans l'application elle-même, ni l'exposer
  via une route accessible publiquement — seule une requête manuelle contre la base de données,
  réservée au mainteneur, permet de la consulter.
- **FR-007**: Un échec d'envoi de ce signal (service indisponible, réseau coupé) NE DOIT jamais
  bloquer ni ralentir de façon perceptible le chargement de l'application, ni produire d'erreur
  visible par le joueur.

### Key Entities *(include if feature involves data)*

- **Signal de présence quotidien**: Association entre un identifiant d'appareil anonyme et une date
  (jour), sans aucune autre donnée. Au plus un enregistrement par appareil et par jour.
- **Identifiant d'appareil (présence)**: Identifiant aléatoire, anonyme, généré et conservé
  localement sur l'appareil, dédié exclusivement à ce signal de présence — distinct de l'identifiant
  d'appareil des contributions de prix communautaires (specs/004).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Dans 100 % des cas testés, le signal de présence est envoyé que le Mode communautaire
  soit actif, inactif, ou temporairement désactivé.
- **SC-002**: Dans 100 % des cas testés, plusieurs chargements de l'application le même jour depuis
  le même appareil ne produisent qu'un seul enregistrement de présence pour ce jour.
- **SC-003**: Dans 100 % des cas testés, aucune donnée de prix ni information identifiant
  personnellement un joueur n'apparaît dans les données de présence stockées.
- **SC-004**: Le nombre de joueurs uniques actifs sur une période donnée peut être obtenu par une
  seule requête simple (compter les identifiants d'appareil distincts sur cette période), sans
  traitement ou agrégation complexe.
- **SC-005**: Dans 100 % des cas testés, une indisponibilité du service d'enregistrement de présence
  n'empêche ni ne retarde perceptiblement l'utilisation normale de l'application.

## Assumptions

- Le public visé reste le même groupe restreint et de confiance déjà documenté dans
  specs/004-community-price-sharing (de l'ordre de 10 à 20 joueurs) — cette fonctionnalité ne change
  pas cette échelle, elle sert seulement à la mesurer plus fidèlement que l'outil d'analytics
  générique déjà en place.
- Aucun compte utilisateur n'est introduit par cette fonctionnalité ; l'identifiant d'appareil reste
  une donnée locale, au même titre que les autres préférences déjà existantes de l'application.
- Cette fonctionnalité ne remplace pas le Web Analytics Cloudflare déjà installé — les deux peuvent
  coexister ; ce signal de présence a vocation à donner un chiffre plus fiable, pas à remplacer
  l'outil existant.
- Le fait qu'un joueur puisse, s'il le souhaite, bloquer ce signal de présence (extension navigateur,
  blocage réseau) n'est pas traité par cette spécification : contrairement au Web Analytics tiers,
  ce signal est envoyé vers le propre domaine de l'application, ce qui réduit mais n'élimine pas
  cette possibilité.
- Les modalités techniques exactes (route du Worker, structure de la table) sont hors périmètre de
  cette spécification et seront définies lors du plan d'implémentation (`/speckit-plan`).

## Révision (2026-09-23)

- Aucune visite n'est enregistrée depuis le serveur de développement ni depuis les tests de bout en
  bout. Ils pointaient vers la base de production et chaque session de test comptait comme un nouvel
  appareil, ce qui faussait le comptage (environ 2 300 appareils pour un groupe de 10 à 20 joueurs).
