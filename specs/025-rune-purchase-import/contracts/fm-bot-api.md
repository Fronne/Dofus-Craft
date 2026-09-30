# Contrat : envois du bot Discord vers Dofus Craft

**Destinataire** : l'auteur du bot Botomoux. Ce document suffit pour brancher le bot, sans lire le
reste du dépôt.

## En bref

À chaque commande (`/fmstart`, `/fmreset`, `/fmstop`) et à chaque message avec captures traité
pendant une session, le bot envoie **un** événement au Worker de Dofus Craft. Le site affiche alors
la session, la dépense de chaque joueur et le détail des runes, et en tire le prix des runes.

- **URL** : `POST {DOFUS_CRAFT_API_URL}/fm/bot/events`
- **En-têtes** : `Authorization: Bearer {FM_BOT_API_KEY}` et `Content-Type: application/json`
- La clé est donnée par le porteur du projet. Elle se met dans le `.env` du bot, **jamais dans le
  code** (comme `TOKEN`).
- Un échec d'envoi (réseau, 5xx) ne doit **jamais** bloquer ni ralentir le bot dans Discord. Le bot
  peut renvoyer le même événement plus tard : un événement déjà reçu est ignoré (voir
  « Idempotence »).

## Champs communs

| Champ | Type | Valeur dans le bot |
|---|---|---|
| `type` | string | `"session-start"`, `"capture"`, `"session-reset"` ou `"session-stop"` |
| `eventId` | string | `str(interaction.id)` pour une commande, `str(message.id)` pour une capture |
| `channelId` | string | `str(interaction.channel.id)` ou `str(message.channel.id)` |
| `channelName` | string | `interaction.channel.name` ou `message.channel.name` |
| `occurredAt` | string | Date ISO 8601 UTC : `interaction.created_at.isoformat()` ou `message.created_at.isoformat()` |

## `session-start` (dans `fmstart`)

Champs communs seulement. Ferme la session ouverte de ce salon s'il y en a une, puis en ouvre une
nouvelle.

```json
{ "type": "session-start", "eventId": "1289…", "channelId": "1100…", "channelName": "fm-coiffe",
  "occurredAt": "2026-09-30T18:02:11+00:00" }
```

## `capture` (dans `on_message`, après le traitement des pièces jointes)

À envoyer quand `added_total > 0` ou que `rune_totals` n'est pas vide, c'est-à-dire quand le bot
répond au message.

| Champ | Type | Valeur dans le bot |
|---|---|---|
| `author.id` | string | `str(message.author.id)` |
| `author.displayName` | string | `message.author.display_name` |
| `author.avatarUrl` | string \| null | `str(message.author.display_avatar.url)` |
| `spentKamas` | integer ≥ 0 | `added_total` (ce que le bot ajoute à la dépense du joueur) |
| `lines` | array | **Chaque** ligne lue par `extract_runes`, pour toutes les pièces jointes, **avant** regroupement : `{ "name": r["name"], "qty": r["qty"], "price": r["price"] }` |

```json
{ "type": "capture", "eventId": "1290…", "channelId": "1100…", "channelName": "fm-coiffe",
  "occurredAt": "2026-09-30T18:05:42+00:00",
  "author": { "id": "2345…", "displayName": "Cyril", "avatarUrl": "https://cdn.discordapp.com/…" },
  "spentKamas": 63472,
  "lines": [
    { "name": "Rune Do Air", "qty": 10, "price": 15868 },
    { "name": "Rune Do Air", "qty": 10, "price": 15868 },
    { "name": "Rune Do Air", "qty": 10, "price": 15868 },
    { "name": "Rune Do Air", "qty": 10, "price": 15868 }
  ] }
```

`price` est le **total** de la ligne (le nombre avant « kamas »), pas le prix unitaire. Dofus Craft
calcule le prix unitaire (15 868 / 10 → 1 587).

## `session-reset` (dans `fmreset`) et `session-stop` (dans `fmstop`)

Champs communs seulement. `session-reset` efface les achats de la session ouverte du salon, qui
reste ouverte. `session-stop` la ferme.

## Réponses

| Statut | Quand | Corps |
|---|---|---|
| `200` | Événement traité | Voir ci-dessous |
| `200` | Événement déjà reçu (même `eventId`) | La réponse d'origine, avec `"duplicate": true` |
| `400` | JSON invalide ou champ commun manquant | `{ "error": "…" }` |
| `401` | Clé absente ou invalide | `{ "error": "Unauthorized" }`, rien n'est enregistré |

Corps d'une réponse `200` :

```json
{ "status": "ok", "sessionId": "5b7e…", "duplicate": false,
  "lines": [
    { "index": 0, "name": "Rune Do Air", "unitPriceKamas": 1587, "priceStatus": "recorded" },
    { "index": 1, "name": "Rune Do Air", "unitPriceKamas": 1587, "priceStatus": "recorded" }
  ] }
```

- `status` vaut `"ignored"` pour un `session-reset` ou un `session-stop` sans session ouverte.
- `lines` n'est présent que pour une `capture`, dans l'ordre de l'envoi.
- `priceStatus` indique si la ligne a créé un prix. Il ne change **jamais** la dépense : elle vaut
  toujours `spentKamas`.

| `priceStatus` | Signification |
|---|---|
| `recorded` | Prix enregistré pour la ressource, sur le serveur Dofus du joueur |
| `unknown-item` | Nom qui ne correspond exactement à aucune ressource connue (faute de lecture, équipement…) |
| `ambiguous-item` | Plusieurs ressources portent ce nom |
| `no-server` | Le joueur n'a pas encore choisi son serveur Dofus sur le site |
| `outlier` | Prix unitaire à plus de 25 % de la médiane du groupe : pas de prix enregistré |
| `invalid` | Quantité ou total nul, négatif ou non entier : ligne ignorée pour le détail et le prix |

Le bot peut, s'il le souhaite, afficher les lignes non `recorded` dans sa réponse Discord.

## Idempotence

Le Worker garde chaque `eventId` reçu. Un renvoi du même `eventId` ne change rien et renvoie la
réponse d'origine. Deux messages Discord différents avec la même capture restent **deux**
événements, et comptent deux fois, exactement comme dans le bot aujourd'hui.

## Limites

- Au plus 200 lignes par `capture`, et des nombres entiers de 0 à 2 000 000 000.
- `name` : 1 à 80 caractères.
