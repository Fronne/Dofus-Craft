# Contrat : données des runes et index des ressources

## `src/data/rune-items.json`

Généré par `node scripts/build-rune-items.mjs`, relu et commité à la main (comme
`hdv-items.json`, specs/023).

```json
{
  "source": "DofusDB (objets du type 78 « Rune de forgemagie », effets)",
  "sourceUrl": "https://api.dofusdb.fr",
  "retrievedAt": "2026-09-30",
  "runes": [
    { "id": "1519", "name": "Rune Fo", "imageUrl": "https://api.dofusdb.fr/img/items/78043.png",
      "level": 1, "effectId": 118, "characteristicId": 10, "statLabel": "Force" }
  ]
}
```

- `runes` : tous les objets DofusDB du type 78, triés par `statLabel` puis par `level`.
- `characteristicId` : champ `characteristic` de l'effet dans `GET /effects` ; `null` si
  l'effet n'a pas de caractéristique.
- `statLabel` : tiré de la description française de l'effet (`GET /effects`, champ `description`),
  débarrassée de ses marqueurs (« #1{{~1~2 à }}#2 Dommage{{~ps}}{{~zs}} Air » → « Dommages Air »,
  « …#2% Résistance Air » → « Résistance Air (%) »). À défaut de description, nom français de la
  caractéristique (`GET /characteristics`), sinon « Autre ». Les noms de caractéristique seuls ne
  distinguent pas les dommages des résistances d'un même élément.
- Le script s'arrête avec une erreur si DofusDB ne répond pas ; il n'écrit jamais de fichier
  partiel.

## `worker/src/fm/priceable-items.json`

Généré par le même script, à partir de `src/data/hdv-items.json` et `src/data/rune-items.json`.

```json
{ "generatedAt": "2026-09-30",
  "items": { "rune do air": "1557", "bois de frene": null } }
```

- Clé : nom normalisé (minuscules, espaces multiples réduits à un, espaces de début et de fin
  retirés). **Les accents sont conservés** : « Frêne » et « Frene » sont deux noms différents.
- Valeur : identifiant de la ressource, ou `null` si plusieurs ressources portent ce nom
  (`ambiguous-item`).
- Utilisé par le Worker pour les lignes du bot et pour valider `itemId` dans `POST /fm/imports`.
  Le site utilise la même normalisation (`src/domain/forgemagie.ts`) pour proposer la ressource
  d'une ligne importée.
