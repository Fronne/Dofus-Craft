# Quickstart : valider le prix HDV partagé

## Prérequis

- `npm install` ; Worker local `npm run worker:dev` (D1 locale, schéma `worker/schema.sql`) ; app
  `npm run dev` pointant vers ce Worker (`VITE_COMMUNITY_API_URL`).
- Deux profils de navigateur (A et B), Mode communautaire, serveur Mikhal ; objet : Dagues de Fouraille.

## Scénario 1 — partager puis voir (US1, US2)

1. A : ouvrir les Dagues, champ Prix HDV vide ; saisir 6 000, quitter le champ.
2. Attendu (A) : champ verrouillé, « Dernière mise à jour : maintenant ».
3. B : ouvrir les Dagues → 6 000 verrouillé, même date ; la comparaison l'utilise.
4. A : crayon, 7 000, quitter → B (rechargement) voit 7 000 : le **dernier**, pas une moyenne.

## Scénario 2 — confirmation (US3)

1. Dernier prix 7 000 ; saisir 10 000 (≈ 43 %) → pas de confirmation, partagé.
2. Saisir 100 000 (+900 %) → confirmation « Dernier prix : 10 000 kamas » ; Annuler → retour à 10 000, rien partagé ; recommencer et Confirmer → 100 000 partagé.

## Scénario 3 — Suivis (US4)

1. Suivre les Dagues sur A ; B partage 8 000 ; A ouvre Suivis → « HDV : 8 000 kamas ».

## Scénario 4 — Mode personnel inchangé

1. Passer A en Mode personnel : le prix HDV local d'avant s'affiche (ou vide), non verrouillé, sans date ; une saisie n'est pas partagée (B ne la voit pas).

## Tests automatisés

```bash
npx vitest run tests/unit/community-latest-price.test.ts tests/unit/use-shared-item-price.test.tsx \
  tests/integration/shared-item-price.test.tsx
npx vitest run
```
