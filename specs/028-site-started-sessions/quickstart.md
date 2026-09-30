# Quickstart : valider le démarrage des sessions depuis le site

**Feature**: [spec.md](spec.md) | Contrats : [fm-site-sessions-api.md](contracts/fm-site-sessions-api.md),
[fm-bot-commands.md](contracts/fm-bot-commands.md)

## Prérequis

- Migration `0009` (`npm run worker:db:migrate-site-sessions`), avant le déploiement du Worker.

## Tests automatisés

```bash
npm run typecheck && npx tsc -p worker --noEmit && npm run lint && npm test
npx playwright test forgemagie --project=desktop
```

Couvre : démarrage (salon occupé refusé, objet rattaché), arrêt (propriétaire seulement), file du bot
(ordre, renvoi tant que non confirmé, confirmation idempotente), annulation open + close, capture
ignorée après un arrêt, `/fmstop` qui annule un close en attente, état « non transmise », import dans
une session ouverte.

## Scénario sans le bot (curl, Worker local)

1. Sur le site : Forgemagie → « Démarrer une session » → salon `fm-anneau`, objet « Rtograf PA » :
   la session est « En cours », « en attente de Discord ».
2. `curl -H "Authorization: Bearer $FM_BOT_API_KEY" $API/fm/bot/commands` → une demande `open`.
3. `curl -X POST … $API/fm/bot/commands/{id}/ack -d '{"status":"done"}'` → le site affiche « ouverte
   dans Discord » ; la demande n'est plus renvoyée.
4. Envoyer une `capture` pour ce salon (contrat de specs/025) → elle s'ajoute à la session.
5. « Arrêter » sur le site → « Terminée » ; une `close` est en attente ; une `capture` envoyée avant
   sa confirmation répond `ignored`.
