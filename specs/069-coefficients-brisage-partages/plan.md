# Plan d'implémentation : Coefficients de brisage partagés

**Spec** : `specs/069-coefficients-brisage-partages/spec.md`

## Contexte technique

React + Vite (front), Worker Cloudflare + D1 (`worker/`). Modèle : partage des prix communautaires
(`worker/src/contribution.ts`, `latest.ts`, `retention.ts`, `src/services/community-price-api.ts`).

## Constitution

- Principe I/III : le coefficient affiché garde sa date ; le plus récent du local et du partagé gagne.
- Principe II : règles (validation, fusion, limite de reprise, purge) en fonctions pures testées.
- Principe V : seul un identifiant d'appareil anonyme est stocké, jamais renvoyé par la lecture.
- Échec sûr : aucune valeur inventée, aucune erreur bloquante si le serveur est indisponible.

## Conception

### Worker
- Migration `worker/migrations/0021_add_brisage_coefficients.sql` + `worker/schema.sql` : table
  `brisage_coefficients (id, server_id, item_id, coefficient, noted_at, device_id)`, index
  `(server_id, item_id, noted_at)` et `(noted_at)`, unicité `(server_id, item_id, noted_at, device_id)`
  (un renvoi du même coefficient est sans effet : l'envoi est rejouable).
- `worker/src/brisage-coefficients.ts` :
  - `parseCoefficientPayload` : `{ deviceId, entries: [{ serverId, itemId, coefficient, notedAt? }] }`
    (1 à 100 entrées). Coefficient dans ]0 ; 4000], date valide, ni future (+5 min de marge) ni
    antérieure à 90 jours ; sans `notedAt`, la date du serveur. Les entrées invalides rendent un 400.
  - `insertCoefficients` (batch, `INSERT OR IGNORE`), `coefficientsResponse` (GET
    `/brisage-coefficients?serverId=&itemIds=a,b`, ≤ 98 objets : le plus récent de moins de 90 jours par
    objet ; ne renvoie jamais `device_id`), `purgeExpiredCoefficients`.
- `worker/src/index.ts` : GET (public, cache 60 s), POST (clé d'application + limiteur par IP, vide le
  cache) ; purge dans le cron hebdomadaire existant.
- `package.json` : script `worker:db:migrate-brisage-coefficients` (non exécuté).

### Front
- `src/services/brisage-coefficient-api.ts` : `getSharedCoefficients(serverId, itemIds)` (undefined si
  échec), `submitCoefficients(entries)` (booléen). Ne lèvent jamais.
- `src/persistence/brisage-coefficients.ts` : `latestCoefficient(a, b)`, `listImportableCoefficients()`
  (ignore ce qui est avant `IMPORT_NOT_BEFORE = 2026-10-21T15:30:00Z`), drapeau « déjà repris ».
- `src/features/brisage/use-shared-coefficients.ts` : lit les coefficients partagés des objets
  demandés (par paquets, mémoire de session) ; `BrisagePage` et `ItemFinder` affichent le plus récent
  du local et du partagé. À la note, enregistrement local puis envoi.
- Reprise : au premier affichage de la page Brisage, envoi unique des coefficients locaux
  importables ; drapeau posé seulement après succès (ou liste vide).

## Tests
- Unitaires worker (SQLite en mémoire) : validation, insertion idempotente, lecture (plus récent, 90 j,
  pas de device_id, autre serveur/objet), purge, schéma/migration.
- Unitaires front : fusion, liste importable (limite, entrées invalides), drapeau.
- Intégration page : coefficient partagé affiché, note envoyée, repli serveur muet, reprise unique.
