# Research : administration des clés sniffer et du mapping

## R1 — Format et empreinte de la clé

- **Décision** : clé = `dcp_` + 32 octets aléatoires (`crypto.getRandomValues`) en hexadécimal
  (68 caractères). Empreinte = `sha256Hex(clé)` importée de `worker/src/fm/http.ts`, la fonction
  qu'utilise déjà `authenticateSnifferKey` (`worker/src/sniffer.ts`).
- **Pourquoi** : 256 bits d'entropie ; le préfixe permet de reconnaître une clé collée au mauvais
  endroit ; réutiliser la fonction garantit que l'empreinte stockée est celle que l'API compare.
  L'API retire les espaces autour de la clé (`trim`) : la clé ne contient aucun espace.
- **Alternatives** : UUID comme clé (122 bits, moins lisible comme secret) ; recopier le calcul
  SHA-256 dans l'admin (risque de divergence).

## R2 — Identifiant de la clé

- **Décision** : `crypto.randomUUID()`, comme les compteurs (`counters.ts`) et le data-model de 056.
- **Pourquoi** : devient le `device_id` des contributions ; aucune information personnelle.

## R3 — Ce que valide le dépôt d'un mapping

- **Décision** : `validateMappingUpload({ build, keymap, schema })`, fonction pure :
  1. `build` : `^\d+\.\d+\.\d+(\.\d+)?$`, 32 caractères au plus (forme du fichier `version` du
     client lu par l'outil, ex. `3.7.10.10`).
  2. chaque document : chaîne de 256 Ko au plus (`TextEncoder`), JSON valide, objet (ni tableau ni
     `null`).
  3. keymap : `price_list` est une chaîne non vide (le fichier actuel : `"price_list": "jzs"`).
  4. schema : `price_list` est un objet ; en partant de `price_list`, chaque `fields[].of` (chaîne)
     doit nommer une définition objet du schema dont le nom ne commence pas par `_` ; parcours en
     largeur avec ensemble des visités (un cycle ne boucle pas).
  Les clés commençant par `_` sont des notes : `_price_list` ne compte pas.
- **Pourquoi** : le plan exige que « `price_list` se résolve », la consigne de la session nomme au
  minimum l'entrée keymap et la définition schema ; suivre `of` attrape un schema déposé à moitié
  (le cas réel du 2026-10-12, où `price_list` cite `price_offer`). On ne valide pas davantage la
  forme des champs (`n`, `kind`) : c'est le travail de l'outil, et un contrôle plus strict risque de
  refuser une évolution légitime du format.
- **Alternatives** : ne vérifier que la présence de `price_list` (n'attrape pas un `of` cassé) ;
  valider tout le schema (couplage fort avec le parseur Rust).

## R4 — Enregistrer les documents

- **Décision** : stocker le texte reçu tel quel dans `keymap_json` / `schema_json`.
- **Pourquoi** : la config de l'API renvoie `JSON.parse` du texte stocké : le contenu servi est
  exactement le contenu déposé (SC-004), notes `_` comprises.

## R5 — Activer sans jamais avoir deux actifs

- **Décision** : un lot D1 (transaction) : `UPDATE … SET active = 0 WHERE build = ? AND active = 1
  [AND id <> ?]` puis l'`INSERT … active = 1` (dépôt) ou l'`UPDATE … SET active = 1 WHERE id = ?`
  (réactivation). La réponse relit la ligne active du build.
- **Pourquoi** : l'index unique partiel `(build) WHERE active = 1` de 0018 refuse deux actifs ; dans
  la transaction, la désactivation passe d'abord. Deux dépôts concurrents sont sérialisés par D1 :
  le dernier gagne, l'autre reste dans l'historique.
- **Alternatives** : `INSERT … RETURNING id` dans le lot (la D1 simulée des tests ne renvoie pas les
  lignes d'un `run`) — la relecture de l'actif suffit et dit ce qui est réellement enregistré.

## R6 — Compteur du jour

- **Décision** : `LEFT JOIN sniffer_daily_usage u ON u.key_id = k.id AND u.day = ?` avec le jour UTC
  (`toISOString().slice(0, 10)`), comme `snifferBatchResponse`. `COALESCE(u.rows_written, 0)`.

## R7 — Révocation

- **Décision** : `UPDATE sniffer_keys SET revoked_at = COALESCE(revoked_at, ?) WHERE id = ?` ;
  0 ligne → 404. Pas de réactivation (une nouvelle clé à la place).

## R8 — Forme des routes

- **Décision** : actions en `POST …/:id/revoke` et `POST …/:id/activate` plutôt qu'un `PATCH`
  générique : chaque action a une seule signification et un seul test.
- Les erreurs de validation suivent le format existant `400 { error, field }`, lu par `admin-api.ts`.

## R9 — Vérifier en local sans affaiblir Access

- **Décision** : aucun contournement d'Access dans le code livré. Pour la vérification locale, un
  point d'entrée et une config wrangler **hors du dépôt** (dossier temporaire de la session)
  appellent `handleApi` avec un vérificateur de test et servent `dist-admin/` ; les deux
  `wrangler dev` (admin de test et API `worker/wrangler.toml`) et les `wrangler d1 execute --local`
  partagent le même `--persist-to`, donc la même D1 locale.
- **Pourquoi** : en local, aucun jeton Cloudflare Access valide n'existe ; une variable « dev » qui
  désactive la vérification serait un risque si elle partait en production. Une config hors dépôt
  ne peut pas être déployée par `npm run admin:deploy`.
- **Alternatives** : variable `DEV_BYPASS_ACCESS` (rejetée, risque) ; ne vérifier que par les tests
  (ne prouve pas le lien réel avec le Worker principal en `wrangler dev`).
