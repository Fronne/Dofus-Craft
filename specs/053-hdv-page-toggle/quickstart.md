# Quickstart: Activer ou désactiver la page HDV

## Vérifications automatiques

```bash
npx vitest run tests/unit/site-settings-domain.test.ts tests/unit/site-settings-route.test.ts tests/integration/hdv-page-toggle.test.tsx tests/integration/admin-page.test.tsx tests/integration/app-nav.test.tsx
npx tsc -b --noEmit
npx tsc -p worker --noEmit
```

Attendu : lecture par défaut `{ forgemagiePage: false, hdvPage: true }` ; changer `hdvPage` ne
touche pas `forgemagiePage` ; page HDV désactivée → pas de lien « HDV » et message d'indisponibilité
sur `/hdv` ; ancien cache `{ forgemagiePage: true }` → page HDV visible.

## Mise en service (dossier principal, une fois)

1. Appliquer la migration : `npm run worker:db:migrate-hdv-page-setting`. Elle peut être relancée
   si elle s'arrête en cours de route.
2. Redéployer dans cet ordre le Worker public, l'administration (`npm run admin:build` puis
   `npm run admin:deploy`) et le site. Chaque étape reste compatible avec les autres pendant la
   transition ; seule une administration déployée avant la migration refuserait d'enregistrer le
   réglage HDV (erreur affichée, rien de perdu).
3. Dans l'administration, « Pages du site » : « Page HDV : Activée ». Cliquer « Désactiver »,
   recharger le site : le lien « HDV » disparaît et `/hdv` affiche le message. Réactiver.
4. Vérifier que le réglage Forgemagie n'a pas changé.
