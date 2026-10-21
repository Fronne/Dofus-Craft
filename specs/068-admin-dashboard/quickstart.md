# Guide de validation : tableau de bord de l'administration

## Prérequis

Dépendances installées (`npm install`). Voir le README, section Administration, pour lancer l'interface d'administration en local.

## Automatique

```bash
npm run test
npm run lint
npm run build
```

Doit passer : tests unitaires des résumés (`tests/unit/admin-dashboard-summary.test.ts`), tests d'intégration du tableau de bord et de la page (`tests/integration/admin-dashboard.test.tsx`, `admin-page.test.tsx`).

## Manuel

1. Ouvrir l'administration : six cartes avec leur résumé (spec Parcours 1).
2. Cliquer chaque carte : la section seule s'affiche et fonctionne comme avant (Parcours 2).
3. « Retour au tableau de bord » : les cartes reflètent les modifications faites.
4. Section ouverte puis « précédent » du navigateur : retour au tableau de bord ; recharger `/#compteurs` : la section s'ouvre ; `/#nimporte` : tableau de bord (Parcours 3).
5. Largeur téléphone (≈ 375 px) : une colonne, tout cliquable ; Tab atteint chaque carte avec un focus visible.
6. Thèmes clair et sombre : cartes lisibles.
