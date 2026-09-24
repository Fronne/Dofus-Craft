# Feature Specification: Modes personnel et communautaire de gestion des prix

**Feature Branch**: `[003-community-price-mode]`

**Created**: 2026-09-14

**Status**: Draft

**Input**: User description: "Ajouter un système permettant à l'utilisateur de choisir comment gérer ses prix de ressources et de marché, avec deux modes explicites : un mode personnel (prix strictement personnels, jamais partagés, conservés durablement) et un mode communautaire (consultation des prix renseignés par d'autres joueurs, contribution possible de ses propres prix). Le changement de mode ne doit jamais supprimer ni écraser les données personnelles ; les deux sources de données doivent coexister sans se mélanger. Les prix personnels et communautaires doivent être associés au serveur actif, comme le reste des prix déjà scopés par serveur (002-server-scoped-prices). La règle de priorité d'affichage entre prix personnel et prix communautaire doit être explicitement définie. Aucune donnée de prix ne doit être partagée en mode personnel ; en mode communautaire, un consentement explicite est requis avant tout envoi des prix personnels du joueur."

**Décision de cadrage (2026-09-14)**: aucune infrastructure serveur/backend partagée n'existe
aujourd'hui dans le projet (application 100 % client-side). La partie « infrastructure de partage
communautaire » de cette demande a été explicitement **différée** à une itération future par
décision produit (voir section « Décisions actées pour une itération future »). Cette
spécification couvre donc, pour l'itération actuelle, le cadre complet du choix de mode et la
garantie de séparation/non-perte des données personnelles, tout en présentant honnêtement le mode
communautaire comme une fonctionnalité à venir tant que son infrastructure n'est pas construite.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Choisir son mode de gestion des prix depuis les paramètres (Priority: P1)

Un joueur ouvre les paramètres de Dofus Craft et voit deux modes clairement présentés : « Mode
personnel » et « Mode communautaire », chacun accompagné d'une explication courte de ce qu'il
implique. Il choisit celui qui lui convient et voit immédiatement quel mode est actif.

**Why this priority**: Sans ce choix visible et compréhensible, le joueur ne peut ni comprendre ni
maîtriser ce qui advient de ses données de prix ; c'est le point d'entrée de toute la
fonctionnalité.

**Independent Test**: Ouvrir les paramètres, vérifier que les deux modes sont présentés avec leur
explication, sélectionner un mode et vérifier qu'il est immédiatement identifié comme actif.

**Acceptance Scenarios**:

1. **Given** un joueur ouvre les paramètres, **When** il consulte la section de gestion des prix,
   **Then** les deux modes (personnel, communautaire) sont présentés avec, pour chacun, une
   explication courte et compréhensible de ce qu'il implique.
2. **Given** le mode personnel actif, **When** le joueur consulte les paramètres, **Then** le mode
   personnel est identifié sans ambiguïté comme le mode actuellement actif.
3. **Given** les deux modes présentés, **When** le joueur sélectionne le mode communautaire,
   **Then** ce mode devient actif et est immédiatement identifié comme tel dans les paramètres.

---

### User Story 2 - Changer de mode sans jamais perdre ses prix personnels (Priority: P1)

Un joueur a renseigné des prix personnels, passe en mode communautaire, puis repasse en mode
personnel. Il doit retrouver exactement les prix qu'il avait saisis, inchangés par le passage en
mode communautaire.

**Why this priority**: C'est la garantie centrale attendue par le joueur : sans elle, changer de
mode devient risqué et la fonctionnalité perd toute confiance. C'est explicitement l'exemple
donné dans la demande d'origine.

**Independent Test**: En mode personnel, saisir un prix pour une ressource A et une ressource B ;
passer en mode communautaire ; repasser en mode personnel ; vérifier que les prix de A et B sont
identiques à ceux saisis initialement.

**Acceptance Scenarios**:

1. **Given** un joueur en mode personnel avec des prix déjà saisis pour plusieurs ressources,
   **When** il passe en mode communautaire, **Then** aucun de ces prix personnels n'est supprimé,
   modifié ou remplacé.
2. **Given** un joueur en mode communautaire, **When** il repasse en mode personnel, **Then** il
   retrouve exactement ses prix personnels d'origine, identiques à ceux d'avant le passage en mode
   communautaire.
3. **Given** plusieurs allers-retours successifs entre les deux modes, **When** le joueur consulte
   ses prix personnels à n'importe quel moment en mode personnel, **Then** ces prix restent
   strictement ceux qu'il a lui-même saisis, jamais fusionnés avec une autre valeur.

---

### User Story 3 - Aucun prix personnel n'est jamais transmis hors de l'appareil, quel que soit le mode (Priority: P1)

Un joueur active le mode communautaire, par curiosité ou par choix. Il doit avoir la certitude
qu'aucun de ses prix personnels n'est envoyé où que ce soit tant que la fonctionnalité de partage
réelle n'existe pas, et qu'il ne le sera jamais sans un consentement explicite et distinct une fois
qu'elle existera.

**Why this priority**: La confidentialité des données de prix est un engagement explicite de la
demande d'origine et relève du principe constitutionnel de gestion sûre des données utilisateur ;
c'est la garantie de confiance minimale de cette itération, indépendamment de l'infrastructure
communautaire différée.

**Independent Test**: Activer le mode communautaire ; vérifier, y compris au niveau réseau, qu'aucun
prix personnel n'est transmis à l'extérieur de l'application.

**Acceptance Scenarios**:

1. **Given** un joueur qui active le mode communautaire, **When** il consulte ou saisit des prix
   personnels, **Then** aucun de ces prix n'est envoyé, publié ni rendu accessible à un tiers.
2. **Given** le mode communautaire actif, **When** le joueur saisit un nouveau prix personnel,
   **Then** ce prix est enregistré exactement comme en mode personnel, sans tentative d'envoi vers
   une quelconque destination externe.
3. **Given** cette garantie, **When** une future itération introduira une réelle transmission de
   prix vers des données communautaires, **Then** cette transmission devra obligatoirement être
   précédée d'un consentement explicite et distinct de la simple activation du mode communautaire
   (contrainte actée pour l'itération future, voir section dédiée).

---

### User Story 4 - Comprendre clairement que la consultation communautaire est à venir (Priority: P2)

Un joueur qui sélectionne le mode communautaire ne doit jamais croire, à tort, qu'il consulte ou
partage réellement des prix avec d'autres joueurs. Il doit voir un message clair indiquant que
cette partie de la fonctionnalité est en préparation.

**Why this priority**: Évite toute confusion ou fausse promesse envers le joueur tant que
l'infrastructure communautaire (différée, voir décision de cadrage) n'existe pas ; complète les
garanties de confiance des User Stories 2 et 3.

**Independent Test**: Sélectionner le mode communautaire et vérifier qu'un message explicite
indique que la consultation et la contribution communautaires ne sont pas encore disponibles,
plutôt que d'afficher un espace vide ou une fonctionnalité apparemment cassée.

**Acceptance Scenarios**:

1. **Given** le mode communautaire sélectionné, **When** le joueur consulte une ressource ou un
   item, **Then** un message clair indique que les prix communautaires ne sont pas encore
   disponibles, sans jamais afficher un prix fabriqué ou une liste vide sans explication.
2. **Given** ce message affiché, **When** le joueur cherche à comprendre l'état de ses propres
   prix, **Then** il voit que ses prix personnels restent affichés et utilisés normalement pendant
   cette période.

---

### Edge Cases

- Un joueur qui n'a jamais renseigné aucun prix personnel et sélectionne le mode communautaire voit
  le message « fonctionnalité à venir » plutôt qu'un état vide ambigu.
- Si le joueur change de serveur actif pendant que le mode communautaire est sélectionné, ce
  changement de serveur continue de s'appliquer normalement aux prix personnels affichés (cohérence
  avec 002-server-scoped-prices) ; il n'y a pas encore de prix communautaire à mettre à jour.
- Si le stockage local du navigateur est vidé ou indisponible, le mode de gestion des prix revient à
  son état par défaut (mode personnel), de la même façon que la préférence de serveur redevient non
  définie dans ce cas (cf. 002-server-scoped-prices, FR-017).
- Le passage répété entre les deux modes, y compris en rechargeant la page entre chaque
  changement, ne doit jamais produire d'état incohérent : le mode actif et les prix personnels
  restent restitués à l'identique après un rechargement complet.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Le système DOIT proposer, dans les paramètres, un choix explicite entre exactement
  deux modes de gestion des prix : mode personnel et mode communautaire.
- **FR-002**: Le système DOIT indiquer en permanence, dans les paramètres, quel mode est
  actuellement actif, de façon immédiatement identifiable.
- **FR-003**: Le système DOIT afficher, pour chacun des deux modes, une explication courte et
  compréhensible de ce qu'il implique, visible avant et après la sélection du mode.
- **FR-004**: Le système DOIT permettre au joueur de changer de mode à tout moment depuis les
  paramètres.
- **FR-005**: Le système DOIT mémoriser durablement le mode sélectionné, y compris après un
  rechargement complet de la page, de la même façon que la préférence de serveur (cf.
  002-server-scoped-prices).
- **FR-006**: Le système DOIT conserver indéfiniment les prix personnels du joueur, quel que soit
  le nombre de changements de mode ou le temps passé en mode communautaire entretemps.
- **FR-007**: Un changement de mode NE DOIT JAMAIS supprimer, écraser ni fusionner un prix
  personnel déjà enregistré avec une autre valeur.
- **FR-008**: Lorsque le joueur repasse en mode personnel, le système DOIT réafficher exactement
  les prix personnels tels qu'ils étaient avant le passage en mode communautaire.
- **FR-009**: En mode personnel, le système DOIT utiliser exclusivement les prix personnels du
  joueur pour tout affichage et tout calcul de comparaison.
- **FR-010**: Le système NE DOIT, en mode personnel comme en mode communautaire, envoyer, publier
  ni rendre accessible à un tiers aucun prix personnel du joueur tant que l'infrastructure de
  partage communautaire (différée, voir décision de cadrage) n'est pas mise en œuvre.
- **FR-011**: En mode communautaire, tant que l'infrastructure de partage n'est pas disponible, le
  système DOIT indiquer clairement au joueur que la consultation et la contribution de prix
  communautaires ne sont pas encore disponibles, plutôt que de présenter un état vide ou une
  fonctionnalité apparemment cassée.
- **FR-012**: En mode communautaire, tant que cette limitation s'applique, le système DOIT
  continuer à afficher et utiliser exclusivement les prix personnels du joueur pour tout calcul de
  comparaison, de façon strictement identique au mode personnel.
- **FR-013**: Le système DOIT permettre de revenir au mode personnel depuis le mode communautaire
  sans condition ni confirmation destructrice, cette transition ne portant atteinte à aucune
  donnée personnelle (cf. FR-007).

### Key Entities *(include if feature involves data)*

- **Mode de gestion des prix**: préférence individuelle mémorisée pour le joueur (personnel ou
  communautaire), indépendante du serveur actif ; détermine le message et le comportement
  présentés au joueur, sans jamais affecter l'accès à ses prix personnels.
- **Prix personnel** *(existant, inchangé dans son fonctionnement — 001/002)*: prix de ressource ou
  de marché saisi par le joueur, propre à lui et au serveur concerné, jamais transmis à un tiers
  quel que soit le mode actif dans cette itération.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Dans 100 % des cas testés, un joueur qui effectue un cycle mode personnel → mode
  communautaire → mode personnel retrouve des prix personnels strictement identiques à ceux
  d'avant le passage en mode communautaire.
- **SC-002**: Dans 100 % des cas testés, aucun prix personnel n'est transmis hors de l'appareil du
  joueur, quel que soit le mode sélectionné, tant que l'infrastructure communautaire n'est pas mise
  en œuvre.
- **SC-003**: Un joueur peut identifier, depuis les paramètres et sans aide externe, quel mode est
  actuellement actif et ce qu'il implique en moins de 5 secondes.
- **SC-004**: Dans 100 % des cas testés, un joueur qui sélectionne le mode communautaire voit
  immédiatement et clairement que la consultation et la contribution communautaires sont à venir,
  sans qu'aucun élément de l'interface ne laisse croire à un partage ou une consultation
  fonctionnels.
- **SC-005**: Dans 100 % des cas testés, le passage en mode communautaire n'entraîne aucune
  dégradation ni changement de comportement des prix personnels et de leurs calculs par rapport au
  mode personnel.

## Assumptions

- Le mode de gestion des prix est une préférence individuelle liée au navigateur/appareil utilisé,
  cohérente avec le choix déjà fait pour la sélection de serveur (002-server-scoped-prices) ;
  aucun compte utilisateur n'est requis dans le périmètre de cette spécification.
- Le mode par défaut pour un joueur qui n'a encore jamais fait de choix est le mode personnel : il
  ne requiert aucun partage de données et respecte par défaut le principe constitutionnel de
  gestion sûre des données utilisateur.
- Cette fonctionnalité s'appuie sur le système de serveurs existant (002-server-scoped-prices) et
  sur les prix personnels existants (001-craft-profit-comparison) sans en modifier le périmètre
  fonctionnel.
- Par décision produit du 2026-09-14, l'infrastructure de partage communautaire (stockage,
  transport, consultation et contribution réelles de prix entre joueurs) est explicitement hors
  périmètre de cette itération et fera l'objet d'une spécification dédiée ultérieure, qui devra
  respecter les décisions actées ci-dessous sans les rouvrir, sauf nouvelle décision explicite
  documentée.

## Décisions actées pour une itération future *(hors périmètre d'implémentation actuel)*

Ces décisions ont été validées avec le porteur du produit pour éviter de les rouvrir lorsque
l'infrastructure communautaire sera spécifiée et construite. Elles ne sont pas implémentées par
cette itération (voir décision de cadrage en tête de document) mais doivent être respectées par la
suite :

1. **Infrastructure de partage** — différée. Aucun backend ni service tiers n'est construit ou
   intégré par cette itération ; celle-ci livre uniquement le cadre de choix de mode et ses
   garanties de confidentialité et de non-perte de données.
2. **Identification des contributeurs** — entièrement anonyme : aucun identifiant ni aucune
   traçabilité d'un contributeur ne sera mis en place, y compris dans l'itération future.
3. **Règle d'agrégation des prix communautaires** — médiane des contributions récentes pour la
   même ressource sur le même serveur, retenue pour sa robustesse face aux valeurs aberrantes ou
   abusives.
4. **Consentement explicite avant tout partage réel** — repris de la demande d'origine : une fois
   l'infrastructure construite, l'envoi effectif d'un prix personnel devra toujours être précédé
   d'un consentement explicite et distinct de la simple activation du mode communautaire (cf.
   User Story 3, Acceptance Scenario 3).
5. **Priorité d'affichage** — lorsque prix personnel et prix communautaire coexisteront pour la
   même ressource sur le même serveur, le prix personnel prévaudra toujours à l'affichage principal
   et dans les calculs ; le prix communautaire restera consultable séparément, jamais masqué ni
   fusionné.
6. **Points restant à trancher lors de cette itération future** (non résolus par les décisions
   ci-dessus, à traiter lors de sa spécification dédiée) : modération et détection des abus ou
   prix aberrants, fréquence de rafraîchissement des prix communautaires côté client, durée de
   conservation et anonymisation des contributions, comportement hors-ligne (mise en cache
   éventuelle du dernier état communautaire connu), conformité réglementaire (RGPD ou équivalent)
   si des données techniques identifiantes s'avéraient nécessaires à l'infrastructure retenue, et
   effet du retrait d'un futur consentement de partage sur des contributions déjà envoyées avant ce
   retrait.

## Révision (2026-09-23)

- Les pages Prix et Épinglés suivent le mode actif, comme la page Recherche : en Mode communautaire,
  elles lisent le carnet du Mode communautaire ; en Mode personnel, le carnet personnel. Les trois
  pages affichent donc toujours les mêmes prix de ressources pour un même mode.
- Le consentement explicite distinct décrit ci-dessus a été retiré par specs/004 (partage automatique
  en Mode communautaire). La description du Mode communautaire dans Paramètres le dit désormais
  clairement : « Les prix que vous saisissez sont partagés automatiquement et anonymement. »

## Révision (2026-09-24) : Mode communautaire par défaut

- Un joueur qui n'a encore jamais fait de choix sur cet appareil démarre en **Mode communautaire**
  (remplace l'hypothèse « mode par défaut = mode personnel » ci-dessus). Il en va de même quand le
  stockage local est vidé ou indisponible. Tant que le Mode communautaire est désactivé
  (`COMMUNITY_MODE_ENABLED`), le défaut reste le Mode personnel.
- Un joueur qui a déjà ouvert l'application garde le mode enregistré sur son appareil : le
  changement ne concerne que les nouveaux appareils.
- Conséquence assumée : un nouveau joueur partage ses prix sans avoir choisi le mode lui-même. Le
  public est un petit groupe fermé, et la dernière étape de la visite guidée de la page Recherche
  (specs/011) lui indique qu'il est en Mode communautaire et où le changer.

## Révision (2026-09-24, suite) : bascule des joueurs existants

- Remplace le deuxième point de la révision précédente : les joueurs qui avaient déjà un mode
  enregistré sur leur appareil repassent eux aussi en **Mode communautaire**, une seule fois, à leur
  prochaine ouverture de l'application.
- Un choix fait après cette bascule (y compris revenir au Mode personnel dans Paramètres) est
  conservé comme d'habitude.
- Le carnet personnel n'est ni effacé ni modifié : revenir au Mode personnel retrouve les prix
  saisis auparavant.
