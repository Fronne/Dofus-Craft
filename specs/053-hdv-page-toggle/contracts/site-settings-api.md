# Contrat : réglages du site (mise à jour de specs/050)

## Lecture publique — Worker `worker/`

`GET /site-settings` — sans clé, `Cache-Control: no-store`.

- `200` `{ "forgemagiePage": false, "hdvPage": true }` — toujours un objet complet ; chaque réglage
  jamais enregistré a sa valeur par défaut (Forgemagie désactivée, HDV activée), y compris quand la
  table ne peut pas être lue.

Le site ne lève jamais : erreur réseau, statut non 2xx ou charge utile invalide donnent `undefined`
et le dernier état connu reste appliqué. Une réponse sans `hdvPage` (Worker pas encore redéployé)
vaut `hdvPage: true`.

## Administration — Worker `admin-worker/` (derrière Cloudflare Access)

Toutes les routes passent par `verifyOwner` ; sinon `403 { "error": "Accès réservé au propriétaire." }`.

- `GET /api/settings` → `200 { "forgemagiePage": boolean, "hdvPage": boolean }`.
- `PUT /api/settings` avec un changement partiel, par exemple `{ "hdvPage": false }` → `200` avec
  l'objet complet relu. Seules les clés envoyées sont écrites.
  - `400 { "error": "Valeur attendue : activée ou désactivée.", "field": "<champ>" }` si un champ
    présent n'est pas un booléen, ou si aucun réglage connu n'est envoyé (champ `forgemagiePage`).

## Interface

- **Administration** : section « Pages du site », une ligne par page — « Page Forgemagie », puis
  « Page HDV » — avec son état (« Activée » / « Désactivée ») et un bouton « Activer » ou
  « Désactiver ». Pendant un enregistrement les boutons sont inactifs ; message de confirmation
  « Page HDV activée. » / « Page HDV désactivée. » ; en cas d'échec, un message d'erreur et l'état
  réellement enregistré.
- **Site, page HDV désactivée** : pas de lien « HDV » dans la navigation ; `/hdv` affiche le titre
  « HDV », « HDV est momentanément indisponible », « La page reviendra bientôt. Vos prix sont
  conservés. » et un lien « Aller à la recherche ».
