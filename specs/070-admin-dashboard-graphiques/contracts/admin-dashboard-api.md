# Contrat : routes de lecture du tableau de bord

Trois routes, toutes dans le worker d'administration (`dofus-craft-admin`), toutes protégées par la
vérification Cloudflare Access existante (`verifyOwner`) : un appel d'une autre personne répond **403**
`{ "error": "Accès réservé au propriétaire." }`. Toutes sont en `GET`, en lecture seule, avec
`Cache-Control: no-store`. Aucune ne renvoie de clé en clair, d'empreinte de clé, d'identifiant d'appareil
ni de jeton Cloudflare.

## `GET /api/usage/today`

Journée UTC en cours, heure par heure. Comme `/api/usage` : toujours **200** avec un `state`.

```json
{ "state": "ok", "date": "2026-10-22", "readAt": "2026-10-22T14:37:05.000Z",
  "hours": [ { "hour": 0, "workersRequests": 120, "d1RowsRead": 8400, "d1RowsWritten": 35 }, "…" ] }
```

- `hours` : une entrée par heure de 0 à l'heure en cours (incluse, partielle), incréments de l'heure.
- Autres états : `{ "state": "not-configured", "missing": [...] }`, `{ "state": "denied" }`,
  `{ "state": "unavailable" }` (y compris dimension horaire refusée par Cloudflare, voir research R1).
- Le jeton et le détail brut des erreurs Cloudflare ne sont jamais renvoyés.

## `GET /api/sniffer/contributions?month=AAAA-MM`

Lignes de prix ajoutées par les clés. `month` est facultatif (mois en cours, UTC).

```json
{ "month": "2026-10", "months": ["2026-10", "2026-09"], "total": 150,
  "keys": [ { "keyId": "…", "label": "Alice", "revoked": false, "rows": 120 },
            { "keyId": "…", "label": "Bob", "revoked": true, "rows": 30 } ],
  "days": [ { "date": "2026-10-01", "rows": 12 }, "…" ] }
```

- **400** `{ "error": "Mois attendu sous la forme 2026-10.", "field": "month" }` si le format est invalide ou
  si le mois est dans le futur.
- Mois sans donnée : `total` 0, `keys` = clés actives à 0, `days` à 0.
- Erreur de lecture : **500** traité par la page comme « indisponible ».

## `GET /api/activity`

Prix communautaires et visites des 30 derniers jours UTC, aujourd'hui compris.

```json
{ "days": [ { "date": "2026-09-23",
              "prices": { "manual": 3, "capture": 0, "bot": 1, "sniffer": 240 },
              "visitors": 17 }, "…" ],
  "pricesTotal": 5120, "visitorsToday": 22 }
```

- 30 entrées, du plus ancien au plus récent ; jour sans ligne : zéros.
- Les valeurs sont des totaux : aucun identifiant n'est renvoyé.
- Erreur de lecture : **500**.

## Compatibilité

`/api/usage?days=7|30` (spec 058), `/api/sniffer/keys` et les autres routes ne changent pas.
