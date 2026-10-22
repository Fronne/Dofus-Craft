# Parcours de validation : Atelier des prix du craft sur la page Brisage

Contrat d'interface : [contracts/atelier-prix-ui.md](contracts/atelier-prix-ui.md). Données :
[data-model.md](data-model.md).

## Prérequis

```bash
npm install
npm run dev
```

Ouvrir `/brisage`, choisir un serveur. Prendre un objet dont la recette contient au moins un composant
craftable (par exemple une cape ou un anneau de haut niveau).

## Tests automatiques

```bash
npx vitest run tests/integration/brisage-craft-prices.test.tsx tests/unit/item-craft-cost.test.ts
npx vitest run tests/integration/brisage-page.test.tsx
```

Résultat attendu : tous passent, sauf le test « prix personnalisé… » de `brisage-page.test.tsx`, déjà en
échec sur `master` avant cette fonctionnalité.

## Parcours manuel

1. **Ouverture** : choisir l'objet ; le bouton « Prix du craft » est dans l'en-tête, à côté du prix « Craft ». Sur un objet sans recette, il est absent.
2. **Liste** : cliquer ; la fenêtre montre une ligne par ressource, les composants craftables dépliés avec leurs ressources, les quantités cumulées, l'ancienneté de chaque prix.
3. **Total en direct** : changer le prix d'une ressource ; son sous-total et le total du craft changent pendant la frappe.
4. **Clavier** : à l'ouverture le premier champ est actif ; saisir un prix puis Entrée passe au champ suivant ; Échap ferme.
5. **Sous-recette** : choisir « Acheter » puis « Crafter » sur un composant ; le total suit, comme sur Recherche.
6. **Prix invalide** : taper des lettres ou `0` puis Entrée ; l'ancien prix est conservé.
7. **Fermeture** : le prix « Craft » de l'en-tête, le verdict et les gains sont recalculés, sans recharger la page.
8. **Cohérence** : ouvrir le même objet sur la page Recherche ; les prix de ressources et le total du craft sont identiques.
9. **Mode communautaire** : répéter les étapes 3 et 7 en mode communautaire ; le prix est partagé comme sur Recherche.
10. **Petit écran** : réduire la fenêtre du navigateur à 375 px ; la liste défile, le total et « Fermer » restent visibles.
