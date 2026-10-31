# Contrat : exemplaires dans `POST /community-price/batch`

Extension de [`specs/056-sniffer-batch-prices/contracts/sniffer-api.md`](../../056-sniffer-batch-prices/contracts/sniffer-api.md). Tout le reste (authentification, version, mapping, plafond) est inchangé.

## Observation d'équipement

```json
{
  "itemId": "2423",
  "seenAt": "2026-10-31T14:02:11Z",
  "category": 5,
  "lots": { "1": 420000 },
  "copies": [
    {
      "listingId": "918273645",
      "price": 420000,
      "stats": [
        { "effectId": 125, "value": 38 },
        { "effectId": 118, "value": 34 },
        { "effectId": 178, "value": 5 }
      ]
    }
  ]
}
```

- `lots` reste le prix le moins cher, comme avant. Il suffit à un client ancien.
- `copies` est **optionnel** et n'a de sens que pour un équipement (`category` de nature `equipment`). Il représente **tous** les exemplaires en vente de l'objet à cet instant.

## Règles de validation (une copie invalide est refusée, la ligne est `invalid`)

| Champ | Règle |
|---|---|
| `copies` | tableau de 1 à 50 éléments ; refusé sur une ressource, une rune ou un consommable |
| `listingId` | chaîne de chiffres, 1 à 20 caractères, unique dans l'observation |
| `price` | entier `> 0` et `≤ MAX_AMOUNT_KAMAS` |
| `stats` | tableau de 1 à 40 éléments |
| `stats[].effectId` | entier `> 0` |
| `stats[].value` | entier, `-10000` à `10000` |

## Effets

- Les exemplaires de l'observation **remplacent** les annonces de l'objet pour le serveur : mises à jour pour celles déjà connues, insérées pour les nouvelles, supprimées pour celles absentes.
- Les exemplaires ont leur propre plafond quotidien par clé (20 000, colonne `copies_written`) : un lot qui le dépasserait est refusé en entier (`429 { "error": "daily_limit", "kind": "copies" }`). Le plafond des observations (5 000) est inchangé.
- Une observation avec `lots` mais sans `copies` ne touche pas aux annonces (client ancien).
- La réponse reste `{ "accepted": n, "rejected": [...] }` ; `accepted` compte les observations, pas les copies.

## Dépendance côté client (dépôt externe)

`core/src/upload.rs` du client `SniffSniffSquared` doit joindre `copies` à chaque observation d'équipement à partir des offres déjà décodées (`price_offer` : `listing_id`, `ladder[0]`, lignes `price_stat_line` `effect`/`value`). Version minimale du client : celle qui porte cette modification ; `SNIFFER_MIN_VERSION` n'est **pas** relevée, pour ne pas bloquer les anciens clients.
