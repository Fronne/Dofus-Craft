# Contrat : demandes du site au bot (Botomoux)

**Destinataire** : l'auteur du bot. Complète [le contrat de specs/025](../../025-rune-purchase-import/contracts/fm-bot-api.md)
(envoi des événements), qui reste valable.

## En bref

Un joueur peut maintenant démarrer ou arrêter une session **depuis le site**. Le site ne peut pas
joindre le bot : c'est le bot qui lui demande, toutes les 10 secondes, s'il y a quelque chose à faire,
l'exécute, puis confirme.

Toutes les requêtes utilisent la même adresse et la même clé que les événements :
`Authorization: Bearer {FM_BOT_API_KEY}`.

## 1. Récupérer les demandes — `GET {DOFUS_CRAFT_API_URL}/fm/bot/commands`

```json
{ "pollAfterSeconds": 10,
  "commands": [
    { "id": "c1…", "type": "open", "channelId": "1100…", "channelName": "fm-anneau",
      "player": { "id": "42", "displayName": "Cyril" }, "item": { "name": "Rtograf PA" } },
    { "id": "c2…", "type": "close", "channelId": "1100…", "channelName": "fm-coiffe" }
  ] }
```

- Les demandes arrivent **dans l'ordre** où les exécuter. `item` peut valoir `null`.
- Tant qu'une demande n'est pas confirmée, elle est renvoyée à chaque appel : n'exécute pas deux fois
  la même (garde en mémoire les `id` déjà traités, au moins jusqu'à leur confirmation).
- Attends `pollAfterSeconds` secondes avant l'appel suivant (10 aujourd'hui).
- Un échec réseau ou une réponse `5xx` : réessaie simplement au tour suivant.

## 2. Exécuter

**`open`** — faire ce que fait `/fmstart` dans le salon `channelId` :
`sessions[channelId] = empty_session()`, `save_data()`, et un message dans le salon, par exemple
« Session FM démarrée depuis le site par Cyril (Rtograf PA) ». **Ne pas** envoyer l'événement
`session-start` : le site a déjà créé la session. Les captures postées ensuite s'envoient comme
d'habitude avec l'événement `capture`.

**`close`** — faire ce que fait `/fmstop` : publier le résumé dans le salon, puis supprimer la session
du bot. **Ne pas** envoyer `session-stop`. S'il n'y a pas de session du bot dans ce salon (déjà fermée
par `/fmstop`), ne rien publier et confirmer `done`.

## 3. Confirmer — `POST {DOFUS_CRAFT_API_URL}/fm/bot/commands/{id}/ack`

```json
{ "status": "done" }
{ "status": "failed", "error": "Salon introuvable" }
```

`error` : 200 caractères au plus, affiché au joueur sur le site. Réponse `200`. Confirmer deux fois la
même demande ne change rien. Une demande inconnue répond `404` : oublie-la.

## 4. Changement de l'événement `session-start`

Ajouter l'auteur de `/fmstart`, comme dans `capture` :

```json
{ "type": "session-start", …, "author": { "id": "42", "displayName": "Cyril", "avatarUrl": "https://…" } }
```

(`interaction.user.id`, `interaction.user.display_name`, `interaction.user.display_avatar.url`). Il
devient le propriétaire de la session : c'est lui qui peut l'arrêter depuis le site. Le champ est
facultatif : sans lui, tout fonctionne comme avant.

## Exemple (Python, discord.py)

```python
from discord.ext import tasks

done_ids = set()

@tasks.loop(seconds=10)
async def poll_site():
    try:
        r = requests.get(f"{API}/fm/bot/commands", headers=HEADERS, timeout=10)
        r.raise_for_status()
    except Exception:
        return
    for cmd in r.json()["commands"]:
        if cmd["id"] in done_ids:
            continue
        channel = bot.get_channel(int(cmd["channelId"]))
        if channel is None:
            ack(cmd["id"], "failed", "Salon introuvable")
            continue
        if cmd["type"] == "open":
            sessions[cmd["channelId"]] = empty_session()
            save_data()
            await channel.send(f"Session FM démarrée depuis le site par {cmd['player']['displayName']}")
        else:
            session = sessions.pop(cmd["channelId"], None)
            save_data()
            if session:
                ...  # même résumé que /fmstop
        ack(cmd["id"], "done")
        done_ids.add(cmd["id"])

def ack(command_id, status, error=None):
    body = {"status": status, **({"error": error} if error else {})}
    requests.post(f"{API}/fm/bot/commands/{command_id}/ack", json=body, headers=HEADERS, timeout=10)

# dans on_ready : poll_site.start()
```

`requests` est bloquant : pour un bot plus réactif, l'appeler via `asyncio.to_thread` (ou `aiohttp`).

## Suite : salons personnels (specs/029)

Le bot crée aussi les salons FM personnels (bouton, demande `create-channel` du site) et en informe le
site (`channel-created`, `channel-archived`, `channel-deleted`) : voir
[fm-channels-api.md](../../029-channel-ownership/contracts/fm-channels-api.md).
