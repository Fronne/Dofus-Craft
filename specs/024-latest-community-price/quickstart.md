# Quickstart: vérifier le dernier prix partagé des ressources

## Prérequis

- `npm install`
- Pour les essais manuels contre une base locale : `npm run worker:dev`, puis
  `VITE_COMMUNITY_API_URL` dans `.env.local` pointant vers l'URL affichée. Ne pas faire ces essais
  contre l'API de production : les prix envoyés seraient réels.

## Tests automatisés

```bash
npm run typecheck
npm run test          # unitaires + intégration (Vitest)
npm run test:e2e      # Playwright, API communautaire coupée
```

Attendu : tout passe, en particulier
- la règle de choix (voir [data-model.md](data-model.md), tableau `pickCommunityPrice`) ;
- les réponses du Worker avec `latestAmountKamas` / `latestContributionAt`
  ([contracts/community-price-api.md](contracts/community-price-api.md)) ;
- l'absence du texte « Médiane » et de la médiane dans la confirmation d'un prix de ressource.

## Scénarios manuels (Worker local, Mode communautaire, serveur de test)

1. **Dernier prix affiché** (US1) : envoyer 100, 200 puis 150 kamas pour une ressource. Ouvrir une
   recette qui l'utilise dans un navigateur neuf → la ligne affiche 150 kamas et la date du dernier
   envoi.
2. **Remplacement du prix gardé** (US2) : dans un navigateur A, ouvrir la recette (150 gardé).
   Depuis un navigateur B, envoyer 180. Attendre 1 minute, rouvrir la recette dans A → 180.
3. **Prix gardé plus récent conservé** (US2) : couper le Worker, saisir 170 dans A, relancer le
   Worker sans nouvel envoi → A garde 170.
4. **Saisie en cours** (US2) : commencer à taper dans le champ pendant qu'une lecture arrive → la
   valeur tapée reste.
5. **Même coût partout** (US3) : pour un objet utilisant cette ressource, le coût de craft est le même
   sur Recherche, Rentabilité et Suivis ; XP Familier affiche le dernier prix sans « Médiane ».
6. **Prix aberrant** (US4) : la médiane valant 100 (hors du dernier prix), saisir 200 → confirmation
   affichant 200 kamas et le message, sans 100 ni pourcentage. Saisir 120 → pas de confirmation.
7. **Base** : après l'envoi de l'étape 6, la ligne en base a `median_at_submission_kamas` et
   `deviation_percent` remplis.

## Déploiement

```bash
npm run worker:deploy       # d'abord le Worker (champs ajoutés, rétrocompatible)
npm run build && npx wrangler deploy
```
