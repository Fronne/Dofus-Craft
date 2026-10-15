# Research : envoi des prix HDV par les amis — côté API

## R1 — Catalogue des ressources acceptées

- **Decision** : réutiliser l'ensemble que `huzounet.ts` appelle déjà `RESOURCE_IDS` :
  les valeurs de `worker/src/fm/priceable-items.json` plus `worker/src/priced-extras.json`, sorti
  dans `worker/src/resource-catalogue.ts`.
- **Rationale** : la source de vérité du site est `src/data/hdv-items.json` (ingrédients des recettes
  DofusDB + nourritures de familier, construit par `scripts/build-hdv-items.mjs`). Vérifié le
  2026-10-15 : ses 2700 ids sont tous dans cet ensemble (2909 ids), les 209 en plus étant les runes et
  les ressources « extras » dont le site affiche déjà le prix. Aucun équipement (ceux-ci sont dans
  `equipment-items.json`, à part). Rien de nouveau à embarquer dans le bundle du Worker.
- **Alternatives** : importer `hdv-items.json` (502 Ko) dans le Worker — plus gros bundle, mêmes ids ;
  une table D1 du catalogue — écritures et synchronisation en plus.

## R2 — `origin = 'sniffer'` et la contrainte CHECK

- **Decision** : migration 0019 qui reconstruit `community_price_contributions` avec
  `CHECK (origin IN ('manual', 'capture', 'bot', 'sniffer'))`, sur le modèle de 0017 (table `_new`,
  copie, suppression, renommage, index recréé).
- **Rationale** : SQLite ne sait pas modifier un CHECK ; D1 interdit `PRAGMA writable_schema`.
- **Coût** : la copie écrit chaque ligne existante (et son index) une fois — à mesurer avant
  l'application en remote (`SELECT COUNT(*)`), à comparer au quota de 100k lignes écrites/jour.
- **Alternatives** : `origin = 'capture'` (rejeté : confond avec les captures Forgemagie).

## R3 — Limites du plan gratuit

- **Decision** : au plus 200 observations par lot ; médianes lues par `fetchCurrentMedians` (98 ids
  par requête, donc ≤ 3 requêtes) ; insertions et compteur écrits en un seul `db.batch` (atomique).
- **Rationale** : plan gratuit = 1000 appels aux services Cloudflare et 10 ms CPU par invocation ;
  un appel `insertContribution` par ligne ferait 2 requêtes par ligne.
- **Conséquence** : la médiane de référence (`median_at_submission_kamas`) est celle connue au début
  du lot ; deux observations du même item dans un lot ont la même référence. Même calcul
  (`summarizeContributions`) que la saisie manuelle.

## R4 — Compteur journalier

- **Decision** : table `sniffer_daily_usage(key_id, day, rows_written)`, clé primaire
  `(key_id, day)`, jour UTC ; un UPSERT par lot accepté dans le même `db.batch` que les insertions.
  Plafond 5000 : si `déjà écrit + lignes du lot > 5000`, le lot entier est refusé (429).
- **Alternatives** : le binding `[[ratelimits]]` — compte des requêtes par période ≤ 60 s, pas des
  lignes par jour.

## R5 — `minVersion` / `downloadUrl`

- **Decision** : variables wrangler `SNIFFER_MIN_VERSION` et `SNIFFER_DOWNLOAD_URL` (`[vars]`).
  Valeurs par défaut dans le code si absentes : `0.0.0` et chaîne vide.
- **Rationale** : changer la version minimale = modifier `wrangler.toml` et redéployer, sans
  migration ni table élargie ; `site_settings` n'accepte que des booléens `'0'/'1'` (CHECK).

## R6 — Authentification et `last_seen_at`

- **Decision** : `Authorization: Bearer <clé>` ; empreinte SHA-256 hexadécimale minuscule de la clé
  brute, recherchée par index unique sur `key_hash`, `revoked_at IS NULL`. `last_seen_at` mis à jour
  à chaque appel authentifié (une écriture par appel : ~96/jour/ami pour la config toutes les 15 min).
- **Id de clé** : `TEXT` (UUID créé par l'admin, phase 3) ; il devient tel quel le `device_id` des
  contributions.

## R7 — Comparaison de versions

- **Decision** : versions `X.Y.Z` numériques comparées composante par composante ; une version
  absente ou illisible est traitée comme plus ancienne que tout (426).

## R8 — Écarts au contrat du plan

- `400` ajouté : corps illisible, `serverId` hors liste, plus de 200 observations, `build` ou
  `mappingId` manquant (le plan ne liste pas ce code).
- `409` aussi quand aucun mapping n'est actif pour le build envoyé.
- `GET /sniffer/config` ne renvoie jamais 426 : l'outil compare lui-même sa version à `minVersion`
  pour afficher `downloadUrl` ; `build` y est obligatoire (400 sinon).
- `seenAt` est validé mais non stocké (aucune nouvelle colonne) : la date de la contribution est celle
  de l'enregistrement.
- Raisons de refus par observation : `invalid`, `not_an_ingredient`, `no_price`.
