# Recherche : utilisation Cloudflare dans l'administration

## 1. Source des données

**Décision** : API GraphQL Analytics de Cloudflare, `POST https://api.cloudflare.com/client/v4/graphql`,
en-tête `Authorization: Bearer <jeton>`, une requête combinée :

```graphql
query ($account: String!, $from: Date!, $to: Date!, $fromTime: Time!, $toTime: Time!) {
  viewer {
    accounts(filter: { accountTag: $account }) {
      workers: workersInvocationsAdaptive(
        limit: 100
        filter: { datetime_geq: $fromTime, datetime_leq: $toTime }
      ) { sum { requests } dimensions { date } }
      d1: d1AnalyticsAdaptiveGroups(
        limit: 100
        filter: { date_geq: $from, date_leq: $to }
      ) { sum { rowsRead rowsWritten } dimensions { date } }
    }
  }
}
```

**Raison** : jeu de données au niveau du compte (c'est le niveau du plafond), regroupé par jour UTC,
une seule requête. `limit: 100` couvre 30 jours × quelques lignes (un script ou une base par jour
est agrégé par la dimension `date` seule, donc une ligne par jour).

**Alternatives** : API REST par Worker / par base (plusieurs appels, pas de total compte) ; copier
les relevés dans D1 chaque jour (écritures D1 en plus, hors besoin — FR-010).

**À vérifier à l'implémentation** : les noms exacts de champs ne peuvent pas être testés contre le
vrai compte sans jeton ; le code les isole dans une constante de requête et les tests figent la
forme de la réponse attendue. Une réponse de forme inattendue donne l'état `unavailable`, jamais
des zéros inventés. La vérification réelle se fait au premier déploiement avec accord du
propriétaire (voir quickstart).

## 2. Secrets

**Décision** : `CLOUDFLARE_API_TOKEN` (jeton « Account Analytics : Read », lecture seule) et
`CLOUDFLARE_ACCOUNT_ID`, deux secrets du Worker (`wrangler secret put … --config
admin-worker/wrangler.toml`), optionnels dans le type `Env`. Documentés dans `wrangler.toml` et le
README, comme `OWNER_EMAIL`.

**Raison** : demandé par le propriétaire ; constitution V. L'identifiant de compte n'est pas
vraiment secret mais suit la même voie pour ne pas toucher à `wrangler.toml` versionné.

## 3. Forme de la réponse de l'API admin

**Décision** : `GET /api/usage?days=7|30` répond toujours 200 (sauf 403 propriétaire) avec un objet
discriminé par `state`. Autre valeur de `days` → 400 `{ error, field: 'days' }`.

**Raison** : `adminApi.call` traite tout statut hors 2xx comme « indisponible » ; un état
« non configuré » est un cas normal, pas une panne. Le détail d'erreur de Cloudflare n'est pas
transmis (catégorie seulement) : un jeton ne doit pas pouvoir fuir.

**Alternatives** : 503 pour « non configuré » (le client générique ne distinguerait pas les cas).

## 4. Classification des erreurs Cloudflare

- Secret manquant → `not-configured`, `missing` liste lequel (sans appel réseau).
- HTTP 401 / 403, ou erreur GraphQL d'authentification → `denied`.
- Échec réseau, autre HTTP non-2xx, JSON invalide, forme inattendue, ou `errors` non liés à
  l'authentification → `unavailable`.

## 5. Jours et fuseau

**Décision** : jours UTC ; `to` = aujourd'hui UTC, `from` = aujourd'hui − (days − 1). Les jours
absents de la réponse sont remplis à 0 côté Worker, de sorte que la réponse contient exactement
`days` points, du plus ancien au plus récent. L'horloge est injectée pour les tests.

## 6. Graphique

**Décision** : SVG en ligne dans `admin/UsageChart.tsx`, trois courbes en % de la limite
(plafonnées à l'échelle du graphique à max(100, plus grand %)), plus un tableau textuel masqué
visuellement mais lu par les lecteurs d'écran, et un `title` par point. Aucune bibliothèque.

**Raison** : constitution IV ; 7–30 points ne justifient pas une dépendance.

## 7. Limites et seuil

**Décision** : constantes dans `src/domain/cloudflare-usage.ts` (100 000 / 5 000 000 / 100 000),
seuil d'alerte 80 %. Niveau texte : « Dans la limite », « Proche de la limite », « Limite dépassée ».
