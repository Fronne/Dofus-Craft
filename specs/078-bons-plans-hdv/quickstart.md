# Quickstart : valider les bons plans HDV

## Prérequis

- Dépendances installées, base D1 locale migrée (`0028`).
- Un serveur de développement lancé (voir `package.json`), le Worker en local.

## Scénario 1 – Règle de comparaison (sans réseau)

```bash
npx vitest run tests/unit/good-deals.test.ts
```

Attendu : exemplaire à –30 % marqué, –10 % non marqué, jet supérieur au même prix marqué, exemplaire sans 3 voisins non marqué, prix aberrant sans effet sur la référence, exo comparé aux seuls exos identiques.

## Scénario 2 – Envoi des exemplaires

```bash
npx vitest run tests/unit/sniffer-copies.test.ts
```

Attendu : une observation avec `copies` écrit les annonces ; une sans `copies` n'y touche pas ; un lot qui omet un exemplaire le supprime ; une copie invalide est refusée (`invalid`) ; le plafond compte les copies.

## Scénario 3 – Lecture et fraîcheur

```bash
npx vitest run tests/unit/bons-plans-route.test.ts
```

Attendu : annonces de plus de 24 h absentes, serveur inconnu refusé, objets à moins de 4 annonces exclus.

## Scénario 4 – Parcours complet (à la main)

1. Injecter des annonces d'essai (jeu de données de `tests/`), ouvrir `/bons-plans` : les bons plans apparaissent, triés par économie.
2. Changer le tri en pourcentage, filtrer « exo uniquement » : la liste suit.
3. Changer de serveur : la liste change.
4. Passer le seuil à 40 % dans l'administration : les annonces entre 25 et 40 % disparaissent.
5. Ouvrir l'objet d'une annonce : la pastille « Bon plan » est sur la bonne ligne.

Après chaque modification locale, donner l'URL du serveur de développement où tester.
