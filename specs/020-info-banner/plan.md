# Implementation Plan: Bandeau d'information

**Branch**: `020-info-banner` | **Date**: 2026-09-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/020-info-banner/spec.md`

## Summary

Un message unique (texte, style Info / Important, date de fin optionnelle) est enregistré dans D1
par la page d'administration existante (Worker `dofus-craft-admin`, protégé par Cloudflare Access,
specs/014). Le Worker public l'expose en lecture anonyme via `GET /info-message`, qui ne renvoie rien
une fois la date de fin passée. L'application le charge au démarrage, sans bloquer l'affichage, et
montre un bandeau en haut de toutes les pages. La croix enregistre dans `localStorage` la version du
message fermé. Une nouvelle version (nouveau texte ou nouveau style) fait réapparaître le bandeau.

Même chemin que les compteurs de joueurs : une table D1, les écritures côté administration et la
lecture côté Worker public. La validation est partagée dans `src/domain/`.

## Technical Context

**Language/Version** : TypeScript 5 (strict), React 19 ; Workers Cloudflare (TypeScript)

**Primary Dependencies** : React, Vite ; Workers + D1 ; Cloudflare Access (existant). Aucune
nouvelle dépendance

**Storage** : D1, nouvelle table `info_message` (une ligne au plus, migration `0006`) ;
`localStorage` pour la version fermée

**Testing** : Vitest (validation, routes Worker et administration, client, bandeau, intégration),
Playwright (un scénario)

**Target Platform** : navigateurs modernes ; Workers Cloudflare

**Project Type** : SPA + Worker public + Worker d'administration avec sa page

**Performance Goals** : aucun retard d'affichage du site (SC-005) : chargement en parallèle, bandeau
inséré dès l'arrivée de la réponse

**Constraints** :
- écriture réservée au propriétaire (FR-002) ;
- texte brut, jamais interprété comme du HTML (FR-009) ;
- panne → aucun bandeau (FR-008) ;
- lisible sur téléphone.

**Scale/Scope** : un message, 10 à 20 joueurs

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principe | Vérification | Statut |
|---|---|---|
| I. Données traçables | Sans objet pour les prix ; le bandeau n'affiche que le message publié, rien en cas de panne | ✅ |
| II. Exactitude | Tests : validation (longueur, style, date de fin future), expiration, version et fermeture, droits d'écriture | ✅ |
| III. Décisions explicables | Sans effet sur les calculs | ✅ |
| IV. Changements petits et cohérents | Réutilise l'administration, Access, D1 et le schéma des compteurs ; une table, une route publique, trois routes d'administration | ✅ |
| V. Données utilisateur | Aucune donnée joueur collectée ; seule la version fermée reste sur l'appareil ; écriture protégée par Access et vérification du propriétaire | ✅ |
| Contraintes projet | Accès réseau isolé dans `info-message-api.ts` ; règles dans `src/domain/info-message.ts` ; présentation dans `InfoBanner` | ✅ |

**Réévaluation après la phase 1** : inchangée.

## Project Structure

### Documentation (this feature)

```text
specs/020-info-banner/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── info-message-api.md    # GET /info-message + /api/message (administration)
│   └── info-banner-ui.md      # bandeau et éditeur d'administration
└── tasks.md
```

### Source Code (repository root)

```text
worker/
├── migrations/0006_add_info_message.sql  # nouveau
└── src/
    ├── info-message.ts       # nouveau : lecture, filtre d'expiration, format JSON
    └── index.ts              # modifié : GET /info-message

admin-worker/src/
├── message.ts                # nouveau : lire / enregistrer / retirer
└── index.ts                  # modifié : GET, PUT, DELETE /api/message

admin/
├── MessageEditor.tsx         # nouveau : texte, style, date de fin, Publier / Retirer
├── AdminPage.tsx             # modifié : section « Bandeau d'information »
└── admin-api.ts              # modifié : appels /api/message

src/
├── domain/info-message.ts           # nouveau : types, validateInfoMessageInput, version, isExpired
├── services/info-message-api.ts     # nouveau : getInfoMessage(), ne lève jamais
├── persistence/info-banner-dismissal.ts  # nouveau : version fermée (localStorage, try/catch)
├── components/InfoBanner.tsx        # nouveau
├── app/AppShell.tsx                 # modifié : bandeau en haut de la zone principale
└── styles/global.css                # modifié : styles Info / Important

tests/
├── unit/info-message-validation.test.ts
├── unit/info-message-route.test.ts        # Worker public : expiration, absence
├── unit/admin-message-api.test.ts         # administration : droits, validation, PUT/DELETE
├── unit/info-message-api.test.ts          # client
├── unit/info-banner-dismissal.test.ts
└── integration/info-banner.test.tsx       # affichage, style, fermeture, nouvelle version, panne

package.json                  # script worker:db:migrate-info-message
```

**Structure Decision** : on reprend l'organisation des compteurs de joueurs (specs/014).

## Complexity Tracking

Aucune violation : section sans objet.
