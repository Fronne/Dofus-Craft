# Plan d'implémentation : Tableau de bord d'administration moderne et activation de toutes les pages

**Branche** : `071-admin-dashboard-moderne` | **Date** : 2026-10-23 | **Spec** : [spec.md](spec.md)

## Résumé

Deux changements indépendants :

1. **Sept pages activables.** Le réglage `SiteSettings` (deux booléens `forgemagiePage` et `hdvPage`) devient une
   liste de sept booléens, décrite à un seul endroit (`SITE_PAGES` dans `src/domain/site-settings.ts`) : champ,
   clé D1, libellé, adresse, valeur par défaut. Le Worker public (lecture), le Worker d'administration
   (écriture), l'éditeur « Pages du site » et le site public (navigation + routes) lisent tous cette liste. Une
   migration `0023` élargit la contrainte `CHECK` de `site_settings` (reconstruction de table, comme `0017`).
2. **Tableau de bord moderne.** Mise en page en trois étages (rangée de 4 chiffres clés, grandes cartes de
   graphiques, cartes secondaires) et habillage sombre à dégradés bleu-vert, cartes arrondies, lueur. Les
   composants des specs 068 et 070 sont réutilisés ; seul l'assemblage (`Dashboard.tsx`), un composant
   `KeyFigures.tsx` et le CSS changent. Aucune route serveur nouvelle, aucune dépendance.

## Contexte technique

**Langage/Version** : TypeScript, React (site `src/`, SPA `admin/`), Workers Cloudflare (`worker/`, `admin-worker/`)

**Dépendances principales** : aucune nouvelle

**Stockage** : D1 `site_settings` (clé, valeur 0/1, date) ; une migration de reconstruction (`0023`), aucune donnée perdue

**Tests** : Vitest + Testing Library (`tests/unit`, `tests/integration`)

**Plateforme cible** : navigateur ; Workers `dofus-craft-community-prices` (lecture publique) et `dofus-craft-admin`

**Type de projet** : application web (site + administration + deux Workers)

**Objectifs de performance** : inchangés ; la lecture des réglages reste une requête bornée à 7 lignes

**Contraintes** : états déjà enregistrés (`forgemagie_page`, `hdv_page`) conservés ; une API plus ancienne qui ne
connaît pas les nouveaux champs ne doit pas désactiver des pages (valeur par défaut) ; états jamais portés par la
couleur seule ; thème clair et sombre

**Échelle/Périmètre** : 7 pages, 4 chiffres clés, ~15 fichiers touchés

## Vérification de la constitution

| Principe | Verdict |
|---|---|
| I. Données de jeu traçables | N/A (aucune donnée de jeu). Les chiffres clés citent leur source et disent « Indisponible » si elle manque. |
| II. Exactitude avant optimisation | OK : lecture des réglages, valeurs par défaut, validation d'un changement, première page active, détection de « dernière page active » en fonctions pures testées. |
| III. Décisions explicables | OK : état de chaque page écrit en texte ; la confirmation explique ce qui se passe quand la dernière page est coupée. |
| IV. Petits changements cohérents | OK : une seule liste de pages remplace deux constantes ; aucune dépendance ni routeur ; refonte limitée à l'assemblage et au CSS. |
| V. Données utilisateur | OK : désactiver une page ne supprime rien ; l'action de coupure est réversible et la dernière page demande confirmation. |

Aucune violation, pas de suivi de complexité. Revérifié après conception : inchangé.

## Structure du projet

### Documentation

```text
specs/071-admin-dashboard-moderne/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── site-settings-api.md       # réglage des 7 pages
│   └── admin-dashboard-ui.md      # mise en page et habillage
└── tasks.md                       # créé par /speckit-tasks
```

### Code source

```text
src/domain/site-settings.ts            # modifié : SITE_PAGES, SiteSettings à 7 champs, parse/validate généralisés,
                                       #   firstEnabledPage, enabledPageCount
worker/src/site-settings.ts            # modifié : lecture des 7 clés
worker/migrations/0023_widen_site_settings_keys.sql   # nouveau : CHECK élargi
worker/schema.sql                      # modifié : même CHECK
package.json                           # modifié : worker:db:migrate-site-pages
src/app/AppShell.tsx                   # modifié : navigation et routes gardées par SITE_PAGES
src/app/PageUnavailable.tsx            # nouveau : page « indisponible » commune + « aucune page disponible »
admin/SiteSettingsEditor.tsx           # modifié : 7 pages, confirmation de la dernière page active
admin/dashboard-summary.ts             # modifié : « N pages actives sur 7 »
admin/KeyFigures.tsx                   # nouveau : rangée de chiffres clés
admin/Dashboard.tsx                    # modifié : trois étages
admin/admin.css                        # modifié : habillage moderne
tests/
├── unit/site-settings-domain.test.ts          # modifié
├── unit/site-settings-route.test.ts           # modifié
├── unit/worker-schema.test.ts                 # modifié (0023)
├── unit/admin-dashboard-summary.test.ts       # modifié
├── integration/site-pages-toggle.test.tsx     # nouveau : 7 pages sur le site public
├── integration/admin-dashboard.test.tsx       # modifié : chiffres clés, comptes de liens
└── integration/admin-page.test.tsx            # modifié : 7 pages dans l'éditeur
```

**Décision de structure** : la liste des pages est dans le domaine (déjà partagé par site, administration et
Workers), pas dupliquée. La migration vit dans `worker/` (base partagée).
