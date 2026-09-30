# Implementation Plan: Salons FM personnels créés par le bot

**Branch**: `029-channel-ownership` | **Date**: 2026-09-30 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/029-channel-ownership/spec.md`

## Summary

Côté site uniquement (le bot est modifié par son auteur, via une pull request préparée à part) : une
table `fm_channels` des salons personnels, remplie par de nouveaux événements du bot
(`channel-created`, `channel-archived`, `channel-deleted`) ; une demande `create-channel` dans la file
de specs/028 pour créer un salon depuis le site ; le démarrage d'une session réservé aux salons actifs du
joueur ; le rattachement d'un salon entier à un objet en FM, via l'objet effectif d'une session
(`COALESCE` session, salon). Détails : [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5.7 (site et Worker)

**Primary Dependencies**: React 19, Vite 5 ; Cloudflare Workers + D1 (inchangées)

**Storage**: D1 — table `fm_channels`, `fm_bot_commands` reconstruite avec de nouvelles colonnes
(migration `0010`)

**Testing**: Vitest (Worker via `tests/support/fm-worker.ts`, intégration jsdom), Playwright

**Target Platform**: navigateurs récents ; Cloudflare Workers

**Project Type**: application web + Worker d'API

**Performance Goals**: inchangés ; le suivi d'une création de salon interroge le site toutes les 3 s
pendant au plus 2 minutes

**Constraints**: API rétrocompatible avec un bot pas encore à jour (aucun salon personnel : le
démarrage depuis le site ne propose alors aucun salon) ; migration avant le déploiement du Worker

**Scale/Scope**: 10 à 20 joueurs, 5 salons actifs chacun au plus

## Constitution Check

| Principe | Vérification | Statut |
|---|---|---|
| I. Données traçables | Chaque salon garde son propriétaire, son état et ses dates, donnés par le bot ; l'objet effectif d'une session suit une règle unique et explicite. | ✅ |
| II. Exactitude avant optimisation | Tests : limite de 5, refus du salon d'un autre, objet effectif (manuel prioritaire), totaux des objets, idempotence des nouveaux événements. | ✅ |
| III. Décisions explicables | Le site indique pour chaque session si son objet vient du salon ou d'un rattachement manuel ; la création d'un salon depuis le site montre son état (en cours, échec avec raison). | ✅ |
| IV. Changements petits et cohérents | Une table, une demande de plus dans la file existante, une règle d'objet effectif réutilisée partout. | ✅ |
| V. Données utilisateur | Pas de nouvelle donnée personnelle ; salons masqués pour un profil privé ; suppression du profil sans perte des sessions. | ✅ |

## Project Structure

```text
worker/
├── migrations/0010_add_fm_channels.sql   # NOUVEAU
├── schema.sql
└── src/fm/
    ├── channels.ts         # NOUVEAU : GET/POST /fm/channels, demandes, PUT …/item
    ├── bot-events.ts       # channel-created / archived / deleted
    ├── bot-commands.ts     # create-channel ; ack avec channelId
    ├── site-sessions.ts    # démarrage : salon actif du joueur seulement
    ├── reads.ts, items.ts  # objet effectif (COALESCE session, salon) ; fmChannels du profil
    ├── me.ts               # suppression du profil
    └── router.ts
package.json                # worker:db:migrate-fm-channels

src/
├── domain/forgemagie.ts    # FmChannel, FmChannelRequest, fmChannels
├── services/fm-api.ts      # createFmChannel, getFmChannelRequest, attachFmChannel
└── features/forgemagie/
    ├── StartSession.tsx    # « Nouveau salon » (nom) ou un de mes salons actifs ; suivi de la création
    ├── FmChannelsSection.tsx  # NOUVEAU : mes salons, rattachement à un objet
    ├── ProfileTab.tsx
    └── SessionDetail.tsx   # objet venant du salon
```

## Amendements

- specs/027 : objet effectif d'une session (manuel, sinon salon).
- specs/028 : FR-003 remplacée (salons personnels du joueur, ou création d'un salon).

## Complexity Tracking

Aucune violation.
