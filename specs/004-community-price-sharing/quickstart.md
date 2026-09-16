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
   Worker déployé et vérifier que la valeur aberrante est écartée du calcul (FR-010).
2. Vérifier qu'aucune route du Worker ne renvoie une contribution individuelle (seule la médiane
   agrégée est exposée, FR-007) — lecture du code de `worker/src/index.ts` suffit, aucune route de
   ce type n'existe.
3. Insérer une contribution avec un `created_at` simulé à plus de 90 jours et vérifier qu'elle est
   exclue du résultat de `GET /community-price` (FR-011).
4. Supprimer une contribution via `DELETE /community-price/:id` et vérifier sa disparition
   immédiate du résultat (FR-012).

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
exposées dans [contracts/community-price-api.md](./contracts/community-price-api.md) et
[contracts/share-consent.md](./contracts/share-consent.md), en plus des contrats existants des
fonctionnalités 001, 002 et 003. Les appels au backend communautaire sont mockés via
`vi.stubGlobal('fetch', ...)` dans les tests Vitest (même pattern que
`tests/unit/dofusdb-api.test.ts`) et via l'interception réseau de Playwright pour les tests e2e —
aucun test n'appelle le vrai Worker Cloudflare déployé.

## Parcours de validation

### 1. Consulter un prix communautaire réel (US1)

1. En mode communautaire, sur un serveur où des contributions existent déjà (insérées via l'étape
   de vérification manuelle du schéma) pour une ressource donnée, consulter cette ressource.

**Résultat attendu**: le prix communautaire (médiane) s'affiche, clairement identifié comme tel.

2. Consulter une ressource sans aucune contribution sur ce serveur.

**Résultat attendu**: un état explicite indique qu'aucun prix communautaire n'est encore
disponible — jamais un prix à zéro ni un espace vide ambigu.

3. Changer de serveur actif puis revenir consulter la même ressource.

**Résultat attendu**: le prix communautaire affiché correspond bien au serveur actif à chaque
consultation.

### 2. Contribuer après consentement explicite (US2)

1. En mode communautaire, sans avoir donné le consentement de partage, saisir un prix personnel.

**Résultat attendu**: aucune requête réseau vers le service communautaire n'apparaît dans l'onglet
réseau des outils de développement.

2. Donner explicitement le consentement de partage depuis les paramètres.

**Résultat attendu**: l'état « consentement actif » est confirmé clairement (SC-004 : effectif en
moins de 10 secondes).

3. Contribuer un prix personnel à la communauté.

**Résultat attendu**: la requête envoyée ne contient que la ressource, le serveur et le montant —
vérifiable dans l'onglet réseau, aucune information identifiant le joueur.

### 3. Le prix personnel reste toujours la référence (US3)

1. Pour une ressource avec un prix personnel et un prix communautaire différents, consulter le
   calcul de coût de craft.

**Résultat attendu**: le calcul utilise exclusivement le prix personnel ; le prix communautaire
reste visible séparément, jamais moyenné ni substitué.

### 4. Retirer son consentement, y compris rétroactivement (US4)

1. Consentement actif avec au moins une contribution déjà envoyée, retirer le consentement.

**Résultat attendu**: confirmation claire du retrait ; aucune nouvelle contribution n'est transmise
ensuite, même après modification d'un prix personnel.

2. Demander le retrait des contributions déjà envoyées.

**Résultat attendu**: elles cessent d'être prises en compte dans le prix communautaire affiché aux
autres joueurs (vérifiable en appelant `GET /community-price` avant/après) ; aucune information ne
relie cette demande à une identité de joueur.

### 5. Résilience en cas d'indisponibilité (US5)

1. Simuler l'indisponibilité du service communautaire (ex. intercepter et faire échouer la requête
   réseau correspondante).
2. Consulter une ressource déjà vue pendant la session.

**Résultat attendu**: le dernier prix communautaire connu de la session s'affiche, marqué comme
potentiellement daté ; le prix personnel et son calcul restent pleinement fonctionnels.

3. Consulter une ressource jamais vue pendant cette session, toujours avec le service indisponible.

**Résultat attendu**: un message explicite indique l'indisponibilité, sans bloquer la consultation
ni la saisie du prix personnel.

## Revue de non-transmission hors consentement (2026-09-16)

Recherche textuelle de tous les appels à `submitCommunityPrice`
([contracts/community-price-api.md](./contracts/community-price-api.md)) dans `src/` : un seul
site d'appel existe, dans `src/features/search/RecherchePage.tsx`, à l'intérieur de la branche
`shareConsent ? (<button onClick={...}>) : (<p>...</p>)` — le bouton qui déclenche l'appel n'existe
dans le DOM que lorsque `shareConsent === true` ; dans le cas contraire, seul un texte invitant à
activer le partage dans les Paramètres est rendu, sans aucun appel réseau. Confirmé également que
`getCommunityPrice` (lecture, non concernée par le consentement — FR-001/US1) est le seul autre
point d'appel réseau vers le backend communautaire, dans `CommunityPriceDisplay.tsx`.

## Résultat de l'exécution (2026-09-16, révisé après le passage à Cloudflare D1)

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
  2026-09-16 contre le Worker effectivement déployé (`https://dofus-craft-community-price-api.dofus-craft.workers.dev`)
  et sa base D1 : `GET /community-price` sans données renvoie 404 ; `POST`/`DELETE` sans la clé
  `COMMUNITY_API_KEY` renvoient 401 ; trois contributions valides (1000, 1100, 900) plus une valeur
  aberrante (1 000 000) donnent une médiane de 1000 kamas avec `sampleSize: 3` — la valeur
  aberrante est bien écartée (FR-010) ; `DELETE /community-price/:id` renvoie 204 et est idempotent
  (un second appel sur le même id renvoie aussi 204, FR-012) ; après suppression de toutes les
  contributions de test, `GET` redevient 404 (FR-011/FR-012 vérifiés en conditions réelles).
  Contributions et clé de test nettoyées après vérification.
