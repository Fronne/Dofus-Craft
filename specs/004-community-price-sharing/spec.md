# Feature Specification: Partage communautaire des prix

**Feature Branch**: `004-community-price-sharing`

**Created**: 2026-09-16

**Status**: Draft (révision 6 ; FR-015 amendée par specs/006-anonymous-visit-count, FR-018 amendée par
révision 6 ci-dessous)

**Input**: User description: "En Mode communautaire, retirer le choix explicite de partager ou non
ses prix personnels : le partage devient la valeur par défaut de ce mode. Décisions actées au fil
de la clarification avec le joueur : le bouton de partage groupé (`specs/004-community-price-sharing`
révision 1) reste le seul déclencheur réel de l'envoi — aucun envoi automatique en continu à chaque
saisie — mais il est désormais toujours disponible dès que le Mode communautaire est actif, sans
réglage « partager / ne pas partager » à activer au préalable. Le mécanisme de retrait rétroactif
des contributions déjà envoyées est retiré en même temps que le consentement explicite : il n'y a
plus d'état de consentement à retirer, donc plus d'action « retirer mes contributions déjà
envoyées » dans les Paramètres.

Révision 3 (documentation a posteriori) : en Mode communautaire uniquement, un champ de prix de
ressource pour lequel une valeur est déjà enregistrée dans le carnet Mode communautaire (pré-remplie
ou déjà saisie) est désormais protégé en lecture seule par défaut, pour éviter une modification
accidentelle ; un bouton dédié le déverrouille explicitement, et il se reverrouille automatiquement
dès que le joueur a terminé sa saisie (perte du focus). Un champ sans aucune valeur enregistrée reste
directement saisissable, sans aucun verrou, exactement comme aujourd'hui. Le Mode personnel n'est
pas concerné : ses champs de prix restent toujours directement modifiables (voir
001-craft-profit-comparison, User Story 2).

Révision 4 : « pour le input prix des ressources dès qu'un utilisateur modifie un prix ce dernier
s'ajoute dans la base et ensuite la base retourne la médiane de tous les prix liés à cette ressource
pour l'afficher dans le input + ça incrémente la contribution ». Cette révision remplace le
mécanisme de partage groupé introduit en révision 1 (bouton et écran de confirmation dans les
Paramètres) par un partage automatique et implicite, par ressource. Décisions actées avec le joueur :
le bouton de partage groupé et toute la section « Partage communautaire » des Paramètres sont
retirés ; la transmission d'un prix modifié en Mode communautaire se déclenche à la perte de focus
du champ (pas à chaque frappe), cohérent avec le verrouillage automatique de la révision 3 ; cette
automatisation reste strictement limitée au Mode communautaire, le Mode personnel demeurant purement
local sans aucune notion de contribution.

Révision 5 : « j'aimerais que les utilisateurs aient un identifiant qui soit enregistré dans la base
avec les prix ». Clarifié avec le joueur : il s'agit d'un identifiant anonyme par appareil (aucun
compte, aucun pseudo, aucune donnée personnelle), généré localement et conservé sur l'appareil, pour
pouvoir reconnaître que plusieurs contributions proviennent du même appareil sans jamais savoir qui
l'utilise. Cet identifiant est transmis et stocké avec chaque contribution, mais n'est jamais affiché
à un autre joueur et ne modifie pas le calcul ni l'affichage du prix communautaire (médiane) dans
cette révision — il pose seulement la base de données nécessaire à de futurs usages de diagnostic ou
de modération, hors périmètre ici. Le Mode communautaire reste désactivé (`COMMUNITY_MODE_ENABLED`)
pendant que cette révision est développée (voir 004-community-price-sharing, état courant de
l'application) ; cela ne change rien au contenu de cette spécification, qui décrit le comportement du
Mode communautaire indépendamment de cet interrupteur temporaire. »"

Révision 6 : constat du joueur — « quand quelqu'un modifie le prix d'une ressource c'est pour mettre
le prix exact qu'il voit en jeu [...] son prix est le vrai prix qui va servir au calcul du prix de
l'item ». Jusqu'ici (FR-018), une transmission réussie réaffichait la médiane communautaire
recalculée à la place de la valeur saisie, ce qui pouvait faire disparaître le prix que le joueur
venait tout juste de constater en jeu. Décidé avec le joueur : après une transmission réussie, le
champ continue d'afficher la valeur que le joueur a lui-même saisie — elle reste la source de vérité
utilisée pour son propre calcul de craft — au lieu d'être remplacée par la médiane recalculée. La
médiane communautaire continue de servir au préremplissage initial (FR-016, absence de valeur locale)
et, depuis specs/007-outlier-confirmation, à la détection d'écart déclenchant une confirmation ; elle
ne sert plus jamais à écraser une valeur déjà saisie par le joueur, y compris juste après sa propre
transmission."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Prix communautaire pré-rempli, directement modifiable (Priority: P1)

Un joueur en Mode communautaire consulte une recette et voit, pour chaque ressource, un champ de
prix déjà pré-rempli avec le prix communautaire disponible (médiane des contributions). Dès qu'une
valeur existe pour cette ressource dans le carnet Mode communautaire — qu'elle vienne du
pré-remplissage ou d'une saisie précédente du joueur — le champ est protégé en lecture seule par
défaut, pour éviter une modification accidentelle ; un bouton dédié le déverrouille explicitement
pour le corriger. Dès que le joueur a terminé sa saisie (perte du focus) après avoir modifié la
valeur, celle-ci est automatiquement transmise à la communauté comme une nouvelle contribution pour
cette ressource ; le champ continue d'afficher la valeur que le joueur vient lui-même de saisir
(depuis la révision 6, elle n'est plus remplacée par la médiane communautaire recalculée, qui peut
différer légèrement), le nombre de contributions affiché augmente d'une unité, et le champ se
reverrouille. Quand aucun prix communautaire n'existe
et qu'aucune valeur n'est encore enregistrée, le champ reste vide et directement saisissable, sans
aucun verrou, comme c'est déjà le cas aujourd'hui — et comme en Mode personnel.

**Why this priority**: C'est la valeur concrète du Mode communautaire : jusqu'ici, le prix
communautaire n'était qu'un encart de lecture séparé, sans réduire la saisie manuelle. Le
pré-remplissage supprime cette friction et donne une vraie raison d'utiliser ce mode ; le
verrouillage par défaut d'une valeur déjà enregistrée protège contre une modification accidentelle
(clic ou frappe involontaire) sans ajouter de friction lorsqu'aucune correction n'est nécessaire.
Depuis la révision 4, chaque correction devient aussi automatiquement une contribution à la
communauté dès qu'elle est terminée, sans étape ni bouton supplémentaire : la saisie normale du
prix est désormais, en elle-même, le geste de partage.

**Independent Test**: Pour une ressource disposant de contributions communautaires et sans prix
encore enregistré dans le carnet Mode communautaire, ouvrir cette ressource en Mode communautaire
affiche un champ pré-rempli avec la médiane communautaire, verrouillé en lecture seule ; cliquer
sur le bouton de modification, corriger la valeur puis quitter le champ (perte du focus) met
immédiatement à jour le coût de craft affiché, transmet la nouvelle valeur comme contribution,
continue d'afficher cette valeur saisie (révision 6), incrémente le nombre de contributions affiché,
et reverrouille automatiquement le champ.

**Acceptance Scenarios**:

1. **Given** une ressource dispose de contributions communautaires sur le serveur actif et aucun
   prix n'est encore enregistré pour elle dans le carnet Mode communautaire, **When** le joueur
   consulte cette ressource en Mode communautaire, **Then** le champ de prix est pré-rempli avec le
   prix communautaire (médiane), protégé en lecture seule par défaut, avec un bouton dédié visible
   pour le modifier.
2. **Given** une ressource sans aucune contribution communautaire sur ce serveur et sans valeur déjà
   enregistrée dans le carnet Mode communautaire, **When** le joueur la consulte en Mode
   communautaire, **Then** le champ reste vide, directement saisissable et sans aucun verrou, sans
   message d'indisponibilité bloquant.
3. **Given** un champ verrouillé en lecture seule parce qu'une valeur existe déjà dans le carnet
   Mode communautaire (pré-remplie ou déjà saisie), **When** le joueur clique sur le bouton de
   modification puis saisit une nouvelle valeur, **Then** le champ devient modifiable pendant toute
   la saisie, la nouvelle valeur est utilisée immédiatement pour le calcul du coût de craft et
   conservée dans le carnet Mode communautaire de cette ressource, et le champ se reverrouille
   automatiquement dès qu'il perd le focus.
4. **Given** un champ initialement vide et sans verrou, **When** le joueur y saisit un premier prix
   caractère par caractère, **Then** le champ reste modifiable pendant toute la saisie, sans se
   verrouiller prématurément dès qu'une valeur apparaît, et ne se verrouille qu'une fois la saisie
   terminée (perte du focus).
5. **Given** un prix déjà saisi ou conservé par le joueur dans le carnet Mode communautaire pour
   une ressource, **When** le prix communautaire se rafraîchit automatiquement en arrière-plan,
   **Then** cette valeur n'est jamais silencieusement écrasée par le rafraîchissement.
6. **Given** le joueur vient de modifier un prix de ressource en Mode communautaire et quitte le
   champ (perte du focus), **When** la transmission de cette valeur à la communauté réussit,
   **Then** le champ continue d'afficher la valeur que le joueur a saisie (elle n'est pas remplacée
   par la médiane communautaire recalculée, révision 6), et le nombre de contributions affiché pour
   cette ressource augmente d'une unité.
7. **Given** le joueur vient de modifier un prix de ressource en Mode communautaire et quitte le
   champ, **When** la transmission de cette valeur échoue (ex. service indisponible), **Then** la
   valeur saisie par le joueur reste affichée et conservée dans son carnet Mode communautaire, le
   champ se reverrouille normalement, et aucune erreur bloquante n'interrompt sa consultation.

---

### User Story 2 - Le Mode communautaire ne dépend jamais du Mode personnel (Priority: P1)

Un joueur qui a déjà des prix personnels enregistrés en Mode personnel passe en Mode communautaire :
ses prix personnels ne sont ni affichés, ni utilisés dans ce mode. Le Mode communautaire démarre
avec son propre carnet de prix, pré-rempli par la communauté. Réciproquement, toute valeur saisie
ou modifiée en Mode communautaire reste propre à ce mode et n'apparaît jamais, ni n'affecte, le
carnet Mode personnel.

**Why this priority**: C'est la garantie de confiance qui remplace l'ancienne règle « le prix
personnel reste toujours la référence » : elle évite qu'un prix communautaire non vérifié écrase
silencieusement un prix personnel que le joueur a lui-même validé, et inversement qu'une correction
faite en Mode communautaire pollue le carnet personnel.

**Independent Test**: Enregistrer un prix personnel pour une ressource en Mode personnel, passer en
Mode communautaire : le champ affiche le prix communautaire (ou reste vide), jamais le prix
personnel. Modifier ce champ en Mode communautaire, puis revenir en Mode personnel : le prix
personnel d'origine est inchangé.

**Acceptance Scenarios**:

1. **Given** un prix personnel déjà enregistré pour une ressource en Mode personnel, **When** le
   joueur passe en Mode communautaire et consulte cette même ressource, **Then** le champ affiche
   le prix communautaire pré-rempli (ou reste vide si aucun n'existe), jamais le prix personnel
   enregistré.
2. **Given** le joueur modifie ou saisit un prix pour une ressource en Mode communautaire, **When**
   il repasse en Mode personnel et consulte cette même ressource, **Then** son prix personnel
   d'origine reste inchangé, que la ressource en ait eu un ou non.
3. **Given** les deux carnets de prix existent pour une même ressource/serveur avec des valeurs
   différentes, **When** le joueur consulte le coût de craft, **Then** seul le carnet correspondant
   au mode actif est utilisé pour ce calcul, jamais les deux à la fois ni une combinaison des deux.

---

### User Story 3 - Chaque prix corrigé devient automatiquement une contribution (Priority: P1)

Un joueur en Mode communautaire n'a plus besoin d'une action de partage séparée : dès qu'il corrige
le prix d'une ressource et quitte le champ, cette valeur est automatiquement transmise à la
communauté comme une nouvelle contribution pour cette ressource, sans bouton ni écran de
confirmation dédié.

**Why this priority**: C'est la moitié « contribution » de la promesse du Mode communautaire. Le
public visé est un petit groupe de joueurs qui se connaissent dans la vraie vie (voir Assumptions) :
une action de partage séparée — groupée (révision 1-3) ou non — ajoutait une étape que ce public
n'utilisait pas nécessairement ; rendre la transmission automatique et implicite à l'usage normal du
champ garantit que chaque correction de prix profite à la communauté sans effort supplémentaire,
tout en conservant l'anonymat structurel des contributions (FR-010).

**Independent Test**: En Mode communautaire, déverrouiller un champ de prix de ressource (ou saisir
un prix pour une ressource sans valeur enregistrée), modifier sa valeur puis quitter le champ : le
nombre de contributions affiché pour cette ressource augmente d'une unité, et le champ affiche
ensuite la médiane communautaire à jour incluant cette contribution — sans qu'aucune action de
partage séparée n'ait été nécessaire.

**Acceptance Scenarios**:

1. **Given** le Mode communautaire est actif, **When** le joueur consulte les Paramètres, **Then**
   aucune action de partage manuelle ou groupée n'y est proposée : la transmission des prix ne
   dépend d'aucun réglage ni bouton dans cet écran.
2. **Given** un champ de prix de ressource sans valeur encore enregistrée en Mode communautaire,
   **When** le joueur y saisit un prix puis quitte le champ, **Then** cette valeur est transmise
   comme nouvelle contribution pour cette ressource, sans étape de confirmation intermédiaire.
3. **Given** un champ de prix déjà rempli et verrouillé, **When** le joueur clique sur le bouton de
   déverrouillage, corrige la valeur puis quitte le champ, **Then** la valeur corrigée est transmise
   comme nouvelle contribution distincte, même si une contribution avait déjà été envoyée
   précédemment pour cette même ressource.
4. **Given** une transmission automatique en cours suite à la perte de focus d'un champ, **When**
   elle échoue (ex. coupure réseau transitoire), **Then** la valeur saisie par le joueur reste
   affichée et utilisée normalement dans son carnet Mode communautaire, sans message d'erreur
   bloquant ni perte de données, et une nouvelle tentative n'a lieu qu'à la prochaine modification
   confirmée de ce champ.
5. **Given** un champ de prix dont la valeur n'a pas été modifiée depuis sa dernière transmission
   réussie, **When** il perd le focus (ex. le joueur clique dans le champ puis en ressort sans rien
   changer), **Then** aucune nouvelle contribution n'est transmise et le nombre de contributions
   affiché reste inchangé.

---

### User Story 4 - Consultation communautaire résiliente en cas d'indisponibilité (Priority: P3)

Un joueur en Mode communautaire perd sa connexion ou rencontre un service communautaire
indisponible. Il doit continuer à saisir et utiliser des prix dans son carnet Mode communautaire
normalement, avec un état clair plutôt qu'une erreur bloquante.

**Why this priority**: Confirme que le Mode communautaire dégrade proprement plutôt que de casser
le parcours de saisie, indépendamment de la disponibilité du service de prix communautaires.

**Independent Test**: Le service communautaire est simulé indisponible ; le joueur consulte une
ressource en Mode communautaire et peut toujours saisir un prix pour elle (champ vide et
saisissable, ou dernier prix communautaire connu localement affiché comme potentiellement daté),
sans blocage.

**Acceptance Scenarios**:

1. **Given** le service de prix communautaires est indisponible et qu'aucun prix communautaire
   n'était connu localement pour une ressource, **When** le joueur la consulte, **Then** le champ
   reste vide et directement saisissable, sans erreur bloquante.
2. **Given** le service est indisponible mais qu'un dernier prix communautaire connu localement
   existe pour cette ressource, **When** le joueur la consulte, **Then** ce prix pré-remplit le
   champ avec une indication compacte qu'il peut être daté, sans ligne d'affichage supplémentaire.
3. **Given** cette indisponibilité, **When** le joueur consulte le calcul de rentabilité en Mode
   communautaire, **Then** il reste fondé sur le carnet Mode communautaire tel qu'il l'a saisi,
   sans dépendre de la disponibilité du service.

---

### User Story 5 - Distinguer les contributions par appareil, sans identifier le joueur (Priority: P2)

Le mainteneur de l'application veut pouvoir reconnaître, dans les données stockées, que plusieurs
contributions proviennent du même appareil (par exemple pour diagnostiquer une valeur aberrante
répétée ou un futur usage de modération), sans qu'aucune de ces contributions ne permette
d'identifier ou de retrouver le joueur qui les a envoyées.

**Why this priority**: Ce n'est pas une valeur visible par le joueur dans cette révision (contrairement
aux User Stories 1 à 4) : c'est une fondation de données pour des usages ultérieurs de diagnostic ou
de modération, cohérente avec un public restreint et de confiance (Assumptions). Priorité P2 car elle
n'est requise par aucun parcours de saisie ou d'affichage existant.

**Independent Test**: Envoyer plusieurs prix depuis le même appareil pour des ressources différentes,
puis consulter les données stockées : toutes ces contributions partagent le même identifiant
d'appareil, distinct de celui d'un autre appareil, sans qu'aucune n'inclue de donnée personnelle.

**Acceptance Scenarios**:

1. **Given** le Mode communautaire est utilisé pour la première fois sur un appareil, **When** une
   contribution est envoyée, **Then** un identifiant d'appareil aléatoire est généré, conservé
   localement sur cet appareil, et transmis avec la contribution.
2. **Given** un identifiant d'appareil existe déjà localement, **When** une nouvelle contribution est
   envoyée depuis ce même appareil, **Then** le même identifiant est réutilisé, jamais régénéré.
3. **Given** deux appareils distincts envoient chacun une contribution pour la même ressource,
   **When** on consulte les données stockées, **Then** leurs identifiants d'appareil sont différents,
   et aucun des deux ne permet de savoir quel joueur a soumis quoi.
4. **Given** une contribution associée à son identifiant d'appareil, **When** le prix communautaire
   (médiane) est calculé et affiché à un joueur, **Then** l'identifiant d'appareil n'est ni affiché,
   ni utilisé pour modifier ce calcul ou son affichage.

### Edge Cases

- Une ressource pour laquelle une seule contribution communautaire existe pré-remplit le champ avec
  cette valeur unique, sans laisser croire à une moyenne représentative de plusieurs joueurs.
- Une contribution manifestement aberrante (valeur nulle, négative ou extrême) ne doit pas, à elle
  seule, déformer de façon disproportionnée le prix communautaire utilisé pour le pré-remplissage.
- Le rafraîchissement automatique du prix communautaire ne peut pré-remplir que des ressources dont
  le carnet Mode communautaire ne contient encore aucune valeur ; il ne modifie jamais une ressource
  déjà saisie ou conservée par le joueur dans ce carnet.
- Changer de mode (personnel ↔ communautaire) n'affecte jamais les valeurs de l'autre carnet, quel
  que soit le sens du changement.
- Un changement de serveur actif pendant la consultation en Mode communautaire met à jour le prix
  communautaire utilisé pour le pré-remplissage afin qu'il corresponde au nouveau serveur, comme
  c'est déjà le cas pour les prix personnels (cf. 002-server-scoped-prices).
- Une fois un prix transmis à la communauté (automatiquement, à la perte de focus du champ), il ne
  peut plus être retiré individuellement : il n'existe pas d'action de retrait rétroactif. Le joueur
  peut à tout moment corriger à nouveau le prix, ce qui crée une nouvelle contribution distincte,
  mais cela n'efface jamais la précédente — celle-ci continue de compter dans le calcul de la
  médiane jusqu'à sortir de la fenêtre de rétention de 90 jours (FR-013).
- Le verrouillage d'un champ déjà rempli ne s'applique qu'en Mode communautaire ; en Mode personnel,
  un prix déjà enregistré reste toujours directement modifiable, sans aucun bouton de déverrouillage
  (001-craft-profit-comparison, User Story 2).
- Cliquer sur le bouton de modification place le focus dans le champ immédiatement déverrouillé,
  pour que le joueur puisse commencer à corriger la valeur sans étape supplémentaire.
- Depuis la révision 4 : perdre le focus d'un champ sans que sa valeur ait changé depuis la dernière
  transmission réussie ne déclenche aucune nouvelle contribution ni incrémentation du nombre de
  contributions affiché.
- Depuis la révision 4 : une transmission automatique qui échoue reste silencieuse (pas de message
  d'erreur intrusif à chaque échec), car il s'agit d'un geste implicite et non d'une action explicite
  du joueur (contrairement à l'ancien partage groupé, révision 1-3, qui affichait un résultat après
  confirmation) ; la valeur reste utilisable localement et sera retransmise dès la prochaine
  modification confirmée de ce champ.
- Depuis la révision 4 : un joueur qui corrige plusieurs fois le même prix de ressource au fil du
  temps génère une nouvelle contribution distincte à chaque correction confirmée (perte de focus) ;
  le calcul de la médiane utilise toutes les contributions valides dans la fenêtre de rétention, y
  compris les plus anciennes du même joueur, sans les dédupliquer par joueur puisque l'anonymat
  structurel (FR-010) ne permet pas d'identifier qu'elles proviennent de la même personne.
- Depuis la révision 5 : effacer les données locales du navigateur, ou changer d'appareil, génère un
  nouvel identifiant d'appareil au prochain envoi ; les contributions déjà enregistrées restent en
  base sous l'ancien identifiant, sans aucun lien possible avec le nouveau.
- Depuis la révision 5 : l'identifiant d'appareil, à lui seul ou combiné aux données déjà stockées
  (ressource, serveur, montant, horodatage), ne doit jamais permettre de retrouver l'identité d'un
  joueur — seule la corrélation entre contributions d'un même appareil est possible, jamais la
  ré-identification d'une personne.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: En Mode communautaire, pour une ressource dont le carnet Mode communautaire ne
  contient encore aucune valeur, le système MUST pré-remplir le champ de prix avec le prix
  communautaire (médiane) le plus récent disponible pour cette ressource sur le serveur actif,
  lorsqu'il existe.
- **FR-002**: Lorsqu'aucun prix communautaire n'existe pour une ressource, le champ MUST rester
  vide et directement saisissable en Mode communautaire, sans état d'indisponibilité bloquant.
- **FR-003**: Le prix communautaire utilisé pour le pré-remplissage MUST être calculé comme la
  médiane des contributions récentes pour la même ressource et le même serveur (cf. décision actée
  en 003-community-price-mode).
- **FR-004**: Le joueur MUST pouvoir modifier la valeur pré-remplie ou déjà saisie d'un champ en
  Mode communautaire (via le bouton de déverrouillage lorsque le champ est protégé, cf. FR-016) ;
  cette modification MUST être conservée dans le carnet Mode communautaire de cette ressource et
  utilisée immédiatement pour le calcul de rentabilité.
- **FR-005**: Le système MUST maintenir deux carnets de prix strictement indépendants par
  ressource et serveur — un pour le Mode personnel, un pour le Mode communautaire — et MUST
  utiliser exclusivement le carnet correspondant au mode actif pour l'affichage et tout calcul de
  rentabilité. Changer de mode NE DOIT jamais lire, écraser ni fusionner l'un des carnets avec
  l'autre.
- **FR-006**: Une fois qu'un prix a été pré-rempli, saisi ou conservé par le joueur dans le carnet
  Mode communautaire pour une ressource, un rafraîchissement automatique ultérieur du prix
  communautaire NE DOIT jamais écraser silencieusement cette valeur pour cette ressource.
- **FR-007**: Le système MUST afficher, pour toute ressource en Mode communautaire disposant d'un
  prix communautaire, le nombre de contributions ayant permis son calcul, sans ajouter de ligne
  supplémentaire à l'affichage de la ressource (réutilisation d'un espace d'affichage existant,
  p. ex. la ligne d'horodatage).
- **FR-008** *(révisée en révision 4)*: En Mode communautaire, le système MUST NOT proposer d'action
  de partage manuelle ou groupée : il n'existe aucun bouton ni écran de confirmation dédié au
  partage dans les Paramètres. La transmission d'un prix à la communauté MUST se produire uniquement
  de façon automatique et implicite, déclenchée par la saisie normale d'un prix de ressource dans ce
  mode (cf. FR-017 à FR-020).
- **FR-009** *(révisée en révision 4)*: Le système MUST NOT exiger d'étape de confirmation séparée
  avant la transmission d'un prix modifié : le déverrouillage explicite du champ suivi de sa
  modification (FR-016) constitue en lui-même le geste de partage, sans écran ni dialogue
  supplémentaire.
- **FR-010** *(révisée en révision 5)*: Une contribution envoyée à la communauté NE DOIT contenir
  aucune information permettant d'identifier personnellement le joueur (nom, pseudo, compte, e-mail,
  adresse IP, ou toute autre donnée personnelle), y compris de façon technique. Elle MUST inclure un
  identifiant d'appareil anonyme (FR-021 à FR-023), qui permet de reconnaître que plusieurs
  contributions proviennent du même appareil, sans jamais permettre de remonter à l'identité de la
  personne qui l'utilise.
- **FR-011**: Le système MUST rester pleinement utilisable en Mode communautaire (saisie et calculs
  fondés sur le carnet Mode communautaire) lorsque le service de prix communautaires est
  indisponible ou inaccessible, et MUST l'indiquer clairement au joueur plutôt que de présenter une
  erreur bloquante.
- **FR-012**: Le système MUST écarter du calcul du prix communautaire toute contribution
  manifestement aberrante (valeur nulle, négative ou statistiquement extrême) par un filtrage
  purement statistique côté agrégation, sans introduire ni conserver aucune donnée technique
  identifiant le contributeur.
- **FR-013**: Le système MUST conserver les contributions individuelles pendant 90 jours glissants,
  au-delà desquels elles ne sont plus prises en compte dans le calcul du prix communautaire. Cette
  fenêtre plus longue que la valeur par défaut habituelle reste un choix délibéré : le public visé
  est un groupe restreint (de l'ordre de 10 à 20 joueurs), et une fenêtre courte risquerait de
  laisser trop peu de contributions pour produire une médiane représentative. C'est aussi, depuis
  cette révision, le seul mécanisme par lequel une contribution erronée cesse d'influencer le calcul
  — il n'existe plus de retrait rétroactif individuel (voir Edge Cases).
- **FR-014**: Le système MUST récupérer un prix communautaire à jour à chaque nouvelle consultation
  d'une ressource (chargement de la page, changement de ressource ou de serveur), et MUST le
  rafraîchir automatiquement toutes les 5 minutes si le joueur reste sur la même ressource, sans
  dépasser cette fréquence, et sous réserve de la règle de non-écrasement de FR-006.
- **FR-015** *(révisée en révision 6, specs/006-anonymous-visit-count)*: Le système MUST continuer
  à respecter, sans exception, la règle déjà actée selon laquelle aucune donnée *de prix* n'est
  jamais transmise en Mode personnel, quel que soit l'état du Mode communautaire par ailleurs. Cette
  règle admet une unique exception, définie et bornée par specs/006-anonymous-visit-count : un signal
  de présence anonyme et quotidien (un identifiant d'appareil distinct, sans aucune donnée de prix,
  de ressource ou de serveur), qui reste hors du périmètre de cette spécification.
- **FR-016**: En Mode communautaire uniquement, dès qu'une valeur existe pour une ressource dans le
  carnet Mode communautaire, le système MUST afficher son champ de prix en lecture seule par défaut,
  avec un bouton dédié pour le déverrouiller explicitement ; ce déverrouillage MUST placer le focus
  dans le champ immédiatement. Le champ MUST se reverrouiller automatiquement dès qu'il perd le
  focus. Un champ sans aucune valeur enregistrée NE DOIT jamais être verrouillé, y compris pendant
  que le joueur y saisit une première valeur caractère par caractère (le verrouillage ne doit
  jamais interrompre une saisie en cours). Ce comportement NE s'applique PAS en Mode personnel, où
  un prix déjà enregistré reste toujours directement modifiable sans bouton de déverrouillage
  (001-craft-profit-comparison, User Story 2).
- **FR-017**: En Mode communautaire, dès que le joueur termine la modification d'un prix de
  ressource (perte de focus du champ après une valeur modifiée), le système MUST transmettre cette
  valeur à la communauté comme une nouvelle contribution pour cette ressource et le serveur actif,
  sans étape de confirmation supplémentaire ni bouton dédié.
- **FR-018** *(amendée révision 6)*: Lorsque la transmission d'un prix modifié réussit, le système
  MUST continuer d'afficher dans le champ la valeur que le joueur a lui-même saisie, et NE DOIT PAS la
  remplacer par le prix communautaire (médiane) recalculé, y compris lorsque cette médiane diffère de
  la valeur saisie. La médiane recalculée continue d'être demandée et intégrée au calcul communautaire
  global (incrément du nombre de contributions, FR-019) mais ne pilote plus l'affichage du champ que
  le joueur vient de renseigner ; elle ne sert qu'au préremplissage initial (FR-016, absence de valeur
  locale) et à la détection d'écart de specs/007-outlier-confirmation.
- **FR-019**: Lorsque la transmission d'un prix modifié réussit, le système MUST incrémenter d'une
  unité le nombre de contributions affiché pour cette ressource (FR-007), sans nécessiter de
  rechargement manuel de la page.
- **FR-020**: Lorsque la transmission automatique d'un prix modifié échoue (ex. service
  indisponible), le système MUST conserver la valeur saisie par le joueur dans son carnet Mode
  communautaire et continuer à l'utiliser pour le calcul de rentabilité, sans message d'erreur
  bloquant ; une nouvelle tentative de transmission NE DOIT être refaite qu'à la prochaine
  modification confirmée de ce même champ. Perdre le focus d'un champ dont la valeur n'a pas changé
  depuis la dernière transmission réussie NE DOIT déclencher ni nouvelle transmission ni nouvelle
  incrémentation du nombre de contributions.
- **FR-021** *(révision 5)*: Le système MUST générer, à la première contribution envoyée depuis un
  appareil, un identifiant d'appareil aléatoire, et MUST le conserver localement sur cet appareil
  pour le réutiliser pour toutes les contributions ultérieures envoyées depuis ce même appareil, sans
  jamais le régénérer tant que les données locales de l'appareil ne sont pas effacées.
- **FR-022** *(révision 5)*: Le système MUST transmettre cet identifiant d'appareil avec chaque
  contribution envoyée à la communauté, et MUST le stocker aux côtés de resourceId/serverId/
  amountKamas pour cette contribution.
- **FR-023** *(révision 5)*: Le système NE DOIT jamais afficher l'identifiant d'appareil à un joueur
  (le sien ou celui d'un autre), ni l'utiliser pour modifier le calcul ou l'affichage du prix
  communautaire (médiane) — cette révision n'introduit aucun changement visible dans le parcours du
  joueur.

### Key Entities *(include if feature involves data)*

- **Contribution de prix communautaire**: Valeur en kamas soumise anonymement pour une ressource et
  un serveur donnés, horodatée, sans aucune information reliant la contribution à un joueur (mais,
  depuis la révision 5, associée à un identifiant d'appareil anonyme — voir ci-dessous). Depuis
  la révision 4, chaque contribution provient directement d'une modification confirmée (perte de
  focus) d'un champ de prix en Mode communautaire, et non plus d'un partage groupé explicite (retiré
  à cette révision).
- **Identifiant d'appareil** *(révision 5)*: Identifiant aléatoire, anonyme, généré et conservé
  localement sur l'appareil du joueur (aucun compte, aucun pseudo). Accompagne chaque contribution
  envoyée depuis cet appareil, permettant de reconnaître que plusieurs contributions en proviennent,
  sans jamais permettre de retrouver l'identité du joueur qui l'utilise. N'est jamais affiché à un
  joueur ni utilisé pour modifier le calcul ou l'affichage du prix communautaire.
- **Prix communautaire agrégé**: Médiane des contributions récentes valides pour une ressource et un
  serveur donnés ; c'est cette valeur qui pré-remplit le champ de prix en Mode communautaire.
- **Carnet de prix Mode personnel** *(existant, inchangé)*: prix saisis par le joueur en Mode
  personnel, par ressource et serveur ; jamais lu ni modifié par le Mode communautaire.
- **Carnet de prix Mode communautaire**: prix pré-remplis par la communauté ou saisis par le joueur
  pendant qu'il est en Mode communautaire, par ressource et serveur ; strictement indépendant du
  carnet Mode personnel, dans les deux sens.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Dans 100 % des cas testés, un champ de prix de ressource en Mode communautaire
  affiche directement une valeur modifiable (pré-remplie par la communauté ou vide) sans qu'aucun
  bloc d'information séparé ne soit nécessaire pour connaître ou utiliser le prix communautaire.
- **SC-002**: Dans 100 % des cas testés, aucun prix du carnet Mode personnel n'est affiché ni
  utilisé pendant que le Mode communautaire est actif, et réciproquement aucun prix saisi en Mode
  communautaire n'apparaît dans le carnet Mode personnel.
- **SC-003**: Dans 100 % des cas testés, un prix déjà saisi ou conservé par le joueur dans le carnet
  Mode communautaire pour une ressource n'est jamais remplacé par un rafraîchissement automatique
  ultérieur.
- **SC-004** *(révisée en révision 4)*: Dans 100 % des cas testés, corriger un prix de ressource en
  Mode communautaire et quitter le champ suffit, à elle seule, à transmettre une nouvelle
  contribution à la communauté, sans action ni écran supplémentaire au-delà du bouton de
  déverrouillage déjà existant (FR-016).
- **SC-005** *(révisée en révision 4)*: Dans 100 % des cas testés, aucune action de partage manuelle
  ou groupée n'est visible dans les Paramètres en Mode communautaire : la transmission des prix y
  est entièrement automatique et implicite.
- **SC-006**: Dans un test avec plusieurs contributions dont une valeur extrême isolée, le prix
  communautaire utilisé pour le pré-remplissage reste proche de la valeur typique des autres
  contributions plutôt que d'être entraîné vers cette valeur extrême.
- **SC-007**: Dans 100 % des cas testés, l'indisponibilité du service de prix communautaires ne
  bloque jamais la saisie ou l'utilisation des prix en Mode communautaire.
- **SC-008**: Dans 100 % des cas testés, un champ de prix de ressource en Mode communautaire n'est
  jamais verrouillé pendant que le joueur y saisit activement une valeur (première saisie ou
  correction après déverrouillage), et se verrouille automatiquement dans les cas contraires dès
  qu'une valeur existe et que le champ perd le focus.
- **SC-009**: Dans 100 % des cas testés, une transmission automatique échouée ne fait perdre au
  joueur ni sa valeur saisie ni la possibilité de continuer à utiliser normalement son carnet Mode
  communautaire.
- **SC-010**: Dans au moins 95 % des transmissions réussies observées lors des tests, le nombre de
  contributions affiché pour la ressource concernée augmente visiblement en moins de 2 secondes
  après la perte de focus du champ.
- **SC-011** *(révision 5)*: Dans 100 % des cas testés, les contributions envoyées successivement
  depuis un même appareil, sans effacement des données locales entre-temps, partagent le même
  identifiant d'appareil.
- **SC-012** *(révision 5)*: Dans 100 % des cas testés, l'identifiant d'appareil n'apparaît dans
  aucun texte, écran ou réponse visible par un joueur, quel que soit le mode actif.

## Assumptions

- Révision 2 : retire le consentement explicite et le retrait rétroactif introduits par la révision
  précédente de 004-community-price-sharing (déjà implémentée) : le partage devient la valeur par
  défaut du Mode communautaire, déclenché uniquement par l'action groupée explicite des Paramètres
  (jamais automatique en continu). Ce déclencheur groupé est lui-même retiré par la révision 4
  ci-dessous.
- Révision 3 (documentation a posteriori) : le verrouillage par défaut des champs déjà remplis en
  Mode communautaire (FR-016) était déjà implémenté et testé au moment de la rédaction de cette
  section ; cette révision documente ce comportement plutôt que de le planifier.
- Révision 4 : remplace le déclencheur groupé de la révision 1 par une transmission automatique par
  ressource, à la perte de focus du champ modifié — la saisie normale du prix devient elle-même le
  geste de partage, sans bouton ni écran de confirmation séparé. Une transmission échouée reste
  silencieuse plutôt que de produire un message d'erreur à chaque échec, car il s'agit désormais
  d'un geste implicite plutôt que d'une action explicite du joueur ; la valeur reste utilisable
  localement en attendant une future modification confirmée qui retentera l'envoi. Cette
  simplification reste cohérente avec le public visé, un petit groupe de joueurs de confiance (voir
  ci-dessous), pour qui une étape de partage séparée n'apportait plus de valeur perçue.
- Le Mode personnel n'est pas modifié par cette révision : la réutilisation automatique des prix
  déjà saisis (spec 001) et l'isolation par serveur (spec 002) restent inchangées pour ce carnet.
- Un bouton permettant d'importer/copier les prix communautaires vers le carnet Mode personnel,
  pour démarrer avec un jeu de données plus complet, est une idée retenue pour une itération
  ultérieure et reste explicitement hors périmètre de cette spécification.
- Aucun compte utilisateur n'est introduit par cette fonctionnalité ; les deux carnets de prix
  restent des données locales à l'appareil, comme les autres préférences déjà existantes.
- Les modalités de mise en œuvre technique (structure de stockage des deux carnets, format des
  échanges avec le service communautaire) sont hors périmètre de cette spécification et seront
  définies ou ajustées lors du plan d'implémentation (`/speckit-plan`).
- Le public visé par le Mode communautaire reste un groupe restreint et non anonyme entre eux dans
  la vraie vie (de l'ordre de 10 à 20 joueurs), pas un public large et inconnu ; cette échelle motive
  directement le retrait du consentement explicite dans cette révision (un petit groupe de confiance
  n'a plus besoin d'une étape de configuration séparée pour partager des observations de prix entre
  joueurs qui se connaissent), tout en conservant l'anonymat structurel des contributions
  elles-mêmes (FR-010) et la fenêtre de rétention de 90 jours (FR-013) pour garantir suffisamment de
  contributions.
- Révision 5 : l'identifiant d'appareil introduit ici reste un identifiant technique anonyme, pas un
  compte utilisateur — aucune notion de connexion, de mot de passe ou de profil n'est ajoutée par
  cette révision, cohérent avec l'assumption existante « Aucun compte utilisateur n'est introduit par
  cette fonctionnalité ». Son usage concret (diagnostic, modération, ou toute autre exploitation des
  données groupées par appareil) reste hors périmètre de cette spécification : celle-ci ne couvre que
  la génération, la transmission et le stockage de l'identifiant, pas son exploitation. La génération
  technique de cet identifiant (ex. UUID aléatoire, mécanisme de stockage local) est un détail
  d'implémentation laissé au plan (`/speckit-plan`).

## Révision 7 (2026-09-23)

Suite à une revue de l'application :

- **FR-023 (amendé)** : le calcul du prix communautaire ne garde que la contribution la plus récente
  de chaque appareil. Un joueur qui corrige son prix plusieurs fois ne compte qu'une fois, avec sa
  dernière valeur, dans la médiane et dans le nombre de contributions affiché. Les contributions sans
  identifiant d'appareil (antérieures à la révision 5) comptent chacune pour une. L'identifiant
  d'appareil n'est toujours jamais affiché.
- **FR-024** : la réponse du prix communautaire inclut la date de la contribution la plus récente
  parmi celles retenues dans la médiane (jamais une contribution écartée comme aberrante). C'est
  cette date qu'affiche « Dernière mise à jour » en Mode communautaire.
- **FR-025** : une contribution au-delà de 2 000 000 000 kamas est refusée.
- **FR-026** : les contributions sont limitées à 60 par minute depuis une même adresse IP. L'adresse
  sert uniquement de clé au limiteur et n'est jamais stockée (FR-010 inchangé).
- **FR-013 (amendé)** : les contributions de plus de 90 jours sont supprimées de la base une fois
  par semaine, et non plus seulement ignorées à la lecture.

## Révision (2026-09-25) : prix HDV des objets (specs/016-shared-item-prices)

- Le prix HDV d'un objet est désormais partagé en Mode communautaire : c'est la contribution la plus
  récente du groupe pour l'objet et le serveur (pas de médiane, pas de nombre de contributions),
  lue par `GET /latest-price`. Les contributions d'objets sont marquées `kind = 'item'` ; celles de
  ressources gardent `kind = 'resource'` et tout leur fonctionnement actuel (médiane sur 90 jours).
- **FR-013 (amendé)** : la suppression hebdomadaire des contributions de plus de 90 jours épargne la
  contribution la plus récente de chaque objet et serveur (lignes `'item'` uniquement), pour que le
  dernier prix d'un objet reste affiché quel que soit son âge. Les contributions de ressources
  suivent la règle des 90 jours sans exception.

## Révision (2026-09-25) : historique des prix (specs/017-price-history-chart)

- En Mode communautaire, un popover montre l'historique des prix d'une ressource (et du prix HDV d'un
  objet) sur les 90 jours conservés, lu par `GET /price-history` : une médiane et un nombre de prix par
  jour, semaine ou mois (heure de Paris).
- **FR-010 inchangé** : cette route n'expose que des agrégats par période, jamais une contribution
  individuelle, un identifiant d'appareil ni un horodatage individuel.
- **FR-013 inchangé** : aucune rétention supplémentaire ; l'historique s'arrête à la même fenêtre de
  90 jours.
- **Révisé le 2026-09-26 (specs/018-price-history-windows)** : l'historique montre désormais chaque
  prix partagé des dernières 24 h, 7 jours ou 30 jours, avec son montant et son heure à la minute,
  mais toujours sans identifiant d'appareil.

## Révision (2026-09-25) : plus de nombre de contributions sur les ressources

- À la demande du joueur, la ligne d'une ressource en Mode communautaire n'affiche plus le nombre de
  contributions. Elle garde la date de dernière mise à jour et, pour un prix ancien, la mention
  « peut-être daté » (US5).
- **FR-007 (retirée)** : le nombre de contributions n'est plus affiché.
- **FR-019 (retirée)** : sans nombre affiché, il n'y a plus rien à incrémenter après un partage
  réussi. Le partage et le rafraîchissement de la médiane sont inchangés.
- Le Worker continue de renvoyer `sampleSize` (GET /community-price) ; seule l'application cesse de
  l'afficher. L'historique des prix (specs/017) garde son nombre de prix par point, qui est une autre
  information.
