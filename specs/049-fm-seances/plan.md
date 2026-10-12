# Implementation Plan: Page Forgemagie en séances de FM

**Branch**: `049-fm-seances` | **Date**: 2026-10-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/049-fm-seances/spec.md`

## Summary

La page Forgemagie est réécrite sur le modèle du site en ligne : trois onglets (Séances de FM, joueurs du
groupe, Profil), le détail d'une séance avec ses sessions et ses captures, la création d'une séance, les
actions d'état, le choix de l'objet, l'import d'une capture dans la session ouverte et la correction des
lignes. Le client de l'API (`src/services/fm-api.ts`) passe aux routes `/fm/seances`, `/fm/players` et
`PUT /fm/captures/:id/lines`, déjà servies par le Worker du dépôt (specs/045). Les composants du modèle
précédent (sessions paginées, objets en FM, salons) sont retirés. Seul le site change.

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 18, Vite

**Primary Dependencies**: aucune dépendance ajoutée

**Storage**: aucun changement (jeton de session en `localStorage`, inchangé)

**Testing**: Vitest (+ Testing Library) ; `src/services/fm-api` simulé dans le test de page, `fetch` simulé
dans le test du client

**Target Platform**: navigateur

**Project Type**: application web monopage + API existante ; seul le site est touché

**Performance Goals**: relecture d'une séance en cours toutes les 10 s, seulement quand la page est visible

**Constraints**: libellés et comportement du site en ligne ; API non modifiée ; adresse de l'API prise dans
la configuration (`VITE_COMMUNITY_API_URL`) ; Node 22

**Scale/Scope**: 1 client d'API réécrit (≈ 200 lignes), 12 composants (≈ 1 100 lignes), ≈ 80 règles de
style, ≈ 450 lignes de tests ; 9 fichiers retirés

## Constitution Check

| Principe | Verdict | Remarque |
|----------|---------|----------|
| I. Données exactes et traçables | OK | Chaque montant d'une séance se retrouve dans une session, une capture et une ligne ; une ligne corrigée garde sa valeur lue. |
| II. Exactitude avant optimisation | OK | Les règles (regroupement des dépenses par séance, lignes non comptées, valeurs d'une correction, libellés d'état) sont pures et testées ; les réponses de l'API sont validées avant usage. |
| III. Décisions explicables | OK | Lignes non comptées listées avec la raison ; prix corrigé non partagé annoncé ; état Discord d'une demande affiché. |
| IV. Changements petits et cohérents | Écart justifié | La page entière change d'un coup : c'est une réécriture d'un écran existant en production, pas une évolution ; la découper laisserait le dépôt dans un état que le site en ligne n'a jamais eu. |
| V. Données des utilisateurs | OK | Mêmes données qu'en ligne ; la capture reste lue sur l'appareil ; le texte de visibilité dit exactement ce que les autres voient. |
| Contrainte : sources externes isolées | OK | Tout passe par `src/services/fm-api.ts`. |
| Contrainte : échec sûr | OK | Chaque appel a un état « indisponible » ; un refus de l'API a son message ; rien n'est enregistré avant « Valider ». |

Re-vérification après conception : inchangée.

## Project Structure

```text
specs/049-fm-seances/
├── plan.md
├── research.md
├── contracts/fm-seances-client.md
├── quickstart.md
└── tasks.md

src/domain/forgemagie.ts                 # types des séances, règles pures ; types du modèle précédent retirés
src/services/fm-api.ts                   # routes des séances, joueurs, correction
src/components/Icon.tsx                  # + hammer, user
src/features/forgemagie/
├── ForgemagiePage.tsx                   # connexion, trois onglets
├── useFmAuth.ts                         # le serveur du profil suit celui du site
├── SeancesTab.tsx                       # liste + carte d'une séance + état
├── StartSeance.tsx                      # « Nouvelle séance de FM »
├── SeanceDetail.tsx                     # détail, actions, chiffres
├── SeanceItem.tsx                       # objet de la séance
├── SeanceItemSearch.tsx                 # recherche d'un objet (remplace SessionItemSearch, EquipmentPicker)
├── SeanceSessions.tsx                   # sessions, captures, repli
├── CaptureCorrection.tsx                # correction des lignes
├── PurchasesTable.tsx                   # tableau des achats
├── PlayersTab.tsx                       # joueurs du groupe
├── ProfileTab.tsx                       # réglages, dépenses, suppression
├── CaptureImport.tsx                    # import dans la session ouverte
├── FmItemIcon.tsx, PlayerBadge.tsx, useEquipmentSearch.ts
└── (retirés) SessionsTab, SessionDetail, SessionCaptures, StartSession, SessionItemSearch,
              EquipmentPicker, FmItemsSection, FmItemRecap, FmChannelsSection
src/styles/global.css                    # section Forgemagie alignée sur le site en ligne

tests/unit/forgemagie-domain.test.ts     # + règles nouvelles
tests/unit/fm-api.test.ts                # client réécrit
tests/integration/forgemagie-page.test.tsx  # réécrit : cinq récits
```

**Structure Decision**: un composant par bloc du site en ligne, dans le dossier existant de la page.

## Complexity Tracking

| Écart | Pourquoi | Alternative écartée |
|-------|----------|---------------------|
| Une page entière réécrite en une fonctionnalité (principe IV) | L'écran en ligne remplace l'ancien d'un bloc ; ses parties partagent types, client d'API et styles | Livrer onglet par onglet : chaque étape intermédiaire mélangerait deux modèles et ne correspondrait à aucun état connu du site |
