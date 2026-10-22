# Plan d'implémentation : Graphiques sur le tableau de bord de l'administration

**Branche** : `070-admin-dashboard-graphiques` | **Date** : 2026-10-22 | **Spec** : [spec.md](spec.md)

## Résumé

Le tableau de bord (spec 068) est une grille de cartes à résumé texte. On y ajoute des visuels, sans
dépendance de graphique (SVG écrits à la main, dans le style de `admin/UsageChart.tsx`) :

- **Cloudflare** : courbe de la journée UTC en cours, heure par heure, en cumul et en % de la limite,
  avec les heures de franchissement de 80 % et 100 %. Nouvelle route `GET /api/usage/today`, à côté de
  l'existante (la section Cloudflare et son historique 7 / 30 jours ne changent pas).
- **Clés** : total de lignes du mois, répartition par clé, évolution par jour, choix du mois. Nouvelle
  route `GET /api/sniffer/contributions?month=AAAA-MM`, lue dans `sniffer_daily_usage`.
- **Prix communautaires** et **Visites** (deux cartes nouvelles, en lecture seule) : séries sur 30 jours
  via une route `GET /api/activity`, lue dans `community_price_contributions` et `app_visits`.
- **Correspondances, compteurs, bandeau, ancienneté des clés** : visuels calculés côté navigateur à
  partir des lectures déjà faites par le tableau de bord (aucune route nouvelle).

Chaque carte garde son résumé texte et reste un lien vers sa section ; le visuel est un élément frère du
lien (pas dans le lien, pour ne pas imbriquer d'éléments interactifs). Chaque visuel a un équivalent
texte (`<details>` avec tableau). Une migration ajoute deux index pour que les nouvelles lectures ne
balayent pas des tables entières (les lectures D1 comptent dans la limite quotidienne suivie ici).

## Contexte technique

**Langage/Version** : TypeScript, React (SPA `admin/`, Vite) ; worker `admin-worker/` (Cloudflare Workers)

**Dépendances principales** : aucune nouvelle (SVG manuel)

**Stockage** : Cloudflare D1 existante, en lecture seule ; une migration d'index (`0022`), aucune table

**Tests** : Vitest + Testing Library (`tests/unit`, `tests/integration`)

**Plateforme cible** : navigateur derrière Cloudflare Access ; worker `dofus-craft-admin`

**Type de projet** : application web (front d'administration + worker d'administration)

**Objectifs de performance** : chaque carte se remplit à son rythme (lectures indépendantes) ; les trois
nouvelles routes font des lectures bornées par index (voir research.md R4)

**Contraintes** : sections existantes inchangées ; jamais de clé en clair ni d'identifiant d'appareil dans
les réponses ; rien d'inventé quand une source manque ; thème clair / sombre via `admin/admin.css`

**Échelle/Périmètre** : 1 page ; 3 routes ; 3 composants de graphique ; 2 cartes nouvelles ; ~12 fichiers touchés

## Vérification de la constitution

| Principe | Verdict |
|---|---|
| I. Données de jeu traçables | OK : chaque série cite sa source (table, jour UTC) ; une donnée absente est dite telle (FR-008, FR-009), pas de valeur fabriquée. |
| II. Exactitude avant optimisation | OK : cumuls, franchissements de seuils, découpage par mois, ancienneté et temps restant en fonctions pures testées (normal, bornes, données vides). |
| III. Décisions explicables | OK : chaque graphique a ses valeurs exactes en texte ; heure partielle et jour UTC indiqués. |
| IV. Petits changements cohérents | OK : pas de dépendance ni de routeur ; réutilise `usageLevel`, `usagePercent`, `adminApi` ; les trois composants SVG répondent chacun à un besoin de la spec. |
| V. Données utilisateur | OK : lecture seule, totaux par jour uniquement, aucune empreinte de clé ni `device_id` en sortie (FR-012, FR-016). |

Aucune violation, pas de suivi de complexité. Revérifié après conception : inchangé.

## Structure du projet

### Documentation

```text
specs/070-admin-dashboard-graphiques/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── admin-dashboard-api.md     # les 3 routes
│   └── admin-dashboard-ui.md      # cartes et graphiques
└── tasks.md                       # créé par /speckit-tasks
```

### Code source

```text
src/domain/
└── cloudflare-usage.ts            # modifié : heures, cumul, franchissements, parseTodayUsageResponse
admin-worker/src/
├── cloudflare-usage.ts            # modifié : readTodayUsage (requête horaire)
├── sniffer-contributions.ts       # nouveau : lignes par clé et par jour sur un mois
├── activity.ts                    # nouveau : prix par jour / origine, visites par jour
└── index.ts                       # modifié : /api/usage/today, /api/sniffer/contributions, /api/activity
worker/
├── migrations/0022_add_dashboard_indexes.sql   # nouveau : index created_at et app_visits.day
└── schema.sql                                  # modifié : mêmes index pour une base neuve
package.json                       # modifié : script worker:db:migrate-dashboard-indexes
admin/
├── admin-api.ts                   # modifié : getTodayUsage, getKeyContributions, getActivity
├── Dashboard.tsx                  # modifié : carte = lien + visuel ; 2 cartes lecture seule
├── dashboard-summary.ts           # modifié : cartes prix / visites, résumés
├── dashboard-insights.ts          # nouveau : ancienneté, clés endormies, compteurs, temps restant
├── DayUsageChart.tsx              # nouveau : courbe Cloudflare de la journée
├── BarList.tsx                    # nouveau : barres horizontales (clés, compteurs)
├── DailyColumns.tsx               # nouveau : colonnes par jour, empilables par origine
├── KeyContributions.tsx           # nouveau : carte clés (mois, total, barres, évolution)
└── admin.css                      # modifié : styles .dashboard-visual, .chart-*
tests/
├── unit/cloudflare-usage-today.test.ts        # nouveau
├── unit/admin-sniffer-contributions.test.ts   # nouveau
├── unit/admin-activity.test.ts                # nouveau
├── unit/admin-dashboard-insights.test.ts      # nouveau
└── integration/admin-dashboard.test.tsx       # modifié : visuels, indisponible, texte équivalent
```

**Décision de structure** : tout reste dans `admin/` et `admin-worker/`, à côté des éditeurs, comme les
specs 058 et 068. La logique pure (cumul, seuils, mois, ancienneté) est séparée du rendu SVG, comme
`src/domain/cloudflare-usage.ts`. La migration vit dans `worker/` car la base D1 est partagée.
