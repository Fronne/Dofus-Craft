# Contrat : réglage des sept pages du site

Complète le contrat des specs 050 et 053. Mêmes routes, même protection ; seuls les champs s'ajoutent.

## `GET /site-settings` (Worker public, sans authentification)

Toujours 200, jamais une erreur : des réglages illisibles donnent les valeurs par défaut.

```json
{ "searchPage": true, "pinnedPage": true, "pricesPage": true, "hdvPage": true,
  "petsPage": true, "forgemagiePage": false, "brisagePage": true }
```

Un réglage jamais enregistré a sa valeur par défaut (tout activé sauf Forgemagie).

## `GET /api/settings` (Worker d'administration, Cloudflare Access)

Même réponse que ci-dessus.

## `PUT /api/settings` (Worker d'administration)

Corps : uniquement les champs changés, par exemple `{ "brisagePage": false }`. Plusieurs champs sont écrits
ensemble ou pas du tout. Réponse 200 : l'état enregistré, relu (jamais un état supposé).

- **400** `{ "error": "Valeur attendue : activée ou désactivée.", "field": "<champ>" }` si un champ n'est pas
  booléen, ou si le corps ne contient aucun champ connu.
- **403** pour toute personne autre que le propriétaire.

## Compatibilité

- Un client qui ne connaît que `forgemagiePage` et `hdvPage` continue de fonctionner : les autres champs sont
  des ajouts.
- Un cache local ou une réponse sans les cinq nouveaux champs est lu avec leurs valeurs par défaut.
