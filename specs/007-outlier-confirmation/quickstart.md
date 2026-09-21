# Quickstart: Validation de la confirmation des valeurs de coût de craft aberrantes

## Prérequis

- Tous les prérequis de
  [specs/004-community-price-sharing/quickstart.md](../004-community-price-sharing/quickstart.md)
  (Worker Cloudflare déployé, base D1 `dofus-craft-community-prices` déjà créée et migrée jusqu'à la
  révision 5 de cette fonctionnalité — colonne `device_id` déjà présente).
- Au moins une ressource ayant déjà une médiane communautaire connue sur le serveur actif (via des
  contributions de test, comme dans specs/004/quickstart.md), pour pouvoir déclencher une
  confirmation.

## Migration de production (une seule fois)

Avant de considérer cette fonctionnalité déployée, appliquer la migration ajoutant les deux
nouvelles colonnes à la base déjà en production (elle contient déjà des lignes, comme pour
`device_id` en specs/004 révision 5) :

```bash
npm run worker:db:migrate-outlier-tracking
```

(ajoute le script `"worker:db:migrate-outlier-tracking": "wrangler d1 execute
dofus-craft-community-prices --config worker/wrangler.toml --file
worker/migrations/0003_add_outlier_tracking.sql --remote"` à `package.json`, même pattern que
`worker:db:migrate-device-id`.)

Puis vérifier via `wrangler d1 execute dofus-craft-community-prices --config worker/wrangler.toml
--command "PRAGMA table_info(community_price_contributions);"` que `median_at_submission_kamas` et
`deviation_percent` existent, nullables, sans valeur par défaut — les lignes déjà présentes auront
ces deux colonnes à `NULL` (comportement attendu : elles n'ont jamais eu de médiane connue au moment
de leur propre insertion recalculée rétroactivement).

## Démarrage attendu après implémentation

```bash
npm install
npm run dev
```

## Contrôles automatisés attendus

```bash
npm run typecheck
npx tsc --noEmit -p worker/tsconfig.json
npm run test
npm run test:e2e
npm run build
```

Ces commandes doivent couvrir les règles de [data-model.md](./data-model.md) et les interactions
exposées dans [contracts/outlier-confirmation-api.md](./contracts/outlier-confirmation-api.md), en
plus des contrats existants de specs/004. Comme pour specs/004, aucun test n'appelle le vrai Worker
Cloudflare déployé (mocks `fetch` en Vitest, interception réseau en Playwright).

## Parcours de validation

### 1. Confirmation avant enregistrement d'une valeur très différente de la médiane (US1)

1. Sur une ressource ayant déjà une médiane communautaire de 1000 kamas (via des contributions de
   test), en Mode communautaire, déverrouiller le champ et saisir 1300 (écart de 30 %), puis quitter
   le champ (perte de focus).

**Résultat attendu**: une boîte de dialogue de confirmation s'affiche, indiquant la médiane (1000),
la valeur saisie (1300) et l'écart (30 %) ; aucune requête `POST /community-price` ne part avant
réponse à cette boîte de dialogue (à vérifier dans l'onglet réseau du navigateur).

2. Dans cette boîte de dialogue, cliquer sur « Enregistrer quand même ».

**Résultat attendu**: la requête `POST /community-price` part alors, avec la valeur saisie (1300) ;
le champ continue d'afficher 1300 (la valeur saisie par le joueur), qui n'est pas remplacée par la
médiane communautaire recalculée (specs/004, FR-018 amendée révision 6 ; specs/007, FR-012).

3. Répéter l'étape 1, puis cliquer sur « Annuler » (ou fermer la boîte de dialogue au clavier,
   Échap).

**Résultat attendu**: aucune requête `POST /community-price` ne part ; le champ revient à la valeur
qu'il affichait avant la saisie de 1300 (la médiane pré-remplie, ou la valeur précédemment
enregistrée).

4. Sur la même ressource, saisir 1150 (écart de 15 %, sous le seuil de 25 %) puis quitter le champ.

**Résultat attendu**: aucune boîte de dialogue ne s'affiche ; la requête `POST /community-price` part
directement, comme avant cette fonctionnalité ; le champ continue d'afficher 1150 après succès (pas la
médiane recalculée, FR-018 amendée).

5. Sur une ressource sans aucune médiane communautaire connue (première contribution), saisir une
   valeur arbitrairement élevée puis quitter le champ.

**Résultat attendu**: aucune boîte de dialogue ne s'affiche (FR-008) ; la valeur est transmise
directement.

### 2. Historique des valeurs aberrantes confirmées pour modération future (US2)

1. Après avoir confirmé l'enregistrement d'une valeur aberrante (parcours 1, étape 2), interroger la
   base :
   ```bash
   wrangler d1 execute dofus-craft-community-prices --config worker/wrangler.toml --command \
     "SELECT resource_id, server_id, amount_kamas, median_at_submission_kamas, deviation_percent, device_id, created_at FROM community_price_contributions WHERE deviation_percent > 25 ORDER BY created_at DESC LIMIT 5;"
   ```

**Résultat attendu**: la ligne correspondant à la contribution de 1300 kamas apparaît, avec
`median_at_submission_kamas = 1000`, `deviation_percent ≈ 30`, et le `device_id` de l'appareil ayant
confirmé.

2. Envoyer une contribution sous le seuil (parcours 1, étape 4), puis rejouer la même requête.

**Résultat attendu**: cette nouvelle ligne n'apparaît pas dans le résultat (son `deviation_percent`
est ≤ 25, filtré par la clause `WHERE`).

3. Vérifier que `GET /community-price` pour la même ressource renvoie toujours la médiane calculée
   exactement comme avant cette fonctionnalité (les nouvelles colonnes ne l'affectent pas, FR-010) —
   comparer avec la valeur déjà vérifiée en specs/004/quickstart.md.

## Revue des sites d'appel

`grep -rn "OutlierConfirmDialog\|useOutlierConfirm" src/` (hors tests) doit confirmer un seul
appelant de production, `CommunityResourcePriceRow` dans `src/features/search/RecherchePage.tsx`.
`grep -rn "median_at_submission_kamas\|deviation_percent" worker/src/` doit confirmer que ces
colonnes ne sont lues et écrites que dans `handlePostContribution` (et sa fonction partagée
`fetchCurrentMedian`), jamais dans `handleGetCommunityPrice` au-delà de ce que `computeCommunityMedian`
utilise déjà (`amount_kamas` seul).

## Résultat de l'exécution (2026-09-21)

- **Bug détecté et corrigé pendant l'implémentation** (avant tout commit) : jsdom (utilisé par
  Vitest) n'implémente pas `HTMLDialogElement.showModal()`/`close()`. Un petit polyfill a été ajouté
  dans `src/test/setup.ts` (no-op côté attribut `open`, sans effet en dehors des tests — les
  navigateurs réels et Playwright implémentent nativement ces méthodes).
- **Bug latent détecté et corrigé** dans `tests/integration/community-auto-share.test.tsx` (fichier
  actuellement `describe.skip`, donc jamais exécuté avant cette session) : son helper `isPost`
  vérifiait uniquement `init?.method === 'POST'`, sans regarder l'URL — il confondait donc le `POST
  /community-price` avec le `POST /visit` (specs/006-anonymous-visit-count, envoyé automatiquement à
  chaque montage de `AppShell`). Corrigé pour vérifier aussi que l'URL contient `/community-price`,
  et tous les points d'appel existants mis à jour en conséquence — ce correctif profite aussi aux
  tests préexistants de ce fichier, pas seulement aux nouveaux de cette révision.
- Les nouveaux tests d'intégration US1 (T007) ont été vérifiés en conditions réelles en levant
  temporairement le `describe.skip` (avec `price-mode.ts` mocké via `vi.mock`, sans jamais modifier
  le fichier produit ni le flag `COMMUNITY_MODE_ENABLED`) : les 4 nouveaux scénarios passent. Le
  `describe.skip` d'origine a ensuite été restauré à l'identique.
- `npm run typecheck` : ✅ aucune erreur.
- `npx tsc --noEmit -p worker/tsconfig.json` : ✅ aucune erreur.
- `npx eslint .` : ✅ 16 problèmes préexistants (1 erreur hors périmètre, 15 avertissements
  `react-hooks/*`), exactement la même baseline que documentée dans specs/004-006 — aucun nouveau
  problème introduit par cette fonctionnalité.
- `npm run test` (Vitest) : ✅ 173 tests passés, 22 skipped (dont le bloc communautaire toujours
  désactivé), 2 todo — nouveaux : `tests/unit/outlier-threshold.test.ts` (4),
  `tests/unit/community-price-outlier.test.ts` (3), 4 nouveaux `it(...)` dans
  `tests/integration/community-auto-share.test.tsx` (comptés dans les 22 skipped tant que le Mode
  communautaire reste désactivé), extension mineure de `tests/unit/resource-price-input.test.tsx`
  (type du mock `onCommit` mis à jour, mêmes assertions).
- `npm run build` : ✅ build de production réussi (104 modules, +2 pour `outlier-threshold.ts` et
  `OutlierConfirmDialog.tsx`).
- `npm run test:e2e` : ⚠️ n'a pas pu être exécuté dans cet environnement — même limitation système que
  documentée dans specs/004-006 (`libnspr4.so: cannot open shared object file`, Chromium headless ne
  peut pas se lancer ici), sans lien avec cette fonctionnalité (aucun scénario e2e n'a été modifié).
- Migration de production (`npm run worker:db:migrate-outlier-tracking`), redéploiement du Worker et
  redéploiement du frontend : **non exécutés** — nécessitent les identifiants Cloudflare de
  l'utilisateur, action manuelle hors de cette session (même catégorie que T012 de
  specs/004-community-price-sharing révision 2). Voir tasks.md, T017-T019.

## Résultat de l'exécution (révision bis, ne plus écraser la saisie du joueur)

- **Changement de code** : dans `RecherchePage.tsx` (`CommunityResourcePriceRow.handleCommit`), la
  ligne `if (refreshed?.kind === 'found') onChange(String(refreshed.price.medianAmountKamas));` a été
  supprimée ; `commit(amount)` reste appelé pour transmettre la contribution et rafraîchir le nombre de
  contributions affiché, mais son résultat n'écrit plus le champ.
- **Tests étendus** (`tests/integration/community-auto-share.test.tsx`, dans le `describe.skip`
  existant) : deux nouvelles assertions `expect(input).toHaveValue(...)` vérifient que le champ garde
  la valeur saisie par le joueur après un commit réussi, sur le chemin direct (1000, mock median 1200)
  et sur le chemin confirmé (1300, mock median 1000).
- **Bug latent détecté et corrigé pendant la vérification** (en levant temporairement le
  `describe.skip`, même procédure que la première révision) : l'assertion du test « sends exactly one
  POST with only resourceId/serverId/amountKamas... » ne comptait pas `deviceId` dans le corps de la
  requête, alors que ce champ est envoyé depuis specs/004 révision 5 — corrigé pour l'inclure. Sans
  rapport avec cette révision, ce test restait simplement faux depuis plusieurs révisions car jamais
  exécuté (`describe.skip`).
- `npm run typecheck` : ✅ aucune erreur.
- `npx eslint .` : les seuls avertissements sur `RecherchePage.tsx` (lignes 174/186,
  `react-hooks/set-state-in-effect`) sont préexistants et sans rapport avec ce changement (aucun near
  `handleCommit`) ; les erreurs supplémentaires observées viennent de `worker/.wrangler/tmp/` (fichiers
  générés, ignorés par git, hors périmètre du code source).
- `npm run test` (Vitest) : ✅ 204 tests passés (dont les 9 du bloc communautaire, vérifiés en levant
  temporairement `describe.skip` avant de le restaurer à l'identique), 22 skipped, 2 todo. **2 échecs
  préexistants et sans rapport** dans `tests/integration/price-mode-settings.test.tsx` : ils découlent
  du fait que `COMMUNITY_MODE_ENABLED` est passé à `true` dans l'arbre de travail local (changement déjà
  présent avant cette session, non lié à cette révision) — ces tests supposaient le Mode communautaire
  encore désactivé. Non corrigés ici, hors périmètre de cette révision.
- `npm run build` : ✅ build de production réussi.
- `npm run test:e2e` : ⚠️ Chromium a pu se lancer dans cet environnement (contrairement à la première
  révision), mais 18 scénarios échouent dès l'écran de sélection de serveur ou par timeout de
  recherche — sans rapport apparent avec cette révision (aucun scénario e2e ne teste le Mode
  communautaire aujourd'hui, et le changement de code de cette révision est localisé à
  `handleCommit`). À investiguer séparément si besoin ; non bloquant pour cette révision ciblée.
