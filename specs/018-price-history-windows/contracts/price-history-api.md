# Contrat : `GET /price-history` (Worker) — révisé par la spec 018

Lecture anonyme, URL et paramètres inchangés :
`GET /price-history?kind=<resource|item>&id=<id>&serverId=<id>`

| Cas | Statut | Corps |
|---|---|---|
| paramètre manquant ou `kind` invalide | 400 | `{ "error": "kind (resource or item), id and serverId are required" }` |
| aucun prix sur 30 jours | 200 | `{ "day": [], "week": [], "month": [] }` |
| prix trouvés | 200 | voir ci-dessous |

```json
{
  "day":   [{ "amountKamas": 2720000, "sharedAt": "2026-09-26T08:14:00.000Z" }],
  "week":  [{ "amountKamas": 2780000, "sharedAt": "2026-09-22T17:02:00.000Z" },
            { "amountKamas": 2770000, "sharedAt": "2026-09-23T19:40:00.000Z" },
            { "amountKamas": 2720000, "sharedAt": "2026-09-26T08:14:00.000Z" }],
  "month": [ "… mêmes objets, sur 30 jours …" ]
}
```

- Chaque liste : fenêtre glissante (24 h, 7 j, 30 j, bornes incluses), aberrants écartés sur la
  fenêtre, tri par `sharedAt` croissant (data-model.md).
- La réponse ne contient **jamais** `device_id` ni l'identifiant de la contribution (FR-006).
- Seules les lignes du `kind` et du serveur demandés comptent.
- Aucune migration, rétention inchangée.

## Client : `getPriceHistory(kind, id, serverId)`

Renvoie `{ status: 'found', history } | { status: 'unavailable' }`, ne lève jamais. Tout élément
sans `amountKamas` numérique ou sans `sharedAt` chaîne donne `unavailable` (dont une réponse de
l'ancien format).

## Tests obligatoires

- un prix à `now − 24 h` est dans `day` ; à `now − 24 h − 1 min`, seulement dans `week` et `month` ;
  idem aux bornes 7 j et 30 j ; au-delà de 30 j, absent ;
- trois prix du même appareil dans l'heure → trois éléments ;
- aberrant (≥ 4 valeurs) écarté de la fenêtre où il l'est, et seulement de celle-là ;
- `kind` et serveur séparés ;
- `sharedAt` arrondi à la minute ; aucune clé autre que `amountKamas` / `sharedAt` ;
- 400 / 200 listes vides ;
- client : nouveau format → `found` ; ancien format, 500, réseau → `unavailable`.
