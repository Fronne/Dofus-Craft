# Plan d'implémentation : bulle « donjons sans drop » de Le-Lanceurdeglyphe

**Branch**: `013-dungeon-drop-counter` | **Date**: 2026-09-24 | **Spec**: [spec.md](spec.md)

**Input**: Spécification de `specs/013-dungeon-drop-counter/spec.md`

> **Révision 2026-09-24** : le chiffre est une constante dans le code (plus de base, de route du
> Worker ni de code secret). Les éléments du plan qui concernent le Worker, D1, le service et le
> stockage local sont abandonnés ; seuls restent les images, la bulle et ses styles.

## Résumé

Un bouton rond avec le portrait officiel du Féca (extrait du client Dofus), fixe dans un coin de
toutes les pages, ouvre une bulle avec « Le-Lanceurdeglyphe », le nombre de donjons sans drop et le
« Parangon de puissance » (nom et icône DofusDB). Le compteur est une ligne unique dans la base D1
du Worker existant, lisible par tous (`GET /dungeon-counter`) et modifiable seulement avec le code
secret du propriétaire (`POST /dungeon-counter`, vérifié côté serveur, tentatives limitées). Voir
[research.md](research.md).

## Contexte technique

**Language/Version** : TypeScript 5.7, React 19 (front) ; Cloudflare Worker + D1 (SQLite)

**Primary Dependencies** : aucune nouvelle ; UnityPy (déjà installé, hors dépôt) pour extraire le
portrait une fois

**Storage** : D1, table `dungeon_drop_counter` (une ligne) ; `localStorage` pour la dernière valeur
et le code du propriétaire

**Testing** : Vitest + Testing Library (service, bulle, logique du Worker) ; Playwright
(non-régression, API coupée) ; vérification manuelle en navigateur

**Target Platform** : navigateurs récents, bureau et mobile ; Worker Cloudflare

**Project Type** : application web + Worker

**Performance Goals** : une lecture à l'arrivée et à chaque ouverture ; aucun effet sur les pages

**Constraints** : jamais par-dessus la barre d'onglets ; sous la visite guidée et les dialogues ;
deux designs × deux thèmes ; code secret hors du dépôt

**Scale/Scope** : 1 composant, 1 service, 2 routes Worker, 1 table, 2 images

## Constitution Check

| Principe | Évaluation |
|----------|-----------|
| I. Données de jeu traçables | Portrait : `class_assets_.bundle` / `Head_10`, confirmé par DofusDB `/breeds/1`. Ressource : DofusDB id 21189, icône 50733. Sources notées à côté des images. |
| II. Exactitude | Règles du compteur (≥ 0, +1, −1 plancher, remise à zéro) testées côté Worker. |
| III. Décisions explicables | Une valeur venant du cache est signalée « peut-être datée » ; jamais de chiffre inventé. |
| IV. Changements petits | Un composant isolé, un service, deux routes. Aucune dépendance ajoutée. |
| V. Données utilisateur | Seuls le nombre et sa date sont stockés. Le code secret est un secret Cloudflare, jamais commité. Il n'est mémorisé que sur l'appareil du propriétaire. L'IP sert seulement de clé au limiteur. |

**Résultat** : conforme, avant et après la phase 1.

## Project Structure

### Documentation (this feature)

```text
specs/013-dungeon-drop-counter/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── dungeon-counter-api.md
├── checklists/
│   └── requirements.md
└── tasks.md             # créé par /speckit-tasks
```

### Source Code (repository root)

```text
public/dungeon-counter/
├── feca.png                         # Head_10, extrait du client Dofus
└── parangon.png                     # icône DofusDB 50733

worker/
├── migrations/0004_add_dungeon_counter.sql
├── schema.sql                       # table ajoutée pour les nouvelles bases
├── src/dungeon-counter.ts           # nouveau : lecture, actions, vérification du code
├── src/index.ts                     # routes GET/POST /dungeon-counter
└── wrangler.toml                    # limiteur OWNER_CODE_LIMITER

src/
├── services/dungeon-counter-api.ts             # nouveau
├── persistence/dungeon-counter-storage.ts      # nouveau : dernière valeur + code
├── features/dungeon-counter/DungeonCounterBubble.tsx   # nouveau
├── app/AppShell.tsx                 # rendu de la bulle
└── styles/global.css                # styles de la bulle (+ retouches dans design-modern.css)

tests/
├── unit/dungeon-counter-worker.test.ts
├── unit/dungeon-counter-api.test.ts
└── integration/dungeon-counter-bubble.test.tsx

package.json                         # script worker:db:migrate-dungeon-counter
```

**Structure Decision** : même Worker et même base que les prix communautaires ; composant isolé
dans `src/features/dungeon-counter/`.

## Points d'attention

- La bulle apparaîtra aussi en « Classique » : les captures de référence de specs/012 changeront sur
  toutes les pages (élément ajouté, attendu).
- Déploiement en trois temps : migration D1, secret `COUNTER_OWNER_CODE`, puis Worker et front.
- Portrait : Féca homme (`Head_10`), confirmé par le joueur.
