# Quickstart: Validation des collections d'objets épinglés

## Prérequis

- Node.js 24 LTS et npm disponibles.
- Un navigateur moderne avec `localStorage` activé (pas de navigation privée pour les parcours de
  persistance).
- Un serveur actif déjà sélectionné (002-server-scoped-prices) et au moins deux ou trois objets
  épinglés avant de commencer les parcours ci-dessous — dont, pour le parcours de rétrocompatibilité,
  au moins un épinglé **avant** cette fonctionnalité (ou simulé comme tel, cf. étape dédiée).

## Démarrage attendu après implémentation

```bash
npm install
npm run dev
```

## Contrôles automatisés attendus

```bash
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

Ces commandes doivent couvrir les règles de [data-model.md](./data-model.md) et les interactions
exposées dans [contracts/pinned-item-collections.md](./contracts/pinned-item-collections.md), en
plus des contrats déjà existants (001, 002, 003). Aucun appel réseau n'est impliqué par cette
fonctionnalité — purement locale.

## Parcours de validation

### 1. Organiser ses objets épinglés en collections nommées (US1)

1. Avec plusieurs objets déjà épinglés sans collection, consulter la page Épinglés.

**Résultat attendu**: tous les objets apparaissent dans un unique groupe « Sans collection »,
identique au comportement actuel sans cette fonctionnalité (SC-002).

2. Créer une nouvelle collection (nom au choix) depuis la page Épinglés et y assigner un objet.

**Résultat attendu**: l'objet apparaît désormais dans un groupe portant ce nom, et disparaît du
groupe « Sans collection » (SC-001, en 3 actions ou moins).

3. Assigner un second objet épinglé à cette même collection.

**Résultat attendu**: les deux objets apparaissent ensemble dans ce même groupe.

4. Assigner un objet déjà dans une collection à une autre collection.

**Résultat attendu**: il n'apparaît plus que dans la nouvelle collection, jamais dans les deux à la
fois (FR-008).

### 2. Choisir une collection dès l'épinglage (US2)

1. Depuis la recherche, ouvrir un objet non encore épinglé et l'épingler en choisissant une
   collection existante au moment de l'épingler (contrôle secondaire à côté du bouton Épingler).

**Résultat attendu**: sur la page Épinglés, l'objet apparaît directement dans cette collection, sans
étape supplémentaire.

2. Répéter en créant une nouvelle collection à ce moment-là plutôt que d'en choisir une existante.

**Résultat attendu**: la collection existe ensuite sur la page Épinglés avec cet objet dedans.

3. Épingler un objet sans utiliser le contrôle secondaire (clic simple sur Épingler, comme avant
   cette fonctionnalité).

**Résultat attendu**: l'objet apparaît dans « Sans collection », comportement inchangé.

### 3. Renommer ou supprimer une collection (US3)

1. Renommer une collection contenant plusieurs objets.

**Résultat attendu**: tous ses objets restent groupés ensemble, désormais sous le nouveau nom
(SC-003, aucun objet perdu ni dupliqué).

2. Renommer une collection en lui donnant exactement le nom d'une autre collection existante.

**Résultat attendu**: les objets des deux anciennes collections se retrouvent dans un seul groupe
portant ce nom (fusion, spec.md User Story 3 scénario 3).

3. Supprimer une collection contenant des objets.

**Résultat attendu**: ces objets réapparaissent dans « Sans collection », restent épinglés avec
toutes leurs informations (prix, niveau), et le groupe portant l'ancien nom n'apparaît plus (SC-004).

### 4. Rétrocompatibilité et unicité de nom (edge cases)

1. Simuler un objet épinglé avant cette fonctionnalité : dans les DevTools, retirer le champ
   `collectionName` d'une entrée existante dans `localStorage` (`craftcheck-pinned-items`), ou
   utiliser une entrée jamais assignée depuis la mise en service de la fonctionnalité.

**Résultat attendu**: cet objet apparaît dans « Sans collection » dès la consultation suivante, sans
erreur, sans perte d'aucune de ses données (FR-005, SC-002).

2. Créer une collection nommée « PvP », puis tenter d'assigner un autre objet à une collection nommée
   « pvp » (casse différente).

**Résultat attendu**: l'objet rejoint la collection existante « PvP » (casse conservée depuis sa
première création) ; aucune seconde collection visuellement distincte n'apparaît (FR-009, SC-005).

3. Tenter de créer une collection avec un nom vide ou composé uniquement d'espaces.

**Résultat attendu**: refusé ou normalisé en « Sans collection » — aucune collection au nom vide
n'apparaît jamais comme groupe sur la page Épinglés.

4. Désépingler le dernier objet d'une collection.

**Résultat attendu**: le groupe correspondant disparaît de la page Épinglés (silencieusement, sans
action de suppression explicite nécessaire) ; le nom reste réutilisable pour une future collection.
