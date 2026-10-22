# Recherche : Graphiques sur le tableau de bord de l'administration

Aucun « NEEDS CLARIFICATION » ne subsiste dans le contexte technique. Les points ci-dessous sont les
choix à faire et la seule inconnue réelle (R1).

## R1 — Découpage horaire de la journée Cloudflare

**Décision** : une requête GraphQL dédiée (`readTodayUsage`) qui lit, pour le jour UTC en cours, les
requêtes Workers par heure (`workersInvocationsAdaptive`, dimension `datetimeHour`, déjà utilisée par la
spec 058) et les lectures / écritures D1 par heure (`d1AnalyticsAdaptiveGroups`, dimension
`datetimeHour`, filtre `datetime_geq` / `datetime_leq`). Le serveur renvoie des **incréments par
heure** ; le cumul et les franchissements de seuils sont calculés par des fonctions pures dans
`src/domain/cloudflare-usage.ts`.

**Inconnue** : la documentation de Cloudflare confirme que `d1AnalyticsAdaptiveGroups` accepte un filtre
`datetime_geq` et expose `rowsRead` / `rowsWritten`, mais ne confirme pas la dimension `datetimeHour`
pour ce jeu (les jeux « adaptive » exposent en général les dimensions `datetime*`). Elle se vérifie par
introspection avec le jeton réel (étape 1 de [quickstart.md](quickstart.md)).

**Repli** : si la dimension n'existe pas, essayer `datetimeFiveMinutes` ou `datetime` et regrouper par
heure dans le code. Si aucune ne convient, la route répond `unavailable` pour la courbe : la carte garde
son pourcentage actuel (déjà lu par `/api/usage`) et l'indique. Rien n'est fabriqué (FR-008).

**Pourquoi une requête séparée** : la requête de la spec 058 groupe D1 par `date` ; la modifier
risquerait de casser la section Cloudflare existante si la dimension horaire est refusée. Deux requêtes
valent mieux qu'une requête fragile.

**Alternatives écartées** : stocker nous-mêmes un instantané toutes les heures (cron + table) : nouvelle
collecte, hors périmètre ; afficher seulement 7 jours : refusé par le propriétaire (plafond journalier).

## R2 — Lignes ajoutées par clé sur un mois

**Décision** : lire `sniffer_daily_usage` (clé, jour UTC, `rows_written`) jointe à `sniffer_keys` pour le
libellé et l'état. Une requête par mois demandé : `day >= 'AAAA-MM-01' AND day < 'mois suivant'`. La
clé primaire `(key_id, day)` ne sert pas pour filtrer par jour seul ; le volume reste minuscule (clés ×
jours, quelques centaines de lignes par an), un balayage est acceptable.

**Les clés à 0** : toutes les clés actives sont listées même sans ligne ce mois-ci (FR-003, scénario 2) ;
une clé révoquée n'apparaît que si elle a des lignes ce mois-là (FR-004).

**Mois disponibles** : `SELECT DISTINCT substr(day, 1, 7)`, renvoyés avec la réponse pour proposer le
sélecteur de mois sans deviner.

**Sens du chiffre** : `rows_written` est le compteur que la route d'envoi de lots plafonne (spec 056) :
les « lignes de prix enregistrées » par la clé ce jour-là.

## R3 — Prix communautaires et visites sur 30 jours

**Décision** : une route `GET /api/activity` qui renvoie deux séries :
- prix : `SELECT substr(created_at,1,10) AS day, origin, COUNT(*) FROM community_price_contributions
  WHERE created_at >= ? GROUP BY day, origin` ;
- visites : `SELECT day, COUNT(*) FROM app_visits WHERE day >= ? GROUP BY day` (une ligne par appareil et
  par jour : le nombre de lignes est le nombre de visiteurs uniques).

**Conservation** : aucune purge n'existe sur ces tables (recherche dans `worker/src`) : les 30 jours sont
toujours disponibles, et l'historique plus ancien aussi. Les jours sans ligne sont complétés à 0 côté
serveur ; seule une lecture en échec rend la carte « indisponible » (FR-009).

**Anonymat** : la requête ne sélectionne jamais `device_id` ni `resource_id` (FR-016).

## R4 — Coût des lectures D1

Les lectures de lignes D1 comptent dans la limite quotidienne (5 000 000) que ce tableau de bord
surveille : il ne doit pas l'aggraver. `community_price_contributions` n'a pas d'index sur `created_at`
seul (son index commence par `resource_id`) et `app_visits` a pour clé `(device_id, day)` : sans index,
chaque ouverture du tableau de bord balaierait les deux tables entières.

**Décision** : migration `0022` avec deux index, `community_price_contributions (created_at, origin)` (couvrant
pour la requête) et `app_visits (day)`. Reportés dans `schema.sql` pour une base neuve. Les lectures
restent proportionnelles aux 30 derniers jours.

**Alternatives écartées** : mettre le résultat en cache (état à gérer, données périmées) ; table de
cumuls journaliers (nouvelle collecte et écriture à chaque prix) ; limiter à 7 jours (la spec demande 30).

## R5 — Forme des graphiques

**Décision** : SVG écrits à la main, sans bibliothèque, comme `UsageChart.tsx` : trois composants
(`DayUsageChart` courbe, `BarList` barres horizontales, `DailyColumns` colonnes empilables). Distinction
par motif de trait en plus de la couleur (FR-006), valeurs exactes en `<title>` au survol et dans un
`<details>` en tableau pour le clavier et les lecteurs d'écran, adaptation par `viewBox` (téléphone), couleurs
via les variables CSS de `admin.css` (thème clair / sombre).

**Alternatives écartées** : bibliothèque de graphiques (dépendance et poids pour trois formes simples,
contre le principe IV) ; canvas (pas d'équivalent texte natif).

## R6 — Carte lien et visuel

**Décision** : la carte devient un `<li>` contenant le lien (titre + résumé, comme aujourd'hui) et, à
côté, le visuel. Le nom accessible du lien reste « titre + résumé » (les tests de la spec 068 continuent
de passer) et le `<details>` n'est pas imbriqué dans un lien. Les deux cartes nouvelles (« Prix
communautaires », « Visites ») n'ont pas de section : le titre n'est pas un lien, la carte est un bloc de
lecture.

## R7 — Visuels calculés côté navigateur

Sans route nouvelle, à partir des lectures déjà faites par le tableau de bord :
- **Correspondances** : `uploadedAt` de la correspondance active → « publiée il y a N jours » ; signalée en
  texte au-delà de 30 jours.
- **Clés endormies** : `lastSeenAt` → jamais utilisée, ou aucun envoi depuis plus de 30 jours.
- **Compteurs** : barres de `count` par joueur (`BarList`).
- **Bandeau** : `endsAt` → « se termine dans N jours / heures » ou « sans fin programmée ».

Toutes ces règles sont des fonctions pures de `dashboard-insights.ts`, prenant `now` en paramètre pour être
testées sans horloge.
