# Quickstart: validation des thèmes de Dofus

## Prérequis

- Dépendances installées (`npm install`) ; les six images présentes dans `public/`.
- Serveur de dev lancé (`npm run dev`), ou l'URL du serveur de test.

## Contrôles automatiques

```bash
npm run test
```

Attendu : liste et repli (`dofus-themes.test.ts`), contrastes des 12 palettes
(`theme-contrast.test.ts`), section Paramètres (`settings-dofus.test.tsx`).

```bash
npx playwright test tests/e2e/dofus-theme.spec.ts
```

Attendu : choix d'un Dofus, rechargement, absence de flash.

## Parcours manuel

1. Ouvrir `/parametres` : six Dofus visibles, émeraude actif, site identique à avant.
2. Cliquer sur chaque Dofus : couleurs du site, icône de la barre de navigation et icône d'onglet
   changent à chaque clic, sans rechargement (US1, US2).
3. Changer de page (Recherche, Brisage, Prix) : le thème reste (US1, scénario 3).
4. Basculer clair/sombre avec chaque Dofus : texte lisible, mode inchangé par le choix du Dofus.
5. Recharger la page, puis fermer et rouvrir le site : même Dofus, aucun flash vert (US3).
6. Dans la console : `localStorage.setItem('craftcheck-dofus','n-importe-quoi')`, recharger :
   émeraude (cas limite).
7. Bloquer `api.dofusdb.fr` : les icônes restent affichées (images locales).

## Critères de réussite

Correspondent aux SC-001 à SC-005 de la [spec](spec.md).
