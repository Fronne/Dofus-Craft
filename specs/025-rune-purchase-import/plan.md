# Implementation Plan: Page Forgemagie — profils Discord, sessions FM et prix des runes

**Branch**: `025-rune-purchase-import` | **Date**: 2026-09-30 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/025-rune-purchase-import/spec.md`

## Summary

Une page **Forgemagie**, réservée aux membres du serveur Discord du groupe, garde les sessions FM du
bot Botomoux, montre ce que chaque joueur a dépensé et en tire le prix des runes. Le Worker existant
gagne :
- une connexion Discord OAuth2 (`identify`, `guilds.members.read`), avec une session par jeton
  porteur, stocké haché ;
- une route `POST /fm/bot/events` protégée par une clé propre au bot, qui reçoit quatre
  événements idempotents (`session-start`, `capture`, `session-reset`, `session-stop`) ;
- des lectures de sessions et de profils, qui masquent les joueurs privés côté Worker ;
- un import validé depuis le site.

Les achats dont le nom correspond exactement à une ressource connue créent des contributions de prix
ordinaires, enrichies d'une **origine** (`manual`, `capture`, `bot`), sauf en cas d'écart de plus de
25 % pour le bot ou de serveur inconnu. Sur le site, l'OCR (Tesseract.js, chargé à la demande)
reprend le prétraitement et l'expression régulière du bot, et l'image ne quitte jamais l'appareil.
La liste des runes vient d'un fichier généré depuis DofusDB (type 78). Détails :
[research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5.7 (site et Worker)

**Primary Dependencies**: React 19, React Router 7, Vite 5 ; Cloudflare Workers + D1 (Worker
`dofus-craft-community-price-api`) ; **nouvelle** : `tesseract.js` (site, import dynamique) ;
API OAuth2 de Discord (côté Worker, par `fetch`)

**Storage**: D1, 6 nouvelles tables `fm_*` et une colonne `origin` dans
`community_price_contributions` (migration `0007`) ; `localStorage` pour le jeton de session ;
fichiers générés `src/data/rune-items.json` et `worker/src/fm/priceable-items.json`

**Testing**: Vitest (unitaires pour les règles pures et les modules du Worker avec une base D1
simulée, intégration avec jsdom et fake-indexeddb), Playwright (e2e avec API et Discord simulés)

**Target Platform**: navigateurs récents (ordinateur et mobile) ; Cloudflare Workers

**Project Type**: application web (site statique et Worker d'API)

**Performance Goals**: une capture du bot visible sur le site en moins d'une minute (SC-001) ; OCR
d'une capture de chat en quelques secondes sur un téléphone récent ; aucun coût ajouté aux autres
pages (Tesseract chargé seulement sur l'import)

**Constraints**: les autres pages restent anonymes et inchangées (FR-003, SC-006) ; API
rétrocompatible avec le site déjà en ligne (`latestOrigin` optionnel) ; secrets uniquement dans le
Worker ; site et API sur des origines différentes (pas de cookie tiers) ; aucune image envoyée
(FR-025)

**Scale/Scope**: 10 à 20 joueurs ; quelques sessions par semaine ; 105 runes ; environ 5 000
ressources dans l'index de noms

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principe | Vérification | Statut |
|---|---|---|
| I. Données traçables | Chaque prix de rune affiche sa date et son origine (Bot Discord, Capture, Saisie manuelle) ; chaque ligne d'achat garde le nom lu, la ressource reconnue et la raison pour laquelle un prix a été créé ou non (`price_status`) ; `rune-items.json` indique sa source DofusDB et sa date. | ✅ |
| II. Exactitude avant optimisation | Règles pures testées : lecture d'une ligne d'achat, prix unitaire arrondi, normalisation des noms, totaux de session (somme de `spentKamas`, identique au bot), masquage des joueurs privés, transitions de session, statuts de prix. Cas limites testés : quantité nulle, nom ambigu, renvoi d'un événement, capture sans session ouverte. | ✅ |
| III. Décisions explicables | Le détail d'une session montre chaque objet avec quantité, total et prix moyen ; la page distingue une dépense (ce que le bot a compté) d'un prix (créé ou non, avec la raison). Aucune valeur inventée : une rune sans prix reste vide. | ✅ |
| IV. Changements petits et cohérents | Fonctionnalité large, découpée en stories livrables séparément (connexion → sessions → dépenses → runes → import). Une seule dépendance ajoutée (`tesseract.js`), chargée à la demande. Le code d'écriture des prix est réutilisé (`insertContribution`), pas dupliqué. Voir Complexity Tracking. | ✅ (justifié) |
| V. Données utilisateur | Première identité de joueur dans l'app, limitée au strict nécessaire (identifiant, pseudo, avatar Discord, serveur, visibilité) ; pas d'e-mail, jeton Discord jamais stocké, jeton de session stocké haché. Profil privé filtré côté Worker. Suppression complète après confirmation. La table des prix reste sans identifiant de joueur (pseudonyme haché, R8). Secrets hors du code. | ✅ (justifié) |

Re-vérification après la conception (data-model, contrats) : inchangée. Le contrat du bot
n'expose que ce que le bot voit déjà dans Discord.

## Project Structure

### Documentation (this feature)

```text
specs/025-rune-purchase-import/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── fm-bot-api.md          # pour l'auteur du bot
│   ├── fm-site-api.md         # routes /fm/* utilisées par le site, + latestOrigin
│   └── rune-items-data.md     # rune-items.json et index des noms
├── checklists/requirements.md
└── tasks.md                   # /speckit-tasks
```

### Source Code (repository root)

```text
worker/
├── migrations/0007_add_forgemagie.sql     # NOUVEAU : tables fm_*, colonne origin
├── schema.sql                             # mêmes ajouts pour une base neuve
├── wrangler.toml                          # commentaires des nouveaux secrets, variable SITE_URL
└── src/
    ├── index.ts                           # routage /fm/* avant le contrôle COMMUNITY_API_KEY ; Env étendu
    ├── contribution.ts                    # origin dans Contribution et l'INSERT ; latestOrigin en lecture
    ├── median.ts                          # summarizeContributions : origine de la dernière contribution
    └── fm/                                # NOUVEAU
        ├── auth.ts                        # login, callback OAuth Discord, sessions, logout
        ├── bot-events.ts                  # POST /fm/bot/events : validation, idempotence, transitions
        ├── purchases.ts                   # lignes d'achat → statut de prix, contribution (R8)
        ├── item-names.ts                  # normalisation et recherche dans priceable-items.json
        ├── reads.ts                       # sessions, joueurs, profils ; masquage des privés
        ├── me.ts                          # GET/PATCH/DELETE /fm/me
        ├── imports.ts                     # POST /fm/imports
        └── priceable-items.json           # généré

scripts/
└── build-rune-items.mjs                   # NOUVEAU : rune-items.json + priceable-items.json

src/
├── app/
│   ├── router.tsx                         # ROUTES.forgemagie = '/forgemagie'
│   ├── App.tsx                            # route de la page
│   └── AppShell.tsx                       # entrée « Forgemagie » dans la navigation
├── data/rune-items.json                   # généré
├── domain/
│   ├── forgemagie.ts                      # NOUVEAU : lignes d'achat, prix unitaire, noms, origines
│   └── types.ts                           # CommunityPrice : + latestOrigin optionnel
├── persistence/fm-session-token.ts        # NOUVEAU : jeton en localStorage (lecture sûre)
├── services/
│   ├── fm-api.ts                          # NOUVEAU : client des routes /fm/* (ne lève jamais d'exception)
│   ├── capture-ocr.ts                     # NOUVEAU : prétraitement canvas + Tesseract.js dynamique
│   └── community-price-api.ts             # lecture de latestOrigin
└── features/forgemagie/                   # NOUVEAU
    ├── ForgemagiePage.tsx                 # connexion, onglets Sessions / Profil / Runes
    ├── useFmAuth.ts                       # fragment #session / #error, jeton, profil
    ├── SessionsTab.tsx, SessionDetail.tsx # US2
    ├── ProfileTab.tsx                     # US1 (réglages) + US3 (dépenses), suppression
    ├── RunesTab.tsx                       # US4 : liste, recherche, filtre par stat, origine
    └── CaptureImport.tsx                  # US5 : collage / dépôt, correction, validation

tests/
├── unit/        # forgemagie (domaine), fm-bot-events, fm-purchases, fm-item-names, fm-reads
│                # (masquage), fm-auth (callback simulé), fm-me (suppression), contribution-origin,
│                # capture-ocr (extraction depuis un texte), fm-api
├── integration/ # forgemagie-page (non connecté, connecté, sessions, profil privé, runes, import)
└── e2e/forgemagie.spec.ts                 # parcours avec API et Discord simulés
```

**Structure Decision**: structure existante (site dans `src/`, Worker dans `worker/`, tests dans
`tests/`, scripts de données dans `scripts/`). Le code FM du Worker est regroupé dans
`worker/src/fm/`, et celui du site dans `src/features/forgemagie/`, pour que la fonctionnalité reste
lisible d'un bloc.

## Ordre de livraison

1. **Socle** : migration, `rune-items.json` et index des noms, colonne `origin` et `latestOrigin`.
2. **US1** : connexion Discord, profil (serveur, visibilité), page non connectée ou connectée.
3. **US2** : événements du bot, liste et détail des sessions. Peut être testé avec `curl` avant la
   modification du bot.
4. **US4** : prix issus des achats du bot, onglet Runes.
5. **US3** : dépenses du profil, profil privé, suppression.
6. **US5** : import de capture sur le site.

Le bot doit être modifié par son auteur à partir de [contracts/fm-bot-api.md](contracts/fm-bot-api.md)
pour que US2 fonctionne en conditions réelles. Le site est livrable avant.

## Amendements aux specs existantes

À noter en fin de chaque spec concernée lors de l'implémentation :
- specs/004 : FR-010 (aucune donnée identifiant le joueur) reste vrai pour la table des prix ; les
  données de joueur de la page Forgemagie sont dans des tables séparées, régies par specs/025.
- specs/021 et specs/024 : contrats `/community-price` et `/community-prices`, champ
  `latestOrigin` ajouté.
- specs/023 : navigation principale, entrée « Forgemagie » ajoutée.
- README : section Fonctionnalités.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Principe IV : fonctionnalité large (auth, 6 tables, 11 routes, une dépendance) | La spec lie profil, sessions du bot et prix : la connexion n'a de sens qu'avec les sessions, et les prix viennent des mêmes achats. | Ne livrer que les prix des runes (première version de la spec) : refusé par le porteur du projet, qui veut les profils et les sessions. La taille est maîtrisée par la livraison story par story (voir « Ordre de livraison »). |
| Principe V : l'app stocke pour la première fois des identifiants de joueurs, y compris de joueurs jamais connectés (vus par le bot) | FR-013 : un joueur qui poste dans Discord avant de se connecter doit retrouver ses achats. Le bot voit déjà ces données dans le salon du groupe. | Ignorer les achats des joueurs non connectés : les totaux de session ne correspondraient plus au bot (FR-011, SC-002). |

**Périmètre de l'exception V** : seules les tables `fm_*` contiennent des identifiants Discord. La
table des prix garde des identifiants pseudonymes (R8). Chaque joueur peut tout supprimer
(FR-007).

**Condition de levée** : aucune tant que la fonctionnalité existe. Si la page Forgemagie est
retirée, les tables `fm_*` sont supprimées par une migration.
