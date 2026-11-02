# Plan d'implémentation : Connexion Discord pour tout le site

**Branche** : `075-connexion-discord-site` | **Date** : 2026-11-02 | **Spec** : [spec.md](spec.md)

**Entrée** : spécification `specs/075-connexion-discord-site/spec.md`

## Résumé

La connexion Discord de la Forgemagie (Worker `worker/src/fm/auth.ts`, jeton de session
`dofus-craft:fm-session-token`, profil `fm_players`) est généralisée à tout le site, sans la
réécrire :

- **Worker** : la connexion n'exige plus d'être membre du serveur ; l'appartenance est mesurée à la
  connexion, stockée sur la session (`is_member`) et vérifiée par les routes Forgemagie (403
  `not-member`). Le retour se fait sur la page d'origine. Le profil gagne `breed_id` (icône de
  classe) et `isMember`.
- **Site** : un `AuthContext` global remplace l'état local de `useFmAuth`. La barre de navigation
  affiche le bouton de connexion ou le menu du compte (avatar, pseudo, icône de classe, profil,
  déconnexion). Une page `/profil` permet de choisir la classe et de supprimer le profil. La
  Forgemagie lit le même contexte et explique l'accès réservé aux non-membres.
- Les sessions et données existantes restent valides : même jeton, mêmes tables, migration additive
  avec `is_member` à 1 par défaut (tous les connectés actuels sont membres).

## Contexte technique

**Langage/Version** : TypeScript (React 18 + Vite côté site ; Cloudflare Worker côté API)

**Dépendances principales** : react-router-dom, Vitest + Testing Library, Playwright (e2e) ; D1 (SQLite) pour le stockage ; aucune nouvelle dépendance

**Stockage** : D1 — `fm_players` (+ `breed_id`), `fm_auth_sessions` (+ `is_member`) ; jeton côté navigateur dans `localStorage` (clé existante conservée)

**Tests** : `npm run test` (Vitest, `tests/unit`, `tests/integration`), e2e Playwright dans `tests/e2e`

**Plateforme cible** : navigateurs desktop et mobile ; Worker Cloudflare

**Type de projet** : application web (site + Worker)

**Objectifs de performance** : la connexion ne retarde pas l'affichage des pages ; l'état du compte est lu une fois par chargement ; sans jeton, aucun appel réseau

**Contraintes** : aucun mot de passe ; le jeton n'apparaît ni dans l'adresse (fragment effacé dès lecture), ni dans les journaux ; site utilisable sans connexion

**Échelle/Périmètre** : une communauté Dofus (quelques centaines d'utilisateurs) ; 19 classes

## Vérification de la constitution

| Principe | Verdict |
|---|---|
| I. Données de jeu traçables | OK — la liste des classes est `BREEDS` (déjà documentée, `src/domain/breeds.ts`) ; pas de nouvelle donnée de jeu inventée. |
| II. Correction avant optimisation | OK — règles testables : appartenance, validation de la classe, validation du chemin de retour (anti-redirection ouverte), expiration. Tests prévus pour cas normaux, limites et entrées invalides. |
| III. Décisions explicables | OK — le refus d'accès indique la raison (non membre) ; aucun calcul de craft touché. |
| IV. Changements petits et cohérents | OK — on généralise l'existant (mêmes routes `/fm/auth/*`, mêmes tables, même jeton) ; pas de renommage de masse ni de nouvelle dépendance. |
| V. Données utilisateur | OK — on garde identifiant, pseudo, avatar, classe, préférences existantes ; suppression du profil conservée (confirmation) ; scopes Discord inchangés ; secrets hors dépôt. |

Re-vérification après conception : aucune violation, pas de table de complexité.

## Structure du projet

### Documentation

```text
specs/075-connexion-discord-site/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── auth-api.md
└── tasks.md          # créé par /speckit-tasks
```

### Code source

```text
worker/
├── migrations/0030_add_site_login.sql      # breed_id, is_member
├── schema.sql                              # même ajout (schéma de référence)
└── src/fm/
    ├── auth.ts        # connexion ouverte, is_member, retour page d'origine, erreur « annulée »
    ├── http.ts        # requireSession → { discordUserId, isMember } ; requireMember
    ├── me.ts          # breedId / isMember dans le profil, PATCH breedId
    ├── breeds.ts      # ids valides des classes (copie du Worker)
    └── router.ts      # routes Forgemagie derrière requireMember

src/
├── app/
│   ├── AuthContext.tsx        # fournisseur + hook useAuth (état global)
│   ├── AccountMenu.tsx        # bouton « Se connecter » / avatar + menu
│   ├── AppShell.tsx           # AccountMenu dans la zone droite de la barre
│   └── router.tsx             # ROUTES.profile = '/profil'
├── domain/forgemagie.ts       # FmMe : breedId, isMember ; erreurs de connexion
├── persistence/fm-session-token.ts   # inchangé (clé conservée)
├── services/fm-api.ts         # URL de connexion avec chemin de retour ; breedId ; 403 not-member
└── features/
    ├── account/ProfilPage.tsx # identité, choix de classe, suppression du profil
    ├── account/BreedPicker.tsx
    └── forgemagie/
        ├── useFmAuth.ts       # devient un adaptateur mince sur useAuth
        └── ForgemagiePage.tsx # état « connecté, non membre »

tests/
├── unit/        # auth-return-path, breed validation, requireMember, fm-api
└── integration/ # AccountMenu, AuthContext, ProfilPage, ForgemagiePage non-membre
```

**Décision de structure** : projet web existant (site `src/` + Worker `worker/`). Les nouveautés du
site vont dans `src/app/` (contexte et menu, partagés) et `src/features/account/` (page profil).

## Suivi de complexité

Aucune violation de la constitution à justifier.
