# Research: Modes personnel et communautaire de gestion des prix

## Emplacement de la préférence de mode dans l'application

**Decision**: Porter la préférence de mode (`personal` | `community`) comme état local de
`ComparisonPage`, initialisé depuis `localStorage` et persisté à chaque changement via un
`useEffect`, exactement comme le thème clair/sombre et la couleur d'accent déjà implémentés.
Aucun contexte React dédié n'est créé pour cette préférence.

**Rationale**: Le mode ne conditionne, dans cette itération, que deux choses : (1) le texte affiché
dans les paramètres et (2) l'affichage d'un bandeau d'information lorsque le mode communautaire est
actif — deux besoins purement locaux à `ComparisonPage`, qui héberge déjà les paramètres de thème
et d'accent. Contrairement au serveur actif (`ServerContext`), qui doit être lu par plusieurs hooks
de données indépendants (`useResourcePrices`, `usePinnedItems`) répartis dans l'arbre de
composants, aucun hook de données n'a besoin de connaître le mode dans cette itération : les
calculs et l'accès aux prix restent strictement identiques dans les deux modes (FR-009, FR-012).
Créer un contexte pour un état à un seul point de lecture serait une abstraction sans besoin
démontré (principe constitutionnel IV).

**Alternatives considered**:

- Nouveau `PriceModeContext` calqué sur `ServerContext` : rejeté pour cette itération car rien ne
  consomme la préférence en dehors de `ComparisonPage` ; à reconsidérer si une future itération
  (infrastructure communautaire) doit effectivement faire varier le comportement de hooks de
  données selon le mode.
- Bibliothèque de gestion d'état externe : rejetée, aucune dépendance de ce type n'existe dans le
  projet et un seul état local ne justifie pas d'en introduire une (principe IV, déjà tranché de
  façon identique pour le thème, l'accent et le serveur actif).

## Persistance de la préférence de mode

**Decision**: Mémoriser le mode sélectionné dans `localStorage` sous une clé dédiée
(`craftcheck-price-mode`), via un petit module de persistance (`price-mode-preference.ts`) qui
valide la valeur lue et applique `'personal'` par défaut si elle est absente ou invalide.

**Rationale**: C'est le pattern déjà utilisé trois fois dans le projet (thème, serveur actif,
couleur d'accent) : une préférence simple et à valeur unique doit être immédiatement disponible au
premier rendu, ce que `localStorage` permet de façon synchrone, contrairement à IndexedDB.
Envelopper la lecture dans un module dédié avec valeur par défaut sûre suit le même principe que
`persistence/accent-color-preference.ts` (repli explicite plutôt que de propager une erreur), plus
robuste que l'accès direct utilisé historiquement pour le thème.

**Alternatives considered**:

- Accès direct à `window.localStorage.getItem` dans `ComparisonPage`, comme le fait aujourd'hui le
  thème : rejeté au profit du pattern plus récent et plus sûr déjà adopté pour l'accent
  (`accent-color-preference.ts`), qui isole la validation et le repli par défaut.
- IndexedDB : rejeté pour cette valeur binaire unique, pour les mêmes raisons que pour le serveur
  actif et le thème (accès asynchrone superflu pour une préférence simple lue au premier rendu).

## Garantie de non-transmission réseau en mode communautaire

**Decision**: Ne construire, dans cette itération, aucun appel réseau lié aux prix, quel que soit
le mode actif. Le mode communautaire se contente d'afficher un message d'information (FR-011) sans
déclencher la moindre requête vers une destination externe.

**Rationale**: La décision de cadrage (spec.md) diffère explicitement l'infrastructure de partage
communautaire. Ne rien construire côté réseau est donc à la fois la solution la plus simple et la
garantie la plus forte possible pour FR-010/SC-002 : il ne peut pas y avoir de fuite de données
tant qu'aucun code de transmission n'existe. Cette absence de code réseau est directement
vérifiable en test (aucune requête interceptée pendant un scénario en mode communautaire).

**Alternatives considered**:

- Construire un client HTTP « à vide » (sans backend réel derrière) en prévision de l'itération
  future : rejeté, introduirait du code mort et une fausse impression de fonctionnalité partielle,
  contraire au principe IV (pas d'abstraction anticipée sans besoin démontré) et au principe I
  (ne pas laisser croire à une capacité qui n'existe pas).

## Présentation du mode communautaire comme fonctionnalité à venir

**Decision**: Réutiliser le pattern de bandeau déjà utilisé pour la notification de migration
(`PinnedPriceMigrationNotice`, 002-server-scoped-prices) pour créer `PriceModeNotice` : un bandeau
`role="status"` affiché dans le contenu principal lorsque le mode communautaire est actif,
expliquant que la consultation et la contribution communautaires sont à venir et que les prix
personnels restent utilisés normalement en attendant (FR-011, FR-012).

**Rationale**: Un composant de notification avec ce rôle et ce style existe déjà et a déjà été
validé pour un message informatif non bloquant dans ce projet ; le réutiliser évite de dupliquer un
nouveau pattern de bandeau pour un besoin équivalent (principe IV). Contrairement à
`PinnedPriceMigrationNotice`, ce bandeau n'est pas nécessairement « fermable » définitivement : il
doit réapparaître tant que le mode communautaire reste actif et que l'infrastructure n'existe pas,
car il documente un état durable du mode plutôt qu'un événement ponctuel de migration ; ce point
sera précisé dans `data-model.md`/`contracts/`.

**Alternatives considered**:

- Désactiver entièrement l'option « mode communautaire » tant que l'infrastructure n'existe pas
  (ne pas la proposer du tout dans les paramètres) : rejeté, contredit US1/FR-001 qui demande un
  choix explicite entre les deux modes dès cette itération, et empêche de valider dès maintenant le
  cadre (persistance, non-perte de données) que l'itération future réutilisera tel quel.

## Qualité et tests

**Decision**: Réutiliser exactement l'outillage existant (Vitest, React Testing Library,
Playwright) sans nouvel outil, en ajoutant des cas de test dédiés à la persistance de la
préférence de mode, à la non-altération des prix personnels lors des changements de mode, à
l'affichage du bandeau « à venir », et à l'absence de requête réseau en mode communautaire.

**Rationale**: Cohérent avec le principe constitutionnel II (règles testables) et avec l'outillage
déjà en place pour les fonctionnalités 001 et 002, sans introduire d'outil non justifié par un
besoin nouveau.

**Alternatives considered**: Aucune ; aucun besoin de test non couvert par l'outillage existant
n'a été identifié.
