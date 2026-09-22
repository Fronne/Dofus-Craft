# Feature Specification: Affichage instantané du cache local sur la page Recherche

**Feature Branch**: `010-search-instant-cache`

**Created**: 2026-09-22

**Status**: Draft

**Input**: User description: "Afficher tout de suite les données en cache local au rechargement de la page Recherche (stale-while-revalidate). Sur la page Recherche, en mode Communautaire et en mode Perso, l'app charge deux types de données : les infos des objets et des recettes depuis DofusDB, et les prix des ressources (Cloudflare en mode communautaire, prix saisis par l'utilisateur en mode perso). Ces données sont censées être déjà enregistrées en local après le premier chargement, mais au rechargement de la page, l'app attend la fin des appels réseau avant d'afficher quoi que ce soit. Il faut afficher tout de suite les données locales, relancer les appels réseau en arrière-plan, et ne mettre à jour l'affichage que si quelque chose a changé, sans perdre la recherche en cours, les filtres, le scroll ni l'objet sélectionné. En cas d'échec réseau, garder l'affichage local avec un indicateur discret plutôt qu'un message bloquant."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Retrouver instantanément sa recherche au rechargement (Priority: P1)

En tant qu'utilisateur qui recharge ou rouvre la page Recherche après une première visite, je veux revoir immédiatement la liste d'objets, la recette et les prix des ressources que j'avais déjà consultés, sans écran de chargement, afin de pouvoir continuer à comparer des coûts de craft sans interruption perceptible.

**Why this priority**: C'est la valeur centrale de la demande : aujourd'hui la page attend systématiquement le réseau avant d'afficher quoi que ce soit, alors que la donnée est déjà disponible localement la plupart du temps. C'est le problème qui motive toute la fonctionnalité.

**Independent Test**: Peut être testé en visitant une recherche/un objet une première fois (pour qu'il soit mis en cache), puis en rechargeant la page : la liste d'objets, la recette et les prix des ressources doivent apparaître immédiatement, avant même qu'une requête réseau ait eu le temps d'aboutir.

**Acceptance Scenarios**:

1. **Given** l'utilisateur a déjà consulté un objet et ses ressources sur cette page lors d'une visite précédente, **When** il recharge la page, **Then** la liste d'objets, la recette de l'objet précédemment sélectionné et les prix de ses ressources s'affichent immédiatement, sans état de chargement intermédiaire.
2. **Given** l'utilisateur est en Mode personnel avec des prix déjà saisis pour les ressources d'un objet, **When** il recharge la page, **Then** ces prix personnels s'affichent immédiatement depuis le stockage local.
3. **Given** l'utilisateur est en Mode communautaire avec des prix déjà connus pour les ressources d'un objet, **When** il recharge la page, **Then** ces prix communautaires s'affichent immédiatement depuis le stockage local, avant que l'appel réseau vers le service communautaire n'ait répondu.
4. **Given** les données locales viennent de s'afficher immédiatement, **When** les appels réseau en arrière-plan se terminent avec un résultat différent, **Then** l'affichage se met à jour avec les nouvelles valeurs, sans réinitialiser la recherche en cours, les filtres actifs, la position de défilement ni l'objet sélectionné.
5. **Given** les données locales viennent de s'afficher immédiatement, **When** les appels réseau en arrière-plan se terminent avec un résultat identique à ce qui est déjà affiché, **Then** rien ne change visuellement (pas de scintillement, pas de perte de focus sur un champ en cours de saisie).

---

### User Story 2 - Continuer à travailler hors ligne ou en cas de panne réseau (Priority: P2)

En tant qu'utilisateur dont la connexion réseau est momentanément indisponible ou dont un service distant échoue, je veux continuer à voir les données déjà connues localement plutôt qu'un message d'erreur qui bloque mon travail, afin de pouvoir continuer à consulter mes recettes et mes prix déjà enregistrés.

**Why this priority**: Complète la valeur de la mise en cache immédiate : sans cette garantie, un simple aléa réseau annulerait le bénéfice de l'affichage instantané en le remplaçant par une erreur. C'est cependant secondaire par rapport à l'affichage instantané lui-même (US1), qui reste utile même sans ce raffinement.

**Independent Test**: Peut être testé en coupant le réseau (ou en simulant un échec des appels distants) après qu'une recherche a déjà été chargée localement : les données déjà affichées doivent rester visibles et utilisables, avec un simple indicateur discret plutôt qu'un blocage.

**Acceptance Scenarios**:

1. **Given** des données locales sont déjà affichées, **When** l'appel réseau vers DofusDB ou vers le service communautaire échoue (réseau coupé, service indisponible), **Then** les données locales restent affichées à l'identique et aucun message d'erreur bloquant n'apparaît.
2. **Given** un appel réseau en arrière-plan vient d'échouer, **When** l'utilisateur regarde la page, **Then** un indicateur discret signale que les données peuvent ne pas être à jour (par exemple « données hors ligne » ou « dernière mise à jour : il y a X »), sans empêcher la consultation ni la saisie de prix.
3. **Given** le réseau redevient disponible après un échec, **When** une revalidation ultérieure réussit, **Then** l'indicateur discret disparaît ou se met à jour pour refléter la synchronisation réussie.

---

### User Story 3 - Premier accès sans donnée locale (Priority: P2)

En tant qu'utilisateur qui consulte pour la première fois un objet, une recherche ou un serveur jamais vus auparavant, je veux voir le comportement de chargement habituel (indicateur de chargement puis affichage des résultats), afin de savoir que l'application travaille bien à récupérer mes données pendant qu'il n'y a encore rien à montrer.

**Why this priority**: Garantit qu'il n'y a pas de régression pour le cas déjà bien géré aujourd'hui (aucune donnée locale disponible) : nécessaire pour la cohérence de la fonctionnalité, mais ne change rien pour l'utilisateur par rapport à l'existant.

**Independent Test**: Peut être testé en effaçant les données locales (ou en utilisant un profil/serveur jamais utilisé) et en chargeant la page : un état de chargement doit s'afficher jusqu'à l'arrivée de la première réponse réseau, exactement comme aujourd'hui.

**Acceptance Scenarios**:

1. **Given** aucune donnée locale n'existe pour la recherche, l'objet ou les prix concernés, **When** l'utilisateur ouvre la page Recherche, **Then** un état de chargement s'affiche jusqu'à la réception de la première réponse réseau, comme c'est le cas aujourd'hui.
2. **Given** l'utilisateur bascule vers un serveur de jeu jamais utilisé auparavant, **When** la page se recharge dans ce contexte, **Then** les prix (personnels ou communautaires, propres à ce serveur) suivent le même comportement : chargement s'il n'y a rien en local pour ce serveur, affichage immédiat sinon.

---

### User Story 4 - Voir que la page se resynchronise (Priority: P3)

En tant qu'utilisateur, je veux pouvoir voir, de façon discrète, qu'une resynchronisation est en cours en arrière-plan et savoir depuis quand mes données n'ont pas été renouvelées, afin de juger de leur fraîcheur sans avoir à deviner.

**Why this priority**: Confort et transparence supplémentaires, explicitement présentés comme facultatifs par la demande initiale ; n'est pas nécessaire au bon fonctionnement de la fonctionnalité principale (US1/US2/US3).

**Independent Test**: Peut être testé en observant la page immédiatement après un rechargement : un indicateur discret de resynchronisation doit apparaître pendant l'appel réseau puis disparaître à la fin, et une date de dernière synchronisation réussie doit être consultable.

**Acceptance Scenarios**:

1. **Given** une revalidation en arrière-plan vient de démarrer après l'affichage immédiat des données locales, **When** l'utilisateur regarde la page, **Then** un indicateur discret de type « mise à jour… » est visible tant que cette revalidation n'est pas terminée.
2. **Given** une revalidation en arrière-plan vient de se terminer avec succès, **When** l'utilisateur consulte l'indicateur de fraîcheur, **Then** la date/heure de cette synchronisation réussie est reflétée dans cet indicateur.

---

### Edge Cases

- Une réponse réseau qui arrive après que l'utilisateur a déjà changé de recherche, de filtre, d'objet sélectionné ou de mode de prix ne doit jamais remplacer l'affichage correspondant à la nouvelle demande en cours (réponse obsolète).
- Une lecture du cache local qui se termine après qu'une réponse réseau plus récente a déjà été affichée ne doit jamais écraser cette donnée plus fraîche par une version plus ancienne.
- Un changement de mode de prix (Personnel ↔ Communautaire) doit afficher immédiatement le cache local propre au mode nouvellement actif, sans mélanger les deux jeux de données, conformément à l'isolation déjà en vigueur entre les deux carnets.
- Un changement de serveur de jeu actif doit afficher immédiatement le cache local propre à ce serveur pour les prix, sans mélanger les données entre serveurs.
- La saisie d'un prix par l'utilisateur, en cours ou déjà validée, ne doit jamais être écrasée par l'arrivée d'une revalidation en arrière-plan (cohérent avec les règles déjà en vigueur de pré-remplissage unique et de non-réécriture après validation).
- Si le stockage local de l'appareil est indisponible ou inaccessible (navigation privée, quota dépassé, etc.), le comportement doit se dégrader vers le comportement actuel (chargement puis affichage), sans erreur visible pour l'utilisateur.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Le système DOIT, à l'ouverture ou au rechargement de la page Recherche, afficher immédiatement les objets, la recette et les prix de ressources déjà enregistrés localement pour le contexte courant (recherche/filtres, objet sélectionné, mode de prix actif, serveur actif), sans attendre la réponse des services distants, dès lors que cette donnée locale existe.
- **FR-002**: Le système DOIT relancer en arrière-plan les appels vers les services distants concernés (catalogue d'objets/recettes DofusDB, prix communautaires) dès que les données locales ont été affichées, et ce dans les deux modes de prix (Personnel et Communautaire).
- **FR-003**: Lorsqu'une réponse distante arrive, le système DOIT enregistrer son contenu dans le stockage local pour un usage immédiat lors d'une prochaine visite.
- **FR-004**: Le système DOIT ne mettre à jour l'affichage visible qu'après réception d'une réponse distante dont le contenu diffère de ce qui est déjà affiché ; une réponse identique ne doit provoquer aucun changement visuel perceptible.
- **FR-005**: Une mise à jour de l'affichage déclenchée par une réponse distante ne DOIT PAS réinitialiser la recherche textuelle en cours, les filtres actifs, la position de défilement de la liste, ni l'objet actuellement sélectionné.
- **FR-006**: Si aucune donnée locale n'existe pour le contexte courant, le système DOIT afficher un état de chargement jusqu'à la réception de la première réponse distante, identique au comportement actuel.
- **FR-007**: Si un appel distant échoue alors que des données locales sont déjà affichées, le système DOIT conserver l'affichage de ces données locales et NE DOIT PAS afficher de message d'erreur bloquant.
- **FR-008**: Le système DOIT afficher un indicateur discret et non bloquant lorsqu'un appel distant a échoué, signalant que les données affichées peuvent ne plus être à jour (par exemple « données hors ligne » ou une indication de dernière mise à jour).
- **FR-009**: Le système DOIT garantir qu'une réponse distante devenue obsolète (parce qu'une demande plus récente — nouvelle recherche, nouveau filtre, nouvel objet, nouveau mode ou nouveau serveur — a entretemps été effectuée) ne peut jamais remplacer l'affichage correspondant à la demande la plus récente.
- **FR-010**: Le système DOIT garantir qu'une lecture du stockage local ne peut jamais remplacer par une valeur plus ancienne des données distantes déjà affichées à l'écran.
- **FR-011**: Le comportement d'affichage immédiat puis de revalidation en arrière-plan DOIT s'appliquer de façon équivalente en Mode personnel et en Mode communautaire, chaque mode conservant son propre jeu de données locales sans mélange entre les deux (cohérent avec l'isolation déjà exigée entre les deux carnets de prix).
- **FR-012**: Le système DEVRAIT afficher un indicateur discret pendant qu'une revalidation en arrière-plan est effectivement en cours (ex. « mise à jour… »).
- **FR-013**: Le système DEVRAIT conserver et rendre consultable la date/heure de la dernière synchronisation réussie avec les services distants.

### Key Entities *(include if feature involves data)*

- **Cache local du catalogue d'objets/recettes** : représente les objets, recettes, ressources et catégories déjà obtenus depuis DofusDB, conservés localement entre deux visites, avec une notion de dernière mise à jour.
- **Cache local des prix de ressources** : représente, séparément pour le Mode personnel et le Mode communautaire, les derniers prix connus par ressource et par serveur de jeu, avec leur date de dernière mise à jour (entité déjà existante ; cette fonctionnalité change la façon dont elle est exposée à l'affichage, pas sa structure).
- **Indicateur de fraîcheur** : état affiché à l'utilisateur reflétant si les données visibles proviennent d'une synchronisation récente, sont en cours de resynchronisation, ou datent d'une dernière synchronisation réussie faute de connexion actuelle.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Lors du rechargement de la page Recherche sur une recherche/un objet déjà consultés, la liste d'objets, la recette et les prix des ressources sont visibles à l'écran en moins d'une seconde, sans attendre de réponse réseau.
- **SC-002**: Lors d'une panne ou d'une coupure réseau survenant après qu'une recherche a déjà été affichée, 100% des données précédemment visibles restent affichées, et aucun message d'erreur bloquant n'apparaît.
- **SC-003**: Après le retour d'une réponse réseau contenant des données différentes de celles affichées, l'utilisateur voit ces nouvelles données sans que sa recherche en cours, ses filtres, sa position de défilement ou son objet sélectionné n'aient changé.
- **SC-004**: Pour toute recherche, objet ou serveur jamais consulté auparavant, le comportement de chargement observé par l'utilisateur reste identique à celui d'aujourd'hui (aucune régression perceptible).
- **SC-005**: Dans 100% des cas où une réponse réseau devenue obsolète arrive après une réponse plus récente (ou après une nouvelle action de l'utilisateur), l'affichage final reflète toujours la donnée la plus récente, jamais l'obsolète.

## Assumptions

- Le périmètre de cette fonctionnalité est la page Recherche (objets/recettes DofusDB, prix personnels, prix communautaires). Les autres pages (Épinglés, Prix) restent hors périmètre, même si le même mécanisme pourra leur être réutilisé plus tard.
- Chaque mode de prix (Personnel, Communautaire) continue de disposer de son propre stockage local isolé, conformément aux règles déjà en vigueur (specs/004-community-price-sharing) ; cette fonctionnalité ne modifie pas cette isolation, seulement la façon dont chaque carnet est affiché au chargement.
- « Immédiatement » / « moins d'une seconde » signifie sans round-trip réseau : une lecture depuis le stockage local de l'appareil est considérée comme instantanée du point de vue de l'utilisateur, indépendamment de la technologie de stockage utilisée.
- Le cache local est affiché dès qu'il existe, quel que soit son âge ; il n'y a pas de seuil de péremption qui forcerait un état de chargement à la place d'une donnée locale existante — la fraîcheur est seulement communiquée via l'indicateur discret (FR-008/FR-012/FR-013), jamais en bloquant l'affichage.
- L'indicateur de fraîcheur (« hors ligne », « mise à jour… », dernière synchro) est informatif et ne bloque jamais une interaction existante : saisie de prix, sélection d'objet, changement de filtre ou de mode.
- Les invariants déjà spécifiés dans specs/004-community-price-sharing et specs/007-outlier-confirmation (pré-remplissage unique d'un prix communautaire non encore saisi, non-écrasement d'une valeur déjà validée par l'utilisateur, confirmation obligatoire en cas d'écart important) restent inchangés : la revalidation en arrière-plan introduite ici ne doit jamais les contourner.
- La façon de factoriser cette logique techniquement (mécanisme commun aux deux modes plutôt que du code dupliqué, structures de stockage précises) est une contrainte d'implémentation à détailler lors de la planification (`/speckit-plan`), pas un critère d'acceptation fonctionnel de cette spécification.
