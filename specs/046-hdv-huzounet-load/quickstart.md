# Quickstart : valider le chargement Huzounet de la page HDV

## Prérequis

- Node 22 : `export PATH="/c/Users/Cyril/AppData/Roaming/nvm/v22.23.3:$PATH"`
- Dépendances installées (`npm install`). Aucune clé ni déploiement nécessaires pour les tests : l'API
  est simulée.

## 1. Tests automatiques

```bash
npx vitest run tests/unit/huzounet-load.test.ts tests/unit/community-price-api.test.ts tests/integration/hdv-huzounet-load.test.tsx tests/integration/huzounet-load-hook.test.tsx tests/integration/hdv-page.test.tsx
```

Attendu : tout passe. Ce que ces tests prouvent :

| Récit | Vérification |
|-------|--------------|
| US1 | Consommables : 128 objets demandés en 2 tranches (90 + 38), jamais en parallèle, 5,5 s entre les départs ; progression « 90 sur 128 » puis fin ; prix visibles et compteur à jour après chaque tranche ; « Les prix sont déjà à jour. » quand `refreshed` vaut 0 partout ; un filtre actif ne change pas les identifiants demandés |
| US2 | prix Huzounet seul → mention « Huzounet » et objet compté ; mentions « peu de relevés » / « relevé ancien » ; prix partagé plus récent → pas de mention ; saisie sur une ligne Huzounet sans confirmation d'écart |
| US3 | « Arrêter » après la 1re tranche → la 2e n'est jamais demandée ; changement d'onglet → idem ; 429 → même tranche redemandée, 3 fois au plus ; un message distinct pour chacune des cinq causes |
| US4 | Mode personnel et serveur non relu → bouton désactivé, aucune demande, carnet personnel intact |

## 2. Vérifications avant fusion

```bash
npx tsc -b --noEmit
npx tsc -p worker --noEmit
npx eslint src tests
npx vitest run
```

Attendu : aucune erreur de types ; aucune erreur de lint nouvelle ; toute la suite passe (le test
« shows the latest shared price over an older kept one » de `hdv-page.test.tsx` est sensible à la charge
en exécution parallèle : le relancer seul en cas d'échec isolé).

## 3. Essai à la main (facultatif, sur le poste)

Le site local parle à l'API de production si `.env.local` contient son adresse et sa clé : un clic sur le
bouton y déclenche de **vraies** lectures chez Huzounet. À faire une fois, sur un petit onglet :

1. Démarrer le site local, choisir Mikhal, Mode communautaire, page HDV, onglet Créatures.
2. Cliquer « Charger depuis Huzounet (35 objets) » : une seule demande, puis « N prix chargés depuis
   Huzounet. » ou « Les prix sont déjà à jour. ».
3. Recliquer aussitôt : « Les prix sont déjà à jour. » (rien n'est redemandé avant deux minutes).
4. Passer en Mode personnel : bouton désactivé, explication visible.

Ne pas lancer l'onglet Ressources à répétition : chaque chargement complet fait environ 57 lectures chez
Huzounet.

## Résultats (12 octobre 2026)

- Avant : 956 tests passent (plus 1 échec connu, sensible à la charge : « shows the latest shared price
  over an older kept one » de `hdv-page.test.tsx`, qui passe seul) ; `npx tsc -b --noEmit` sans erreur.
- Après : 1 018 tests passent (62 ajoutés : 21 de règles, 12 du client de l'API, 19 de la page, 10 de la
  boucle de chargement) ; même échec connu, qui passe seul ; `npx tsc -b --noEmit` et
  `npx eslint src tests --quiet` sans erreur.
- À l'écran (site local, API de production en lecture) : bouton présent avec le nombre d'objets de
  l'onglet (35, 128 avec « environ 10 s ») ; mentions « Huzounet · relevé ancien » sous le type des
  croquettes ; en Mode personnel, bouton désactivé avec son explication. Le bouton n'a pas été cliqué en
  Mode communautaire : un clic lit réellement Huzounet.

### Après l'ajout de la limite horaire (FR-017)

- 1 030 tests passent (12 de plus : limite horaire dans l'API, dans le client, la boucle et la page) ;
  même échec connu, qui passe seul ; `npx tsc -b --noEmit`, `npx tsc -p worker --noEmit` et
  `npx eslint src tests --quiet` sans erreur.
- `bash scripts/compare-worker-bundle.sh` : 32 lignes différentes de la production (4 avant) — la limite
  horaire, voulue. Elle ne vaut qu'une fois le Worker redéployé ; d'ici là l'API en ligne ignore `tab` et
  `last`.

## Hors périmètre

Aucun déploiement. Le site en ligne reste la copie du 2 octobre tant que les écrans 032–044 ne sont pas
réécrits.
