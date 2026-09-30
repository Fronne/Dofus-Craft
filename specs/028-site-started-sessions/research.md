# Research: Démarrer une session FM depuis le site, synchronisée avec Discord

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-09-30

Sources lues : `worker/src/fm/` (bot-events, reads, items, imports), le bot Botomoux (`main.py` :
`sessions` en mémoire par `channel_id`, `fmstart` / `fmstop` / `fmreset`, `on_message`).

## R1. Une file de demandes que le bot vient chercher

**Decision** : une table `fm_bot_commands`. Le site y ajoute une demande `open` ou `close` ; le bot
appelle `GET /fm/bot/commands` toutes les 10 secondes (clé du bot), exécute chaque demande dans
l'ordre, puis confirme avec `POST /fm/bot/commands/{id}/ack` (`done` ou `failed`, avec une raison).
Une demande confirmée n'est plus renvoyée ; une confirmation répétée ne change rien (FR-007). La
réponse donne `pollAfterSeconds: 10`, pour pouvoir espacer les appels sans changer le bot.

**Rationale** : le bot n'est pas joignable (clarification, option A) ; une file persistée survit à un
redémarrage du bot, et les confirmations permettent d'afficher l'état de synchronisation (FR-011).

**Alternatives considered** : le site appelle le bot (adresse publique nécessaire) ; le site poste un
message Discord lu par le bot (dépend de Discord, message visible dans le salon).

## R2. Même session des deux côtés

**Decision** : la session du site est créée **ouverte** tout de suite dans `fm_sessions`, liée au
salon choisi. Le bot, pour une demande `open`, fait ce que fait `/fmstart` de son côté
(`empty_session()`, annonce dans le salon) **sans envoyer l'événement `session-start`**. Les captures
postées ensuite arrivent par l'événement `capture`, que le Worker range déjà dans la session ouverte du
salon : c'est la session du site (FR-008). Pour une demande `close`, le bot fait ce que fait `/fmstop`
(résumé) sans envoyer `session-stop`.

**Rationale** : aucune correspondance d'identifiants à tenir entre le bot et le site : le salon
suffit, comme aujourd'hui. L'index unique « une session ouverte par salon » (specs/025) garantit
l'absence de doublon (FR-002, SC-002).

## R3. Captures après un arrêt sur le site

**Decision** : quand une capture arrive pour un salon **sans session ouverte**, le Worker l'ignore
(`status: "ignored"`, `reason: "session-closed"`) s'il existe une demande `close` encore en attente
pour ce salon ; sinon, il garde le comportement de specs/025 (ouvrir une session à la date de la
capture). Le bot n'a donc pas besoin d'être à jour pour respecter FR-009.

## R4. Annulations

**Decision** :
- `close` alors que l'`open` de la même session est encore en attente : l'`open` passe `cancelled` et
  aucun `close` n'est créé ; la session est fermée sur le site (FR-010).
- `session-stop` reçu (le joueur a tapé `/fmstop`) : toute demande `close` en attente pour ce salon
  passe `cancelled` (FR-012).
- Un `close` exécuté par le bot pour un salon où il n'a pas de session (déjà fermée par `/fmstop`) se
  confirme `done` sans rien publier (contrat du bot).

## R5. Propriétaire et origine

**Decision** : `fm_sessions` gagne `owner_discord_user_id` (NULL pour les sessions anciennes ou d'un
bot pas encore à jour), `origin` (`discord` par défaut, `site`), `sync_status` (`pending`, `opened`,
`failed`, `cancelled`, NULL pour une session Discord) et `sync_error`. L'événement `session-start`
gagne un champ facultatif `author` (même forme que dans `capture`) : le Worker crée ou met à jour le
joueur et le note propriétaire (FR-005).

**État « non transmise »** : calculé à la lecture — `sync_status = 'pending'` depuis plus de 10 minutes
(FR-011). « Relancer » annule l'ancienne demande et en crée une nouvelle.

## R6. Salons connus

**Decision** : les salons proposés au démarrage sont ceux présents dans `fm_sessions` (dernier nom
connu par identifiant), marqués « occupés » s'ils ont une session ouverte (FR-003). Pas de table
supplémentaire.

## R7. Captures du site

**Decision** : `POST /fm/imports` gagne `sessionId` facultatif : une session **ouverte** dont le joueur
est propriétaire ; sinon `409 session-not-open` ou `403`. Le site propose les sessions ouvertes du
joueur (`GET /fm/sessions?mine=open`), la seule par défaut (FR-013).

## R8. Coût des appels du bot

**Decision** : `GET /fm/bot/commands` fait une seule lecture indexée (`status = 'pending'`) et ne
passe pas par le cache de lecture. Environ 8 640 appels par jour à 10 secondes (~9 % de la limite
gratuite des Workers, clarification du 2026-09-30).
