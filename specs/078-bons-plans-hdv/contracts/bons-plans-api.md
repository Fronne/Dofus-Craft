# Contrat : `GET /bons-plans` et réglage du seuil

## `GET /bons-plans?server=<serverId>`

Route publique (comme `GET /site-settings`), lecture seule.

- `server` : serveur connu, obligatoire. Sinon `400 { "error": "unknown_server" }`.

### Réponse `200`

```json
{
  "thresholdPercent": 25,
  "maxAgeHours": 24,
  "generatedAt": "2026-10-31T14:30:00Z",
  "listings": [
    {
      "listingId": "918273645",
      "itemId": "2423",
      "priceKamas": 420000,
      "lastSeenAt": "2026-10-31T14:02:11Z",
      "stats": [{ "effectId": 125, "value": 38 }]
    }
  ]
}
```

- Seulement les annonces vues depuis moins de 24 h, des objets qui ont **au moins 4 annonces fraîches** (3 voisins plus l'exemplaire), au plus 5 000 annonces ; au-delà, les plus récemment vues d'abord.
- Le Worker ne calcule aucun verdict : le site le fait (`src/domain/good-deals.ts`).
- Lecture seule : aucune erreur si la table est vide (`listings: []`). Si la table n'existe pas encore : `listings: []` et seuil par défaut, comme `/site-settings`.
- Cache court (60 s) côté Worker.

## Réglage du seuil (administration)

- Écrit uniquement par le Worker d'administration protégé par Access, comme les autres réglages du site.
- Valeur entière de 5 à 90 ; hors bornes, refus `400`. Valeur absente : 25.
- Le champ apparaît dans le tableau de bord d'administration avec son défaut.

## Verdict calculé côté site (rappel de la règle, voir research R4)

Entrées : annonces d'un objet et d'un serveur, effets de l'objet, poids de stats. Sorties : pour chaque annonce, `isGoodDeal`, prix de référence, économie, nombre de voisins. Pas d'appel réseau.
