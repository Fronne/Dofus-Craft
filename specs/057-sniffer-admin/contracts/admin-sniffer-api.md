# Contrat : API d'administration sniffer (dofus-craft-admin)

Toutes les routes passent d'abord par `verifyOwner` (`admin-worker/src/access.ts`) : sans jeton
Access valide du propriétaire → `403 {"error":"Accès réservé au propriétaire."}`, rien n'est lu ni
écrit. Réponses JSON, `Cache-Control: no-store`. Erreur de validation → `400 {"error","field"}`.

## Clés

### GET /api/sniffer/keys

```json
200 [
  { "id": "6f1c…", "label": "Alice", "createdAt": "2026-10-15T10:00:00.000Z",
    "revokedAt": null, "lastSeenAt": "2026-10-15T20:01:02.000Z", "rowsToday": 120 }
]
```

Plus récente d'abord. Jamais la clé ni son empreinte.

### POST /api/sniffer/keys

```json
{ "label": "Alice" }
201 { "key": { …SnifferKey… }, "secret": "dcp_<64 hex>" }
400 { "error": "Libellé obligatoire (60 caractères au plus).", "field": "label" }
```

`secret` n'est renvoyé qu'ici, une seule fois.

### POST /api/sniffer/keys/:id/revoke

```text
200 SnifferKey (revokedAt rempli ; la date d'origine si déjà révoquée)
404 { "error": "Clé introuvable." }
```

## Mappings

### GET /api/sniffer/mappings

```json
200 [ { "id": 7, "build": "3.7.10.10", "uploadedAt": "…", "active": true,
        "keymapBytes": 991, "schemaBytes": 5734 } ]
```

### POST /api/sniffer/mappings

```json
{ "build": "3.7.10.10", "keymap": "<texte de keymap.json>", "schema": "<texte de schema.json>" }
201 SnifferMapping (l'actif du build, relu après écriture)
400 { "error": "…", "field": "build" | "keymap" | "schema" }
```

Messages de refus (le document est nommé) :

| cas | error |
|---|---|
| build mal formé | `Build attendu sous la forme 3.7.10.10.` |
| document absent ou vide | `keymap.json manquant.` / `schema.json manquant.` |
| trop gros | `keymap.json dépasse 256 Ko.` |
| JSON illisible | `keymap.json n'est pas du JSON valide.` |
| pas un objet | `keymap.json doit être un objet JSON.` |
| keymap sans `price_list` | `keymap.json n'a pas d'entrée price_list.` |
| schema sans `price_list` | `schema.json n'a pas de définition price_list.` |
| `of` non résolu | `schema.json : la définition « price_offer » citée par price_list est absente.` |

### POST /api/sniffer/mappings/:id/activate

```text
200 SnifferMapping (actif)
404 { "error": "Mapping introuvable." }
```

## Lien avec l'API publique (phase 2)

- Une clé créée ici est acceptée par `GET /sniffer/config` et `POST /community-price/batch`
  (`Authorization: Bearer <secret>`) ; révoquée, elle y reçoit `401`.
- Le mapping actif d'un build est celui que `GET /sniffer/config?build=…` renvoie (`mapping.id`,
  `keymap`, `schema`) ; après une réactivation, un lot envoyé avec l'ancien `mappingId` reçoit `409`.

## Interface (page d'administration)

- Section « Clés sniffer » : champ « Nom de l'ami », bouton « Créer une clé ». Après création, un
  encadré montre la clé, un bouton « Copier » et « Cette clé ne sera plus affichée : transmettez-la
  maintenant. » ; bouton « J'ai copié la clé » pour le fermer. Tableau : nom, créée le, dernier
  envoi (« jamais »), prix aujourd'hui, état (« active » / « révoquée le … ») et bouton
  « Révoquer » → confirmation « Révoquer la clé de <nom> ? Son outil ne pourra plus envoyer de
  prix. ».
- Section « Mapping » : champ « Build du client » (ex. 3.7.10.10), deux sélecteurs de fichier
  (`keymap.json`, `schema.json`), bouton « Publier ». Historique groupé par build : n°, déposé le,
  tailles, « actif » ou bouton « Réactiver » → confirmation « Revenir au mapping n° <id> pour
  <build> ? ».
- Utilisable en 375 px.
