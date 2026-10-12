# Quickstart : vérifier l'activation / désactivation de la page Forgemagie

## Tests automatiques

```bash
npm run test -- site-settings forgemagie-page-toggle admin-page
npm run typecheck
```

## Mise en service (une fois)

1. Appliquer la migration : `npm run worker:db:migrate-site-settings`.
2. Déployer le Worker public (`npm run worker:deploy`), l'administration (`npm run admin:build`
   puis `npm run admin:deploy`) et le site.

Tant que la migration n'est pas appliquée, la lecture échoue et le site garde la page désactivée.

## Vérification manuelle

1. Ouvrir le site sans rien activer : pas de lien « Forgemagie » ; `/forgemagie` affiche
   « Forgemagie est momentanément indisponible » (US1).
2. Dans l'administration, section « Pages du site », cliquer « Activer » : l'état passe à
   « Activée ». Recharger le site : le lien et la page sont de retour (US2).
3. Cliquer « Désactiver », recharger le site : le lien et la page ont disparu (US2).
4. Page activée, charger le site, couper le réseau, recharger : la page reste accessible (US3).

Voir [contracts/site-settings-api.md](./contracts/site-settings-api.md) et
[data-model.md](./data-model.md).
