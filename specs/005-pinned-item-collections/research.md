# Research: Collections d'objets épinglés

## Modéliser une collection comme un champ, pas comme une entité séparée

**Decision**: Ajouter un unique champ optionnel `collectionName?: string` à `PinnedItem`
(`src/persistence/pinned-items.ts`). Aucune liste de collections n'est stockée séparément ; la liste
des collections existantes à un instant donné est calculée à la volée en dérivant l'ensemble des
`collectionName` actuellement portés par au moins un objet épinglé.

**Rationale**: La spec (Key Entities) est explicite : « une collection n'existe, du point de vue du
joueur, que tant qu'au moins un objet épinglé y est assigné ». Stocker une liste de collections en
plus des objets créerait un second état à garder synchronisé avec le premier (que se passe-t-il si un
objet référence une collection qui n'existe plus dans cette liste, ou l'inverse ?), une classe de bug
entièrement évitée en dérivant l'un de l'autre. C'est aussi strictement moins de code : pas de
nouvelle clé `localStorage`, pas de nouveau repository, conforme au principe IV (pas d'abstraction
sans besoin démontré).

**Alternatives considered**:

- Une seconde clé `localStorage` listant les collections (`{id, name}[]`) référencée par les objets
  épinglés via un `collectionId` : rejeté — introduit une relation à maintenir cohérente (objet
  orphelin si la collection référencée disparaît) pour un bénéfice nul à cette échelle (quelques
  dizaines d'objets par joueur).
- Un tableau `collectionNames: string[]` sur chaque objet (tags multiples) : rejeté explicitement par
  le joueur lors de la clarification initiale (spec.md/Assumptions) — chaque objet appartient à au
  plus une collection.

## Unicité de nom insensible à la casse et conservation de la première casse

**Decision**: Toute opération qui reçoit un nom de collection (assignation, création, renommage) le
compare aux `collectionName` déjà portés par au moins un objet épinglé, en ignorant la casse
(`.toLocaleLowerCase('fr')` ou équivalent) et les espaces de début/fin. Si une correspondance existe
déjà, l'opération réutilise la casse exacte de cette collection existante plutôt que la casse
nouvellement saisie.

**Rationale**: Traduit directement FR-009 et l'Assumption correspondante de spec.md. Conserver la
casse de la première création (plutôt que, par exemple, la dernière saisie) donne un résultat stable
et prévisible : peu importe combien de fois un joueur retape « pvp » en minuscules, l'affichage reste
toujours celui choisi la première fois (ex. « PvP »), sans jamais changer sous ses yeux au gré des
saisies suivantes.

**Alternatives considered**:

- Comparaison sensible à la casse (deux noms différents uniquement par la casse resteraient deux
  collections distinctes) : rejeté explicitement par FR-009, qui interdit deux collections dont le
  nom ne diffère qu'à la casse.
- Toujours adopter la casse la plus récemment saisie plutôt que la première : rejeté — produirait un
  changement d'affichage surprenant pour tous les autres objets déjà dans cette collection à chaque
  fois qu'un joueur assigne un nouvel objet avec une casse légèrement différente.

## Renommage et suppression comme cas particuliers d'une même opération

**Decision**: `renameCollection(oldName, newName)` réassigne chaque objet actuellement dans
`oldName` vers `newName` (en appliquant la règle d'unicité/casse ci-dessus, ce qui gère nativement le
cas de fusion vers une collection déjà existante — spec.md, User Story 3, scénario 3).
`deleteCollection(name)` est implémentée comme `renameCollection(name, undefined)` : réassigne chaque
objet de cette collection vers « Sans collection » (`collectionName: undefined`), sans jamais toucher
au reste des données de l'objet ni le désépingler.

**Rationale**: Renommer et supprimer sont, du point de vue des objets concernés, la même opération
(« réassigner tous les objets d'un nom vers un autre, ou vers aucun ») — les traiter comme un seul
mécanisme interne évite de dupliquer la logique de recherche/réassignation en masse et réduit le
risque que l'une gère un cas (ex. la fusion par casse identique) que l'autre oublierait de gérer.

**Alternatives considered**: Deux fonctions indépendantes avec leur propre logique de recherche des
objets concernés : rejeté, dupliquerait une logique de filtrage identique pour un bénéfice de lisibilité
marginal.

## Un composant de sélection/création partagé plutôt que dupliqué

**Decision**: Un nouveau composant `CollectionPicker` (liste des collections existantes dérivées des
objets épinglés courants + champ de création d'une nouvelle) est utilisé à la fois par
`EpinglesPage.tsx` (assignation a posteriori, User Story 1) et `ItemDetail.tsx` (choix au moment
d'épingler, User Story 2).

**Rationale**: Les deux écrans ont exactement le même besoin (« choisir une collection existante ou
en taper une nouvelle, avec réutilisation par casse identique ») ; un composant partagé garantit que
la règle d'unicité (FR-009) est appliquée de façon identique aux deux endroits, plutôt que
risquer une divergence entre deux implémentations séparées.

**Alternatives considered**: Dupliquer un petit `<select>`/`<input>` directement dans chacun des deux
écrans : rejeté — la logique de correspondance insensible à la casse n'est pas triviale au point de
justifier une duplication (principe IV).

## Choix au moment d'épingler sans alourdir le geste actuel

**Decision**: Le bouton « Épingler » de `ItemDetail.tsx` garde son comportement actuel en un seul
clic (épingle sans collection, comme aujourd'hui). Un contrôle secondaire, à côté de ce bouton,
permet d'ouvrir le `CollectionPicker` pour choisir/créer une collection au moment de l'épinglage,
sans quoi l'objet est épinglé dans « Sans collection » exactement comme avant cette fonctionnalité.

**Rationale**: FR-003/User Story 2 exigent qu'un joueur PUISSE choisir une collection au moment
d'épingler, pas qu'il le DOIVE — l'Acceptance Scenario 3 de cette User Story confirme explicitement
que ne rien assigner reste un parcours valide, identique au comportement actuel. Garder le bouton
principal à un clic préserve ce comportement existant pour tout joueur qui n'utilise pas les
collections, conformément au principe IV (pas de friction ajoutée sans bénéfice pour l'usage
existant).

**Alternatives considered**: Remplacer le clic simple par une confirmation systématique demandant la
collection avant tout épinglage : rejeté — ajouterait une étape obligatoire à un geste aujourd'hui
instantané, pour un bénéfice que seuls les joueurs utilisant des collections retireraient.
