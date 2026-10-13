# Quickstart: valider le nouveau style

Références : [spec.md](./spec.md), [contracts/ui-contract.md](./contracts/ui-contract.md),
[data-model.md](./data-model.md).

## Préparation

```bash
npm install
npm run dev
```

Ouvrir l'adresse locale affichée. Garder la maquette ouverte à côté :
<https://claude.ai/artifact/Uv5f1SQ9rodZjd2qN8hpXK> (planches « Version 3 »).

## Vérifications automatiques

```bash
npm run typecheck
npm run lint
npm run test
npm run test:e2e
```

Attendu : tout passe. Aucune attente portant sur un calcul ou une donnée n'a été modifiée
(SC-005) ; `tests/unit/theme-contrast.test.ts` valide les contrastes des deux thèmes (SC-003).

## Parcours manuels

1. **Style partout (histoire 1)** — thème sombre, ouvrir Recherche, Suivis, Rentabilité, HDV,
   XP Familier, Forgemagie (si activée), Paramètres, puis un dialogue, un menu déroulant, la visite
   guidée et le choix du serveur. Attendu : palette de la maquette partout, aucun reste bleu ou
   gris de l'ancien style.
2. **Barre du haut (histoire 2)** — fenêtre de 1440 px : barre en haut, plus de colonne à gauche,
   losange sous la rubrique active, barre toujours visible en faisant défiler. Réduire à 1000 px :
   la barre passe sur deux lignes, rien n'est masqué. Réduire à 900 px puis 375 px : navigation en
   bas d'écran, comme avant.
3. **Page Recherche (histoire 3)** — filtrer sur « Cape », niveau 190 à 200 : 6 résultats,
   « Afficher 12 de plus » en montre 18. Replier les filtres : deux pastilles ; en retirer une.
   Choisir « Voile d'encre » : comparer verdict, ressources et effets à la maquette, à 1440 px.
4. **Thème clair (histoire 4)** — basculer le thème et refaire les parcours 1 à 3. Attendu : même
   style, tout lisible.
5. **Réglages (histoire 5)** — avant de charger la nouvelle version, choisir dans l'ancienne le
   design « Classique » et l'accent rouge ; charger la nouvelle. Attendu : nouveau style, pas
   d'erreur dans la console, plus de réglage Design ni Accent dans Paramètres.
6. **Largeurs** — 320, 375, 768, 960, 961, 1280, 1920 px : aucune page ne défile horizontalement.
7. **Animations réduites** — activer la réduction des animations du système : plus aucune
   animation décorative.
8. **Administration** — `npm run admin:dev` : l'application d'administration a le nouveau style.

## Avant la fusion

Montrer le thème clair à l'utilisateur (il n'a pas été maquetté) et obtenir son accord (SC-007).
