# Contrat : bouton « Actualiser les prix » (page Recherche)

## Appel à l'API

`POST {API}/external-prices/refresh` — en-têtes habituels du client (`apiHeaders`), corps JSON :

```json
{ "serverId": "mikhal", "itemId": "14076", "ids": ["14076", "303", "16489"] }
```

- `ids` : `recipeRefreshIds(itemId, resourceIds)` — l'objet, puis les ressources de la chaîne de
  fabrication ; sans doublon ; seuls les identifiants `^\d+$` ; 90 au plus.
- Jamais de champ `tab` ni `last` (réservés au chargement d'un onglet HDV, specs/046).

| Réponse | Résultat (`RecipeRefreshOutcome`) | Message |
|---------|-----------------------------------|---------|
| 200 `{ "refreshed": n }`, n > 0 | `{ status: 'ok', refreshed: n }` | Prix actualisés. |
| 200 `{ "refreshed": 0 }` | `{ status: 'ok', refreshed: 0 }` | Les prix sont déjà à jour. |
| 429 | `{ status: 'too-soon' }` | Réessaie dans quelques secondes. |
| 404 | `{ status: 'not-read' }` | Les prix de ce serveur ne sont pas relus. |
| autre statut, corps illisible, `refreshed` absent, panne réseau | `{ status: 'unavailable' }` | Actualisation impossible pour le moment. |

La fonction ne lève jamais d'exception.

## Rendu

```html
<div class="prices-head">
  <h2>Prix des ressources</h2>
  <!-- seulement en Mode communautaire, avec un serveur et un objet choisis -->
  <div class="prices-refresh">
    <button type="button" class="btn btn-secondary btn-small" disabled?>
      <svg … class="prices-refresh-icon--busy"?/> Actualiser les prix | Actualisation…
    </button>
    <p role="status">message</p>   <!-- seulement s'il y a un message -->
  </div>
</div>
```

- Pendant la demande : bouton `disabled`, libellé « Actualisation… », icône animée (immobile si
  `prefers-reduced-motion`).
- L'état (occupé, message) appartient au couple serveur/objet qui l'a produit : il n'est pas affiché pour
  un autre.

## Après un résultat `ok`

Le compteur de relecture de la page augmente de 1 : le prix HDV partagé de l'objet est relu, chaque ligne
de ressource relit son prix, et les ressources non affichées sont relues à leur tour. Les écritures dans
le carnet du Mode communautaire suivent `pickCommunityPrice` ; une saisie en cours n'est pas remplacée.

## Mention de fragilité (ligne de ressource, Mode communautaire)

`Dernière mise à jour : il y a 3 h<span class="price-note"> · peu de relevés</span>`

Affichée si : dernière origine `external` **et** `latestFragile` connu **et** pas de saisie en cours
**et** (carnet vide **ou** `carnet.updatedAt === latestContributionAt`).

| `latestFragile` | Mention |
|-----------------|---------|
| `provisional` | peu de relevés |
| `stale` | relevé ancien |
