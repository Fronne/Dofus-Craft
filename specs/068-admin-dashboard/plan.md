# Plan d'implémentation : Tableau de bord de l'administration

**Branche** : `068-admin-dashboard` | **Date** : 2026-10-21 | **Spec** : [spec.md](spec.md)

## Résumé

La page d'administration (`admin/AdminPage.tsx`) empile six sections. On la transforme en deux vues
dans la même page : un **tableau de bord** (grille de six cartes-résumé) et une **vue de section**
(une seule section, avec « Retour au tableau de bord »). La vue courante vient de l'ancre de l'URL
(`#pages`, `#bandeau`, `#compteurs`, `#cles`, `#correspondances`, `#cloudflare`), ce qui fait
marcher le bouton « précédent ». Les six éditeurs existants sont réutilisés tels quels ; seul
l'assemblage change. Les résumés viennent des appels `adminApi` existants, lus en parallèle à
l'ouverture du tableau de bord. Aucune API serveur, aucune dépendance ajoutée.

## Contexte technique

**Langage/Version** : TypeScript, React (SPA d'administration `admin/`, Vite)

**Dépendances principales** : aucune nouvelle

**Stockage** : N/A (aucune donnée nouvelle)

**Tests** : Vitest + Testing Library (`tests/unit`, `tests/integration`)

**Plateforme cible** : navigateur, derrière Cloudflare Access (worker `admin-worker`, inchangé)

**Type de projet** : application web (front d'administration)

**Objectifs de performance** : six lectures en parallèle ; le tableau de bord s'affiche tout de suite, chaque carte se remplit à son rythme

**Contraintes** : sections existantes inchangées fonctionnellement ; style et variables CSS de `admin/admin.css` et du site

**Échelle/Périmètre** : 1 page, 6 cartes, ~4 nouveaux fichiers

## Vérification de la constitution

| Principe | Verdict |
|---|---|
| I. Données de jeu traçables | N/A (aucune donnée de jeu). |
| II. Exactitude avant optimisation | OK : règles de résumé (compte, niveau Cloudflare, ancre → section) en fonctions pures testées, cas limites inclus. |
| III. Décisions explicables | OK : un résumé indisponible est dit tel quel, jamais inventé (FR-008). |
| IV. Petits changements cohérents | OK : réutilise les éditeurs, `usageLevel`, `adminApi` ; pas de dépendance, pas de routeur. |
| V. Données utilisateur | OK : aucune donnée collectée ; aucune action destructive ajoutée. |

Aucune violation, pas de suivi de complexité. Revérifié après conception : inchangé.

## Structure du projet

### Documentation

```text
specs/068-admin-dashboard/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/admin-dashboard-ui.md
└── tasks.md            # créé par /speckit-tasks
```

### Code source

```text
admin/
├── AdminPage.tsx          # modifié : choisit tableau de bord ou section selon l'ancre
├── Dashboard.tsx          # nouveau : grille des cartes + chargement des résumés
├── dashboard-summary.ts   # nouveau : fonctions pures (résumés, ancres)
├── useSection.ts          # nouveau : lecture/écriture de l'ancre (hashchange)
└── admin.css              # modifié : styles .dashboard-*
tests/
├── unit/admin-dashboard-summary.test.ts      # nouveau
└── integration/admin-page.test.tsx           # modifié : ouvre la section avant d'agir
                                              # + admin-dashboard.test.tsx nouveau
```

**Décision de structure** : tout reste dans `admin/`, à côté des éditeurs ; la logique pure est séparée du rendu, comme `src/domain/cloudflare-usage.ts`.
