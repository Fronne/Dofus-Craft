# Quickstart : valider les salons FM personnels (côté site)

**Feature**: [spec.md](spec.md) | Contrat : [contracts/fm-channels-api.md](contracts/fm-channels-api.md)

## Prérequis

Migration `0010` (`npm run worker:db:migrate-fm-channels`) avant le déploiement du Worker.

## Tests automatisés

```bash
npm run typecheck && npx tsc -p worker --noEmit && npm run lint && npm test
npx playwright test forgemagie --project=desktop
```

## Scénario sans le bot (curl, Worker local)

1. Envoyer `channel-created` (auteur Cyril) puis `session-start` pour un salon `c1` : le profil de Cyril
   liste le salon, actif.
2. Avec le compte de Bob : `GET /fm/channels` ne contient pas `c1` ; `POST /fm/sessions` dans `c1` →
   `403 not-your-channel`.
3. Cyril rattache `c1` à « Rtograf PA » : le récap de l'objet compte la session de `c1` ; une nouvelle
   session dans `c1` compte aussi.
4. `POST /fm/channels` avec le nom « mon rtograf » : `GET /fm/bot/commands` donne une demande
   `create-channel` ; `channel-created` avec `commandId`, puis `ack` avec `channelId` → la demande est
   `done` et le salon est rattaché à l'objet choisi.
5. Six demandes de création (salons actifs compris) → la sixième `409 channel-limit`.
