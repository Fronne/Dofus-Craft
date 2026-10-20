# Quickstart : validation de l'utilisation Cloudflare

## Automatique

```bash
npx vitest run tests/unit/cloudflare-usage.test.ts tests/integration/admin-page.test.tsx
npm run typecheck && npm run lint
```

Attendu : tout passe (limites et niveaux aux bornes, jours manquants à 0, classification des
erreurs sans fuite de jeton, route réservée au propriétaire, section de la page dans ses quatre
états et bascule 7 / 30).

## Manuel (après accord explicite du propriétaire — rien n'est déployé par cette fonctionnalité)

1. Créer un jeton API Cloudflare (Mon profil ▸ Jetons API ▸ Créer un jeton ▸ personnalisé) avec la
   seule permission **Compte ▸ Analyse du compte ▸ Lecture** (*Account Analytics : Read*).
2. Relever l'identifiant du compte (tableau de bord ▸ Workers & Pages ▸ colonne de droite).
3. Enregistrer les secrets :
   ```bash
   npx wrangler secret put CLOUDFLARE_API_TOKEN --config admin-worker/wrangler.toml
   npx wrangler secret put CLOUDFLARE_ACCOUNT_ID --config admin-worker/wrangler.toml
   ```
4. Déployer l'administration (`npm run admin:build` puis `npm run admin:deploy`), ouvrir la page.
5. Comparer les trois pourcentages du jour avec le tableau de bord Cloudflare (écart ≤ 1 point,
   SC-002) ; basculer en 30 jours.

Sans l'étape 3, la section affiche « Jeton Cloudflare non configuré » avec ces instructions.
