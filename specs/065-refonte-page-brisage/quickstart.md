# Guide de validation : Refonte de la page Brisage

Prérequis : dépendances installées (`npm install`), serveur de développement via `npm run dev` (ou le serveur de prévisualisation du projet).

## 1. Vérifications automatiques

```bash
npm run test
npm run lint
npm run build
```

Attendu : tout passe, y compris les tests de `brisage-search`, `brisage-price`, des préférences et de la page.

## 2. Scénarios à parcourir dans le navigateur (page Brisage)

1. **Entrée par le nom** : ouvrir la page ; le champ de recherche est le premier élément. Taper « abra » : une rangée d'environ 6 cartes apparaît, avec « N objets » et « Afficher plus » (spec, US1).
2. **Choisir un objet** : cliquer une carte ; elle est en évidence, l'en-tête et le tableau s'affichent. En choisir une autre : tout change sans rechargement (US2).
3. **Pas de curseur** : vérifier que les lignes du tableau n'ont que le champ numérique, avec minimum et maximum de chaque côté, et le sélecteur Min / Moyen / Max en tête (FR-010).
4. **Prix Achat / Craft / Auto** : sur un objet dont les deux prix sont connus, Auto retient le plus bas et l'indique ; Achat et Craft forcent chaque prix ; un prix manquant est dit inconnu (US3).
5. **Coefficient** : un objet déjà brisé montre son coefficient ; un autre est marqué « à saisir ». Saisir une valeur met le tableau à jour (US3).
6. **Filtres** : ouvrir Filtres, cocher une catégorie et une stat, fixer des niveaux ; les cartes respectent tout. Replier le panneau : les filtres restent en pastilles retirables (US4).
7. **Stats en 3 colonnes** : Caractéristiques (avec tacle, fuite, esquive, retrait), Dommages, Résistances ; un emplacement d'icône devant chaque stat.
8. **Bas de page** : une ligne avec le coefficient actuel puis après 1, 2 et 3 brisages (US5).
9. **Rechargement** : recharger la page ; l'objet, le mode de prix, les filtres et l'état du panneau sont retrouvés.
10. **Écran étroit (390 px)** : pas de défilement horizontal de la page ; colonnes de stats empilées ; tableau défilant dans son cadre.

## 3. Comparaison avec l'ancienne page (SC-003)

Pour 3 objets (un avec coefficient enregistré, un sans, un sans prix), relever les totaux, gains et coefficients suivants avant puis après : ils doivent être identiques à entrées égales.

## 4. Données

- Après régénération de l'index (`node scripts/build-brisage-items.mjs`), vérifier que le résumé affiche un nombre d'équipements cohérent et que chaque objet a une catégorie.
- Avec la source des objets bloquée (réseau coupé après chargement), la liste affiche son message d'indisponibilité et ne montre pas de liste partielle présentée comme complète.
