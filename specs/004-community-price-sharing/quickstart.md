# Quickstart: Validation du partage communautaire des prix

## Prérequis

- Node.js 24 LTS et npm disponibles.
- Un navigateur moderne avec `localStorage`/`sessionStorage` activés (pas de navigation privée
  pour les parcours de persistance).
- Un serveur actif déjà sélectionné (002-server-scoped-prices), le mode communautaire déjà
  activable (003-community-price-mode), et une recette avec au moins une ressource.
- Un compte Cloudflare (gratuit, sans carte bancaire requise) avec `wrangler` authentifié
  (`npx wrangler login`), une base D1 créée (`npx wrangler d1 create dofus-craft-community-prices`,
  puis reporter l'`database_id` renvoyé dans `worker/wrangler.toml`) et son schéma appliqué
  (`npm run worker:db:init`). Le Worker déployé (`npm run worker:deploy`) et son secret défini
  (`npx wrangler secret put COMMUNITY_API_KEY --config worker/wrangler.toml`). L'URL du Worker
  déployé et cette même clé sont fournies à l'application via des variables d'environnement Vite
  (`VITE_COMMUNITY_API_URL`, `VITE_COMMUNITY_API_KEY`), non commitées (`.env.local`) — voir
  `.env.example`.

## Vérification manuelle du schéma (avant tout test applicatif)

Avec `wrangler d1 execute dofus-craft-community-prices --config worker/wrangler.toml --command "..."`
(cf. décision actée en research.md : pas d'environnement Workers complet en CI pour un backend
aussi restreint) :

1. Insérer trois contributions de test pour la même ressource/serveur, dont une valeur aberrante
   (ex. 1, 1000, 1 000 000) ; appeler `GET /community-price?resourceId=...&serverId=...` sur le
   Worker déployé et vérifier que la valeur aberrante est écartée du calcul (FR-012).
2. Vérifier qu'aucune route du Worker ne renvoie une contribution individuelle (seule la médiane
   agrégée est exposée, FR-010) — lecture du code de `worker/src/index.ts` suffit, aucune route de
   ce type n'existe.
3. Insérer une contribution avec un `created_at` simulé à plus de 90 jours et vérifier qu'elle est
   exclue du résultat de `GET /community-price` (FR-013).
4. **Depuis la révision 2** : confirmer que `worker/src/index.ts` n'expose plus que `GET`/
   `POST /community-price` — `DELETE /community-price/:id` a été retiré (retrait rétroactif
   supprimé du produit) ; un appel `DELETE` sur le Worker déployé doit désormais échouer (route
   inexistante), à vérifier après redéploiement (`npm run worker:deploy`).
5. **Depuis la révision 5, une seule fois** : appliquer la migration `device_id` sur la base déjà en
   production (elle contient déjà des lignes, contrairement à `worker:db:init` qui ne fait rien sur
   une table déjà créée) :
   ```bash
   npm run worker:db:migrate-device-id
   ```
   Puis vérifier `PRAGMA table_info(community_price_contributions);` (via
   `wrangler d1 execute ... --command`) pour confirmer que `device_id` existe avec `NOT NULL DEFAULT
   ''` ; les lignes déjà présentes doivent avoir `device_id = ''` (FR-021 ne s'applique qu'aux
   contributions envoyées après cette migration, pas rétroactivement). Envoyer une nouvelle
   contribution de test avec un `deviceId` non vide et confirmer qu'elle est bien stockée avec cette
   valeur, sans affecter le résultat de `GET /community-price` (FR-023 : ni le calcul ni l'affichage
   de la médiane ne changent).

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
exposées dans [contracts/community-price-api.md](./contracts/community-price-api.md), en plus des
contrats existants des fonctionnalités 001, 002 et 003. Les appels au backend communautaire sont mockés via
`vi.stubGlobal('fetch', ...)` dans les tests Vitest (même pattern que
`tests/unit/dofusdb-api.test.ts`) et via l'interception réseau de Playwright pour les tests e2e —
aucun test n'appelle le vrai Worker Cloudflare déployé.

## Parcours de validation

### 1. Prix communautaire pré-rempli, directement modifiable (US1)

1. En Mode communautaire, sur un serveur où des contributions existent déjà (insérées via l'étape
   de vérification manuelle du schéma) pour une ressource donnée n'ayant encore aucune entrée dans
   le carnet Mode communautaire, consulter cette ressource.

**Résultat attendu**: le champ de prix est déjà pré-rempli avec le prix communautaire (médiane),
directement modifiable ; le nombre de contributions est visible de façon compacte, sans ligne
supplémentaire dans la colonne.

2. Modifier cette valeur pré-remplie.

**Résultat attendu**: le coût de craft se met à jour immédiatement avec la nouvelle valeur ; en
rouvrant la même ressource plus tard (même session ou après rechargement), la valeur modifiée reste
affichée, jamais réécrasée par le prix communautaire d'origine.

3. Consulter une ressource sans aucune contribution sur ce serveur.

**Résultat attendu**: le champ reste vide et directement saisissable, sans état d'indisponibilité
bloquant.

4. Changer de serveur actif puis revenir consulter la même ressource.

**Résultat attendu**: le prix utilisé pour le pré-remplissage correspond bien au serveur actif à
chaque consultation.

### 2. Le Mode communautaire ne dépend jamais du Mode personnel (US2)

1. En Mode personnel, saisir un prix pour une ressource. Passer en Mode communautaire et consulter
   cette même ressource.

**Résultat attendu**: le champ affiche le prix communautaire pré-rempli (ou reste vide si aucun
n'existe) — jamais le prix personnel saisi à l'étape précédente.

2. En Mode communautaire, modifier ou saisir un prix pour une ressource. Repasser en Mode
   personnel et consulter cette même ressource.

**Résultat attendu**: le prix personnel d'origine (ou l'absence de prix) est inchangé ; la valeur
saisie en Mode communautaire n'y apparaît jamais.

3. Avec des valeurs différentes dans les deux carnets pour une même ressource, consulter le calcul
   de coût de craft dans chaque mode.

**Résultat attendu**: seul le carnet du mode actif est utilisé, jamais une combinaison des deux.

### 3. Chaque prix corrigé devient automatiquement une contribution (US3)

1. Passer en Mode communautaire et consulter les Paramètres.

**Résultat attendu**: aucune action de partage manuelle ou groupée n'y est proposée — la section
« Partage communautaire » et son bouton n'existent plus (SC-005).

2. Sur une ressource sans valeur encore enregistrée dans le carnet Mode communautaire, saisir un
   prix puis quitter le champ (perte de focus), en observant l'onglet réseau du navigateur.

**Résultat attendu**: une requête `POST /community-price` part immédiatement, ne contenant que la
ressource, le serveur et le montant saisi — aucune information identifiant le joueur ; juste après,
une requête `GET /community-price` rafraîchit le champ avec la médiane à jour, et le nombre de
contributions affiché augmente d'une unité (SC-004, SC-010).

3. Cliquer sur le bouton de déverrouillage d'un champ déjà rempli, puis quitter le champ sans rien
   taper (perte de focus sans changement).

**Résultat attendu**: aucune requête `POST /community-price` ne part ; le nombre de contributions
affiché reste inchangé (FR-020, US3 scénario 5).

4. Simuler l'échec de la requête `POST /community-price` (ex. interception réseau), puis modifier un
   prix de ressource et quitter le champ.

**Résultat attendu**: la valeur saisie par le joueur reste affichée et utilisable dans son carnet
Mode communautaire, sans message d'erreur bloquant ; aucune requête `GET` de rafraîchissement n'est
tentée suite à cet échec ; une nouvelle tentative d'envoi n'a lieu qu'à la prochaine modification
confirmée de ce même champ (FR-020, US3 scénario 4).

### 4. Résilience en cas d'indisponibilité (US4)

1. Simuler l'indisponibilité du service communautaire (ex. intercepter et faire échouer la requête
   réseau correspondante).
2. Consulter, en Mode communautaire, une ressource déjà vue pendant la session (dernier prix
   communautaire connu localement).

**Résultat attendu**: ce dernier prix connu pré-remplit le champ, marqué comme potentiellement daté
de façon compacte ; la saisie et le calcul de rentabilité en Mode communautaire restent pleinement
fonctionnels.

3. Consulter une ressource jamais vue pendant cette session, toujours avec le service indisponible.

**Résultat attendu**: le champ reste vide et directement saisissable, sans erreur bloquante ni
message d'indisponibilité qui empêcherait la saisie.

### 5. Distinguer les contributions par appareil, sans identifier le joueur (US5)

1. Envoyer, depuis un même navigateur/appareil, une contribution pour deux ressources différentes
   (Mode communautaire, saisie puis perte de focus sur chaque champ).

**Résultat attendu** (via `wrangler d1 execute ... --command "SELECT device_id FROM
community_price_contributions ORDER BY created_at DESC LIMIT 2;"`) : les deux lignes ont exactement
le même `device_id`, une chaîne UUID non vide.

2. Depuis un autre navigateur (ou après avoir effacé les données du site dans le même navigateur),
   envoyer une nouvelle contribution.

**Résultat attendu**: son `device_id` diffère de celui de l'étape 1 — rien dans les données stockées
ne permet de relier les deux appareils entre eux, ni d'identifier qui les utilise.

3. Consulter le prix communautaire (médiane) affiché pour une ressource ayant reçu des contributions
   de plusieurs appareils différents.

**Résultat attendu**: rien dans l'interface (champ de prix, compteur de contributions) n'affiche ni
ne laisse deviner un `device_id` — le comportement visible est identique à avant la révision 5
(FR-023).

## Revue des sites d'appel de submitCommunityPrice

**À rejouer pour la révision 5** : `grep -rn "getOrCreateDeviceId" src/` (hors tests) doit confirmer
un seul appelant, `submitCommunityPrice` dans `src/services/community-price-api.ts` ; aucun autre
fichier de production ne doit importer `community-device-id.ts` directement. `grep -rn "deviceId" src/features/`
doit ne renvoyer aucun résultat — l'identifiant d'appareil reste entièrement interne au service
(`services/`) et à la persistance (`persistence/`), jamais manipulé par une page ou un composant.

**À rejouer pour la révision 4** (la revue ci-dessous date de la révision précédente et décrit un
mécanisme désormais retiré) : `grep -rn "submitCommunityPrice" src/` (hors tests) doit confirmer un
seul site d'appel, à l'intérieur de `src/features/comparison/useCommunityPrice.ts` (fonction
`commit`), lui-même appelé uniquement depuis `CommunityResourcePriceRow` dans
`src/features/search/RecherchePage.tsx` — plus aucune référence dans
`src/features/settings/ParametresPage.tsx`, dont la section « Partage communautaire » doit avoir
entièrement disparu (aucun bouton, aucun état `ShareResult`). `grep -rn "ShareResult\|handleShareAll\|shareEntries\|handleRetryFailed" src/`
doit ne renvoyer aucun résultat. `grep -rn "getCommunityPrice" src/` doit toujours confirmer un seul
point d'appel, `src/features/comparison/useCommunityPrice.ts`, invoqué uniquement en Mode
communautaire.

<details>
<summary>Revue de la révision 2 (pour mémoire — bouton de partage groupé, retiré depuis)</summary>

`grep -rn "submitCommunityPrice" src/` (hors tests) confirmait un seul site d'appel,
`src/features/settings/ParametresPage.tsx` (`handleShareAll`/`shareEntries`), sans plus aucune
condition liée à un état de consentement — le bouton « Partager tous mes prix avec la communauté »
était visible dès `priceMode === 'community'`, sans réglage préalable.

</details>

<details>
<summary>Revue « hors consentement » de la révision précédente (2026-09-16, pour mémoire — mécanisme retiré)</summary>

`grep -rn "submitCommunityPrice" src/` (hors tests) confirmait un seul site d'appel,
`src/features/settings/ParametresPage.tsx` (`handleShareAll`/`shareEntries`), à l'intérieur de la
branche `{shareConsent && (<div className="settings-share-all"><button onClick={...}>...)}` — le
bouton n'existait dans le DOM que lorsque `shareConsent === true`.

</details>

## Résultat de l'exécution de la révision 1 (2026-09-16, avant la révision 2 — pour mémoire)

<details>
<summary>Détail (mécanisme de consentement/retrait encore présent à cette date)</summary>

- `npm run typecheck` (frontend) : ✅ aucune erreur.
- `npx tsc --noEmit -p worker/tsconfig.json` (Worker, inchangé par cette révision) : ✅ aucune erreur.
- `npx eslint .` : ✅ aucune nouvelle erreur ni avertissement introduits par cette révision (1 erreur
  préexistante hors périmètre dans `tests/integration/epingles-prices.test.tsx`, mêmes avertissements
  `react-hooks/set-state-in-effect` déjà présents avant cette révision dans `RecherchePage.tsx`,
  sur du code non touché par ce travail).
- `npm run test` (Vitest) : ✅ 156 tests passés, 2 skipped, 2 todo — dont les nouveaux/révisés de
  cette itération (`community-mode-price-repository`, `community-price-prefill`,
  `community-price-isolation`, `community-bulk-share`, `community-price-offline` réécrit,
  `community-consent`/`community-consent-withdrawal` mis à jour, `price-mode-preserves-personal-prices`
  mis à jour). L'ancien `community-price-priority.test.tsx` et `community-price-display.test.tsx`
  ont été supprimés (comportement remplacé, voir spec.md).
- `npm run build` : ✅ build de production réussi.
- `npm run test:e2e` : ⚠️ n'a pas pu être exécuté dans cet environnement — même limitation système
  que lors de la première itération (`libnspr4.so: cannot open shared object file`, Chromium headless
  ne peut pas se lancer ici), reconfirmée pour cette révision.

</details>

## Résultat de l'exécution de la première itération (2026-09-16 — pour mémoire)

<details>
<summary>Détail (bloc de lecture séparé et bouton de contribution par ressource, retirés depuis)</summary>

- `npm run typecheck` (frontend) : ✅ aucune erreur.
- `npx tsc --noEmit -p worker/tsconfig.json` (Worker, projet TypeScript séparé) : ✅ aucune erreur.
- `npx eslint .` : ✅ aucune nouvelle erreur ni avertissement introduits par cette fonctionnalité
  (1 erreur préexistante hors périmètre dans `tests/integration/epingles-prices.test.tsx`,
  quelques avertissements `react-hooks/set-state-in-effect` déjà présents ailleurs dans le projet
  avant cette itération, sur un pattern identique à celui déjà utilisé par `useResourcePrices.ts`).
- `npm run test` (Vitest) : ✅ 140 tests passés, 2 skipped, 2 todo — dont les tests de cette
  fonctionnalité (`community-price-api`, `community-price-median` pour `worker/src/median.ts`,
  `community-consent-preference`, `community-contributions`, `community-price-display`,
  `community-price-offline`, `community-consent`, `community-price-priority`,
  `community-consent-withdrawal`), plus la mise à jour de `price-mode-settings.test.tsx` (le mode
  communautaire n'est plus désactivé).
- `npm run build` : ✅ build de production réussi (le dossier `worker/` n'est pas inclus dans le
  build Vite, il a son propre cycle de déploiement via `wrangler`).
- `npm run test:e2e` : ⚠️ n'a pas pu être exécuté dans cet environnement : le navigateur Chromium
  headless de Playwright échoue au lancement (`libnspr4.so: cannot open shared object file`),
  limitation système préexistante de cet environnement, déjà rencontrée et documentée lors d'une
  itération précédente de ce projet, sans rapport avec cette fonctionnalité. Les scénarios e2e
  (`tests/e2e/community-price-sharing.spec.ts`, mise à jour de `tests/e2e/price-mode.spec.ts`) sont
  écrits et devraient être exécutés dans un environnement où Chromium peut se lancer avant de
  considérer cette fonctionnalité entièrement validée.
- Vérification manuelle du schéma (section ci-dessus) : ✅ exécutée en conditions réelles le
  2026-09-16 contre le Worker effectivement déployé (`https://dofus-craft-community-price-api.handy-apps.workers.dev`)
  et sa base D1 : `GET /community-price` sans données renvoie 404 ; `POST`/`DELETE` sans la clé
  `COMMUNITY_API_KEY` renvoient 401 ; trois contributions valides (1000, 1100, 900) plus une valeur
  aberrante (1 000 000) donnent une médiane de 1000 kamas avec `sampleSize: 3` — la valeur
  aberrante est bien écartée (FR-010) ; `DELETE /community-price/:id` renvoie 204 et est idempotent
  (un second appel sur le même id renvoie aussi 204, FR-012) ; après suppression de toutes les
  contributions de test, `GET` redevient 404 (FR-011/FR-012 vérifiés en conditions réelles).
  Contributions et clé de test nettoyées après vérification.

</details>

## Résultat de l'exécution de la révision 2 (2026-09-16)

- `npm run typecheck` (frontend) : ✅ aucune erreur.
- `npx tsc --noEmit -p worker/tsconfig.json` (Worker, route `DELETE` retirée) : ✅ aucune erreur.
- `npx eslint .` : ✅ aucune nouvelle erreur ni avertissement introduits par cette révision (mêmes
  1 erreur préexistante hors périmètre et mêmes avertissements `react-hooks/set-state-in-effect`
  déjà présents avant cette révision, sur du code non touché par ce travail).
- `npm run test` (Vitest) : ✅ 142 tests passés, 2 skipped, 2 todo (156 → 142 : retrait de
  `community-consent-preference.test.ts`, `community-contributions.test.ts` et
  `community-consent-withdrawal.test.tsx`, modules et fonctionnalité supprimés ; `community-consent.test.tsx`
  recentré, `community-bulk-share.test.tsx` adapté — le bouton de partage groupé est toujours
  disponible dès le Mode communautaire actif, sans étape de consentement).
- `npm run build` : ✅ build de production réussi (97 modules, contre 99 avant cette révision — les
  deux modules de persistance retirés).
- `grep -rn "ShareConsent\|shareConsent\|community-consent-preference\|community-contributions\|withdrawCommunityContribution\|LocalContributionRecord" src/ tests/` : ✅ aucun résultat.
- `npm run test:e2e` : ⚠️ n'a pas pu être exécuté dans cet environnement — même limitation système
  que lors des révisions précédentes (`libnspr4.so: cannot open shared object file`, Chromium
  headless ne peut pas se lancer ici), reconfirmée pour cette révision. Les scénarios e2e
  (`tests/e2e/community-price-sharing.spec.ts`) ont été mis à jour (plus d'étape de consentement,
  scénarios de retrait rétroactif supprimés) mais devront être exécutés dans un environnement où
  Chromium peut se lancer avant de considérer cette révision entièrement validée de bout en bout.
- Redéploiement du Worker et vérification manuelle que `DELETE /community-price/:id` n'existe plus
  (T012) : **non exécuté** — nécessite les identifiants Cloudflare de l'utilisateur, action
  manuelle hors de cette session (voir tasks.md).

## Résultat de l'exécution de la révision 4 (2026-09-17)

- `npm run typecheck` (frontend) : ✅ aucune erreur.
- Worker (`worker/`) : non touché par cette révision, non re-vérifié séparément (aucun changement de
  code source dans ce dossier).
- `npx eslint .` : ✅ aucune nouvelle erreur ni avertissement introduits par cette révision (mêmes
  16 problèmes préexistants — 1 erreur hors périmètre dans `tests/integration/epingles-prices.test.tsx`,
  15 avertissements `react-hooks/set-state-in-effect`/`exhaustive-deps` déjà présents ailleurs dans
  le projet avant cette révision, sur du code non touché par ce travail, à l'identique avant et
  après ces changements).
- `npm run test` (Vitest) : ✅ 152 tests passés, 2 skipped, 2 todo (142 → 152 : retrait de
  `community-bulk-share.test.tsx` et `community-consent.test.tsx` — 4 nouveaux tests d'unité pour
  `onCommit` dans `resource-price-input.test.tsx`, 2 nouveaux tests d'intégration dans
  `community-price-prefill.test.tsx` [FR-017/FR-018/FR-019/FR-020], 5 nouveaux tests dans
  `community-auto-share.test.tsx` qui remplace les deux fichiers retirés).
- `npm run build` : ✅ build de production réussi (97 modules — inchangé, aucun fichier source ajouté
  ou retiré cette fois-ci, seulement des modifications internes).
- `grep -rn "handleShareAll\|shareEntries\|handleRetryFailed\|ShareResult\|settings-share-all" src/ tests/` : ✅ aucun résultat.
- `npm run test:e2e` : ⚠️ n'a pas pu être exécuté dans cet environnement — même limitation système
  que lors des révisions précédentes (`libnspr4.so: cannot open shared object file`, Chromium
  headless ne peut pas se lancer ici), reconfirmée pour cette révision, et affectant indistinctement
  tous les fichiers e2e du projet (pas seulement ceux de cette fonctionnalité). Le scénario e2e
  remplacé (`tests/e2e/community-price-sharing.spec.ts`, US1/US3) est écrit mais n'a pas pu être
  exécuté ; il devra l'être dans un environnement où Chromium peut se lancer avant de considérer
  cette révision entièrement validée de bout en bout.
- **Bug détecté et corrigé pendant l'implémentation** (avant tout commit, via le test T009) : la
  fonction `commit` de `useCommunityPrice.ts` renvoyait, en cas d'échec de soumission, l'état
  `state` du hook — qui restait `kind: 'found'` avec l'ancienne médiane. Le code appelant
  (`RecherchePage.tsx`) ne pouvait alors pas distinguer un échec d'un succès et écrasait la valeur
  que le joueur venait de taper avec l'ancienne médiane. Corrigé en faisant renvoyer `undefined` à
  `commit` en cas d'échec, propagé jusqu'à la vérification `refreshed?.kind === 'found'` côté
  appelant ; couvert par un test dédié (« keeps the locally typed value and does not refresh when a
  confirmed edit fails to submit »).
- Aucun redéploiement du Worker n'est nécessaire pour cette révision (aucune route, aucun schéma
  modifié) — T012 de la révision 2 (redéploiement suite au retrait de `DELETE`) reste un item séparé
  et non résolu par ce travail, voir la section précédente.

## Résultat de l'exécution de la révision 5

- `npm run typecheck` (frontend) : ✅ aucune erreur.
- `npx tsc --noEmit -p worker/tsconfig.json` (Worker, `ContributionPayload`/`isContributionPayload`/
  `handlePostContribution` modifiés) : ✅ aucune erreur.
- `npx eslint .` : ✅ aucune nouvelle erreur ni avertissement introduits par cette révision (mêmes
  16 problèmes préexistants qu'avant ce travail).
- `npm run test` (Vitest) : ✅ 156 tests passés, 18 skipped (dont les tests désactivés en même temps
  que le Mode communautaire, `COMMUNITY_MODE_ENABLED = false`), 2 todo — nouveaux :
  `tests/unit/community-device-id.test.ts` (4 tests), 2 nouveaux cas dans
  `tests/unit/community-price-api.test.ts` (deviceId présent et non vide dans le corps du `POST`,
  réutilisé entre deux soumissions successives).
- `npm run build` : ✅ build de production réussi (99 modules — +1 pour le nouveau module
  `community-device-id.ts`).
- `grep -rn "deviceId" src/features/` : ✅ aucun résultat — l'identifiant reste confiné à
  `services/`/`persistence/`.
- `npm run test:e2e` : ⚠️ n'a pas pu être exécuté dans cet environnement — même limitation système
  que lors des révisions précédentes (`libnspr4.so: cannot open shared object file`), sans lien avec
  cette révision (aucun scénario e2e n'a été modifié, le `deviceId` n'affecte aucun comportement
  visible).
- Migration de production (`npm run worker:db:migrate-device-id`, T009) : ✅ exécutée contre la base
  réelle `dofus-craft-community-prices` (1 ligne modifiée — le schéma, pas les données). Vérification
  `PRAGMA table_info` : colonne `device_id TEXT NOT NULL DEFAULT ''` bien présente.
- Redéploiement du Worker (`npm run worker:deploy`, T010) : ✅ effectué
  (`https://dofus-craft-community-price-api.handy-apps.workers.dev`). Vérification manuelle en
  conditions réelles : un `POST /community-price` sans `deviceId` renvoie désormais `400` ; un envoi
  complet avec `deviceId` est accepté (`201`) et stocké avec la bonne valeur dans `device_id` ;
  contribution et clé de test nettoyées après vérification (`DELETE ... WHERE resource_id =
  'smoke-test'`).
