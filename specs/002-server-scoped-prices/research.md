# Research: Gestion multi-serveurs des prix

## Emplacement du serveur actif dans l'application

**Decision**: Exposer le serveur actif et la fonction de changement de serveur via un contexte
React unique (`ServerProvider` / `useActiveServer`), monté au sommet de l'arbre applicatif
(`src/app/App.tsx`), plutôt que de faire transiter `serverId` en props à travers chaque
composant.

**Rationale**: `serverId` est requis à la fois par la comparaison de recette
(`useResourcePrices`) et par les items épinglés (`usePinnedItems` / prix de marché), deux
branches de composants distinctes sous `ComparisonPage`. Le faire transiter en props dupliquerait
la même valeur dans de nombreux composants intermédiaires qui n'en ont pas besoin pour
eux-mêmes. Un contexte garde une source unique de vérité et correspond à un état global
d'application (au même titre qu'un thème), cohérent avec le pattern déjà utilisé pour le thème
clair/sombre dans `ComparisonPage.tsx`.

**Alternatives considered**:

- Prop drilling depuis `App.tsx` : rejeté car `serverId` devrait traverser des composants
  (`ItemSearch`, `ItemResults`, etc.) qui n'en ont pas l'usage, augmentant le couplage sans
  bénéfice.
- Bibliothèque de gestion d'état externe (Redux, Zustand, Jotai) : rejetée car aucune dépendance
  de ce type n'existe dans le projet et un seul état global (le serveur actif) ne justifie pas
  d'introduire un nouvel outil (principe constitutionnel IV : changements cohésifs, pas de
  dépendance sans besoin démontré).

## Persistance de la préférence de serveur actif

**Decision**: Mémoriser l'identifiant du serveur actif dans `localStorage`, sous une clé dédiée
(`craftcheck-active-server`), lue de façon synchrone à l'initialisation de l'application.

**Rationale**: Le thème d'affichage est déjà mémorisé de cette façon
(`craftcheck-theme` dans `ComparisonPage.tsx`) ; c'est le pattern existant du projet pour une
préférence simple, à valeur unique, qui doit être disponible immédiatement au premier rendu (pour
savoir s'il faut bloquer l'application avec le sélecteur de première visite). IndexedDB est
asynchrone et introduirait un état de chargement initial superflu pour une seule valeur.

**Alternatives considered**:

- IndexedDB : rejeté pour cette valeur unique en raison de son accès asynchrone, qui compliquerait
  la détection synchrone du besoin de bloquer l'interface au premier chargement.
- Cookie : rejeté, aucun besoin d'envoi au serveur (application 100% cliente).

## Liste des serveurs officiels

**Decision**: Définir la liste fermée des serveurs officiels Dofus comme une constante versionnée
dans le code du domaine (`src/domain/servers.ts`), au même titre que les catégories de catalogue.

**Rationale**: La spécification (FR-014) impose une liste fermée et prédéfinie maintenue par le
projet, sans saisie libre ni source externe. Une constante statique, relue et mise à jour
manuellement par les contributeurs lors de l'ouverture/fermeture d'un serveur officiel, respecte
ce choix et reste cohérente avec la façon dont `Category` est déjà modélisée dans
`src/domain/types.ts`.

**Alternatives considered**:

- Récupération dynamique depuis une API externe : rejetée, hors périmètre (Assumptions de la
  spec) et introduirait une dépendance réseau non désirée pour une simple liste de choix.
- Saisie libre par le joueur : rejetée, exclue explicitement par FR-014.

## Extension du stockage par serveur (ressources et items épinglés)

**Decision**: Généraliser le stockage IndexedDB déjà amorcé (`resource-prices-by-server`) en une
fabrique de dépôt réutilisable `createServerScopedPriceStore(storeName)`, instanciée une fois
pour les prix de ressources (store existant `resource-prices-by-server`) et une fois pour les
prix de marché des items épinglés (nouveau store `pinned-item-prices-by-server`). Les deux stores
partagent la même clé composite `[serverId, entryId]` et la même interface
(`get`/`getMany`/`save`/`remove`).

**Rationale**: Le dépôt `resource-prices-by-server` existe déjà côté persistance
(`src/persistence/indexeddb-resource-price-repository.ts`) mais n'est pas branché à l'interface,
ce qui casse actuellement la compilation du projet ; cette fonctionnalité doit le finaliser plutôt
que le dupliquer. FR-013 demande explicitement que l'architecture permette d'ajouter facilement
une autre donnée dépendante du serveur : avec deux usages concrets et immédiats (prix de
ressource, prix de marché d'item épinglé), factoriser l'accès IndexedDB commun est justifié
maintenant (principe constitutionnel IV : une abstraction introduite seulement pour un besoin
démontré, pas par anticipation) et évite de dupliquer deux fois le même code d'ouverture de base,
transaction et gestion d'erreur.

**Alternatives considered**:

- Dupliquer le fichier existant tel quel pour les items épinglés : rejeté, duplication de code
  strictement identique à l'exception du nom de store, contraire au principe de changements
  cohésifs.
- Un unique store IndexedDB mêlant ressources et items épinglés avec un champ `kind` : rejeté,
  complexifie les clés et les migrations futures pour un gain minime ; deux stores symétriques
  restent plus lisibles et testables séparément.

## Liste des items épinglés commune, prix scindé du prix de marché

**Decision**: Retirer le champ `marketPrice` de `PinnedItem` (persistance `localStorage`,
`src/persistence/pinned-items.ts`) pour ne conserver que l'identité de l'item suivi (liste commune
à tous les serveurs). Le prix de marché d'un item épinglé devient une donnée séparée, lue depuis
le nouveau store IndexedDB `pinned-item-prices-by-server`, au même titre qu'un prix de ressource.

**Rationale**: FR-008/FR-009/FR-010 exigent une liste d'épinglés commune mais un prix par
serveur ; les deux préoccupations (identité suivie vs. prix observé) doivent donc être des
données distinctes avec des cycles de vie différents (l'une ne dépend pas du serveur, l'autre
oui). Séparer les deux évite qu'un même enregistrement mélange une donnée globale et une donnée
scoped, ce qui rendrait le composant de persistance ambigu à tester et à faire évoluer.

**Alternatives considered**:

- Garder `marketPrice` sur `PinnedItem` mais en faire un `Record<serverId, prix>` : rejeté,
  mélange deux systèmes de stockage (`localStorage` pour la liste, potentiellement gros pour de
  nombreux serveurs) et casse la symétrie avec le stockage des prix de ressources déjà choisi en
  IndexedDB.

## Migration des anciennes données (prix de marché des items épinglés non scopés)

**Decision**: Lors du premier chargement suivant la mise à jour, ignorer silencieusement tout
champ `marketPrice` présent dans les entrées `PinnedItem` déjà stockées en `localStorage` (il
n'est plus lu ni copié vers le nouveau store par serveur), et afficher une notification
informative unique au joueur concerné l'invitant à ressaisir ses prix de marché par serveur.

**Rationale**: Correspond à la décision produit actée lors de la clarification de la spécification
(FR-016 : « abandonner avec avertissement »). Aucune reprise automatique n'est tentée car
l'ancienne donnée n'est associée à aucun serveur et ne peut donc pas être attribuée de façon
fiable à l'un des serveurs officiels sans risque d'erreur silencieuse (contraire au principe
constitutionnel I : ne jamais présenter une donnée incertaine comme fiable).

**Alternatives considered**:

- Rattacher automatiquement l'ancien prix au premier serveur choisi après la mise à jour : rejeté
  explicitly par le choix utilisateur lors de la clarification.
- Bloquer la mise à jour tant que le joueur n'a pas confirmé explicitement la suppression :
  rejeté, hors périmètre demandé ; le choix retenu est une notification informative, pas une
  confirmation préalable.

## Qualité et tests

**Decision**: Réutiliser exactement l'outillage existant (Vitest, React Testing Library,
Playwright) sans nouvel outil, en ajoutant des cas de test dédiés au changement de serveur, à
l'isolation des prix, et à la persistance après rechargement.

**Rationale**: Cohérent avec le principe constitutionnel II (règles testables) et avec
l'outillage déjà en place pour la fonctionnalité 001, évitant toute introduction d'outil non
justifiée par un besoin nouveau.

**Alternatives considered**: Aucune ; aucun besoin de test non couvert par l'outillage existant
n'a été identifié.
