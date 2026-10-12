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
