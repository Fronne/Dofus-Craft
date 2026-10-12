# Quickstart: vérifier la page Forgemagie en séances de FM

Prérequis : Node 22.

```bash
export PATH="/c/Users/Cyril/AppData/Roaming/nvm/v22.23.3:$PATH"
```

## Tests automatiques

```bash
npx vitest run tests/unit/forgemagie-domain.test.ts tests/unit/fm-api.test.ts tests/integration/forgemagie-page.test.tsx
npx tsc -b --noEmit
npx eslint src tests --quiet
npx vitest run
```

## Vérification à l'écran (site local)

1. Lancer le site local (configuration `dofus-craft`, port 5173) et ouvrir la page Forgemagie.
2. Non connecté : texte de connexion, bouton « Se connecter avec Discord », note sur la liste des serveurs.
   L'adresse du bouton finit par `/fm/auth/login?return_to=http%3A%2F%2Flocalhost%3A5173`.
3. La suite demande une connexion Discord, que seul le joueur peut faire : onglets « Séances de FM »,
   nom du groupe, « Profil » ; ouvrir une séance ; déplier une session et une capture.
4. Ne pas créer, archiver ni corriger sur le site local : il parle à l'API de production.

Le contrat du client est dans [contracts/fm-seances-client.md](./contracts/fm-seances-client.md).

## Résultats

- Référence avant modification (branche `master`, 12 octobre 2026) : 1 069 tests passent.
- Après implémentation (branche `049-fm-seances`, 12 octobre 2026) : 1 118 tests, dont 1 117 passent dans la suite complète (25 dans
  `forgemagie-domain.test.ts`, 24 dans `fm-api.test.ts`, 52 dans `forgemagie-page.test.tsx`) ;
  `npx tsc -b --noEmit` et `npx eslint src tests --quiet` sans erreur. Le test restant, de la page HDV
  (« shows the latest shared price over an older kept one », specs/024), dépasse son délai quand toute
  la suite tourne et passe quand son fichier est lancé seul (20 sur 20) ; il n'est pas touché ici.
- À l'écran (site local) : étapes 1 et 2 vérifiées — texte de connexion, note sur la liste des
  serveurs, adresse du bouton finissant par `/fm/auth/login?return_to=http%3A%2F%2Flocalhost%3A5173`.
  L'étape 3 demande la connexion Discord du joueur : elle reste à faire par lui.
- La section Forgemagie de `src/styles/global.css` reprend, règle pour règle, les 164 règles `.fm-*`
  de la feuille du site en ligne (plus `.hdv-item-caption`, de specs/046).
