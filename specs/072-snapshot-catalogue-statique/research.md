# Research: snapshot statique du catalogue

## R1 — Où et comment servir le snapshot
- **Decision**: fichiers JSON dans `public/catalogue-snapshot/` (copiés tels quels dans `dist/` par Vite), gitignorés, générés par `prebuild`.
- **Rationale**: Cloudflare Workers static assets compresse automatiquement en brotli/gzip ; pas de format binaire maison ni de décompression côté client. Revalidation par ETag.
- **Alternatives**: gzip manuel + `DecompressionStream` (code en plus, compression déjà faite par le CDN) ; commiter le snapshot (diffs énormes, vieillit en silence) ; un seul fichier (items et panoplies se parsent et se retéléchargent indépendamment : 2 fichiers).

## R2 — Projection des champs
- **Decision**: le script ne garde que les champs lus par `dofusdb-mappers` et `catalogue-repository` (liste établie par recherche dans le code, couverte par un test d'équivalence mapper(brut) = mapper(projeté)).
- **Rationale**: réduit le JSON brut (parse mobile) et le poids ; objectif ≈ 1 Mo compressé.
- **Alternatives**: objets complets (plus simple, plus lourd, risque de dépasser l'objectif). Repli si la projection s'avère risquée : objets complets.

## R3 — Valeur de contrôle
- **Decision**: `GET /items?hasRecipe=true&$limit=0` et `GET /item-sets?$limit=0` → champ `total`, comparé aux `totals` du catalogue utilisé. Si `$limit=0` est refusé, repli `$limit=1`.
- **Rationale**: 2 requêtes minuscules ; valide avec le garde `isPage` existant.
- **Alternatives**: hash du contenu (impose de tout télécharger) ; version du jeu (non exposée de façon fiable).

## R4 — Quel catalogue gagne
- **Decision**: au lancement, lire `meta.json` (quelques octets) et comparer `generatedAt` à la date du cache IndexedDB : le plus récent est retenu. Cache plus récent ⇒ aucun téléchargement du snapshot.
- **Rationale**: évite 1 Mo à chaque visite ; un nouveau déploiement remplace naturellement un cache plus ancien.
- **Alternatives**: toujours télécharger le snapshot (perd le bénéfice du cache) ; ignorer le cache (régression vs spec 021).

## R5 — Éviter le recrawl hérité de la spec 021
- **Decision**: avec snapshot présent, ne pas passer par `cached('catalogue-item-index', crawl)` à l'ouverture : `cached()` relance sinon un crawl complet en fond dès que la copie gardée a plus de 24 h (`PERSISTED_FRESH_MS`). Le module snapshot amorce la mémoire via `seedCache` ; le crawl ne sert qu'en repli (R7) ou sur écart de total (R3).
- **Alternatives**: changer `PERSISTED_FRESH_MS` (touche toutes les clés du cache).

## R6 — Délai minimal et tolérance
- **Decision**: horodatage du dernier contrôle dans `localStorage` (clé dédiée, try/catch), 6 h ; sans stockage : un contrôle par session (variable de module).
- **Alternatives**: IndexedDB (plus lourd pour un entier).

## R7 — Repli
- **Decision**: snapshot 404, JSON invalide ou longueurs incohérentes avec `meta.totals` ⇒ comportement actuel inchangé (crawl complet). C'est aussi le mode `npm run dev` quand le snapshot n'a pas été généré.

## R8 — Échec et seuil à la génération
- **Decision**: le script quitte en erreur si DofusDB est injoignable, si un total est 0 ou si le nombre d'éléments récupérés ≠ total ; si un snapshot précédent existe, il exige au moins 50 % de son effectif. Écriture atomique (fichier temporaire puis renommage) : un snapshot valide n'est jamais écrasé par un échec.
- **Alternatives**: continuer le build avec un catalogue vide (interdit par FR-004).

## R9 — Coordination `perf-audit`
- **Decision**: seul le corps de `preloadCatalogueIndexes()` change dans `catalogue-repository.ts` ; la logique vit dans `catalogue-snapshot.ts`. Rebaser sur le différé de crawl de la session `perf-audit` avant fusion.
