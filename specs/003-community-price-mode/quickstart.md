# Quickstart: Validation des modes personnel et communautaire de gestion des prix

## Prérequis

- Node.js 24 LTS et npm disponibles.
- Un navigateur moderne avec `localStorage` activé (pas de navigation privée pour les parcours de
  persistance).
- Un serveur actif déjà sélectionné (002-server-scoped-prices) et une recette avec au moins une
  ressource, pour exécuter les parcours ci-dessous.

## Démarrage attendu après implémentation

```bash
npm install
npm run dev
```

Ouvrir l'URL locale fournie par le serveur de développement dans une fenêtre de navigation
normale (pas privée), pour que `localStorage` persiste entre rechargements.

## Contrôles automatisés attendus

```bash
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

Ces commandes doivent couvrir les règles de [data-model.md](./data-model.md) et les interactions
exposées dans [contracts/price-mode-preference.md](./contracts/price-mode-preference.md), en plus
des contrats existants des fonctionnalités 001 et 002.

## Résultat de l'exécution (2026-09-14)

- `npm run typecheck` : ✅ aucune erreur.
- `npm run lint` : ✅ aucune erreur.
- `npm run test` (Vitest) : ✅ 97 tests passés, 2 skipped, 2 todo — dont les 16 nouveaux tests de
  cette fonctionnalité (`price-mode-preference`, `price-mode-settings`,
  `price-mode-preserves-personal-prices`, `price-mode-notice`).
- `npm run test:e2e` (Playwright, projet `desktop`) : ✅ les deux scénarios de
  `tests/e2e/price-mode.spec.ts` passent (round-trip de mode et absence de requête réseau liée aux
  prix). ⚠️ 5 échecs préexistants et sans rapport avec cette fonctionnalité
  (`catalogue-responsive.spec.ts`, `catalogue-search.spec.ts`, `craft-comparison.spec.ts`) : ces
  specs n'effectuent jamais la sélection de serveur obligatoire avant d'interagir avec le
  catalogue, un défaut antérieur à cette fonctionnalité, non corrigé ici (hors périmètre).
- `npm run test:e2e` (projet `mobile`) : ⚠️ `tests/e2e/price-mode.spec.ts` échoue sur mobile de la
  même façon que `tests/e2e/resource-price-persistence.spec.ts` (002, non modifié) : l'élément
  `Prix unitaire` n'apparaît pas dans le délai imparti sur ce viewport. Limitation préexistante de
  la suite e2e mobile, reproduite à l'identique sur un test non touché par cette fonctionnalité ;
  non corrigée ici (hors périmètre).
- `npm run build` : ✅ build de production réussi.

## Parcours de validation

### 1. Choisir son mode depuis les paramètres (US1)

1. Ouvrir les paramètres.
2. Vérifier que les deux modes (personnel, communautaire) sont présentés, chacun avec une
   explication courte de ce qu'il implique.

**Résultat attendu**: le mode personnel est identifié comme actif par défaut (première visite).

3. Sélectionner le mode communautaire.

**Résultat attendu**: le mode communautaire est immédiatement identifié comme actif dans les
paramètres.

### 2. Changer de mode sans jamais perdre ses prix personnels (US2)

1. En mode personnel, saisir un prix pour une ressource A et une ressource B d'une recette.
2. Passer en mode communautaire.
3. Revenir en mode personnel.

**Résultat attendu**: les prix de A et B sont strictement identiques à ceux saisis à l'étape 1.

4. Répéter l'aller-retour personnel → communautaire → personnel trois fois de suite, en rechargeant
   la page entre deux changements.

**Résultat attendu**: à chaque retour au mode personnel, les prix de A et B restent inchangés ; le
mode actif avant chaque rechargement est bien celui restitué après.

### 3. Vérifier qu'aucun prix n'est jamais transmis (US3)

1. Ouvrir l'onglet réseau des outils de développement du navigateur.
2. Activer le mode communautaire.
3. Consulter une recette et saisir un nouveau prix personnel.

**Résultat attendu**: aucune requête réseau liée aux prix n'apparaît dans l'onglet réseau, avant ou
après la saisie.

### 4. Comprendre que la consultation communautaire est à venir (US4)

1. Avec le mode communautaire actif, consulter une recette ou un item.

**Résultat attendu**: un bandeau explique clairement que la consultation et la contribution
communautaires ne sont pas encore disponibles ; les prix personnels de cette recette/cet item
restent affichés et modifiables normalement.

2. Changer de recette/item consulté, puis recharger la page.

**Résultat attendu**: le bandeau reste visible tant que le mode communautaire est actif.

3. Revenir au mode personnel.

**Résultat attendu**: le bandeau disparaît immédiatement.

### 5. Comportement par défaut sans préférence enregistrée

1. Vider `localStorage` du site (ou ouvrir un profil navigateur neuf), tout en gardant un serveur
   déjà sélectionné si nécessaire pour le reste du parcours.
2. Charger l'application.

**Résultat attendu**: le mode personnel est actif par défaut, sans aucun blocage ni sélecteur
obligatoire (contrairement à la sélection de serveur en 002) ; l'application est pleinement
utilisable immédiatement.

## Revue de non-transmission réseau (T012)

Revue de `src/domain/price-modes.ts`, `src/persistence/price-mode-preference.ts`,
`src/features/comparison/ComparisonPage.tsx` et `src/features/comparison/PriceModeNotice.tsx` :
aucun de ces fichiers n'importe ni n'appelle `fetch`, `XMLHttpRequest`, `axios` ou tout autre
client HTTP — vérifié par recherche textuelle le 2026-09-14. Le scénario e2e « never sends any
price-related network request while community mode is active » (`tests/e2e/price-mode.spec.ts`)
confirme cette absence à l'exécution.
