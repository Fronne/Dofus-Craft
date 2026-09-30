# Implementation Plan: Démarrer une session FM depuis le site, synchronisée avec Discord

**Branch**: `028-site-started-sessions` | **Date**: 2026-09-30 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/028-site-started-sessions/spec.md`

## Summary

Le joueur démarre une session sur le site en choisissant un salon déjà utilisé par le bot et,
facultativement, un objet en FM ; il peut l'arrêter. Le Worker crée la session aussitôt et range une
demande dans une file `fm_bot_commands` ; le bot Botomoux la récupère toutes les 10 secondes, ouvre ou
ferme la session de son côté (sans renvoyer d'événement) et confirme. Le salon relie les deux côtés,
comme aujourd'hui. Les sessions gagnent un propriétaire, une origine et un état de synchronisation ;
les captures du site peuvent aller dans une session ouverte du joueur. Détails : [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5.7 (site et Worker)

**Primary Dependencies**: React 19, Vite 5 ; Cloudflare Workers + D1 (inchangées)

**Storage**: D1 — colonnes de `fm_sessions`, table `fm_bot_commands` (migration `0009`)

**Testing**: Vitest (Worker via `tests/support/fm-worker.ts`, intégration jsdom), Playwright

**Target Platform**: navigateurs récents ; Cloudflare Workers ; bot Python (modifié par son auteur)

**Project Type**: application web + Worker d'API

**Performance Goals**: ouverture ou fermeture dans Discord en moins de 15 s (SC-001) ; une lecture
indexée par appel du bot, ~8 640 appels par jour

**Constraints**: aucune connexion entrante vers le bot ; rétrocompatibilité avec un bot non mis à jour
(champs facultatifs) ; migration avant le déploiement du Worker

**Scale/Scope**: 10 à 20 joueurs, quelques sessions par jour

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principe | Vérification | Statut |
|---|---|---|
| I. Données traçables | Chaque session garde son origine et son propriétaire ; chaque demande au bot garde son état, sa date et sa raison d'échec. | ✅ |
| II. Exactitude avant optimisation | Transitions de la file et des sessions testées (ordre, renvoi, confirmation idempotente, annulations, capture ignorée après arrêt). Les totaux ne changent pas de règle. | ✅ |
| III. Décisions explicables | Le site montre l'état de synchronisation et la raison d'un échec ; rien n'est présenté comme ouvert dans Discord sans confirmation du bot. | ✅ |
| IV. Changements petits et cohérents | Une table et quatre colonnes ; le salon reste le lien avec le bot ; pas de dépendance. | ✅ |
| V. Données utilisateur | Aucune donnée nouvelle sur les joueurs (le propriétaire est un joueur déjà connu) ; routes du bot protégées par sa clé. | ✅ |

Re-vérification après la conception : inchangée.

## Project Structure

### Documentation (this feature)

```text
specs/028-site-started-sessions/
├── spec.md, plan.md, research.md, data-model.md, quickstart.md
├── contracts/
│   ├── fm-site-sessions-api.md   # routes du site
│   └── fm-bot-commands.md        # pour l'auteur du bot
└── checklists/requirements.md
```

### Source Code (repository root)

```text
worker/
├── migrations/0009_add_site_sessions.sql     # NOUVEAU
├── schema.sql
└── src/fm/
    ├── site-sessions.ts        # NOUVEAU : channels, démarrer, arrêter, relancer
    ├── bot-commands.ts         # NOUVEAU : GET /fm/bot/commands, POST …/ack
    ├── bot-events.ts           # session-start + author ; capture ignorée après arrêt ; session-stop annule les close
    ├── reads.ts                # owner, origin, sync, canStop ; ?mine=open
    ├── imports.ts              # sessionId facultatif
    └── router.ts

package.json                    # worker:db:migrate-site-sessions

src/
├── domain/forgemagie.ts        # types FmSession (owner, origin, sync, canStop), FmChannel
├── services/fm-api.ts          # getFmChannels, startFmSession, stopFmSession, resendFmSession, getFmSessions(mine)
└── features/forgemagie/
    ├── StartSession.tsx        # NOUVEAU : salon + objet facultatif
    ├── SessionsTab.tsx         # bouton Démarrer, état de synchro sur les cartes
    ├── SessionDetail.tsx       # Arrêter, Relancer, état de synchro
    └── CaptureImport.tsx       # choix de la session ouverte
```

## Amendements

- specs/025 : contrat du bot (`session-start.author` facultatif ; capture `ignored` après un arrêt
  depuis le site) ; import (`sessionId`).

## Complexity Tracking

Aucune violation.
