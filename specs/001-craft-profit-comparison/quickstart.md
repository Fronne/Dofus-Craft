# Quickstart: Validation de Dofus Craft

## Prérequis

- Node.js 24 LTS et npm disponibles.
- Un navigateur moderne de bureau et un émulateur ou navigateur mobile.
- Les données de démonstration doivent inclure au moins deux recettes partageant une ressource,
  une recette sans prix complet et un objet sans recette.

## Démarrage attendu après implémentation

```bash
npm install
npm run dev
```

Ouvrir l'URL locale fournie par le serveur de développement.

## Contrôles automatisés attendus

```bash
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

Ces commandes doivent couvrir les règles de [data-model.md](./data-model.md) et les interactions
exposées dans [ui-and-storage.md](./contracts/ui-and-storage.md).

## Parcours de validation

### 1. Comparaison complète

1. Rechercher un objet fabriquable et le sélectionner.
2. Vérifier son nom, sa catégorie, son visuel ou repli, chaque ressource et chaque quantité.
3. Renseigner un prix entier valide pour toutes les ressources et un prix HDV.
4. Vérifier manuellement que chaque sous-total est `quantité × prix`, que le coût est la somme, et
   que la recommandation, l'écart et le pourcentage suivent les règles du modèle de données.
5. Modifier une ressource ; vérifier le recalcul immédiat et la nouvelle date de modification.

**Résultat attendu**: la décision craft, achat ou équivalence est explicite et justifiée par les
montants affichés.

### 2. Réutilisation persistante

1. Après le premier parcours, ouvrir une seconde recette contenant la même ressource.
2. Vérifier que son prix et sa date sont réutilisés.
3. Actualiser l'application puis revérifier la même recette.

**Résultat attendu**: le prix subsiste sur le même navigateur et la date affichée correspond à la
dernière modification confirmée.

### 3. Données incomplètes et invalides

1. Choisir une recette et laisser au moins un prix de ressource vide.
2. Saisir successivement un texte, un montant négatif et une décimale dans un champ prix.
3. Laisser le prix HDV absent, puis saisir 0.

**Résultat attendu**: les saisies invalides sont expliquées, le coût partiel reste visible, aucune
recommandation définitive n'est affichée avec une donnée manquante, et aucun pourcentage invalide
n'est produit avec une base nulle.

### 4. Responsive et accessibilité

1. Répéter le parcours principal à 320 px de large et sur un écran de bureau.
2. Utiliser le clavier pour la recherche, la sélection et l'édition de prix.
3. Vérifier que chaque champ possède un libellé, que les erreurs sont annoncées et qu'aucune action
   essentielle n'exige un défilement horizontal.

**Résultat attendu**: le parcours est réalisable sur les deux formats et les informations de
comparaison restent lisibles.
