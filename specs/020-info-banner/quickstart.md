# Quickstart : valider le bandeau

## Automatique

```bash
npm run typecheck
npx vitest run tests/unit/info-message* tests/unit/admin-message-api.test.ts tests/unit/info-banner-dismissal.test.ts tests/integration/info-banner.test.tsx
```

## Mise en place

```bash
npm run worker:db:migrate-info-message   # crée la table info_message (distante)
npm run worker:deploy && npm run admin:build && npm run admin:deploy
npm run build && npx wrangler deploy
```

## Manuel

1. Page d'administration → « Bandeau d'information » : écrire un message « Important », publier.
2. Ouvrir le site (autre appareil) : bandeau rouge en haut, sur toutes les pages.
3. Fermer : il disparaît, et reste fermé après rechargement.
4. Republier un autre texte : il réapparaît.
5. Fixer une date de fin dans 2 minutes, attendre : il disparaît.
6. « Retirer » : plus de bandeau.
