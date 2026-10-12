# Contrat : réglages du site

## Lecture publique — Worker `worker/`

`GET /site-settings` — sans clé, `Cache-Control: no-store`.

- `200` `{ "forgemagiePage": false }` — toujours un objet complet ; `false` quand rien n'est
  enregistré.

Le site (`src/services/site-settings-api.ts`) ne lève jamais : toute erreur réseau, statut non 2xx
ou charge utile invalide donne `undefined`, et le site garde alors le dernier état connu.

## Administration — Worker `admin-worker/` (derrière Cloudflare Access)

Toutes les routes passent par `verifyOwner` ; sinon `403 { "error": "Accès réservé au propriétaire." }`.

- `GET /api/settings` → `200 { "forgemagiePage": boolean }`.
- `PUT /api/settings` avec `{ "forgemagiePage": boolean }` → `200` avec l'état enregistré.
  - `400 { "error": "…", "field": "forgemagiePage" }` si la valeur n'est pas un booléen.

## Interface

- **Administration** : section « Pages du site », ligne « Page Forgemagie » avec son état
  (« Activée » / « Désactivée ») et un bouton « Activer » ou « Désactiver ». Pendant
  l'enregistrement le bouton est inactif ; en cas d'échec, un message d'erreur et l'état précédent.
- **Site, page désactivée** : pas de lien « Forgemagie » dans la navigation ; `/forgemagie` affiche
  le titre « Forgemagie », « Forgemagie est momentanément indisponible » et un lien « Aller à la
  recherche ».
